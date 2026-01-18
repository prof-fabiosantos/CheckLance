import React from 'react';
import { AnalysisResult } from '../types';
import { IconCheckCircle, IconAlertTriangle, IconWhistle } from './Icons';

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

export const AnalysisCard: React.FC<Props> = ({ result, onReset }) => {
  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'VALID':
      case 'NO_INFRACTION':
        return { color: 'text-green-400', border: 'border-green-500/50', bg: 'bg-green-500/10', icon: <IconCheckCircle className="w-8 h-8 text-green-400" /> };
      case 'FOUL':
      case 'PENALTY':
      case 'RED_CARD':
      case 'OFFSIDE':
        return { color: 'text-red-400', border: 'border-red-500/50', bg: 'bg-red-500/10', icon: <IconAlertTriangle className="w-8 h-8 text-red-400" /> };
      case 'YELLOW_CARD':
        return { color: 'text-yellow-400', border: 'border-yellow-500/50', bg: 'bg-yellow-500/10', icon: <IconWhistle className="w-8 h-8 text-yellow-400" /> };
      default: // REVIEW_NEEDED
        return { color: 'text-blue-400', border: 'border-blue-500/50', bg: 'bg-blue-500/10', icon: <IconWhistle className="w-8 h-8 text-blue-400" /> };
    }
  };

  const style = getVerdictStyle(result.verdict);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in-up">
      <div className={`glass-panel p-8 rounded-2xl border-l-4 ${style.border} shadow-2xl relative overflow-hidden`}>
        {/* Background Accent */}
        <div className={`absolute top-0 right-0 w-64 h-64 ${style.bg} blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none`}></div>

        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className={`p-3 rounded-full ${style.bg} ring-1 ring-white/10`}>
            {style.icon}
          </div>
          <div>
            <h2 className="text-sm text-slate-400 font-semibold uppercase tracking-wider">Veredito da IA</h2>
            <h1 className={`text-3xl font-bold ${style.color}`}>
              {result.verdict.replace('_', ' ')}
            </h1>
          </div>
          <div className="ml-auto flex flex-col items-end">
             <span className="text-xs text-slate-400 uppercase">Confiança</span>
             <span className="text-xl font-mono font-bold text-white">{result.confidence}%</span>
          </div>
        </div>

        <div className="space-y-6 relative z-10">
          <div>
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <span className="w-1 h-4 bg-field rounded-full"></span>
              Análise Detalhada
            </h3>
            <p className="text-slate-300 leading-relaxed bg-slate-900/50 p-4 rounded-lg border border-white/5">
              {result.explanation}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-panel p-4 rounded-lg border border-white/5">
              <h4 className="text-sm text-slate-400 mb-2 uppercase font-semibold">Regra Aplicada</h4>
              <p className="text-white font-medium">{result.rule_citation}</p>
            </div>
            <div className="glass-panel p-4 rounded-lg border border-white/5">
              <h4 className="text-sm text-slate-400 mb-2 uppercase font-semibold">Fatores Chave</h4>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                {result.key_factors.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button 
          onClick={onReset}
          className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-medium transition-all transform hover:scale-105 border border-white/10"
        >
          Analisar Novo Lance
        </button>
      </div>
    </div>
  );
};
