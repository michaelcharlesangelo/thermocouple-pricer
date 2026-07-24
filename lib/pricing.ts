import {
  ALLOY_COMPOSITION,
  METAL_PRICE_CORRECTION,
  ThermocoupleType,
  WireSpec,
  findWireSpec,
  specKey,
} from "./wireData";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketRates {
  platinumUsdPerOz: number;
  rhodiumUsdPerOz: number;
  metalUpdatedAt: string; // ISO timestamp - only changes when admin saves Pt/Rh
  usdEurRate: number; // EUR per 1 USD
  usdIdrRate: number; // IDR per 1 USD
  fxUpdatedAt: string; // ISO timestamp - changes on FX refresh or manual FX save
  fxSource: "auto" | "manual";
}

export interface StockPrice {
  key: string; // "S-0.30" etc
  idrPerMeter: number; // 0 = no stock price held, always use market rate
}

export interface ExtraItem {
  id: string;
  name: string;
  priceIdr: number; // added to LOCAL price, 0 if not applicable
  priceUsd: number; // added to EXPORT price, 0 if not applicable
}

// The +60mm compensates for the extra wire that runs up inside the
// thermocouple head, beyond the length below head (LBH) that's actually
// specified. It's physical, not a business assumption - fixed, not
// admin-editable. Applied per wire run (duplex = two runs = two allowances).
export const HEAD_ALLOWANCE_MM = 60;

export interface PricingConfig {
  wireHandlingFactorMarket: number; // multiplier applied when using today's market wire price, default 1.20
  wireHandlingFactorStock: number; // multiplier applied when using held stock wire price, default 1.20 (set to 1 for "no added" or 0 if truly none)
  localProfitPct: number; // default 0.15
  exportMarginPct: number; // default 0.35
  standardPartsIdr: number; // default 1_200_000
  defaultSpoolQtyM: number; // assumed order size per spec, default 10 (-> tier "under25")
  stockPrices: StockPrice[];
  extras: ExtraItem[];
}

export const DEFAULT_CONFIG: PricingConfig = {
  wireHandlingFactorMarket: 1.2,
  wireHandlingFactorStock: 1.2,
  localProfitPct: 0.15,
  exportMarginPct: 0.35,
  standardPartsIdr: 1_200_000,
  defaultSpoolQtyM: 10,
  stockPrices: [
    { key: "S-0.30", idrPerMeter: 4_463_240 },
    { key: "S-0.35", idrPerMeter: 0 },
    { key: "S-0.40", idrPerMeter: 7_779_057 },
    { key: "S-0.45", idrPerMeter: 0 },
    { key: "S-0.50", idrPerMeter: 12_109_978 },
    { key: "R-0.30", idrPerMeter: 2_464_406 },
    { key: "R-0.35", idrPerMeter: 0 },
    { key: "R-0.40", idrPerMeter: 7_562_310 },
    { key: "R-0.45", idrPerMeter: 0 },
    { key: "R-0.50", idrPerMeter: 11_825_935 },
    { key: "B-0.30", idrPerMeter: 0 },
    { key: "B-0.35", idrPerMeter: 0 },
    { key: "B-0.40", idrPerMeter: 0 },
    { key: "B-0.45", idrPerMeter: 0 },
    { key: "B-0.50", idrPerMeter: 0 },
  ],
  extras: [
    { id: "flange", name: "Flange", priceIdr: 500_000, priceUsd: 0 },
    { id: "sic", name: "Silicon Carbide (SiC) protection tube", priceIdr: 0, priceUsd: 200 },
  ],
};

export interface QuoteInput {
  type: ThermocoupleType;
  diameterMm: number;
  lengthBelowHeadMm: number;
  configuration: "simplex" | "duplex";
  spoolQtyM?: number; // overrides config.defaultSpoolQtyM, affects manufacturing tier
  target: "local" | "export";
  extraIds: string[]; // which configured extras (from admin) are selected
  customExtra?: { label: string; amount: number }; // one-off item typed in on the calculator, not saved
}

export interface QuoteBreakdown {
  spec: WireSpec;
  metalEurPerG: number;
  mfgTier: "under25" | "from25to50" | "from50";
  mfgEurPerG: number;
  totalEurPerG: number;
  marketRatePerMeter: number; // per meter, SIMPLEX basis, in display currency - for reference only
  stockRatePerMeter: number | null; // per meter, SIMPLEX basis, in display currency, if held
  wireRateSource: "market" | "stock"; // decided once in IDR, applied consistently to local & export
  handlingFactorUsed: number; // whichever of market/stock factor applies
  duplexMultiplier: number;
  scaledWireCost: number; // full item cost: rate x handling factor x (length+60)/1000, x2 runs if duplex
  afterProfitOrMargin: number;
  standardPartsCost: number;
  extrasApplied: ExtraItem[];
  customExtra: { label: string; amount: number } | null;
  extrasCost: number;
  finalPrice: number;
  currency: "IDR" | "USD";
}

// ---------------------------------------------------------------------------
// Core calculation
// ---------------------------------------------------------------------------

const TROY_OUNCE_IN_GRAMS = 31.1035;

export function calculateQuote(
  input: QuoteInput,
  rates: MarketRates,
  config: PricingConfig
): QuoteBreakdown {
  const spec = findWireSpec(input.type, input.diameterMm);
  if (!spec) {
    throw new Error(`No wire spec found for ${input.type} ${input.diameterMm}mm`);
  }

  const alloy = ALLOY_COMPOSITION[input.type];

  const ptEurPerG = (rates.platinumUsdPerOz * rates.usdEurRate) / TROY_OUNCE_IN_GRAMS;
  const rhEurPerG = (rates.rhodiumUsdPerOz * rates.usdEurRate) / TROY_OUNCE_IN_GRAMS;
  const metalEurPerG =
    alloy.ptFraction * ptEurPerG * METAL_PRICE_CORRECTION +
    alloy.rhFraction * rhEurPerG * METAL_PRICE_CORRECTION;

  const spoolQty = input.spoolQtyM ?? config.defaultSpoolQtyM;
  const mfgTier: QuoteBreakdown["mfgTier"] =
    spoolQty < 25 ? "under25" : spoolQty < 50 ? "from25to50" : "from50";
  const mfgEurPerG = spec.mfgTierEurPerG[mfgTier];

  const totalEurPerG = metalEurPerG + mfgEurPerG;
  const marketEurPerMeter = totalEurPerG * spec.gramsPerMeter;

  // These are all SIMPLEX (single wire run) per-meter figures - duplex is
  // applied later, only to the final scaled cost, so the "per meter" numbers
  // shown to the sales team always mean one wire, regardless of configuration.
  const marketUsdPerMeterSimplex = marketEurPerMeter / rates.usdEurRate;
  // Preserved exactly as in the source workbook: Euro/mtr multiplied
  // directly by the USD/IDR rate rather than converting through USD first.
  const marketIdrPerMeterSimplex = marketEurPerMeter * rates.usdIdrRate;

  // Stock is only ever held/priced in IDR, so the "is stock cheaper or
  // pricier than replacing today" decision is always made in IDR - and that
  // SAME decision is applied whether quoting local or export, so both
  // currencies agree on which source was used for a given spec/length.
  const stock = config.stockPrices.find((s) => s.key === specKey(input.type, input.diameterMm));
  const stockIdrPerMeterSimplex = stock && stock.idrPerMeter > 0 ? stock.idrPerMeter : null;

  const wireRateSource: "market" | "stock" =
    stockIdrPerMeterSimplex !== null && stockIdrPerMeterSimplex > marketIdrPerMeterSimplex ? "stock" : "market";

  const wireIdrPerMeterSimplex =
    wireRateSource === "stock" ? (stockIdrPerMeterSimplex as number) : marketIdrPerMeterSimplex;
  const wireUsdPerMeterSimplex =
    wireRateSource === "stock" ? wireIdrPerMeterSimplex / rates.usdIdrRate : marketUsdPerMeterSimplex;

  const marketRatePerMeter = input.target === "local" ? marketIdrPerMeterSimplex : marketUsdPerMeterSimplex;
  const stockRatePerMeter =
    stockIdrPerMeterSimplex === null
      ? null
      : input.target === "local"
      ? stockIdrPerMeterSimplex
      : stockIdrPerMeterSimplex / rates.usdIdrRate;

  const wireRateUsedPerMeter = input.target === "local" ? wireIdrPerMeterSimplex : wireUsdPerMeterSimplex;
  const handlingFactorUsed =
    wireRateSource === "stock" ? config.wireHandlingFactorStock : config.wireHandlingFactorMarket;

  const duplexMultiplier = input.configuration === "duplex" ? 2 : 1;

  // Scale to the actual finished-item length: rate x handling factor x
  // (length+60mm)/1000 per wire run, x2 runs for duplex.
  const scaledWireCost =
    wireRateUsedPerMeter *
    handlingFactorUsed *
    ((input.lengthBelowHeadMm + HEAD_ALLOWANCE_MM) / 1000) *
    duplexMultiplier;

  let afterProfitOrMargin: number;
  let standardPartsCost: number;
  if (input.target === "local") {
    afterProfitOrMargin = scaledWireCost * (1 + config.localProfitPct);
    standardPartsCost = config.standardPartsIdr;
  } else {
    afterProfitOrMargin = scaledWireCost / (1 - config.exportMarginPct);
    // Standard parts price is fixed in Rupiah; converted to USD at today's
    // USD/IDR rate for the export quote.
    standardPartsCost = config.standardPartsIdr / rates.usdIdrRate;
  }

  const finalPriceBeforeExtras = afterProfitOrMargin + standardPartsCost;

  const extrasApplied = config.extras.filter((e) => input.extraIds.includes(e.id));
  const configuredExtrasCost = extrasApplied.reduce(
    (sum, e) => sum + (input.target === "local" ? e.priceIdr : e.priceUsd),
    0
  );
  const customExtra = input.customExtra && input.customExtra.amount > 0 ? input.customExtra : null;
  const extrasCost = configuredExtrasCost + (customExtra?.amount ?? 0);

  const finalPrice = finalPriceBeforeExtras + extrasCost;

  return {
    spec,
    metalEurPerG,
    mfgTier,
    mfgEurPerG,
    totalEurPerG,
    marketRatePerMeter,
    stockRatePerMeter,
    wireRateSource,
    handlingFactorUsed,
    duplexMultiplier,
    scaledWireCost,
    afterProfitOrMargin,
    standardPartsCost,
    extrasApplied,
    customExtra,
    extrasCost,
    finalPrice,
    currency: input.target === "local" ? "IDR" : "USD",
  };
}
