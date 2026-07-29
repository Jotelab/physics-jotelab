import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // node-tikzjax ships a WASM TeX engine + `fs`-loaded fonts (lib/tikz). Keep it
  // external so Next doesn't try to bundle the WASM/assets into the server build.
  serverExternalPackages: ["node-tikzjax"],
  // Playwright (and local curl checks) address the dev server as 127.0.0.1;
  // without this Next 16 blocks its dev resources cross-origin and pages
  // render but never hydrate. Dev-only setting, ignored in production.
  allowedDevOrigins: ["127.0.0.1"],
};

export default withNextIntl(nextConfig);
