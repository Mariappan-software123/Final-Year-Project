import { useState } from 'react';
import { Brain, Sparkles, ArrowRight } from 'lucide-react';
import FraudResultPanel from '@/components/FraudResultPanel';
import { analyzeFraud, type FraudResult } from '@/lib/fraudEngine';
import { useCurrency } from '@/lib/currencyContext';
import { formatCurrency } from '@/lib/currency';

const sampleClaims = [
  {
    title: 'Low-Risk Auto Claim',
    description: 'Rear-end collision at traffic light',
    claimAmount: 3500,
    incidentDescription: 'I was stopped at a red light at the intersection of Oak Street and Main Avenue when a vehicle failed to brake and struck my rear bumper. The impact caused damage to my rear bumper, trunk, and tail lights. Police report was filed at the scene. The other driver was cited for failure to maintain safe distance. My vehicle was towed to a nearby repair shop for assessment.',
    incidentDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
    priorClaims: 0,
    policyAgeMonths: 24,
    basePremium: 1200,
    incidentLocation: 'Oak St & Main Ave, Springfield',
    policyHolderLocation: 'Springfield',
  },
  {
    title: 'Suspicious Home Claim',
    description: 'Vague theft report with round amount',
    claimAmount: 10000,
    incidentDescription: 'Not sure when it happened. Somewhere the items disappeared. I think they were stolen overnight. Not sure about the details.',
    incidentDate: new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10),
    priorClaims: 4,
    policyAgeMonths: 2,
    basePremium: 850,
    incidentLocation: 'Unknown',
    policyHolderLocation: 'Downtown',
  },
  {
    title: 'High-Risk Health Claim',
    description: 'New policy, high claim, late night',
    claimAmount: 25000,
    incidentDescription: 'Lost. Stolen. Vanished. Don\'t know. Somewhere somehow.',
    incidentDate: new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10),
    priorClaims: 5,
    policyAgeMonths: 1,
    basePremium: 2400,
    incidentLocation: 'Remote',
    policyHolderLocation: 'City Center',
  },
  {
    title: 'Legitimate Travel Claim',
    description: 'Trip cancellation with documentation',
    claimAmount: 1200,
    incidentDescription: 'My flight to London was cancelled by the airline due to a mechanical issue. I had pre-booked a non-refundable hotel and tour package totaling $1,200. I have the airline cancellation notice and receipts for all bookings. I filed this claim within 3 days of the cancellation.',
    incidentDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
    priorClaims: 1,
    policyAgeMonths: 18,
    basePremium: 300,
    incidentLocation: 'Airport Terminal 3',
    policyHolderLocation: 'Airport Terminal 3',
  },
];

export default function AnalyzePage() {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [result, setResult] = useState<FraudResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { currency } = useCurrency();

  const runAnalysis = async (idx: number) => {
    setSelectedIdx(idx);
    setAnalyzing(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 1500));
    setResult(analyzeFraud(sampleClaims[idx]));
    setAnalyzing(false);
  };

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="section-label mb-3">Live Demo</div>
          <h1 className="text-3xl font-bold text-white mb-3">AI Fraud Analysis Explorer</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Explore how the AI engine analyzes different types of claims. Select a sample claim to see the full XGBoost + SHAP + LIME breakdown.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sample claims list */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-white px-1 mb-2">Sample Claims</div>
            {sampleClaims.map((claim, i) => (
              <button
                key={i}
                onClick={() => runAnalysis(i)}
                className={`w-full glass-card p-4 text-left transition-all ${
                  selectedIdx === i ? 'border-primary-500/40 ring-1 ring-primary-500/20' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-bold text-white">{claim.title}</h3>
                </div>
                <p className="text-xs text-slate-400 mb-2">{claim.description}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">{formatCurrency(claim.claimAmount, currency)}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-500">{claim.priorClaims} prior claims</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-500">{claim.policyAgeMonths}mo policy</span>
                </div>
              </button>
            ))}
          </div>

          {/* Result panel */}
          <div className="lg:col-span-2">
            {analyzing && (
              <div className="glass-card p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-accent-400 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Analyzing claim...</h3>
                <p className="text-sm text-slate-500 mb-6">Running XGBoost ensemble, computing SHAP values and LIME explanations</p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Sparkles className="w-3.5 h-3.5 text-accent-400 animate-pulse" />
                  Explainable AI pipeline
                </div>
              </div>
            )}

            {!analyzing && !result && (
              <div className="glass-card p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <ArrowRight className="w-8 h-8 text-slate-600" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Select a Sample Claim</h3>
                <p className="text-sm text-slate-500">
                  Choose a claim from the left to see the full AI analysis with SHAP and LIME visualizations.
                </p>
              </div>
            )}

            {!analyzing && result && (
              <div className="animate-fade-in">
                <FraudResultPanel result={result} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
