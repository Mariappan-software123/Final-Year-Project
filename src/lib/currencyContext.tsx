import { createContext, useContext, useState, type ReactNode } from 'react';
import { CURRENCIES, DEFAULT_CURRENCY, type Currency } from '@/lib/currency';

type CurrencyContextType = {
  currency: Currency;
  setCurrency: (code: string) => void;
};

const CurrencyContext = createContext<CurrencyContextType>({
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

export { CURRENCIES };

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(DEFAULT_CURRENCY);

  const setCurrency = (code: string) => {
    const found = CURRENCIES.find((c) => c.code === code);
    if (found) setCurrencyState(found);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}
