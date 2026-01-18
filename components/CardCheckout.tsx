import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { IconLoader, IconCheckCircle, IconLock, IconCreditCard } from './Icons';
import { createStripePaymentIntent } from '../services/paymentService';

interface Props {
  onPaymentApproved: () => void;
  onCancel: () => void;
}

export const CardCheckout: React.FC<Props> = ({ onPaymentApproved, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not loaded yet.
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create Payment Intent on Backend
      const { client_secret } = await createStripePaymentIntent(10.00);

      // 2. Confirm Card Payment on Frontend
      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: 'CheckLance User', // In a real app, ask for name
          },
        },
      });

      if (result.error) {
        setError(result.error.message || 'Falha no pagamento');
        setLoading(false);
      } else {
        if (result.paymentIntent?.status === 'succeeded') {
          onPaymentApproved();
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao processar.');
      setLoading(false);
    }
  };

  const cardStyle = {
    hidePostalCode: true, // Remove o campo de CEP/Postal Code
    style: {
      base: {
        color: "#ffffff",
        fontFamily: '"Inter", sans-serif',
        fontSmoothing: "antialiased",
        fontSize: "16px",
        "::placeholder": {
          color: "#94a3b8"
        }
      },
      invalid: {
        color: "#f87171",
        iconColor: "#f87171"
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in-up">
      <div className="text-center mb-6">
        <p className="text-sm text-slate-400">Insira os dados do seu cartão</p>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 transition-colors focus-within:border-field/50 focus-within:ring-1 focus-within:ring-field/50">
        <CardElement options={cardStyle} />
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-2">
        <IconLock className="w-3 h-3" />
        <span>Pagamento processado de forma segura pela Stripe</span>
      </div>

      <button 
        type="submit" 
        disabled={!stripe || loading}
        className="w-full py-4 bg-field hover:bg-field-light text-slate-950 font-bold rounded-xl text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <IconLoader className="w-5 h-5 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <IconCreditCard className="w-5 h-5" />
            Pagar R$ 10,00
          </>
        )}
      </button>

      <button 
        type="button" 
        onClick={onCancel} 
        disabled={loading}
        className="w-full text-slate-500 hover:text-white text-sm hover:underline"
      >
        Cancelar
      </button>
    </form>
  );
};