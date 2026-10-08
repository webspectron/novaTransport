# Nuvexa Global Transport — Project Tracker

> **Context:** the platform is finished and working. This job is a **re-skin** for a new client: name, logo, photos,
> admin password and tracking-ID prefix change; design, palette, fonts, layout and features stay. See `CLAUDE.md §0`.
> Prompts for each phase are in `PROMPTS.md`. Target: about one hour.

**Owner:** Nuvexa Global Transport Ltd · **Repo:** https://github.com/ojrandy/nuvexaglobaltransport · **Target:** `nuvexaglobaltransport.com` on Hostinger
**Status legend:** `[ ]` to do · `[~]` in progress · `[x]` done · `[!]` blocked (see Needs owner)

---

## Phase 0 — Orientation & baseline (Prompt 00)
- [x] 0.1 Company facts in `CLAUDE.md §1` filled (domain, email, legal name, prefix confirmed 2026-10-03).
- [x] 0.2 Branch `nuvexa-rebrand`; baseline `npm run build` + `npm test` recorded below.
- [x] 0.3 "Before" sweep count recorded in REBRAND_MAP §6.

**Baseline (2026-10-03, branch `nuvexa-rebrand` from `8161ae7`, Node 22.14.0):** `npm run build` passes with 0 TypeScript errors (only Vite's >500 kB chunk-size warning). `npm test`: 33/33 pass.

## Phase 1 — Brand config & prefixes (Prompt 01)
- [x] 1.1 `src/config/brand.ts` updated with the Nuvexa facts.
- [x] 1.2 Tracking prefix `NGT`; references `NGT-SL/TKT/INV` built from it; tests updated.
- [x] 1.3 Tracking examples, placeholders, validation and help text use `NGT`. Admin-created shipment gets an NGT ID and tracks publicly.

## Phase 2 — Visible name sweep (Prompt 02)
- [x] 2.1 `index.html` meta, OG, JSON-LD, canonical; `site.webmanifest`.
- [x] 2.2 Pages, components, admin views, documents, help and legal text.
- [x] 2.3 Server strings (health, start log, settings defaults).
- [x] 2.4 Old SDL alt texts neutralised; code comments brand-neutral.

## Phase 3 — Internal identifiers (Prompt 03)
- [x] 3.1 CSS `--sdl-*` → `--ngt-*`, classes `sdl-` → `ngt-` (values unchanged).
- [x] 3.2 Storage keys `sdl_*` → `ngt_*`; legal cookie/storage list updated.
- [x] 3.3 Session cookie `sdl.sid` → `ngt.sid`.
- [x] 3.4 DB file `sdl_global.db` → `ngt.db`; legacy migration removed; fresh DB verified.
- [x] 3.5 Package name; image manifest and output folder renamed.

## Phase 4 — Logo & icons (Prompt 04)
- [x] 4.1 `Public/brand/ngt-logo.png`, `-white`, `-mark` generated from the supplied logo.
- [x] 4.2 Favicons, app icons, OG image regenerated; old `sdl-*` brand files deleted.
- [x] 4.3 Logo checked in header (light + dark hero), drawer, footer, admin, PDFs, quote print.

## Phase 5 — Photos (Prompt 05)
- [x] 5.1 Photo inventory and slot mapping approved by the owner (2026-10-03: branded photos removed, stock reused).
- [x] 5.2 Photos optimised into `Public/images/site/`; old SDL photos and originals removed.
- [x] 5.3 Alt texts updated in pages and CONTENT.md §12.

## Phase 6 — Final sweep & regression (Prompt 06)
- [x] 6.1 Sweep on source and build: zero unexplained hits.
- [x] 6.2 Regression on a fresh DB: pages, admin login, create → track, piece label, PDFs, quote flow, contact ticket.
- [x] 6.3 Visual comparison at 375px / 1440px: only name, logo and photos differ. *Also differ, by owner decision: Home H1 (`Faster, Safer, Further.`), tagline, +4 gateways (22 vs 18).*

## Phase 7 — Deploy (Prompt 07, DEPLOYMENT.md)
- [x] 7.1 Fresh history (owner chose option B): one clean commit force-pushed to `ojrandy/nuvexaglobaltransport` `main` after the owner's final go-ahead (DEPLOYMENT §2).
- [~] 7.2 New admin password hash + new session secret set in hPanel (never committed).
- [~] 7.3 Hostinger Node app: Node 22.x, install/start commands, env vars, `DB_PATH` outside the app folder.
- [~] 7.4 Domain and `www` on the one app; admin at the private path `/private-user/` (no subdomain); SSL forced.
- [ ] 7.5 Email mailbox + MX/SPF/DKIM/DMARC.
- [ ] 7.6 Live smoke test (DEPLOYMENT §7) passed; persistence confirmed after a redeploy.

---

## Needs owner
| # | Item | Needed for |
|---|---|---|
| 1 | ~~Domain~~ **Resolved 2026-10-03: nuvexaglobaltransport.com** | 1.1, 2.1, 7.4 |
| 2 | ~~Email~~ **Resolved: info@nuvexaglobaltransport.com** | 1.1, 7.5 |
| 3 | ~~Legal name~~ **Resolved: Nuvexa Global Transport Ltd.** Country of registration still TBD (legal pages governing-law clause) | Legal pages |
| 4 | ~~Tracking prefix~~ **Resolved: NGT** (owner changed it from NVX on 2026-10-03) | 1.2 |
| 5 | ~~Logo~~ **Supplied 2026-10-03: `images/nov.png`.** An SVG would still be sharper, but it is optional | 4.1 |
| 6 | Photos for every slot (see Prompt 05 mapping) | 5.1 |
| 7 | Admin password (owner generates the hash locally) | 7.2 |
| 8 | ~~Tagline~~ **Resolved 2026-10-03: "Faster • Safer • Further"** (TAGLINE, JSON-LD slogan). Docs still disagree on the OG/Twitter title form: CONTENT §1 has commas, REBRAND_MAP §1 bullets. Commas used for now; confirm | Home H1, OG title |
| 9 | Phone / WhatsApp / HQ address / social links (hidden until supplied) | F2 |
| 10 | Carried over: confirm the gateway list in `src/data/gateways.ts` applies to Nuvexa | Home, Locations, Contact |
| 11 | Carried over: lawyer review of the legal pages for Nuvexa's jurisdiction | Legal |
| 12 | Carried over: exchange rates in admin Settings → Tariff are entered by hand | Quotes |
| 13 | ~~Header logo tagline~~ **Resolved 2026-10-04: tagline-free `ngt-logo-header.png` in header + drawer** | 4.3 |
| 14 | ~~OG image~~ **Resolved 2026-10-04: keep the photo, scrim darkened to 0.82** | 4.2 |
| 15 | ~~Drawer email overflow~~ **Resolved 2026-10-04: drawer button text reduced to 0.75rem** | 4.3 |
| 16 | Gateways: owner asked for Asia + USA gateways (2026-10-04), then to keep Africa but list it last. Picked Seoul (ICN), Tokyo (NRT), Chicago (ORD), Miami (MIA) and new lanes; confirm or swap the cities | Home, Network |
| 17 | ~~Final yes for the force-push~~ **Done 2026-10-06** (`ea885fd`, see Change log). Still open: remove remotes `origin` + `sdl`. Also: keep or trim the SDL mentions in CLAUDE.md / PROMPTS.md / docs/*.md before pushing? | 7.1 |

## Decisions log
| Date | Decision |
|---|---|
| 2026-10-03 | Re-skin only: design, palette, fonts, layout, copy (except the name) and features stay as built. |
| 2026-10-03 | Internal identifiers that carry the old name (CSS prefix, cookie, storage keys, DB file, image folder) are renamed too, so page source and cookies show no previous-client name. |
| 2026-10-03 | Nuvexa starts with a fresh database. Code lives in ojrandy/nuvexaglobaltransport. |
| 2026-10-03 | Tagline: "Faster, Safer, Further" (comma form in text/code; bullets only in the logo artwork). |
| 2026-10-03 | Git history: **option B, fresh history.** At Prompt 07, `main` on ojrandy/nuvexaglobaltransport is replaced by one clean commit (force-push); the owner gives the final go-ahead at that moment. |
| 2026-10-03 | Prefix changed from NVX to **NGT** (tracking IDs and references) and **`ngt`** for internal identifiers (CSS, cookie, storage keys, DB file, logo files). |
| 2026-10-03 | All SDL-branded photos removed; their slots reuse the unbranded stock photos already in the repo until Nuvexa photos arrive. |

## Change log
| Date | Task | Change |
|---|---|---|
| 2026-10-03 | — | Prompt pack and docs rewritten for the Nuvexa re-skin. |
| 2026-10-03 | 0.1 | Owner confirmed domain, email, legal name (Ltd) and NVX prefix. |
| 2026-10-03 | — | Repo (ojrandy/nuvexaglobaltransport) and logo (images/nov.png) recorded in the docs. |
| 2026-10-03 | — | Tagline and fresh-history decision recorded. |
| 2026-10-03 | 0.2–0.3 | Branch `nuvexa-rebrand` created; baseline build + 33/33 tests green; before sweep: 2,888 source hits in 99 files. |
| 2026-10-03 | 1.1–1.3 | brand.ts set to Nuvexa facts, `TRACKING_PREFIX = 'NVX'`; reference prefixes/pattern built from it; DLS/SDL- examples, placeholders and messages now NVX; tests expect NVX and reject old DLS/SDL IDs (34/34). Verified: admin-created shipment got `NVX24BP9` and `/api/track` found it. |
| 2026-10-03 | 1.2–1.3 | Owner switched to `NGT`: tracking prefix, references, examples, tests and docs now NGT; planned internal identifiers (CSS, cookie, storage keys, DB file, logo files) use `ngt`. |
| 2026-10-03 | 4.1–4.2 | `ngt-logo.png`, `ngt-logo-white.png` (shadow faded, no halo), `ngt-mark.png` (globe + orbit arrow), favicons/app icons and OG image (port photo + white logo on Ink scrim) generated from `images/nov.png`; `sdl-*` brand files and `logo.jpeg` deleted. |
| 2026-10-03 | 5.1–5.3 | SDL-branded photos (`brand-img1–8`, `landingimage*`) and `screens/` deleted; heroes/callback/OG use the port photo, Services hero the warehouse photo, track-result card the air-cargo photo; output moved to `Public/images/site/` + `siteImages.ts`; alt texts and CONTENT §12 rewritten. Build + 34/34 tests green. |
| 2026-10-04 | 2.1–2.4 | Name sweep: index.html (title, meta, OG/Twitter, JSON-LD incl. slogan `Faster • Safer • Further`), webmanifest, App.tsx page meta, Home (H1 `Faster, Safer,` / `Further.`, WHY eyebrow), Track, Contact, Ship, Services, DocumentBrand (pouch line, legal footer), legalDocs ("Nuvexa", "we"; cookie text), gateways, /api/health + start log, CSS/service header comments. db.ts settings already from brand.ts. Left for Prompt 03: `sdl.sid` in legalDocs and the auth.ts comment. Build 0 errors, 34/34 tests; checked Home/Track/Result/Contact/Legal at 375+1440 and admin dashboard on a scratch DB. |
| 2026-10-04 | 3.1–3.5 | Scripted `sdl-`→`ngt-` / `sdl_`→`ngt_` over 79 files in src/ (CSS vars + classes, TSX classNames, storage keys `ngt_live_shipment_stream`, `ngt_recent_tracking`, `ngt_units`, `ngt_admin_shipment_draft`, legalDocs cookie/storage list); compiled CSS byte-identical to the pre-rename build apart from the prefix. `SESSION_COOKIE = 'ngt.sid'` (logout already uses the constant). `DB_FILE = 'ngt.db'`; old-brand migration removed from db.ts (`OLD_BRAND_SETTINGS`, `OLD_BRAND_TEXT`/`replaceOldBrandText`, `LEGACY_DB_FILE` warning); `.env.example` paths + comment. package name `nuvexa-global-transport` + lockfile. Build 0 errors, 34/34 tests; scratch-DB run: admin login, created `NGTZ6CTU`, tracked it, downloaded a label PDF, logout cleared `ngt.sid`. Pre-existing, left alone: `--ngt-radius-2xl` is used in 21 places but never defined (was `--sdl-radius-2xl`); `SEED_DEMO_DATA` in `.env.example` is no longer read by the code. |
| 2026-10-04 | 4.1–4.3 | Re-ran `optimize-images.mjs` (full + `--icons`): output byte-identical to `c298bbb`. Favicon `?v=4` already bumped. Checked on a scratch DB (headless Chrome, 375 + 1440): header (white bar above the dark hero, colour logo), drawer, footer + admin sidebar (white logo, no halo), admin login (shield icon, no logo by design), BOL/waybill PDF and quote print view (colour logo). Logo red ≈ accent-500, no clash. Tagline in header unreadable → Needs owner 13. |
| 2026-10-04 | 4.3 follow-up | Owner answers: `ngt-logo-header.png` (1200×261, cut at row 440 of the trimmed logo) via `LOGO_HEADER` in header + drawer; OG scrim 0.62 → 0.82; `.hotline-phone-btn` 0.875 → 0.75rem. Gateways LOS/ACC/NBO/JNB replaced by ICN, NRT, ORD, MIA (still 18); `Africa` region dropped; lanes, Home default hub (JFK), label (ICN), region copy (Home, About, Network meta, CONTENT §9) and "e.g. Lagos" placeholders updated; routing/intl/time-zone tests moved to Seoul/Busan/Osaka. Build 0 errors, 34/34 tests; checked at 375 + 1440. |
| 2026-10-04 | Gateways | Owner: keep Africa, listed last. LOS/ACC/NBO/JNB restored at the end of `GATEWAYS` (22 total) with their 5 lanes; `Africa` is the last region (Network page) and last in the region copy (Home, About, Network meta, CONTENT §9). Build 0 errors, 34/34 tests. |
| 2026-10-05 | 5.1–5.3 redo | Owner asked for free online photos. 13 Unsplash photos (licence + credits in `images/unsplash/SOURCES.md`), one per slot; 4 Pexels kept (air cargo, warehouse tablet, headset ×2). Every candidate checked for third-party branding: rejected photos with legible Maersk, DHL, Hapag-Lloyd, PSA, NYK, Swissport, Zalando and ship-name markings; the Pexels port photo (OOCL/Textainer/Nedlloyd containers) retired. Deleted unused originals `images/free-cc0/*`, `images/site/*`, `free-pexels/service-freight-linehaul.jpg`. OG image now uses the home hero. Alt texts replaced in Home/Services/About/Locations/Track/TrackResult + CONTENT §12. Build 0 errors, 34/34 tests; checked at 375 (DevTools emulation, no overflow) + 1440. |
| 2026-10-06 | 6.1–6.3 | Sweep: source 4 lines (negative tests only), build 0 text hits, asset names 0; image/lock-file hits are binary noise. Fresh build + 34/34 tests. Regression on scratch DB (built app, port 5055): pages, admin login (`ngt.sid`), create → `NGT6VGJS` → public track, `-01` piece label, quote → admin → publish → public `#/quote/QR-…`, contact → `NGT-TKT-692408`, BOL + label PDFs (valid, Nuvexa-branded), delivered → POD entry AVAILABLE, signer masked. Visual: headless Chrome vs `8161ae7` build, Home/Services/Track Result/admin at 375 + 1440: no new style signatures; differences only logo, name, photos, H1/tagline, 4 extra gateways, test data. Pre-existing (also in baseline, not changed): three 401 console errors on public pages (`/api/shipments`, `/api/quotes`, `/api/documents`); no separate POD PDF generator (POD is a status entry). |
| 2026-10-06 | 7.1–7.4 prep | Orphan branch `nuvexa-main`: one clean commit `b40b61e` (332 files; no `node_modules`/`dist`/`data`/`.env`/`screens`; §6 sweep = 4 negative-test lines in code, docs only otherwise; image bytes noise only). Build + 34/34 tests green. robots.txt/sitemap (server/seo.ts) and canonical/OG/Twitter/JSON-LD all on `https://nuvexaglobaltransport.com`; admin host gets `Disallow: /`, 404 sitemap, `noindex`. DEPLOYMENT §4: hidden-input hash command + exact hPanel env list. Waiting on owner: force-push go-ahead, hPanel setup, smoke test. |
| 2026-10-06 | 7.4 | Owner: the Hostinger plan allows only 5 Node apps, so admin moved from `private.` subdomain to `/private-user/` on the main domain. Path is server-only (`server/adminPath.ts`, env `ADMIN_PATH`); server serves `index.html` there with an `admin-console` meta marker + `noindex`/`no-store`; `ADMIN_SUBDOMAIN`/`ADMIN_HOST` removed. Verified on the built app: path absent from `dist/`, exact path → console + working login, `/admin`, look-alike paths and `#/admin` on a non-localhost host → not admin, robots.txt doesn't reveal it. Build 0 errors, 34/34 tests. |
| 2026-10-06 | 7.4 | Owner: Smartsupp live chat removed (loader in `index.html`, hide-on-admin effect in `App.tsx`); admin path shortened to `/private-user/`. |
| 2026-10-06 | 7.4 | Owner: keep `/private-user/` as the live admin path (no random `ADMIN_PATH`; simpler to run). Random-path docs from `e8724b5` reverted; `ADMIN_PATH` stays unset in hPanel. |
| 2026-10-06 | 7.1 | Owner go-ahead: `nuvexa-main` pushed to `webspectron/novaTransport` `main` (fast-forward `7e48f8b..ea885fd`) and force-pushed to `ojrandy/nuvexaglobaltransport` `main` (replaced SDL history `8161ae7`, `--force-with-lease`). Both at `ea885fd`. |
| 2026-10-08 | 7.4 | Owner: Smartsupp live chat re-added (key `87d8…75c1`) at the end of `index.html` `<body>`; skipped when the server marks the page `<meta name="admin-console">`, so it never loads on `/private-user/`. CSP is off in helmet, so no header change. |

---

## System notes (from the previous build's codebase walkthrough; still accurate)

**Shape.** One Node process. `server/index.ts` (Express 5) serves `/api/*` and the built SPA from `dist/`. Dev: Vite on
:3000 proxies `/api` to Express on :5000. Build: `tsc` (src) → `vite build` → `tsc -p tsconfig.server.json` → `dist-server/`.

**Routing.** No router library. `src/App.tsx` keeps `currentPage` in state and syncs it with `location.hash`
(`#/services`, `#/track/:id`, `#/quote/:id`). `KNOWN_PAGES` is the allow-list. Admin: `isAdminHost()` checks
`ADMIN_SUBDOMAIN` from `brand.ts`; on localhost `#/admin` also opens admin; anywhere else `#/admin` falls back to Home.

**Frontend ↔ API.** `src/services/api.ts` holds relative `fetch('/api/...')` calls. `AdminDataProvider`
(`src/context/AdminDataContext.tsx`) wraps the whole app; public visitors get 401s and the poller stops. Public tracking:
quote IDs (`QR…`) first, then `GET /api/track/:id` (PII-masked). The public site reads company contact info from `GET /api/settings`.

**Shared with Node.** `server/progress.ts` imports `src/services/{routingEngine,planningEngine,geocodingService}.ts` and
`src/shared/*`, so those files must stay DOM-free and are compiled by `tsconfig.server.json` too.

**Tracking IDs.** Allocated only by `server/trackingIds.ts` via `src/shared/trackingId.ts` (DB uniqueness check + retry);
clients adopt the server's ID. Piece labels are `<ID>-NN`; `/api/track` normalises input and resolves child labels.
Changing `TRACKING_PREFIX` in `brand.ts` changes generation, validation and the regex in one place.

**Admin auth.** Single shared password checked with `bcrypt.compare` against `ADMIN_PASSWORD_HASH` (rate-limited).
In-memory session store: cookie `SESSION_COOKIE` (httpOnly, sameSite=lax, secure in production, 12 h, trust proxy 1).
Every restart or redeploy logs everyone out.

**DB.** `node:sqlite` (Node ≥ 22.5) at `DB_PATH`, or `<cwd>/data/<DB_FILE>` if unset. WAL mode. Schema created in
`initDatabase()` with try/catch `ALTER` migrations. Seed runs only when `SEED_DEMO_DATA=true` and the table is empty.

**Images.** `scripts/optimize-images.mjs` reads originals from `images/`, writes `Public/brand/*`, the responsive photos
and the manifest `<ResponsiveImage>` reads. Card photos are square-cropped (340 px base) so rows line up.

**Fragile / worth knowing**
- `/api/diag/storage` is admin-only; use it once on Hostinger to confirm persistence, then remove it.
- `CreateShipmentView.tsx` (~4,000 lines) and `DocumentCenterView.tsx` (~2,000 lines): edit surgically.
- Schema columns (`*_state`, `*_zip`, `*_lbs`) are U.S.-shaped by origin; they stay.
