import { mkdir, readdir, readFile, copyFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "dist");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const release = path.join(root, "releases", `heteml-${stamp}`);
const upload = path.join(release, "upload");
const allowed = new Set(["index.html", "main.js", "analytics-consent.js", "analytics", "_astro", "assets"]);
await mkdir(upload, { recursive: true });
const manifest = [];
async function copyTree(directory, relative = "") {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    if (!relative && entry.name === "CNAME") continue;
    if (!relative && !allowed.has(entry.name)) throw new Error(`未確認の公開ファイル: ${entry.name}`);
    if (entry.isSymbolicLink()) throw new Error("シンボリックリンクは公開しません");
    const name = path.join(relative, entry.name);
    const source = path.join(directory, entry.name);
    const target = path.join(upload, name);
    if (entry.isDirectory()) {
      await mkdir(target, { recursive: true });
      await copyTree(source, name);
    } else {
      const bytes = await readFile(source);
      await copyFile(source, target);
      manifest.push({ file: name.split(path.sep).join("/"), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
  }
}
await copyTree(dist);
if (!manifest.some(x => x.file === "index.html") || !manifest.some(x => x.file === "main.js")) throw new Error("buildしてから実行してください");
for (const name of ["最初に読む.txt", "配置手順.md", "GA4設定.md", "検証結果.md", "検証ログ.json", "htaccess-redirect.example.txt"]) {
  await copyFile(path.join(root, "docs", name), path.join(release, name));
}
await writeFile(path.join(release, "公開ファイル一覧.json"), JSON.stringify({ generatedAt: new Date().toISOString(), source: "astro/dist (CNAME除外)", files: manifest }, null, 2) + "\n");
console.log(JSON.stringify({ release, upload, files: manifest.length }, null, 2));
