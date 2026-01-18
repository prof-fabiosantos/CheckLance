import Stripe from 'stripe';

// Initialize stripe outside handler if key exists
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export default async function handler(req, res) {
  // CORS configuration for GET requests
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing PaymentIntent ID' });
  }

  // LÓGICA DE MOCK: Se o ID começar com 'mock_', aprova automaticamente
  if (id.startsWith('mock_')) {
    return res.status(200).json({ status: 'succeeded' });
  }

  if (!stripe) {
     return res.status(500).json({ error: 'Stripe not configured' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(id);
    res.status(200).json({ status: paymentIntent.status });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).json({ error: error.message });
  }
}