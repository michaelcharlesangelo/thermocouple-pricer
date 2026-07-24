"use client";

import { useEffect, useState } from "react";
import { MarketRates, PricingConfig, StockPrice, ExtraItem } from "@/lib/pricing";

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
      data.warnings?.length ? `Refreshed with notes: ${data.warnings.join(" | ")}` : "FX rate refreshed."
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

  function updateExtra(id: string, patch: Partial<ExtraItem>) {
    if (!config) return;
    setConfig({ ...config, extras: config.extras.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }

  function addExtra() {
    if (!config) return;
    const id = "extra_" + Date.now();
    setConfig({ ...config, extras: [...config.extras, { id, name: "New item", priceIdr: 0, priceUsd: 0 }] });
  }

  function removeExtra(id: string) {
    if (!config) return;
    setConfig({ ...config, extras: config.extras.filter((e) => e.id !== id) });
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
          "Refresh FX rate" fetches USD/EUR and USD/IDR live (no signup needed). Platinum and Rhodium
          are always entered manually here on the admin page — by design, only admin can change the
          metal basis; the FX refresh doesn't touch them.
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
            {refreshing ? "Refreshing..." : "Refresh FX rate"}
          </button>
        </div>
        {rates && <p className="subtle" style={{ marginTop: 8 }}>Last updated: {new Date(rates.updatedAt).toLocaleString()} ({rates.source})</p>}
      </div>

      {config && (
        <>
          <div className="card">
            <h2>Pricing parameters</h2>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
              <div className="field">
                <label>Handling factor (market)</label>
                <DecimalField value={config.wireHandlingFactorMarket} step="0.01"
                  onChange={(n) => setConfig({ ...config, wireHandlingFactorMarket: n })} />
                <p className="subtle" style={{ marginTop: 4 }}>Set to 1 for no added factor.</p>
              </div>
              <div className="field">
                <label>Handling factor (stock)</label>
                <DecimalField value={config.wireHandlingFactorStock} step="0.01"
                  onChange={(n) => setConfig({ ...config, wireHandlingFactorStock: n })} />
                <p className="subtle" style={{ marginTop: 4 }}>Set to 1 for no added factor.</p>
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
                <label>Default assumed order size (m)</label>
                <DecimalField value={config.defaultSpoolQtyM}
                  onChange={(n) => setConfig({ ...config, defaultSpoolQtyM: n })} />
                <p className="subtle" style={{ marginTop: 4 }}>Bigger orders unlock a better manufacturing tier - raise this if quoting a large order.</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Stock prices (IDR / meter)</h2>
            <p className="subtle">
              Applies to both local and export quotes — compared against today's market wire cost (in IDR),
              and whichever is higher is used, converted to the display currency as needed. Leave at 0 to
              always use today's market-calculated price for that spec.
            </p>
            <table className="admin-table">
              <thead><tr><th>Spec</th><th>Stock price (IDR/meter)</th></tr></thead>
              <tbody>
                {stockKeys.map((key) => {
                  const stock = config.stockPrices.find((s) => s.key === key);
                  return (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>
                        <ThousandsField value={stock?.idrPerMeter ?? 0} onChange={(n) => updateStock(key, n)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Additional items ("tambahan")</h2>
            <p className="subtle">
              These show up as checkboxes on the calculator page. For one-off items not worth saving here,
              sales can also type a custom item directly on the calculator.
            </p>
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Local price (IDR)</th><th>Export price (USD)</th><th></th></tr></thead>
              <tbody>
                {config.extras.map((extra) => (
                  <tr key={extra.id}>
                    <td><input type="text" value={extra.name} onChange={(e) => updateExtra(extra.id, { name: e.target.value })} /></td>
                    <td><ThousandsField value={extra.priceIdr} onChange={(n) => updateExtra(extra.id, { priceIdr: n })} /></td>
                    <td><DecimalField value={extra.priceUsd} onChange={(n) => updateExtra(extra.id, { priceUsd: n })} step="0.01" /></td>
                    <td><button className="btn secondary" onClick={() => removeExtra(extra.id)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn secondary" style={{ marginTop: 10 }} onClick={addExtra}>+ Add item</button>
          </div>

          <button className="btn" onClick={saveConfig} disabled={savingConfig}>
            {savingConfig ? "Saving..." : "Save all configuration"}
          </button>
        </>
      )}
    </>
  );
}
