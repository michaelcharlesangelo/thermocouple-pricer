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
  usdEurRate: number; // EUR per 1 USD  (e.g. 0.8748)
  usdIdrRate: number; // IDR per 1 USD  (klikBCA "kurs jual")
  updatedAt: string; // ISO timestamp
  source: "auto" | "manual";
}

export interface ExtraItem {
  id: string;
  name: string;
  priceIdr: number; // added to LOCAL price, 0 if not applicable
  priceUsd: number; // added to EXPORT price, 0 if not applicable
}

export interface StockPrice {
  key: string; // "S-0.30" etc
  idrPerMeter: number; // 0 = no stock price held, always use market rate
}

export interface PricingConfig {
  wireHandlingFactor: number; // "Table + X%" -> stored as multiplier, default 1.20
  lengthAllowanceMm: number; // the "+60" added to LBH length, default 60
  localProfitPct: number; // default 0.15
  exportMarginPct: number; // default 0.35
  standardPartsIdr: number; // default 1_200_000
  defaultSpoolQtyM: number; // assumed order size per spec, default 10 (-> tier "under25")
  extras: ExtraItem[];
  stockPrices: StockPrice[];
}

export const DEFAULT_CONFIG: PricingConfig = {
  wireHandlingFactor: 1.2,
  lengthAllowanceMm: 60,
  localProfitPct: 0.15,
  exportMarginPct: 0.35,
  standardPartsIdr: 1_200_000,
  defaultSpoolQtyM: 10,
  extras: [
    { id: "flange", name: "Flange", priceIdr: 500_000, priceUsd: 0 },
    { id: "sic", name: "Silicon Carbide (SiC) protection tube", priceIdr: 0, priceUsd: 200 },
  ],
  stockPrices: [
    { key: "S-0.30", idrPerMeter: 4_463_240 },
    { key: "S-0.40", idrPerMeter: 7_779_057 },
    { key: "S-0.50", idrPerMeter: 12_109_978 },
    { key: "R-0.30", idrPerMeter: 2_464_406 },
    { key: "R-0.40", idrPerMeter: 7_562_310 },
    { key: "R-0.50", idrPerMeter: 11_825_935 },
    { key: "B-0.30", idrPerMeter: 0 },
    { key: "B-0.40", idrPerMeter: 0 },
    { key: "B-0.50", idrPerMeter: 0 },
  ],
};

export interface QuoteInput {
  type: ThermocoupleType;
  diameterMm: number;
  lengthBelowHeadMm: number;
  configuration: "simplex" | "duplex";
  spoolQtyM?: number; // overrides config.defaultSpoolQtyM, affects manufacturing tier
  target: "local" | "export";
  extraIds: string[];
}

export interface QuoteBreakdown {
  spec: WireSpec;
  metalEurPerG: number;
  mfgTier: "under25" | "from25to50" | "from50";
  mfgEurPerG: number;
  totalEurPerG: number;
  marketEurPerMeter: number;
  marketRatePerMeter: number; // IDR (local) or USD (export), before duplex
  duplexMultiplier: number;
  marketRateFinal: number; // after duplex multiplier
  stockRatePerMeter: number | null; // only meaningful for local
  wireRateUsed: number; // max(market, stock)
  wireRateSource: "market" | "stock";
  scaledWireCost: number; // wireRateUsed * handlingFactor * (length+allowance)/1000
  afterProfitOrMargin: number;
  standardPartsCost: number;
  extrasCost: number;
  extrasApplied: ExtraItem[];
  finalPrice: number;
  currency: "IDR" | "USD";
}

// ---------------------------------------------------------------------------
// Core calculation, ported from the Excel formulas
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

  // Precious metal price per gram of alloy, in EUR (Excel col E)
  const ptEurPerG = (rates.platinumUsdPerOz * rates.usdEurRate) / TROY_OUNCE_IN_GRAMS;
  const rhEurPerG = (rates.rhodiumUsdPerOz * rates.usdEurRate) / TROY_OUNCE_IN_GRAMS;
  const metalEurPerG =
    alloy.ptFraction * ptEurPerG * METAL_PRICE_CORRECTION +
    alloy.rhFraction * rhEurPerG * METAL_PRICE_CORRECTION;

  // Manufacturing tier, based on assumed spool/order quantity (Excel col F/G/H selected by K)
  const spoolQty = input.spoolQtyM ?? config.defaultSpoolQtyM;
  const mfgTier: QuoteBreakdown["mfgTier"] =
    spoolQty < 25 ? "under25" : spoolQty < 50 ? "from25to50" : "from50";
  const mfgEurPerG = spec.mfgTierEurPerG[mfgTier];

  const totalEurPerG = metalEurPerG + mfgEurPerG; // Excel col I
  const marketEurPerMeter = totalEurPerG * spec.gramsPerMeter; // Excel col AC (Euro/mtr)

  const usdPerMeter = marketEurPerMeter / rates.usdEurRate; // Excel col AD
  // NOTE: preserved exactly as in the source workbook, which multiplies the
  // Euro/mtr figure directly by the USD/IDR rate (col AE = AC * AG6) rather
  // than converting through USD first. Kept for parity with existing sold
  // prices; flag to Michael if this should instead go via USD/mtr.
  const idrPerMeter = marketEurPerMeter * rates.usdIdrRate; // Excel col AE

  const marketRatePerMeter = input.target === "local" ? idrPerMeter : usdPerMeter;

  const duplexMultiplier = input.configuration === "duplex" ? 2 : 1;
  const marketRateFinal = marketRatePerMeter * duplexMultiplier;

  // Stock price comparison (local only - take the higher of today's market vs held stock)
  let stockRatePerMeter: number | null = null;
  let wireRateUsed = marketRateFinal;
  let wireRateSource: "market" | "stock" = "market";
  if (input.target === "local") {
    const stock = config.stockPrices.find((s) => s.key === specKey(input.type, input.diameterMm));
    if (stock && stock.idrPerMeter > 0) {
      stockRatePerMeter = stock.idrPerMeter * duplexMultiplier;
      if (stockRatePerMeter > marketRateFinal) {
        wireRateUsed = stockRatePerMeter;
        wireRateSource = "stock";
      }
    }
  }

  // Scale to the actual finished-item length (Excel: (Z+60)/1000 * factor)
  const scaledWireCost =
    wireRateUsed *
    config.wireHandlingFactor *
    ((input.lengthBelowHeadMm + config.lengthAllowanceMm) / 1000);

  let afterProfitOrMargin: number;
  let standardPartsCost: number;
  if (input.target === "local") {
    afterProfitOrMargin = scaledWireCost * (1 + config.localProfitPct);
    standardPartsCost = config.standardPartsIdr;
  } else {
    afterProfitOrMargin = scaledWireCost / (1 - config.exportMarginPct);
    standardPartsCost = config.standardPartsIdr / rates.usdIdrRate;
  }

  const extrasApplied = config.extras.filter((e) => input.extraIds.includes(e.id));
  const extrasCost = extrasApplied.reduce(
    (sum, e) => sum + (input.target === "local" ? e.priceIdr : e.priceUsd),
    0
  );

  const finalPrice = afterProfitOrMargin + standardPartsCost + extrasCost;

  return {
    spec,
    metalEurPerG,
    mfgTier,
    mfgEurPerG,
    totalEurPerG,
    marketEurPerMeter,
    marketRatePerMeter,
    duplexMultiplier,
    marketRateFinal,
    stockRatePerMeter,
    wireRateUsed,
    wireRateSource,
    scaledWireCost,
    afterProfitOrMargin,
    standardPartsCost,
    extrasCost,
    extrasApplied,
    finalPrice,
    currency: input.target === "local" ? "IDR" : "USD",
  };
}
