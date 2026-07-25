import { getSupabaseServerClient } from "./supabaseClient";
import { MarketRates, PricingConfig, DEFAULT_CONFIG } from "./pricing";
import { StockData, DEFAULT_STOCK, WireRoll, CutRecord } from "./stock";
import { TeamLoginLogs, DEFAULT_TEAM_LOGS, MAX_LOG_ENTRIES } from "./teamLogs";

const RATES_KEY = "thermocouple:rates";
const CONFIG_KEY = "thermocouple:config";
const STOCK_KEY = "thermocouple:stock";

const DEFAULT_RATES: MarketRates = {
  platinumUsdPerOz: 1628,
  rhodiumUsdPerOz: 8800,
  metalUpdatedAt: new Date(0).toISOString(),
  usdEurRate: 0.8748,
  usdIdrRate: 17973,
  fxUpdatedAt: new Date(0).toISOString(),
  fxSource: "manual",
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
  const stored = await getValue<Record<string, unknown> | null>(RATES_KEY, null);
  if (!stored) return DEFAULT_RATES;

  // Migrate rates saved before the metal/FX timestamp split: the old single
  // "updatedAt"/"source" becomes both new pairs if present, so existing data
  // isn't lost - it's just treated as having applied to both at once.
  const legacyUpdatedAt = typeof stored.updatedAt === "string" ? stored.updatedAt : undefined;
  const legacySource = stored.source === "auto" || stored.source === "manual" ? stored.source : undefined;

  const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
  const str = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);

  return {
    platinumUsdPerOz: num(stored.platinumUsdPerOz, DEFAULT_RATES.platinumUsdPerOz),
    rhodiumUsdPerOz: num(stored.rhodiumUsdPerOz, DEFAULT_RATES.rhodiumUsdPerOz),
    metalUpdatedAt: str(stored.metalUpdatedAt, legacyUpdatedAt ?? DEFAULT_RATES.metalUpdatedAt),
    usdEurRate: num(stored.usdEurRate, DEFAULT_RATES.usdEurRate),
    usdIdrRate: num(stored.usdIdrRate, DEFAULT_RATES.usdIdrRate),
    fxUpdatedAt: str(stored.fxUpdatedAt, legacyUpdatedAt ?? DEFAULT_RATES.fxUpdatedAt),
    fxSource: (stored.fxSource as "auto" | "manual" | undefined) ?? legacySource ?? DEFAULT_RATES.fxSource,
  };
}

export async function setRates(rates: MarketRates): Promise<void> {
  await setValue(RATES_KEY, rates);
}

// Updates only the metal (Pt/Rh) fields, leaving FX fields exactly as
// currently stored - always admin-entered, never touched by FX refresh.
export async function setMetalRates(platinumUsdPerOz: number, rhodiumUsdPerOz: number): Promise<MarketRates> {
  const current = await getRates();
  const updated: MarketRates = {
    ...current,
    platinumUsdPerOz,
    rhodiumUsdPerOz,
    metalUpdatedAt: new Date().toISOString(),
  };
  await setRates(updated);
  return updated;
}

// Updates only the FX fields, leaving Pt/Rh fields exactly as currently
// stored. `source` distinguishes a manual admin entry from an auto-refresh.
export async function setFxRates(
  usdEurRate: number,
  usdIdrRate: number,
  source: "auto" | "manual"
): Promise<MarketRates> {
  const current = await getRates();
  const updated: MarketRates = {
    ...current,
    usdEurRate,
    usdIdrRate,
    fxUpdatedAt: new Date().toISOString(),
    fxSource: source,
  };
  await setRates(updated);
  return updated;
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
    configUpdatedAt: typeof stored.configUpdatedAt === "string" ? stored.configUpdatedAt : DEFAULT_CONFIG.configUpdatedAt,
  };

  return merged;
}

export async function setConfig(config: PricingConfig): Promise<void> {
  await setValue(CONFIG_KEY, config);
}

// ---------------------------------------------------------------------------
// Wire roll inventory
// ---------------------------------------------------------------------------

export async function getStock(): Promise<StockData> {
  return getValue(STOCK_KEY, DEFAULT_STOCK);
}

export async function addRoll(input: {
  id: string;
  type: WireRoll["type"];
  diameterMm: number;
  totalLengthM: number;
}): Promise<StockData> {
  const stock = await getStock();
  if (stock.rolls.some((r) => r.id === input.id)) {
    throw new Error(`A roll with serial number "${input.id}" already exists.`);
  }
  const newRoll: WireRoll = {
    id: input.id,
    type: input.type,
    diameterMm: input.diameterMm,
    totalLengthM: input.totalLengthM,
    remainingLengthM: input.totalLengthM,
    createdAt: new Date().toISOString(),
    history: [],
  };
  const updated: StockData = { rolls: [...stock.rolls, newRoll] };
  await setValue(STOCK_KEY, updated);
  return updated;
}

export async function recordCut(rollId: string, cutLengthM: number, jobOrder: string): Promise<StockData> {
  const stock = await getStock();
  const roll = stock.rolls.find((r) => r.id === rollId);
  if (!roll) {
    throw new Error(`Roll "${rollId}" not found.`);
  }
  if (cutLengthM <= 0) {
    throw new Error("Cut length must be greater than 0.");
  }
  if (cutLengthM > roll.remainingLengthM) {
    throw new Error(
      `Cut length (${cutLengthM}m) exceeds what's remaining on this roll (${roll.remainingLengthM}m).`
    );
  }
  const cut: CutRecord = {
    id: "cut_" + Date.now(),
    cutLengthM,
    jobOrder,
    cutAt: new Date().toISOString(),
  };
  const updatedRolls = stock.rolls.map((r) =>
    r.id === rollId
      ? { ...r, remainingLengthM: r.remainingLengthM - cutLengthM, history: [...r.history, cut] }
      : r
  );
  const updated: StockData = { rolls: updatedRolls };
  await setValue(STOCK_KEY, updated);
  return updated;
}

export async function deleteRoll(rollId: string): Promise<StockData> {
  const stock = await getStock();
  const updated: StockData = { rolls: stock.rolls.filter((r) => r.id !== rollId) };
  await setValue(STOCK_KEY, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Admin password (in addition to the ADMIN_PASSWORD env var, which always
// works as a recovery fallback - see lib/auth.ts / app/api/admin/*)
// ---------------------------------------------------------------------------

const ADMIN_AUTH_KEY = "thermocouple:adminAuth";

export async function getAdminPasswordHash(): Promise<string | null> {
  const stored = await getValue<{ passwordHash: string } | null>(ADMIN_AUTH_KEY, null);
  return stored?.passwordHash ?? null;
}

export async function setAdminPasswordHash(passwordHash: string): Promise<void> {
  await setValue(ADMIN_AUTH_KEY, { passwordHash, updatedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Team (view-only) password - separate from the admin password, so it can
// be shared with sales without exposing the admin controls. Has a default
// (see lib/auth.ts) so it works before anyone's changed it.
// ---------------------------------------------------------------------------

const TEAM_AUTH_KEY = "thermocouple:teamAuth";

export async function getTeamPasswordHash(): Promise<string | null> {
  const stored = await getValue<{ passwordHash: string } | null>(TEAM_AUTH_KEY, null);
  return stored?.passwordHash ?? null;
}

export async function setTeamPasswordHash(passwordHash: string): Promise<void> {
  await setValue(TEAM_AUTH_KEY, { passwordHash, updatedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Team login logs - who entered the calculator/stock page and when.
// Auto-capped at MAX_LOG_ENTRIES (oldest dropped) so it never needs manual
// cleanup just to stay a reasonable size.
// ---------------------------------------------------------------------------

const TEAM_LOGS_KEY = "thermocouple:teamLogs";

export async function getTeamLogs(): Promise<TeamLoginLogs> {
  return getValue(TEAM_LOGS_KEY, DEFAULT_TEAM_LOGS);
}

export async function appendTeamLog(name: string): Promise<void> {
  const logs = await getTeamLogs();
  const entry = { id: "log_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8), name, loginAt: new Date().toISOString() };
  const entries = [entry, ...logs.entries].slice(0, MAX_LOG_ENTRIES);
  await setValue(TEAM_LOGS_KEY, { entries });
}

export async function clearTeamLogs(): Promise<void> {
  await setValue(TEAM_LOGS_KEY, DEFAULT_TEAM_LOGS);
}
