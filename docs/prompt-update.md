# Prompts: Payment options, Proof of payment & Approval

> **TEMPORARY: delete when the update is shipped** (Cleanup prompt at the end). Written 2026-10-13.
> **How to use:** start a Claude Code session in the repo root. Paste the **Master prompt**, then the prompt for
> **one phase**. One phase per session (split a phase if it grows large). Spec and checklist: `docs/update.md`.
> Reference implementation (read-only): `D:\Cortex\shipping\queenscargo` (below: **QC**).

---

## Master prompt (paste first, every session)

```text
You are a senior full-stack TypeScript developer maintaining the Nuvexa Global Transport platform, a LIVE production
system: React 18 + TypeScript + Vite 6 SPA (hash routing in src/App.tsx), Express 5 API in server/, SQLite via
node:sqlite, deployed to Hostinger from GitHub. You are adding one feature, "Payment options, Proof of payment &
Approval", by porting it from the Queens Cargo repo, which runs on the same codebase.

Read first, in this order:
1. CLAUDE.md (project rules; they win over anything here).
2. docs/update.md (spec + checklist for this update; it wins over this prompt; if the spec must change, edit it
   first and say why).
3. The files you will touch and their callers, then the matching QC reference files.
Then state in 3–5 lines: which task(s), which files, what could break.

Non-negotiables:
- Don't break existing features: tracking, admin login, shipment create/edit/delete/restore, documents/PDFs,
  quotes, contact, settings, the /private-user/ admin path. No rewrites, refactors, restyling or "while I'm here" fixes.
- Small commits, one task each, prefix feat: / content: / docs: / test: / fix:. Work on branch payments-update
  (create it from nuvexa-main if missing). NEVER push to main, or merge into the branch that deploys, unless the
  owner explicitly says so in this session (docs/update.md D-8): main auto-deploys to the live site.
- After every task: npm run build with ZERO TypeScript errors, and npm test green.
- Never touch .env, the live database, data/ngt.db or server/middleware/auth.ts logic. Never rename or drop
  existing tables or columns; only add new tables.
- No fake data: no seeded shipments, accounts, proofs or images. Test only on a scratch DB_PATH + UPLOADS_DIR
  (e.g. in your scratchpad), never the real one.
- The QC repo is READ-ONLY: never edit, build, install or run git commands that change it. Copy code from it by
  reading only. Carry no Queens Cargo name, logo, IDs (QS…), emails, copy, ngf_ / --ngf- identifiers or brand
  imports across: use brand.ts, --ngt- tokens, ngt_ keys, NGT IDs, REFERENCE_PREFIXES.
- Don't port QC's unrelated changes (package images, photo layout I.1, dashboard edit pen I.5, Edit Shipment
  fix I.7, removed imports, react-leaflet removal, lazy pages, compression).
- Public copy comes from docs/CONTENT.md: add it there first (flagged "owner to confirm"), then use it.
- Payment data never goes in settings (GET /api/settings is public). No email/SMTP. No gift cards.
- New dependencies: only qrcode + @types/qrcode (lazy-loaded) are pre-approved. Anything else: ask.
- Never invent business facts (methods, currencies, account numbers, wording). Ask.

Workflow per task: mark [~] in docs/update.md → smallest complete change → verify → commit → tick [x], add one
Change-log line in docs/update.md §11, add questions to §9.

Report after each phase: Done (1–2 sentences) · Files · Verified (commands + results, failures pasted as-is,
what was checked in the browser and at which widths) · Risks / follow-ups · Needs owner.
```

---

## Phase A — Storage foundation

```text
Goal: a persistent, private place for proof images and safe upload helpers. Covers docs/update.md A.1–A.3.

Read first
- Nuvexa: server/db.ts (dataDir/dbPath), server/index.ts, .env.example, docs/DEPLOYMENT.md §4 and §8, .gitignore.
- QC: server/uploads.ts, scripts/uploads.test.ts, src/services/imageCompress.ts, server/index.ts (ensureUploadDirs,
  start log), docs/update.md A.1–A.3 change-log lines.

Create / change
- server/uploads.ts (new): uploadsDir from UPLOADS_DIR (default beside DB_PATH, else data/uploads), ONLY a
  proofs/ folder (no images/), ensureUploadDirs, detectImageType, decodeImageUpload, resolveUploadPath,
  saveImageUpload, deleteUpload.
- server/index.ts: call ensureUploadDirs() where initDatabase() runs (not in ADMIN_PROXY_TARGET mode); add the
  uploads path to the start log. Touch nothing else there.
- src/services/imageCompress.ts (new).
- scripts/uploads.test.ts (new).
- .env.example + docs/DEPLOYMENT.md §4 (UPLOADS_DIR=/home/<hostinger-user>/nuvexa-data/uploads, outside the deploy
  folder) and §8 (back up the uploads folder with ngt.db).

Acceptance / verify
- npm run build (0 errors), npm test (34 + new tests pass).
- Start the server with scratch DB_PATH and UPLOADS_DIR: proofs/ is created; restart keeps files.
- Unit tests: WebP/JPEG/PNG accepted; text, SVG, GIF, PDF, HTML rejected; >2 MB rejected before decoding; names
  are <uuid>.<ext>; resolveUploadPath rejects "../x", "a.png", absolute paths.
- imageCompress: in a browser if available (3000×2000 PNG → ≤1600 px WebP, well under 2 MB; non-image rejected);
  otherwise say it is unchecked.
- Nothing serves UPLOADS_DIR statically; data/uploads is git-ignored (git status clean of it).

Stop and ask me if: the server already serves anything from data/; Hostinger paths in DEPLOYMENT.md conflict
with what you'd write; any change to existing behaviour seems needed.

When done: tick the items in docs/update.md, add a change-log line, commit with a clear message, and report what
changed, which files, how it was verified and any risks.
```

---

## Phase B — Payment method registry & icons

```text
Goal: one shared registry of payment method types (labels, fields, validators, customer view) and local icons.
Covers docs/update.md B.1–B.3. Method list: all 17 QC types, no mobile money (D-1).

Read first
- Nuvexa: src/config/brand.ts, docs/CONTENT.md §6, docs/update.md §8 and §9.
- QC: src/shared/paymentValidation.ts, src/shared/paymentMethods.ts, src/assets/payment-icons/ (SVGs + index.ts),
  scripts/payment-icons.mjs, src/components/PaymentIcon.tsx, scripts/paymentMethods.test.ts,
  scripts/paymentIcons.test.ts, QC docs/update.md §4 (icon sources table), QC docs/CONTENT.md §6.7.

Create / change
- src/shared/paymentValidation.ts, src/shared/paymentMethods.ts (the 17 QC types, D-1;
  no mobile money). Must stay DOM-free (also compiled for the server).
- src/assets/payment-icons/*.svg + generated index.ts, scripts/payment-icons.mjs, src/components/PaymentIcon.tsx
  (aria-hidden, lucide fallback: Landmark, Globe, CreditCard, Wallet).
- scripts/paymentMethods.test.ts, scripts/paymentIcons.test.ts.
- docs/CONTENT.md new §6.6 "Payment methods" (names, field labels, buttons, warnings, notes, Copy texts),
  flagged owner to confirm. docs/update.md §8 table: slug, use, colour, source URL + version, licence.

Acceptance / verify
- npm run build (0 errors), npm test green. Tests cover: IBAN mod-97 good/bad, sort code, ABA checksum, SWIFT,
  BTC/ETH/USDT per network, email, https + host check, either/or rules, unknown type rejected, customerMethodView
  hides empty optional fields.
- Placeholders use COMPANY_SHORT ("Nuvexa"), never QC names. Grep: no "Queens", "ngf", "QS" in new files.
- The icon test fails if index.ts drifts from the SVGs.

Stop and ask me if: a method's field set or validation rule is a business choice (e.g. which mobile-money
networks, phone format); an approved method has no CC0 icon; you're tempted to add gift cards.

When done: tick the items in docs/update.md, add a change-log line, commit with a clear message, and report what
changed, which files, how it was verified and any risks.
```

---

## Phase C — Payment request (admin)

```text
Goal: the admin can create, edit, delete and change the status of ONE payment request per shipment, with its own
accounts, from Create Shipment and Edit Shipment. Covers docs/update.md C.1–C.6. Currencies: USD/GBP/EUR, default USD (D-2).

Read first
- Nuvexa: server/db.ts, server/routes/documents.ts (PATCH /:id/payment-status), server/routes/shipments.ts
  (DELETE /:trackingNumber/permanent, trash/restore), server/index.ts (mounts), src/services/api.ts,
  src/shared/currency.ts, src/shared/references.ts, src/admin/components/EditShipmentModal.tsx,
  src/admin/pages/CreateShipmentView.tsx (≈4,000 lines: find the steps, the submit handler where the server ID is
  adopted, the success screen and the review step; edit surgically), src/context/AdminDataContext.tsx.
- QC: server/db.ts (table 9), server/routes/shipmentPayments.ts, server/routes/documents.ts
  (setDocumentPaymentStatus), server/routes/shipments.ts (permanent delete), src/shared/paymentRequest.ts,
  src/admin/components/PaymentRequestEditor.tsx/.css, ShipmentPaymentPanel.tsx/.css,
  src/components/PaymentMethodCard.tsx/.css, PaymentQr.tsx, src/services/api.ts (fetchApi, payment calls,
  fieldErrors), CreateShipmentView.tsx (search "payment"), EditShipmentModal.tsx (ShipmentPaymentPanel only).

Create / change
- server/db.ts: shipment_payments (docs/update.md §4), after the existing tables.
- server/routes/documents.ts: export setDocumentPaymentStatus(); the PATCH route uses it (same behaviour).
- src/shared/paymentRequest.ts (PAYMENT_CURRENCIES = ['USD','GBP','EUR'], default 'USD'; formatPaymentAmount via Intl.NumberFormat).
- server/routes/shipmentPayments.ts (GET/PUT/DELETE …/payment, POST …/payment/status); mount on /api/shipments.
- server/routes/shipments.ts: permanent delete also calls deleteShipmentPayment() (proof deletion is wired in E.1).
- src/services/api.ts: fetchApi for every call, fieldErrors, getShipmentPayment / saveShipmentPayment /
  setShipmentPaymentStatus / deleteShipmentPayment, credentials on getStats.
- src/admin/components/PaymentRequestEditor.*, ShipmentPaymentPanel.*, src/components/PaymentMethodCard.*,
  PaymentQr.tsx; npm install qrcode @types/qrcode.
- EditShipmentModal: <ShipmentPaymentPanel trackingNumber=…/> only. CreateShipmentView: optional payment step,
  saved after the ID exists, retry on failure, summary in review, excluded from the browser draft.
- scripts/paymentRequest.test.ts.

Acceptance / verify (scratch DB_PATH + UPLOADS_DIR, built or dev server)
- curl without a session: GET/PUT/DELETE/status → 401. Public POST /api/shipments with payment fields → shipment
  created, no payment row.
- With a session: PUT invalid (amount 0, no reason, bad IBAN, invoice of another shipment) → 400 with fieldErrors;
  valid → 201 AWAITING_PAYMENT; second PUT → 200, status kept; status transitions (cancel, mark_paid with invoice
  → invoice PAID in Document Center, reopen → PENDING); invalid transition → 409; trash → GET 404; restore → back;
  permanent delete → row gone.
- Document Center "mark paid / pending" still works exactly as before.
- Browser at 1440 / 768 / 375: Create Shipment with and without a payment request (invalid draft blocks Create and
  returns to the step); forced save failure (e.g. stop the API) shows the error + Try again on the success screen;
  Edit Shipment add / edit / delete / status buttons; live preview matches the customer card; no overflow, no
  console errors (the 3 known public-page 401s excepted).
- npm run build (0 errors), npm test green.

Stop and ask me if: the Create Shipment submit flow differs from QC so the save can't run after ID assignment;
fetchApi changes any existing call's behaviour beyond retries/messages; anything would convert a request amount with the Settings display currency.

When done: tick the items in docs/update.md, add a change-log line, commit with a clear message, and report what
changed, which files, how it was verified and any risks.
```

---

## Phase D — Public payment section

```text
Goal: the customer sees the payment request on the Track Result page. Covers docs/update.md D.1–D.5.

Read first
- Nuvexa: src/pages/TrackResultPage.tsx (route-map section ~787–806, main grid ~808, existing lazy imports and
  Suspense use), server/routes/track.ts, src/types/shipment.ts, src/utils/shipmentSync.ts (how track data flows),
  src/styles/tokens.css (use existing --ngt-* tokens only), docs/CONTENT.md §6.
- QC: src/components/PaymentSection.tsx/.css, PaymentMethodCard.*, PaymentQr.tsx, server/routes/track.ts (payment
  block), src/pages/TrackResultPage.tsx (lines ~60 and ~790), QC docs/CONTENT.md §6.8.

Create / change
- docs/CONTENT.md §6.7 "Track Result: payment section" FIRST (adapted from QC §6.8, Nuvexa names; flagged owner
  to confirm). Include the "Payment confirmed" event text.
- server/routes/track.ts: payment: publicPaymentView(...) or null (proof: null until Phase E).
- src/types/shipment.ts: payment?: PublicPayment | null.
- src/components/PaymentSection.tsx/.css (lazy via React.lazy + Suspense), tabs closed by default.
- TrackResultPage: render only when payment exists and status !== 'CANCELLED'.

Acceptance / verify (scratch DB)
- /api/track/<ID> for two shipments with different accounts: each shows only its own; no invoiceDocumentId,
  admin fields or other shipments' data; shipment without a request → payment: null and no section/chunk fetched.
- Browser at 320 / 375 / 768 / 1440 with worst-case values: amount formatting, badge, tabs (aria-expanded),
  accordion < 768 px / grid ≥ 768 px, Copy + "Copied" toast + aria-live, QR chunk fetched only on click, crypto
  warning; PAID shows "Payment received"; CANCELLED hides it. No overflow, no console errors.
- The rest of the Track Result page (hero, map, timeline, documents, help banner) looks and behaves as before.
- npm run build (0 errors), npm test green; note the public bundle-size change.

Stop and ask me if: the design needs a new colour/token or layout change outside the new section; copy wording is
missing.

When done: tick the items in docs/update.md, add a change-log line, commit with a clear message, and report what
changed, which files, how it was verified and any risks.
```

---

## Phase E — Proof upload

```text
Goal: the customer uploads a proof of payment; it is stored privately and moves the request into review.
Covers docs/update.md E.1–E.4.

Read first
- Nuvexa: server/uploads.ts, server/routes/shipmentPayments.ts, server/routes/track.ts, server/index.ts,
  server/middleware/rateLimit.ts, src/components/PaymentSection.tsx, src/services/imageCompress.ts.
- QC: server/db.ts (table 10), server/routes/paymentProofs.ts (latestPublicProof, deleteProofsForShipment),
  server/routes/trackProof.ts, server/middleware/rateLimit.ts (paymentProofLimiter), src/shared/paymentProof.ts,
  src/components/PaymentProofForm.tsx, scripts/paymentProof.test.ts.

Create / change
- server/db.ts: payment_proofs + 2 indexes.
- src/shared/paymentProof.ts; server/routes/paymentProofs.ts (helpers only in this phase).
- deleteShipmentPayment() also deletes proofs (rows + files).
- server/middleware/rateLimit.ts: paymentProofLimiter (5/hour/IP, code RATE_LIMITED).
- server/routes/trackProof.ts; mount app.use('/api/track', trackProofRouter) BEFORE trackRouter. Bad-ID message =
  the one already in server/routes/track.ts (NGT, 8 characters).
- track.ts: payment.proof = latestPublicProof(...).
- src/components/PaymentProofForm.tsx inside the "Send proof of payment" tab; api.submitPaymentProof.
- scripts/paymentProof.test.ts.

Acceptance / verify (scratch DB + scratch UPLOADS_DIR)
- Valid PNG → 201, request UNDER_REVIEW, file <uuid>.png in proofs/, snapshot stored; second submit → 409
  NOT_ACCEPTING; another shipment's account id → 400, no file; text / SVG / PDF / >2 MB → 400, no file; 4th open
  proof → 409 TOO_MANY_OPEN; 6th request in an hour → 429 RATE_LIMITED, another IP not blocked.
- Track API never exposes file name, payer, amount sent or reference; only status, submittedAt and (REJECTED only)
  the reason.
- Deleting the request or permanently deleting the shipment removes proof rows and files; trash/restore keeps them.
- Browser at 375 / 768 / 1440: empty submit errors, fill + upload (compressed WebP, preview, change/remove),
  success, then "Proof under review" after refresh; rejected state (set in the scratch DB until Phase F) shows the
  reason + form. No console errors.
- npm run build (0 errors), npm test green.

Stop and ask me if: express.json's 5 MB limit or trust-proxy setting would need changing; any public route could
reach UPLOADS_DIR.

When done: tick the items in docs/update.md, add a change-log line, commit with a clear message, and report what
changed, which files, how it was verified and any risks.
```

---

## Phase F — Admin Payments page & approve/reject

```text
Goal: the admin reviews proofs on a new Payments page, views them full size and approves or rejects them.
Covers docs/update.md F.1–F.3. "Payment confirmed" event ticked by default (D-4).

Read first
- Nuvexa: src/admin/AdminLayout.tsx (AdminViewType, VIEW_META, sidebar, Messages item as the pattern),
  src/admin/AdminApp.tsx, server/index.ts, server/eventTime.ts, server/routes/shipments.ts (how tracking events
  are inserted), src/config/brand.ts (OPERATIONS_CENTRE, ADMIN_ROLE_LABEL).
- QC: server/routes/paymentProofs.ts (paymentsRouter, approve/reject, addPaymentConfirmedEvent),
  src/admin/pages/PaymentsView.tsx/.css, src/admin/components/ProofFacts.*, ProofViewer.*,
  ProofReviewControls.*, AdminLayout.tsx and AdminApp.tsx (payments parts only), src/services/api.ts (proof calls).

Create / change
- paymentsRouter (list, private file, approve, reject) mounted: app.use('/api/payments', requireAdminAuth, ...).
- api: getPaymentProofs, approvePaymentProof, rejectPaymentProof.
- PaymentsView, ProofFacts, ProofViewer, ProofReviewControls (+ CSS with --ngt-* tokens).
- AdminLayout: 'payments' view, VIEW_META entry, sidebar button after Messages (Wallet icon). AdminApp: view branch.

Acceptance / verify (scratch DB)
- Without a session: list, file, approve, reject → 401. With: file → 200, Cache-Control private, no-store, nosniff.
- Approve: proof APPROVED, request PAID + paid_at, linked invoice PAID, event "Payment confirmed" in the scan
  history when ticked (none when unticked), shipment status unchanged; approving twice → 409; approving when the
  request is CANCELLED/PAID → 409.
- Reject: reason < 3 chars → 400; valid → REJECTED, request back to AWAITING_PAYMENT when no other proof waits
  (stays UNDER_REVIEW otherwise); customer sees "Proof not accepted: <reason>" and the form.
- Browser at 1440 / 768 / 375: filters + counts, search, viewer (Esc, focus trap and return), confirm dialogs,
  list reload. Trashed shipment's proofs disappear from the list. No console errors.
- npm run build (0 errors), npm test green.

Stop and ask me if: inserting the event needs fields the Nuvexa tracking_events table doesn't have.

When done: tick the items in docs/update.md, add a change-log line, commit with a clear message, and report what
changed, which files, how it was verified and any risks.
```

---

## Phase G — Notifications

```text
Goal: the admin notices new proofs without email. Covers docs/update.md G.1–G.3.

Read first
- Nuvexa: server/routes/stats.ts, src/admin/AdminApp.tsx (existing messages count poll), AdminLayout.tsx (bell
  popover, nav badges), src/admin/pages/OperationsCenter.tsx, AdminLayout.css / OperationsCenter.css.
- QC: server/routes/stats.ts, src/admin/AdminApp.tsx (SEEN_PROOFS_KEY, refreshProofsCount, toast),
  AdminLayout.tsx (newProofsCount, bell item), src/admin/components/NewProofsPanel.tsx/.css,
  OperationsCenter.tsx (NewProofsPanel only; NOT the edit pen or SlidersHorizontal change).

Create / change
- stats: submittedProofsCount (non-trashed shipments).
- AdminApp: 30 s poll while visible + on focus/visibilitychange; seen ids in localStorage key ngt_seen_proofs
  (every read/write in try/catch); toast linking to Payments filtered by tracking ID.
- AdminLayout: badge "{n} NEW" on Payments, bell count + "New payment proof(s)" item (keyboard-reachable).
- NewProofsPanel on OperationsCenter after the KPI cards.

Acceptance / verify (scratch DB)
- /api/stats 401 without session; count excludes approved/rejected and trashed-shipment proofs.
- Browser: submit a proof from another (private) window → within ~30 s badge, bell, toast and dashboard card appear
  without reload; approve/reject from the card's viewer clears them; reload doesn't repeat the toast; blocked
  storage doesn't crash. Check 1440 and 375. No console errors.
- Existing dashboard sections, messages badge and bell notifications unchanged.
- npm run build (0 errors), npm test green.

Stop and ask me if: the poll would add load the host can't take, or you need a websocket/push.

When done: tick the items in docs/update.md, add a change-log line, commit with a clear message, and report what
changed, which files, how it was verified and any risks.
```

---

## QA prompt (Phase H.1–H.4, H.6)

```text
Goal: prove the whole update works, is secure and broke nothing. Covers docs/update.md H.1–H.4 and H.6.
Use a fresh scratch DB_PATH and UPLOADS_DIR on the BUILT app (npm run build && npm start with those env vars, on a
spare port). Never the real data/ngt.db or the live site.

1. End-to-end (docs/update.md §1), in a browser at 1440 and 375: Create Shipment with a payment request (2
   methods) → NGT ID → customer tracks it in a private window → copies a field, opens a QR → uploads a proof →
   "Proof under review" → admin badge/bell/toast/card → approve with event → customer sees Paid + event. Repeat
   with a reject → customer sees the reason and the form → new proof → approve. Then reopen, edit amount and
   accounts, cancel (section hidden), delete request.
2. Security (curl / scripted HTTP; record each result):
   - /api/payments/proofs/<id>/file → 401 without a session, 404 for unknown ids, 200 with session + headers.
   - No public path returns a proof: /, /api/track/<ID>, /uploads/…, /data/…, /proofs/<file>, encoded ../ tries.
   - Non-images (txt, SVG with <script>, PDF, HTML, GIF), a renamed .png that is really text, >2 MB, >5 MB body →
     rejected, no file written, request unchanged.
   - Rate limit: 6th proof in an hour → 429; a spoofed X-Forwarded-For doesn't bypass it.
   - /api/track/A never shows shipment B's accounts, a removed account, invoice ids, payer names, references,
     amounts sent, file names or admin notes (except a rejection reason).
   - Every admin payment route → 401 without a session; GET /api/settings contains no payment data; the public
     booking POST ignores payment fields.
3. Regression: track lookup (ID, child label -01, lowercase/spaces, unknown ID), admin login/logout and ngt.sid,
   /private-user/ opens the console and /admin, #/admin on a non-localhost host do not, shipment create/edit/
   events/status/delete/restore/permanent delete, return to origin, Document Center generate + preview + PDF
   download + invoice paid toggle, quotes (submit → admin → publish → public page), contact form NGT-TKT- ticket,
   Settings save, Home/Services/Track pages at 375 and 1440 unchanged.
4. npm run build (0 errors), npm test (all pass, list the count), bundle-size delta vs the commit before Phase A,
   brand sweep from CLAUDE.md §6 plus: grep -rniE "queens|ngf|\bQS[0-9A-Z]{5}" src server scripts → nothing new.
5. Add the update to docs/PROJECT_TRACKER.md (Change log + System notes: payments, UPLOADS_DIR, proofs private).

Stop and ask me if any check fails in a way that needs a design or business decision. Fix plain bugs in the new
code only, one commit each, and re-run the affected checks.

When done: tick H.1–H.4 and H.6 in docs/update.md, add a change-log line, commit, and report every check with its
result, files changed, and any risks.
```

---

## Deploy prompt (Phase H.5)

```text
Goal: release the update to https://nuvexaglobaltransport.com safely. Covers docs/update.md H.5.
Precondition: QA prompt fully passed. The site is LIVE and Hostinger auto-deploys every push to GitHub main
(docs/update.md D-7). Do NOT push to main, or merge into the branch that deploys, until the owner explicitly says
"push to main" in this session (D-8). Until then, stop after step 2 and wait.

1. Prepare (Claude): confirm branch payments-update is clean, build + tests green; list the commits to release;
   update docs/DEPLOYMENT.md §4/§7/§8 if anything is missing. Show the owner the exact steps below.
2. Host (owner, in hPanel / File Manager or SSH; Claude gives exact clicks/commands, never handles passwords).
   Do this BEFORE the push so the new code starts with the right folder:
   - Read the existing DB_PATH in hPanel (it already exists and persists). Create an uploads/proofs folder in that
     same parent folder, OUTSIDE the app/deploy folder (e.g. <DB_PATH folder>/uploads/proofs).
   - hPanel env: add UPLOADS_DIR=<DB_PATH folder>/uploads. Leave DB_PATH, NODE_ENV and the secrets unchanged.
   - Back up ngt.db before deploying; add uploads/ to the backup routine.
3. Release (ONLY after the owner says "push to main"): merge payments-update into nuvexa-main and push to the
   nuvexa remote's main (fast-forward, never force) → the GitHub pipeline redeploys Hostinger.
4. Live re-test: /api/health ok; start log shows the uploads path; log in at /private-user/; create a test
   shipment with a payment request; track it from a phone (375) and desktop; upload a small proof; see the badge
   and toast; approve; customer sees Paid. Check the proof URL is 401 in a private window. Redeploy once more and
   confirm the shipment, request and proof image all survived (persistence). Then delete the test shipment
   permanently (removes its proof file) so no test data stays live.
5. Record results in docs/update.md (H.5) and docs/PROJECT_TRACKER.md; note anything that failed under Needs owner.

Stop and ask me if: the uploads folder can't be created outside the app folder; persistence fails after redeploy
(roll back by redeploying the previous commit and tell me); anything would need .env or the live DB edited by hand.
```

---

## Cleanup prompt (after the update is live and verified)

```text
Goal: make the permanent docs self-sufficient, then remove the temporary files.
1. Move the lasting facts into permanent docs:
   - docs/PROJECT_TRACKER.md: decisions from docs/update.md §10 (methods, currencies, event default, per-shipment
     accounts, no email, no gift cards) in the Decisions log; System notes on the payment tables, routes,
     UPLOADS_DIR, private proofs, rate limit and the stats poll; any still-open owner questions in Needs owner.
   - docs/DEPLOYMENT.md: UPLOADS_DIR, folder creation, backups and the live payment smoke test (if not already).
   - docs/CONTENT.md §6.6–6.7: remove "owner to confirm" only for wording the owner approved.
   - CLAUDE.md §4 "Where the brand lives" or §2: one line pointing to src/shared/paymentMethods.ts and
     server/uploads.ts, only if it helps future sessions (keep CLAUDE.md short).
2. Delete docs/update.md and docs/prompt-update.md. Grep the repo for links to them and fix any.
3. npm run build + npm test, commit "docs: payments update shipped; remove temporary plan", report.
Stop and ask me if any item in docs/update.md is still [ ] or [!].
```
