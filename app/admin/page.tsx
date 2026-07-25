"use client";

import { Fragment, useEffect, useState } from "react";
import { MarketRates, PricingConfig, StockPrice, ExtraItem } from "@/lib/pricing";
import { ThermocoupleType } from "@/lib/wireData";
import { StockData } from "@/lib/stock";
import { TeamLoginEntry } from "@/lib/teamLogs";

const ROLL_DIAMETERS = [0.3, 0.35, 0.4, 0.45, 0.5];

// Plain decimal field that can sit blank while editing instead of forcing "0".
function DecimalField({
  value,
  onChange,
  step,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: string;
  placeholder?: string;
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
      placeholder={placeholder}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const v = e.target.value;
        // Accept comma as a decimal separator too - many phone numeric
        // keypads only offer "," not ".", which was silently rejected
        // before and made it look impossible to type a decimal on mobile.
        if (/^-?\d*[.,]?\d*$/.test(v)) {
          setText(v);
          const normalized = v.replace(",", ".");
          onChange(normalized === "" || normalized === "-" || normalized === "." ? 0 : parseFloat(normalized));
        }
      }}
    />
  );
}

// Whole-number field with thousand separators, shown formatted when not
// focused (e.g. 5.000.000) and as plain digits while being edited - can sit
// blank instead of forcing "0".
function ThousandsField({ value, onChange, placeholder }: { value: number; onChange: (n: number) => void; placeholder?: string }) {
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
      placeholder={placeholder}
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

// Page-number pagination with ellipsis for large page counts, e.g.
// "Prev  1  2  3  4  5  ...  500  Next" - always shows page 1 and the last
// page, plus a small window around the current page.
function LogsPagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  const windowStart = Math.max(2, page - 1);
  const windowEnd = Math.min(totalPages - 1, page + 1);

  pages.push(1);
  if (windowStart > 2) pages.push("...");
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p);
  if (windowEnd < totalPages - 1) pages.push("...");
  if (totalPages > 1) pages.push(totalPages);

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
      <button className="btn secondary" onClick={() => onChange(page - 1)} disabled={page === 1}>Prev</button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} style={{ padding: "0 4px", color: "var(--text-muted)" }}>...</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={p === page ? "btn" : "btn secondary"}
            style={{ minWidth: 36, padding: "8px 10px" }}
          >
            {p}
          </button>
        )
      )}
      <button className="btn secondary" onClick={() => onChange(page + 1)} disabled={page === totalPages}>Next</button>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  const [rates, setRates] = useState<MarketRates | null>(null);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [savingRates, setSavingRates] = useState(false);
  const [savingFx, setSavingFx] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<"pricing" | "stock" | "security">("pricing");

  const [stock, setStock] = useState<StockData | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [expandedRoll, setExpandedRoll] = useState<string | null>(null);

  const [newRollType, setNewRollType] = useState<ThermocoupleType>("S");
  const [newRollDiameter, setNewRollDiameter] = useState<number>(0.3);
  const [newRollSerial, setNewRollSerial] = useState("");
  const [newRollLength, setNewRollLength] = useState<number>(0);
  const [addingRoll, setAddingRoll] = useState(false);

  const [cutRollId, setCutRollId] = useState("");
  const [cutLength, setCutLength] = useState<number>(0);
  const [cutJobOrder, setCutJobOrder] = useState("");
  const [recordingCut, setRecordingCut] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [newTeamPassword, setNewTeamPassword] = useState("");
  const [confirmTeamPassword, setConfirmTeamPassword] = useState("");
  const [changingTeamPassword, setChangingTeamPassword] = useState(false);
  const [teamPasswordMessage, setTeamPasswordMessage] = useState<string | null>(null);

  const [teamLogs, setTeamLogs] = useState<TeamLoginEntry[] | null>(null);
  const [logsPage, setLogsPage] = useState(1);
  const LOGS_PER_PAGE = 10;

  const AUTH_STORAGE_KEY = "thermocouple_admin_authed";
  const ACTIVITY_STORAGE_KEY = "thermocouple_admin_last_activity";
  const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // auto-logout after 15 minutes of no activity

  useEffect(() => {
    if (typeof window === "undefined") return;
    const wasAuthed = localStorage.getItem(AUTH_STORAGE_KEY) === "true";
    const lastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY) || 0);
    if (wasAuthed && Date.now() - lastActivity < IDLE_TIMEOUT_MS) {
      setAuthed(true);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    setAuthChecked(true);
  }, []);

  function recordActivity() {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(Date.now()));
  }

  async function submitPassword() {
    setAuthError(null);
    setAuthenticating(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAuthError(data.error || "Incorrect password.");
        return;
      }
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      recordActivity();
      setAuthed(true);
      setPasswordInput("");
    } catch (e) {
      setAuthError((e as Error).message);
    } finally {
      setAuthenticating(false);
    }
  }

  function logOut() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthed(false);
  }

  // While logged in: track activity and periodically check whether 15
  // minutes have passed since the last one.
  useEffect(() => {
    if (!authed) return;
    recordActivity();
    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, recordActivity));
    const interval = setInterval(() => {
      const lastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY) || 0);
      if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
        logOut();
      }
    }, 15000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, recordActivity));
      clearInterval(interval);
    };
  }, [authed]);

  async function submitChangePassword() {
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New password and confirmation don't match.");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPasswordMessage(data.error || "Failed to change password.");
        return;
      }
      setPasswordMessage("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setPasswordMessage((e as Error).message);
    } finally {
      setChangingPassword(false);
    }
  }

  async function submitChangeTeamPassword() {
    setTeamPasswordMessage(null);
    if (newTeamPassword !== confirmTeamPassword) {
      setTeamPasswordMessage("New password and confirmation don't match.");
      return;
    }
    setChangingTeamPassword(true);
    try {
      const res = await fetch("/api/team/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newTeamPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setTeamPasswordMessage(data.error || "Failed to change password.");
        return;
      }
      setTeamPasswordMessage("Team password changed.");
      setNewTeamPassword("");
      setConfirmTeamPassword("");
    } catch (e) {
      setTeamPasswordMessage((e as Error).message);
    } finally {
      setChangingTeamPassword(false);
    }
  }

  async function loadTeamLogs() {
    const data = await fetch("/api/team/logs", { cache: "no-store" }).then((res) => res.json());
    setTeamLogs(data.entries);
  }

  async function submitClearLogs() {
    if (!confirm("Delete all login history? This can't be undone.")) return;
    await fetch("/api/team/logs/clear", { method: "POST" });
    setTeamLogs([]);
    setLogsPage(1);
  }

  async function loadAll() {
    const [r, c, s] = await Promise.all([
      fetch("/api/rates", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/config", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/stock", { cache: "no-store" }).then((res) => res.json()),
    ]);
    setRates(r);
    setConfig(c);
    setStock(s);
  }

  useEffect(() => {
    if (!authed) return;
    loadAll();
    // Auto-refresh whenever this tab regains focus, so changes saved from
    // another tab/device (e.g. someone else on /admin, or this same page
    // left open) don't sit stale until a manual browser refresh.
    function onFocus() {
      loadAll();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") loadAll();
    });
    return () => window.removeEventListener("focus", onFocus);
  }, [authed]);

  useEffect(() => {
    if (authed && adminTab === "security") {
      loadTeamLogs();
      setLogsPage(1);
    }
  }, [authed, adminTab]);

  async function saveMetalRates() {
    if (!rates) return;
    setSavingRates(true);
    setMessage(null);
    try {
      const res = await fetch("/api/rates/metal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platinumUsdPerOz: rates.platinumUsdPerOz, rhodiumUsdPerOz: rates.rhodiumUsdPerOz }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Failed to save metal prices: ${data.error || "unknown error"}`);
        return;
      }
      setRates(data);
      setMessage("Metal prices saved.");
    } catch (e) {
      setMessage(`Failed to save metal prices: ${(e as Error).message}`);
    } finally {
      setSavingRates(false);
    }
  }

  async function saveFxRatesManually() {
    if (!rates) return;
    setSavingFx(true);
    setMessage(null);
    try {
      const res = await fetch("/api/rates/fx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usdEurRate: rates.usdEurRate, usdIdrRate: rates.usdIdrRate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Failed to save FX rate: ${data.error || "unknown error"}`);
        return;
      }
      setRates(data);
      setMessage("FX rate saved.");
    } catch (e) {
      setMessage(`Failed to save FX rate: ${(e as Error).message}`);
    } finally {
      setSavingFx(false);
    }
  }

  async function refreshRates() {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/rates/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Refresh failed: ${data.error || "unknown error"}`);
        return;
      }
      setRates(data.rates);
      setMessage(
        data.warnings?.length ? `Refreshed with notes: ${data.warnings.join(" | ")}` : "FX rate refreshed."
      );
    } catch (e) {
      setMessage(`Refresh failed: ${(e as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setSavingConfig(true);
    const toSave = { ...config, configUpdatedAt: new Date().toISOString() };
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSave),
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

  async function submitAddRoll() {
    setStockError(null);
    setAddingRoll(true);
    const res = await fetch("/api/stock/rolls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: newRollSerial.trim(),
        type: newRollType,
        diameterMm: newRollDiameter,
        totalLengthM: newRollLength,
      }),
    });
    const data = await res.json();
    setAddingRoll(false);
    if (!res.ok) {
      setStockError(data.error || "Failed to add roll.");
      return;
    }
    setStock(data);
    setNewRollSerial("");
    setNewRollLength(0);
    setMessage("Roll added.");
  }

  async function submitCut() {
    setStockError(null);
    setRecordingCut(true);
    const res = await fetch("/api/stock/cut", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollId: cutRollId, cutLengthM: cutLength, jobOrder: cutJobOrder.trim() }),
    });
    const data = await res.json();
    setRecordingCut(false);
    if (!res.ok) {
      setStockError(data.error || "Failed to record cut.");
      return;
    }
    setStock(data);
    setCutRollId("");
    setCutLength(0);
    setCutJobOrder("");
    setMessage("Cut recorded.");
  }

  async function submitDeleteRoll(id: string) {
    if (!confirm(`Delete roll "${id}" and its full history? This cannot be undone.`)) return;
    const res = await fetch("/api/stock/rolls/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollId: id }),
    });
    const data = await res.json();
    setStock(data);
  }

  const stockKeys = [
    "S-0.30", "S-0.35", "S-0.40", "S-0.45", "S-0.50",
    "R-0.30", "R-0.35", "R-0.40", "R-0.45", "R-0.50",
    "B-0.30", "B-0.35", "B-0.40", "B-0.45", "B-0.50",
  ];

  if (!authChecked) {
    return null;
  }

  if (!authed) {
    return (
      <>
        <div className="topbar">
          <div className="brand">
            <img src="/logo.png" alt="Tempsens" style={{ height: 26, width: "auto" }} />
            <h1>Admin settings</h1>
          </div>
          <a className="nav-link" href="/">Back to calculator</a>
        </div>
        <div className="card" style={{ maxWidth: 360, margin: "40px auto 0" }}>
          <h2>Password required</h2>
          <div className="field">
            <label>Admin password</label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPassword()}
              autoFocus
            />
          </div>
          {authError && <p style={{ color: "var(--bad)", fontSize: "0.82rem", marginTop: 8 }}>{authError}</p>}
          <button className="btn" style={{ marginTop: 10, width: "100%" }} onClick={submitPassword} disabled={authenticating || !passwordInput}>
            {authenticating ? "Checking..." : "Enter"}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="Tempsens" style={{ height: 26, width: "auto" }} />
          <h1>Admin settings</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="nav-link" style={{ border: "1px solid var(--border)", cursor: "pointer" }} onClick={logOut}>Log out</button>
          <a className="nav-link" href="/">Back to calculator</a>
        </div>
      </div>

      <div className="pill-toggle" style={{ marginBottom: 16 }}>
        <button className={adminTab === "pricing" ? "active" : ""} onClick={() => setAdminTab("pricing")}>Pricing</button>
        <button className={adminTab === "stock" ? "active" : ""} onClick={() => setAdminTab("stock")}>Stock</button>
        <button className={adminTab === "security" ? "active" : ""} onClick={() => setAdminTab("security")}>Security</button>
      </div>

      {message && <div className="warn">{message}</div>}

      {adminTab === "pricing" && (
      <>
      <div className="card">
        <h2>Metal prices (Pt/Rh)</h2>
        <p className="subtle">
          Admin-entered only, always - no auto-fetch. Enter today's figures from Kitco (or wherever
          you're sourcing them) and save.
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
          </div>
        )}
        <button className="btn" style={{ marginTop: 8 }} onClick={saveMetalRates} disabled={savingRates}>
          {savingRates ? "Saving..." : "Save metal prices"}
        </button>
        {rates && <p className="subtle" style={{ marginTop: 8 }}>Last updated: {new Date(rates.metalUpdatedAt).toLocaleString()}</p>}
      </div>

      <div className="card">
        <h2>FX rate (USD/EUR, USD/IDR)</h2>
        <p className="subtle">
          "Refresh FX rate" fetches both live (no signup needed). You can also type in a figure
          manually below and save it - manual values are used until the next refresh.
        </p>
        {rates && (
          <div className="grid">
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
          <button className="btn" onClick={saveFxRatesManually} disabled={savingFx}>
            {savingFx ? "Saving..." : "Save FX rate manually"}
          </button>
          <button className="btn secondary" onClick={refreshRates} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh FX rate"}
          </button>
        </div>
        {rates && <p className="subtle" style={{ marginTop: 8 }}>Last updated: {new Date(rates.fxUpdatedAt).toLocaleString()} ({rates.fxSource})</p>}
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
                  const stockPrice = config.stockPrices.find((s) => s.key === key);
                  return (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>
                        <ThousandsField value={stockPrice?.idrPerMeter ?? 0} onChange={(n) => updateStock(key, n)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="subtle" style={{ marginTop: 8 }}>Last saved: {new Date(config.configUpdatedAt).toLocaleString()}</p>
          </div>

          <div className="card">
            <h2>Additional items</h2>
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
                    <td><ThousandsField value={extra.priceIdr} onChange={(n) => updateExtra(extra.id, { priceIdr: n })} placeholder="IDR" /></td>
                    <td><DecimalField value={extra.priceUsd} onChange={(n) => updateExtra(extra.id, { priceUsd: n })} step="0.01" placeholder="USD" /></td>
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
      )}

      {adminTab === "stock" && (
      <>
      <div className="card">
        <h2>Add wire roll</h2>
        <p className="subtle">Record a new roll of wire coming into stock, with its serial number and length.</p>
        <div className="grid">
          <div className="field">
            <label>Type</label>
            <select value={newRollType} onChange={(e) => setNewRollType(e.target.value as ThermocoupleType)}>
              <option value="S">S</option>
              <option value="R">R</option>
              <option value="B">B</option>
            </select>
          </div>
          <div className="field">
            <label>Diameter (mm)</label>
            <select value={newRollDiameter} onChange={(e) => setNewRollDiameter(Number(e.target.value))}>
              {ROLL_DIAMETERS.map((d) => <option key={d} value={d}>{d.toFixed(2)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Serial number</label>
            <input type="text" value={newRollSerial} onChange={(e) => setNewRollSerial(e.target.value)} placeholder="e.g. RL-2026-014" />
          </div>
          <div className="field">
            <label>Total length (m)</label>
            <DecimalField value={newRollLength} onChange={setNewRollLength} />
          </div>
        </div>
        <button
          className="btn"
          style={{ marginTop: 8 }}
          onClick={submitAddRoll}
          disabled={addingRoll || !newRollSerial.trim() || newRollLength <= 0}
        >
          {addingRoll ? "Adding..." : "Add roll"}
        </button>
      </div>

      <div className="card">
        <h2>Record a cut</h2>
        <p className="subtle">Select the roll a piece was cut from, how much, and which job order it's for.</p>
        <div className="grid">
          <div className="field">
            <label>Roll</label>
            <select value={cutRollId} onChange={(e) => setCutRollId(e.target.value)}>
              <option value="">Select a roll...</option>
              {(stock?.rolls ?? [])
                .filter((r) => r.remainingLengthM > 0)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.type} {r.diameterMm.toFixed(2)} — {r.id} ({r.remainingLengthM.toFixed(2)}m left)
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label>Cut length (m)</label>
            <DecimalField value={cutLength} onChange={setCutLength} />
          </div>
          <div className="field">
            <label>Job order / description</label>
            <input type="text" value={cutJobOrder} onChange={(e) => setCutJobOrder(e.target.value)} placeholder="e.g. JO-2026-0113" />
          </div>
        </div>
        {stockError && <p style={{ color: "var(--bad)", fontSize: "0.82rem", marginTop: 8 }}>{stockError}</p>}
        <button
          className="btn"
          style={{ marginTop: 8 }}
          onClick={submitCut}
          disabled={recordingCut || !cutRollId || cutLength <= 0 || !cutJobOrder.trim()}
        >
          {recordingCut ? "Recording..." : "Record cut"}
        </button>
      </div>

      <div className="card">
        <h2>Rolls in stock</h2>
        {(stock?.rolls ?? []).length === 0 ? (
          <p className="subtle">No rolls recorded yet - add one above.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>Spec</th><th>Serial</th><th>Total (m)</th><th>Remaining (m)</th><th></th></tr>
            </thead>
            <tbody>
              {(stock?.rolls ?? []).map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td>{r.type} {r.diameterMm.toFixed(2)}</td>
                    <td>{r.id}</td>
                    <td>{r.totalLengthM.toFixed(2)}</td>
                    <td>{r.remainingLengthM.toFixed(2)}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 90 }}>
                        <button className="btn secondary" onClick={() => setExpandedRoll(expandedRoll === r.id ? null : r.id)}>
                          {expandedRoll === r.id ? "Hide history" : "History"}
                        </button>
                        <button className="btn secondary" onClick={() => submitDeleteRoll(r.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                  {expandedRoll === r.id && (
                    <tr>
                      <td colSpan={5}>
                        {r.history.length === 0 ? (
                          <span className="subtle">No cuts recorded yet.</span>
                        ) : (
                          <table className="admin-table">
                            <thead><tr><th>Date</th><th>Job order</th><th>Cut (m)</th></tr></thead>
                            <tbody>
                              {r.history.map((h) => (
                                <tr key={h.id}>
                                  <td>{new Date(h.cutAt).toLocaleString()}</td>
                                  <td>{h.jobOrder}</td>
                                  <td>{h.cutLengthM.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
      </>
      )}

      {adminTab === "security" && (
      <>
      <div className="card">
        <h2>Change admin password</h2>
        <p className="subtle">
          This is the password used to access this page. There's also a separate master password
          (set as an environment variable by whoever manages the Vercel project) that always works
          as a fallback if this one is forgotten - ask them if you need it.
        </p>
        <div className="grid">
          <div className="field">
            <label>Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        {passwordMessage && (
          <p style={{ color: passwordMessage === "Password changed." ? "var(--good)" : "var(--bad)", fontSize: "0.82rem", marginTop: 8 }}>
            {passwordMessage}
          </p>
        )}
        <button
          className="btn"
          style={{ marginTop: 10 }}
          onClick={submitChangePassword}
          disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
        >
          {changingPassword ? "Saving..." : "Change password"}
        </button>
      </div>

      <div className="card">
        <h2>Team password</h2>
        <p className="subtle">
          Shared with the sales team - what they enter (along with their own name) to reach the
          calculator and stock pages. Sessions there auto-log-out after 15 minutes of inactivity,
          same as this admin session.
        </p>
        <div className="grid">
          <div className="field">
            <label>New team password</label>
            <input type="password" value={newTeamPassword} onChange={(e) => setNewTeamPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Confirm new team password</label>
            <input type="password" value={confirmTeamPassword} onChange={(e) => setConfirmTeamPassword(e.target.value)} />
          </div>
        </div>
        {teamPasswordMessage && (
          <p style={{ color: teamPasswordMessage === "Team password changed." ? "var(--good)" : "var(--bad)", fontSize: "0.82rem", marginTop: 8 }}>
            {teamPasswordMessage}
          </p>
        )}
        <button
          className="btn"
          style={{ marginTop: 10 }}
          onClick={submitChangeTeamPassword}
          disabled={changingTeamPassword || !newTeamPassword || !confirmTeamPassword}
        >
          {changingTeamPassword ? "Saving..." : "Change team password"}
        </button>
      </div>

      <div className="card">
        <h2>Login history</h2>
        <p className="subtle">
          Who signed in to the calculator/stock pages, and when. Kept automatically to the most
          recent 1000 entries - older ones drop off on their own, so this never needs manual cleanup
          just to stay a reasonable size. "Clear all" below is there if you want to wipe it anyway,
          but note that also erases the audit trail itself - worth thinking of as a rare, deliberate
          action rather than routine housekeeping.
        </p>
        {!teamLogs ? (
          <p className="subtle">Loading...</p>
        ) : teamLogs.length === 0 ? (
          <p className="subtle">No logins recorded yet.</p>
        ) : (
          <>
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Date &amp; time</th></tr></thead>
              <tbody>
                {teamLogs.slice((logsPage - 1) * LOGS_PER_PAGE, logsPage * LOGS_PER_PAGE).map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.name}</td>
                    <td>{new Date(entry.loginAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <LogsPagination
              page={logsPage}
              totalPages={Math.max(1, Math.ceil(teamLogs.length / LOGS_PER_PAGE))}
              onChange={setLogsPage}
            />
          </>
        )}
        <button className="btn secondary" style={{ marginTop: 12 }} onClick={submitClearLogs} disabled={!teamLogs || teamLogs.length === 0}>
          Clear all login history
        </button>
      </div>
      </>
      )}
    </>
  );
}
