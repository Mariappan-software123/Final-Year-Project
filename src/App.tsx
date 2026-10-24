import { useState } from 'react';
import { CurrencyProvider } from '@/lib/currencyContext';
import Navbar from '@/components/Navbar';
import HomePage from '@/pages/HomePage';
import InsurancePage from '@/pages/InsurancePage';
import FileClaimPage from '@/pages/FileClaimPage';
import AnalyzePage from '@/pages/AnalyzePage';
import UploadPage from '@/pages/UploadPage';
import ClaimsPage from '@/pages/ClaimsPage';

type Page = 'home' | 'insurance' | 'file-claim' | 'analyze' | 'upload' | 'claims';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [params, setParams] = useState<Record<string, unknown>>({});

  const navigate = (newPage: string, newParams?: Record<string, unknown>) => {
    setPage(newPage as Page);
    setParams(newParams || {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <CurrencyProvider>
      <div className="min-h-screen bg-[#0a0f1e] text-slate-200">
        <Navbar currentPage={page} onNavigate={navigate} />

      {page === 'home' && <HomePage onNavigate={navigate} />}
      {page === 'insurance' && <InsurancePage onNavigate={navigate} />}
      {page === 'file-claim' && (
        <FileClaimPage
          onNavigate={navigate}
          initialInsuranceTypeId={params.insuranceTypeId as string | null}
        />
      )}
      {page === 'analyze' && <AnalyzePage />}
      {page === 'upload' && <UploadPage />}
      {page === 'claims' && <ClaimsPage />}

      {/* Footer */}
      <footer className="border-t border-white/5 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <span className="text-sm font-bold text-white">Explainable AI Framework</span>
              <span className="text-xs text-slate-600">· SHAP &amp; LIME Fraud Detection</span>
            </div>
            <div className="flex items-center gap-5 text-xs text-slate-500">
              <span>XGBoost Engine</span>
              <span>SHAP Explanations</span>
              <span>LIME Interpretability</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Fixed "Presented by" badge — stays visible while scrolling */}
      <div className="fixed bottom-4 left-4 z-50 pointer-events-none">
        <div className="glass-card px-4 py-3 rounded-xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Presented by</p>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-slate-300">Mariappan <span className="text-slate-600">/ CSE Dept</span></p>
            <p className="text-xs font-medium text-slate-300">Selvapandi <span className="text-slate-600">/ CSE Dept</span></p>
          </div>
        </div>
      </div>
      </div>
    </CurrencyProvider>
  );
}
