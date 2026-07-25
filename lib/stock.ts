import { ThermocoupleType } from "./wireData";

// ---------------------------------------------------------------------------
// Wire roll inventory - tracks physical stock separately from pricing.
// (Not to be confused with "stock price" in pricing.ts, which is the cost
// basis used in quote calculations - this module tracks actual meters
// remaining on physical rolls, serial numbers, and cut history.)
// ---------------------------------------------------------------------------

export interface CutRecord {
  id: string;
  cutLengthM: number;
  jobOrder: string; // short description / job order number
  cutAt: string; // ISO timestamp
}

export interface WireRoll {
  id: string; // serial number - used as the unique identifier
  type: ThermocoupleType;
  diameterMm: number;
  totalLengthM: number; // original length when the roll was added
  remainingLengthM: number;
  createdAt: string; // ISO timestamp
  history: CutRecord[];
}

export interface StockData {
  rolls: WireRoll[];
}

export const DEFAULT_STOCK: StockData = { rolls: [] };

export interface SpecSummary {
  type: ThermocoupleType;
  diameterMm: number;
  totalRemainingM: number;
  rollCount: number;
}

// Aggregates remaining length across all rolls of the same spec, without
// exposing individual serial numbers - this is what's safe to show on the
// public-facing Stock tab.
export function summarizeStock(rolls: WireRoll[]): SpecSummary[] {
  const map = new Map<string, SpecSummary>();
  for (const roll of rolls) {
    const key = `${roll.type}-${roll.diameterMm.toFixed(2)}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalRemainingM += roll.remainingLengthM;
      existing.rollCount += 1;
    } else {
      map.set(key, {
        type: roll.type,
        diameterMm: roll.diameterMm,
        totalRemainingM: roll.remainingLengthM,
        rollCount: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.type === b.type ? a.diameterMm - b.diameterMm : a.type.localeCompare(b.type)
  );
}
