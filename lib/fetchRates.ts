import { MarketRates } from "./pricing";

// ---------------------------------------------------------------------------
// Auto-fetch of live rates.
//
// FX (USD/EUR, USD/IDR): always attempted, no key needed, via the free
// open.er-api.com endpoint. This is a mid-market rate - the same kind of
// number XE.com shows on its homepage converter (XE itself has no free
// public API, and scraping its site directly isn't reliable or permitted,
// so this is the closest free equivalent). If you need klikBCA's exact
// "kurs jual" figure, enter it manually on /admin - manual always overrides
// until the next refresh.
//
// Platinum / Rhodium: no metals API key is required for this app to work -
// leave RHODIUM_API_KEY unset and just type today's Kitco figures into
// /admin. If you do want auto-fetch, set RHODIUM_API_KEY to a Metal Sentinel
// (RapidAPI) key - one of the few free-tier sources that actually covers
// Rhodium (most gold/silver metal APIs don't). See README for the signup
// link. Johnson Matthey publishes PGM prices on their site but doesn't
// offer a public API, so that's not wired in here.
// ---------------------------------------------------------------------------

interface FetchResult {
  platinumUsdPerOz?: number;
  rhodiumUsdPerOz?: number;
  usdEurRate?: number;
  usdIdrRate?: number;
  errors: string[];
}

export async function fetchLiveRates(): Promise<FetchResult> {
  const errors: string[] = [];
  const result: FetchResult = { errors };

  // --- FX (always attempted, no key required) ---
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    const json = await res.json();
    if (json?.rates?.EUR) result.usdEurRate = json.rates.EUR;
    if (json?.rates?.IDR) result.usdIdrRate = json.rates.IDR;
    if (!json?.rates?.EUR && !json?.rates?.IDR) {
      errors.push("FX API returned no usable data.");
    }
  } catch (e) {
    errors.push("FX rate fetch failed: " + (e as Error).message);
  }

  // --- Metals (optional - only if a key is configured) ---
  const rapidApiKey = process.env.RHODIUM_API_KEY;
  if (!rapidApiKey) {
    errors.push("Pt/Rh auto-fetch not configured - enter today's figures manually below.");
  } else {
    try {
      const [ptRes, rhRes] = await Promise.all([
        fetch("https://metal-sentinel.p.rapidapi.com/latest?metal=PT&currency=USD", {
          headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": "metal-sentinel.p.rapidapi.com" },
          cache: "no-store",
        }),
        fetch("https://metal-sentinel.p.rapidapi.com/latest?metal=RH&currency=USD", {
          headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": "metal-sentinel.p.rapidapi.com" },
          cache: "no-store",
        }),
      ]);
      const ptJson = await ptRes.json();
      const rhJson = await rhRes.json();
      if (typeof ptJson?.price === "number") result.platinumUsdPerOz = ptJson.price;
      if (typeof rhJson?.price === "number") result.rhodiumUsdPerOz = rhJson.price;
      if (!result.platinumUsdPerOz && !result.rhodiumUsdPerOz) {
        errors.push(
          "Metal Sentinel returned no usable data - double check RHODIUM_API_KEY and the response shape " +
            "(their exact field names may differ; check their RapidAPI docs and adjust lib/fetchRates.ts if needed)."
        );
      }
    } catch (e) {
      errors.push("Pt/Rh auto-fetch failed: " + (e as Error).message);
    }
  }

  return result;
}

export function mergeIntoRates(previous: MarketRates, fetched: FetchResult): MarketRates {
  return {
    platinumUsdPerOz: fetched.platinumUsdPerOz ?? previous.platinumUsdPerOz,
    rhodiumUsdPerOz: fetched.rhodiumUsdPerOz ?? previous.rhodiumUsdPerOz,
    usdEurRate: fetched.usdEurRate ?? previous.usdEurRate,
    usdIdrRate: fetched.usdIdrRate ?? previous.usdIdrRate,
    updatedAt: new Date().toISOString(),
    source: "auto",
  };
}
