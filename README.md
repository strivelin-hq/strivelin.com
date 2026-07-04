# Strivelin Landing Page & Traffic Router

A multi-origin architecture for **strivelin.com** that uses a **Cloudflare Worker** as an edge router to serve different apps from a single domain.

```
                    ┌─────────────────────┐
    Browser ──────► │  Cloudflare Worker   │
                    │  (strivelin-router)  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     /do/*  → Vercel    /*  → CF Pages   /blog/* → CF Pages
     (Next.js app)      (Landing page)   (Blog)
```

---

## 1. Architecture Overview

The Cloudflare Worker (`worker/router.js`) intercepts every request to `www.strivelin.com` and forwards it to the correct origin based on the URL path:

| Path Pattern | Origin | What Lives There |
|---|---|---|
| `/do`, `/do/*` | **Vercel** (`do-plum-xi.vercel.app`) | Next.js "Do" application |
| `/_next/*` | **Vercel** | Next.js static assets (JS, CSS, images) |
| Everything else (`/`, `/about`, `/blog/*`, etc.) | **Cloudflare Pages** (`strivelin.pages.dev`) | Landing page, blog, marketing pages |

**Why a Worker?**

- **Single domain** — no CORS issues, no subdomain gymnastics.
- **Edge performance** — routing happens on Cloudflare's network before the request even reaches an origin.
- **Flexibility** — adding a new app (e.g., `/shop/*` → Shopify) is a one-line change in `router.js`.

---

## 2. Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Cloudflare account** — [dash.cloudflare.com](https://dash.cloudflare.com/)
- **Wrangler CLI** — install globally or use npx:
  ```bash
  npm install -g wrangler
  # or
  npx wrangler --version
  ```
- **Domain on Cloudflare** — `strivelin.com` must use Cloudflare nameservers (the orange-cloud proxy).

---

## 3. Step 1: Deploy Landing Page to Cloudflare Pages

The landing page is a static site (HTML/CSS/JS) deployed to Cloudflare Pages.

### Option A: Connect a GitHub Repository (recommended)

1. Push your landing page source to a GitHub repo.
2. Go to **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repo and configure:
   - **Project name:** `strivelin`
   - **Production branch:** `main`
   - **Build command:** _(leave blank for plain HTML, or use your build tool)_
   - **Build output directory:** `/landing` _(or wherever your built files live)_
4. Click **Save and Deploy**.

Your site will be live at `strivelin.pages.dev`.

### Option B: Direct Upload

```bash
# From the landing page directory
npx wrangler pages deploy ./public --project-name strivelin
```

---

## 4. Step 2: Deploy the Cloudflare Worker

```bash
# Navigate to the worker directory
cd landing/worker/

# Review wrangler.toml — update origins if needed
cat wrangler.toml

# Log in to Cloudflare (opens a browser window)
wrangler login

# Deploy the Worker
wrangler deploy
```

After deploying, the Worker will be available at `strivelin-router.<your-subdomain>.workers.dev`. You can test it there before attaching a custom domain.

---

## 5. Step 3: Attach Custom Domain to Worker

1. Go to **Cloudflare Dashboard → Workers & Pages → strivelin-router**.
2. Click **Settings → Domains & Routes**.
3. Click **Add → Custom Domain**.
4. Add both:
   - `strivelin.com`
   - `www.strivelin.com`
5. Cloudflare will automatically create the required DNS records.

> **Note:** If you previously had DNS records pointing to Vercel (e.g., CNAME to `cname.vercel-dns.com`), Cloudflare will replace them. The Worker now handles routing to Vercel for `/do/*` paths.

---

## 6. Step 4: Update DNS Records

When you add Custom Domains in Step 3, Cloudflare handles DNS automatically. However, if you need to verify or adjust manually:

1. Go to **Cloudflare Dashboard → DNS → Records** for `strivelin.com`.
2. Ensure the records look like this:

| Type | Name | Content | Proxy |
|---|---|---|---|
| (managed by Worker Custom Domain) | `strivelin.com` | — | ☁️ Proxied |
| (managed by Worker Custom Domain) | `www` | — | ☁️ Proxied |

3. **Delete** any old CNAME records that pointed directly to `cname.vercel-dns.com` — the Worker now proxies Vercel traffic.

---

## 7. Step 5: Verify Vercel Still Works

After switching DNS away from Vercel, make sure Vercel still accepts proxied requests:

1. Open `https://www.strivelin.com/do` — it should load the Next.js app.
2. Check that Vercel isn't rejecting the `Host` header. The Worker sets `Host: do-plum-xi.vercel.app` on upstream requests, which Vercel should accept.
3. If you see 404s or 308 redirects, check your Vercel project's domain settings:
   - Go to **Vercel Dashboard → Project → Settings → Domains**.
   - Ensure `do-plum-xi.vercel.app` is listed (it's the default Vercel domain and should always work).

---

## 8. Step 6: Update Supabase Auth URLs

If you're using Supabase Auth, the redirect URLs should already point to the main domain:

- **Site URL:** `https://www.strivelin.com/do`
- **Redirect URLs:** `https://www.strivelin.com/do/**`

No changes should be needed if these were already configured. Verify in **Supabase Dashboard → Authentication → URL Configuration**.

---

## 9. Adding a Blog

The blog is part of the same Cloudflare Pages project as the landing page. Any HTML files you add to your Pages build output will be served automatically:

```
landing/
├── index.html              → strivelin.com/
├── about.html              → strivelin.com/about
├── blog/
│   ├── index.html          → strivelin.com/blog/
│   ├── getting-started.html → strivelin.com/blog/getting-started
│   └── guides/
│       └── setup.html      → strivelin.com/blog/guides/setup
└── worker/
    ├── router.js
    └── wrangler.toml
```

Cloudflare Pages supports any path structure — just create the directories and HTML files. No additional routing configuration is needed since the Worker already sends all non-`/do` traffic to Pages.

---

## 10. Adding Future Apps

To route a new path to a different origin, edit `worker/router.js`:

```javascript
// Example: Route /shop/* to a Shopify storefront
const isShopifyPath = url.pathname.startsWith('/shop/') || url.pathname === '/shop';

// Update the origin selection logic
let originHost;
if (isVercelPath) {
  originHost = env.VERCEL_ORIGIN;
} else if (isShopifyPath) {
  originHost = env.SHOPIFY_ORIGIN;  // Add to wrangler.toml [vars]
} else {
  originHost = env.PAGES_ORIGIN;
}
```

Then add the new environment variable to `wrangler.toml`:

```toml
[vars]
VERCEL_ORIGIN  = "do-plum-xi.vercel.app"
PAGES_ORIGIN   = "strivelin.pages.dev"
SHOPIFY_ORIGIN = "your-store.myshopify.com"
```

Redeploy with `wrangler deploy`.

---

## 11. Local Development

Test the Worker locally before deploying:

```bash
cd landing/worker/

# Start the local dev server (uses Miniflare under the hood)
wrangler dev

# The Worker will be available at http://localhost:8787
# Test different paths:
curl http://localhost:8787/          # → CF Pages (landing page)
curl http://localhost:8787/do        # → Vercel (Next.js app)
curl http://localhost:8787/do/login  # → Vercel (Next.js app)
curl http://localhost:8787/blog/     # → CF Pages (blog)
```

> **Tip:** Use `wrangler dev --remote` to test against real Cloudflare infrastructure instead of local simulation.

---

## Quick Reference

| Command | What It Does |
|---|---|
| `wrangler login` | Authenticate with Cloudflare |
| `wrangler deploy` | Deploy the Worker to production |
| `wrangler dev` | Start local development server |
| `wrangler dev --remote` | Dev server using real CF infrastructure |
| `wrangler tail` | Stream live Worker logs |
| `wrangler pages deploy ./public --project-name strivelin` | Deploy landing page to CF Pages |
