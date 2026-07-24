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
  usdIdrRate: number; // IDR per 1 USD
  updatedAt: string; // ISO timestamp
  source: "auto" | "manual";
}

export interface StockPrice {
  key: string; // "S-0.30" etc
  idrPerMeter: number; // 0 = no stock price held, always use market rate
}

// The +60mm compensates for the extra wire that runs up inside the
// thermocouple head, beyond the length below head (LBH) that's actually
// specified. It's physical, not a business assumption - fixed, not
// admin-editable.
export const HEAD_ALLOWANCE_MM = 60;

export interface PricingConfig {
  wireHandlingFactor: number; // default 1.20
  localProfitPct: number; // default 0.15
  exportMarginPct: number; // default 0.35
  standardPartsIdr: number; // default 1_200_000
  defaultSpoolQtyM: number; // assumed order size per spec, default 10 (-> tier "under25")
  stockPrices: StockPrice[];
}

export const DEFAULT_CONFIG: PricingConfig = {
  wireHandlingFactor: 1.2,
  localProfitPct: 0.15,
  exportMarginPct: 0.35,
  standardPartsIdr: 1_200_000,
  defaultSpoolQtyM: 10,
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
}

export interface QuoteBreakdown {
  spec: WireSpec;
  metalEurPerG: number;
  mfgTier: "under25" | "from25to50" | "from50";
  mfgEurPerG: number;
  totalEurPerG: number;
  marketRatePerMeter: number; // in the DISPLAY currency (IDR local / USD export), after duplex
  duplexMultiplier: number;
  stockRatePerMeter: number | null; // in the DISPLAY currency, if a stock price is held for this spec
  wireRateUsed: number; // whichever of market/stock was chosen, in display currency
  wireRateSource: "market" | "stock"; // decided once in IDR, applied consistently to both local & export
  scaledWireCost: number; // wireRateUsed * handlingFactor * (length+60)/1000 (x2 effectively for duplex)
  afterProfitOrMargin: number;
  standardPartsCost: number;
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

  const marketUsdPerMeter = marketEurPerMeter / rates.usdEurRate;
  // Preserved exactly as in the source workbook: Euro/mtr multiplied
  // directly by the USD/IDR rate rather than converting through USD first.
  const marketIdrPerMeter = marketEurPerMeter * rates.usdIdrRate;

  const duplexMultiplier = input.configuration === "duplex" ? 2 : 1;
  const marketIdrFinal = marketIdrPerMeter * duplexMultiplier;
  const marketUsdFinal = marketUsdPerMeter * duplexMultiplier;

  // Stock is only ever held/priced in IDR, so the "is stock cheaper or
  // pricier than replacing today" decision is always made in IDR - and
  // that SAME decision is then applied whether we're quoting local or
  // export, so both currencies agree on which source was used for a given
  // spec/length/configuration.
  const stock = config.stockPrices.find((s) => s.key === specKey(input.type, input.diameterMm));
  const stockIdrFinal = stock && stock.idrPerMeter > 0 ? stock.idrPerMeter * duplexMultiplier : null;

  const wireRateSource: "market" | "stock" =
    stockIdrFinal !== null && stockIdrFinal > marketIdrFinal ? "stock" : "market";

  const wireRateIdr = wireRateSource === "stock" ? (stockIdrFinal as number) : marketIdrFinal;
  // Convert the CHOSEN idr rate through today's FX rate for export, so a
  // "stock" decision shows consistently in USD too, at the going rate.
  const wireRateUsd = wireRateSource === "stock" ? wireRateIdr / rates.usdIdrRate : marketUsdFinal;

  const marketRatePerMeter = input.target === "local" ? marketIdrFinal : marketUsdFinal;
  const stockRatePerMeter =
    stockIdrFinal === null ? null : input.target === "local" ? stockIdrFinal : stockIdrFinal / rates.usdIdrRate;
  const wireRateUsed = input.target === "local" ? wireRateIdr : wireRateUsd;

  // Scale to the actual finished-item length. The +60mm head allowance is
  // physical (extra wire routed inside the head) and applies per wire run -
  // for duplex that's two wire runs, each needing its own +60mm, which is
  // exactly what the x2 duplexMultiplier above already achieves together
  // with this per-run length term.
  const scaledWireCost =
    wireRateUsed * config.wireHandlingFactor * ((input.lengthBelowHeadMm + HEAD_ALLOWANCE_MM) / 1000);

  let afterProfitOrMargin: number;
  let standardPartsCost: number;
  if (input.target === "local") {
    afterProfitOrMargin = scaledWireCost * (1 + config.localProfitPct);
    standardPartsCost = config.standardPartsIdr;
  } else {
    afterProfitOrMargin = scaledWireCost / (1 - config.exportMarginPct);
    standardPartsCost = config.standardPartsIdr / rates.usdIdrRate;
  }

  const finalPrice = afterProfitOrMargin + standardPartsCost;

  return {
    spec,
    metalEurPerG,
    mfgTier,
    mfgEurPerG,
    totalEurPerG,
    marketRatePerMeter,
    duplexMultiplier,
    stockRatePerMeter,
    wireRateUsed,
    wireRateSource,
    scaledWireCost,
    afterProfitOrMargin,
    standardPartsCost,
    finalPrice,
    currency: input.target === "local" ? "IDR" : "USD",
  };
}
