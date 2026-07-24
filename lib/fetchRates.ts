import { MarketRates } from "./pricing";

// ---------------------------------------------------------------------------
// Auto-fetch of live rates.
//
// FX (USD/EUR, USD/IDR): always attempted, no key needed. Primary source is
// open.er-api.com (free, no key); if that fails for any reason, falls back
// to frankfurter.app (ECB-based, also free/no key). This is a mid-market
// rate - the same kind of number XE.com's homepage converter shows (XE
// itself has no free public API, and scraping its site directly isn't
// reliable or permitted). If you need klikBCA's exact "kurs jual" figure,
// enter it manually on /admin - manual always overrides until the next
// refresh.
//
// Platinum / Rhodium: optional. Leave RHODIUM_API_KEY unset and just type
// today's Kitco figures into /admin - that always works. To auto-fetch,
// set RHODIUM_API_KEY to a Metal Sentinel key (https://rapidapi.com,
// search "Metal Sentinel", subscribe to the free plan) - one of the few
// free-tier sources that actually covers Rhodium. Endpoint/response shape
// below is taken directly from Metal Sentinel's own published docs
// (https://metal-sentinel.com/endpoints):
//   GET https://metal-sentinel.p.rapidapi.com/api/metal-quote?symbol=PT&currency=USD
//   Header: X-RapidAPI-Key: <key>
//   Response: { "results": { "mid": 1628.50, ... } }
// Johnson Matthey publishes PGM prices on their own site, but it's a
// webpage, not an open API, so that's not wired in here.
// ---------------------------------------------------------------------------

interface FetchResult {
  platinumUsdPerOz?: number;
  rhodiumUsdPerOz?: number;
  usdEurRate?: number;
  usdIdrRate?: number;
  errors: string[];
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; ThermocouplePricer/1.0)",
  Accept: "application/json",
};

async function fetchFx(): Promise<{ usdEurRate?: number; usdIdrRate?: number; error?: string }> {
  // Primary: open.er-api.com
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
      headers: FETCH_HEADERS,
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.rates?.EUR && json?.rates?.IDR) {
        return { usdEurRate: json.rates.EUR, usdIdrRate: json.rates.IDR };
      }
    }
  } catch {
    // fall through to backup source
  }

  // Backup: frankfurter.app (ECB rates, USD base via ?base=USD)
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,IDR", {
      cache: "no-store",
      headers: FETCH_HEADERS,
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.rates?.EUR && json?.rates?.IDR) {
        return { usdEurRate: json.rates.EUR, usdIdrRate: json.rates.IDR };
      }
    }
    return { error: `FX fetch failed on both sources (backup returned HTTP ${res.status}).` };
  } catch (e) {
    return { error: "FX fetch failed on both primary and backup sources: " + (e as Error).message };
  }
}

async function fetchMetal(symbol: "PT" | "RH", apiKey: string): Promise<{ price?: number; error?: string }> {
  try {
    const res = await fetch(
      `https://metal-sentinel.p.rapidapi.com/api/metal-quote?symbol=${symbol}&currency=USD`,
      {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "metal-sentinel.p.rapidapi.com",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const body = await res.text();
      return { error: `Metal Sentinel ${symbol} returned HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = await res.json();
    const mid = json?.results?.mid;
    if (typeof mid === "number") return { price: mid };
    return { error: `Metal Sentinel ${symbol} response missing results.mid: ${JSON.stringify(json).slice(0, 200)}` };
  } catch (e) {
    return { error: `Metal Sentinel ${symbol} fetch failed: ` + (e as Error).message };
  }
}

export async function fetchLiveRates(): Promise<FetchResult> {
  const errors: string[] = [];
  const result: FetchResult = { errors };

  const fx = await fetchFx();
  if (fx.usdEurRate) result.usdEurRate = fx.usdEurRate;
  if (fx.usdIdrRate) result.usdIdrRate = fx.usdIdrRate;
  if (fx.error) errors.push(fx.error);

  const apiKey = process.env.RHODIUM_API_KEY;
  if (!apiKey) {
    errors.push("Pt/Rh auto-fetch not configured (RHODIUM_API_KEY not set) - enter today's figures manually below.");
  } else {
    const [pt, rh] = await Promise.all([fetchMetal("PT", apiKey), fetchMetal("RH", apiKey)]);
    if (pt.price) result.platinumUsdPerOz = pt.price;
    if (pt.error) errors.push(pt.error);
    if (rh.price) result.rhodiumUsdPerOz = rh.price;
    if (rh.error) errors.push(rh.error);
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
