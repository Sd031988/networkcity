/* Networkcity – gemeinsame Hilfsfunktionen (öffentliche Seite + Verwaltung) */
(function (global) {
  "use strict";

  const THEMES = {
    orange: {
      label: "Modern Orange & Schwarz",
      swatch: ["#F5740A", "#1C1917", "#FFF1E3"],
      primary: "#F5740A", primary_hover: "#D9640A", primary_soft: "#FFF1E3",
      bg: "#FFFFFF",
      bg_grad: "radial-gradient(1200px 620px at 18% -12%, #FFF1E3 0%, #FFFFFF 58%)",
      surface: "#FFFFFF", surface2: "#FFF7F0", text: "#1C1917", muted: "#6B7280",
      border: "#F1D9C2", header: "rgba(255,255,255,0.86)",
      shadow: "0 12px 30px rgba(245,116,10,0.10)", on_primary: "#FFFFFF",
    },
    blue: {
      label: "Modern & hell (Blau)",
      swatch: ["#2563EB", "#0F172A", "#E8F0FF"],
      primary: "#2563EB", primary_hover: "#1D4ED8", primary_soft: "#E8F0FF",
      bg: "#FFFFFF",
      bg_grad: "radial-gradient(1200px 620px at 18% -12%, #E8F0FF 0%, #FFFFFF 58%)",
      surface: "#FFFFFF", surface2: "#F2F6FF", text: "#0F172A", muted: "#64748B",
      border: "#DBE4F5", header: "rgba(255,255,255,0.86)",
      shadow: "0 12px 30px rgba(37,99,235,0.10)", on_primary: "#FFFFFF",
    },
    dark: {
      label: "Dunkel & edel",
      swatch: ["#FF8A3D", "#0D0D12", "#1E1E27"],
      primary: "#FF8A3D", primary_hover: "#FF9E5C", primary_soft: "#2A1B0E",
      bg: "#0D0D12",
      bg_grad: "radial-gradient(1200px 620px at 18% -12%, #1D1307 0%, #0D0D12 58%)",
      surface: "#17171E", surface2: "#1E1E27", text: "#F4F4F7", muted: "#9BA1AC",
      border: "#2A2A36", header: "rgba(13,13,18,0.80)",
      shadow: "0 16px 36px rgba(0,0,0,0.45)", on_primary: "#1A1005",
    },
    nacht: {
      label: "Networkcity Nacht (passend zum Logo)",
      swatch: ["#FF7A1A", "#07080B", "#C9CDD3"],
      primary: "#FF7A1A", primary_hover: "#FF9440", primary_soft: "#2B1708",
      bg: "#07080B",
      bg_grad: "none",
      surface: "rgba(20,21,27,0.86)", surface2: "#181920", text: "#F2F3F5", muted: "#A6AAB3",
      border: "rgba(255,255,255,0.09)", header: "rgba(7,8,11,0.82)",
      shadow: "0 18px 40px rgba(0,0,0,0.55)", on_primary: "#140A02",
    },
  };
  const DEFAULT_THEME = "orange";

  function applyTheme(key) {
    const t = THEMES[key] || THEMES[DEFAULT_THEME];
    const s = document.documentElement.style;
    s.setProperty("--nc-primary", t.primary);
    s.setProperty("--nc-primary-hover", t.primary_hover);
    s.setProperty("--nc-primary-soft", t.primary_soft);
    s.setProperty("--nc-bg", t.bg);
    s.setProperty("--nc-bg-grad", t.bg_grad);
    s.setProperty("--nc-surface", t.surface);
    s.setProperty("--nc-surface-2", t.surface2);
    s.setProperty("--nc-text", t.text);
    s.setProperty("--nc-muted", t.muted);
    s.setProperty("--nc-border", t.border);
    s.setProperty("--nc-header", t.header);
    s.setProperty("--nc-shadow", t.shadow);
    s.setProperty("--nc-on-primary", t.on_primary);
    document.documentElement.dataset.theme = key in THEMES ? key : DEFAULT_THEME;
  }

  const WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtPrice(value) {
    const v = Number(value);
    if (!isFinite(v) || v <= 0) return "";
    return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  function discountText(p) {
    const price = Number(p.price) || 0;
    const old = Number(p.old_price) || 0;
    if (old <= 0 || price <= 0 || old <= price) return "";
    const diff = old - price;
    return "−" + fmtPrice(diff) + " (−" + Math.round((diff / old) * 100) + " %)";
  }

  // Datum als lokales "YYYY-MM-DD"
  function todayIso() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseIso(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  function upcomingSpecialHours(settings, windowDays) {
    windowDays = windowDays == null ? 35 : windowDays;
    const today = parseIso(todayIso());
    const out = [];
    (settings.special_hours || []).forEach(function (row) {
      const d = parseIso(row.date);
      if (!d) return;
      const days = daysBetween(today, d);
      if (days < 0 || days > windowDays) return;
      const label = String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." +
        d.getFullYear() + " (" + WEEKDAYS_DE[(d.getDay() + 6) % 7] + ")";
      out.push({ date: d, days: days, label: label, row: row });
    });
    out.sort(function (a, b) { return a.date - b.date; });
    return out;
  }

  function productIsHidden(p, soldRemoveDays) {
    if (p.available === false) return true;
    if (!p.sold) return false;
    const soldAt = parseIso(p.sold_at);
    if (!soldAt) return false;
    let limit = parseInt(soldRemoveDays, 10);
    if (isNaN(limit)) limit = 7;
    return daysBetween(soldAt, parseIso(todayIso())) >= limit;
  }

  function enabledPaymentMethods(settings) {
    return (settings.payment_methods || []).filter(function (m) { return m.enabled !== false; });
  }
  function paymentMethodsFor(p, settings) {
    const enabled = enabledPaymentMethods(settings);
    const sel = p.payment_methods || [];
    if (!sel.length) return enabled;
    return enabled.filter(function (m) { return sel.indexOf(m.id) !== -1; });
  }

  function digitsOnly(phone) { return String(phone || "").replace(/\D/g, ""); }
  function waLink(phone, text) {
    const d = digitsOnly(phone);
    if (!d) return "";
    return "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : "");
  }
  function telLink(phone) {
    const d = digitsOnly(phone);
    return d ? "tel:" + d : "";
  }
  function imageUrl(filename) {
    if (!filename) return "";
    return "data/images/" + encodeURIComponent(String(filename).split("/").pop());
  }
  function icon(name, extra) {
    return '<span class="ms' + (extra ? " " + extra : "") + '" aria-hidden="true">' + esc(name || "sell") + "</span>";
  }
  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
    return Date.now().toString(16) + Math.random().toString(16).slice(2);
  }

  global.NC = {
    THEMES: THEMES, DEFAULT_THEME: DEFAULT_THEME, WEEKDAYS_DE: WEEKDAYS_DE,
    applyTheme: applyTheme, esc: esc, fmtPrice: fmtPrice, discountText: discountText,
    todayIso: todayIso, upcomingSpecialHours: upcomingSpecialHours, productIsHidden: productIsHidden,
    enabledPaymentMethods: enabledPaymentMethods, paymentMethodsFor: paymentMethodsFor,
    digitsOnly: digitsOnly, waLink: waLink, telLink: telLink, imageUrl: imageUrl, icon: icon, uid: uid,
  };
})(window);
