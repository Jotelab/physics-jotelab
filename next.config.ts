import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // A stray lockfile in the parent directory makes Turbopack infer that
  // directory as the workspace root; pin it to this app instead.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  // node-tikzjax ships a WASM TeX engine + `fs`-loaded fonts (lib/tikz). Keep it
  // external so Next doesn't try to bundle the WASM/assets into the server build.
  serverExternalPackages: ["node-tikzjax"],
};

export default withNextIntl(nextConfig);
