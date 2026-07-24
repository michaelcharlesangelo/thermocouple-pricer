import { getSupabaseServerClient } from "./supabaseClient";
import { MarketRates, PricingConfig, DEFAULT_CONFIG } from "./pricing";

const RATES_KEY = "thermocouple:rates";
const CONFIG_KEY = "thermocouple:config";

const DEFAULT_RATES: MarketRates = {
  platinumUsdPerOz: 1628,
  rhodiumUsdPerOz: 8800,
  usdEurRate: 0.8748,
  usdIdrRate: 17973,
  updatedAt: new Date(0).toISOString(),
  source: "manual",
};

async function getValue<T>(key: string, fallback: T): Promise<T> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("app_kv").select("value").eq("key", key).maybeSingle();
  if (error) {
    throw new Error(`Supabase read failed for ${key}: ${error.message}`);
  }
  return (data?.value as T) ?? fallback;
}

async function setValue<T>(key: string, value: T): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("app_kv")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    throw new Error(`Supabase write failed for ${key}: ${error.message}`);
  }
}

export async function getRates(): Promise<MarketRates> {
  return getValue(RATES_KEY, DEFAULT_RATES);
}

export async function setRates(rates: MarketRates): Promise<void> {
  await setValue(RATES_KEY, rates);
}

export async function getConfig(): Promise<PricingConfig> {
  const stored = await getValue<Record<string, unknown> | null>(CONFIG_KEY, null);
  if (!stored) return DEFAULT_CONFIG;

  // Migrate configs saved before this update: the old single
  // "wireHandlingFactor" becomes both new market/stock factors if present,
  // and any now-removed fields (lengthAllowanceMm, extras) are simply
  // dropped. Anything not present in the stored data falls back to
  // DEFAULT_CONFIG so old saves don't break on the new fields.
  const legacyFactor = typeof stored.wireHandlingFactor === "number" ? stored.wireHandlingFactor : undefined;

  const merged: PricingConfig = {
    ...DEFAULT_CONFIG,
    ...stored,
    wireHandlingFactorMarket:
      (stored.wireHandlingFactorMarket as number | undefined) ??
      legacyFactor ??
      DEFAULT_CONFIG.wireHandlingFactorMarket,
    wireHandlingFactorStock:
      (stored.wireHandlingFactorStock as number | undefined) ??
      legacyFactor ??
      DEFAULT_CONFIG.wireHandlingFactorStock,
    stockPrices: Array.isArray(stored.stockPrices) ? (stored.stockPrices as PricingConfig["stockPrices"]) : DEFAULT_CONFIG.stockPrices,
  };
  // Drop any leftover legacy keys so they don't linger in what gets saved next
  delete (merged as Record<string, unknown>).wireHandlingFactor;
  delete (merged as Record<string, unknown>).lengthAllowanceMm;
  delete (merged as Record<string, unknown>).extras;

  return merged;
}

export async function setConfig(config: PricingConfig): Promise<void> {
  await setValue(CONFIG_KEY, config);
}
