(() => {
  if (window.__tokyoVtuberConsentController) return;
  window.__tokyoVtuberConsentController = true;
  const { measurementId = "", enabled = false } = window.__tokyoVtuberAnalyticsConfig || {};
  const storageKey = "tokyo-vtuber-analytics-consent-v1";
  const disableKey = "ga-disable-" + measurementId;
  window[disableKey] = true;
  let choice = null;
  let storageAvailable = true;
  let started = false;
  let opener = null;
  let tag = null;
  const replaceHistory = history.replaceState.bind(history);
  const decodeChoice = value => {
    try {
      const saved = JSON.parse(value);
      return saved?.v === 1 && ["granted", "denied"].includes(saved.choice) ? saved.choice : null;
    } catch { return null; }
  };
  try { choice = decodeChoice(localStorage.getItem(storageKey)); } catch { storageAvailable = false; }
  const isProductionLP = () => enabled && /^G-[A-Z0-9]+$/.test(measurementId) &&
    location.protocol === "https:" && location.hostname === "tokyo-vtuber-fudousan.com" &&
    ["/", "/index.html"].includes(location.pathname);
  const clearCookies = () => {
    if (location.hostname !== "tokyo-vtuber-fudousan.com" || !/^G-[A-Z0-9]+$/.test(measurementId)) return;
    const names = ["_ga", "_ga_" + measurementId.replace(/^G-/, "")];
    for (const name of names) {
      for (const domain of ["", location.hostname, "." + location.hostname]) {
        document.cookie = name + "=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax" +
          (domain ? "; Domain=" + domain : "") + (location.protocol === "https:" ? "; Secure" : "");
      }
    }
  };
  const normalizeLocation = () => {
    let anchor = "";
    try {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) anchor = "#" + encodeURIComponent(target.id);
    } catch {}
    const safeUrl = location.origin + location.pathname + anchor;
    try {
      if (location.href !== safeUrl) replaceHistory(history.state, "", safeUrl);
    } catch {
      window.__tokyoVtuberGaBlockedReason = "url-normalization-failed";
      return false;
    }
    if (location.search || location.href !== safeUrl) {
      window.__tokyoVtuberGaBlockedReason = "url-normalization-failed";
      return false;
    }
    return true;
  };
  const start = () => {
    if (choice !== "granted" || started || !isProductionLP() || !normalizeLocation()) return;
    started = true;
    window.__tokyoVtuberGaInitialized = true;
    window[disableKey] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { if (choice === "granted") window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage:"granted", ad_storage:"denied", ad_user_data:"denied", ad_personalization:"denied"
    });
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view:true,
      page_location:"https://tokyo-vtuber-fudousan.com/",
      page_referrer:"", page_title:"東京VTuber不動産｜オンライン物件相談",
      cookie_domain:"tokyo-vtuber-fudousan.com", cookie_path:"/",
      allow_google_signals:false, allow_ad_personalization_signals:false
    });
    tag = document.createElement("script");
    tag.async = true;
    tag.referrerPolicy = "no-referrer";
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    document.head.appendChild(tag);
  };
  const stop = () => {
    window[disableKey] = true;
    tag?.remove();
    clearCookies();
    // Removing a script cannot unload its timers. Reload ends the old library document.
    // No denied consent update is sent: basic opt-in has no cookieless rejection ping.
    if (started) location.reload();
  };
  const ready = () => {
    const panel = document.getElementById("analytics-panel");
    const controls = [...document.querySelectorAll("[data-analytics-open]")];
    const status = panel?.querySelector("[data-analytics-status]");
    if (!panel || !status) return;
    const updateStatus = () => {
      const label = choice === "granted" ? "許可" : choice === "denied" ? "拒否（解析していません）" : "未選択（解析していません）";
      status.textContent = "現在の設定：" + label + (storageAvailable ? "" : "。選択を保存できないため、次回もう一度お選びください。");
      if (window.__tokyoVtuberGaBlockedReason) status.textContent += "。URLを安全に処理できなかったため、このページの解析は停止しています。";
    };
    const show = focus => {
      panel.hidden = false;
      controls.forEach(button => button.setAttribute("aria-expanded", "true"));
      updateStatus();
      if (focus) panel.querySelector("h2").focus();
    };
    const close = () => {
      const returnFocus = panel.contains(document.activeElement) || Boolean(opener);
      panel.hidden = true;
      controls.forEach(button => button.setAttribute("aria-expanded", "false"));
      if (returnFocus) (opener || controls[0])?.focus();
      opener = null;
    };
    controls.forEach(button => {
      button.hidden = false;
      button.addEventListener("click", () => {opener = button; show(true);});
    });
    panel.querySelector("[data-analytics-close]").addEventListener("click", close);
    panel.addEventListener("keydown", event => { if (event.key === "Escape") {event.preventDefault(); close();} });
    panel.querySelectorAll("[data-analytics-choice]").forEach(button => button.addEventListener("click", () => {
      choice = button.dataset.analyticsChoice;
      try { localStorage.setItem(storageKey, JSON.stringify({v:1,choice})); } catch { storageAvailable = false; }
      if (choice === "granted") start(); else stop();
      updateStatus();
      close();
    }));
    // The current site has no SPA router. Keep future/history URL changes safe,
    // without generating extra page_view or changing the caller's history state.
    const maintainLocation = () => {
      if (!started || choice !== "granted") return;
      if (!isProductionLP() || !normalizeLocation()) stop();
    };
    for (const method of ["pushState", "replaceState"]) {
      const original = history[method].bind(history);
      history[method] = function (...args) {const result = original(...args); maintainLocation(); return result;};
    }
    addEventListener("popstate", maintainLocation);
    addEventListener("hashchange", maintainLocation);
    addEventListener("storage", event => {
      if (event.key !== storageKey && event.key !== null) return;
      choice = decodeChoice(event.newValue);
      if (choice === "granted") start(); else stop();
      updateStatus();
      if (choice === null) show(false);
    });
    if (choice === "granted") start(); else clearCookies();
    updateStatus();
    if (choice === null) show(false);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, {once:true});
  else ready();
})();
