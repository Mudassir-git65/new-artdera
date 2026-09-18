import React, { createContext, useContext, useState, useEffect } from "react";

export type CurrencyCode = "PKR" | "USD" | "EUR" | "GBP" | "AED" | "SAR" | "AUD" | "CAD";

const FALLBACK_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  PKR: 1,
  USD: 0.0036,
  EUR: 0.0033,
  GBP: 0.0028,
  AED: 0.013,
  SAR: 0.0135,
  AUD: 0.0055,
  CAD: 0.0049,
};

const PREFIX_SYMBOLS: Record<CurrencyCode, string> = {
  PKR: "PKR ",
  USD: "US$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
  SAR: "SAR ",
  AUD: "A$",
  CAD: "CA$",
};

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: "PKR", label: "PKR - Pakistani Rupee" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "GBP", label: "GBP - British Pound" },
  { code: "AED", label: "AED - UAE Dirham" },
  { code: "SAR", label: "SAR - Saudi Riyal" },
  { code: "AUD", label: "AUD - Australian Dollar" },
  { code: "CAD", label: "CAD - Canadian Dollar" },
];

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

type CurrencyContextType = {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  formatPrice: (pkrAmount: number) => string;
  convertPrice: (pkrAmount: number) => number;
  rates: Record<CurrencyCode, number>;
  symbol: string;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("PKR");
  const [rates, setRates] = useState<Record<CurrencyCode, number>>(FALLBACK_EXCHANGE_RATES);

  useEffect(() => {
    let active = true;

    // 1. Check existing cookie or localStorage preference first (manual user override takes priority)
    const saved = (getCookie("artdera_currency") || (typeof localStorage !== "undefined" ? localStorage.getItem("artdera_currency") : null)) as CurrencyCode | null;
    const hasManualPreference = Boolean(saved && FALLBACK_EXCHANGE_RATES[saved]);

    if (hasManualPreference && saved) {
      setCurrencyState(saved);
    }

    // 2. Fetch central exchange rates & suggested country currency from server
    async function syncRates() {
      try {
        const res = await fetch("/api/currency/rates");
        if (!res.ok) return;
        const data = (await res.json()) as {
          rates?: Record<CurrencyCode, number>;
          suggestedCurrency?: CurrencyCode;
        };
        if (!active) return;
        if (data.rates) {
          setRates(data.rates);
        }
        // If user has not set a manual preference, adopt suggested regional currency
        if (!hasManualPreference && data.suggestedCurrency && FALLBACK_EXCHANGE_RATES[data.suggestedCurrency]) {
          setCurrencyState(data.suggestedCurrency);
          setCookie("artdera_currency", data.suggestedCurrency);
        }
      } catch {
        // Keep fallback rates if offline
      }
    }

    void syncRates();

    return () => {
      active = false;
    };
  }, []);

  const setCurrency = (curr: CurrencyCode) => {
    setCurrencyState(curr);
    setCookie("artdera_currency", curr);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("artdera_currency", curr);
    }
  };

  const convertPrice = (pkrAmount: number) => {
    const rate = rates[currency] || FALLBACK_EXCHANGE_RATES[currency] || 1;
    return pkrAmount * rate;
  };

  const formatPrice = (pkrAmount: number) => {
    if (currency === "PKR") {
      const formatted = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(pkrAmount);
      return `PKR ${formatted}`;
    }

    const converted = convertPrice(pkrAmount);
    // Round logically for display
    const rounded = Math.round(converted);
    const formattedNum = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded);
    const prefix = PREFIX_SYMBOLS[currency] || `${currency} `;
    return `${prefix}${formattedNum}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        formatPrice,
        convertPrice,
        rates,
        symbol: PREFIX_SYMBOLS[currency],
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}

