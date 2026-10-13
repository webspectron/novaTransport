# Deployment: GitHub → Hostinger (Nuvexa Global Transport)

> **Context:** the platform is finished and working, and this exact setup has been deployed to Hostinger before. This
> guide points it at Nuvexa's new repo and domain. `{{DOMAIN}}` and `{{EMAIL}}` are the values in `CLAUDE.md §1`.

The app is **one Node.js process**: Express serves the API (`/api/*`) and the built React site (`dist/`). It stores
data in a **SQLite file**, which shapes everything below.

---

## 1. Hosting requirements

| Need | Why |
|---|---|
| A Hostinger plan that runs **Node.js web apps** (Business / Cloud web hosting, or a VPS) | Static hosting can't run the API, tracking or admin |
| **Node.js ≥ 22.5** (22.x LTS or newer) | `server/db.ts` uses the built-in `node:sqlite` |
| **Persistent storage** outside the deploy folder | The database must survive every redeploy |
| HTTPS (free SSL in hPanel) | The admin session cookie is `secure` in production |

hPanel labels change from time to time; if one below doesn't match, look for the equivalent setting.

## 2. Repository

**Repo:** https://github.com/ojrandy/nuvexaglobaltransport (git remote `nuvexa` in this folder). Everything lives here.

Its `main` currently holds this project's full history (commit `8161ae7` and earlier), which includes the previous
clients' names. **Owner decision (2026-10-03): fresh history (option B).** At Prompt 07, `main` is replaced by one clean
commit. This overwrites what is on GitHub and can't be undone from there, so Claude prepares it and the owner gives the
final yes before the push:

1. Confirm `.gitignore` excludes `node_modules/`, `dist/`, `dist-server/`, `/data/`, `.env`, and that `screens/` and
   unused previous-brand images are gone.
2. Build the clean commit and review it (file list + REBRAND_MAP §6 sweep on it):
   ```bash
   git checkout --orphan nuvexa-main && git add -A && git commit -m "Nuvexa Global Transport: initial import"
   ```
3. After the owner's yes:
   ```bash
   git push --force nuvexa nuvexa-main:main
   git remote remove origin && git remote remove sdl
   ```

The local branches with the old history stay on this machine as a backup until the site is live; delete them after.

## 3. Hostinger app configuration

| Setting | Value |
|---|---|
| Source | GitHub → `ojrandy/nuvexaglobaltransport`, branch `main` |
| Node version | 22.x (or newer LTS) |
| Install command | `npm install` (`postinstall` already runs `npm run build`) |
| Build command | only if the panel insists: `npm run build` (don't build twice) |
| Start command | `npm start` → `node dist-server/server/index.js` |
| Port | the platform's `PORT` env var (the server reads `process.env.PORT`) |

## 4. Environment variables (set in hPanel, never commit)

```ini
NODE_ENV=production
PORT=<provided by Hostinger or 5000>
ADMIN_PASSWORD_HASH=<bcrypt hash of the NEW Nuvexa admin password>
SESSION_SECRET=<NEW 64 hex chars>
SEED_DEMO_DATA=false
DB_PATH=/home/<hostinger-user>/nuvexa-data/ngt.db   # a folder OUTSIDE the app/deploy directory
UPLOADS_DIR=/home/<hostinger-user>/nuvexa-data/uploads   # payment-proof screenshots, same persistent folder
```

**New admin password.** The owner picks it and runs this locally in the project folder (it needs `bcryptjs` from
`node_modules`). The first command asks for the password with hidden input, so it never lands on screen, in shell
history, in a file, a commit or a chat:
```bash
node -e "const r=require('readline').createInterface({input:process.stdin,output:process.stdout});r._writeToOutput=()=>{};process.stdout.write('New admin password: ');r.question('',p=>{r.close();console.log('\n'+require('bcryptjs').hashSync(p,12))})"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Paste the outputs into `ADMIN_PASSWORD_HASH` and `SESSION_SECRET`. **Never reuse the previous client's values.**

**hPanel → Environment variables (Nuvexa):** `NODE_ENV=production`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`,
`SEED_DEMO_DATA=false`, `DB_PATH=/home/<hostinger-user>/nuvexa-data/ngt.db` (the server creates the folder). Set `PORT`
only if the panel doesn't. Leave `ADMIN_PROXY_TARGET` **unset**: the admin console is part of the same app.
Leave `ADMIN_PATH` **unset** too: the console stays at the default `/private-user/` (owner, 2026-10-06; see §5).
Setting it later moves the console to another path without a code change.

**Uploads folder:** `UPLOADS_DIR` holds payment-proof screenshots in a `proofs/` subfolder (private, served only
through an admin-only route). The server creates it on start. When unset it defaults to an `uploads` folder next to
the database. Like `DB_PATH`, it **must** point outside the deploy directory. The startup log (hPanel → app logs)
prints the database path and the uploads path in use.

**Database.** Nuvexa starts with a **fresh** `ngt.db`; nothing is migrated from the previous client. The server
creates the schema on first start.

**Check persistence before launch:** log in to the admin console, then open
`https://{{DOMAIN}}/api/diag/storage` in the same browser. Redeploy and open it again. If `markerFirstSeen` stays
the same, storage persists. **Then remove that endpoint.**

## 5. Domains & DNS

| Host | Points to | Purpose |
|---|---|---|
| `{{DOMAIN}}` | Node app | Public site |
| `www.{{DOMAIN}}` | Redirect → apex | |

**Admin console: `https://{{DOMAIN}}/private-user/`** (owner, 2026-10-06). It's a path on the same app,
not a subdomain, so the whole site is **one** Hostinger Node app and needs no extra DNS record.

- The path lives only in `server/adminPath.ts` (overridable with the `ADMIN_PATH` env var). The server serves
  `index.html` there with a `<meta name="admin-console">` marker that `isAdminConsolePage()` in `src/App.tsx` reads,
  so the path never appears in the public JS bundle.
- Exact match only: `/private-user` and `/private-user/` open the console; anything else under it,
  `/admin` and `#/admin` on the live domain do not. The console page is sent with `noindex, nofollow` and `no-store`.
- **Keep the path private.** Don't put it in `robots.txt`, the sitemap, links, or anything public. A path hides the
  console and cuts bot noise; the password and login rate limit are still what protect it.
- SSL on for both hostnames; force HTTPS.

## 6. Email ({{EMAIL}})

- Create the mailbox (Hostinger Email or Google Workspace).
- DNS: **MX** from the provider · **SPF** `v=spf1 include:<provider> ~all` · **DKIM** (from the provider) ·
  **DMARC** `v=DMARC1; p=quarantine; rua=mailto:{{EMAIL}}`.
- Send a test to Gmail → "Show original" → SPF/DKIM/DMARC = PASS.

## 7. Launch checklist (smoke test on the live domain)

- [ ] Home loads over HTTPS with the Nuvexa logo and photos, no console errors.
- [ ] `/api/health` returns `ok` with service name "Nuvexa Global Transport API".
- [ ] `{{DOMAIN}}/private-user/` → login works with the **new** password; the old SDL password does not. `/admin` and `#/admin` on the public domain do **not** open admin.
- [ ] Create a shipment in admin → it gets an `NGT` + 5-character ID → the public Track page finds it.
- [ ] Waybill / POD PDFs download and show Nuvexa branding only.
- [ ] Quote request → appears in admin → quote link opens publicly.
- [ ] Contact and callback forms show an `NGT-TKT-` reference.
- [ ] No demo data: `SEED_DEMO_DATA=false`; tracking `NGT7K2M9` says "not found".
- [ ] Redeploy once; the shipment above still exists (persistence).
- [ ] View source, the cookie name (`ngt.sid`), `/brand/og-image.jpg` (200, `image/jpeg`) and a link preview (e.g. WhatsApp): all Nuvexa.
- [ ] `canonical`, `og:url`, `og:image`, `twitter:image` point at the exact live host (apex vs `www`). Then run the URL
      through the Facebook Sharing Debugger and LinkedIn Post Inspector.
- [ ] Final sweep on the live HTML/JS bundle (REBRAND_MAP §6).

## 8. After launch

- **Backups:** copy `ngt.db` **and the `UPLOADS_DIR` folder** (both in `nuvexa-data/`) daily to off-server storage;
  test a restore once. The uploads hold customers' payment screenshots (personal data): keep the copies private.
- **Updates:** push to `main` → Hostinger redeploys.
- **Monitoring:** a free uptime monitor on `/api/health` (5-minute interval) with alerts to {{EMAIL}}.
- **Security:** rotate `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` if anyone with access leaves; `npm audit` monthly.
