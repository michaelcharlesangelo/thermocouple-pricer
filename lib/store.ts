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
  return getValue(CONFIG_KEY, DEFAULT_CONFIG);
}

export async function setConfig(config: PricingConfig): Promise<void> {
  await setValue(CONFIG_KEY, config);
}
