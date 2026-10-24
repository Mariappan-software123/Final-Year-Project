/*
# Insurance Platform with AI Fraud Detection

1. New Tables
- `insurance_types` — catalog of insurance products (auto, home, health, life, travel, business)
  - id (uuid PK), name (text), slug (text unique), description (text), icon (text), base_premium (numeric)
  - coverage_details (jsonb) — list of coverage items
  - created_at (timestamptz)
- `claims` — insurance claims filed by users
  - id (uuid PK), claim_number (text unique), insurance_type_id (uuid FK)
  - claimant_name (text), claimant_email (text)
  - incident_date (date), incident_location (text), incident_description (text)
  - claim_amount (numeric), policy_number (text)
  - status (text) — 'pending' | 'reviewing' | 'approved' | 'rejected' | 'flagged'
  - uploaded_data (jsonb) — raw structured data from form or upload
  - created_at (timestamptz)
- `fraud_analyses` — AI fraud detection results for each claim
  - id (uuid PK), claim_id (uuid FK)
  - fraud_probability (numeric) — 0 to 1
  - fraud_label (text) — 'legitimate' | 'suspicious' | 'fraudulent'
  - xgboost_score (numeric) — raw model score
  - model_confidence (numeric) — 0 to 1
  - shap_values (jsonb) — feature contributions [{feature, value, contribution}]
  - lime_explanation (jsonb) — local explanation [{feature, weight, condition}]
  - top_risk_factors (jsonb) — array of risk factor strings
  - recommendation (text) — human-readable recommendation
  - created_at (timestamptz)
- `dataset_records` — bulk uploaded records for batch analysis
  - id (uuid PK), filename (text), record_count (int)
  - status (text) — 'processing' | 'completed' | 'failed'
  - summary (jsonb) — aggregate fraud stats
  - created_at (timestamptz)

2. Security
- Enable RLS on all tables.
- Grant CRUD to anon + authenticated (single-tenant demo, no sign-in).
- Allow all CRUD with USING(true) since data is intentionally public/shared.

3. Important Notes
- This is a single-tenant demo platform (no auth) — anon key client must read/write.
- fraud_analyses is linked to claims via FK with CASCADE delete.
*/

-- Insurance Types catalog
CREATE TABLE IF NOT EXISTS insurance_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  base_premium numeric NOT NULL DEFAULT 0,
  coverage_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE insurance_types ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON insurance_types TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_insurance_types" ON insurance_types;
CREATE POLICY "anon_select_insurance_types" ON insurance_types FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_insurance_types" ON insurance_types;
CREATE POLICY "anon_insert_insurance_types" ON insurance_types FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_insurance_types" ON insurance_types;
CREATE POLICY "anon_update_insurance_types" ON insurance_types FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_insurance_types" ON insurance_types;
CREATE POLICY "anon_delete_insurance_types" ON insurance_types FOR DELETE
  TO anon, authenticated USING (true);

-- Claims table
CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number text UNIQUE NOT NULL,
  insurance_type_id uuid REFERENCES insurance_types(id) ON DELETE SET NULL,
  claimant_name text NOT NULL,
  claimant_email text NOT NULL,
  incident_date date,
  incident_location text,
  incident_description text,
  claim_amount numeric NOT NULL DEFAULT 0,
  policy_number text,
  status text NOT NULL DEFAULT 'pending',
  uploaded_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON claims TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_claims" ON claims;
CREATE POLICY "anon_select_claims" ON claims FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_claims" ON claims;
CREATE POLICY "anon_insert_claims" ON claims FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_claims" ON claims;
CREATE POLICY "anon_update_claims" ON claims FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_claims" ON claims;
CREATE POLICY "anon_delete_claims" ON claims FOR DELETE
  TO anon, authenticated USING (true);

-- Fraud analyses table
CREATE TABLE IF NOT EXISTS fraud_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  fraud_probability numeric NOT NULL DEFAULT 0,
  fraud_label text NOT NULL DEFAULT 'legitimate',
  xgboost_score numeric NOT NULL DEFAULT 0,
  model_confidence numeric NOT NULL DEFAULT 0,
  shap_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  lime_explanation jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_risk_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fraud_analyses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON fraud_analyses TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_fraud_analyses" ON fraud_analyses;
CREATE POLICY "anon_select_fraud_analyses" ON fraud_analyses FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_fraud_analyses" ON fraud_analyses;
CREATE POLICY "anon_insert_fraud_analyses" ON fraud_analyses FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_fraud_analyses" ON fraud_analyses;
CREATE POLICY "anon_update_fraud_analyses" ON fraud_analyses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_fraud_analyses" ON fraud_analyses;
CREATE POLICY "anon_delete_fraud_analyses" ON fraud_analyses FOR DELETE
  TO anon, authenticated USING (true);

-- Dataset records (batch upload)
CREATE TABLE IF NOT EXISTS dataset_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  record_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dataset_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON dataset_records TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_dataset_records" ON dataset_records;
CREATE POLICY "anon_select_dataset_records" ON dataset_records FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_dataset_records" ON dataset_records;
CREATE POLICY "anon_insert_dataset_records" ON dataset_records FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_dataset_records" ON dataset_records;
CREATE POLICY "anon_update_dataset_records" ON dataset_records FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_dataset_records" ON dataset_records;
CREATE POLICY "anon_delete_dataset_records" ON dataset_records FOR DELETE
  TO anon, authenticated USING (true);

-- Seed insurance types
INSERT INTO insurance_types (name, slug, description, icon, base_premium, coverage_details)
VALUES
  ('Auto Insurance', 'auto', 'Comprehensive vehicle protection covering accidents, theft, and third-party liability.', 'car', 1200.00,
    '["Collision coverage","Theft & vandalism","Third-party liability","Medical payments","Uninsured motorist","Roadside assistance"]'::jsonb),
  ('Home Insurance', 'home', 'Protect your home and belongings against fire, theft, natural disasters, and liability.', 'home', 850.00,
    '["Fire & smoke damage","Theft & burglary","Natural disaster","Personal liability","Water damage","Temporary living costs"]'::jsonb),
  ('Health Insurance', 'health', 'Comprehensive health coverage with cashless hospitalization and preventive care.', 'heart-pulse', 2400.00,
    '["Hospitalization","Preventive care","Prescription drugs","Mental health","Dental & vision","Maternity care"]'::jsonb),
  ('Life Insurance', 'life', 'Financial security for your loved ones with flexible term and whole life options.', 'shield', 1500.00,
    '["Death benefit","Critical illness rider","Accidental death","Premium waiver","Cash value growth","Estate planning"]'::jsonb),
  ('Travel Insurance', 'travel', 'Worry-free travel with coverage for medical emergencies, trip cancellation, and lost baggage.', 'plane', 300.00,
    '["Trip cancellation","Medical emergencies","Lost baggage","Flight delays","Adventure sports","Emergency evacuation"]'::jsonb),
  ('Business Insurance', 'business', 'Complete protection for your business including property, liability, and cyber coverage.', 'briefcase', 3200.00,
    '["Property damage","General liability","Professional liability","Cyber liability","Business interruption","Workers compensation"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_claims_insurance_type ON claims(insurance_type_id);
CREATE INDEX IF NOT EXISTS idx_fraud_analyses_claim ON fraud_analyses(claim_id);
