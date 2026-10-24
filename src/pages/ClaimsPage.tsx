import { useState, useEffect } from 'react';
import { supabase, type Claim, type InsuranceType, type FraudAnalysis } from '@/lib/supabase';
import { Loader2, ShieldCheck, AlertTriangle, AlertOctagon, Clock, FileSearch, ArrowRight } from 'lucide-react';
import FraudResultPanel from '@/components/FraudResultPanel';
import { analyzeFraud, type FraudResult } from '@/lib/fraudEngine';
import { useCurrency } from '@/lib/currencyContext';
import { formatCurrency } from '@/lib/currency';

type ClaimWithDetails = Claim & {
  insurance_types?: InsuranceType;
  fraud_analyses?: FraudAnalysis[];
};

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { currency } = useCurrency();

  useEffect(() => {
    supabase
      .from('claims')
      .select('*, insurance_types(*), fraud_analyses(*)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (data) setClaims(data as ClaimWithDetails[]);
        if (error) console.error('Failed to load claims:', error.message);
        setLoading(false);
      });
  }, []);

  const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string; border: string }> = {
    pending: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
    reviewing: { icon: AlertTriangle, color: 'text-warning-400', bg: 'bg-warning-500/10', border: 'border-warning-500/20' },
    approved: { icon: ShieldCheck, color: 'text-success-400', bg: 'bg-success-500/10', border: 'border-success-500/20' },
    rejected: { icon: AlertOctagon, color: 'text-error-400', bg: 'bg-error-500/10', border: 'border-error-500/20' },
    flagged: { icon: AlertOctagon, color: 'text-error-400', bg: 'bg-error-500/10', border: 'border-error-500/20' },
  };

  const convertAnalysis = (analysis: FraudAnalysis): FraudResult => ({
    fraudProbability: analysis.fraud_probability,
    fraudLabel: analysis.fraud_label as FraudResult['fraudLabel'],
    xgboostScore: analysis.xgboost_score,
    modelConfidence: analysis.model_confidence,
    shapValues: analysis.shap_values || [],
    limeExplanation: analysis.lime_explanation || [],
    topRiskFactors: analysis.top_risk_factors || [],
    recommendation: analysis.recommendation,
    features: {} as FraudResult['features'],
  });

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="section-label mb-3">Records</div>
          <h1 className="text-3xl font-bold text-white mb-3">Claims History</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            All submitted claims with their AI fraud analysis results. Click a claim to expand the full SHAP + LIME breakdown.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
          </div>
        ) : claims.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <FileSearch className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">No Claims Yet</h3>
            <p className="text-sm text-slate-500">Claims you file will appear here with their AI analysis.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => {
              const status = statusConfig[claim.status] || statusConfig.pending;
              const analysis = claim.fraud_analyses?.[0];
              const isExpanded = expandedId === claim.id;

              return (
                <div key={claim.id} className="glass-card overflow-hidden">
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : claim.id)}
                    className="w-full p-5 text-left flex items-center gap-4"
                  >
                    <div className={`w-10 h-10 rounded-lg ${status.bg} border ${status.border} flex items-center justify-center shrink-0`}>
                      <status.icon className={`w-5 h-5 ${status.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-white">{claim.claim_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.color} border ${status.border}`}>
                          {claim.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{claim.insurance_types?.name || 'Unknown'}</span>
                        <span>·</span>
                        <span>{formatCurrency(claim.claim_amount, currency)}</span>
                        <span>·</span>
                        <span>{claim.claimant_name}</span>
                      </div>
                    </div>
                    {analysis && (
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-bold ${
                          analysis.fraud_label === 'legitimate' ? 'text-success-400' :
                          analysis.fraud_label === 'suspicious' ? 'text-warning-400' :
                          'text-error-400'
                        }`}>
                          {Math.round(analysis.fraud_probability * 100)}%
                        </div>
                        <div className="text-xs text-slate-500">{analysis.fraud_label}</div>
                      </div>
                    )}
                    <ArrowRight className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-white/5 p-5 animate-slide-down">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-sm">
                        <div>
                          <span className="text-slate-500">Incident Date: </span>
                          <span className="text-slate-300">{claim.incident_date || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Location: </span>
                          <span className="text-slate-300">{claim.incident_location || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Email: </span>
                          <span className="text-slate-300">{claim.claimant_email}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Policy: </span>
                          <span className="text-slate-300">{claim.policy_number || 'N/A'}</span>
                        </div>
                      </div>

                      {claim.incident_description && (
                        <div className="mb-5 p-3 rounded-lg bg-white/5">
                          <div className="text-xs text-slate-500 mb-1">Incident Description</div>
                          <p className="text-sm text-slate-300 leading-relaxed">{claim.incident_description}</p>
                        </div>
                      )}

                      {analysis ? (
                        <FraudResultPanel result={convertAnalysis(analysis)} claimNumber={claim.claim_number} />
                      ) : (
                        <div className="p-4 rounded-lg bg-white/5 text-center text-sm text-slate-500">
                          No AI analysis available for this claim.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
