import { chromium } from "playwright";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root,"dist"), out = path.join(root,"verification");
await mkdir(out,{recursive:true});
const pkg = JSON.parse(await readFile(path.join(root,"node_modules/astro/package.json"),"utf8"));
const cli = path.resolve(root,"node_modules/astro",typeof pkg.bin === "string" ? pkg.bin : pkg.bin.astro);
const previewOrigin = "http://127.0.0.1:4327", origin = "https://tokyo-vtuber-fudousan.com";
const id = (await readFile(path.join(root,"src/config/analytics.ts"),"utf8")).match(/export const ga4MeasurementId = "([^"]*)"/)[1];
const key = "tokyo-vtuber-analytics-consent-v1", sessionCookie = "_ga_" + id.replace(/^G-/,"");
const preview = spawn(process.execPath,[cli,"preview","--host","127.0.0.1","--port","4327"],{cwd:root,windowsHide:true,stdio:"ignore",env:{...process.env,ASTRO_TELEMETRY_DISABLED:"1"}});
let ready = false;
for(let i=0;i<100;i++) {try {if((await fetch(previewOrigin,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,100));}
if(!ready){preview.kill();throw Error("Preview did not start");}
let executablePath;
for(const candidate of [process.env.BROWSER_EXECUTABLE,"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe","C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean)){try{await access(candidate);executablePath=candidate;break;}catch{}}
const browser = await chromium.launch({headless:true,executablePath,args:["--disable-background-networking","--disable-component-update"]});
const results = [];
const controller = await readFile(path.join(dist,"analytics-consent.js"),"utf8");
const mockTag = String.raw`(() => {
  window.__mockTagLoaded = true;
  window.__mockTagObservedUrl = location.href;
  for(const args of window.dataLayer || []) {
    if(args[0] !== "config" || args[2].send_page_view === false || window["ga-disable-"+args[1]]) continue;
    const p = args[2];
    document.cookie="_ga=GA1.QA; Path=/; Domain=tokyo-vtuber-fudousan.com; Secure; SameSite=Lax";
    document.cookie="_ga_"+args[1].replace(/^G-/,"")+"=QA.session; Path=/; Domain=tokyo-vtuber-fudousan.com; Secure; SameSite=Lax";
    const payload = new URLSearchParams({en:"page_view",tid:args[1],dl:p.page_location,dr:p.page_referrer});
    fetch("https://www.google-analytics.com/g/collect?"+payload,{referrerPolicy:"no-referrer"}).catch(()=>{});
    addEventListener("pagehide",()=>{
      if(window["ga-disable-"+args[1]]) return;
      fetch("https://www.google-analytics.com/g/collect?en=shutdown_probe&tid="+args[1],{keepalive:true,referrerPolicy:"no-referrer"}).catch(()=>{});
    });
  }
})();`;
const mime = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".jpg":"image/jpeg"};
async function fixture(viewport={width:1440,height:1000},options={}) {
  const storageState = options.saved === undefined ? undefined : {cookies:[],origins:[{origin,localStorage:[{name:key,value:typeof options.saved === "string" && !["granted","denied"].includes(options.saved) ? options.saved : JSON.stringify({v:1,choice:options.saved})}]}]};
  const context = await browser.newContext({viewport,serviceWorkers:"block",javaScriptEnabled:options.javascript !== false,storageState});
  const traffic = {tags:[],collect:[],unexpected:[],failed:[],errors:[],badResponses:[],cancelled:[]};
  await context.addInitScript(({storageBlocked,failNormalization,ignoreNormalization})=>{
    history.replaceState({qa:"preserved"},"");
    window.__qaHistoryLength=history.length;
    window.__qaHistoryEvents=[];
    addEventListener("popstate",()=>window.__qaHistoryEvents.push("popstate"));
    addEventListener("hashchange",()=>window.__qaHistoryEvents.push("hashchange"));
    if(storageBlocked) Object.defineProperty(window,"localStorage",{get(){throw new DOMException("QA blocked","SecurityError");}});
    if(failNormalization) history.replaceState=()=>{throw new DOMException("QA fixture","SecurityError");};
    if(ignoreNormalization) history.replaceState=()=>{};
  },options);
  await context.route("**/*",async route=>{
    const u = new URL(route.request().url());
    if(u.hostname === "www.googletagmanager.com" && u.pathname === "/gtag/js") {
      traffic.tags.push({url:u.href,referrer:route.request().headers().referer || ""});
      if(options.slowTag) await new Promise(r=>setTimeout(r,1000));
      try{await route.fulfill({contentType:"text/javascript",body:mockTag});}catch{}
      return;
    }
    if(u.hostname === "www.google-analytics.com") {
      traffic.collect.push({url:u.href,payload:Object.fromEntries(u.searchParams)});
      try{await route.fulfill({status:200,contentType:"text/plain",body:"mock collection intercepted",headers:{"access-control-allow-origin":"*"}});}catch{}
      return;
    }
    if(u.origin === previewOrigin){await route.continue();return;}
    if(!["tokyo-vtuber-fudousan.com","www.tokyo-vtuber-fudousan.com","preview.example.invalid"].includes(u.hostname)) {
      traffic.unexpected.push(u.href); await route.abort(); return;
    }
    let filename = u.pathname === "/" || u.pathname === "/qa-other-path" ? "index.html" : decodeURIComponent(u.pathname).replace(/^\/+/,"");
    if(filename.endsWith("/")) filename += "index.html";
    const target = path.resolve(dist,filename);
    if(!target.startsWith(dist+path.sep)) throw Error("Invalid fixture path");
    try {
      let body = await readFile(target);
      if(options.duplicate && path.extname(target) === ".html") body=Buffer.from(body.toString().replace("</body>",'<script src="/analytics-consent.js"></script></body>'));
      await route.fulfill({contentType:mime[path.extname(target)] || "application/octet-stream",body});
    } catch {traffic.badResponses.push(u.href);await route.fulfill({status:404});}
  });
  const page = await context.newPage();
  page.on("console",m=>{if(m.type()==="error")traffic.errors.push(m.text());});
  page.on("pageerror",e=>traffic.errors.push(e.message));
  page.on("response",r=>{if(r.status()>=400)traffic.badResponses.push(r.url());});
  page.on("requestfailed",r=>{if(options.slowTag && r.url().includes("googletagmanager"))traffic.cancelled.push(r.url());else traffic.failed.push({url:r.url(),error:r.failure()?.errorText});});
  return {context,page,traffic};
}
function clean(t){for(const name of ["unexpected","failed","errors","badResponses"])assert.deepEqual(t[name],[],name);}
function pv(t){return t.collect.filter(x=>x.payload.en==="page_view").length;}
async function queue(page){return page.evaluate(()=>[...(window.dataLayer||[])].map(x=>[...x]));}
async function choose(page,value){await page.locator("[data-analytics-open]").click();await page.locator(`[data-analytics-choice='${value}']`).click();}
async function collected(page){await page.waitForFunction(()=>window.__mockTagLoaded);await page.waitForTimeout(100);}
async function reloaded(page){await page.waitForEvent("domcontentloaded");await page.waitForLoadState("networkidle");}
function noSecrets(value){const text=JSON.stringify(value);for(const secret of ["qa@","qa%40","qa%2540","qa-secret-fixture","second-private-fixture","0000000000","qa-private-fixture","utm_","gclid="])assert.ok(!text.includes(secret),"Sensitive input: "+secret);}
async function record(test,f,extra={}){clean(f.traffic);results.push({test,...extra,traffic:f.traffic,passed:true});console.log(`PASS ${results.length}: ${test}`);await f.context.close();}
try {
  for(const viewport of [{width:1440,height:1000},{width:800,height:900},{width:390,height:844},{width:360,height:800}]) {
    const f = await fixture(viewport),{page,traffic}=f;
    await page.goto(previewOrigin,{waitUntil:"networkidle"});
    const box = await page.locator("#analytics-panel").boundingBox();
    assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=viewport.width+1 && box.y+box.height<=viewport.height+1);
    const choices = await page.locator("[data-analytics-choice]").evaluateAll(bs=>bs.map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height,color:getComputedStyle(b).color,bg:getComputedStyle(b).backgroundColor})));
    assert.ok(Math.abs(choices[0].w-choices[1].w)<1);assert.deepEqual(choices[0],choices[1]);
    assert.equal(await page.evaluate(()=>document.activeElement.tagName),"BODY","Initial banner does not steal focus");
    await page.waitForTimeout(900);
    await page.screenshot({path:path.join(out,`consent-${viewport.width}.png`)});
    await page.locator("[data-analytics-close]").click();
    await page.locator("[data-analytics-open]").click();
    assert.equal(await page.evaluate(()=>document.activeElement.id),"analytics-heading");
    await page.keyboard.press("Tab");assert.equal(await page.locator("[data-analytics-close]").evaluate(b=>b===document.activeElement),true);
    await page.keyboard.press("Escape");assert.equal(await page.locator("[data-analytics-open]").evaluate(b=>b===document.activeElement),true);
    const layout = await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),missingAlt:[...document.images].filter(i=>!i.hasAttribute("alt")).length,anchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash),h1:document.querySelectorAll("h1").length,main:document.querySelectorAll("main").length,lang:document.documentElement.lang,comingSoon:document.querySelectorAll(".coming-soon-panel").length}));
    assert.ok(layout.scroll<=layout.w);assert.deepEqual(layout.broken,[]);assert.equal(layout.missingAlt,0);assert.deepEqual(layout.anchors,[]);assert.equal(layout.h1,1);assert.equal(layout.main,1);assert.equal(layout.lang,"ja");assert.equal(layout.comingSoon,3);
    if(viewport.width<=800){await page.locator(".menu-button").click();await page.locator(".mobile-menu a[href='#services']").click();assert.equal(await page.locator(".menu-button").getAttribute("aria-expanded"),"false");}else await page.locator(".desktop-nav a[href='#services']").click();
    for(const selector of ["#top","#concept","#services","#character","#flow","#booking","#inquiry","#contact","footer"]){await page.locator(selector).scrollIntoViewIfNeeded();await page.waitForTimeout(200);}
    await page.evaluate(()=>scrollTo({top:0,behavior:"instant"}));await page.waitForTimeout(300);
    await page.screenshot({path:path.join(out,`layout-${viewport.width}.png`),fullPage:true});
    assert.equal(traffic.tags.length,0);assert.equal(traffic.collect.length,0);assert.equal((await queue(page)).length,0);
    await record("layout-keyboard-consent",f,{viewport,layout,choices});
  }
  const urls=["/","/index.html","/?email=qa%40example.invalid","/?unknown=qa-secret-fixture","/?utm_source=qa-fixture&utm_medium=qa-test&utm_campaign=qa-campaign","/?utm_source=qa%40example.invalid&utm_term=qa-secret-fixture&gclid=qa-secret-fixture","/?email=qa%2540example.invalid&email=second-private-fixture&phone=0000000000#services","/index.html?unknown=qa-secret-fixture#concept","/#services","/#%73ervices","/#qa-private-fixture","/#qa%40example.invalid","/#%E0%A4%A"];
  for(const suffix of urls) {
    const f=await fixture(),{page,traffic}=f;await page.goto(origin+suffix,{waitUntil:"networkidle"});
    assert.equal(traffic.tags.length,0);assert.equal(traffic.collect.length,0);assert.equal((await queue(page)).length,0);assert.equal(page.url(),origin+suffix);
    await page.locator("[data-analytics-choice='granted']").click();await collected(page);
    const q=await queue(page),config=q.find(x=>x[0]==="config");
    assert.equal(q.filter(x=>x[0]==="config").length,1);assert.equal(q.filter(x=>x[0]==="event").length,0);assert.equal(config[1],id);assert.equal(config[2].send_page_view,true);assert.equal(config[2].page_location,origin+"/");assert.equal(config[2].page_referrer,"");assert.equal(config[2].allow_google_signals,false);assert.equal(config[2].allow_ad_personalization_signals,false);
    assert.deepEqual(q.find(x=>x[0]==="consent")[2],{analytics_storage:"granted",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"});
    assert.equal(traffic.tags.length,1);assert.equal(traffic.tags[0].referrer,"");assert.equal(pv(traffic),1);
    const snapshot=await page.evaluate(()=>({url:location.href,tagUrl:window.__mockTagObservedUrl,state:history.state,len:history.length,before:window.__qaHistoryLength,events:window.__qaHistoryEvents}));
    assert.equal(new URL(snapshot.url).search,"");assert.equal(snapshot.tagUrl,snapshot.url);assert.deepEqual(snapshot.state,{qa:"preserved"});assert.equal(snapshot.len,snapshot.before);assert.deepEqual(snapshot.events,[]);noSecrets({q,tags:traffic.tags,collect:traffic.collect,tagUrl:snapshot.tagUrl});
    if(["#services","#%73ervices","#concept"].some(h=>suffix.endsWith(h))){assert.ok(["#services","#concept"].includes(new URL(page.url()).hash));await page.waitForTimeout(700);assert.ok(Math.abs(await page.locator(new URL(page.url()).hash).evaluate(e=>e.getBoundingClientRect().top))<200);}
    await page.evaluate(code=>(0,eval)(code),controller);await choose(page,"granted");
    const next = new URL(page.url()).hash==="#services" ? "#concept" : "#services";await page.locator(`.desktop-nav a[href='${next}']`).click();await page.waitForTimeout(150);assert.equal(pv(traffic),1);assert.equal(traffic.tags.length,1);assert.equal((await queue(page)).filter(x=>x[0]==="config").length,1);
    await record("opt-in-url-single-page-view",f,{initialUrl:origin+suffix,snapshot,queue:q});
  }
  for(const url of ["http://tokyo-vtuber-fudousan.com/","https://www.tokyo-vtuber-fudousan.com/","https://preview.example.invalid/",origin+"/qa-other-path",origin+"/analytics/"]) {
    const f=await fixture(),{page,traffic}=f;await page.goto(url,{waitUntil:"networkidle"});await page.locator("[data-analytics-choice='granted']").click();await page.waitForTimeout(150);assert.equal(traffic.tags.length,0);assert.equal(traffic.collect.length,0);assert.equal(page.url(),url);await record("environment-scope-no-analytics",f,{url});
  }
  {
    const f=await fixture(),{page,context,traffic}=f;
    await context.addCookies([{name:"_ga",value:"old",domain:"tokyo-vtuber-fudousan.com",path:"/",secure:true},{name:sessionCookie,value:"old",domain:".tokyo-vtuber-fudousan.com",path:"/",secure:true},{name:"other_preference",value:"keep",domain:"tokyo-vtuber-fudousan.com",path:"/",secure:true}]);
    await page.goto(origin+"/",{waitUntil:"networkidle"});await page.locator("[data-analytics-choice='denied']").click();await page.reload({waitUntil:"networkidle"});assert.equal(await page.locator("#analytics-panel").isVisible(),false);assert.equal(traffic.tags.length,0);assert.equal(traffic.collect.length,0);const cookies=await context.cookies();assert.deepEqual(cookies.map(c=>c.name),["other_preference"]);await page.locator(".desktop-nav a[href='#services']").click();assert.equal(new URL(page.url()).hash,"#services");await record("deny-persistence-cookie-cleanup-site-unrestricted",f,{cookies});
  }
  {
    const f=await fixture(undefined, {saved:"granted"}),{page,context,traffic}=f;await page.goto(origin+"/",{waitUntil:"networkidle"});await collected(page);assert.equal(pv(traffic),1);await page.reload({waitUntil:"networkidle"});await collected(page);assert.equal(pv(traffic),2);assert.equal(await page.locator("#analytics-panel").isVisible(),false);
    const count=traffic.collect.length;await page.locator("[data-analytics-open]").click();await Promise.all([reloaded(page),page.locator("[data-analytics-choice='denied']").click()]);await page.waitForTimeout(200);assert.equal(traffic.collect.length,count,"Withdrawal prevents unload probe and later collection");assert.equal(traffic.tags.length,2);assert.equal((await context.cookies()).filter(c=>c.name==="_ga"||c.name===sessionCookie).length,0);assert.equal(await page.evaluate(id=>window['ga-disable-'+id],id),true);assert.equal((await queue(page)).length,0);assert.equal(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key)).choice,"denied");await record("allowed-revisit-withdrawal-network-cookie-stop",f,{pageViews:pv(traffic)});
  }
  for(const options of [{storageBlocked:true},{saved:'{"v":99,"choice":"granted"}'},{saved:'malformed'}]) {
    const f=await fixture(undefined,options),{page,traffic}=f;await page.goto(origin+"/?email=qa%40example.invalid",{waitUntil:"networkidle"});assert.equal(traffic.tags.length,0);assert.equal(traffic.collect.length,0);assert.equal(await page.locator("#analytics-panel").isVisible(),true);
    if(options.storageBlocked){assert.ok((await page.locator("[data-analytics-status]").textContent()).includes("保存できない"));await page.locator("[data-analytics-choice='granted']").click();await collected(page);assert.equal(pv(traffic),1);const tags=traffic.tags.length;await page.reload({waitUntil:"networkidle"});assert.equal(traffic.tags.length,tags);assert.equal((await queue(page)).length,0);await page.locator("[data-analytics-choice='denied']").click();assert.equal(await page.locator("#analytics-panel").isVisible(),false);}
    await record("storage-unavailable-or-invalid-no-implicit-consent",f,{options});
  }
  for(const options of [{failNormalization:true},{ignoreNormalization:true}]) {
    const f=await fixture(undefined,options),{page,traffic}=f;await page.goto(origin+"/?email=qa%40example.invalid",{waitUntil:"networkidle"});await page.locator("[data-analytics-choice='granted']").click();assert.equal(await page.evaluate(()=>window.__tokyoVtuberGaBlockedReason),"url-normalization-failed");assert.equal(traffic.tags.length,0);assert.equal(traffic.collect.length,0);await record("url-normalization-failure-explicit-stop",f,{options});
  }
  {
    const f=await fixture(undefined,{saved:"granted",duplicate:true}),{page,traffic}=f;await page.goto(origin+"/",{waitUntil:"networkidle"});await collected(page);assert.equal(traffic.tags.length,1);assert.equal(pv(traffic),1);
    await page.evaluate(()=>history.pushState({qa:"spa-state"},"","/?email=qa%40example.invalid#services"));await page.waitForTimeout(100);assert.equal(page.url(),origin+"/#services");assert.deepEqual(await page.evaluate(()=>history.state),{qa:"spa-state"});assert.equal(pv(traffic),1);noSecrets(await page.evaluate(()=>location.href));
    await page.goBack();await page.waitForTimeout(150);assert.equal(page.url(),origin+"/");assert.equal(pv(traffic),1);const count=traffic.collect.length;await Promise.all([reloaded(page),page.evaluate(()=>history.pushState({},"","/analytics/"))]);assert.equal(traffic.collect.length,count);assert.equal(page.url(),origin+"/analytics/");assert.equal((await queue(page)).length,0);await record("duplicate-script-history-query-anchor-path-safe",f,{pageViews:pv(traffic)});
  }
  {
    const f=await fixture(undefined,{saved:"granted"}),{page,context,traffic}=f;await page.goto(origin+"/",{waitUntil:"networkidle"});await collected(page);const other=await context.newPage();await other.goto(origin+"/analytics/",{waitUntil:"networkidle"});const count=traffic.collect.length;await other.locator("[data-analytics-open]").click();await Promise.all([reloaded(page),other.locator("[data-analytics-choice='denied']").click()]);assert.equal(traffic.collect.length,count);assert.equal((await queue(page)).length,0);await record("cross-tab-withdrawal",f);
  }
  {
    const f=await fixture(undefined,{slowTag:true}),{page,traffic}=f;await page.goto(origin+"/",{waitUntil:"networkidle"});await page.locator("[data-analytics-choice='granted']").click();await page.waitForFunction(()=>window.__tokyoVtuberGaInitialized);await page.locator("[data-analytics-open]").click();await Promise.all([reloaded(page),page.locator("[data-analytics-choice='denied']").click()]);await page.waitForTimeout(1100);assert.equal(traffic.collect.length,0);assert.equal(traffic.tags.length,1);await record("withdrawal-while-tag-pending",f);
  }
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    const f=await fixture(viewport,{saved:"denied"}),{page,traffic}=f;await page.goto(origin+"/analytics/",{waitUntil:"networkidle"});assert.equal(await page.locator("h1").textContent(),"アクセス解析について");assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,`analytics-info-${viewport.width}.png`),fullPage:true});await page.locator(".info-back").click();assert.equal(page.url(),origin+"/");assert.equal(traffic.tags.length,0);assert.equal(traffic.collect.length,0);await record("explanation-page-and-return-link",f,{viewport});
  }
  {
    const f=await fixture(undefined,{saved:"granted",javascript:false}),{page,traffic}=f;await page.goto(origin+"/",{waitUntil:"networkidle"});assert.equal(traffic.tags.length,0);assert.equal(traffic.collect.length,0);assert.ok(await page.locator(".analytics-noscript").isVisible());await record("javascript-disabled-no-analytics",f);
  }
  const html=await readFile(path.join(dist,"index.html"),"utf8");assert.equal(html.split(id).length-1,1);results.push({test:"single-measurement-id",passed:true});
  await writeFile(path.join(out,"browser-results.json"),JSON.stringify({completedAt:new Date().toISOString(),browser:browser.version(),safety:"Google tag replaced with a local fixture; all fake Google collection requests intercepted and fulfilled locally; no actual Analytics traffic. Tests assert transport counts plus config inputs, not real GA reports.",results},null,2)+"\n");
  console.log(JSON.stringify({passed:results.length,browser:browser.version(),output:out},null,2));
} finally {await browser.close();preview.kill();}
