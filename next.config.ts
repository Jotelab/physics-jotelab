import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // node-tikzjax ships a WASM TeX engine + `fs`-loaded fonts (lib/tikz). Keep it
  // external so Next doesn't try to bundle the WASM/assets into the server build.
  serverExternalPackages: ["node-tikzjax"],
};

export default withNextIntl(nextConfig);
