import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    const { userId, userEmail, userPhone, amount, creditsToAdd, description } = req.body;

    if (!userId || !amount || !creditsToAdd) {
      return res.status(400).json({ 
        error: "Paramètres manquants : userId, amount et creditsToAdd sont obligatoires." 
      });
    }

    const transactionId = "EASY_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

    // Enregistrement de la transaction en attente dans Supabase
    const { error: dbError } = await supabase
      .from('transactions')
      .insert([
        {
          transaction_id: transactionId,
          user_id: userId,
          amount: amount,
          currency: 'XOF',
          status: 'PENDING',
          credits_added: creditsToAdd
        }
      ]);

    if (dbError) {
      console.error("Erreur Supabase:", dbError);
      return res.status(500).json({ error: "Erreur lors de l'initialisation de la transaction en base de données." });
    }

    // Appel de l'API CinetPay
    const paymentData = {
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: transactionId,
      amount: amount,
      currency: "XOF",
      description: description || `Achat de ${creditsToAdd} crédits sur Easy Music`,
      return_url: `${req.headers.origin || 'https://votre-site.com'}/success?transaction_id=${transactionId}`,
      cancel_url: `${req.headers.origin || 'https://votre-site.com'}/cancel`,
      notify_url: `https://${req.headers.host}/api/payment/webhook`,
      customer_email: userEmail || "client@easymusic.com",
      customer_name: "Utilisateur Easy Music",
      customer_phone_number: userPhone || ""
    };

    const cinetPayResponse = await axios.post('https://api-checkout.cinetpay.com/v2/payment', paymentData);
    const responseData = cinetPayResponse.data;

    if (responseData && responseData.code === '201') {
      return res.status(200).json({
        success: true,
        payment_url: responseData.data.payment_url,
        transaction_id: transactionId
      });
    } else {
      await supabase
        .from('transactions')
        .update({ status: 'FAILED' })
        .eq('transaction_id', transactionId);

      return res.status(400).json({
        error: "Erreur lors de l'initialisation du paiement avec l'opérateur.",
        details: responseData
      });
    }

  } catch (error) {
    console.error("Erreur serveur:", error.message);
    return res.status(500).json({ error: "Erreur serveur interne", details: error.message });
  }
}
