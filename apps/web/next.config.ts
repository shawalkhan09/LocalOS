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
};

export default nextConfig;
