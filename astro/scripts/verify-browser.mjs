import { chromium } from "playwright";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const astroPackage = JSON.parse(await readFile(path.join(root,"node_modules/astro/package.json"),"utf8"));
const astroCli = path.resolve(root,"node_modules/astro",typeof astroPackage.bin === "string" ? astroPackage.bin : astroPackage.bin.astro);
const dist = path.join(root, "dist");
const out = path.join(root, "verification");
await mkdir(out, {recursive:true});
let executablePath;
for (const candidate of [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
].filter(Boolean)) {
  try { await access(candidate); executablePath = candidate; break; } catch {}
}
const previewOrigin = "http://127.0.0.1:4327";
const preview = spawn(process.execPath, [astroCli, "preview", "--host", "127.0.0.1", "--port", "4327"], {
  cwd:root, windowsHide:true, stdio:["ignore","pipe","pipe"], env:{...process.env,ASTRO_TELEMETRY_DISABLED:"1"}
});
let previewLog = "";
preview.stdout.on("data",chunk => previewLog += chunk);
preview.stderr.on("data",chunk => previewLog += chunk);
let ready = false;
for (let attempt=0; attempt<100; attempt++) {
  try { const response=await fetch(previewOrigin, {signal:AbortSignal.timeout(1000)}); if(response.ok) {ready=true;break;} } catch {}
  await new Promise(resolve=>setTimeout(resolve,100));
}
if (!ready) { preview.kill(); throw new Error("Preview did not start: "+previewLog); }
const browser = await chromium.launch({
  headless:true, executablePath,
  args:["--disable-background-networking", "--disable-component-update"]
});
const results = [];
const mime = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg"};
async function createPage(viewport) {
  const context = await browser.newContext({viewport, serviceWorkers:"block"});
  const traffic = { mockedGoogle:[], unexpected:[], failed:[], badResponses:[], errors:[] };
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === previewOrigin) { await route.continue(); return; }
    if (url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js") {
      traffic.mockedGoogle.push(url.href);
      await route.fulfill({contentType:"text/javascript", body:"window.__mockTagLoaded = true;"});
      return;
    }
    if (!["localhost","127.0.0.1","tokyo-vtuber-fudousan.com","www.tokyo-vtuber-fudousan.com","preview.example.invalid"].includes(url.hostname)) {
      traffic.unexpected.push(url.href);
      await route.fulfill({status:204});
      return;
    }
    let filename = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
    // A non-LP document is served only to verify the runtime path restriction.
    if (filename === "qa-other-path") filename = "index.html";
    const target = path.resolve(dist, filename);
    if (!target.startsWith(dist + path.sep)) throw new Error("Invalid fixture path");
    try {
      await route.fulfill({contentType:mime[path.extname(target)] || "application/octet-stream", body:await readFile(target)});
    } catch {
      traffic.badResponses.push(url.href);
      await route.fulfill({status:404, body:"Fixture not found"});
    }
  });
  const page = await context.newPage();
  page.on("console", message => {if (message.type() === "error") traffic.errors.push(message.text());});
  page.on("pageerror", error => traffic.errors.push(error.message));
  page.on("response", response => {if (response.status() >= 400) traffic.badResponses.push(response.url());});
  page.on("requestfailed", request => traffic.failed.push(request.url()));
  return {context,page,traffic};
}
function cleanTraffic(traffic) {
  assert.deepEqual(traffic.errors, [], "Browser console/page errors");
  assert.deepEqual(traffic.failed, [], "Failed requests");
  assert.deepEqual(traffic.badResponses, [], "Asset 404");
  assert.deepEqual(traffic.unexpected, [], "Unexpected external request");
}
try {
  for (const viewport of [{width:1440,height:1000},{width:390,height:844},{width:360,height:800},{width:800,height:900}]) {
    const {context,page,traffic} = await createPage(viewport);
    await page.goto(previewOrigin+"/", {waitUntil:"networkidle"});
    await page.waitForTimeout(1000);
    assert.equal(await page.title(), "東京VTuber不動産｜オンライン物件相談");
    const layout = await page.evaluate(() => ({
      width:document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth,
      brokenImages:[...document.images].filter(x => !x.complete || x.naturalWidth === 0).map(x => x.src),
      missingAlt:[...document.images].filter(x => !x.hasAttribute("alt")).map(x => x.src),
      brokenAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(x => !document.getElementById(x.hash.slice(1))).map(x => x.hash),
      lang:document.documentElement.lang,
      h1:document.querySelectorAll("h1").length,
      main:document.querySelectorAll("main").length,
      emptyInteractive:[...document.querySelectorAll("a,button")].filter(x => !(x.textContent.trim() || x.getAttribute("aria-label"))).length,
      initialized:Boolean(window.__tokyoVtuberGaInitialized),
      cookies:document.cookie,
      comingSoon:document.querySelectorAll(".coming-soon-panel").length
    }));
    assert.ok(layout.scrollWidth <= layout.width, "Horizontal overflow");
    assert.deepEqual(layout.brokenImages, []);
    assert.deepEqual(layout.missingAlt, []);
    assert.deepEqual(layout.brokenAnchors, []);
    assert.equal(layout.lang, "ja");
    assert.equal(layout.h1, 1);
    assert.equal(layout.main, 1);
    assert.equal(layout.emptyInteractive, 0);
    assert.equal(layout.comingSoon, 3);
    assert.equal(layout.initialized, false);
    assert.equal(layout.cookies, "");
    assert.equal(traffic.mockedGoogle.length, 0);
    if (viewport.width <= 800) {
      await page.locator(".menu-button").click();
      assert.equal(await page.locator(".menu-button").getAttribute("aria-expanded"), "true");
      await page.locator(".mobile-menu a[href='#services']").click();
      assert.equal(await page.locator(".menu-button").getAttribute("aria-expanded"), "false");
      assert.equal(await page.locator(".mobile-menu").isVisible(), false);
    } else {
      await page.locator(".desktop-nav a[href='#services']").click();
    }
    assert.ok(new URL(page.url()).hash === "#services");
    // Reveal each real section before capturing the complete page.
    for (const selector of ["#top","#concept","#services","#character","#flow","#booking","#inquiry","#contact","footer"]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(450);
    }
    await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"}));
    await page.waitForTimeout(1000);
    await page.screenshot({path:path.join(out, (viewport.width > 800 ? "desktop-" : "mobile-")+viewport.width+".png"),fullPage:true});
    await page.screenshot({path:path.join(out,(viewport.width > 800 ? "desktop-top-" : "mobile-top-")+viewport.width+".png"),fullPage:false});
    cleanTraffic(traffic);
    results.push({test:"layout", viewport, layout, traffic, passed:true});
    await context.close();
  }
  for (const url of [
    "https://tokyo-vtuber-fudousan.com/",
    "https://tokyo-vtuber-fudousan.com/index.html",
    "https://tokyo-vtuber-fudousan.com/?email=qa%40example.invalid",
    "https://tokyo-vtuber-fudousan.com/#qa-private-fixture",
    "http://tokyo-vtuber-fudousan.com/",
    "https://www.tokyo-vtuber-fudousan.com/",
    "https://preview.example.invalid/",
    "https://tokyo-vtuber-fudousan.com/qa-other-path"
  ]) {
    const {context,page,traffic} = await createPage({width:1440,height:1000});
    await page.goto(url, {waitUntil:"networkidle"});
    const enabled = ["https://tokyo-vtuber-fudousan.com/","https://tokyo-vtuber-fudousan.com/index.html"].includes(url);
    const getQueue = () => page.evaluate(() => (window.dataLayer || []).map(x => [...x]));
    let queue = await getQueue();
    assert.equal(traffic.mockedGoogle.length, enabled ? 1 : 0);
    assert.equal(queue.filter(x => x[0] === "config").length, enabled ? 1 : 0);
    assert.equal(queue.filter(x => x[0] === "event" && x[1] === "page_view").length, 0);
    if (enabled) {
      const configuration = queue.find(x => x[0] === "config");
      assert.equal(configuration[1], "G-65TGMY9D0G");
      assert.equal(configuration[2].send_page_view, true);
      assert.equal(configuration[2].page_location, "https://tokyo-vtuber-fudousan.com/");
      assert.equal(configuration[2].page_referrer, "");
      assert.equal(configuration[2].allow_google_signals, false);
      assert.equal(configuration[2].allow_ad_personalization_signals, false);
      // Re-evaluate emitted inline code and navigate anchors to catch duplicate initialization.
      await page.evaluate(() => {
        const code = [...document.scripts].find(x => x.textContent.includes("__tokyoVtuberGaInitialized")).textContent;
        (0,eval)(code);
      });
      await page.locator(".desktop-nav a[href='#services']").click();
      await page.waitForTimeout(100);
      queue = await getQueue();
      assert.equal(queue.filter(x => x[0] === "config").length, 1);
      assert.equal(traffic.mockedGoogle.length, 1);
    }
    cleanTraffic(traffic);
    results.push({test:"analytics-isolated", url, enabled, queue, traffic, passed:true});
    await context.close();
  }
  const html = await readFile(path.join(dist, "index.html"), "utf8");
  assert.equal((html.match(/G-65TGMY9D0G/g)||[]).length, 1);
  results.push({test:"single-measurement-id",passed:true});
  await writeFile(path.join(out,"browser-results.json"),JSON.stringify({
    completedAt:new Date().toISOString(),browser:browser.version(),
    safety:"Real localhost preview plus locally fulfilled production-origin fixtures; Google tag mocked, all other external page requests intercepted. No real Analytics traffic.",
    results
  },null,2)+"\n");
  console.log(JSON.stringify({passed:results.length,browser:browser.version(),output:out},null,2));
} finally {
  await browser.close();
  preview.kill();
}
