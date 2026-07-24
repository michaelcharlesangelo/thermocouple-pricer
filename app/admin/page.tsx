"use client";

import { useEffect, useState } from "react";
import { MarketRates, PricingConfig, StockPrice } from "@/lib/pricing";

function FormattedNumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  // Displays with thousand separators (e.g. 5.000.000) while still storing
  // a plain number underneath - parses out any non-digit characters typed.
  const [text, setText] = useState(value.toLocaleString("id-ID"));

  useEffect(() => {
    setText(value.toLocaleString("id-ID"));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        const n = raw === "" ? 0 : Number(raw);
        setText(n.toLocaleString("id-ID"));
        onChange(n);
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
    "S-0.30", "S-0.40", "S-0.50",
    "R-0.30", "R-0.40", "R-0.50",
    "B-0.30", "B-0.40", "B-0.50",
  ];

  return (
    <>
      <div className="topbar">
        <h1>Admin settings</h1>
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
              <input type="number" value={rates.platinumUsdPerOz}
                onChange={(e) => setRates({ ...rates, platinumUsdPerOz: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Rhodium (USD/oz)</label>
              <input type="number" value={rates.rhodiumUsdPerOz}
                onChange={(e) => setRates({ ...rates, rhodiumUsdPerOz: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>USD/EUR rate</label>
              <input type="number" step="0.0001" value={rates.usdEurRate}
                onChange={(e) => setRates({ ...rates, usdEurRate: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>USD/IDR rate</label>
              <input type="number" value={rates.usdIdrRate}
                onChange={(e) => setRates({ ...rates, usdIdrRate: Number(e.target.value) })} />
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
                <label>Wire handling factor</label>
                <input type="number" step="0.01" value={config.wireHandlingFactor}
                  onChange={(e) => setConfig({ ...config, wireHandlingFactor: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Local profit (%)</label>
                <input type="number" step="0.01" value={config.localProfitPct * 100}
                  onChange={(e) => setConfig({ ...config, localProfitPct: Number(e.target.value) / 100 })} />
              </div>
              <div className="field">
                <label>Export margin (%)</label>
                <input type="number" step="0.01" value={config.exportMarginPct * 100}
                  onChange={(e) => setConfig({ ...config, exportMarginPct: Number(e.target.value) / 100 })} />
              </div>
              <div className="field">
                <label>Standard parts price (IDR)</label>
                <input type="number" value={config.standardPartsIdr}
                  onChange={(e) => setConfig({ ...config, standardPartsIdr: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Default assumed order size (m)</label>
                <input type="number" value={config.defaultSpoolQtyM}
                  onChange={(e) => setConfig({ ...config, defaultSpoolQtyM: Number(e.target.value) })} />
                <p className="subtle" style={{ marginTop: 4 }}>Bigger orders unlock a better manufacturing tier - raise this if quoting a large order.</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Stock prices (IDR / metre, local only)</h2>
            <p className="subtle">Leave at 0 to always use today's market-calculated price for that spec.</p>
            <table className="admin-table">
              <thead><tr><th>Spec</th><th>Stock price (IDR/mtr)</th></tr></thead>
              <tbody>
                {stockKeys.map((key) => {
                  const stock = config.stockPrices.find((s) => s.key === key);
                  return (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>
                        <FormattedNumberInput value={stock?.idrPerMeter ?? 0} onChange={(n) => updateStock(key, n)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button className="btn" onClick={saveConfig} disabled={savingConfig}>
            {savingConfig ? "Saving..." : "Save all configuration"}
          </button>
        </>
      )}
    </>
  );
}
