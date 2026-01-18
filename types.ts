export interface AnalysisResult {
  verdict: 'VALID' | 'FOUL' | 'OFFSIDE' | 'REVIEW_NEEDED' | 'PENALTY' | 'RED_CARD' | 'YELLOW_CARD' | 'NO_INFRACTION';
  confidence: number;
  explanation: string;
  rule_citation: string;
  key_factors: string[];
}

export type InfractionType = 'GENERAL' | 'OFFSIDE' | 'PENALTY' | 'HANDBALL' | 'RED_CARD' | 'GOAL_CHECK';

export interface PaymentState {
  isPaid: boolean;
  amount: number;
  transactionId?: string;
}

export enum AppStep {
  LANDING = 'LANDING',
  UPLOAD = 'UPLOAD',
  PAYMENT = 'PAYMENT',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
}