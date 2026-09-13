import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo has its own CLAUDE.md conventions at the root; skip Next's
  // auto-generated AGENTS.md/CLAUDE.md so the two don't compete.
  agentRules: false,
};

export default nextConfig;
