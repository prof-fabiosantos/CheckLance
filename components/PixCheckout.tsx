import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { IconCreditCard, IconLoader, IconCopy, IconCheckCircle, IconQrCode } from './Icons';
import { createStripePaymentIntent, checkStripePaymentStatus, StripePaymentIntent } from '../services/paymentService';

interface Props {
  onPaymentApproved: () => void;
  onCancel: () => void;
}

export const PixCheckout: React.FC<Props> = ({ onPaymentApproved, onCancel }) => {
  const [loading, setLoading] = useState(true);
  const [paymentIntent, setPaymentIntent] = useState<StripePaymentIntent | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<StripePaymentIntent['status']>('requires_action');

  // 1. Create Payment Intent
  useEffect(() => {
    const init = async () => {
      try {
        const intent = await createStripePaymentIntent(20.00);
        setPaymentIntent(intent);
        setStatus(intent.status);
        
        if (intent.next_action?.pix_display_qr_code?.data) {
            const url = await QRCode.toDataURL(intent.next_action.pix_display_qr_code.data, {
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
            setQrCodeImage(url);
        }
        
        setLoading(false);
      } catch (e) {
        console.error("Failed to create payment intent", e);
        alert("Erro ao gerar pagamento. Verifique a configuração da Stripe.");
        onCancel();
      }
    };
    init();
  }, []);

  // 2. Poll for Payment Status (Real Polling)
  useEffect(() => {
    if (!paymentIntent || status === 'succeeded') return;

    // Check status every 3 seconds
    const intervalId = setInterval(async () => {
        try {
            const currentStatus = await checkStripePaymentStatus(paymentIntent.id);
            
            if (currentStatus === 'succeeded') {
                setStatus('succeeded');
                clearInterval(intervalId);
                setTimeout(() => {
                    onPaymentApproved();
                }, 1500);
            }
        } catch (error) {
            console.error("Error polling status", error);
        }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [paymentIntent, status, onPaymentApproved]);

  const handleCopy = () => {
    const code = paymentIntent?.next_action?.pix_display_qr_code?.data;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-slate-400 gap-4">
        <IconLoader className="w-8 h-8 animate-spin text-field" />
        <p>Conectando ao gateway de pagamento...</p>
      </div>
    );
  }

  if (status === 'succeeded') {
     return (
        <div className="w-full py-12 flex flex-col items-center justify-center text-center animate-fade-in-up">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                <IconCheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Pagamento Confirmado!</h3>
            <p className="text-slate-400">Liberando acesso ao VAR...</p>
        </div>
     );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="text-center">
         <p className="text-sm text-slate-400 mb-4">Escaneie o QR Code no app do seu banco</p>
         
         <div className="bg-white p-4 rounded-xl inline-block shadow-lg mx-auto relative group">
             {qrCodeImage && <img src={qrCodeImage} alt="QR Code PIX" className="w-48 h-48" />}
             
             {/* Stripe branding overlay simulation */}
             <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-50">
                <span className="text-[10px] text-black font-bold uppercase tracking-widest">Powered by Stripe</span>
             </div>
         </div>
      </div>

      <div className="space-y-2">
         <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Pix Copia e Cola</span>
         </div>
         <div className="flex gap-2">
            <input 
                readOnly 
                value={paymentIntent?.next_action?.pix_display_qr_code?.data || ''} 
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-xs text-slate-400 font-mono truncate focus:outline-none focus:border-field/50 transition-colors"
            />
            <button 
                onClick={handleCopy}
                className={`px-4 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${copied ? 'bg-green-500 text-white' : 'bg-field text-slate-900 hover:bg-field-light'}`}
            >
                {copied ? <IconCheckCircle className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar'}
            </button>
         </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-lg p-4 flex items-center justify-center gap-3">
         <div className="w-2 h-2 rounded-full bg-field animate-pulse"></div>
         <div className="text-left">
             <p className="text-sm font-semibold text-white">Aguardando confirmação do banco...</p>
             <p className="text-xs text-slate-500">
                {/* Dica para teste na Vercel */}
                Em modo de teste, pague via Stripe Dashboard.
             </p>
         </div>
      </div>

      <button onClick={onCancel} className="w-full text-slate-500 hover:text-white text-sm hover:underline">
          Cancelar transação
      </button>
    </div>
  );
};