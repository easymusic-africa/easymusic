import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { userId, email, amount, creditsAdded, currency = 'XAF', callbackUrl } = req.body;

    if (!userId || !email || !amount || !creditsAdded) {
      return res.status(400).json({ error: 'Paramètres de paiement incomplets' });
    }

    const reference = `EM_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const { error: insertError } = await supabase
      .from('transactions')
      .insert({
        transaction_id: reference,
        user_id: userId,
        amount: amount,
        credits_added: creditsAdded,
        status: 'PENDING'
      });

    if (insertError) {
      return res.status(500).json({ error: 'Erreur base de données', details: insertError.message });
    }

    const notchResponse = await axios.post(
      'https://api.notchpay.co/payments/initialize',
      {
        email: email,
        amount: amount,
        currency: currency,
        reference: reference,
        callback: callbackUrl || `https://${req.headers.host}/`
      },
      {
        headers: {
          Authorization: process.env.NOTCHPAY_PUBLIC_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const checkoutUrl = notchResponse.data?.authorization_url;
    if (!checkoutUrl) {
      return res.status(502).json({ error: 'URL de paiement non reçue de Notch Pay', data: notchResponse.data });
    }

    return res.status(200).json({
      authorization_url: checkoutUrl,
      reference: reference
    });
  } catch (error) {
    console.error('Erreur init Notch Pay:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erreur initialisation paiement' });
  }
}
