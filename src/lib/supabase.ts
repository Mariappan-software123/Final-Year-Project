import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to the .env file in the project root and restart `npm run dev`.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type InsuranceType = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  base_premium: number;
  coverage_details: string[];
  created_at: string;
};

export type Claim = {
  id: string;
  claim_number: string;
  insurance_type_id: string | null;
  claimant_name: string;
  claimant_email: string;
  incident_date: string | null;
  incident_location: string | null;
  incident_description: string | null;
  claim_amount: number;
  policy_number: string | null;
  status: string;
  uploaded_data: Record<string, unknown>;
  created_at: string;
};

export type ShapValue = {
  feature: string;
  value: number | string;
  contribution: number;
  display: string;
};

export type LimeExplanation = {
  feature: string;
  weight: number;
  condition: string;
};

export type FraudAnalysis = {
  id: string;
  claim_id: string;
  fraud_probability: number;
  fraud_label: string;
  xgboost_score: number;
  model_confidence: number;
  shap_values: ShapValue[];
  lime_explanation: LimeExplanation[];
  top_risk_factors: string[];
  recommendation: string;
  created_at: string;
};

export type DatasetRecord = {
  id: string;
  filename: string;
  record_count: number;
  status: string;
  summary: Record<string, unknown>;
  created_at: string;
};
