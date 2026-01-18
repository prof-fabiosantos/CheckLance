import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, InfractionType } from "../types";

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    verdict: {
      type: Type.STRING,
      enum: ['VALID', 'FOUL', 'OFFSIDE', 'REVIEW_NEEDED', 'PENALTY', 'RED_CARD', 'YELLOW_CARD', 'NO_INFRACTION'],
      description: "The final decision on the play."
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence score between 0 and 100."
    },
    explanation: {
      type: Type.STRING,
      description: "A detailed explanation of why this verdict was reached in Portuguese."
    },
    rule_citation: {
      type: Type.STRING,
      description: "Citation of the specific IFAB Law of the Game (e.g., Law 12 - Fouls and Misconduct)."
    },
    key_factors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of visual key factors observed (e.g., 'Player A pulled shirt', 'Contact was below the knee')."
    }
  },
  required: ["verdict", "confidence", "explanation", "rule_citation", "key_factors"],
};

export type AnalysisInput = 
  | { type: 'image'; base64: string; infractionContext: InfractionType }
  | { type: 'frames'; frames: string[]; infractionContext: InfractionType };

export const analyzeFootballPlay = async (input: AnalysisInput): Promise<AnalysisResult> => {
  try {
    let response;

    // Alterado de 'gemini-3-pro-preview' para 'gemini-2.5-flash'.
    // O modelo Flash é muito mais rápido, tem menor custo e limites de cota muito mais generosos,
    // sendo ideal para análise de frames de vídeo e imagens em aplicações de alto volume.
    const modelName = 'gemini-2.5-flash';

    if (input.type === 'image') {
      response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: input.base64 } },
            { text: getSystemPrompt('image', input.infractionContext) },
          ],
        },
        config: getModelConfig(),
      });
    } else if (input.type === 'frames') {
      // Analyze a sequence of frames (video breakdown)
      const parts = input.frames.map(frame => ({
        inlineData: { mimeType: 'image/jpeg', data: frame }
      }));
      
      parts.push({ 
        text: getSystemPrompt('video_frames', input.infractionContext) 
      } as any);

      response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: getModelConfig(),
      });
    } else {
        throw new Error("Invalid input type");
    }

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Error analyzing play:", error);
    throw error;
  }
};

function getSystemPrompt(type: 'image' | 'video_frames', context: InfractionType) {
  let specificInstruction = "";

  switch (context) {
    case 'OFFSIDE':
      specificInstruction = "FOCO TOTAL NO IMPEDIMENTO (OFFSIDE). Analise a posição do atacante em relação ao penúltimo defensor e a bola no exato momento do passe. Identifique linhas virtuais.";
      break;
    case 'PENALTY':
      specificInstruction = "FOCO TOTAL EM PÊNALTI. Verifique se o contato ocorreu DENTRO da área. Analise se houve contato físico imprudente, bloqueio ou toque de mão.";
      break;
    case 'HANDBALL':
      specificInstruction = "FOCO TOTAL EM TOQUE DE MÃO (HANDBALL). Analise a posição natural/antinatural do braço/mão e se houve intenção ou ampliação do volume corporal.";
      break;
    case 'RED_CARD':
      specificInstruction = "FOCO TOTAL EM CARTÃO VERMELHO. Analise força excessiva, brutalidade, pitões na canela ou agressão. Verifique se houve chance clara de gol impedida.";
      break;
    case 'GOAL_CHECK':
      specificInstruction = "FOCO TOTAL SE A BOLA ENTROU (GOAL CHECK). Verifique se a circunferência da bola cruzou totalmente a linha do gol.";
      break;
    default:
      specificInstruction = "Faça uma análise geral. Busque por qualquer infração óbvia seguindo as regras da IFAB.";
      break;
  }

  const base = `Você é um árbitro assistente de vídeo (VAR) sênior.
  ${specificInstruction}
  Analise o conteúdo visual fornecido com extrema precisão técnica seguindo as regras da IFAB.`;

  if (type === 'video_frames') {
    return `${base}
    Estas são imagens sequenciais (frames) extraídas de um vídeo do lance.
    Analise a dinâmica do movimento, contato físico, intensidade e intenção através da sequência.
    Responda APENAS o JSON solicitado.`;
  }

  return `${base}
  Analise esta imagem estática do lance.
  Responda APENAS o JSON solicitado.`;
}

function getModelConfig() {
  return {
    responseMimeType: "application/json",
    responseSchema: analysisSchema,
    temperature: 0.1, // Lower temperature for higher consistency and precision
  };
}