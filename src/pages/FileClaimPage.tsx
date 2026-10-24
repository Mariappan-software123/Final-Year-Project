import { useState, useEffect } from 'react';
import { supabase, type InsuranceType, type Claim } from '@/lib/supabase';
import { analyzeFraud, type FraudResult } from '@/lib/fraudEngine';
import { Loader2, ShieldCheck, AlertTriangle, AlertCircle, Brain, Sparkles, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import FraudResultPanel from '@/components/FraudResultPanel';
import { useCurrency, CURRENCIES } from '@/lib/currencyContext';
import { formatCurrency, convertToBase } from '@/lib/currency';

type Props = {
  onNavigate: (page: string, params?: Record<string, unknown>) => void;
  initialInsuranceTypeId?: string | null;
};

export default function FileClaimPage({ onNavigate, initialInsuranceTypeId }: Props) {
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const { currency, setCurrency } = useCurrency();
  const [form, setForm] = useState({
    insuranceTypeId: initialInsuranceTypeId || '',
    claimantName: '',
    claimantEmail: '',
    incidentDate: '',
    incidentLocation: '',
    incidentDescription: '',
    claimAmount: '',
    policyNumber: '',
    priorClaims: '0',
    policyAgeMonths: '12',
    policyHolderLocation: '',
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FraudResult | null>(null);
  const [savedClaim, setSavedClaim] = useState<Claim | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('insurance_types').select('*').then(({ data }) => {
      if (data) setInsuranceTypes(data as InsuranceType[]);
    });
  }, []);

  useEffect(() => {
    if (initialInsuranceTypeId) {
      setForm((f) => ({ ...f, insuranceTypeId: initialInsuranceTypeId }));
    }
  }, [initialInsuranceTypeId]);

  const selectedType = insuranceTypes.find((t) => t.id === form.insuranceTypeId);

  const handleChange = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setSavedClaim(null);

    if (!form.insuranceTypeId || !form.claimantName || !form.claimantEmail || !form.claimAmount) {
      setError('Please fill in all required fields.');
      return;
    }

    setAnalyzing(true);

    try {
      // Run the XGBoost + SHAP + LIME analysis
      await new Promise((r) => setTimeout(r, 1800));

      const amountBase = convertToBase(parseFloat(form.claimAmount) || 0, currency);

      const fraudResult = analyzeFraud({
        claimAmount: amountBase,
        incidentDescription: form.incidentDescription,
        incidentDate: form.incidentDate || null,
        priorClaims: parseInt(form.priorClaims) || 0,
        policyAgeMonths: parseInt(form.policyAgeMonths) || 12,
        basePremium: selectedType?.base_premium || 1000,
        incidentLocation: form.incidentLocation,
        policyHolderLocation: form.policyHolderLocation || form.incidentLocation,
      });

      const claimNumber = `CLM-${Date.now().toString().slice(-8)}`;
      const status = fraudResult.fraudLabel === 'fraudulent' ? 'flagged' : fraudResult.fraudLabel === 'suspicious' ? 'reviewing' : 'pending';

      // Save claim
      const { data: claimData, error: claimError } = await supabase.from('claims').insert({
        claim_number: claimNumber,
        insurance_type_id: form.insuranceTypeId,
        claimant_name: form.claimantName,
        claimant_email: form.claimantEmail,
        incident_date: form.incidentDate || null,
        incident_location: form.incidentLocation || null,
        incident_description: form.incidentDescription || null,
        claim_amount: amountBase,
        policy_number: form.policyNumber || null,
        status,
        uploaded_data: { priorClaims: form.priorClaims, policyAgeMonths: form.policyAgeMonths, policyHolderLocation: form.policyHolderLocation },
      }).select('*').single();

      if (claimError || !claimData) {
        throw new Error(claimError?.message || 'Could not save the claim.');
      }
      setSavedClaim(claimData as Claim);

      // Save fraud analysis
      const { error: analysisError } = await supabase.from('fraud_analyses').insert({
        claim_id: (claimData as Claim).id,
        fraud_probability: fraudResult.fraudProbability,
        fraud_label: fraudResult.fraudLabel,
        xgboost_score: fraudResult.xgboostScore,
        model_confidence: fraudResult.modelConfidence,
        shap_values: fraudResult.shapValues,
        lime_explanation: fraudResult.limeExplanation,
        top_risk_factors: fraudResult.topRiskFactors,
        recommendation: fraudResult.recommendation,
      });
      if (analysisError) {
        throw new Error(`Claim saved, but the analysis could not be stored: ${analysisError.message}`);
      }

      setResult(fraudResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while filing the claim.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (result && savedClaim) {
    return (
      <div className="min-h-screen pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-6 animate-fade-in">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-success-400" />
              <span className="text-sm font-medium text-success-400">Claim Submitted & Analyzed</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Claim {savedClaim.claim_number}</h1>
            <p className="text-sm text-slate-400 mt-1">AI fraud analysis complete — review results below</p>
          </div>

          <FraudResultPanel result={result} claimNumber={savedClaim.claim_number} />

          <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
            <button onClick={() => { setResult(null); setSavedClaim(null); }} className="btn-secondary">
              File Another Claim
            </button>
            <button onClick={() => onNavigate('claims')} className="btn-primary flex items-center justify-center gap-2">
              View All Claims
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="section-label mb-3">New Claim</div>
          <h1 className="text-3xl font-bold text-white mb-3">File an Insurance Claim</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Fill in the details below. Our AI engine will instantly analyze your claim for fraud indicators using XGBoost, SHAP, and LIME.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error-500/10 border border-error-500/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-error-400 shrink-0" />
            <p className="text-sm text-error-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-card p-6 sm:p-8 space-y-6">
          {/* Insurance Type */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Insurance Type *</label>
            <select
              value={form.insuranceTypeId}
              onChange={(e) => handleChange('insuranceTypeId', e.target.value)}
              className="input-field"
              required
            >
              <option value="">Select insurance type...</option>
              {insuranceTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — from {formatCurrency(t.base_premium, currency)}/yr</option>
              ))}
            </select>
          </div>

          {/* Claimant Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Full Name *</label>
              <input
                type="text"
                value={form.claimantName}
                onChange={(e) => handleChange('claimantName', e.target.value)}
                className="input-field"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Email *</label>
              <input
                type="email"
                value={form.claimantEmail}
                onChange={(e) => handleChange('claimantEmail', e.target.value)}
                className="input-field"
                placeholder="john@example.com"
                required
              />
            </div>
          </div>

          {/* Policy Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Policy Number</label>
              <input
                type="text"
                value={form.policyNumber}
                onChange={(e) => handleChange('policyNumber', e.target.value)}
                className="input-field"
                placeholder="POL-123456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Policy Age (months)</label>
              <input
                type="number"
                value={form.policyAgeMonths}
                onChange={(e) => handleChange('policyAgeMonths', e.target.value)}
                className="input-field"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Prior Claims</label>
              <input
                type="number"
                value={form.priorClaims}
                onChange={(e) => handleChange('priorClaims', e.target.value)}
                className="input-field"
                min="0"
              />
            </div>
          </div>

          {/* Incident Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Incident Date</label>
              <input
                type="date"
                value={form.incidentDate}
                onChange={(e) => handleChange('incidentDate', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Claim Amount *
                <span className="text-xs text-slate-500 font-normal ml-1">(in {currency.name})</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none">
                    {currency.symbol}
                  </span>
                  <input
                    type="number"
                    value={form.claimAmount}
                    onChange={(e) => handleChange('claimAmount', e.target.value)}
                    className="input-field pl-9"
                    placeholder="5,000"
                    min="0"
                    required
                  />
                </div>
                <select
                  value={currency.code}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="input-field w-auto shrink-0"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Select your country's currency, then enter the claim amount. It will be automatically converted for AI analysis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Incident Location</label>
              <input
                type="text"
                value={form.incidentLocation}
                onChange={(e) => handleChange('incidentLocation', e.target.value)}
                className="input-field"
                placeholder="123 Main St, City, State"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Policy Holder Location</label>
              <input
                type="text"
                value={form.policyHolderLocation}
                onChange={(e) => handleChange('policyHolderLocation', e.target.value)}
                className="input-field"
                placeholder="456 Oak Ave, City, State"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Incident Description</label>
            <textarea
              value={form.incidentDescription}
              onChange={(e) => handleChange('incidentDescription', e.target.value)}
              className="input-field min-h-[120px] resize-y"
              placeholder="Describe what happened in detail. Include dates, times, circumstances, and any other relevant information..."
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Detailed descriptions help our AI provide more accurate analysis. Vague or brief descriptions may be flagged.
            </p>
          </div>

          {/* AI notice */}
          <div className="p-4 rounded-xl bg-accent-500/5 border border-accent-500/15 flex items-start gap-3">
            <Brain className="w-5 h-5 text-accent-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-accent-300">AI Analysis Upon Submission</p>
              <p className="text-xs text-slate-400 mt-0.5">
                When you submit, our XGBoost model evaluates 12+ features and generates SHAP + LIME explanations for full transparency.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={analyzing}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Submit & Analyze Claim
              </>
            )}
          </button>
        </form>

        {analyzing && (
          <div className="mt-6 glass-card p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-accent-400 animate-pulse" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">AI Pipeline Running</div>
                <div className="text-xs text-slate-500">Extracting features, running XGBoost ensemble, computing SHAP values...</div>
              </div>
            </div>
            <div className="space-y-2">
              {['Feature extraction from claim data', 'XGBoost gradient-boosted prediction (12 trees)', 'SHAP value decomposition', 'LIME local explanation'].map((step, i) => (
                <div key={step} className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin text-accent-400" style={{ animationDelay: `${i * 200}ms` }} />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
