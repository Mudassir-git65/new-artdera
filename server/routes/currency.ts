import { Router } from "express";
import { getExchangeRates, suggestCurrencyForCountry } from "../services/currency";

export const currencyRouter = Router();

currencyRouter.get("/rates", async (req, res) => {
  try {
    const ratesData = await getExchangeRates();

    // Detect country code from Cloudflare / proxy headers
    const countryHeader =
      (req.headers["cf-ipcountry"] as string) ||
      (req.headers["x-country-code"] as string) ||
      "PK";

    const suggestedCurrency = suggestCurrencyForCountry(countryHeader);

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=21600");
    return res.status(200).json({
      ...ratesData,
      country: countryHeader,
      suggestedCurrency,
    });
  } catch (error) {
    console.error("Failed to serve currency rates:", error);
    return res.status(500).json({ error: "Failed to retrieve exchange rates" });
  }
});
