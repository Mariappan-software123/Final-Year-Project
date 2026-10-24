import { ShieldCheck, AlertTriangle, AlertOctagon, Brain, TrendingUp, TrendingDown, Activity, FileText } from 'lucide-react';
import type { FraudResult } from '@/lib/fraudEngine';
import { useCurrency } from '@/lib/currencyContext';
import { formatCurrency } from '@/lib/currency';

type Props = {
  result: FraudResult;
  claimNumber?: string;
};

export default function FraudResultPanel({ result, claimNumber }: Props) {
  const { fraudProbability, fraudLabel, modelConfidence, shapValues, limeExplanation, topRiskFactors, recommendation } = result;
  const { currency } = useCurrency();

  const labelConfig = {
    legitimate: {
      icon: ShieldCheck,
      color: 'success',
      bg: 'bg-success-500/10',
      border: 'border-success-500/20',
      text: 'text-success-400',
      label: 'Legitimate Claim',
    },
    suspicious: {
      icon: AlertTriangle,
      color: 'warning',
      bg: 'bg-warning-500/10',
      border: 'border-warning-500/20',
      text: 'text-warning-400',
      label: 'Suspicious — Needs Review',
    },
    fraudulent: {
      icon: AlertOctagon,
      color: 'error',
      bg: 'bg-error-500/10',
      border: 'border-error-500/20',
      text: 'text-error-400',
      label: 'Fraudulent — Flagged',
    },
  }[fraudLabel];

  const probPercent = Math.round(fraudProbability * 100);
  const confPercent = Math.round(modelConfidence * 100);

  // SHAP bar scaling
  const maxShap = Math.max(...shapValues.map((s) => Math.abs(s.contribution)), 0.01);

  return (
    <div className="space-y-5">
      {/* Header card with verdict */}
      <div className={`glass-card p-6 ${labelConfig.border}`}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${labelConfig.bg} border ${labelConfig.border} flex items-center justify-center`}>
              <labelConfig.icon className={`w-6 h-6 ${labelConfig.text}`} />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5">AI Verdict {claimNumber ? `for ${claimNumber}` : ''}</div>
              <h2 className={`text-xl font-bold ${labelConfig.text}`}>{labelConfig.label}</h2>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full ${labelConfig.bg} border ${labelConfig.border}`}>
            <span className={`text-sm font-bold ${labelConfig.text}`}>{probPercent}% fraud risk</span>
          </div>
        </div>

        {/* Probability bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Fraud Probability</span>
            <span>{probPercent}%</span>
          </div>
          <div className="h-3 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${probPercent}%`,
                background: fraudLabel === 'legitimate'
                  ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                  : fraudLabel === 'suspicious'
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : 'linear-gradient(90deg, #ef4444, #f87171)',
              }}
            />
          </div>
        </div>

        {/* Confidence */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-accent-400" />
              <span className="text-xs text-slate-400">Model Confidence</span>
            </div>
            <div className="text-lg font-bold text-white">{confPercent}%</div>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-3.5 h-3.5 text-primary-400" />
              <span className="text-xs text-slate-400">XGBoost Score</span>
            </div>
            <div className="text-lg font-bold text-white">{result.xgboostScore.toFixed(3)}</div>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary-400" />
          <h3 className="text-sm font-semibold text-white">Recommendation</h3>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{recommendation}</p>
      </div>

      {/* Risk factors */}
      {topRiskFactors.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-warning-400" />
            <h3 className="text-sm font-semibold text-white">Top Risk Factors ({topRiskFactors.length})</h3>
          </div>
          <div className="space-y-2">
            {topRiskFactors.map((factor, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="w-5 h-5 rounded-full bg-warning-500/10 border border-warning-500/20 flex items-center justify-center text-[10px] font-bold text-warning-400 shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {factor}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SHAP Values */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-400" />
            <h3 className="text-sm font-semibold text-white">SHAP Feature Contributions</h3>
          </div>
          <span className="text-xs text-slate-500">Explainable AI</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Each bar shows how much a feature pushes the prediction toward fraud (red) or legitimate (green).
        </p>
        <div className="space-y-2.5">
          {shapValues.map((shap, i) => {
            const isPositive = shap.contribution >= 0;
            const widthPercent = (Math.abs(shap.contribution) / maxShap) * 50;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 text-xs text-slate-400 text-right shrink-0 truncate">{shap.feature}</div>
                <div className="flex-1 flex items-center h-6 relative">
                  {/* center line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                  {/* bar */}
                  <div className="flex w-full h-full items-center">
                    {isPositive ? (
                      <div className="ml-auto mr-0" style={{ width: `${widthPercent}%` }}>
                        <div className="h-4 rounded-l bg-gradient-to-r from-error-500/40 to-error-500/80 transition-all duration-700 ease-out" style={{ width: '100%' }} />
                      </div>
                    ) : (
                      <div className="mr-auto ml-0" style={{ width: `${widthPercent}%` }}>
                        <div className="h-4 rounded-r bg-gradient-to-l from-success-500/40 to-success-500/80 transition-all duration-700 ease-out" style={{ width: '100%' }} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-20 text-xs font-mono text-right shrink-0">
                  <span className={isPositive ? 'text-error-400' : 'text-success-400'}>
                    {isPositive ? '+' : ''}{shap.contribution.toFixed(3)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-error-500/60" />
              <span className="text-slate-500">→ Fraud</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-success-500/60" />
              <span className="text-slate-500">→ Legitimate</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            base = 0.5 → final = {fraudProbability.toFixed(3)}
          </div>
        </div>
      </div>

      {/* LIME Explanation */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary-400" />
            <h3 className="text-sm font-semibold text-white">LIME Local Explanation</h3>
          </div>
          <span className="text-xs text-slate-500">Decision Rules</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          LIME explains the prediction using locally weighted decision rules around this specific claim.
        </p>
        <div className="space-y-2">
          {limeExplanation.map((lime, i) => {
            const isPositive = lime.weight > 0;
            return (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5">
                <div className={`shrink-0 ${isPositive ? 'text-error-400' : 'text-success-400'}`}>
                  {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300">{lime.condition}</p>
                </div>
                <div className="shrink-0 text-xs font-mono">
                  <span className={isPositive ? 'text-error-400' : 'text-success-400'}>
                    {isPositive ? '+' : ''}{lime.weight.toFixed(3)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
