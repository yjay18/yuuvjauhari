import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const site = process.env.SITE_URL || "https://yuuvjauhari.github.io";
const base = process.env.SITE_BASE || "/";

export default defineConfig({
  site,
  base,
  output: "static",
  integrations: [sitemap()],
});
