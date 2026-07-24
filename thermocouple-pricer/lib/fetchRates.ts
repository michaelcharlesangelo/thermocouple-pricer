import { MarketRates } from "./pricing";

// ---------------------------------------------------------------------------
// Auto-fetch of live rates. Two external calls:
//
// 1) Precious metals (Pt, Rh) spot price in USD/oz.
//    Kitco itself has no public JSON API, so this uses metalpriceapi.com
//    (free tier available at https://metalpriceapi.com). Set METALS_API_KEY
//    in your environment. If the key is missing or the call fails, the
//    previous stored value is kept and the caller falls back to manual entry.
//
// 2) USD/EUR and USD/IDR FX rates, via the free open.er-api.com endpoint
//    (no key required). Note: this is a mid-market rate, not klikBCA's
//    specific "kurs jual" - if you need to match klikBCA exactly, use the
//    manual override on the admin page.
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

  // --- Metals ---
  const metalsKey = process.env.METALS_API_KEY;
  if (!metalsKey) {
    errors.push("METALS_API_KEY not configured - skipped metals auto-fetch.");
  } else {
    try {
      const res = await fetch(
        `https://api.metalpriceapi.com/v1/latest?api_key=${metalsKey}&base=USD&currencies=XPT,XRH`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json?.rates?.XPT) {
        // API returns "USD per 1 XPT unit" as a fraction (XPT per USD), so invert
        result.platinumUsdPerOz = 1 / json.rates.XPT;
      }
      if (json?.rates?.XRH) {
        result.rhodiumUsdPerOz = 1 / json.rates.XRH;
      }
      if (!json?.rates?.XPT && !json?.rates?.XRH) {
        errors.push("Metals API returned no usable data: " + JSON.stringify(json).slice(0, 200));
      }
    } catch (e) {
      errors.push("Metals API fetch failed: " + (e as Error).message);
    }
  }

  // --- FX ---
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    const json = await res.json();
    if (json?.rates?.EUR) result.usdEurRate = json.rates.EUR;
    if (json?.rates?.IDR) result.usdIdrRate = json.rates.IDR;
    if (!json?.rates?.EUR && !json?.rates?.IDR) {
      errors.push("FX API returned no usable data.");
    }
  } catch (e) {
    errors.push("FX API fetch failed: " + (e as Error).message);
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
