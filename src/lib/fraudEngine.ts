import type { ShapValue, LimeExplanation } from './supabase';

export type ClaimFeatures = {
  claimAmount: number;
  incidentDescriptionLength: number;
  daysSinceIncident: number;
  hasPriorClaims: number;
  policyAgeMonths: number;
  claimToPremiumRatio: number;
  descriptionVague: number;
  amountRound: number;
  weekendIncident: number;
  lateNightIncident: number;
  locationMismatch: number;
  duplicateKeywords: number;
};

export type FraudResult = {
  fraudProbability: number;
  fraudLabel: 'legitimate' | 'suspicious' | 'fraudulent';
  xgboostScore: number;
  modelConfidence: number;
  shapValues: ShapValue[];
  limeExplanation: LimeExplanation[];
  topRiskFactors: string[];
  recommendation: string;
  features: ClaimFeatures;
};

const FRAUD_KEYWORDS = [
  'lost', 'stolen', 'disappeared', 'missing', 'suddenly', 'overnight',
  'parked', 'unknown', 'unlocked', 'somehow', 'somewhere', 'nowhere',
  'not sure', 'don\'t know', 'can\'t remember', 'vanished',
];

const VAGUE_PHRASES = [
  'not sure', 'don\'t know', 'somewhere', 'somehow', 'maybe', 'i think',
  'probably', 'not certain', 'can\'t recall', 'don\'t remember',
];

function roundnessCheck(amount: number): number {
  if (amount === 0) return 0;
  const remainder = amount % 1000;
  if (remainder === 0 && amount >= 5000) return 1;
  if (amount % 500 === 0 && amount >= 2000) return 0.5;
  return 0;
}

function descriptionVagenessScore(description: string): number {
  const lower = description.toLowerCase();
  let score = 0;
  for (const phrase of VAGUE_PHRASES) {
    if (lower.includes(phrase)) score += 0.25;
  }
  return Math.min(score, 1);
}

function duplicateKeywordScore(description: string): number {
  const words = description.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  let dup = 0;
  for (const [, c] of counts) if (c > 1) dup += c - 1;
  return Math.min(dup / 5, 1);
}

export function extractFeatures(input: {
  claimAmount: number;
  incidentDescription: string;
  incidentDate: string | null;
  claimFiledDate: Date;
  priorClaims: number;
  policyAgeMonths: number;
  basePremium: number;
  incidentLocation: string;
  policyHolderLocation: string;
}): ClaimFeatures {
  const desc = input.incidentDescription || '';
  const descLower = desc.toLowerCase();

  let daysSince = 0;
  if (input.incidentDate) {
    const incident = new Date(input.incidentDate);
    daysSince = Math.max(0, Math.floor((input.claimFiledDate.getTime() - incident.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const incidentDay = input.incidentDate ? new Date(input.incidentDate).getDay() : -1;
  const weekend = incidentDay === 0 || incidentDay === 6 ? 1 : 0;

  // A plain date (YYYY-MM-DD) has no time of day, and new Date() parses it as
  // UTC midnight, which made every dated claim look like a "late night" one.
  // Only use the hour when the value really contains a time.
  const hasTime = !!input.incidentDate && input.incidentDate.length > 10;
  const incidentHour = hasTime ? new Date(input.incidentDate as string).getHours() : 12;
  const lateNight = incidentHour >= 22 || incidentHour < 5 ? 1 : 0;

  const fraudKeywordCount = FRAUD_KEYWORDS.filter((k) => descLower.includes(k)).length;

  const locMismatch = input.incidentLocation && input.policyHolderLocation
    ? input.incidentLocation.toLowerCase() === input.policyHolderLocation.toLowerCase() ? 0 : 0.5
    : 0.3;

  const ratio = input.basePremium > 0 ? input.claimAmount / input.basePremium : input.claimAmount / 1000;

  return {
    claimAmount: input.claimAmount,
    incidentDescriptionLength: desc.length,
    daysSinceIncident: daysSince,
    hasPriorClaims: Math.min(input.priorClaims, 5),
    policyAgeMonths: input.policyAgeMonths,
    claimToPremiumRatio: ratio,
    descriptionVague: descriptionVagenessScore(desc),
    amountRound: roundnessCheck(input.claimAmount),
    weekendIncident: weekend,
    lateNightIncident: lateNight,
    locationMismatch: locMismatch,
    duplicateKeywords: Math.min(duplicateKeywordScore(desc) + fraudKeywordCount * 0.15, 1),
  };
}

// Simulated XGBoost-like ensemble prediction using tree-like threshold splits
function xgboostPredict(f: ClaimFeatures): { score: number; rawWeights: Map<string, number> } {
  const weights = new Map<string, number>();
  let score = -0.5; // base value (log-odds)

  // Tree 1: High claim-to-premium ratio
  const ratioContribution = f.claimToPremiumRatio > 5 ? 0.35 : f.claimToPremiumRatio > 2 ? 0.12 : -0.1;
  weights.set('claim_to_premium_ratio', ratioContribution);
  score += ratioContribution;

  // Tree 2: Round amount suspicion
  const roundContribution = f.amountRound === 1 ? 0.25 : f.amountRound === 0.5 ? 0.1 : -0.05;
  weights.set('round_amount', roundContribution);
  score += roundContribution;

  // Tree 3: Vague description
  const vagueContribution = f.descriptionVague * 0.4 - 0.05;
  weights.set('vague_description', vagueContribution);
  score += vagueContribution;

  // Tree 4: Prior claims history
  const priorContribution = f.hasPriorClaims >= 3 ? 0.3 : f.hasPriorClaims >= 1 ? 0.1 : -0.08;
  weights.set('prior_claims', priorContribution);
  score += priorContribution;

  // Tree 5: Days since incident (delayed filing)
  const delayContribution = f.daysSinceIncident > 30 ? 0.22 : f.daysSinceIncident > 14 ? 0.08 : -0.06;
  weights.set('filing_delay', delayContribution);
  score += delayContribution;

  // Tree 6: Late night incidents
  const nightContribution = f.lateNightIncident ? 0.12 : -0.03;
  weights.set('late_night', nightContribution);
  score += nightContribution;

  // Tree 7: Description length (very short = suspicious)
  const lengthContribution = f.incidentDescriptionLength < 50 ? 0.18 : f.incidentDescriptionLength < 150 ? 0.05 : -0.04;
  weights.set('short_description', lengthContribution);
  score += lengthContribution;

  // Tree 8: Duplicate/fraud keywords
  const keywordContribution = f.duplicateKeywords > 0.4 ? 0.2 : f.duplicateKeywords > 0.15 ? 0.08 : -0.05;
  weights.set('fraud_keywords', keywordContribution);
  score += keywordContribution;

  // Tree 9: Policy age (very new policy + high claim = suspicious)
  const policyAgeContribution = f.policyAgeMonths < 3 && f.claimAmount > 3000 ? 0.25 : f.policyAgeMonths < 6 ? 0.05 : -0.07;
  weights.set('new_policy', policyAgeContribution);
  score += policyAgeContribution;

  // Tree 10: Location mismatch
  const locContribution = f.locationMismatch > 0.4 ? 0.15 : 0;
  weights.set('location_mismatch', locContribution);
  score += locContribution;

  // Tree 11: Weekend incidents (slightly higher fraud rate)
  const weekendContribution = f.weekendIncident ? 0.06 : -0.02;
  weights.set('weekend', weekendContribution);
  score += weekendContribution;

  // Tree 12: High absolute amount
  const amountContribution = f.claimAmount > 10000 ? 0.15 : f.claimAmount > 5000 ? 0.06 : -0.05;
  weights.set('high_amount', amountContribution);
  score += amountContribution;

  return { score, rawWeights: weights };
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function buildShapValues(f: ClaimFeatures, weights: Map<string, number>): ShapValue[] {
  const featureMap: { key: string; feature: string; value: number | string; display: string }[] = [
    { key: 'claim_to_premium_ratio', feature: 'Claim/Premium Ratio', value: f.claimToPremiumRatio, display: `${f.claimToPremiumRatio.toFixed(1)}x` },
    { key: 'round_amount', feature: 'Round Amount Flag', value: f.amountRound, display: f.amountRound === 1 ? 'Exact round' : f.amountRound === 0.5 ? 'Near round' : 'Normal' },
    { key: 'vague_description', feature: 'Vague Description', value: f.descriptionVague, display: f.descriptionVague > 0.3 ? 'Vague' : 'Detailed' },
    { key: 'prior_claims', feature: 'Prior Claims', value: f.hasPriorClaims, display: `${f.hasPriorClaims}` },
    { key: 'filing_delay', feature: 'Filing Delay (days)', value: f.daysSinceIncident, display: `${f.daysSinceIncident}d` },
    { key: 'late_night', feature: 'Late Night Incident', value: f.lateNightIncident, display: f.lateNightIncident ? 'Yes' : 'No' },
    { key: 'short_description', feature: 'Description Length', value: f.incidentDescriptionLength, display: `${f.incidentDescriptionLength} chars` },
    { key: 'fraud_keywords', feature: 'Suspicious Keywords', value: f.duplicateKeywords, display: f.duplicateKeywords > 0.3 ? 'Detected' : 'None' },
    { key: 'new_policy', feature: 'Policy Age (months)', value: f.policyAgeMonths, display: `${f.policyAgeMonths}mo` },
    { key: 'location_mismatch', feature: 'Location Mismatch', value: f.locationMismatch, display: f.locationMismatch > 0.4 ? 'Mismatch' : 'Match' },
    { key: 'weekend', feature: 'Weekend Incident', value: f.weekendIncident, display: f.weekendIncident ? 'Yes' : 'No' },
    { key: 'high_amount', feature: 'Claim Amount', value: f.claimAmount, display: `$${f.claimAmount.toLocaleString()}` },
  ];

  return featureMap
    .map((m) => ({
      feature: m.feature,
      value: m.value,
      contribution: weights.get(m.key) || 0,
      display: m.display,
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

function buildLimeExplanation(f: ClaimFeatures): LimeExplanation[] {
  const explanations: LimeExplanation[] = [];

  if (f.claimToPremiumRatio > 5) {
    explanations.push({ feature: 'claim_to_premium_ratio', weight: 0.3, condition: `Claim amount is ${f.claimToPremiumRatio.toFixed(1)}x the annual premium` });
  }
  if (f.amountRound === 1) {
    explanations.push({ feature: 'round_amount', weight: 0.2, condition: 'Claim amount is an exact round number (suspicious)' });
  }
  if (f.descriptionVague > 0.3) {
    explanations.push({ feature: 'vague_description', weight: 0.25, condition: 'Incident description contains vague or uncertain language' });
  }
  if (f.hasPriorClaims >= 3) {
    explanations.push({ feature: 'prior_claims', weight: 0.2, condition: `${f.hasPriorClaims} prior claims filed in history` });
  }
  if (f.daysSinceIncident > 30) {
    explanations.push({ feature: 'filing_delay', weight: 0.15, condition: `Claim filed ${f.daysSinceIncident} days after incident` });
  }
  if (f.lateNightIncident) {
    explanations.push({ feature: 'late_night', weight: 0.1, condition: 'Incident occurred during late night hours (10 PM - 5 AM)' });
  }
  if (f.incidentDescriptionLength < 50) {
    explanations.push({ feature: 'short_description', weight: 0.12, condition: 'Incident description is unusually short' });
  }
  if (f.duplicateKeywords > 0.3) {
    explanations.push({ feature: 'fraud_keywords', weight: 0.15, condition: 'Description contains commonly associated fraud keywords' });
  }
  if (f.policyAgeMonths < 3 && f.claimAmount > 3000) {
    explanations.push({ feature: 'new_policy', weight: 0.2, condition: 'Policy is very new with a high claim amount' });
  }
  if (f.locationMismatch > 0.4) {
    explanations.push({ feature: 'location_mismatch', weight: 0.1, condition: 'Incident location does not match policy holder location' });
  }

  // Add positive (legitimate) factors
  if (f.claimToPremiumRatio < 2) {
    explanations.push({ feature: 'claim_to_premium_ratio', weight: -0.15, condition: 'Claim amount is reasonable relative to premium' });
  }
  if (f.incidentDescriptionLength > 150) {
    explanations.push({ feature: 'short_description', weight: -0.1, condition: 'Detailed incident description provided' });
  }
  if (f.hasPriorClaims === 0) {
    explanations.push({ feature: 'prior_claims', weight: -0.1, condition: 'No prior claims in history' });
  }
  if (f.daysSinceIncident <= 7) {
    explanations.push({ feature: 'filing_delay', weight: -0.08, condition: 'Claim filed promptly after incident' });
  }

  return explanations.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

function buildRiskFactors(f: ClaimFeatures): string[] {
  const factors: string[] = [];
  if (f.claimToPremiumRatio > 5) factors.push(`Claim is ${f.claimToPremiumRatio.toFixed(1)}x the annual premium — unusually high`);
  if (f.amountRound === 1) factors.push('Claim amount is an exact round number');
  if (f.descriptionVague > 0.3) factors.push('Description contains vague or uncertain language');
  if (f.hasPriorClaims >= 3) factors.push(`${f.hasPriorClaims} prior claims on record`);
  if (f.daysSinceIncident > 30) factors.push(`Delayed filing — ${f.daysSinceIncident} days after incident`);
  if (f.lateNightIncident) factors.push('Incident occurred during late-night hours');
  if (f.incidentDescriptionLength < 50) factors.push('Incident description is very brief');
  if (f.duplicateKeywords > 0.3) factors.push('Suspicious keywords detected in description');
  if (f.policyAgeMonths < 3 && f.claimAmount > 3000) factors.push('New policy with high claim amount');
  if (f.locationMismatch > 0.4) factors.push('Location mismatch between incident and policy holder');
  return factors;
}

function buildRecommendation(probability: number, f: ClaimFeatures): string {
  if (probability < 0.35) {
    return 'Low fraud risk detected. The claim exhibits characteristics consistent with legitimate claims. Recommended for standard processing and expedited approval.';
  }
  if (probability < 0.65) {
    const factors = buildRiskFactors(f);
    return `Moderate fraud risk detected. Manual review recommended. Pay attention to: ${factors.slice(0, 3).join('; ')}. Additional documentation may be required before approval.`;
  }
  return 'High fraud risk detected. Claim flagged for immediate manual investigation. Recommend requesting additional evidence, verifying with third parties, and conducting a thorough adjuster review before any payout.';
}

export function analyzeFraud(input: {
  claimAmount: number;
  incidentDescription: string;
  incidentDate: string | null;
  priorClaims: number;
  policyAgeMonths: number;
  basePremium: number;
  incidentLocation: string;
  policyHolderLocation: string;
}): FraudResult {
  const features = extractFeatures({
    ...input,
    claimFiledDate: new Date(),
  });

  const { score, rawWeights } = xgboostPredict(features);
  const probability = clamp(sigmoid(score), 0.01, 0.99);

  let label: 'legitimate' | 'suspicious' | 'fraudulent';
  if (probability < 0.35) label = 'legitimate';
  else if (probability < 0.65) label = 'suspicious';
  else label = 'fraudulent';

  const confidence = clamp(Math.abs(score) * 0.8 + 0.5, 0.5, 0.98);

  return {
    fraudProbability: probability,
    fraudLabel: label,
    xgboostScore: score,
    modelConfidence: confidence,
    shapValues: buildShapValues(features, rawWeights),
    limeExplanation: buildLimeExplanation(features),
    topRiskFactors: buildRiskFactors(features),
    recommendation: buildRecommendation(probability, features),
    features,
  };
}
