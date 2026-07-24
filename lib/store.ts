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
  const stored = await getValue<(Record<string, unknown>) | null>(CONFIG_KEY, null);
  if (!stored) return DEFAULT_CONFIG;

  // Migrate configs saved before the market/stock handling-factor split: the
  // old single "wireHandlingFactor" becomes both new fields if present.
  // lengthAllowanceMm was removed in an earlier update and is simply never
  // copied over below.
  const legacyFactor = typeof stored.wireHandlingFactor === "number" ? (stored.wireHandlingFactor as number) : undefined;

  const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

  const merged: PricingConfig = {
    wireHandlingFactorMarket: num(
      stored.wireHandlingFactorMarket,
      legacyFactor ?? DEFAULT_CONFIG.wireHandlingFactorMarket
    ),
    wireHandlingFactorStock: num(
      stored.wireHandlingFactorStock,
      legacyFactor ?? DEFAULT_CONFIG.wireHandlingFactorStock
    ),
    localProfitPct: num(stored.localProfitPct, DEFAULT_CONFIG.localProfitPct),
    exportMarginPct: num(stored.exportMarginPct, DEFAULT_CONFIG.exportMarginPct),
    standardPartsIdr: num(stored.standardPartsIdr, DEFAULT_CONFIG.standardPartsIdr),
    defaultSpoolQtyM: num(stored.defaultSpoolQtyM, DEFAULT_CONFIG.defaultSpoolQtyM),
    stockPrices: Array.isArray(stored.stockPrices)
      ? (stored.stockPrices as PricingConfig["stockPrices"])
      : DEFAULT_CONFIG.stockPrices,
    extras: Array.isArray(stored.extras)
      ? (stored.extras as PricingConfig["extras"])
      : DEFAULT_CONFIG.extras,
  };

  return merged;
}

export async function setConfig(config: PricingConfig): Promise<void> {
  await setValue(CONFIG_KEY, config);
}
