import { useState, useRef } from 'react';
import { Upload, FileJson, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, BarChart3, TrendingUp, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase, type DatasetRecord } from '@/lib/supabase';
import { analyzeFraud } from '@/lib/fraudEngine';
import { useCurrency } from '@/lib/currencyContext';
import { formatCurrency } from '@/lib/currency';

type ParsedRecord = {
  claimAmount: number;
  incidentDescription: string;
  incidentDate: string | null;
  priorClaims: number;
  policyAgeMonths: number;
  basePremium: number;
  incidentLocation: string;
  policyHolderLocation: string;
  claimantName?: string;
  claimantEmail?: string;
  insuranceTypeName?: string;
  policyNumber?: string;
};

type BatchResult = {
  total: number;
  legitimate: number;
  suspicious: number;
  fraudulent: number;
  avgProbability: number;
  results: { name: string; amount: number; label: string; probability: number; riskFactors: string[] }[];
};

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [datasetRecord, setDatasetRecord] = useState<DatasetRecord | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { currency } = useCurrency();

  // Split one CSV line, honouring "quoted, values" and "" escaped quotes
  const splitCSVLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const parseCSV = (text: string): ParsedRecord[] => {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');
    const headers = splitCSVLine(lines[0]).map((h) => h.toLowerCase());
    const records: ParsedRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitCSVLine(lines[i]);
      if (values.length < 3) continue;
      const row: Record<string, string> = {};
      headers.forEach((h, j) => { row[h] = values[j] || ''; });

      records.push({
        claimAmount: parseFloat(row['claim_amount'] || row['amount'] || '0') || 0,
        incidentDescription: row['incident_description'] || row['description'] || '',
        incidentDate: row['incident_date'] || row['date'] || null,
        priorClaims: parseInt(row['prior_claims'] || '0') || 0,
        policyAgeMonths: parseInt(row['policy_age_months'] || row['policy_age'] || '12') || 12,
        basePremium: parseFloat(row['base_premium'] || row['premium'] || '1000') || 1000,
        incidentLocation: row['incident_location'] || row['location'] || '',
        policyHolderLocation: row['policy_holder_location'] || row['holder_location'] || row['incident_location'] || '',
        claimantName: row['claimant_name'] || row['name'] || '',
        claimantEmail: row['claimant_email'] || row['email'] || '',
        insuranceTypeName: row['insurance_type'] || row['type'] || '',
        policyNumber: row['policy_number'] || '',
      });
    }
    return records;
  };

  const parseJSON = (text: string): ParsedRecord[] => {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('JSON must be an array of claim records');
    return data.map((r: Record<string, unknown>) => ({
      claimAmount: Number(r.claimAmount ?? r.claim_amount ?? r.amount ?? 0) || 0,
      incidentDescription: String(r.incidentDescription ?? r.incident_description ?? r.description ?? ''),
      incidentDate: (r.incidentDate ?? r.incident_date ?? null) as string | null,
      priorClaims: Number(r.priorClaims ?? r.prior_claims ?? 0) || 0,
      policyAgeMonths: Number(r.policyAgeMonths ?? r.policy_age_months ?? 12) || 12,
      basePremium: Number(r.basePremium ?? r.base_premium ?? 1000) || 1000,
      incidentLocation: String(r.incidentLocation ?? r.incident_location ?? ''),
      policyHolderLocation: String(r.policyHolderLocation ?? r.policy_holder_location ?? r.incidentLocation ?? ''),
      claimantName: String(r.claimantName ?? ''),
      claimantEmail: String(r.claimantEmail ?? ''),
      insuranceTypeName: String(r.insuranceTypeName ?? ''),
      policyNumber: String(r.policyNumber ?? ''),
    }));
  };

  const handleFile = async (file: File) => {
    setError('');
    setBatchResult(null);
    setDatasetRecord(null);
    setFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'json') {
      setError('Please upload a CSV or JSON file.');
      return;
    }

    setParsing(true);
    try {
      const text = await file.text();
      const records = ext === 'csv' ? parseCSV(text) : parseJSON(text);
      setParsing(false);

      if (records.length === 0) {
        setError('No valid records found in file.');
        return;
      }

      // Analyze each record
      setAnalyzing(true);
      await new Promise((r) => setTimeout(r, 500));

      const results = records.map((r, i) => {
        const fr = analyzeFraud(r);
        return {
          name: r.claimantName || `Record ${i + 1}`,
          amount: r.claimAmount,
          label: fr.fraudLabel,
          probability: fr.fraudProbability,
          riskFactors: fr.topRiskFactors,
        };
      });

      const legitimate = results.filter((r) => r.label === 'legitimate').length;
      const suspicious = results.filter((r) => r.label === 'suspicious').length;
      const fraudulent = results.filter((r) => r.label === 'fraudulent').length;
      const avgProbability = results.reduce((sum, r) => sum + r.probability, 0) / results.length;

      const batch: BatchResult = {
        total: results.length,
        legitimate,
        suspicious,
        fraudulent,
        avgProbability,
        results: results.sort((a, b) => b.probability - a.probability),
      };
      setBatchResult(batch);

      // Save dataset record to DB
      const { data, error: saveError } = await supabase.from('dataset_records').insert({
        filename: file.name,
        record_count: results.length,
        status: 'completed',
        summary: {
          legitimate,
          suspicious,
          fraudulent,
          avg_probability: avgProbability,
        },
      }).select('*').single();

      if (data) setDatasetRecord(data as DatasetRecord);
      if (saveError) setError(`Analysis finished, but the dataset record could not be saved: ${saveError.message}`);

      setAnalyzing(false);
    } catch (err) {
      setParsing(false);
      setAnalyzing(false);
      setError(err instanceof Error ? err.message : 'Failed to parse file.');
    }
  };

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="section-label mb-3">Batch Analysis</div>
          <h1 className="text-3xl font-bold text-white mb-3">Upload Claims Dataset</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Upload a CSV or JSON file with multiple claims. Our AI engine will analyze each record for fraud indicators in seconds.
          </p>
        </div>

        {/* Format guide */}
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet className="w-4 h-4 text-accent-400" />
            <h3 className="text-sm font-semibold text-white">Required Format</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-400">
            <div><code className="text-accent-300">claim_amount</code> — claim value</div>
            <div><code className="text-accent-300">incident_description</code> — text description</div>
            <div><code className="text-accent-300">incident_date</code> — date of incident</div>
            <div><code className="text-accent-300">prior_claims</code> — number of prior claims</div>
            <div><code className="text-accent-300">policy_age_months</code> — policy age</div>
            <div><code className="text-accent-300">base_premium</code> — annual premium</div>
            <div><code className="text-accent-300">incident_location</code> — where it happened</div>
            <div><code className="text-accent-300">policy_holder_location</code> — holder address</div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-xs text-slate-500">
              Optional fields: <code className="text-slate-400">claimant_name, claimant_email, insurance_type, policy_number</code>
            </p>
          </div>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileRef.current?.click()}
          className={`glass-card p-12 text-center cursor-pointer transition-all ${
            dragOver ? 'border-primary-500/50 ring-2 ring-primary-500/20' : ''
          } ${parsing || analyzing ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {parsing ? (
            <>
              <Loader2 className="w-10 h-10 text-primary-400 mx-auto mb-4 animate-spin" />
              <p className="text-sm text-slate-400">Parsing file...</p>
            </>
          ) : analyzing ? (
            <>
              <Loader2 className="w-10 h-10 text-accent-400 mx-auto mb-4 animate-spin" />
              <p className="text-sm text-slate-400">Running AI analysis on {fileName}...</p>
              <p className="text-xs text-slate-600 mt-1">XGBoost + SHAP + LIME on each record</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-primary-400" />
              </div>
              <p className="text-base font-medium text-white mb-1">
                {fileName ? fileName : 'Drop your file here or click to browse'}
              </p>
              <p className="text-sm text-slate-500">Supports CSV and JSON formats</p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FileJson className="w-4 h-4" />
                  JSON
                </div>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-error-500/10 border border-error-500/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-error-400 shrink-0" />
            <p className="text-sm text-error-300">{error}</p>
          </div>
        )}

        {/* Results */}
        {batchResult && (
          <div className="mt-8 space-y-5 animate-fade-in">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-success-400" />
                <span className="text-sm font-medium text-success-400">Analysis Complete</span>
              </div>
              <p className="text-sm text-slate-400">
                {batchResult.total} records analyzed from {fileName}
              </p>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card p-4 text-center">
                <BarChart3 className="w-5 h-5 text-primary-400 mx-auto mb-1.5" />
                <div className="text-2xl font-bold text-white">{batchResult.total}</div>
                <div className="text-xs text-slate-500">Total Records</div>
              </div>
              <div className="glass-card p-4 text-center">
                <ShieldCheck className="w-5 h-5 text-success-400 mx-auto mb-1.5" />
                <div className="text-2xl font-bold text-success-400">{batchResult.legitimate}</div>
                <div className="text-xs text-slate-500">Legitimate</div>
              </div>
              <div className="glass-card p-4 text-center">
                <AlertTriangle className="w-5 h-5 text-warning-400 mx-auto mb-1.5" />
                <div className="text-2xl font-bold text-warning-400">{batchResult.suspicious}</div>
                <div className="text-xs text-slate-500">Suspicious</div>
              </div>
              <div className="glass-card p-4 text-center">
                <TrendingUp className="w-5 h-5 text-error-400 mx-auto mb-1.5" />
                <div className="text-2xl font-bold text-error-400">{batchResult.fraudulent}</div>
                <div className="text-xs text-slate-500">Fraudulent</div>
              </div>
            </div>

            {/* Avg risk */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Average Fraud Probability</span>
                <span className="text-sm font-bold text-white">{Math.round(batchResult.avgProbability * 100)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${batchResult.avgProbability * 100}%`,
                    background: batchResult.avgProbability < 0.35
                      ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                      : batchResult.avgProbability < 0.65
                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      : 'linear-gradient(90deg, #ef4444, #f87171)',
                  }}
                />
              </div>
            </div>

            {/* Records table */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Individual Results (sorted by risk)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-white/5">
                      <th className="text-left pb-2 pr-3 font-medium">Claimant</th>
                      <th className="text-right pb-2 px-3 font-medium">Amount</th>
                      <th className="text-right pb-2 px-3 font-medium">Risk</th>
                      <th className="text-left pb-2 px-3 font-medium">Verdict</th>
                      <th className="text-left pb-2 pl-3 font-medium">Top Risk Factor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResult.results.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0">
                        <td className="py-2.5 pr-3 text-slate-300">{r.name}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{formatCurrency(r.amount, currency)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={
                            r.label === 'legitimate' ? 'text-success-400 font-medium' :
                            r.label === 'suspicious' ? 'text-warning-400 font-medium' :
                            'text-error-400 font-medium'
                          }>
                            {Math.round(r.probability * 100)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            r.label === 'legitimate' ? 'bg-success-500/10 text-success-400' :
                            r.label === 'suspicious' ? 'bg-warning-500/10 text-warning-400' :
                            'bg-error-500/10 text-error-400'
                          }`}>
                            {r.label}
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 text-xs text-slate-500 max-w-xs truncate">
                          {r.riskFactors[0] || 'No significant risk factors'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {batchResult.results.length > 50 && (
                <p className="text-xs text-slate-500 mt-3 text-center">
                  Showing top 50 of {batchResult.results.length} records
                </p>
              )}
            </div>

            {datasetRecord && (
              <p className="text-xs text-slate-500 text-center">
                Dataset saved to records — ID: {datasetRecord.id.slice(0, 8)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
