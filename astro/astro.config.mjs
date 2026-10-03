import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://tokyo-vtuber-fudousan.com",
  output: "static",
  // Astro 7で変わった空白処理を旧版と揃えて表示を維持する。
  compressHTML: true,
  base: "/",
});
