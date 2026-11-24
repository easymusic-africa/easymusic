// POST /api/checkout
// Crée la commande (prix fixé ICI, côté serveur) puis ouvre la page de paiement Notch Pay.
// Remplace l'ancien api/init.js.

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PRICE = 1000;
const CURRENCY = "XAF";

const LIMITS = { recipient: 80, story: 1500, email: 120 };
const OCCASIONS = ["Anniversaire", "Mariage", "Déclaration d'amour", "Remerciement", "Hommage", "Autre"];
const STYLES = ["Afrobeat", "Afropop", "Gospel", "Amapiano", "Makossa", "R&B", "Zouk", "Rap / Afrotrap"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function clean(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    const body = req.body || {};
    const recipient = clean(body.recipient, LIMITS.recipient);
    const story = clean(body.story, LIMITS.story);
    const email = clean(body.email, LIMITS.email).toLowerCase();
    const occasion = clean(body.occasion, 80);
    const style = clean(body.style, 60);

    if (!recipient || !story || !email || !occasion || !style) {
      return res.status(400).json({ error: "Veuillez remplir tous les champs." });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Adresse email invalide." });
    }
    if (!OCCASIONS.includes(occasion) || !STYLES.includes(style)) {
      return res.status(400).json({ error: "Occasion ou style invalide." });
    }

    // Référence longue et imprévisible : elle sert aussi de lien secret pour retrouver la chanson.
    const reference = "EM" + crypto.randomUUID().replace(/-/g, "");

    const { error: insertError } = await supabase.from("orders").insert({
      reference,
      amount: PRICE,
      currency: CURRENCY,
      email,
      recipient,
      occasion,
      style,
      story
    });

    if (insertError) {
      console.error("checkout insert error", insertError.message);
      return res.status(500).json({ error: "Impossible d'enregistrer la commande." });
    }

    const origin = process.env.SITE_URL || `https://${req.headers.host}`;

    const notchResponse = await fetch("https://api.notchpay.co/payments", {
      method: "POST",
      headers: {
        Authorization: process.env.NOTCHPAY_PUBLIC_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: PRICE,
        currency: CURRENCY,
        email,
        reference,
        description: "Chanson personnalisée EasyMusic",
        callback: `${origin}/?order=${reference}`
      })
    });

    const notchData = await notchResponse.json().catch(() => null);
    const authorizationUrl = notchData && notchData.authorization_url;

    if (!notchResponse.ok || !authorizationUrl) {
      console.error("Notch init error", notchResponse.status, JSON.stringify(notchData));
      await supabase.from("orders").update({ status: "PAYMENT_FAILED" }).eq("reference", reference);
      return res.status(502).json({ error: "Impossible d'ouvrir la page de paiement pour le moment." });
    }

    const notchReference = notchData.transaction && notchData.transaction.reference;
    if (notchReference) {
      await supabase.from("orders").update({ notch_reference: notchReference }).eq("reference", reference);
    }

    return res.status(200).json({ authorizationUrl, order: reference });
  } catch (error) {
    console.error("checkout error", error && error.message);
    return res.status(500).json({ error: "Une erreur interne est survenue." });
  }
}
