import { Shield, Check, ArrowRight } from 'lucide-react';
import type { InsuranceType } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/lib/currencyContext';
import { formatCurrency } from '@/lib/currency';

type Props = {
  onNavigate: (page: string, params?: Record<string, unknown>) => void;
};

export default function InsurancePage({ onNavigate }: Props) {
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [selected, setSelected] = useState<InsuranceType | null>(null);
  const { currency } = useCurrency();

  useEffect(() => {
    supabase.from('insurance_types').select('*').order('base_premium').then(({ data }) => {
      if (data) setTypes(data as InsuranceType[]);
    });
  }, []);

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="section-label mb-3">Our Products</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Insurance Coverage Catalog</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Browse our full range of insurance products. Every policy includes AI-powered fraud verification at no extra cost.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* List */}
          <div className="space-y-4">
            {types.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full glass-card p-5 text-left transition-all ${
                  selected?.id === t.id ? 'border-primary-500/40 ring-1 ring-primary-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-white">{t.name}</h3>
                    <p className="text-sm text-slate-400 truncate">{t.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-white">{formatCurrency(t.base_premium, currency)}</div>
                    <div className="text-xs text-slate-500">per year</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="glass-card p-8 sticky top-24 h-fit">
            {selected ? (
              <div className="animate-scale-in">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                    <Shield className="w-7 h-7 text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                    <p className="text-sm text-primary-400">{formatCurrency(selected.base_premium, currency)}/yr base premium</p>
                  </div>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed mb-6">{selected.description}</p>

                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-white mb-3">What's Covered</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selected.coverage_details.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                        <Check className="w-4 h-4 text-success-400 shrink-0" />
                        {c}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-accent-500/5 border border-accent-500/15 mb-6">
                  <div className="text-sm font-medium text-accent-300 mb-1">AI Fraud Protection Included</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Every claim under this policy is automatically analyzed by our XGBoost + SHAP + LIME pipeline for instant fraud verification.
                  </p>
                </div>

                <button
                  onClick={() => onNavigate('file-claim', { insuranceTypeId: selected.id })}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  File a Claim
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Shield className="w-12 h-12 text-slate-700 mb-4" />
                <p className="text-slate-500">Select an insurance type to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
