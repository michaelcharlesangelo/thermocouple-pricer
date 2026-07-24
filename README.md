# Thermocouple R/S/B Price Calculator

Sales team enters a spec (type, wire diameter, length, simplex/duplex,
local/export) and gets the current cost price. Cloud-hosted on Vercel with
Supabase storing the shared rates/config.

- `/` — the calculator
- `/admin` — market rates + pricing config

## What changed in this round

1. Number fields (length, rates, stock prices, etc) can now sit blank while
   you're editing/clearing them instead of snapping back to `0`.
2. Wire diameter dropdown now only shows 0.30 / 0.35 / 0.40 / 0.45 / 0.50mm.
3. **Handling factor is now split in two** — `wireHandlingFactorMarket` and
   `wireHandlingFactorStock` in `/admin` — so you can set the stock-price
   factor to `1` (no added factor) independently of the market-price factor.
4. Pt/Rh auto-fetch: fixed the actual bug — the previous code guessed the
   wrong Metal Sentinel endpoint/response field. It's now
   `GET /api/metal-quote?symbol=PT&currency=USD` reading `results.mid`,
   taken directly from Metal Sentinel's published docs. FX fetch (USD/EUR,
   USD/IDR) now also has a backup source (frankfurter.app) if the primary
   one has a hiccup, and sends proper headers to avoid being blocked.
5. "Metre" → "meter" throughout the UI.
6. Standard parts label reordered to "head, holding tube, ceramic tube,
   cement".
7. "Wire cost per meter" no longer says "(simplex)/(duplex)" — it's always
   shown as the simplex (single wire) rate; duplex is still correctly
   applied in the final scaled total, just not to this reference figure.
8. Confirmed (no bug): the standard parts price conversion for export is
   `standardPartsIdr / usdIdrRate` — Rupiah divided by the USD/IDR rate —
   which is the correct direction for IDR → USD.
9. Page title changed to "Thermocouple R/S/B Price Calculator".
10. Added the Tempsens logo (cropped to just the mark + wordmark, the
    "INSTRUMENTS" line removed) to the top of both pages —
    `public/logo.png`.
11. Standard parts price in `/admin` now formats with thousand separators
    automatically, same as the stock price fields.
12. Stock price section relabeled — it was already being applied to both
    local and export as of the previous round's bug fix (item 8 back then);
    this round just fixes the leftover "(local only)" wording that no
    longer matched what the code does.

**Also fixed automatically**: your previously-saved rates/config in
Supabase used the old field names (`wireHandlingFactor` as one field,
`lengthAllowanceMm`, `extras`). `lib/store.ts` now migrates that
automatically on read — your old handling factor value carries over into
both new market/stock fields, and the removed fields are just dropped. You
don't need to re-enter anything in `/admin`, though it's worth opening it
once after deploying to confirm the two handling-factor fields look right.

## How to push these changes live (GitHub → Supabase → Vercel)

No Supabase schema changes needed — same `app_kv` table as before, and the
migration above happens automatically in code.

Files that changed in this round:
- `lib/pricing.ts`
- `lib/fetchRates.ts`
- `lib/store.ts`
- `app/page.tsx`
- `app/admin/page.tsx`
- `app/layout.tsx`
- **New file**: `public/logo.png`

To update: in your GitHub repo, delete each changed file and re-upload the
new version (or edit in place) — same folder path as before. For the new
`public/logo.png`, create a `public` folder at the repo root if it doesn't
exist yet (GitHub's uploader creates folders automatically if you drop the
file into a path like `public/logo.png`), and upload it there.

Vercel is watching your `main` branch, so each commit auto-redeploys —
check the Deployments tab, about a minute per build.

## Optional: Pt/Rh auto-fetch via Metal Sentinel

1. Go to https://rapidapi.com → sign up (free) → search "Metal Sentinel" →
   subscribe to its free tier → copy your RapidAPI key.
2. In Vercel → your project → Settings → Environment Variables → add
   `RHODIUM_API_KEY` = that key → redeploy.
3. Click "Refresh rates" on `/admin` to test it. If it still doesn't work,
   the warning message shown will include the actual HTTP status / response
   body from Metal Sentinel — paste that here and I'll adjust the code to
   match (I've matched this to their published docs, but haven't been able
   to test it against a live key myself).

## How the price is calculated

1. Look up the wire spec (type S/R/B + diameter) → grams of Pt/Rh alloy per meter.
2. Convert today's Platinum/Rhodium spot price (USD/oz) → EUR/gram, apply the
   0.45% correction factor from the original sheet.
3. Add the manufacturing margin (tiered by assumed order size, set in `/admin`).
4. Convert to IDR (local) or USD (export) — this per-meter figure is always
   shown on a simplex (single wire) basis.
5. Compare against the **stock price** you're holding for that spec (IDR) —
   the higher of the two is used, decided once (in IDR) and applied
   consistently to both local and export.
6. × handling factor (market or stock, set separately in `/admin`) ×
   (length + 60mm)/1000 to scale to the actual item length — the +60mm is a
   fixed physical allowance (extra wire inside the head), applied per wire
   run, so duplex (two wire runs) doubles this whole step.
7. Local: +15% profit, + Rp 1,200,000 standard parts = **cost price (modal)**.
   Export: ÷(1-35%) margin, + parts cost converted to USD (divided by the
   USD/IDR rate) = **selling price**.

Every number above except the +60mm head allowance is editable on `/admin`.

Verified: this engine reproduces the original workbook's own worked example
(type S 0.50mm, 1170mm length, local, factor 1.2) exactly — Rp 16,359,455.

One thing carried over from the original spreadsheet, worth double-checking:
the IDR/meter conversion multiplies the Euro price directly by the USD/IDR
rate, rather than converting Euro→USD→IDR. That's what the workbook does, so
this app matches it — flag it if that was actually a small error in the
original sheet (one-line fix in `lib/pricing.ts`, search for `marketIdrPerMeterSimplex`).

## Notes

- The auto-fetched FX rate is a mid-market rate, not klikBCA's exact "kurs
  jual" — enter the precise BCA figure manually on `/admin` if that matters;
  manual values override until the next refresh.
- No login on either page, by design, per your earlier preference.
