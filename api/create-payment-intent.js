import Stripe from 'stripe';

export default async function handler(req, res) {
  // Configurar CORS
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
    console.error("ERRO CRÍTICO: STRIPE_SECRET_KEY não encontrada.");
    return res.status(500).json({ 
      error: 'Configuração do Servidor Incompleta: STRIPE_SECRET_KEY não encontrada.' 
    });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { amount } = req.body;

    // Criar PaymentIntent para CARTÃO
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'brl',
      // 'card' geralmente vem habilitado por padrão em contas de teste
      payment_method_types: ['card'], 
      metadata: {
        service: 'CheckLance Analysis'
      }
    });

    res.status(200).json({
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
    });

  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).json({ error: `Erro na Stripe: ${error.message}` });
  }
}