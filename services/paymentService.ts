// This service integrates with Vercel Serverless Functions in the /api directory.

// On Vercel, API routes are served from the same domain, so we use a relative path.
// If you are running locally, ensure "vercel dev" is used, or this will 404.
const USE_REAL_BACKEND = true; 
const API_URL = "/api"; 

export interface StripePixDisplayQrCode {
  data: string; // The "copy and paste" code (EMV string)
  image_url_svg: string;
  image_url_png: string;
  expires_at: string;
  hosted_instructions_url: string;
}

export interface StripePaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  next_action?: {
    type: 'pix_display_qr_code';
    pix_display_qr_code: StripePixDisplayQrCode;
  };
}

/**
 * Creates a PaymentIntent calling the Vercel Serverless Function.
 */
export const createStripePaymentIntent = async (amount: number): Promise<StripePaymentIntent> => {
  if (USE_REAL_BACKEND) {
    try {
      // Points to api/create-payment-intent.js
      const response = await fetch(`${API_URL}/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to connect to Vercel API');
      }
      return await response.json();
    } catch (error) {
      console.error("Backend Error:", error);
      // Fallback for demo purposes if backend fails (e.g., missing API keys)
      alert("Erro ao conectar com a Stripe. Verifique as variáveis de ambiente na Vercel (STRIPE_SECRET_KEY).");
      throw error;
    }
  }

  // --- MOCK IMPLEMENTATION REMOVED FOR VERCEL DEPLOYMENT FOCUS ---
  throw new Error("Mock disabled. Please configure Vercel Environment Variables.");
};

/**
 * Checks Payment Status calling the Vercel Serverless Function.
 */
export const checkStripePaymentStatus = async (paymentIntentId: string): Promise<StripePaymentIntent['status']> => {
  if (USE_REAL_BACKEND) {
    try {
        // Points to api/check-status.js
        const response = await fetch(`${API_URL}/check-status?id=${paymentIntentId}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.status;
    } catch (error) {
        console.error("Error checking status:", error);
        return 'requires_action';
    }
  }
  return 'requires_action';
};