"use client";

import { useEffect, useMemo, useState } from "react";
import { WIRE_TABLE, ThermocoupleType } from "@/lib/wireData";
import { MarketRates, PricingConfig, QuoteBreakdown } from "@/lib/pricing";

const TYPES: ThermocoupleType[] = ["S", "R", "B"];

function fmtIdr(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}
function fmtUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Home() {
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [type, setType] = useState<ThermocoupleType>("S");
  const [diameter, setDiameter] = useState<number>(0.3);
  const [lengthMm, setLengthMm] = useState<number>(1000);
  const [configuration, setConfiguration] = useState<"simplex" | "duplex">("simplex");
  const [target, setTarget] = useState<"local" | "export">("local");
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [spoolQty, setSpoolQty] = useState<number>(10);

  const [breakdown, setBreakdown] = useState<QuoteBreakdown | null>(null);
  const [computing, setComputing] = useState(false);

  const availableDiameters = useMemo(
    () => WIRE_TABLE.filter((w) => w.type === type).map((w) => w.diameterMm),
    [type]
  );

  useEffect(() => {
    if (!availableDiameters.includes(diameter)) {
      setDiameter(availableDiameters[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function loadRatesAndConfig() {
    const [r, c] = await Promise.all([
      fetch("/api/rates").then((res) => res.json()),
      fetch("/api/config").then((res) => res.json()),
    ]);
    setRates(r);
    setConfig(c);
  }

  useEffect(() => {
    loadRatesAndConfig();
  }, []);

  async function refreshRates() {
    setRefreshing(true);
    setWarnings([]);
    try {
      const res = await fetch("/api/rates/refresh", { method: "POST" });
      const data = await res.json();
      setRates(data.rates);
      setWarnings(data.warnings ?? []);
    } finally {
      setRefreshing(false);
    }
  }

  async function computeQuote() {
    setComputing(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          diameterMm: diameter,
          lengthBelowHeadMm: lengthMm,
          configuration,
          spoolQtyM: spoolQty,
          target,
          extraIds: selectedExtras,
        }),
      });
      const data = await res.json();
      if (data.breakdown) setBreakdown(data.breakdown);
    } finally {
      setComputing(false);
    }
  }

  useEffect(() => {
    if (rates && config) computeQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates, config, type, diameter, lengthMm, configuration, target, selectedExtras, spoolQty]);

  function toggleExtra(id: string) {
    setSelectedExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <>
      <div className="topbar">
        <h1>Thermocouple Price Calculator</h1>
        <a className="nav-link" href="/admin">Admin settings</a>
      </div>

      <div className="card">
        <div className="rate-strip">
          <span>Pt: <b>${rates?.platinumUsdPerOz ?? "-"}/oz</b></span>
          <span>Rh: <b>${rates?.rhodiumUsdPerOz ?? "-"}/oz</b></span>
          <span>USD/EUR: <b>{rates?.usdEurRate ?? "-"}</b></span>
          <span>USD/IDR: <b>{rates?.usdIdrRate?.toLocaleString("id-ID") ?? "-"}</b></span>
          <span className="subtle">
            {rates ? `updated ${new Date(rates.updatedAt).toLocaleString()} (${rates.source})` : ""}
          </span>
          <button className="btn secondary" onClick={refreshRates} disabled={refreshing} style={{ marginLeft: "auto" }}>
            {refreshing ? "Refreshing..." : "Refresh rates"}
          </button>
        </div>
        {warnings.length > 0 && (
          <div className="warn" style={{ marginTop: 12 }}>
            {warnings.map((w, i) => <div key={i}>{w}</div>)}
            Go to Admin settings to enter rates manually if auto-fetch keeps failing.
          </div>
        )}
      </div>

      <div className="card">
        <h2>Item specification</h2>
        <div className="grid">
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ThermocoupleType)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Wire diameter (mm)</label>
            <select value={diameter} onChange={(e) => setDiameter(Number(e.target.value))}>
              {availableDiameters.map((d) => <option key={d} value={d}>{d.toFixed(2)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Length below head (mm)</label>
            <input type="number" value={lengthMm} min={0} onChange={(e) => setLengthMm(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Assumed order size (m, sets tier)</label>
            <input type="number" value={spoolQty} min={1} onChange={(e) => setSpoolQty(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid" style={{ marginTop: 4 }}>
          <div className="field">
            <label>Configuration</label>
            <div className="pill-toggle">
              <button className={configuration === "simplex" ? "active" : ""} onClick={() => setConfiguration("simplex")}>Simplex</button>
              <button className={configuration === "duplex" ? "active" : ""} onClick={() => setConfiguration("duplex")}>Duplex</button>
            </div>
          </div>
          <div className="field">
            <label>Market</label>
            <div className="pill-toggle">
              <button className={target === "local" ? "active" : ""} onClick={() => setTarget("local")}>Local (IDR)</button>
              <button className={target === "export" ? "active" : ""} onClick={() => setTarget("export")}>Export (USD)</button>
            </div>
          </div>
        </div>

        {config && config.extras.length > 0 && (
          <div className="field" style={{ marginTop: 8 }}>
            <label>Additional items</label>
            {config.extras.map((extra) => (
              <div className="checkbox-row" key={extra.id}>
                <input
                  type="checkbox"
                  checked={selectedExtras.includes(extra.id)}
                  onChange={() => toggleExtra(extra.id)}
                />
                <span>
                  {extra.name}{" "}
                  <span className="subtle">
                    ({extra.priceIdr > 0 ? fmtIdr(extra.priceIdr) : ""}
                    {extra.priceIdr > 0 && extra.priceUsd > 0 ? " / " : ""}
                    {extra.priceUsd > 0 ? fmtUsd(extra.priceUsd) : ""})
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {breakdown && (
        <div className="card">
          <div className="price-display">
            <div className="label">
              {target === "local" ? "Local selling price" : "Export offer price"}
              {computing ? " (updating...)" : ""}
            </div>
            <div className="amount">
              {breakdown.currency === "IDR" ? fmtIdr(breakdown.finalPrice) : fmtUsd(breakdown.finalPrice)}
            </div>
            <span className={`badge ${breakdown.wireRateSource}`}>
              wire cost from {breakdown.wireRateSource === "stock" ? "stock price" : "today's market"}
            </span>
          </div>

          <table className="breakdown-table">
            <tbody>
              <tr>
                <td>Metal price (alloy, {breakdown.mfgTier === "under25" ? "<25" : breakdown.mfgTier === "from25to50" ? "25-49.9" : "≥50"} dbm tier)</td>
                <td>€{breakdown.totalEurPerG.toFixed(2)}/g</td>
              </tr>
              <tr>
                <td>Wire cost per metre ({configuration}), today's market</td>
                <td>
                  {target === "local" ? fmtIdr(breakdown.marketRateFinal) : fmtUsd(breakdown.marketRateFinal)}
                </td>
              </tr>
              {breakdown.stockRatePerMeter !== null && (
                <tr>
                  <td>Wire cost per metre, held stock</td>
                  <td>{fmtIdr(breakdown.stockRatePerMeter)}</td>
                </tr>
              )}
              <tr>
                <td>Scaled to item length ({lengthMm}mm) × handling factor</td>
                <td>{target === "local" ? fmtIdr(breakdown.scaledWireCost) : fmtUsd(breakdown.scaledWireCost)}</td>
              </tr>
              <tr>
                <td>{target === "local" ? "After local profit" : "After export margin"}</td>
                <td>{target === "local" ? fmtIdr(breakdown.afterProfitOrMargin) : fmtUsd(breakdown.afterProfitOrMargin)}</td>
              </tr>
              <tr>
                <td>Standard parts (head, cement, holding tube, ceramic)</td>
                <td>{target === "local" ? fmtIdr(breakdown.standardPartsCost) : fmtUsd(breakdown.standardPartsCost)}</td>
              </tr>
              {breakdown.extrasApplied.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{target === "local" ? fmtIdr(e.priceIdr) : fmtUsd(e.priceUsd)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td>{breakdown.currency === "IDR" ? fmtIdr(breakdown.finalPrice) : fmtUsd(breakdown.finalPrice)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
