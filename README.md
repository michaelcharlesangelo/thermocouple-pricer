# Thermocouple Price Calculator (R/S/B, noble metal)

Sales team enters a spec (type, wire diameter, length, simplex/duplex,
local/export) and gets the current cost price, using the same logic as the
SAFINA Excel price list. Fully cloud-hosted — once deployed there's nothing
to run locally, and it works from any device (laptop, iPhone, etc) at one URL.

- `/` — the calculator the sales team uses
- `/admin` — market rates + pricing config (profit %, stock prices, extras)

Two cloud pieces:
- **Supabase** — stores the current rates and config, so every device sees
  the same numbers.
- **Vercel** — hosts the actual website (Next.js needs somewhere to run;
  Supabase is a database, not a web host).

Everything below is done through the Supabase and GitHub/Vercel websites in
a browser — no terminal or local install required.

## 1. Create the Supabase project

1. Go to https://supabase.com → sign up (free) → **New project**.
2. Once it's created, go to **SQL Editor** (left sidebar) → **New query**,
   paste the contents of `supabase/schema.sql` from this project, and click
   **Run**. This creates the one table the app needs.
3. Go to **Settings → API**. You'll need two values in a minute:
   - **Project URL** (looks like `https://abcxyz.supabase.co`)
   - **service_role key** (under "Project API keys" — click reveal). Keep
     this private, it has full access to your project.

## 2. Get the code into GitHub (browser only, no git needed)

1. Unzip `thermocouple-pricer.zip` on your laptop just to get the files
   ready to upload (this is only to unpack the zip, not to run anything).
2. Go to https://github.com/new → create a new repository, e.g.
   `thermocouple-pricer` → **Create repository**.
3. On the new repo's page, click **uploading an existing file** (or
   **Add file → Upload files**). Drag in every file and folder from the
   unzipped project (everything except — there's no `node_modules` in the
   zip, so just drag the whole folder contents in).
4. Commit the upload directly to the `main` branch.

## 3. Deploy to Vercel

1. Go to https://vercel.com → sign up (free, "Continue with GitHub" is
   easiest) → **Add New → Project**.
2. Import the `thermocouple-pricer` repo you just created. Vercel
   auto-detects Next.js — leave the defaults.
3. Before clicking Deploy, expand **Environment Variables** and add:
   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key from step 1 |
   | `METALS_API_KEY` | *(optional, see below)* |
4. Click **Deploy**. After a minute or two you'll get a live URL like
   `https://thermocouple-pricer.vercel.app`.

That's it — open that URL on your iPhone (Safari, or add to Home Screen)
and on any laptop. Everyone hits the same live site and the same Supabase
data, no local setup for anyone.

## Optional: live Pt/Rh price auto-fetch

Sign up for a free key at https://metalpriceapi.com, then add
`METALS_API_KEY` as an environment variable in Vercel (Project → Settings →
Environment Variables → redeploy). Without it, "Refresh rates" still pulls
live FX rates (USD/EUR, USD/IDR via a free no-key API) but you enter Pt/Rh
manually on `/admin` — completely normal, just type in today's Kitco figures.

## How the price is calculated

1. Look up the wire spec (type S/R/B + diameter) → grams of Pt/Rh alloy per metre.
2. Convert today's Platinum/Rhodium spot price (USD/oz) → EUR/gram, apply the
   0.45% correction factor from the original sheet.
3. Add the manufacturing margin (tiered by assumed order size — default
   assumption is a 10m spool, i.e. the smallest tier).
4. Convert to IDR (local) or USD (export).
5. Compare against the **stock price** you're holding for that spec — the
   higher of the two is used.
6. × wire handling factor (1.2) × (length + 60mm)/1000 to scale to the
   actual item length.
7. Local: +15% profit, + Rp 1,200,000 standard parts, + any extras (flange
   etc, IDR). Export: ÷(1-35%) margin, + parts cost converted to USD, +
   extras in USD (e.g. SiC tube).

Every one of those numbers is editable on `/admin` — no code changes needed
to update pricing later.

Verified: this engine reproduces the original workbook's own worked example
(type S 0.50mm, 1170mm length, local) exactly — Rp 16,359,455.

One thing carried over exactly from the original spreadsheet, worth you
double-checking: the IDR/metre conversion multiplies the Euro price
directly by the USD/IDR rate, rather than converting Euro→USD→IDR. That's
what the workbook does (cell AE = AC × AG6), so this app matches it — but if
that was actually a small error in the original sheet, it's a one-line fix
in `lib/pricing.ts` (search for the `idrPerMeter` comment).

## Notes / things to sanity-check before trusting this for real quotes

- The auto-fetched FX rate is a **mid-market rate**, not klikBCA's specific
  "kurs jual" — enter the exact BCA figure manually on `/admin` if that
  matters; manual values always override until the next refresh.
- Only diameters 0.30 / 0.40 / 0.50mm have stock price fields pre-loaded
  (matching your existing reference table) — add more in `/admin`'s stock
  price table, or edit `DEFAULT_CONFIG.stockPrices` in `lib/pricing.ts`.
- There's no login on either page (by design, for simplicity, per your
  earlier answer). If you'd rather the `/admin` link not be guessable,
  ask and I can add a simple password gate.
- I don't have internet access in the environment I built this in, so I
  wasn't able to actually run `npm install` / a live Supabase call end to
  end — the calculation engine itself is verified by hand against your
  workbook's numbers, but if the deploy throws an error, paste it here and
  I'll fix it.
