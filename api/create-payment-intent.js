const Stripe = require('stripe');

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount } = req.body;

    // Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents (R$ 10.00 -> 1000)
      currency: 'brl',
      payment_method_types: ['pix'],
      // Optional: Add metadata to track the order
      metadata: {
        service: 'CheckLance Analysis'
      }
    });

    // Return the necessary data to the frontend
    res.status(200).json({
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
      next_action: paymentIntent.next_action
    });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).json({ error: error.message });
  }
};