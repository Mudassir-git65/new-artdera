export type SupportedCurrency = "PKR" | "USD" | "EUR" | "GBP" | "AED" | "SAR" | "AUD" | "CAD";

export interface CurrencyRatesResponse {
  base: "PKR";
  timestamp: number;
  rates: Record<SupportedCurrency, number>;
}

// Fallback rates (PKR base = 1) if external exchange API is unavailable
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  PKR: 1,
  USD: 0.0036,
  EUR: 0.0033,
  GBP: 0.0028,
  AED: 0.013,
  SAR: 0.0135,
  AUD: 0.0055,
  CAD: 0.0049,
};

let cachedRates: CurrencyRatesResponse | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function getExchangeRates(): Promise<CurrencyRatesResponse> {
  const now = Date.now();
  if (cachedRates && now - cachedRates.timestamp < CACHE_TTL_MS) {
    return cachedRates;
  }

  try {
    // Frankfurter API v2 / v1 latest rates from USD
    const response = await fetch("https://api.frankfurter.app/latest?from=USD", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });

    if (response.ok) {
      const data = (await response.json()) as { rates: Record<string, number> };
      // data.rates gives USD to EUR, GBP, CAD, AUD, etc.
      // We know approximate USD to PKR rate ~ 278 PKR per USD
      const usdToPkr = data.rates["PKR"] || 278;
      const usdToEur = data.rates["EUR"] || 0.92;
      const usdToGbp = data.rates["GBP"] || 0.78;
      const usdToCad = data.rates["CAD"] || 1.36;
      const usdToAud = data.rates["AUD"] || 1.52;

      // Fixed pegs for AED and SAR relative to USD
      const usdToAed = 3.6725;
      const usdToSar = 3.75;

      // Convert all rates to PKR base (1 PKR = X Target Currency)
      const pkrRates: Record<SupportedCurrency, number> = {
        PKR: 1,
        USD: 1 / usdToPkr,
        EUR: (1 / usdToPkr) * usdToEur,
        GBP: (1 / usdToPkr) * usdToGbp,
        CAD: (1 / usdToPkr) * usdToCad,
        AUD: (1 / usdToPkr) * usdToAud,
        AED: (1 / usdToPkr) * usdToAed,
        SAR: (1 / usdToPkr) * usdToSar,
      };

      cachedRates = {
        base: "PKR",
        timestamp: now,
        rates: pkrRates,
      };

      return cachedRates;
    }
  } catch (err) {
    console.warn("Failed to fetch fresh exchange rates from Frankfurter API, using fallback:", err);
  }

  // Fallback
  if (!cachedRates) {
    cachedRates = {
      base: "PKR",
      timestamp: now,
      rates: FALLBACK_RATES,
    };
  }
  return cachedRates;
}

/**
 * Suggests default display currency based on visitor country code (ISO 3166-1 alpha-2)
 */
export function suggestCurrencyForCountry(countryCode?: string): SupportedCurrency {
  if (!countryCode) return "PKR";
  const code = countryCode.trim().toUpperCase();

  switch (code) {
    case "PK":
      return "PKR";
    case "US":
      return "USD";
    case "CA":
      return "CAD";
    case "GB":
      return "GBP";
    case "AE":
      return "AED";
    case "SA":
      return "SAR";
    case "AU":
      return "AUD";
    case "AT":
    case "BE":
    case "CY":
    case "EE":
    case "FI":
    case "FR":
    case "DE":
    case "GR":
    case "IE":
    case "IT":
    case "LV":
    case "LT":
    case "LU":
    case "MT":
    case "NL":
    case "PT":
    case "SK":
    case "SI":
    case "ES":
      return "EUR";
    default:
      return "USD";
  }
}
