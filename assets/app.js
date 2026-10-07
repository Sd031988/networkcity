/* Networkcity – öffentliche Website */
(function () {
  "use strict";
  const { esc, icon, fmtPrice, discountText, waLink, telLink, imageUrl } = NC;

  const app = document.getElementById("app");
  const footer = document.getElementById("footer");
  const nav = document.getElementById("nav");
  const menuBtn = document.getElementById("menu-btn");
  const dialog = document.getElementById("buy-dialog");

  let settings = null;
  let products = [];
  let promoTimer = null;
  const shopState = { q: "", condition: "Alle", cats: null, sort: "Empfohlen" };

  async function loadJson(path) {
    // Zeitstempel umgeht den Zwischenspeicher, damit Änderungen schnell sichtbar sind
    const res = await fetch(path + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(path + ": HTTP " + res.status);
    return res.json();
  }

  /* ---------- Bausteine ---------- */

  function callButtons(b) {
    const parts = [];
    if (telLink(b.phone)) parts.push('<a class="btn" href="' + esc(telLink(b.phone)) + '">' + icon("call") + "Anrufen</a>");
    if (waLink(b.whatsapp)) parts.push('<a class="btn primary" href="' + esc(waLink(b.whatsapp)) + '" target="_blank" rel="noopener">' + icon("chat") + "WhatsApp</a>");
    return parts.join("");
  }

  function cta(textHtml) {
    return '<section class="card cta"><p>' + textHtml + '</p><div class="btn-row">' + callButtons(settings.business) + "</div></section>";
  }

  function hoursList() {
    const todayName = NC.WEEKDAYS_DE[(new Date().getDay() + 6) % 7];
    return '<ul class="hours">' + (settings.hours || []).map(function (r) {
      const t = r.open ? esc(r.open) + " – " + esc(r.close) + " Uhr" : "Geschlossen";
      return '<li class="' + (r.day === todayName ? "today" : "") + '"><span>' + esc(r.day) + "</span><span>" + t + "</span></li>";
    }).join("") + "</ul>";
  }

  function specialHoursBox() {
    const entries = NC.upcomingSpecialHours(settings);
    if (!entries.length) return "";
    const items = entries.map(function (e) {
      let extra = "";
      if (e.days === 0) extra = " – <strong>heute</strong>";
      else if (e.days === 1) extra = " – <strong>morgen</strong>";
      let line = esc(e.label) + extra + ": " + (e.row.open
        ? esc(e.row.open) + " – " + esc(e.row.close) + " Uhr"
        : "<strong>geschlossen</strong>");
      const note = String(e.row.note || "").trim();
      if (note) line += '<br><span class="muted small">' + esc(note) + "</span>";
      return "<li>" + line + "</li>";
    }).join("");
    return '<div class="card notice">' + icon("event") + "<div><strong>Sonderöffnungszeiten</strong><ul>" + items + "</ul></div></div>";
  }

  function productCard(p) {
    const sold = !!p.sold;
    let badge = "";
    if (sold) badge = '<span class="badge sold">' + icon("sell") + "Verkauft</span>";
    else if (p.condition === "Neu") badge = '<span class="badge new">' + icon("new_releases") + "Neu</span>";
    else if (p.condition === "Gebraucht") badge = '<span class="badge used">' + icon("history") + "Gebraucht</span>";

    const img = p.image
      ? '<img src="' + esc(imageUrl(p.image)) + '" alt="Produktbild: ' + esc(p.name) + '" loading="lazy">'
      : icon("phone_iphone");

    const price = fmtPrice(p.price);
    let priceHtml = "";
    if (price) {
      if (sold) priceHtml = '<div class="price-old">' + price + "</div>";
      else {
        priceHtml = '<div class="price">' + price + "</div>";
        const old = fmtPrice(p.old_price);
        const disc = discountText(p);
        if (old && disc) priceHtml += '<div><span class="price-old">' + old + '</span><span class="price-discount">' + disc + "</span></div>";
      }
    }

    let foot = "";
    if (sold) foot = '<span class="muted small">' + icon("block") + " Bereits verkauft.</span>";
    else if (p.online_sale && settings.business.whatsapp) {
      const methods = NC.paymentMethodsFor(p, settings);
      if (methods.length) foot += '<span class="muted small">' + icon("payments") + " Bezahlung: " + methods.map(function (m) { return esc(m.label); }).join(" · ") + "</span>";
      foot += '<button class="btn primary" type="button" data-buy="' + esc(p.id) + '">' + icon("shopping_cart") + "Online kaufen / anfragen</button>";
    } else foot = '<span class="muted small">' + icon("storefront") + " Nur im Laden erhältlich.</span>";

    const desc = String(p.description || "").trim();
    return '<article class="card product' + (sold ? " is-sold" : "") + '">' +
      '<div class="product-img">' + img + "</div>" +
      '<div class="product-body">' + badge +
      '<div class="product-name">' + esc(p.name) + "</div>" + priceHtml +
      (desc ? '<p class="product-desc">' + esc(desc) + "</p>" : "") +
      '<div class="product-foot">' + foot + "</div></div></article>";
  }

  function servicePriceRows(list) {
    return '<div class="list-gap">' + (list || []).map(function (s) {
      return '<div class="card price-row"><strong>' + esc(s.name) + '</strong><span class="p">' + esc(s.price) + '</span><span class="muted">' + esc(s.description) + "</span></div>";
    }).join("") + "</div>";
  }

  /* ---------- Werbung (Karussell) ---------- */

  function promoHtml() {
    const cfg = settings.promo || {};
    if (!cfg.enabled) return "";
    const slides = (cfg.slides || []).filter(function (s) { return s.enabled !== false && s.image; });
    if (!slides.length) return "";
    const h = Math.max(180, parseInt(cfg.height, 10) || 520);
    let html = '<div class="promo" id="promo" style="height:clamp(220px, 62vw, ' + h + 'px)" aria-roledescription="Karussell"><div class="promo-track" id="promo-track">';
    slides.forEach(function (s, i) {
      html += '<div class="promo-slide" role="group" aria-label="Bild ' + (i + 1) + " von " + slides.length + '">' +
        '<img src="' + esc(imageUrl(s.image)) + '" alt="' + esc(s.title || "Werbung") + '"' + (i ? ' loading="lazy"' : "") + ">";
      const parts = [];
      if (s.badge) parts.push('<span class="promo-badge">' + esc(s.badge) + "</span>");
      if (s.title) parts.push('<div class="promo-title">' + esc(s.title) + "</div>");
      if (s.text) parts.push('<p class="promo-text">' + esc(s.text) + "</p>");
      if (s.link && s.link_label && /^(https?:|tel:|mailto:|#)/i.test(s.link)) parts.push('<a class="promo-link" href="' + esc(s.link) + '" target="_blank" rel="noopener">' + esc(s.link_label) + "</a>");
      if (parts.length) html += '<div class="promo-overlay">' + parts.join("") + "</div>";
      html += "</div>";
    });
    html += "</div>";
    if (slides.length > 1) {
      html += '<button class="promo-nav promo-prev" type="button" aria-label="Vorheriges Bild">' + icon("chevron_left") + "</button>" +
        '<button class="promo-nav promo-next" type="button" aria-label="Nächstes Bild">' + icon("chevron_right") + "</button>" +
        '<div class="promo-dots">' + slides.map(function (_, i) { return '<button class="promo-dot" type="button" data-i="' + i + '" aria-label="Bild ' + (i + 1) + '"></button>'; }).join("") + "</div>";
    }
    return html + "</div>";
  }

  function initPromo() {
    const root = document.getElementById("promo");
    if (!root) return;
    const cfg = settings.promo || {};
    const track = document.getElementById("promo-track");
    const count = track.children.length;
    const dots = root.querySelectorAll(".promo-dot");
    const interval = Math.max(2, parseInt(cfg.interval, 10) || 5) * 1000;
    const autoplay = cfg.autoplay !== false && count > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let index = 0;
    function render() {
      track.style.transform = "translateX(" + (-index * 100) + "%)";
      dots.forEach(function (d, i) { d.classList.toggle("active", i === index); });
    }
    function stop() { if (promoTimer) { clearInterval(promoTimer); promoTimer = null; } }
    function start() { stop(); if (autoplay) promoTimer = setInterval(function () { go(index + 1); }, interval); }
    function go(i) { index = ((i % count) + count) % count; render(); start(); }
    const prev = root.querySelector(".promo-prev");
    const next = root.querySelector(".promo-next");
    if (prev) prev.addEventListener("click", function () { go(index - 1); });
    if (next) next.addEventListener("click", function () { go(index + 1); });
    dots.forEach(function (d) { d.addEventListener("click", function () { go(Number(d.dataset.i)); }); });
    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    // Wischen auf dem Handy
    let x0 = null;
    root.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    root.addEventListener("touchend", function (e) {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1)); else start();
    });
    render();
    start();
  }

  /* ---------- Seiten ---------- */

  function pageStart() {
    const b = settings.business;
    let html = '<div class="hero">';
    if (b.hero_image) html += '<img class="hero-img" src="' + esc(imageUrl(b.hero_image)) + '" alt="Logo des Ladens ' + esc(b.name) + '">';
    html += "<h1>" + esc(b.hero_title) + '</h1><p class="lead">' + esc(b.hero_subtitle) + "</p>" +
      '<div class="chips"><span class="chip">Neu & geprüft gebraucht</span><span class="chip">Reparatur</span><span class="chip">Internetcafé</span><span class="chip">Zubehör</span></div>' +
      '<div class="btn-row center"><a class="btn primary" href="#shop">' + icon("shopping_bag") + 'Zum Handy-Shop</a><a class="btn" href="#kontakt">' + icon("route") + "Kontakt & Anfahrt</a></div></div>";
    html += promoHtml();
    html += specialHoursBox();

    const services = [
      ["computer", "Internetcafé", "PC-Arbeitsplätze, Drucken, Kopieren, Scannen und WLAN für alle.", "#internetcafe"],
      ["smartphone", "Handys neu & gebraucht", "Aktuelle Modelle und geprüfte Gebrauchtgeräte zum fairen Preis.", "#shop"],
      ["build", "Reparaturservice", "Schnelle Reparatur von Display, Akku, Ladebuchse und mehr.", "#reparatur"],
      ["headphones", "Zubehör", "Hüllen, Ladegeräte, Kabel, Kopfhörer und vieles mehr im Laden.", "#shop"],
    ];
    html += '<section><h2 class="section-title">' + icon("grid_view") + 'Unsere Services</h2><div class="grid c4">' +
      services.map(function (s) {
        return '<a class="card service-card" href="' + s[3] + '" style="text-decoration:none;color:inherit">' + icon(s[0], "big") + "<h3>" + s[1] + "</h3><p>" + s[2] + "</p></a>";
      }).join("") + "</div></section>";

    const extra = settings.extra_services || [];
    if (extra.length) {
      html += '<section><h2 class="section-title">' + icon("handshake") + 'Weitere Services</h2><div class="grid c4">' +
        extra.map(function (s) {
          return '<div class="card service-card">' + icon(s.icon || "sell", "big") + "<h3>" + esc(s.name) + "</h3>" + (s.description ? "<p>" + esc(s.description) + "</p>" : "") + "</div>";
        }).join("") + "</div></section>";
    }

    html += '<section class="grid info"><div class="card"><h2 class="section-title">' + icon("info") + "Über uns</h2><p>" + esc(b.about_text) + "</p>" +
      '<p class="muted">' + icon("place") + " " + esc(b.street) + ", " + esc(b.zip_city) + "</p></div>" +
      '<div class="card"><h2 class="section-title">' + icon("schedule") + "Öffnungszeiten</h2>" + hoursList() + "</div></section>";

    const featured = products.filter(function (p) { return p.featured && !NC.productIsHidden(p, settings.sold_remove_days); }).slice(0, 6);
    if (featured.length) {
      html += '<section><h2 class="section-title">' + icon("local_offer") + 'Aktuelle Angebote</h2><div class="grid c3">' + featured.map(productCard).join("") + "</div></section>";
    }

    const gallery = b.gallery || [];
    if (gallery.length) {
      html += '<section><h2 class="section-title">' + icon("photo_library") + 'Ein Blick in unseren Laden</h2><div class="grid c3 gallery">' +
        gallery.map(function (f) { return '<img src="' + esc(imageUrl(f)) + '" alt="Foto aus dem Laden" loading="lazy">'; }).join("") + "</div></section>";
    }

    html += cta("<strong>Haben Sie Fragen?</strong> Rufen Sie uns an unter <strong>" + esc(b.phone) + "</strong> oder schreiben Sie uns per WhatsApp – wir beraten Sie gerne.");
    app.innerHTML = html;
    initPromo();
  }

  function pageCafe() {
    const c = settings.internetcafe || {};
    let html = '<h1 class="section-title">' + icon("computer") + esc(c.title || "Internetcafé") + "</h1><p>" + esc(c.text) + "</p>";
    if ((c.bullet_points || []).length) html += '<ul class="bullets">' + c.bullet_points.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    html += '<section><h2 class="section-title">' + icon("receipt_long") + "Leistungen & Preise</h2>" + servicePriceRows(c.services) + "</section>";
    html += '<section class="card"><p style="margin:0"><strong>Gerne können Sie einfach vorbeikommen</strong> – meist ist direkt ein Platz frei. Egal ob für die schnelle E-Mail, das Ausdrucken von Tickets oder eine Zeit am Rechner: Wir sind für Sie da.</p></section>';
    app.innerHTML = html;
  }

  function pageRepair() {
    const r = settings.repair || {};
    let html = '<h1 class="section-title">' + icon("build") + esc(r.title || "Handy-Reparatur") + "</h1><p>" + esc(r.text) + "</p>";
    if ((r.steps || []).length) {
      html += '<section><h2 class="section-title">' + icon("checklist") + 'So einfach geht\'s</h2><div class="list-gap">' +
        r.steps.map(function (s, i) { return '<div class="card step"><span class="step-num">' + (i + 1) + "</span><span>" + esc(s) + "</span></div>"; }).join("") + "</div></section>";
    }
    html += '<section><h2 class="section-title">' + icon("receipt_long") + "Leistungen & Preise</h2>" + servicePriceRows(r.services) + "</section>";
    html += cta("<strong>Bringen Sie Ihr Gerät einfach vorbei</strong> oder rufen Sie vorher kurz an. Die Prüfung ist kostenlos und Sie bekommen für alles ein faires Angebot.");
    app.innerHTML = html;
  }

  function pageContact() {
    const b = settings.business;
    let html = '<h1 class="section-title">' + icon("contact_phone") + "Kontakt & Anfahrt</h1>" + specialHoursBox();
    html += '<section class="grid c2" style="margin-top:24px"><div class="card"><h2 class="section-title">' + icon("contact_page") + "Kontakt</h2>" +
      "<p><strong>Adresse</strong><br>" + esc(b.street) + "<br>" + esc(b.zip_city) + "</p>" +
      "<p><strong>Telefon:</strong> " + esc(b.phone) + "<br><strong>WhatsApp:</strong> " + esc(b.whatsapp) + "<br><strong>E-Mail:</strong> " +
      (b.email ? '<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + "</a>" : "") + "</p>" +
      '<div class="btn-row">' + callButtons(b) + (b.email ? '<a class="btn" href="mailto:' + esc(b.email) + '">' + icon("mail") + "E-Mail</a>" : "") + "</div></div>" +
      '<div class="card"><h2 class="section-title">' + icon("schedule") + "Öffnungszeiten</h2>" + hoursList() + "</div></section>";
    if (b.map_url && /^https:\/\/(www\.)?(google\.[a-z.]+|maps\.google\.[a-z.]+)\//i.test(b.map_url)) {
      // Karte erst nach Klick laden – vorher werden keine Daten an Google übertragen
      html += '<section><h2 class="section-title">' + icon("map") + 'Anfahrt</h2><div class="card map-consent" id="map-box">' +
        "<p>Beim Laden der Karte werden Daten (u. a. Ihre IP-Adresse) an Google übertragen.</p>" +
        '<div class="btn-row center"><button class="btn primary" type="button" id="map-load">' + icon("map") + "Karte laden</button>" +
        '<a class="btn" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(b.street + ", " + b.zip_city) + '" target="_blank" rel="noopener">' + icon("open_in_new") + "In Google Maps öffnen</a></div></div></section>";
    }
    app.innerHTML = html;
    const mapBtn = document.getElementById("map-load");
    if (mapBtn) mapBtn.addEventListener("click", function () {
      document.getElementById("map-box").outerHTML = '<iframe class="map" src="' + esc(b.map_url) +
        '" title="Google-Maps-Karte mit dem Standort von ' + esc(b.name) + '" referrerpolicy="no-referrer-when-downgrade"></iframe>';
    });
  }

  function pageShop() {
    const visible = products.filter(function (p) { return !NC.productIsHidden(p, settings.sold_remove_days); });
    const cats = Array.from(new Set(visible.map(function (p) { return p.category; }).filter(Boolean))).sort();
    if (!shopState.cats) shopState.cats = cats.slice();

    app.innerHTML = '<h1 class="section-title">' + icon("shopping_bag") + "Handy-Shop</h1>" +
      "<p>Neu und geprüft gebraucht – zum fairen Preis, mit Gewährleistung und persönlicher Beratung direkt im Laden.</p>" +
      '<div class="filters">' +
      '<div class="filters-row"><label class="search"><span class="visually-hidden">Produkt suchen</span><input type="search" id="shop-q" placeholder="z. B. iPhone, Samsung, Hülle …" value="' + esc(shopState.q) + '"></label>' +
      '<div class="seg" id="shop-cond" role="group" aria-label="Zustand">' + ["Alle", "Neu", "Gebraucht"].map(function (c) {
        return '<button type="button" data-v="' + c + '" class="' + (shopState.condition === c ? "on" : "") + '" aria-pressed="' + (shopState.condition === c) + '">' + c + "</button>";
      }).join("") + "</div></div>" +
      (cats.length > 1 ? '<div class="filters-row" id="shop-cats" role="group" aria-label="Kategorie">' + cats.map(function (c) {
        const on = shopState.cats.indexOf(c) !== -1;
        return '<button type="button" class="cat-toggle' + (on ? " on" : "") + '" data-c="' + esc(c) + '" aria-pressed="' + on + '">' + esc(c) + "</button>";
      }).join("") + "</div>" : "") +
      '<div class="filters-row"><label class="field" style="flex-direction:row;align-items:center;gap:8px"><span>Sortierung</span>' +
      '<select id="shop-sort" style="width:auto">' + ["Empfohlen", "Preis aufsteigend", "Preis absteigend"].map(function (s) {
        return "<option" + (shopState.sort === s ? " selected" : "") + ">" + s + "</option>";
      }).join("") + "</select></label></div></div>" +
      '<p class="muted small" id="shop-count"></p><div class="grid c3" id="shop-grid"></div>' +
      '<div id="shop-cta"></div>';

    function renderList() {
      const q = shopState.q.trim().toLowerCase();
      let list = visible.filter(function (p) {
        if (q && String(p.name).toLowerCase().indexOf(q) === -1 && String(p.description || "").toLowerCase().indexOf(q) === -1) return false;
        if (shopState.condition !== "Alle" && p.condition !== shopState.condition) return false;
        if (cats.length > 1 && p.category && shopState.cats.indexOf(p.category) === -1) return false;
        return true;
      });
      const price = function (p) { return Number(p.price) || 0; };
      list.sort(function (a, b) {
        const s = (a.sold ? 1 : 0) - (b.sold ? 1 : 0);
        if (s) return s;
        if (shopState.sort === "Preis aufsteigend") return price(a) - price(b);
        if (shopState.sort === "Preis absteigend") return price(b) - price(a);
        const f = (a.featured ? 0 : 1) - (b.featured ? 0 : 1);
        return f || price(a) - price(b);
      });
      document.getElementById("shop-count").textContent = list.length ? list.length + " Produkte" : "";
      document.getElementById("shop-grid").innerHTML = list.length ? list.map(productCard).join("")
        : '<div class="empty" style="grid-column:1/-1">Keine Produkte gefunden. Schauen Sie bald wieder vorbei!</div>';
    }

    document.getElementById("shop-q").addEventListener("input", function (e) { shopState.q = e.target.value; renderList(); });
    document.getElementById("shop-sort").addEventListener("change", function (e) { shopState.sort = e.target.value; renderList(); });
    document.getElementById("shop-cond").addEventListener("click", function (e) {
      const btn = e.target.closest("button"); if (!btn) return;
      shopState.condition = btn.dataset.v;
      this.querySelectorAll("button").forEach(function (b) { const on = b === btn; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      renderList();
    });
    const catsEl = document.getElementById("shop-cats");
    if (catsEl) catsEl.addEventListener("click", function (e) {
      const btn = e.target.closest("button"); if (!btn) return;
      const c = btn.dataset.c;
      const i = shopState.cats.indexOf(c);
      if (i === -1) shopState.cats.push(c); else shopState.cats.splice(i, 1);
      btn.classList.toggle("on", i === -1); btn.setAttribute("aria-pressed", i === -1);
      renderList();
    });
    renderList();
    document.getElementById("shop-cta").innerHTML = cta("<strong>Sie interessieren sich für ein Produkt?</strong> Rufen Sie uns an oder schreiben Sie uns per WhatsApp – wir legen es gerne für Sie zur Seite.");
  }

  /* ---------- Kaufanfrage ---------- */

  function openBuy(id) {
    const p = products.find(function (x) { return String(x.id) === String(id); });
    if (!p) return;
    const methods = NC.paymentMethodsFor(p, settings);
    const price = fmtPrice(p.price);
    let body = "";
    if (methods.length) {
      body = '<p class="muted small" style="margin:0">Wählen Sie Ihre Zahlungsart – wir bestätigen die Verfügbarkeit per WhatsApp.</p>' +
        '<fieldset style="border:0;padding:0;margin:0"><legend class="visually-hidden">Zahlungsart</legend><div class="radio-list">' +
        methods.map(function (m, i) {
          return '<label><input type="radio" name="pay" value="' + i + '"' + (i ? "" : " checked") + ">" + icon(m.icon || "payments") + " " + esc(m.label) + "</label>";
        }).join("") + '</div></fieldset><div id="pay-info"></div>' +
        '<a class="btn primary" id="buy-send" target="_blank" rel="noopener">' + icon("send") + "Bestellung per WhatsApp senden</a>";
    } else {
      body = '<div class="info-box">Für dieses Produkt sind aktuell keine Zahlungsarten hinterlegt. Bitte kontaktieren Sie uns direkt.</div><div class="btn-row">' + callButtons(settings.business) + "</div>";
    }
    dialog.innerHTML = '<div class="dialog-head"><h3 id="buy-title">Kaufanfrage</h3><button class="btn icon-only small" type="button" data-close aria-label="Schließen">' + icon("close") + "</button></div>" +
      '<div class="dialog-body"><div><div class="product-name">' + esc(p.name) + "</div>" + (price ? '<div class="price">' + price + "</div>" : "") + "</div>" + body + "</div>";

    function update() {
      const checked = dialog.querySelector("input[name=pay]:checked");
      if (!checked) return;
      const m = methods[Number(checked.value)];
      document.getElementById("pay-info").innerHTML = m.info ? '<div class="info-box">' + icon("info") + " " + esc(m.info) + "</div>" : "";
      const msg = "Hallo, ich möchte folgendes Produkt kaufen: " + p.name + (price ? " (" + price + ")" : "") +
        ".\nZahlungsart: " + m.label + ".\nIst es noch verfügbar?";
      document.getElementById("buy-send").href = waLink(settings.business.whatsapp, msg);
    }
    dialog.querySelectorAll("input[name=pay]").forEach(function (r) { r.addEventListener("change", update); });
    update();
    dialog.showModal();
  }
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
  });
  app.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-buy]");
    if (btn) openBuy(btn.dataset.buy);
  });

  /* ---------- Routing ---------- */

  const PAGES = { start: pageStart, internetcafe: pageCafe, shop: pageShop, reparatur: pageRepair, kontakt: pageContact };
  const TITLES = { start: "", internetcafe: "Internetcafé", shop: "Handy-Shop", reparatur: "Reparatur", kontakt: "Kontakt" };

  function route() {
    if (!settings) return;
    if (promoTimer) { clearInterval(promoTimer); promoTimer = null; }
    let page = (location.hash || "#start").slice(1);
    if (!PAGES[page]) page = "start";
    nav.querySelectorAll("a").forEach(function (a) {
      const on = a.dataset.page === page;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    nav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    PAGES[page]();
    const base = settings.business.name + " " + (settings.business.zip_city || "").replace(/^\d+\s*/, "").split("-")[0];
    document.title = (TITLES[page] ? TITLES[page] + " – " : "") + base.trim();
    window.scrollTo(0, 0);
  }

  menuBtn.addEventListener("click", function () {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  window.addEventListener("hashchange", route);

  function renderChrome() {
    const b = settings.business;
    NC.applyTheme(settings.theme);
    const brand = document.getElementById("brand");
    brand.innerHTML = (b.logo ? '<img src="' + esc(imageUrl(b.logo)) + '" alt="">' : "") + "<span>" + esc(b.name) + "</span>";
    footer.innerHTML = "<div><strong>" + esc(b.name) + "</strong><br>" + esc(b.street) + ", " + esc(b.zip_city) + "</div>" +
      "<div>" + (telLink(b.phone) ? '<a href="' + esc(telLink(b.phone)) + '">' + icon("call") + " " + esc(b.phone) + "</a><br>" : "") +
      (b.email ? '<a href="mailto:' + esc(b.email) + '">' + icon("mail") + " " + esc(b.email) + "</a>" : "") + "</div>";
  }

  Promise.all([loadJson("data/settings.json"), loadJson("data/products.json")])
    .then(function (res) {
      settings = res[0];
      settings.business = settings.business || {};
      products = Array.isArray(res[1]) ? res[1] : [];
      renderChrome();
      route();
    })
    .catch(function (err) {
      console.error(err);
      app.innerHTML = '<div class="error-box">Die Inhalte konnten nicht geladen werden. Bitte laden Sie die Seite neu.</div>';
    });
})();
