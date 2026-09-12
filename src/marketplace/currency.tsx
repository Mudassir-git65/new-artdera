import React, { createContext, useContext, useState, useEffect } from "react";

export type CurrencyCode = "PKR" | "USD" | "EUR" | "GBP" | "AED" | "SAR" | "AUD" | "CAD";

const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  PKR: 1,
  USD: 0.0036, // Approximate rates
  EUR: 0.0033,
  GBP: 0.0028,
  AED: 0.013,
  SAR: 0.0135,
  AUD: 0.0055,
  CAD: 0.0049,
};

const SYMBOLS: Record<CurrencyCode, string> = {
  PKR: "PKR",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  SAR: "ر.س",
  AUD: "A$",
  CAD: "C$",
};

// eslint-disable-next-line react-refresh/only-export-components
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

type CurrencyContextType = {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  formatPrice: (pkrAmount: number) => string;
  convertPrice: (pkrAmount: number) => number;
  symbol: string;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("PKR");

  useEffect(() => {
    const saved = localStorage.getItem("artdera_currency") as CurrencyCode;
    if (saved && EXCHANGE_RATES[saved]) {
      setCurrencyState(saved);
    }
  }, []);

  const setCurrency = (curr: CurrencyCode) => {
    setCurrencyState(curr);
    localStorage.setItem("artdera_currency", curr);
  };

  const convertPrice = (pkrAmount: number) => {
    return pkrAmount * EXCHANGE_RATES[currency];
  };

  const formatPrice = (pkrAmount: number) => {
    if (currency === "PKR") {
      return `PKR ${pkrAmount.toLocaleString("en-PK")}`;
    }
    const converted = convertPrice(pkrAmount);
    return `${SYMBOLS[currency]} ${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, formatPrice, convertPrice, symbol: SYMBOLS[currency] }}
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
