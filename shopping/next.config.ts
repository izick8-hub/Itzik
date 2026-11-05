import type { NextConfig } from "next";
const config: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: { root: process.cwd() },
  experimental: { useTypeScriptCli: false },
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default config;
