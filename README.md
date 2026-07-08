# HolexSS Keysystem 2026

> Secure key verification with Work.ink gating and one-click Railway deployment.

A complete, single-page key authentication system featuring a dark, premium SaaS aesthetic, a 3-step verification flow (identifier → Work.ink task → key generation), a localStorage-backed key dashboard, and a production-ready Express backend that **also serves the frontend** — one Railway deployment handles everything.

---

## What's in the box

```
holexss-keysystem/
├── index.html          ← Single-page frontend (self-contained, no build step)
├── server.js           ← Express backend (5 endpoints + serves index.html)
├── package.json        ← Node.js dependencies & scripts
├── package-lock.json   ← Lockfile (REQUIRED for Railway Railpack builds)
├── nixpacks.toml       ← Explicit build config for Railway's Nixpacks builder
├── .env.example        ← Environment variable template
├── Dockerfile          ← Optional container build for Railway/Docker
├── .dockerignore       ← Files excluded from Docker builds
├── railway.json        ← Railway deployment configuration
├── .gitignore
└── README.md           ← You are here
```

### Single-deployment architecture

The Express server in `server.js` serves BOTH the API and the frontend:
- `GET /` → returns `index.html` (the keysystem UI)
- `GET /Auth/*` → API endpoints
- Any other GET → falls back to `index.html` (SPA mode)

This means you only need ONE Railway deployment. Your Railway URL (e.g. `https://your-app.up.railway.app`) is both the website AND the API.

---

## Work.ink Destination Link

When configuring your Work.ink campaign, set the **Destination Link** to your Railway deployment URL:

```
https://your-app-name.up.railway.app/
```

This is permanent — users complete the Work.ink task, get redirected back to your keysystem, and click "I Have Completed the Task" to receive their key.

**Important:** Replace `your-app-name` with your actual Railway app name. Once deployed, the URL never changes.

---

## Frontend — Features

- **Dark, premium SaaS aesthetic** with electric cyan (`#00f0ff`) accent on a layered near-black background
- **Canvas particle system** with connection lines (respects `prefers-reduced-motion`)
- **Frosted-glass navbar** with active-section tracking and mobile slide-out menu
- **Hero** with shimmering v2.4 badge, animated scroll indicator, and live stats
- **Features strip** highlighting Fraud Protection, Instant Keys, Railway Ready, REST API
- **3-step key generation flow** with a visual stepper:
  1. **Enter Identifier** — Discord User ID or username (min 3 chars, with validation)
  2. **Complete Work.ink Verification** — configurable link + simulated verification with 30-min cooldown
  3. **Receive Key** — `HolexSS-XXXX-XXXX-XXXX-XXXX` format with copy button + endpoint reference
- **Key Dashboard** — table of last 10 keys with copy/revoke actions and empty state
- **API Documentation** — 5 endpoint cards with parameters, response examples, and syntax-highlighted JSON
- **Railway Deployment Section** — visual terminal showing the deploy flow
- **Toast notification system** — success / error / info / warning with auto-dismiss and progress bar
- **Full keyboard accessibility**, ARIA labels, focus-visible states, and reduced-motion support
- **Responsive** — table collapses to cards on mobile, navbar collapses to hamburger menu

### Configuration

Open `index.html` and edit the `CONFIG` object at the top of the `<script>` block:

```javascript
const CONFIG = {
  workInkLink: "https://work.ink/YOUR_SLUG_HERE",   // ← Replace with your actual Work.ink link
  keyPrefix: "HolexSS-",                              // ← Key prefix
  keyLength: 16,                                       // ← Total key chars (excluding prefix & dashes)
  verificationCooldown: 1800000,                      // ← 30 minutes in ms
  websiteName: "HolexSS Keysystem 2026",
  apiBaseUrl: "",                                      // ← Empty = same origin (frontend served by backend)
  maxKeysDisplayed: 10,
};
```

> **Note:** `apiBaseUrl` is empty by default because the backend now serves the frontend (same origin). Only set this if you host the frontend separately from the backend.

### Run locally

The recommended way is to run the Node backend, which serves both the API and the frontend on the same port:

```bash
npm install
cp .env.example .env
npm start
# → Open http://localhost:3000
```

Alternatively, you can open `index.html` directly in a browser for frontend-only testing (the API won't be reachable, but the 3-step flow + localStorage dashboard will work).

---

## Backend — HolexSS Keysystem API

A lightweight Express server with five endpoints. Uses an in-memory `Map` for storage by default — swap for PostgreSQL or Redis in production.

### Endpoints

| Method   | Path             | Description                                              | Auth     |
|----------|------------------|----------------------------------------------------------|----------|
| `POST`   | `/Auth/generate` | Internal: register a new key after Work.ink verification | —        |
| `GET`    | `/Auth/verify`   | Public: verify any key                                   | —        |
| `GET`    | `/Auth/workink`  | Primary: verify Work.ink-gated keys                      | —        |
| `DELETE` | `/Auth/revoke`   | Admin: revoke a key                                      | Bearer¹  |
| `GET`    | `/Auth/health`   | Health check & runtime metrics                           | —        |

¹ If `ADMIN_TOKEN` env var is set, `/Auth/revoke` requires `Authorization: Bearer <token>`.

### Example requests

```bash
# Generate a key
curl -X POST https://your-app.up.railway.app/Auth/generate \
  -H "Content-Type: application/json" \
  -d '{"identifier":"123456789012345678","method":"workink"}'

# Verify a key
curl "https://your-app.up.railway.app/Auth/verify?key=HolexSS-A7K2-M9X1-P4L8-Q3W6"

# Verify via Work.ink endpoint
curl "https://your-app.up.railway.app/Auth/workink?key=HolexSS-A7K2-M9X1-P4L8-Q3W6"

# Revoke a key (if ADMIN_TOKEN is set)
curl -X DELETE \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-app.up.railway.app/Auth/revoke?key=HolexSS-A7K2-M9X1-P4L8-Q3W6"

# Health check
curl "https://your-app.up.railway.app/Auth/health"
```

### Run locally

```bash
npm install
cp .env.example .env
npm start
```

Server starts on `http://localhost:3000` (or `$PORT` if set).

---

## Deploy to Railway

Railway auto-detects Node.js and runs `npm start`. There's nothing to configure beyond environment variables.

### Option A — Deploy via Railway Dashboard (recommended)

1. Push this folder to a GitHub repository.
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Select your repository. Railway will detect `package.json` and install dependencies automatically.
4. Go to the **Variables** tab and set:
   - `KEY_PREFIX` — e.g. `HolexSS-`
   - `WORKINK_SLUG` — your Work.ink slug
   - `ADMIN_TOKEN` — a strong random string for `/Auth/revoke` protection
   - `CORS_ORIGIN` — your frontend origin (e.g. `https://yoursite.netlify.app`)
5. Railway assigns a public URL like `https://holexss.up.railway.app`. Test it:
   ```bash
   curl https://holexss.up.railway.app/Auth/health
   ```
6. Your keysystem is live at your Railway URL — both the website AND the API. Set this URL as your Work.ink Destination Link.

### Option B — Deploy via Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set KEY_PREFIX=HolexSS- WORKINK_SLUG=your_slug ADMIN_TOKEN=your_token
```

### Option C — Deploy via Docker

The included `Dockerfile` lets Railway build a container image instead:

1. In Railway, go to **Settings** → **Builder** → select **Dockerfile**.
2. `railway up` — Railway builds the image and runs it.

### Persistence note

The default backend uses in-memory storage, which resets on every redeploy and does not persist across replicas. For production:

- Add a PostgreSQL database in Railway (**New** → **Database** → **PostgreSQL**)
- Replace the `keys` Map in `server.js` with a `pg` connection
- Or use Railway's Redis plugin for a fast key-value store

A minimal Postgres migration would look like:

```sql
CREATE TABLE keys (
  key           TEXT PRIMARY KEY,
  identifier    TEXT NOT NULL,
  method        TEXT NOT NULL DEFAULT 'workink',
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT NOT NULL DEFAULT 'active',
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX idx_keys_status ON keys(status);
```

---

## Customization Checklist

- [ ] Replace `CONFIG.workInkLink` in `index.html` with your actual Work.ink link
- [ ] Set `KEY_PREFIX` env var on Railway (must match `CONFIG.keyPrefix`)
- [ ] Set `WORKINK_SLUG` env var on Railway
- [ ] Set a strong `ADMIN_TOKEN` env var on Railway for `/Auth/revoke` protection
- [ ] Set `CORS_ORIGIN` to your frontend domain
- [ ] (Optional) Swap in-memory store for PostgreSQL/Redis
- [ ] (Optional) Add rate limiting with `express-rate-limit`
- [ ] (Optional) Add request logging with `morgan`

---

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework, no build step), Google Fonts (Space Grotesk + JetBrains Mono)
- **Backend:** Node.js, Express, CORS, dotenv
- **Deployment:** Railway (Nixpacks builder) or Docker

---

## License

MIT © HolexSS. See headers in source files for attribution.

## Disclaimer

This software is provided as-is. The Work.ink verification is client-side trust-based — there is no server-side proof that the user actually completed the Work.ink task. For stronger guarantees, integrate Work.ink's server callback API (if available) or replace the verification step with a server-validated challenge.
