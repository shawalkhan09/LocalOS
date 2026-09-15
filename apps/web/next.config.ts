import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo has its own CLAUDE.md conventions at the root; skip Next's
  // auto-generated AGENTS.md/CLAUDE.md so the two don't compete.
  agentRules: false,
  // Default position (bottom-left) sits directly on top of the dashboard
  // sidebar's Log out link in local dev. Repositioning rather than
  // disabling: the indicator still earns its keep in dev (surfaces
  // compile/runtime errors, shows static vs. dynamic route status), it
  // just needed to be somewhere the app isn't already using.
  devIndicators: {
    position: "bottom-right",
  },
  // Production only (see lib/api.ts): the browser calls the API through
  // this same-origin path instead of Render's own domain directly, so the
  // session cookie is first-party from the browser's point of view.
  // Safari and Firefox's tracking protections block third-party cookies by
  // default — a cross-origin cookie (Vercel calling Render) is exactly
  // that. RENDER_API_URL is a plain (non-NEXT_PUBLIC_) env var on purpose:
  // this rewrite is resolved server-side, the browser never sees Render's
  // actual URL. Returns no rewrites if it's unset, so local dev (which
  // doesn't set it and doesn't need it — see lib/api.ts) is unaffected.
  async rewrites() {
    const renderApiUrl = process.env.RENDER_API_URL;
    if (!renderApiUrl) {
      return [];
    }
    return [
      {
        source: "/api-proxy/:path*",
        destination: `${renderApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
