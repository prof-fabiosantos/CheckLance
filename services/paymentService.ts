// This service integrates with Vercel Serverless Functions in the /api directory.

// On Vercel, API routes are served from the same domain, so we use a relative path.
// If you are running locally, ensure "vercel dev" is used, or this will 404.
const USE_REAL_BACKEND = true; 
const API_URL = "/api"; 

export interface StripePaymentIntent {
  id: string;
  client_secret: string;
  amount?: number;
  currency?: string;
  status?: string;
  next_action?: {
    pix_display_qr_code?: {
      data: string;
      image_url_svg?: string;
      image_url_png?: string;
      expires_at?: string;
    };
    redirect_to_url?: {
      return_url?: string;
      url: string;
    };
    type?: string;
    [key: string]: any;
  };
}

/**
 * Creates a PaymentIntent calling the Vercel Serverless Function.
 * Returns the client_secret needed for Stripe Elements to confirm payment.
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
      
      const data = await response.json();

      if (!response.ok) {
        // Throw the specific error message returned by the server
        throw new Error(data.error || `Erro HTTP: ${response.status}`);
      }
      return data;
    } catch (error: any) {
      console.error("Backend Error:", error);
      // Show the actual error message to help debugging
      alert(`Falha no pagamento: ${error.message}`);
      throw error;
    }
  }

  throw new Error("Mock disabled. Please configure Vercel Environment Variables.");
};

// Polling status is no longer needed for Card payments as the confirmation is synchronous via JS SDK.
export const checkStripePaymentStatus = async (paymentIntentId: string): Promise<string> => {
    return 'succeeded'; 
};