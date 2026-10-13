# Update: Payment options, Proof of payment & Approval

> **TEMPORARY: delete when the update is shipped** (see the Cleanup prompt in `docs/prompt-update.md`).
> Written 2026-10-13. Tracker and spec for this one update. It follows `CLAUDE.md` and `docs/PROJECT_TRACKER.md`:
> modify the live system in place, one task → one small commit, `npm run build` with zero TypeScript errors and
> `npm test` green after every task. Tracking, admin login, shipment create/edit/delete/restore, documents/PDFs,
> quotes and the database must keep working.

**Status legend:** `[ ]` to do · `[~]` in progress · `[x]` done · `[!]` blocked (see §9 Needs owner)

**Summary.** The admin adds a **payment request** to a shipment: amount, currency, a required reason, and the
payment accounts the customer may use (bank transfer, PayPal, crypto, Zelle, Wise… 17 types). Anyone
tracking that shipment on the public **Track Result** page sees the amount, the reason and **only that shipment's
accounts**, then uploads a screenshot of the receipt as **proof of payment**. Proofs are private files. The admin
sees them on a new **Payments** page and on the dashboard (badge, bell, toast), views each one full size, and
**approves** (request → Paid, linked invoice → Paid, optional "Payment confirmed" timeline event) or **rejects** it
with a reason the customer sees. The feature is ported from Queens Cargo (`D:\Cortex\shipping\queenscargo`,
read-only), which runs on **the same codebase**, adapted to Nuvexa's names, prefixes and tokens.

---

## 1. What this update delivers

1. **Payment request per shipment (admin).** In Create Shipment (optional step, before the tracking ID exists) or
   Edit Shipment: amount, currency, required charge reason, optional due date, optional customer note, optional link
   to an existing `NGT-INV-` invoice of that shipment, and 1–10 payment accounts picked from a shared method
   registry (multi-select), each validated, with a live preview of the customer view. Statuses
   `AWAITING_PAYMENT → UNDER_REVIEW → PAID`, plus `CANCELLED`; admin can cancel, mark paid manually, reopen, delete.
2. **Public payment section** on `#/track/<ID>`: amount (`Intl.NumberFormat`), reason, due date, status badge;
   a "How to pay" tab with the accounts (Copy on every field, QR for crypto and payment links, lazy-loaded); a
   "Send proof of payment" tab with the form. Paid → "Payment received". Cancelled → section hidden.
3. **Proof upload (public).** Account used (this shipment's only), payer name, amount sent, optional reference,
   required image. Compressed in the browser (≤1600 px, WebP, JPEG fallback, EXIF/GPS stripped), checked by
   content on the server (JPG/PNG/WebP, 2 MB cap), stored as `<uuid>.<ext>` under `UPLOADS_DIR/proofs/`.
4. **Admin Payments page + approve/reject**, with a full-size viewer.
5. **Notifications (no email):** Payments sidebar badge, header bell item, "New payment proofs" dashboard card with
   thumbnails and inline Approve/Reject, and a toast when a new proof arrives.
6. **Resilient API calls:** non-JSON/network failures show a plain message with **Try again**; GETs retry.

### Example end-to-end flow
> Admin opens Create Shipment, fills in the shipment, and in the payment step enters **amount + currency**,
> reason "Customs duty – Invoice NGT-INV-104233", and picks two methods (e.g. a bank transfer account and a USDT
> wallet), typing each account's details → submits → the server assigns `NGT7K2M9`, and the payment request is
> saved through the admin payment route. The customer tracks `NGT7K2M9`, sees the amount, reason, badge
> "Awaiting payment", opens **How to pay**, copies the IBAN, pays, opens **Send proof of payment**, uploads a
> screenshot → "Proof under review". Within ~30 s the admin sees the badge, bell, toast and dashboard card →
> opens the screenshot → **Approve** (event box ticked) → request PAID, invoice PAID, "Payment confirmed" in the
> scan history. The customer refreshes: badge "Paid", "Payment received". (Reject instead → customer sees
> "Proof not accepted: *reason*" and the form again.)

---

## 2. Findings about this site (read-only study, 2026-10-13)

| Area | Finding |
|---|---|
| Stack | React 18.3 + TypeScript 5.7 + Vite 6.1 SPA; hash routing in `src/App.tsx` (`KNOWN_PAGES`, no router lib); plain CSS + `--ngt-*` tokens in `src/styles/tokens.css`; lucide-react icons. Express 5.2 API in `server/`, helmet (CSP off), express-session (in-memory), express-rate-limit 8, `trust proxy` = 1. Node ≥ 22.5. |
| Commands | `npm run dev` (API :5000 + Vite :3000), `npm run build` (tsc + vite build + server tsc), `npm test` (`node --import tsx --test scripts/*.test.ts`), `npm start`. **Baseline 2026-10-13: build 0 TS errors (only the old >500 kB chunk warning), tests 34/34.** |
| Database | SQLite via `node:sqlite` at `DB_PATH` or `data/ngt.db`; WAL; schema in `initDatabase()` (`server/db.ts`) with `CREATE TABLE IF NOT EXISTS` and try/catch `ALTER` migrations. No migration framework. Tables: `shipments`, `shipment_pieces`, `tracking_events`, `quote_requests`, `documents`, `settings`, `contact_messages`. **None are renamed or altered by this update.** |
| Admin auth | One shared password (bcrypt vs `ADMIN_PASSWORD_HASH`), session cookie `ngt.sid`, `requireAdminAuth` in `server/middleware/auth.ts` (401 JSON). Mixed routers (`shipments`, `documents`, `quotes`, `messages`) gate per route; `stats` is gated at the mount. Console served at the private path `/private-user/` (`server/adminPath.ts`); `#/admin` on localhost only. |
| Admin layout | `src/admin/AdminApp.tsx` switches on `currentView`; `AdminViewType`, sidebar buttons, header bell and `VIEW_META` are in `src/admin/AdminLayout.tsx`. A new page = add a view id, a `VIEW_META` entry, a sidebar button and a `currentView === …` branch. Dashboard is `src/admin/pages/OperationsCenter.tsx`. Data via `AdminDataProvider` (`src/context/AdminDataContext.tsx`) and `src/services/api.ts`. |
| What payment attaches to | **The shipment** (`shipments.tracking_number`, `NGT` + 5 chars) and its public page `#/track/<ID>` (`src/pages/TrackResultPage.tsx`, data from `GET /api/track/:id`). Same as Queens Cargo. Quotes (`QR-…`, `#/quote/<id>`) are pre-sale and are not a payment target. **Confirmed by the owner (D-3).** |
| Existing payment code to reuse | Invoices are `documents` rows with `doc_type = 'INVOICE'` and `charges_json.paymentStatus` (`PAID`/`PENDING`), toggled by `PATCH /api/documents/:id/payment-status` (`server/routes/documents.ts`). Extract that body into an exported `setDocumentPaymentStatus()` and reuse it (route behaviour unchanged). Invoice ref prefix `REFERENCE_PREFIXES.invoice` (`src/shared/references.ts`). No payment accounts, uploads or proof code exists. **No global payment-account list exists** → accounts are typed per shipment (QC D-9). |
| Existing upload code | Only base64-in-JSON signature/stamp images in Settings (stored in the settings blob). `express.json({ limit: '5mb' })` already allows a 2 MB image. No upload folder, no multer, no sharp at runtime. |
| Currency | `src/shared/currency.ts`: amounts stored in **USD**; admin picks a *display* currency (USD, NGN, GBP, EUR) with a manual exchange rate. A payment request is an exact amount owed, so it must **not** be converted by that display setting. A request may use **USD, GBP or EUR**, default USD (D-2). |
| Rate limiting | `server/middleware/rateLimit.ts` has `publicWriteLimiter` (40 / 15 min). Add `paymentProofLimiter` (5 / hour / IP) next to it. |
| Track page | Insert the lazy `PaymentSection` after the route-map section (`ngt-route-map-section`, ~line 787–806) and before `ngt-main-content-grid` (~line 808): the same slot QC uses. |
| Deployment | Hostinger Node app from GitHub `ojrandy/nuvexaglobaltransport` `main` (pushing `main` redeploys). Env in hPanel. `DB_PATH=/home/<user>/nuvexa-data/ngt.db` outside the deploy folder (DEPLOYMENT §4). **The site is live and auto-deploys from `main` via the GitHub pipeline; the owner confirms `DB_PATH` exists and persists (D-7).** Uploads must go in the same persistent area: `UPLOADS_DIR=/home/<user>/nuvexa-data/uploads` (also the default when `DB_PATH` is set). `.gitignore` already excludes `/data/`, so local `data/uploads` is never committed. |
| Rules files | `CLAUDE.md` (re-skin rules still apply: no design changes, names from `brand.ts`, no invented facts, no demo data, don't touch `.env`/live DB/auth logic), `docs/PROJECT_TRACKER.md`, `docs/CONTENT.md` (copy source; §6 is Track; last subsection is §6.5), `docs/DEPLOYMENT.md`. |
| Relation to Queens Cargo | Identical base. Before QC's update, only branding differed: `--ngf-`/`ngf_` → `--ngt-`/`ngt_`, `QS` → `NGT`, `queenscargo.db` → `ngt.db`, QC's `REFERENCE_PREFIX` → Nuvexa's `REFERENCE_PREFIXES`, QC's `TRACKING_ID_EXAMPLE` (absent here), and Nuvexa's private admin-path middleware. QC files port almost 1:1 after those renames. QC later also did unrelated clean-ups (removed imports, dropped `react-leaflet`, lazy pages, `compression`): **do not port those.** |

---

## 3. Mapping: Queens Cargo reference → Nuvexa

QC paths are relative to `D:\Cortex\shipping\queenscargo`. "Port" = copy, then rename `ngf`→`ngt`, `QS`→`NGT`,
QC brand imports → Nuvexa equivalents, and remove anything for package images (QC Phase B) or QC Phase I.1/I.5/I.7.

| QC reference | Nuvexa file | Action |
|---|---|---|
| `server/uploads.ts` | `server/uploads.ts` | New. Port; keep `images` folder out (proofs only) unless the owner later wants package images. |
| `server/db.ts` (tables 9, 10) | `server/db.ts` | Add `shipment_payments`, `payment_proofs` + indexes after the existing `CREATE TABLE`s. Skip `shipment_images`. |
| `server/routes/documents.ts` (`setDocumentPaymentStatus`) | `server/routes/documents.ts` | Extract the helper; route keeps its behaviour. |
| `server/routes/shipmentPayments.ts` | same | New. Port. |
| `server/routes/paymentProofs.ts` | same | New. Port (`latestPublicProof`, `deleteProofsForShipment`, `paymentsRouter`). |
| `server/routes/trackProof.ts` | same | New. Port; Nuvexa has no `TRACKING_ID_EXAMPLE`: reuse the exact message already in `server/routes/track.ts`. |
| `server/routes/track.ts` (payment block) | same | Add `payment` to the response. Skip `images`. |
| `server/routes/shipments.ts` (permanent delete) | same | Call `deleteShipmentPayment()` on permanent delete only. |
| `server/routes/stats.ts` | same | Add `submittedProofsCount`. |
| `server/middleware/rateLimit.ts` | same | Add `paymentProofLimiter`. |
| `server/index.ts` (mounts, `ensureUploadDirs`, start log) | same | Mount `shipmentPaymentsRouter` on `/api/shipments`, `trackProofRouter` on `/api/track` **before** `trackRouter`, `paymentsRouter` on `/api/payments` behind `requireAdminAuth`. Keep the admin-path middleware untouched. No `/media` route. |
| `src/shared/paymentValidation.ts` | same | New. Port. |
| `src/shared/paymentMethods.ts` | same | New. Port; all 17 types (D-1). |
| `src/shared/paymentRequest.ts` | same | New. Port; `PAYMENT_CURRENCIES = ['USD','GBP','EUR']`, default USD (D-2). |
| `src/shared/paymentProof.ts` | same | New. Port. |
| `src/assets/payment-icons/*.svg`, `index.ts`, `scripts/payment-icons.mjs` | same | New. Port only the icons for approved methods (Simple Icons, CC0). |
| `src/components/PaymentIcon.tsx` | same | New. Port. |
| `src/types/shipment.ts` (`payment?: PublicPayment \| null`) | same | Add the field only. |
| `src/services/api.ts` | same | Add `fetchApi` (I.6), payment/proof calls, `fieldErrors` passthrough, credentials on `getStats`. Skip image calls. |
| `src/services/imageCompress.ts` | same | New. Port. |
| `src/components/PaymentMethodCard.tsx/.css`, `PaymentQr.tsx` | same | New. Port (`qrcode` dependency). |
| `src/components/PaymentSection.tsx/.css`, `PaymentProofForm.tsx` | same | New. Port incl. tabs (I.2, I.3). |
| `src/pages/TrackResultPage.tsx` | same | Lazy `PaymentSection` in the slot from §2. Skip `PackageGallery`. |
| `src/admin/components/PaymentRequestEditor.tsx/.css` | same | New. Port incl. multi-select (I.4). `REFERENCE_PREFIX` → `REFERENCE_PREFIXES.invoice`. |
| `src/admin/components/ShipmentPaymentPanel.tsx/.css` | same | New. Port. |
| `src/admin/components/EditShipmentModal.tsx` | same | Add `<ShipmentPaymentPanel>` only (no images panel). |
| `src/admin/pages/CreateShipmentView.tsx/.css` | same | Add the optional payment step, save after ID assignment, retry on the success screen, summary in review. Surgical edits (≈4,000-line file). |
| `src/admin/components/ProofFacts`, `ProofViewer`, `ProofReviewControls` (.tsx/.css) | same | New. Port. |
| `src/admin/pages/PaymentsView.tsx/.css` | same | New. Port. |
| `src/admin/components/NewProofsPanel.tsx/.css` | same | New. Port. |
| `src/admin/AdminLayout.tsx/.css` | same | `'payments'` view, `VIEW_META`, sidebar item + badge, bell item. |
| `src/admin/AdminApp.tsx` (+ its CSS for the toast) | same | Poll, seen-proofs (`ngt_seen_proofs`), toast, `PaymentsView` branch. |
| `src/admin/pages/OperationsCenter.tsx` | same | Add `<NewProofsPanel>` only (not QC's I.5 edit pen). |
| `scripts/uploads.test.ts`, `paymentMethods.test.ts`, `paymentRequest.test.ts`, `paymentProof.test.ts`, `paymentIcons.test.ts` | same | New. Port with NGT IDs. |
| `docs/CONTENT.md` §6.6–6.8 | `docs/CONTENT.md` **§6.6 Payment methods**, **§6.7 Payment section** | Copy first, flagged *owner to confirm*. No package-images section. |
| `.env.example`, `docs/DEPLOYMENT.md` | same | `UPLOADS_DIR`, backups, smoke-test steps. |
| `src/data/legalDocs.ts` | same | Privacy line (approved, D-6) on payment proofs + `ngt_seen_proofs` in the storage list. |

---

## 4. Data model (new tables only)

Added in `initDatabase()` after the existing tables, with `CREATE TABLE IF NOT EXISTS` (safe on the live DB; no
existing table or column changes). No `ON DELETE CASCADE`: payment and proofs follow the shipment's trash/restore
and are removed in code only on **permanent** shipment delete.

```sql
CREATE TABLE IF NOT EXISTS shipment_payments (   -- ONE per shipment, written only by admin routes
  id TEXT PRIMARY KEY,                           -- crypto.randomUUID()
  tracking_number TEXT NOT NULL UNIQUE,          -- shipments.tracking_number (NGT + 5)
  amount REAL NOT NULL,                          -- > 0, rounded to 2 dp, ≤ 1,000,000,000
  currency TEXT NOT NULL,                        -- ISO 4217: USD | GBP | EUR (D-2)
  charge_reason TEXT NOT NULL,                   -- required, 3–200 chars, shown to the customer
  due_date TEXT,                                 -- YYYY-MM-DD or NULL
  methods_json TEXT NOT NULL,                    -- [{ id, type, label, details, instructions }], 1–10, in display order
  invoice_document_id TEXT,                      -- optional documents.id (doc_type INVOICE, same shipment)
  status TEXT NOT NULL,                          -- AWAITING_PAYMENT | UNDER_REVIEW | PAID | CANCELLED
  customer_note TEXT,                            -- optional, ≤ 300 chars, public
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_proofs (
  id TEXT PRIMARY KEY,                           -- = the uuid of the stored file
  payment_id TEXT NOT NULL,                      -- shipment_payments.id
  tracking_number TEXT NOT NULL,
  method_id TEXT,                                -- account id inside methods_json
  method_snapshot_json TEXT,                     -- { type, label, details } at submission time
  payer_name TEXT NOT NULL,                      -- 2–100 chars
  amount_sent REAL,
  reference TEXT,                                -- optional, ≤ 120 chars (tx id, MTCN…)
  file_name TEXT NOT NULL,                       -- <uuid>.<webp|jpg|png> under UPLOADS_DIR/proofs/
  status TEXT NOT NULL,                          -- SUBMITTED | APPROVED | REJECTED
  admin_note TEXT,                               -- rejection reason (3–300 chars), shown to the customer
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_payment ON payment_proofs (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs (status, created_at);
```

Files: `UPLOADS_DIR` (env; default `<dirname(DB_PATH)>/uploads`, or `data/uploads` when `DB_PATH` is unset) with a
`proofs/` subfolder created on start. Payment data is **never** stored in `settings`.

---

## 5. API

All responses use the existing `{ success, data }` / `{ success: false, error, fieldErrors?, code? }` shape.
`:id` = tracking number (normalised to upper case).

| Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `GET /api/shipments/:id/payment` | admin | – | `ShipmentPayment` or `null` | 401; 404 shipment missing/trashed |
| `PUT /api/shipments/:id/payment` | admin | `{ amount, currency, chargeReason, dueDate?, invoiceDocumentId?, customerNote?, methods: [{ id?, type, label?, details, instructions? }] }` | 201 created / 200 replaced, `ShipmentPayment` (new = `AWAITING_PAYMENT`; existing keeps status) | 400 + `fieldErrors` (`amount`, `chargeReason`, `methods.<i>.<field>`, `invoiceDocumentId` not an INVOICE of this shipment…); 401; 404 |
| `DELETE /api/shipments/:id/payment` | admin | – | `null` (request + its proofs, rows and files, removed) | 401; 404 none |
| `POST /api/shipments/:id/payment/status` | admin | `{ action: 'cancel' \| 'mark_paid' \| 'reopen' }` | `ShipmentPayment`. `mark_paid` sets `paid_at` + invoice PAID; reopen of PAID sets invoice PENDING | 400 unknown action; 401; 404; 409 invalid transition |
| `GET /api/track/:id` | public | – | **extended:** `payment: PublicPayment \| null` = amount, currency, chargeReason, dueDate, status, customerNote, paidAt, `methods[]` (this request's accounts only, customer view: fields, link, QR value, warning, note, instructions), `proof` (latest: status, submittedAt, rejectionReason only if REJECTED) | unchanged |
| `POST /api/track/:id/payment-proof` | public, `paymentProofLimiter` 5/h/IP | `{ methodId, payerName, amountSent, reference?, image }` (`image` = base64 or data URL) | 201 `{ status: 'SUBMITTED', submittedAt }`; request → `UNDER_REVIEW` | 400 bad ID / `fieldErrors` (incl. `image` not an image / too large); 404 no request; 409 `NOT_ACCEPTING` (not `AWAITING_PAYMENT`), `TOO_MANY_OPEN` (≥3 SUBMITTED); 413 body > 5 MB; 429 `RATE_LIMITED` |
| `GET /api/payments/proofs?status=` | admin | `status` = SUBMITTED / APPROVED / REJECTED / omitted | `AdminPaymentProof[]` newest first, max 500, trashed shipments excluded | 400 unknown status; 401 |
| `GET /api/payments/proofs/:id/file` | admin | – | image bytes, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` | 401; 404 |
| `POST /api/payments/proofs/:id/approve` | admin | `{ addTrackingEvent?: boolean }` (default true) | `AdminPaymentProof`. One transaction: proof APPROVED, request PAID + `paid_at`, linked invoice PAID, optional "Payment confirmed" event | 401; 404; 409 already reviewed / request not awaiting or under review |
| `POST /api/payments/proofs/:id/reject` | admin | `{ reason }` 3–300 chars | `AdminPaymentProof`. Proof REJECTED + `admin_note`; request back to `AWAITING_PAYMENT` if no other SUBMITTED proof | 400 `fieldErrors.reason`; 401; 404; 409 already reviewed |
| `GET /api/stats` | admin (existing) | – | **extended:** `submittedProofsCount` | unchanged |

The public booking `POST /api/shipments` **never** accepts payment data; Create Shipment calls `PUT …/payment` after the ID exists.

---

## 6. Security rules

- **Uploads:** base64 decoded server-side; size checked *before* decoding; ≤ 2 MB; type by **magic bytes** only
  (WebP/JPEG/PNG; SVG, GIF, PDF, HTML, text rejected); stored as `crypto.randomUUID()` + extension with `wx` flag;
  client file names and paths never used; any path resolved only through `resolveUploadPath()` (uuid regex).
- **Proof files are private:** no static or public route serves `UPLOADS_DIR`; the only route is
  `GET /api/payments/proofs/:id/file` behind `requireAdminAuth`, `private, no-store`, `nosniff`. Not under `/media`,
  `dist/` or `Public/`.
- **Rate limit:** dedicated `paymentProofLimiter` (5/hour/IP, counted in SQLite `rate_limit_hits` so restarts don't reset it, `trust proxy` = 1 as today, so a spoofed left-most
  `X-Forwarded-For` doesn't reset it). Plus: accepted only while `AWAITING_PAYMENT` (re-checked inside the
  transaction), max 3 open proofs per request; a rejected upload writes no file.
- **Ownership:** a proof's `methodId` must be an account of *this* shipment's request. `/api/track/:id` returns only
  this shipment's accounts and never: invoice id, payer names, amounts sent, references, file names/URLs, admin notes
  other than a rejection reason, or other shipments' data. Trashed shipments → 404 / excluded everywhere.
- **No payment data in public settings:** nothing goes into `settings` (`GET /api/settings` is public).
- **Admin writes** all behind `requireAdminAuth`; `auth.ts` logic untouched.
- **Privacy:** browser compression strips EXIF/GPS. Screenshots are personal data: include `UPLOADS_DIR` in backups
  and note it in the privacy text (D-6).
- **Not adding:** gift cards as a method (scam signal; QC D-1), email/SMTP, new auth, CSP changes.

---

## 7. Tasks

### Phase A — Storage foundation
- [x] A.1 `server/uploads.ts`: `UPLOADS_DIR` (default beside `DB_PATH`, else `data/uploads`) with `proofs/` created on start (`ensureUploadDirs()` in `server/index.ts`, path in the start log). Document in `.env.example` and `docs/DEPLOYMENT.md` §4/§8 (persistent folder outside the deploy dir, in backups).
- [x] A.2 Upload helper in `server/uploads.ts`: decode base64/data URL, magic bytes (WebP/JPEG/PNG), 2 MB cap, `<uuid>.<ext>` names, `resolveUploadPath`, safe delete. Test: `scripts/uploads.test.ts`.
- [x] A.3 `src/services/imageCompress.ts`: ≤1600 px, WebP (JPEG fallback, white background), quality steps to fit 2 MB, EXIF dropped, HEIC where the browser can decode it.

### Phase B — Payment method registry & icons
- [x] B.1 `src/shared/paymentValidation.ts` + `src/shared/paymentMethods.ts`: the 17 approved types (D-1) with label, icon key, fields, validators (email, https URL with host check, phone, IBAN mod-97, sort code, ABA routing, SWIFT/BIC, crypto address per coin/network, handles, account digits), `validatePaymentDetails`, `customerMethodView`. Test: `scripts/paymentMethods.test.ts`.
- [x] B.2 Icons: the 14 local Simple Icons SVGs (CC0) in `src/assets/payment-icons/`, generated `index.ts` via `scripts/payment-icons.mjs`, `<PaymentIcon type size />` with lucide fallback (`Landmark`, `Globe`, `CreditCard`, `Wallet`). Record source + colour per icon in §8 of this file. Test: `scripts/paymentIcons.test.ts`.
- [x] B.3 Copy: method names, field labels, warnings, notes and Copy-button text into `docs/CONTENT.md` §6.6 (flagged *owner to confirm*).

### Phase C — Payment request (admin)
- [x] C.1 `shipment_payments` table; `src/shared/paymentRequest.ts` (`validatePaymentRequest`, `publicPaymentView`, `formatPaymentAmount`, `PAYMENT_CURRENCIES = ['USD','GBP','EUR']`, default `USD`, D-2); `server/routes/shipmentPayments.ts` (`GET/PUT/DELETE …/payment`); mount; permanent shipment delete removes it; `setDocumentPaymentStatus` extracted in `documents.ts`. Test: `scripts/paymentRequest.test.ts`.
- [x] C.2 `POST …/payment/status` (cancel / mark_paid / reopen, 409 on invalid transitions, invoice sync).
- [x] C.3 `PaymentRequestEditor` (amount, currency, reason, due date, invoice link, note, multi-select methods → per-account forms "Account 2 of 3", edit/remove/reorder, live preview) + `PaymentMethodCard` + `PaymentQr` (`qrcode` dependency, lazy).
- [x] C.4 `ShipmentPaymentPanel` in `EditShipmentModal`: add / edit / delete / status buttons with confirmations; saved on its own; Try again on load failure.
- [x] C.5 Create Shipment: optional payment step (marked public), blocks Create while invalid, saved via `PUT …/payment` right after the ID is assigned; on failure the shipment stays and the success screen shows the error + Try again; summary in the review step; not in the browser draft.
- [x] C.6 `src/services/api.ts`: `fetchApi` wrapper for every call (GET/HEAD retried twice on non-JSON/network failure, writes sent once, plain messages), `fieldErrors` passthrough, payment calls, credentials on `getStats`.

### Phase D — Public payment section
- [x] D.1 Copy for the section, statuses, tabs, paid state, proof form, success/review/rejected/error messages and the "Payment confirmed" event into `docs/CONTENT.md` §6.7 (flagged *owner to confirm*).
- [x] D.2 `server/routes/track.ts`: `payment` block (via `publicPaymentView`; `proof: null` until E.1). `src/types/shipment.ts`: `payment?: PublicPayment | null`.
- [x] D.3 `PaymentSection` (lazy) on `TrackResultPage` after the route map: amount, reason, due date, note, status badge; "How to pay" tab (closed by default, `aria-expanded`) with accounts as a grid (≥768 px) / accordion (<768 px), Copy + toast + `aria-live`, QR toggle, crypto network warning.
- [x] D.4 Paid → "Payment received" + accounts behind the same tab; Cancelled → not rendered, chunk not fetched.
- [x] D.5 Responsive check with worst-case values (long IBAN, Taproot/USDT addresses, 200-char reason, 300-char note) at 320/375/768/1440: no overflow, no console errors.

### Phase E — Proof upload
- [x] E.1 `payment_proofs` table; `src/shared/paymentProof.ts`; `server/routes/paymentProofs.ts` (`latestPublicProof`, `deleteProofsForShipment`); deleting a request or permanently deleting its shipment removes proof rows and files. `track.ts` adds `payment.proof`. Test: `scripts/paymentProof.test.ts`.
- [x] E.2 `POST /api/track/:id/payment-proof` (`server/routes/trackProof.ts`, mounted before `trackRouter`) + `paymentProofLimiter`; rules from §5/§6; account snapshot; request → `UNDER_REVIEW`.
- [x] E.3 `PaymentProofForm` behind the "Send proof of payment" tab (closed by default): account (preselected if only one), payer name, amount (prefilled), reference, screenshot with preview/change/remove; same validation as the server; field errors with `aria-describedby`; 409/429 messages; success line.
- [x] E.4 Customer status: "Proof under review" (date + time, visitor locale) or "Proof not accepted: *reason*" with the form again.

### Phase F — Admin Payments page & approve/reject
- [x] F.1 `GET /api/payments/proofs?status=` and private `GET /api/payments/proofs/:id/file`, mounted on `/api/payments` behind `requireAdminAuth`.
- [x] F.2 `PaymentsView` (new sidebar item **Payments**): filters Submitted (default) / Approved / Rejected / All with counts, header search, refresh; each card: thumbnail, tracking ID, proof + request status, amount due vs sent (flag when different), method icon + name (snapshot), payer, reference, reason, received time, **View screenshot** (`ProofViewer`: full size, Esc, focus trap/return), **View shipment**. Shared `ProofFacts`.
- [x] F.3 `POST …/approve` and `…/reject` (one transaction each, rules in §5) + `ProofReviewControls` on cards and in the viewer: event checkbox (ticked by default, D-4), confirm before approve, reason required to reject; list reloads.

### Phase G — Notifications (no email)
- [x] G.1 `/api/stats` → `submittedProofsCount` (non-trashed). `AdminApp` polls every 30 s while visible and on focus/visibility change; Payments sidebar badge `{n} NEW`; bell item "New payment proof(s)" → Payments (keyboard-reachable).
- [x] G.2 `NewProofsPanel` on `OperationsCenter` (after the KPI cards): up to 6 thumbnails with tracking ID, time, amount due vs sent, method, reference; click → `ProofViewer` with Approve/Reject; empty state "Nothing to review"; "All Payments →".
- [x] G.3 Toast "New payment proof – NGT…" (or "{n} new payment proofs") linking to Payments filtered by tracking ID; seen ids in `localStorage` `ngt_seen_proofs` (try/catch, pruned to waiting proofs); auto-hide 10 s; ✕ dismiss.

### Phase H — QA, regression & deploy
- [x] H.1 §1 example flow end-to-end on a **scratch** `DB_PATH` + `UPLOADS_DIR` (never `data/ngt.db` or the live DB), at 1440 and 375.
- [x] H.2 Security checks (§6): accounts isolation; proof file 401 without session / 200 with, headers; no public path reaches proofs; non-images (txt, SVG with script, PDF, HTML, GIF) and >2 MB rejected with no file written; 429 on attempt 6; `/api/settings` has no payment data; admin routes 401 without session; public booking ignores payment fields.
- [x] H.3 Regression: track lookup + child label + unknown ID, admin login/logout (`ngt.sid`), shipment create/edit/delete/restore/permanent delete, tracking events, documents + PDF download, invoice paid toggle in Document Center, quotes (submit → admin → publish → public page), contact ticket `NGT-TKT-`, Settings save, `/private-user/` behaviour unchanged.
- [x] H.4 `npm run build` 0 errors, `npm test` green; bundle-size delta recorded (payment UI and QR lazy-loaded); old-brand sweep (CLAUDE.md §6) shows nothing new and **no Queens Cargo strings** (`grep -rniE "queens|ngf|\bQS[0-9]" src server scripts`).
- [ ] H.5 Deploy (owner + Claude): uploads folder on Hostinger beside the existing `DB_PATH`, `UPLOADS_DIR` in hPanel, backups; **push to `main` only when the owner explicitly says so (D-8)** → pipeline redeploys; live re-test; persistence after a second redeploy.
- [x] H.6 Log the update in `docs/PROJECT_TRACKER.md` (Change log + System notes on payments/uploads).

---

## 8. Payment method types and icons

**Approved (D-1): QC's 17 types, unchanged:** PayPal, Bitcoin (BTC), USDT (Tether), Ethereum (ETH), Zelle,
Cash App, Venmo, Apple Pay / Apple Cash, Google Pay, US bank transfer (ACH / wire), UK bank transfer (Faster
Payments), International wire (SWIFT / IBAN), Wise, Revolut, Card payment link, Western Union, MoneyGram. Fields,
validators and customer layout as in QC `src/shared/paymentMethods.ts` / QC `docs/update.md` §4. **No mobile money
yet; no gift cards.** Generic types use lucide `Landmark` (US/UK bank), `Globe` (wire), `CreditCard` (card link),
`Wallet` (fallback). Brand icons: the 14 Simple Icons SVGs QC bundles (incl. `stripe`, bundled but unused). Fill in
the table below during B.2 (copy QC's sources/colours, re-checking each file).

All 14 files are byte-identical to **Simple Icons 16.34.0**
(`https://cdn.jsdelivr.net/npm/simple-icons@16.34.0/icons/<slug>.svg`, package licence **CC0-1.0**), re-checked
2026-10-13. The marks remain trademarks of their owners: used only to identify the method, next to its name,
unmodified except for colour. `index.ts` is generated by `scripts/payment-icons.mjs`; `scripts/paymentIcons.test.ts`
fails if it drifts from the SVGs.

| Icon (slug) | Used for | Colour | Source / licence |
|---|---|---|---|
| `paypal` | PayPal | #002991 | Simple Icons 16.34.0 `paypal.svg`, CC0 · guidelines https://newsroom.paypal-corp.com/media-resources |
| `bitcoin` | Bitcoin (BTC) | #F7931A | Simple Icons 16.34.0 `bitcoin.svg`, CC0 |
| `tether` | USDT (Tether) | #50AF95 | Simple Icons 16.34.0 `tether.svg`, CC0 · guidelines https://tether.to/branding/ |
| `ethereum` | Ethereum (ETH) | #3C3C3D | Simple Icons 16.34.0 `ethereum.svg`, CC0 |
| `zelle` | Zelle | #6D1ED4 | Simple Icons 16.34.0 `zelle.svg`, CC0 |
| `cashapp` | Cash App | #00C244 | Simple Icons 16.34.0 `cashapp.svg`, CC0 |
| `venmo` | Venmo | #008CFF | Simple Icons 16.34.0 `venmo.svg`, CC0 · guidelines https://venmo.com/about/brand |
| `applepay` | Apple Pay / Apple Cash | #000000 | Simple Icons 16.34.0 `applepay.svg`, CC0 |
| `googlepay` | Google Pay | #4285F4 | Simple Icons 16.34.0 `googlepay.svg`, CC0 |
| `wise` | Wise | #163300 (Forest Green; the listed #9FE870 is too light on white) | Simple Icons 16.34.0 `wise.svg`, CC0 · guidelines https://wise.design/foundations/logo |
| `revolut` | Revolut | #191C1F | Simple Icons 16.34.0 `revolut.svg`, CC0 |
| `stripe` | bundled, not used by default (a card link may be Square etc.) | #635BFF | Simple Icons 16.34.0 `stripe.svg`, CC0 |
| `westernunion` | Western Union | #1A1A1A (the listed #FFDD00 is too light on white) | Simple Icons 16.34.0 `westernunion.svg`, CC0 |
| `moneygram` | MoneyGram | #DA291C | Simple Icons 16.34.0 `moneygram.svg`, CC0 |
| lucide `Landmark` / `Globe` / `CreditCard` / `Wallet` | US + UK bank / international wire / card link / unknown type | `--ngt-slate-700` | lucide-react (already a dependency, ISC) |

---

## 9. Open questions / Needs owner

All pre-Phase-A questions were **answered by the owner on 2026-10-13** (decisions D-1 … D-8 in §10):

| # | Question | Answer |
|---|---|---|
| Q1 | Which payment methods? | All 17 QC types; **no mobile money yet** (D-1) |
| Q2 | Currencies? | **USD, GBP, EUR**; default **USD** (D-2) |
| Q3 | What payments attach to | The shipment the admin creates it on, shown on its track page (D-3) |
| Q4 | "Payment confirmed" event by default? | Yes (D-4) |
| Q5 | Use QC-adapted copy, flagged for review? | Yes (D-5) |
| Q6 | Privacy line on proofs? | Yes; policy already reviewed by the owner's legal team (D-6) |
| Q7 | Hosting / persistence | Live on Hostinger, auto-deploy from GitHub `main`; `DB_PATH` exists and persists (D-7) |
| Q8 | Branch / release | Work on a branch; **never push to `main` unless told** (D-8) |

**Still open** (add new ones here as they come up):
- [ ] Owner review of the CONTENT.md §6.6–6.7 wording once written (D-5).
- [ ] Owner: create the uploads folder and set `UPLOADS_DIR` in hPanel at H.5 (Claude gives exact steps).
- [ ] Owner: the new privacy-policy sentence (D-6) is added text; pass it to the legal team if they want to see every change.
- [ ] Owner (found in H.1, **not caused by this update**, same on the pre-update build): on a public Track Result page the hash effect in `src/App.tsx` (deps `getShipment` — a new function each render — and `currentShipment`) re-fetches `GET /api/track/:id` in a loop (~35 requests/s per open tab in headless Chrome). Fixing it touches routing code outside this update: fix it as a separate commit, or leave it?

Confirmed out of scope unless you ask: QC's **package images** (Phase B there), QC I.1 (photo layout), I.5 (dashboard
edit pen), I.7 (Edit Shipment worldwide fix), email notifications, a shared/global account list, gift cards.

---

## 10. Decisions log
| # | Date | Decision |
|---|---|---|
| D-1 | 2026-10-13 | **Methods:** all 17 QC types (§8). **No mobile money for now** (can be added later as one registry entry). No Nigerian bank type. No gift cards. |
| D-2 | 2026-10-13 | **Currencies:** a payment request is in **USD, GBP or EUR**; **USD is the default**. Shown in its own currency, never converted by the Settings display currency. NGN is not offered. |
| D-3 | 2026-10-13 | **Target:** a payment request belongs to the one shipment the admin creates it on, shown on that shipment's Track Result page only. Not on quotes. |
| D-4 | 2026-10-13 | **"Payment confirmed" event** on Approve: **on by default**, checkbox to untick. |
| D-5 | 2026-10-13 | **Copy:** new CONTENT.md §6.6–6.7 wording (adapted from QC) may be used, flagged *owner to confirm* for later review. |
| D-6 | 2026-10-13 | **Privacy:** add a line on payment screenshots/payer names and `ngt_seen_proofs` to `src/data/legalDocs.ts`. The owner says the privacy policy has been reviewed by their legal team. |
| D-7 | 2026-10-13 | **Hosting:** the site is live on Hostinger, auto-deployed from GitHub `main` via the pipeline; `DB_PATH` already exists and persists. Uploads go beside it (`<DB_PATH folder>/uploads`); set `UPLOADS_DIR` explicitly in hPanel. |
| D-8 | 2026-10-13 | **Git:** work on branch `payments-update`. **Never push to `main` (or merge into the branch that deploys) unless the owner explicitly says so**; pushing `main` redeploys the live site. |
| D-9 | 2026-10-13 | Accounts are typed **per shipment** (no global account list), as in QC. Emails/SMTP not used; notifications are dashboard-only. |

## 11. Change log
| Date | Task | Change |
|---|---|---|
| 2026-10-13 | — | Plan written (this file + `docs/prompt-update.md`) from a read-only study of this repo and Queens Cargo. No application code changed. Baseline: build 0 TS errors, 34/34 tests. |
| 2026-10-13 | — | Owner answered Q1–Q8 (D-1 … D-9): 17 methods, no mobile money; USD/GBP/EUR, USD default; per-shipment; event on by default; copy + privacy line OK; live on Hostinger auto-deploy, DB_PATH persists; never push to `main` unless told. Phase A can start. |
| 2026-10-13 | A.1–A.2 | `server/uploads.ts` (proofs/ only, magic-byte check, 2 MB cap, `<uuid>.<ext>`, `resolveUploadPath`), `ensureUploadDirs()` + uploads path in the start log, `UPLOADS_DIR` in `.env.example` and DEPLOYMENT §4/§8. Test `scripts/uploads.test.ts`. Build 0 errors, tests 39/39; scratch server creates `proofs/`, files survive restart, `/uploads/*` and `/proofs/*` 404. |
| 2026-10-13 | A.3 | `src/services/imageCompress.ts` ported (≤1600 px, WebP/JPEG fallback, EXIF dropped). Browser check deferred to E.3, where it is first used. |
| 2026-10-13 | B.1–B.3 | Payment method registry ported: `src/shared/paymentValidation.ts` + `paymentMethods.ts` (17 types, D-1; DOM-free, compiled for the server), 14 Simple Icons SVGs (byte-checked against 16.34.0, CC0) + generated `index.ts` via `scripts/payment-icons.mjs`, `src/components/PaymentIcon.tsx` (`--ngt-slate-700` fallback colour). Tests `scripts/paymentMethods.test.ts` (+ Solana/Polygon address and hidden-empty-field cases) and `paymentIcons.test.ts` (fails on drift, checked by tampering). CONTENT.md §6.6 written (*owner to confirm*), §8 icon table filled. Build 0 errors, tests 49/49. |
| 2026-10-13 | C.1–C.6 | Payment request per shipment: `shipment_payments` table, `src/shared/paymentRequest.ts` (USD/GBP/EUR, default USD, D-2; `PublicProofStatus` kept here until E.1), `server/routes/shipmentPayments.ts` (GET/PUT/DELETE + status, mounted before `shipmentsRouter`), `setDocumentPaymentStatus()` extracted (PATCH unchanged), permanent delete removes the request. `fetchApi` for every call (GET retries, plain messages, `fieldErrors`, credentials on `getStats`). `PaymentRequestEditor`, `ShipmentPaymentPanel` (Edit Shipment), `PaymentMethodCard`, lazy `PaymentQr` (`qrcode`, 25.8 kB own chunk). Create Shipment: payment block in step 5 (as in QC, not a new wizard step), saved after the ID, Try again on failure, review summary, not in the draft. QR copy added to CONTENT.md §6.6. Test `scripts/paymentRequest.test.ts`. Build 0 errors, tests 55/55; scratch-server API checks 29/29; browser at 1440/768/375. |
| 2026-10-13 | D.1–D.5 | Public payment section: CONTENT.md §6.7 (section, tabs, paid, proof form, messages, "Payment confirmed" event; *owner to confirm*). `GET /api/track/:id` adds `payment` (`publicPaymentView`, `proof: null` until E.1); `Shipment.payment`. `src/components/PaymentSection.tsx/.css` lazy on `TrackResultPage` between the route map and the main grid, only when a request exists and isn't cancelled; How to pay tab closed by default, grid ≥768 px / accordion <768 px, Copy toast (`aria-live`), lazy QR, paid → "Payment received" with accounts behind the same tab. Proof form and proof states wait for E.3/E.4. Existing tokens only. Build 0 errors, tests 55/55; scratch-server API checks 15/15 (account isolation, no invoice/admin fields, `null` without a request); browser 158/158 at 320/375/768/1440 with worst-case values (31-char IBAN, Taproot, 200-char reason, 300-char note, €999,999,999.99): no overflow, no console errors, no chunk for shipments without/with a cancelled request. Bundle: main `index` +0.4 kB (702.19 → 702.59 kB); on demand `PaymentSection` 4.3 kB JS + 5.6 kB CSS and a shared `PaymentMethodCard` chunk (30.5 kB, split out of `AdminApp`, which went 396.3 → 366.2 kB). |
| 2026-10-13 | E.1–E.4 | Proof upload: `payment_proofs` + 2 indexes; `src/shared/paymentProof.ts` (`validateProofSubmission`, limits; `PublicProofStatus` moved here from `paymentRequest.ts`); `server/routes/paymentProofs.ts` helpers only (`latestPublicProof`, `deleteProofsForShipment`), called from `deleteShipmentPayment()` so deleting the request or permanently deleting the shipment removes rows and files (trash/restore keep them); `paymentProofLimiter` (5/h/IP, `RATE_LIMITED`); `server/routes/trackProof.ts` mounted before `trackRouter`, bad-ID text shared with `track.ts` (`BAD_TRACKING_ID_MESSAGE`); `track.ts` returns `payment.proof`. `PaymentProofForm` behind the closed "Send proof of payment" tab, `api.submitPaymentProof`, under-review / rejected states; QC proof CSS ported (existing tokens only). `express.json` 5 MB and `trust proxy` 1 unchanged. Test `scripts/paymentProof.test.ts`. Build 0 errors, tests 60/60; scratch-server API checks 46/46 (PNG 201 → UNDER_REVIEW, `<uuid>.png`, snapshot; 409 NOT_ACCEPTING / TOO_MANY_OPEN; cross-shipment account, text, SVG, PDF, >2 MB → 400 with no file; 429 on the 6th, spoofed left-most XFF ignored, other IP fine; track exposes only status/submittedAt/rejection reason; no public path serves proofs; delete/trash/restore/permanent delete); browser 99/99 at 375/768/1440 (empty-submit errors with `aria-describedby` + focus, non-image rejected, 2400 px PNG → 1600 px WebP preview, change/remove, success, under review after refresh, rejected reason + form, single account preselected, no overflow, no console errors). Bundle: main `index` 702.59 → 702.82 kB; lazy `PaymentSection` 4.3 → 15.5 kB JS, 5.6 → 9.4 kB CSS. |
| 2026-10-13 | E fixes | Owner asked to fix the E.1–E.4 risks. (1) `paymentProofLimiter` counts in SQLite (new table `rate_limit_hits`: key = limiter + HMAC of the IP with `SESSION_SECRET`, no IP stored, expired rows pruned), so a restart/redeploy no longer resets it; other limiters unchanged. (2) Bodies over the unchanged 5 MB `express.json` limit now get 413 `TOO_LARGE` "The request is too large." instead of a generic 500-style message; the form shows "This image is too large. Try a smaller image or take a new screenshot." for that and for an image the compressor can't fit under 2 MB (CONTENT.md §6.7, *owner to confirm*). (3) Proof files are written as `<uuid>.<ext>.part` and renamed only after the row commits; on start `recoverProofUploads()` finishes staged files that have a row and removes the rest, and never deletes a finished file. Tests 62/62 (+2 in `uploads.test.ts`), build 0 errors; scratch-server checks 16/16 (limit survives restart: hits 4–5 allowed, 6th 429; other IP fine; no IP in the table; >5 MB → 413, no file; crash recovery), Phase E API checks 46/46 again, browser 105/105 at 375/768/1440 (incl. 413 message + focus). Backups: `UPLOADS_DIR` is set by the owner at the next redeploy. |
| 2026-10-13 | F.1–F.3 | Admin Payments page: `paymentsRouter` in `server/routes/paymentProofs.ts` (list `?status=` newest first, max 500, trashed excluded; private file route `private, no-store` + `nosniff`; approve/reject, one transaction each; `addPaymentConfirmedEvent` writes "Payment confirmed" with the shipment status unchanged, location = current city/state or `OPERATIONS_CENTRE`, `recorded_by` = `ADMIN_ROLE_LABEL`, `eventTime` zone; no new columns needed) mounted on `/api/payments` behind `requireAdminAuth`; `AdminPaymentProof` in `src/shared/paymentProof.ts`; `api.getPaymentProofs/approvePaymentProof/rejectPaymentProof`. `PaymentsView`, `ProofFacts`, `ProofViewer`, `ProofReviewControls` (+ CSS, existing `--ngt-*` tokens only) ported from QC; `payments` view + `VIEW_META` + sidebar item after Messages (Wallet). Badge/bell/toast left for G.1/G.3. Fixed QC mojibake in the viewer title (`Â·` → `·`). Build 0 errors, tests 62/62; scratch-server API checks 50/50 (401 ×4 without session; file 200 + headers; approve → APPROVED, PAID + `paid_at`, invoice PAID, one event, status unchanged; unticked → no event; 409 twice / CANCELLED / PAID; reject 400 <3 / >300, 409 twice, stays UNDER_REVIEW while another proof waits, else AWAITING_PAYMENT, track shows the reason; trash hides, restore shows); browser 97/97 at 1440/768/375 (filters + counts, search, mismatch flag, viewer focus/trap/Esc/return, confirm dismiss/accept, unticked from viewer, reject reason, refresh, trashed proof gone, customer sees "Proof not accepted: <reason>" + form, no overflow, no console errors). Bundle: main `index` 702.82 → 703.35 kB (api calls). |
| 2026-10-13 | G.1–G.3 | Notifications without email, ported from QC: `/api/stats` gains `submittedProofsCount` (SUBMITTED proofs joined to non-trashed shipments; stats stays behind `requireAdminAuth`). `AdminApp` polls stats every 30 s while the tab is visible and again on `focus`/`visibilitychange`; the proof list is only fetched when the count is above 0. Seen ids in `localStorage` `ngt_seen_proofs` (every read/write in try/catch, pruned to waiting proofs; blocked storage → first poll only records, no toast). Toast "New payment proof – NGT…" / "{n} new payment proofs" opens Payments with the header search set to the tracking ID; auto-hide 10 s; ✕ dismiss. `AdminLayout`: Payments badge `{n} NEW`, bell count + "New payment proof(s)" item (`role="button"`, `tabIndex=0`, Enter/Space, `:focus-visible`), `.item-dot.payment`. `NewProofsPanel` (+ CSS, `--ngt-*` tokens only) on `OperationsCenter` between the KPI row and Recent Shipments; Approve/Reject in its viewer refreshes the badge straight away. QC's edit pen / SlidersHorizontal and other QC CSS deltas not ported. Build 0 errors, tests 62/62; main `index` 703.35 kB unchanged. Scratch checks: API 25/25 (401 without session and after logout; count excludes approved, rejected and trashed-shipment proofs, restore counts again; existing stats keys intact); browser 50/50 + 7/7 on `/private-user/` (proof sent from a separate context through the track form → badge/bell/toast/card in 22 s without reload; focus refresh; toast → Payments filtered; approve + reject from the card viewer clear everything; reload doesn't repeat; blocked storage doesn't crash or repeat; Messages badge and bell empty state unchanged; 1440 + 375, no overflow, toast unobstructed). Only console noise: the existing pre-login 401s, and Smartsupp failing when storage is blocked on the localhost `#/admin` path (the chat isn't loaded on `/private-user/`). |
| 2026-10-13 | H.1–H.4, H.6 | QA on the **built** app (`npm start`, scratch `DB_PATH` + `UPLOADS_DIR` in the session scratchpad, port 5077, no `.env` loaded; never `data/ngt.db` or the live site). **H.1** §1 flow in headless Chromium, admin on `/private-user/` + customer in a separate context: 43/43 at 1440 and 43/43 at 375 (create with wire + USDT → `NGT…` → track, Copy IBAN to clipboard + toast, USDT warning, QR → proof → under review → toast in ≤ 19 s, badge = waiting count, bell, dashboard card → viewer → approve with event → Paid + "Payment confirmed" in scan history; reopen → proof → reject → reason + form → new proof → approve; reopen, edit amount $980 + swap wire for PayPal, cancel hides the section, delete removes rows; no overflow, no unexpected console errors). **H.2** 78/78 over HTTP (12 admin routes 401 without/with forged session; proof file 401 / 404 unknown / 404 traversal ids / 200 `image/png` same bytes + `private, no-store` + `nosniff`; 19 public/encoded paths never return a proof; txt, SVG+script, PDF, HTML, GIF, text renamed .png, raw base64 → 400, >2 MB → 400, >5 MB → 413, no file or row written, request unchanged; another shipment's account → 400; `/api/track` shows only this shipment's remaining accounts, no invoice id, payer, reference, amount sent, file name, admin keys, only a rejection reason; `/api/settings` and `settings` table hold no payment data; booking POST ignores payment fields; proofs 201 + 409 ×4 then 429 `RATE_LIMITED`, spoofed left-most XFF still 429, other IP not blocked, no raw IP stored). Production mode: `ngt.sid` is `HttpOnly; Secure; SameSite=Lax` behind HTTPS. **H.3** 61/61 HTTP + 33/33 browser: track by ID, `-01`/`-02`, lowercase + spaces, unknown 404, malformed 400; login/logout + `ngt.sid`; `/private-user/` marked, `/`, `/admin`, `/private-user/x` not, path absent from bundle/robots/sitemap; on host `nuvexa.test` `#/admin` and `/admin` don't open the console, `/private-user/` does, UI Log Out works; create/edit/event add + correct/status/return/trash/restore/permanent delete (removes request, proofs, file); Document Center generate → preview → PDF download (`%PDF`, 250 kB) → Mark as Paid/Pending; quotes submit → admin → publish → public page "Total $480" at 1440/375, customer accept; contact `NGT-TKT-######`; Settings save. Home, Services, Track, Track Result, Contact **pixel-identical** to the pre-update build (`a2e7384`) at 375 and 1440 (0.000 %). **H.4** build 0 TS errors (only the old >500 kB warning), tests 62/62; bundle vs `a2e7384`: main `index` JS 700.52 → 703.35 kB (+2.83; gzip +0.84), main CSS 435.91 → 439.01 kB (+3.10), `AdminApp` JS 344.22 → 383.17 kB (+38.95) + new `AdminApp` CSS 20.85 kB; on demand only: `PaymentSection` 14.72 kB JS + 9.41 kB CSS, `paymentProof` 31.87 kB JS + 3.92 kB CSS, QR (`browser`) 25.78 kB; all JS 1,978.6 → 2,092.8 kB. Sweeps: CLAUDE.md §6 4 hits = the same 4 negative-test lines as before; Queens Cargo sweep 12 hits = same 12 substring false positives (`HandlingFee`, `meaningful`) as before, 0 new. No application code changed. Found, not fixed (pre-existing): Track Result refetch loop (§9). |
