import React, { useState, useRef, useEffect } from 'react';
import { IconUpload, IconWhistle, IconCreditCard, IconLoader, IconShield, IconLock, IconRobotEye, IconTacticBoard, IconCheckCircle, IconFlag, IconHand, IconAlertTriangle, IconFlame, IconHeartPulse } from './components/Icons';
import { analyzeFootballPlay } from './services/geminiService';
import { AnalysisResult, AppStep, InfractionType } from './types';
import { AnalysisCard } from './components/AnalysisCard';
import { CardCheckout } from './components/CardCheckout';

// Stripe Imports
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Initialize Stripe outside component render
// NOTE: You must add VITE_STRIPE_PUBLISHABLE_KEY to your .env file
const stripePromise = loadStripe(process.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder_please_update_env');

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Helper to extract frames from video
const extractFramesFromVideo = async (videoFile: File, numFrames: number = 8): Promise<string[]> => {
  const video = document.createElement('video');
  video.src = URL.createObjectURL(videoFile);
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve(true);
    video.onerror = () => reject("Erro ao carregar vídeo");
  });
  
  const frames: string[] = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("Could not get canvas context");

  // Wait a bit to ensure video is ready
  await new Promise(r => setTimeout(r, 200));

  const duration = video.duration;
  // Limit duration check
  if (duration > 600) { }

  for (let i = 0; i < numFrames; i++) {
    const time = Math.min((duration / numFrames) * i + 0.1, duration);
    video.currentTime = time;
    await new Promise(r => {
        video.onseeked = () => r(true);
    });
    
    const scale = Math.min(1, 640 / video.videoHeight);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    frames.push(dataUrl.split(',')[1]);
  }
  
  URL.revokeObjectURL(video.src);
  video.remove();
  return frames;
};

// Background Illustration Component
const TacticalBackground = () => (
  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-10">
    <svg width="100%" height="100%" className="absolute inset-0">
       <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
    
    {/* Stylized Play - Right Side */}
    <svg className="absolute top-20 right-0 w-96 h-96 text-field transform translate-x-1/3 rotate-12" viewBox="0 0 200 200">
      <circle cx="50" cy="50" r="5" fill="currentColor" />
      <circle cx="80" cy="120" r="5" fill="currentColor" />
      <text x="140" y="80" fill="currentColor" fontSize="20" fontFamily="monospace">X</text>
      <text x="100" y="160" fill="currentColor" fontSize="20" fontFamily="monospace">X</text>
      
      {/* Dashed Movement Lines */}
      <path d="M 50 50 Q 90 20 140 80" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" fill="none" markerEnd="url(#arrow)" />
      <path d="M 80 120 Q 120 140 100 160" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" fill="none" markerEnd="url(#arrow)" />
      
      {/* Pass */}
      <path d="M 50 50 L 80 120" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" fill="none" />
      
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5"
          markerWidth="6" markerHeight="6"
          orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
    </svg>

    {/* Stylized Play - Left Side */}
    <svg className="absolute bottom-0 left-0 w-96 h-96 text-teal-500 transform -translate-x-1/4 -rotate-12 opacity-50" viewBox="0 0 200 200">
       <circle cx="150" cy="150" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
       <path d="M 150 150 L 100 100" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" fill="none" />
       <rect x="90" y="90" width="10" height="10" stroke="currentColor" fill="none" transform="rotate(45 95 95)" />
    </svg>
  </div>
);

function App() {
  const [step, setStep] = useState<AppStep>(AppStep.LANDING);
  
  // Media State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  
  // Analysis Config State
  const [selectedInfraction, setSelectedInfraction] = useState<InfractionType>('GENERAL');
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStart = () => {
    setStep(AppStep.UPLOAD);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      await processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setError(null);
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setError("O arquivo deve ser menor que 50MB.");
      return;
    }

    const isVid = file.type.startsWith('video/');
    const isImg = file.type.startsWith('image/');

    if (!isVid && !isImg) {
      setError("Formato não suportado. Use JPG, PNG ou MP4.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setIsVideo(isVid);

    if (isVid) {
      setIsExtractingFrames(true);
      try {
        const frames = await extractFramesFromVideo(file);
        setVideoFrames(frames);
        setIsExtractingFrames(false);
      } catch (e) {
        console.error(e);
        setError("Erro ao processar vídeo. Tente um arquivo diferente.");
        setIsExtractingFrames(false);
        setSelectedFile(null);
        setPreviewUrl(null);
      }
    }
  };

  const proceedToPayment = () => {
    if (selectedFile && !isExtractingFrames) {
      setStep(AppStep.PAYMENT);
      setShowPaymentForm(false);
    }
  };

  const handlePaymentApproved = () => {
    startAnalysis();
  };

  const startAnalysis = async () => {
    setStep(AppStep.ANALYZING);
    try {
      let result: AnalysisResult;

      if (selectedFile) {
        if (isVideo) {
          result = await analyzeFootballPlay({ 
            type: 'frames', 
            frames: videoFrames,
            infractionContext: selectedInfraction 
          });
        } else {
          const base64 = await fileToBase64(selectedFile);
          result = await analyzeFootballPlay({ 
            type: 'image', 
            base64,
            infractionContext: selectedInfraction
          });
        }
        setAnalysisResult(result);
        setStep(AppStep.RESULT);
      } else {
        throw new Error("No valid input found");
      }
    } catch (err) {
      console.error(err);
      setError("Falha na análise. Verifique o arquivo e tente novamente.");
      setStep(AppStep.UPLOAD);
    }
  };

  const resetApp = () => {
    setStep(AppStep.LANDING);
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setVideoFrames([]);
    setIsVideo(false);
    setSelectedInfraction('GENERAL');
    setError(null);
    setShowPaymentForm(false);
  };

  const infractionOptions: { id: InfractionType; label: string; icon: React.ReactNode }[] = [
    { id: 'GENERAL', label: 'Análise Geral', icon: <IconWhistle className="w-5 h-5" /> },
    { id: 'OFFSIDE', label: 'Impedimento', icon: <IconFlag className="w-5 h-5" /> },
    { id: 'PENALTY', label: 'Pênalti', icon: <IconTacticBoard className="w-5 h-5" /> },
    { id: 'HANDBALL', label: 'Mão na Bola', icon: <IconHand className="w-5 h-5" /> },
    { id: 'RED_CARD', label: 'Expulsão', icon: <IconAlertTriangle className="w-5 h-5" /> },
    { id: 'GOAL_CHECK', label: 'Foi Gol?', icon: <IconCheckCircle className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-field-dark/20 text-slate-50 font-sans selection:bg-field selection:text-white pb-20 relative overflow-hidden">
      
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-white/5 backdrop-blur-md sticky top-0 z-50 relative">
        <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}>
          <div className="bg-field p-1.5 rounded text-slate-950">
             <IconWhistle className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">Check<span className="text-field">Lance</span></span>
        </div>
        <nav>
          <button className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
            Ajuda
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 mt-12 flex flex-col items-center justify-center min-h-[70vh] relative z-10">
        
        {/* Landing Step */}
        {step === AppStep.LANDING && (
          <div className="w-full max-w-5xl">
            {/* Hero Section */}
            <TacticalBackground />
            
            <div className="text-center max-w-2xl mx-auto space-y-8 animate-fade-in-up relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-field/10 border border-field/20 text-field text-xs font-semibold uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-field animate-pulse"></span>
                IA Generativa de Futebol
              </div>
              
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight text-white mt-8">
                Tire a teima.<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-field to-teal-400">
                  Arbitragem com IA.
                </span>
              </h1>
              <p className="text-xl text-slate-400 leading-relaxed max-w-lg mx-auto">
                Envie o vídeo do lance polêmico e receba um veredito técnico baseado nas regras oficiais da IFAB.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 pb-16">
                <button 
                  onClick={handleStart}
                  className="px-8 py-4 bg-field hover:bg-field-light text-slate-950 font-bold rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg shadow-field/20 flex items-center justify-center gap-2"
                >
                  <IconWhistle className="w-5 h-5" />
                  Analisar Jogada
                </button>
                <div className="px-8 py-4 glass-panel rounded-xl text-slate-300 font-medium border border-white/10 flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  R$ 20,00 / análise
                </div>
              </div>
            </div>

            {/* How it Works Section */}
            <div className="mt-12 pt-12 border-t border-white/5 relative z-10">
              <h3 className="text-center text-2xl font-bold text-white mb-12">Como Funciona o VAR Digital</h3>
              
              <div className="grid md:grid-cols-3 gap-8">
                {/* Step 1 */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 relative group hover:border-field/30 transition-colors">
                  <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-field group-hover:scale-110 transition-transform">
                    <IconUpload className="w-7 h-7" />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">1. Envie o Lance</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Faça o upload do vídeo ou foto do momento polêmico. Aceitamos lances de qualquer ângulo.
                  </p>
                  <div className="absolute top-6 right-6 text-slate-700 font-extrabold text-4xl opacity-20">01</div>
                </div>

                {/* Step 2 */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 relative group hover:border-field/30 transition-colors">
                  <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-teal-400 group-hover:scale-110 transition-transform">
                    <IconRobotEye className="w-7 h-7" />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">2. Análise Visual</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Nossa IA analisa quadro a quadro, verificando impedimentos, toques de mão e intensidade de faltas.
                  </p>
                  <div className="absolute top-6 right-6 text-slate-700 font-extrabold text-4xl opacity-20">02</div>
                </div>

                {/* Step 3 */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 relative group hover:border-field/30 transition-colors">
                  <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-green-400 group-hover:scale-110 transition-transform">
                    <IconTacticBoard className="w-7 h-7" />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">3. Veredito Técnico</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Receba o resultado final com citação da regra da FIFA/IFAB e explicação detalhada do lance.
                  </p>
                  <div className="absolute top-6 right-6 text-slate-700 font-extrabold text-4xl opacity-20">03</div>
                </div>
              </div>
            </div>

             {/* Emotional Appeal Section */}
             <div className="mt-16 relative z-10">
                <div className="rounded-3xl bg-gradient-to-r from-red-900/40 to-slate-900/80 border border-white/10 p-8 md:p-12 flex flex-col md:flex-row items-center gap-12 overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                    
                    <div className="flex-1 space-y-6">
                        <div className="inline-flex items-center gap-2 text-red-400 font-semibold uppercase tracking-wider text-sm">
                            <IconFlame className="w-4 h-4 animate-pulse" />
                            A Polêmica Acaba Aqui
                        </div>
                        <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight">
                            Quantas vezes o grupo da família virou campo de guerra?
                        </h2>
                        <p className="text-lg text-slate-300 leading-relaxed">
                           Aquele pênalti mandraque aos 45 do segundo tempo... Foi roubo ou choro? 
                           Seu coração diz uma coisa, o narrador diz outra. A dúvida corrói, a discussão no bar esquenta e a amizade balança.
                           <br/><br/>
                           <span className="text-white font-semibold">Não deixe o 'clubismo' cegar a verdade.</span> O CheckLance é o juiz imparcial que falta na sua resenha.
                        </p>
                        <button 
                            onClick={handleStart}
                            className="mt-4 px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-all transform hover:translate-y-[-2px] shadow-lg shadow-red-900/30 flex items-center gap-2"
                        >
                            <IconHeartPulse className="w-5 h-5" />
                            Resolver a Discussão
                        </button>
                    </div>

                    <div className="flex-1 relative">
                        {/* Simulation of a chat/message interface */}
                        <div className="glass-panel p-6 rounded-2xl border-white/10 transform rotate-2 max-w-sm mx-auto opacity-90 hover:opacity-100 transition-opacity">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">R</div>
                                    <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none text-sm text-slate-300">
                                        Isso foi roubado demais! O cara se jogou! 🤡
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 flex-row-reverse">
                                    <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold">V</div>
                                    <div className="bg-field/20 p-3 rounded-2xl rounded-tr-none text-sm text-white">
                                        Pera aí... passei no CheckLance.
                                    </div>
                                </div>
                                <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 text-xs font-mono text-field">
                                    <div className="flex items-center gap-2 mb-1">
                                        <IconCheckCircle className="w-3 h-3" />
                                        <span>ANÁLISE CONFIRMADA</span>
                                    </div>
                                    Verdito: SIMULAÇÃO. Contato insuficiente para penalidade.
                                </div>
                                 <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">R</div>
                                    <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none text-sm text-slate-300">
                                        🤐 ...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
             </div>

          </div>
        )}

        {/* Upload/Input Step */}
        {step === AppStep.UPLOAD && (
          <div className="w-full max-w-xl space-y-6 animate-fade-in-up relative z-10">
             <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Envie o Lance</h2>
              <p className="text-slate-400">Faça o upload do vídeo ou foto para análise visual.</p>
            </div>

            {/* Input Area */}
            <div 
              className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer relative overflow-hidden group
                ${selectedFile ? 'border-field bg-field/5' : 'border-slate-700 hover:border-field/50 hover:bg-slate-800/50'}
              `}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => !isExtractingFrames && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="image/*,video/*" 
                className="hidden" 
              />
              
              {previewUrl ? (
                <div className="relative">
                    {isVideo ? (
                      <video src={previewUrl} className="max-h-64 mx-auto rounded-lg shadow-2xl" muted />
                    ) : (
                      <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow-2xl" />
                    )}
                  
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                    <p className="text-white font-medium">Clique para trocar</p>
                  </div>

                  {isExtractingFrames && (
                    <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-10 rounded-lg">
                      <IconLoader className="w-10 h-10 text-field animate-spin mb-4" />
                      <p className="text-white font-medium">Extraindo Frames...</p>
                      <p className="text-xs text-slate-400 mt-2">A IA analisará quadro a quadro</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400 group-hover:text-field transition-colors">
                    <IconUpload className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-white">Upload de Foto ou Vídeo</p>
                    <p className="text-sm text-slate-500 mt-2">MP4, JPG ou PNG (Máx 50MB)</p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <span className="text-xs font-semibold bg-field/10 text-field px-2 py-1 rounded">Alta Precisão</span>
                      <span className="text-xs text-slate-500">IA Vision</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-center text-sm font-medium animate-pulse">
                {error}
              </div>
            )}

            {/* Infraction Selection Grid - Only Show if File is Selected */}
            {(selectedFile && !isExtractingFrames) && (
              <div className="space-y-4 animate-fade-in-up">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-field">
                      <IconTacticBoard className="w-5 h-5" />
                   </div>
                   <h3 className="font-semibold text-white">O que devemos checar?</h3>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {infractionOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedInfraction(option.id)}
                      className={`
                        p-3 rounded-xl border flex flex-col items-center gap-2 transition-all
                        ${selectedInfraction === option.id 
                          ? 'bg-field text-slate-950 border-field shadow-lg shadow-field/20' 
                          : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }
                      `}
                    >
                      {option.icon}
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

             {/* Privacy Note */}
             <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-500 opacity-75">
                <IconShield className="w-3 h-3 text-field" />
                <IconLock className="w-3 h-3 text-field" />
                <span>Seus dados são processados em memória e não são salvos.</span>
             </div>

            {/* Action Button */}
            {(selectedFile && !isExtractingFrames) && (
              <button 
                onClick={proceedToPayment}
                className="w-full py-4 bg-field hover:bg-field-light text-slate-950 font-bold rounded-xl text-lg transition-all shadow-lg mt-4"
              >
                Continuar para Pagamento (R$ 20,00)
              </button>
            )}

             <button onClick={resetApp} className="w-full text-slate-500 hover:text-white text-sm">Cancelar</button>
          </div>
        )}

        {/* Payment Step */}
        {step === AppStep.PAYMENT && (
          <div className="w-full max-w-md animate-fade-in-up relative z-10">
            <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-field to-transparent"></div>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-field/10 rounded-full flex items-center justify-center mx-auto mb-4 text-field">
                  <IconCreditCard className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white">Checkout Seguro</h2>
                <p className="text-slate-400 text-sm mt-1">Sua análise está a um passo de distância.</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center p-4 bg-slate-900/50 rounded-lg border border-white/5">
                  <span className="text-slate-300">Análise Premium CheckLance</span>
                  <span className="font-mono font-bold text-white">R$ 20,00</span>
                </div>
                <div className="flex justify-between items-center px-4 text-sm text-slate-500">
                  <span>Tipo de Análise</span>
                  <span className="font-medium text-white">
                      {infractionOptions.find(o => o.id === selectedInfraction)?.label}
                  </span>
                </div>
                <div className="border-t border-white/10 my-4"></div>
                <div className="flex justify-between items-center px-4 text-lg font-bold text-white">
                  <span>Total</span>
                  <span>R$ 20,00</span>
                </div>
              </div>

              {!showPaymentForm ? (
                <>
                  <button 
                    onClick={() => setShowPaymentForm(true)}
                    className="w-full py-4 bg-field hover:bg-field-light text-slate-950 font-bold rounded-xl text-lg transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                     Pagar com Cartão
                  </button>
                  <button onClick={() => setStep(AppStep.UPLOAD)} className="w-full mt-4 text-slate-500 hover:text-white text-sm">Voltar</button>
                </>
              ) : (
                <Elements stripe={stripePromise} options={{ appearance: { theme: 'night' } }}>
                   <CardCheckout 
                      onPaymentApproved={handlePaymentApproved} 
                      onCancel={() => setShowPaymentForm(false)}
                  />
                </Elements>
              )}
            </div>
            
             {!process.env.VITE_STRIPE_PUBLISHABLE_KEY && showPaymentForm && (
                <p className="text-center text-xs text-red-500 mt-6 bg-red-900/20 p-2 rounded">
                   ⚠️ Configure VITE_STRIPE_PUBLISHABLE_KEY no arquivo .env
                </p>
             )}
            
            <p className="text-center text-xs text-slate-600 mt-6">
              Pagamento processado via ambiente seguro Stripe.<br/>
              Garantia de satisfação ou nova análise grátis.
            </p>
          </div>
        )}

        {/* Analyzing Step */}
        {step === AppStep.ANALYZING && (
          <div className="text-center space-y-8 animate-pulse relative z-10">
            <div className="relative w-32 h-32 mx-auto">
               <div className="absolute inset-0 border-4 border-field/20 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-field rounded-full border-t-transparent animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <IconWhistle className="w-12 h-12 text-field" />
               </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Consultando o VAR...</h2>
              <p className="text-slate-400 mb-2">
                 Verificando: <span className="text-field font-bold">{infractionOptions.find(o => o.id === selectedInfraction)?.label}</span>
              </p>
              <p className="text-slate-500 text-sm">
                {isVideo 
                  ? 'Analisando a sequência de quadros do vídeo...' 
                  : 'Nossa IA está analisando cada detalhe e regra.'}
              </p>
            </div>
          </div>
        )}

        {/* Result Step */}
        {step === AppStep.RESULT && analysisResult && (
          <AnalysisCard result={analysisResult} onReset={resetApp} />
        )}

      </main>

      {/* Footer */}
      <footer className="w-full p-4 border-t border-white/5 bg-slate-950/80 backdrop-blur-md text-center text-xs text-slate-600 relative z-20">
        &copy; CheckLance Micro SaaS. Não afiliado à FIFA. Uso para fins de entretenimento e análise amadora.
      </footer>
    </div>
  );
}

export default App;