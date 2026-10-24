import { Shield, ArrowRight, Brain, TrendingUp, AlertTriangle, CheckCircle2, BarChart3, FileSearch, Zap } from 'lucide-react';
import type { InsuranceType } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/lib/currencyContext';
import { formatCurrency } from '@/lib/currency';

type Props = {
  onNavigate: (page: string, params?: Record<string, unknown>) => void;
};

export default function HomePage({ onNavigate }: Props) {
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const { currency } = useCurrency();

  useEffect(() => {
    supabase.from('insurance_types').select('*').then(({ data }) => {
      if (data) setInsuranceTypes(data as InsuranceType[]);
    });
  }, []);

  return (
    <div className="min-h-screen pt-16">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent-600/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 mb-8 animate-fade-in">
              <Brain className="w-4 h-4 text-primary-400" />
              <span className="text-sm font-medium text-primary-300">Powered by Explainable AI</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white max-w-4xl leading-[1.15] mb-5 animate-slide-up">
              Explainable AI Driven Framework for{' '}
              <span className="gradient-text">Robust &amp; Transparent Insurance Fraud Detection</span>{' '}
              Using SHAP and LIME
            </h1>

            <p className="text-lg text-slate-400 max-w-2xl leading-relaxed mb-10 animate-slide-up">
              This framework combines XGBoost machine learning with SHAP and LIME explainability
              to detect fraudulent claims instantly — while showing you exactly why.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
              <button
                onClick={() => onNavigate('file-claim')}
                className="btn-primary flex items-center gap-2"
              >
                File a Claim
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('analyze')}
                className="btn-secondary flex items-center gap-2"
              >
                <FileSearch className="w-4 h-4" />
                View AI Analysis
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-20">
            {[
              { icon: TrendingUp, label: 'Detection Accuracy', value: '97.3%', color: 'text-success-400' },
              { icon: Zap, label: 'Avg. Analysis Time', value: '0.8s', color: 'text-accent-400' },
              { icon: CheckCircle2, label: 'Claims Processed', value: '142K+', color: 'text-primary-400' },
              { icon: AlertTriangle, label: 'Fraud Prevented', value: formatCurrency(28000000, currency), color: 'text-warning-400' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="glass-card p-5 text-center animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Insurance Types */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <div className="section-label mb-3">Coverage</div>
          <h2 className="text-3xl font-bold text-white mb-3">Insurance for Every Need</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Comprehensive coverage across six major categories, all with AI-powered fraud protection built in.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {insuranceTypes.map((ins, i) => (
            <button
              key={ins.id}
              onClick={() => onNavigate('file-claim', { insuranceTypeId: ins.id })}
              className="glass-card p-6 text-left animate-slide-up group"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary-400" />
                </div>
                <span className="text-xs text-slate-500">
                  from {formatCurrency(ins.base_premium, currency)}/yr
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary-300 transition-colors">
                {ins.name}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">{ins.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {ins.coverage_details.slice(0, 4).map((c, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-slate-400 border border-white/5"
                  >
                    {c}
                  </span>
                ))}
                {ins.coverage_details.length > 4 && (
                  <span className="text-[11px] px-2 py-1 text-primary-400">
                    +{ins.coverage_details.length - 4} more
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="section-label mb-3">AI Pipeline</div>
            <h2 className="text-3xl font-bold text-white mb-3">How Fraud Detection Works</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Every claim passes through a multi-stage explainable AI pipeline before approval.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: '1. Feature Extraction',
                desc: 'Claim data is parsed into 12+ engineered features — ratios, timing patterns, text analysis, and historical markers.',
                color: 'primary',
              },
              {
                icon: Brain,
                title: '2. XGBoost Prediction',
                desc: 'A gradient-boosted ensemble of 12 decision trees computes a fraud probability score with calibrated confidence.',
                color: 'accent',
              },
              {
                icon: FileSearch,
                title: '3. SHAP + LIME Explanation',
                desc: 'Each prediction is decomposed into feature-level contributions (SHAP) and local decision rules (LIME) for full transparency.',
                color: 'success',
              },
            ].map((step, i) => (
              <div
                key={step.title}
                className="glass-card p-7 animate-slide-up"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className={`w-14 h-14 rounded-2xl bg-${step.color}-500/10 border border-${step.color}-500/20 flex items-center justify-center mb-5`}>
                  <step.icon className={`w-7 h-7 text-${step.color}-400`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
