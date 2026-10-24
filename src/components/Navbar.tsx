import { Shield, Brain, Menu, X, Globe } from 'lucide-react';
import { useState } from 'react';
import { useCurrency, CURRENCIES } from '@/lib/currencyContext';

type Props = {
  currentPage: string;
  onNavigate: (page: string) => void;
};

export default function Navbar({ currentPage, onNavigate }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const { currency, setCurrency } = useCurrency();

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'insurance', label: 'Insurance' },
    { id: 'file-claim', label: 'File Claim' },
    { id: 'analyze', label: 'AI Analysis' },
    { id: 'upload', label: 'Batch Upload' },
    { id: 'claims', label: 'Claims History' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary-500/30 rounded-lg blur-md group-hover:bg-primary-500/50 transition-all" />
              <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-left">
              <div className="font-bold text-sm leading-tight text-white max-w-[180px] sm:max-w-none">Explainable AI Fraud Detection</div>
              <div className="text-[10px] text-primary-400 font-medium tracking-wide">SHAP · LIME · XGBOOST</div>
            </div>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === item.id
                    ? 'text-white bg-primary-500/15 border border-primary-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2 relative">
            {/* Currency selector */}
            <button
              onClick={() => setCurrencyOpen(!currencyOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-primary-500/30 transition-all"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">{currency.code}</span>
              <span className="text-sm text-slate-400">{currency.symbol}</span>
            </button>

            {currencyOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCurrencyOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto glass rounded-xl border border-white/10 shadow-2xl z-50 animate-slide-down">
                  <div className="px-3 py-2 border-b border-white/5">
                    <span className="text-xs font-semibold text-slate-400">Select Currency</span>
                  </div>
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        setCurrency(c.code);
                        setCurrencyOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5 ${
                        currency.code === c.code ? 'bg-primary-500/10' : ''
                      }`}
                    >
                      <span className="text-base w-7">{c.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{c.code} <span className="text-slate-500 font-normal">{c.symbol}</span></div>
                        <div className="text-xs text-slate-500 truncate">{c.name}</div>
                      </div>
                      {currency.code === c.code && (
                        <span className="w-2 h-2 rounded-full bg-primary-400" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/20">
              <Brain className="w-3.5 h-3.5 text-accent-400" />
              <span className="text-xs font-medium text-accent-300">SHAP + LIME</span>
            </div>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-1">
            {/* Currency selector (mobile) */}
            <div className="px-3 py-2">
              <label className="text-xs text-slate-500 font-medium">Currency</label>
              <select
                value={currency.code}
                onChange={(e) => setCurrency(e.target.value)}
                className="input-field mt-1"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code} — {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                  currentPage === item.id
                    ? 'text-white bg-primary-500/15'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
