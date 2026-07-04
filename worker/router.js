/**
 * Strivelin Traffic Router — Cloudflare Worker
 *
 * This Worker sits on the edge in front of www.strivelin.com and acts as a
 * reverse-proxy / traffic router. It inspects every incoming request's URL
 * path and forwards it to the correct origin:
 *
 *   /do/*      → Vercel  (Next.js "Do" app)
 *   /_next/*   → Vercel  (Next.js static assets — JS, CSS, images)
 *   /*         → Cloudflare Pages  (landing page, blog, etc.)
 *
 * Origins are configured via environment variables so they can differ between
 * staging and production without touching the code.
 *
 * Environment variables (set in wrangler.toml or the CF dashboard):
 *   VERCEL_ORIGIN  — e.g. "do-plum-xi.vercel.app"
 *   PAGES_ORIGIN   — e.g. "strivelin.pages.dev"
 */

export default {
  /**
   * Main fetch handler — Cloudflare invokes this for every HTTP request that
   * hits the Worker's route.
   *
   * @param {Request}  request  The incoming request from the browser.
   * @param {object}   env      Bound environment variables & secrets.
   * @param {object}   ctx      Execution context (waitUntil, passThroughOnException, etc.).
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // -----------------------------------------------------------------------
    // 1. Determine which origin should handle this request
    // -----------------------------------------------------------------------

    // Paths that belong to the Next.js app hosted on Vercel:
    //   • /do       — the app root
    //   • /do/*     — all sub-routes (e.g. /do/dashboard, /do/settings)
    //   • /_next/*  — Next.js build output (JS bundles, CSS, images, etc.)
    const isVercelPath =
      url.pathname === '/do' ||
      url.pathname.startsWith('/do/') ||
      url.pathname.startsWith('/_next/');

    // Pick the origin hostname based on the path match.
    const originHost = isVercelPath
      ? env.VERCEL_ORIGIN   // e.g. "do-plum-xi.vercel.app"
      : env.PAGES_ORIGIN;   // e.g. "strivelin.pages.dev"

    // -----------------------------------------------------------------------
    // 2. Build the upstream (origin) URL
    // -----------------------------------------------------------------------

    // We keep the original path and query string intact — only the host
    // changes so the origin sees exactly the URL it expects.
    const originUrl = new URL(url.pathname + url.search, `https://${originHost}`);

    // -----------------------------------------------------------------------
    // 3. Build the upstream request
    // -----------------------------------------------------------------------

    // Clone headers from the original request so cookies, auth tokens,
    // content-type, accept-encoding, etc. are all preserved.
    const headers = new Headers(request.headers);

    // Set the Host header to the origin's hostname. Most origins reject
    // requests whose Host header doesn't match their expected domain.
    headers.set('Host', originHost);

    // Forward the real visitor IP so the origin can log / rate-limit properly.
    // Cloudflare already sets CF-Connecting-IP, but we also set X-Forwarded-For
    // for origins that rely on it.
    headers.set('X-Forwarded-Host', url.hostname);

    // Construct a new Request with all original properties preserved:
    //   • method  — GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, etc.
    //   • headers — cloned above with Host override
    //   • body    — passed through for POST/PUT/PATCH requests
    //   • redirect: 'manual' — DO NOT follow redirects on the edge; pass the
    //     3xx response back to the browser so it can handle cookies / relative
    //     redirects correctly.
    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual',
    });

    // -----------------------------------------------------------------------
    // 4. Fetch from the origin and return the response
    // -----------------------------------------------------------------------

    try {
      const response = await fetch(originRequest);

      // Clone the response so we can modify headers if needed in the future
      // (e.g. adding CORS headers, cache-control overrides, etc.).
      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      return modifiedResponse;
    } catch (err) {
      // If the upstream fetch fails (network error, DNS failure, etc.),
      // return a 502 Bad Gateway so the browser knows something went wrong
      // on our side rather than hanging indefinitely.
      return new Response(`Bad Gateway: ${err.message}`, {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },
};
