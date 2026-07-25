# Thermocouple R/S/B Price Calculator

Sales team enters a spec (type, wire diameter, length, simplex/duplex,
local/export) and gets the current cost price. Cloud-hosted on Vercel with
Supabase storing the shared rates/config.

## New: /admin is now password protected

Clicking "Admin settings" now asks for a password before showing anything.

**You must set this up or /admin will be unreachable**: add an
`ADMIN_PASSWORD` environment variable in Vercel (Project → Settings →
Environment Variables) → redeploy. Pick any password you want - this is
your permanent recovery password.

There's no "email me the password" feature - setting up an email service
would be a whole separate integration this app doesn't have. Instead, the
recovery mechanism IS that environment variable: it always works to get
into `/admin`, no matter what the day-to-day password has been changed to
via the new **Security tab** inside `/admin`. If you (or your sales team,
if you ever give them admin access) forget the in-app password, just log
in with the `ADMIN_PASSWORD` value instead - you can always look that up in
Vercel's dashboard - then set a new one from the Security tab.

Once entered correctly, the browser remembers it (stored in that browser's
localStorage) until "Log out" is clicked - it won't ask again on every
visit from the same device/browser.

## Critical fix in this update - please read

Every "saved value doesn't show up" symptom you were seeing (Pt/Rh reverting,
FX rate not sticking, wire rolls sometimes missing or duplicating, front
page never showing stock) traced back to **one root cause**: Next.js's App
Router caches `fetch()` calls made inside route handlers by default, and
Supabase's client library uses `fetch` internally for its database calls.
That meant reads from Supabase could silently return an old cached snapshot
indefinitely - even immediately after a successful write, and even after a
full browser refresh (this is server-side infrastructure caching, which a
browser refresh can't clear).

Fixed with two layers, both included in this update:
1. `lib/supabaseClient.ts` now forces every Supabase request to bypass the
   cache (`cache: "no-store"`).
2. Every single API route now also declares `export const dynamic =
   "force-dynamic"` as a second, explicit guarantee.

Also added `{ cache: "no-store" }` to the browser-side fetch calls in
`app/page.tsx` and `app/admin/page.tsx`, to close off any remaining caching
layer end to end.


- `/` — the calculator (also has a Pricing/Stock tab switcher)
- `/stock` — public-facing wire stock summary (no serial numbers)
- `/admin` — market rates, pricing config, and wire roll inventory management

## Wire roll inventory (new)

Tracks actual physical stock, separate from the "stock price" used in
pricing calculations (that's still just a cost basis on `/admin`'s pricing
page - this is real roll-by-roll inventory).

- **Admin** (`/admin`, bottom of the page): add a roll (type, diameter,
  serial number, total length in meters); record a cut (pick the roll,
  enter how much was cut and a job order/description - this deducts from
  that roll's remaining length and logs it to that roll's history); view
  each roll's full cut history; delete a roll entirely if needed.
- **Public Stock tab** (`/stock`): shows total remaining meters per spec
  (e.g. "R 0.30 → 145m"), added up across all rolls of that spec - serial
  numbers and individual roll details are never shown here, by design,
  matching what you asked for.

No Supabase schema change needed for this either - it reuses the same
`app_kv` table with a new key (`thermocouple:stock`), same as everything
else in this app.

## How rates work (current design)

- **USD/EUR and USD/IDR**: fully automatic. Anyone clicking "Refresh FX
  rate" (on either page) pulls live rates — no signup, no key. Primary
  source is open.er-api.com, with frankfurter.app as a backup if that ever
  has a hiccup.
- **Platinum and Rhodium**: admin-entered only, always. There is no
  auto-fetch for these — by design, only whoever has access to `/admin` can
  change the metal basis. Type in today's figures from Kitco (or wherever
  you're sourcing them) and save. An earlier version of this app explored
  auto-fetching these via a third-party API (Metal Sentinel), but that's
  been removed — manual entry is simpler and fully reliable.

The calculator page shows current Pt/Rh values read-only (marked
"admin-set") plus a note: "For urgent inquiry, please contact Admin for
price changes" — so the sales team knows who to go to if a quote looks
off due to a stale metal price, without being able to change it themselves.

**Fixed a stale-data bug**: both `/` and `/admin` now automatically
re-fetch rates/config/stock whenever their browser tab regains focus (e.g.
switching back from another tab, or from your phone's app switcher) - so a
rate saved from `/admin` shows up elsewhere without anyone needing to
manually reload the page. Admin's save buttons also now show a clear error
message if a save actually fails, instead of silently doing nothing.

## How to push code changes live (GitHub → Vercel)

No Supabase schema changes needed for this update — same `app_kv` table.

Files changed in this round:
- `lib/fetchRates.ts` (rewritten — FX only, Metal Sentinel code removed)
- `app/api/rates/refresh/route.ts` (rewritten — FX only)
- `app/page.tsx` (button renamed, admin-set labels, contact note)
- `app/admin/page.tsx` (button renamed, copy updated)
- `.env.example` (simplified — no more RHODIUM_API_KEY)

Recommended way to update, given past experience with partial saves not
taking: open your repo in **github.dev** (press `.` on the GitHub repo
page), edit/replace each file listed above directly in that browser-based
editor, then use the Source Control panel to commit and **Sync Changes**
(push) in one go. Vercel picks up the new commit automatically — watch the
Deployments tab, about a minute per build.

## How the price is calculated

1. Look up the wire spec (type S/R/B + diameter) → grams of Pt/Rh alloy per meter.
2. Convert today's Platinum/Rhodium spot price (USD/oz, admin-entered) →
   EUR/gram, apply the 0.45% correction factor from the original sheet.
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
original sheet (one-line fix in `lib/pricing.ts`, search for
`marketIdrPerMeterSimplex`).

## Notes

- The auto-fetched FX rate is a mid-market rate, not klikBCA's exact "kurs
  jual" — enter the precise BCA figure manually on `/admin` if that matters;
  manual values override until the next refresh.
- No login on either page, by design, per earlier preference.
