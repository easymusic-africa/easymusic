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
    const reference = req.body?.data?.reference || req.body?.reference;
    if (!reference) {
      return res.status(400).json({ error: 'Référence de transaction manquante' });
    }

    const verifyRes = await axios.get(
      `https://api.notchpay.co/payments/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: process.env.NOTCHPAY_PUBLIC_KEY
        }
      }
    );

    const status = verifyRes.data?.transaction?.status;

    if (status === 'complete') {
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('transaction_id', reference)
        .single();

      if (txError || !txData) {
        return res.status(404).json({ error: 'Transaction introuvable' });
      }

      if (txData.status === 'SUCCESS') {
        return res.status(200).json({ message: 'Déjà crédité' });
      }

      await supabase
        .from('transactions')
        .update({ status: 'SUCCESS' })
        .eq('transaction_id', reference);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', txData.user_id)
        .single();

      const currentCredits = profileData?.credits || 0;
      await supabase
        .from('profiles')
        .update({ credits: currentCredits + txData.credits_added })
        .eq('id', txData.user_id);

      return res.status(200).json({ success: true });
    }

    if (status === 'failed' || status === 'canceled' || status === 'expired') {
      await supabase
        .from('transactions')
        .update({ status: 'FAILED' })
        .eq('transaction_id', reference);
    }

    return res.status(200).json({ received: true, status: status || 'pending' });
  } catch (error) {
    console.error('Erreur webhook Notch Pay:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erreur interne webhook' });
  }
}
