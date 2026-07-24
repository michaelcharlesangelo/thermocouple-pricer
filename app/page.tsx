"use client";

import { useEffect, useMemo, useState } from "react";
import { WIRE_TABLE, ThermocoupleType } from "@/lib/wireData";
import { MarketRates, PricingConfig, QuoteBreakdown, HEAD_ALLOWANCE_MM } from "@/lib/pricing";

const TYPES: ThermocoupleType[] = ["S", "R", "B"];
const SHOWN_DIAMETERS = [0.3, 0.35, 0.4, 0.45, 0.5];

function fmtIdr(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}
function fmtUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Allows the field to sit blank while the user is editing/clearing it,
// instead of snapping back to "0".
function BlankableNumberInput({
  value,
  onChange,
  min,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  const [text, setText] = useState(value === 0 ? "" : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value === 0 ? "" : String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value;
        if (/^\d*$/.test(raw)) {
          setText(raw);
          onChange(raw === "" ? 0 : Number(raw));
        }
      }}
    />
  );
}

export default function Home() {
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(true); // shown by default for now - flip to false later

  const [type, setType] = useState<ThermocoupleType>("S");
  const [diameter, setDiameter] = useState<number>(0.3);
  const [lengthMm, setLengthMm] = useState<number>(1000);
  const [configuration, setConfiguration] = useState<"simplex" | "duplex">("simplex");
  const [target, setTarget] = useState<"local" | "export">("local");

  const [breakdown, setBreakdown] = useState<QuoteBreakdown | null>(null);
  const [computing, setComputing] = useState(false);

  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState("");
  const [customAmount, setCustomAmount] = useState<number>(0);

  const availableDiameters = useMemo(
    () =>
      WIRE_TABLE.filter((w) => w.type === type && SHOWN_DIAMETERS.includes(w.diameterMm)).map(
        (w) => w.diameterMm
      ),
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
          spoolQtyM: config?.defaultSpoolQtyM,
          target,
          extraIds: selectedExtras,
          customExtra: customAmount > 0 ? { label: customLabel || "Custom", amount: customAmount } : undefined,
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
  }, [rates, config, type, diameter, lengthMm, configuration, target, selectedExtras, customAmount, customLabel]);

  return (
    <>
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="Tempsens" style={{ height: 30, width: "auto" }} />
          <h1>Thermocouple R/S/B Price Calculator</h1>
        </div>
        <a className="nav-link" href="/admin">Admin settings</a>
      </div>

      <div className="card">
        <div className="rate-strip">
          <span>Pt: <b>${rates?.platinumUsdPerOz ?? "-"}/oz</b> <span className="subtle">(admin-set)</span></span>
          <span>Rh: <b>${rates?.rhodiumUsdPerOz ?? "-"}/oz</b> <span className="subtle">(admin-set)</span></span>
          <span>USD/EUR: <b>{rates?.usdEurRate ?? "-"}</b></span>
          <span>USD/IDR: <b>{rates?.usdIdrRate?.toLocaleString("id-ID") ?? "-"}</b></span>
          <span className="subtle">
            {rates ? `updated ${new Date(rates.updatedAt).toLocaleString()}` : ""}
          </span>
          <button className="btn secondary" onClick={refreshRates} disabled={refreshing} style={{ marginLeft: "auto" }}>
            {refreshing ? "Refreshing..." : "Refresh FX rate"}
          </button>
        </div>
        {warnings.length > 0 && (
          <div className="warn" style={{ marginTop: 12 }}>
            {warnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}
        <p className="subtle" style={{ marginTop: 10 }}>
          For urgent inquiry, please contact Admin for price changes.
        </p>
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
            <BlankableNumberInput value={lengthMm} onChange={setLengthMm} min={0} />
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
          <div className="field" style={{ marginTop: 10 }}>
            <label>Additional items</label>
            {config.extras.map((extra) => (
              <div className="checkbox-row" key={extra.id}>
                <input
                  type="checkbox"
                  checked={selectedExtras.includes(extra.id)}
                  onChange={() =>
                    setSelectedExtras((prev) =>
                      prev.includes(extra.id) ? prev.filter((x) => x !== extra.id) : [...prev, extra.id]
                    )
                  }
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

        <div className="field" style={{ marginTop: 10 }}>
          <label>Custom item (one-off, not saved)</label>
          <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
            <input
              type="text"
              placeholder="Description (optional)"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
            />
            <BlankableNumberInput value={customAmount} onChange={setCustomAmount} min={0} />
          </div>
          <p className="subtle" style={{ marginTop: 4 }}>
            Amount is in {target === "local" ? "IDR" : "USD"} (whichever market is selected above) and applies to this quote only.
          </p>
        </div>
      </div>

      {breakdown && (
        <div className="card">
          <div className="price-display">
            <div className="label">
              {target === "local" ? "Local cost price (modal)" : "Export selling price"}
              {computing ? " (updating...)" : ""}
            </div>
            <div className="amount">
              {breakdown.currency === "IDR" ? fmtIdr(breakdown.finalPrice) : fmtUsd(breakdown.finalPrice)}
            </div>
            <span className={`badge ${breakdown.wireRateSource}`}>
              wire cost from {breakdown.wireRateSource === "stock" ? "stock price" : "today's market"}
            </span>
          </div>

          <button
            className="btn secondary"
            style={{ width: "100%", marginBottom: showDetails ? 12 : 0 }}
            onClick={() => setShowDetails((s) => !s)}
          >
            {showDetails ? "Hide calculation" : "Show calculation"}
          </button>

          {showDetails && (
            <table className="breakdown-table">
              <tbody>
                <tr>
                  <td>Metal price (alloy, {breakdown.mfgTier === "under25" ? "<25" : breakdown.mfgTier === "from25to50" ? "25-49.9" : "≥50"} dbm tier)</td>
                  <td>€{breakdown.totalEurPerG.toFixed(2)}/g</td>
                </tr>
                <tr>
                  <td>Wire cost per meter, today's market</td>
                  <td>{target === "local" ? fmtIdr(breakdown.marketRatePerMeter) : fmtUsd(breakdown.marketRatePerMeter)}</td>
                </tr>
                {breakdown.stockRatePerMeter !== null && (
                  <tr>
                    <td>Wire cost per meter, held stock</td>
                    <td>{target === "local" ? fmtIdr(breakdown.stockRatePerMeter) : fmtUsd(breakdown.stockRatePerMeter)}</td>
                  </tr>
                )}
                <tr>
                  <td>Handling factor applied ({breakdown.wireRateSource})</td>
                  <td>× {breakdown.handlingFactorUsed}</td>
                </tr>
                <tr>
                  <td>
                    Scaled to item length ({lengthMm}mm + {HEAD_ALLOWANCE_MM}mm head allowance)
                    {configuration === "duplex" ? ", × 2 for duplex" : ""}
                  </td>
                  <td>{target === "local" ? fmtIdr(breakdown.scaledWireCost) : fmtUsd(breakdown.scaledWireCost)}</td>
                </tr>
                <tr>
                  <td>{target === "local" ? "After local profit" : "After export margin"}</td>
                  <td>{target === "local" ? fmtIdr(breakdown.afterProfitOrMargin) : fmtUsd(breakdown.afterProfitOrMargin)}</td>
                </tr>
                <tr>
                  <td>Standard parts (head, holding tube, ceramic tube, cement)</td>
                  <td>{target === "local" ? fmtIdr(breakdown.standardPartsCost) : fmtUsd(breakdown.standardPartsCost)}</td>
                </tr>
                {breakdown.extrasApplied.map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td>{target === "local" ? fmtIdr(e.priceIdr) : fmtUsd(e.priceUsd)}</td>
                  </tr>
                ))}
                {breakdown.customExtra && (
                  <tr>
                    <td>{breakdown.customExtra.label}</td>
                    <td>{target === "local" ? fmtIdr(breakdown.customExtra.amount) : fmtUsd(breakdown.customExtra.amount)}</td>
                  </tr>
                )}
                <tr className="total">
                  <td>Total</td>
                  <td>{breakdown.currency === "IDR" ? fmtIdr(breakdown.finalPrice) : fmtUsd(breakdown.finalPrice)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
