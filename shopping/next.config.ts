import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
const version =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  process.env.GITHUB_SHA?.slice(0, 7) ||
  (() => {
    try {
      return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
        encoding: "utf8",
      }).trim();
    } catch {
      return "local";
    }
  })();
const config: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: { root: process.cwd() },
  experimental: { useTypeScriptCli: false },
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: { unoptimized: true },
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: version },
};
export default config;
