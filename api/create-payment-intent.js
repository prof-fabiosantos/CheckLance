import Stripe from 'stripe';

export default async function handler(req, res) {
  // Configurar CORS para permitir chamadas do frontend
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("ERRO CRÍTICO: STRIPE_SECRET_KEY não encontrada nas variáveis de ambiente.");
    return res.status(500).json({ 
      error: 'Configuração do Servidor Incompleta: STRIPE_SECRET_KEY não encontrada. Verifique o painel da Vercel.' 
    });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { amount } = req.body;

    // Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents (R$ 10.00 -> 1000)
      currency: 'brl',
      payment_method_types: ['pix'],
      metadata: {
        service: 'CheckLance Analysis'
      }
    });

    res.status(200).json({
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
      next_action: paymentIntent.next_action
    });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).json({ error: `Erro na Stripe: ${error.message}` });
  }
}