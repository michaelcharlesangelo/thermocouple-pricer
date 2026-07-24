"use client";

import { useEffect, useState } from "react";
import { MarketRates, PricingConfig, ExtraItem, StockPrice } from "@/lib/pricing";

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
      data.warnings?.length ? `Refreshed with warnings: ${data.warnings.join(" | ")}` : "Refreshed from live sources."
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
          "Refresh rates" attempts to auto-fetch Pt/Rh spot price and FX rates from live sources.
          If that fails (no API key configured, or the source is unreachable), enter the figures
          manually below - manual values are used until the next refresh.
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
              <label>USD/IDR rate (klikBCA kurs jual)</label>
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
                <label>Length allowance (mm)</label>
                <input type="number" value={config.lengthAllowanceMm}
                  onChange={(e) => setConfig({ ...config, lengthAllowanceMm: Number(e.target.value) })} />
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
                        <input type="number" value={stock?.idrPerMeter ?? 0}
                          onChange={(e) => updateStock(key, Number(e.target.value))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Additional items ("tambahan")</h2>
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Local price (IDR)</th><th>Export price (USD)</th><th></th></tr></thead>
              <tbody>
                {config.extras.map((extra) => (
                  <tr key={extra.id}>
                    <td><input type="text" value={extra.name} onChange={(e) => updateExtra(extra.id, { name: e.target.value })} /></td>
                    <td><input type="number" value={extra.priceIdr} onChange={(e) => updateExtra(extra.id, { priceIdr: Number(e.target.value) })} /></td>
                    <td><input type="number" value={extra.priceUsd} onChange={(e) => updateExtra(extra.id, { priceUsd: Number(e.target.value) })} /></td>
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
