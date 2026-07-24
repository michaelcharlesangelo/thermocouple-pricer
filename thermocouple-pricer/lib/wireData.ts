// Master wire data, extracted directly from the original Excel workbook
// "NEW Price list - Tempsens" (SAFINA a.s.), rows 10-36.
//
// D  = grams of Pt/Rh alloy per metre of wire ("g / doublemeter")
// F  = manufacturing price (EUR/g) for orders < 25 metres of that spec
// G  = manufacturing price (EUR/g) for orders 25 - 49.9 metres
// H  = manufacturing price (EUR/g) for orders >= 50 metres
//
// Alloy composition (Pt fraction / Rh fraction) comes from the Excel
// formulas in column E for each type block.

export type ThermocoupleType = "S" | "R" | "B";

export interface WireSpec {
  type: ThermocoupleType;
  diameterMm: number;
  alloyName: string;
  gramsPerMeter: number; // column D
  mfgTierEurPerG: { under25: number; from25to50: number; from50: number }; // F/G/H
}

export const ALLOY_COMPOSITION: Record<ThermocoupleType, { ptFraction: number; rhFraction: number; name: string }> = {
  S: { ptFraction: 0.95, rhFraction: 0.05, name: "Pt - PtRh10" },
  R: { ptFraction: 0.935, rhFraction: 0.065, name: "Pt - PtRh13" },
  B: { ptFraction: 0.82, rhFraction: 0.18, name: "PtRh6 - PtRh30" },
};

// Small correction factor applied to metal price in the original sheet (0.45%)
export const METAL_PRICE_CORRECTION = 1.0045;

export const WIRE_TABLE: WireSpec[] = [
  // --- S type ---
  { type: "S", diameterMm: 0.10, alloyName: "Pt - PtRh10", gramsPerMeter: 0.33, mfgTierEurPerG: { under25: 56.59, from25to50: 31.86, from50: 17.67 } },
  { type: "S", diameterMm: 0.20, alloyName: "Pt - PtRh10", gramsPerMeter: 1.30, mfgTierEurPerG: { under25: 12.48, from25to50: 7.65, from50: 4.83 } },
  { type: "S", diameterMm: 0.30, alloyName: "Pt - PtRh10", gramsPerMeter: 2.93, mfgTierEurPerG: { under25: 6.42, from25to50: 4.32, from50: 3.07 } },
  { type: "S", diameterMm: 0.35, alloyName: "Pt - PtRh10", gramsPerMeter: 3.99, mfgTierEurPerG: { under25: 4.64, from25to50: 3.34, from50: 2.54 } },
  { type: "S", diameterMm: 0.40, alloyName: "Pt - PtRh10", gramsPerMeter: 5.21, mfgTierEurPerG: { under25: 3.89, from25to50: 2.93, from50: 2.31 } },
  { type: "S", diameterMm: 0.45, alloyName: "Pt - PtRh10", gramsPerMeter: 6.59, mfgTierEurPerG: { under25: 3.40, from25to50: 2.65, from50: 2.16 } },
  { type: "S", diameterMm: 0.50, alloyName: "Pt - PtRh10", gramsPerMeter: 8.14, mfgTierEurPerG: { under25: 2.82, from25to50: 2.33, from50: 2.00 } },
  { type: "S", diameterMm: 0.70, alloyName: "Pt - PtRh10", gramsPerMeter: 15.80, mfgTierEurPerG: { under25: 2.16, from25to50: 1.95, from50: 1.78 } },
  { type: "S", diameterMm: 0.80, alloyName: "Pt - PtRh10", gramsPerMeter: 20.83, mfgTierEurPerG: { under25: 1.99, from25to50: 1.86, from50: 1.73 } },

  // --- R type ---
  { type: "R", diameterMm: 0.30, alloyName: "Pt - PtRh13", gramsPerMeter: 2.90, mfgTierEurPerG: { under25: 3.50, from25to50: 4.37, from50: 3.07 } },
  { type: "R", diameterMm: 0.35, alloyName: "Pt - PtRh13", gramsPerMeter: 3.95, mfgTierEurPerG: { under25: 4.75, from25to50: 3.43, from50: 2.62 } },
  { type: "R", diameterMm: 0.40, alloyName: "Pt - PtRh13", gramsPerMeter: 5.16, mfgTierEurPerG: { under25: 3.93, from25to50: 2.93, from50: 2.30 } },
  { type: "R", diameterMm: 0.45, alloyName: "Pt - PtRh13", gramsPerMeter: 6.53, mfgTierEurPerG: { under25: 4.00, from25to50: 2.74, from50: 2.25 } },
  { type: "R", diameterMm: 0.50, alloyName: "Pt - PtRh13", gramsPerMeter: 8.06, mfgTierEurPerG: { under25: 2.91, from25to50: 2.42, from50: 2.08 } },
  { type: "R", diameterMm: 0.70, alloyName: "Pt - PtRh13", gramsPerMeter: 15.80, mfgTierEurPerG: { under25: 2.24, from25to50: 2.04, from50: 1.86 } },
  { type: "R", diameterMm: 0.75, alloyName: "Pt - PtRh13", gramsPerMeter: 18.30, mfgTierEurPerG: { under25: 2.15, from25to50: 1.98, from50: 1.83 } },
  { type: "R", diameterMm: 0.80, alloyName: "Pt - PtRh13", gramsPerMeter: 20.63, mfgTierEurPerG: { under25: 2.07, from25to50: 1.94, from50: 1.81 } },

  // --- B type ---
  { type: "B", diameterMm: 0.30, alloyName: "PtRh6 - PtRh30", gramsPerMeter: 2.70, mfgTierEurPerG: { under25: 7.83, from25to50: 5.38, from50: 2.60 } },
  { type: "B", diameterMm: 0.35, alloyName: "PtRh6 - PtRh30", gramsPerMeter: 3.67, mfgTierEurPerG: { under25: 5.92, from25to50: 4.43, from50: 3.50 } },
  { type: "B", diameterMm: 0.40, alloyName: "PtRh6 - PtRh30", gramsPerMeter: 4.79, mfgTierEurPerG: { under25: 5.92, from25to50: 4.43, from50: 3.50 } },
  { type: "B", diameterMm: 0.45, alloyName: "PtRh6 - PtRh30", gramsPerMeter: 6.07, mfgTierEurPerG: { under25: 4.47, from25to50: 3.63, from50: 3.07 } },
  { type: "B", diameterMm: 0.50, alloyName: "PtRh6 - PtRh30", gramsPerMeter: 7.49, mfgTierEurPerG: { under25: 3.80, from25to50: 3.27, from50: 2.88 } },
  { type: "B", diameterMm: 0.60, alloyName: "PtRh6 - PtRh30", gramsPerMeter: 10.79, mfgTierEurPerG: { under25: 3.32, from25to50: 3.00, from50: 2.72 } },
  { type: "B", diameterMm: 0.70, alloyName: "PtRh6 - PtRh30", gramsPerMeter: 14.68, mfgTierEurPerG: { under25: 3.03, from25to50: 2.83, from50: 2.63 } },
  { type: "B", diameterMm: 0.80, alloyName: "PtRh6 - PtRh30", gramsPerMeter: 19.18, mfgTierEurPerG: { under25: 2.85, from25to50: 2.73, from50: 2.57 } },
];

export function findWireSpec(type: ThermocoupleType, diameterMm: number): WireSpec | undefined {
  return WIRE_TABLE.find((w) => w.type === type && Math.abs(w.diameterMm - diameterMm) < 1e-6);
}

export function specKey(type: ThermocoupleType, diameterMm: number): string {
  return `${type}-${diameterMm.toFixed(2)}`;
}
