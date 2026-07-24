"use client";

import { useEffect, useState } from "react";
import { MarketRates, PricingConfig, StockPrice } from "@/lib/pricing";

// Plain decimal field that can sit blank while editing instead of forcing "0".
function DecimalField({
  value,
  onChange,
  step,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: string;
}) {
  const [text, setText] = useState(value === 0 ? "" : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value === 0 ? "" : String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="text"
      inputMode="decimal"
      step={step}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const v = e.target.value;
        if (/^-?\d*\.?\d*$/.test(v)) {
          setText(v);
          onChange(v === "" || v === "-" || v === "." ? 0 : parseFloat(v));
        }
      }}
    />
  );
}

// Whole-number field with thousand separators, shown formatted when not
// focused (e.g. 5.000.000) and as plain digits while being edited - can sit
// blank instead of forcing "0".
function ThousandsField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [rawText, setRawText] = useState(value === 0 ? "" : String(value));

  useEffect(() => {
    if (!focused) setRawText(value === 0 ? "" : String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const display = focused ? rawText : value === 0 ? "" : value.toLocaleString("id-ID");

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onFocus={() => {
        setFocused(true);
        setRawText(value === 0 ? "" : String(value));
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        setRawText(raw);
        onChange(raw === "" ? 0 : Number(raw));
      }}
    />
  );
}

export default function AdminPage() {
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [savingRates, setSavingRates] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rates").then((r) => r.json()).then(setRates);
    fetch("/api/config").then((r) => r.json()).then(setConfig);
  }, []);

  async function saveRates() {
    if (!rates) return;
    setSavingRates(true);
    const res = await fetch("/api/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rates),
    });
    const data = await res.json();
    setRates(data);
    setSavingRates(false);
    setMessage("Rates saved.");
  }

  async function refreshRates() {
    setRefreshing(true);
    const res = await fetch("/api/rates/refresh", { method: "POST" });
    const data = await res.json();
    setRates(data.rates);
    setMessage(
      data.warnings?.length ? `Refreshed with notes: ${data.warnings.join(" | ")}` : "Refreshed from live sources."
    );
    setRefreshing(false);
  }

  async function saveConfig() {
    if (!config) return;
    setSavingConfig(true);
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    setConfig(data);
    setSavingConfig(false);
    setMessage("Configuration saved.");
  }

  function updateStock(key: string, idrPerMeter: number) {
    if (!config) return;
    const exists = config.stockPrices.find((s) => s.key === key);
    let stockPrices: StockPrice[];
    if (exists) {
      stockPrices = config.stockPrices.map((s) => (s.key === key ? { ...s, idrPerMeter } : s));
    } else {
      stockPrices = [...config.stockPrices, { key, idrPerMeter }];
    }
    setConfig({ ...config, stockPrices });
  }

  const stockKeys = [
    "S-0.30", "S-0.35", "S-0.40", "S-0.45", "S-0.50",
    "R-0.30", "R-0.35", "R-0.40", "R-0.45", "R-0.50",
    "B-0.30", "B-0.35", "B-0.40", "B-0.45", "B-0.50",
  ];

  return (
    <>
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="Tempsens" style={{ height: 26, width: "auto" }} />
          <h1>Admin settings</h1>
        </div>
        <a className="nav-link" href="/">Back to calculator</a>
      </div>

      {message && <div className="warn">{message}</div>}

      <div className="card">
        <h2>Market rates</h2>
        <p className="subtle">
          "Refresh rates" auto-fetches USD/EUR and USD/IDR live (no signup needed). Platinum and Rhodium
          are entered manually below unless you've configured a Pt/Rh auto-fetch key (see README) - manual
          values are used until the next refresh either way.
        </p>
        {rates && (
          <div className="grid">
            <div className="field">
              <label>Platinum (USD/oz)</label>
              <DecimalField value={rates.platinumUsdPerOz} onChange={(n) => setRates({ ...rates, platinumUsdPerOz: n })} />
            </div>
            <div className="field">
              <label>Rhodium (USD/oz)</label>
              <DecimalField value={rates.rhodiumUsdPerOz} onChange={(n) => setRates({ ...rates, rhodiumUsdPerOz: n })} />
            </div>
            <div className="field">
              <label>USD/EUR rate</label>
              <DecimalField value={rates.usdEurRate} onChange={(n) => setRates({ ...rates, usdEurRate: n })} step="0.0001" />
            </div>
            <div className="field">
              <label>USD/IDR rate</label>
              <DecimalField value={rates.usdIdrRate} onChange={(n) => setRates({ ...rates, usdIdrRate: n })} />
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn" onClick={saveRates} disabled={savingRates}>
            {savingRates ? "Saving..." : "Save manual rates"}
          </button>
          <button className="btn secondary" onClick={refreshRates} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh from live sources"}
          </button>
        </div>
        {rates && <p className="subtle" style={{ marginTop: 8 }}>Last updated: {new Date(rates.updatedAt).toLocaleString()} ({rates.source})</p>}
      </div>

      {config && (
        <>
          <div className="card">
            <h2>Pricing parameters</h2>
            <div className="grid">
              <div className="field">
                <label>Handling factor — today's market</label>
                <DecimalField value={config.wireHandlingFactorMarket} step="0.01"
                  onChange={(n) => setConfig({ ...config, wireHandlingFactorMarket: n })} />
              </div>
              <div className="field">
                <label>Handling factor — held stock</label>
                <DecimalField value={config.wireHandlingFactorStock} step="0.01"
                  onChange={(n) => setConfig({ ...config, wireHandlingFactorStock: n })} />
                <p className="subtle" style={{ marginTop: 4 }}>Set to 1 for no added factor when using stock wire.</p>
              </div>
              <div className="field">
                <label>Local profit (%)</label>
                <DecimalField value={config.localProfitPct * 100} step="0.01"
                  onChange={(n) => setConfig({ ...config, localProfitPct: n / 100 })} />
              </div>
              <div className="field">
                <label>Export margin (%)</label>
                <DecimalField value={config.exportMarginPct * 100} step="0.01"
                  onChange={(n) => setConfig({ ...config, exportMarginPct: n / 100 })} />
              </div>
              <div className="field">
                <label>Standard parts price (IDR)</label>
                <ThousandsField value={config.standardPartsIdr}
                  onChange={(n) => setConfig({ ...config, standardPartsIdr: n })} />
              </div>
              <div className="field">
                <label>Default assumed order size
