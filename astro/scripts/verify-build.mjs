import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root=fileURLToPath(new URL("../",import.meta.url));
const astroPackage = JSON.parse(await fs.readFile(path.join(root,"node_modules/astro/package.json"),"utf8"));
const astroCli = path.resolve(root,"node_modules/astro",typeof astroPackage.bin === "string" ? astroPackage.bin : astroPackage.bin.astro);
const config=path.join(root,"src/config/analytics.ts");
const original=await fs.readFile(config,"utf8");
await fs.mkdir(path.join(root,"verification"),{recursive:true});
function build(expectSuccess=true) {
  const result=spawnSync(process.execPath,[astroCli,"build"],{
    cwd:root,env:{...process.env,ASTRO_TELEMETRY_DISABLED:"1"},stdio:"inherit",windowsHide:true
  });
  if(result.error)throw result.error;
  assert.equal(result.status===0,expectSuccess,"Unexpected build result");
}
async function hashes(dir,relative="") {
  const result={};
  for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    const name=path.join(relative,entry.name);
    if(entry.isDirectory())Object.assign(result,await hashes(path.join(dir,entry.name),name));
    else result[name.split(path.sep).join("/")]=createHash("sha256").update(await fs.readFile(path.join(dir,entry.name))).digest("hex");
  }
  return result;
}
const before=await hashes(path.join(root,"dist"));
const results=[];
try {
  await fs.writeFile(config,original.replace(/export const ga4MeasurementId = "[^"]*";/,'export const ga4MeasurementId = "";'));
  build();
  const blank=await fs.readFile(path.join(root,"dist/index.html"),"utf8");
  assert.equal(/googletagmanager|__tokyoVtuberGaInitialized|dataLayer/.test(blank),false);
  results.push({test:"empty-id-no-tag",passed:true});
  await fs.writeFile(config,original.replace(/export const ga4MeasurementId = "[^"]*";/,'export const ga4MeasurementId = "INVALID";'));
  build(false);
  results.push({test:"invalid-id-rejected",passed:true});
} finally {
  await fs.writeFile(config,original);
  build();
}
const after=await hashes(path.join(root,"dist"));
assert.deepEqual(after,before,"Repeated build changed artifacts");
results.push({test:"repeat-build-byte-identical",files:Object.keys(after).length,passed:true});
await fs.writeFile(path.join(root,"verification/build-results.json"),JSON.stringify({completedAt:new Date().toISOString(),results,hashes:after},null,2)+"\n");
console.log(JSON.stringify({passed:results.length,files:Object.keys(after).length},null,2));
