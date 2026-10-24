export type Currency = {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  rate: number; // 1 base unit = rate * currency
  locale: string;
};

// Base unit = USD. Rates are approximate static values.
export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: 'US', rate: 1, locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: 'EU', rate: 0.92, locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: 'GB', rate: 0.79, locale: 'en-GB' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: 'IN', rate: 83.5, locale: 'en-IN' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: 'JP', rate: 149.5, locale: 'ja-JP' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: 'CN', rate: 7.25, locale: 'zh-CN' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: 'CA', rate: 1.36, locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: 'AU', rate: 1.52, locale: 'en-AU' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', flag: 'CH', rate: 0.88, locale: 'de-CH' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', flag: 'AE', rate: 3.67, locale: 'ar-AE' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', flag: 'SA', rate: 3.75, locale: 'ar-SA' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: 'SG', rate: 1.34, locale: 'en-SG' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: 'ZA', rate: 18.5, locale: 'en-ZA' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: 'BR', rate: 5.05, locale: 'pt-BR' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', flag: 'KR', rate: 1350, locale: 'ko-KR' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', flag: 'MX', rate: 17.2, locale: 'es-MX' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', flag: 'NG', rate: 1580, locale: 'en-NG' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', flag: 'TR', rate: 28.9, locale: 'tr-TR' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', flag: 'PK', rate: 278, locale: 'en-PK' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', flag: 'BD', rate: 110, locale: 'en-BD' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', flag: 'RU', rate: 92.5, locale: 'ru-RU' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', flag: 'ID', rate: 15850, locale: 'id-ID' },
];

export const DEFAULT_CURRENCY = CURRENCIES[0];

export function getCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) || DEFAULT_CURRENCY;
}

// Convert from base (USD) to selected currency
export function convertFromBase(baseAmount: number, currency: Currency): number {
  return baseAmount * currency.rate;
}

// Convert from selected currency to base (USD)
export function convertToBase(amount: number, currency: Currency): number {
  return amount / currency.rate;
}

// Format a base amount in the selected currency
export function formatCurrency(baseAmount: number, currency: Currency, decimals?: number): string {
  const converted = convertFromBase(baseAmount, currency);
  return formatAmount(converted, currency, decimals);
}

// Format a raw amount (already in the target currency)
export function formatAmount(amount: number, currency: Currency, decimals?: number): string {
  const isJPY = currency.code === 'JPY' || currency.code === 'KRW' || currency.code === 'IDR';
  const d = decimals ?? (isJPY ? 0 : 0);
  const formatted = amount.toLocaleString(currency.locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
  return `${currency.symbol}${formatted}`;
}
