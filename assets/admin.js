/* Networkcity – Verwaltung
 * Speichert Änderungen direkt im GitHub-Repository (data/*.json und data/images/).
 * Anmeldung mit einem persönlichen GitHub-Token (fine-grained, nur dieses Repo,
 * Berechtigung "Contents: Read and write"). Ohne gültigen Token kann nichts
 * geändert werden.
 */
(function () {
  "use strict";
  const { esc, icon } = NC;

  const CFG = Object.assign({
    repo: "Sd031988/networkcity",
    branch: "main",
    api: "https://api.github.com",
  }, window.NC_ADMIN_CONFIG || {});

  const CATEGORIES = ["Smartphone", "Tablet", "Zubehör", "Laptop/PC", "Sonstiges"];
  // Symbole, die in der lokal eingebundenen Symbolschrift enthalten sind
  const ICON_CHOICES = ("local_shipping package_2 package inventory_2 local_post_office markunread_mailbox move_to_inbox " +
    "currency_exchange public payments account_balance_wallet credit_card account_balance euro paid savings attach_money " +
    "point_of_sale local_atm qr_code qr_code_scanner receipt confirmation_number airplane_ticket flight train directions_bus " +
    "wifi print scanner content_copy photo_camera computer laptop desktop_windows monitor tablet_android smartphone phone_iphone " +
    "phone_android headphones headset_mic speaker watch keyboard mouse cable battery_charging_full power sim_card memory sd_card usb " +
    "router tv cast devices videogame_asset sports_esports build handyman construction support_agent translate language description " +
    "article badge id_card fax verified verified_user security shield lock key star favorite thumb_up bolt eco recycling coffee " +
    "local_cafe restaurant local_drink lightbulb celebration groups person storefront store shopping_bag shopping_cart shopping_basket " +
    "local_mall redeem card_giftcard loyalty percent sell local_offer location_on directions schedule calendar_month event handshake").split(" ");

  const root = document.getElementById("admin");
  const dialog = document.getElementById("edit-dialog");
  const toastEl = document.getElementById("toast");
  const logoutBtn = document.getElementById("logout");

  let token = "";
  let settings = null;
  let products = [];
  let images = [];
  let currentTab = "promo";
  const localPreview = {}; // frisch hochgeladene Bilder (bis GitHub Pages neu veröffentlicht hat)

  /* ---------------- Hilfen ---------------- */

  let toastTimer = null;
  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("error", !!isError);
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, isError ? 7000 : 4500);
  }
  const SAVED_MSG = "Gespeichert ✓ Auf der Website in ca. 1–2 Minuten sichtbar.";

  function imgSrc(name) { return name ? (localPreview[name] || NC.imageUrl(name)) : ""; }

  function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(str);
    return bytesToB64(bytes);
  }
  function bytesToB64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    const bin = atob(String(b64).replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function withBusy(el, fn) {
    if (el) el.classList.add("busy");
    try { return await fn(); }
    catch (e) { console.error(e); toast(e.message || String(e), true); }
    finally { if (el) el.classList.remove("busy"); }
  }

  /* ---------------- GitHub-API ---------------- */

  async function gh(method, path, body) {
    const headers = { Accept: "application/vnd.github+json", Authorization: "Bearer " + token };
    if (body) headers["Content-Type"] = "application/json";
    let res;
    try {
      res = await fetch(CFG.api + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    } catch (e) {
      throw new Error("Keine Verbindung zu GitHub. Bitte Internetverbindung prüfen.");
    }
    if (res.ok) return res.status === 204 ? null : res.json();
    let detail = "";
    try { detail = (await res.json()).message || ""; } catch (e) { /* leer */ }
    const err = new Error(explain(res.status, method, detail));
    err.status = res.status;
    throw err;
  }
  function explain(status, method, detail) {
    if (status === 401) return "Der Token ist ungültig oder abgelaufen. Bitte neu anmelden.";
    if (status === 403 && method !== "GET") return "Keine Schreibrechte. Der Token braucht „Contents: Read and write“ für dieses Repository.";
    if (status === 403) return "Zugriff verweigert (" + detail + ").";
    if (status === 404) return "Nicht gefunden – hat der Token Zugriff auf das Repository " + CFG.repo + "?";
    if (status === 409) return "Gleichzeitige Änderung erkannt. Bitte noch einmal speichern.";
    if (status === 422) return "GitHub hat die Änderung abgelehnt: " + detail;
    return "GitHub-Fehler " + status + (detail ? ": " + detail : "");
  }

  function contentsPath(path) {
    return "/repos/" + CFG.repo + "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  }

  async function readJson(path) {
    const f = await gh("GET", contentsPath(path) + "?ref=" + encodeURIComponent(CFG.branch));
    return { data: JSON.parse(b64ToUtf8(f.content)), sha: f.sha };
  }

  // Liest die aktuelle Datei, wendet die Änderung an und speichert (bei Konflikt 1x wiederholen)
  async function updateJson(path, mutate, message) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = await readJson(path);
      const res = mutate(cur.data);
      const data = res === undefined ? cur.data : res;
      try {
        await gh("PUT", contentsPath(path), {
          message: message || "Aktualisiert: " + path.split("/").pop(),
          content: utf8ToB64(JSON.stringify(data, null, 2) + "\n"),
          sha: cur.sha,
          branch: CFG.branch,
        });
        return data;
      } catch (e) {
        if ((e.status === 409 || e.status === 422) && attempt === 0) continue;
        throw e;
      }
    }
  }
  async function saveSettings(mutate, msg) { settings = await updateJson("data/settings.json", mutate, msg); }
  async function saveProducts(mutate, msg) { products = await updateJson("data/products.json", mutate, msg); }

  // Bild verkleinern (max. 1600 px) und als neue Datei in data/images/ hochladen
  async function uploadImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Bitte ein JPG-, PNG- oder WEBP-Bild wählen.");
    const blob = await shrink(file, 1600);
    const ext = blob.type === "image/png" ? ".png" : blob.type === "image/webp" ? ".webp" : ".jpg";
    const name = NC.uid() + ext;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await gh("PUT", contentsPath("data/images/" + name), {
      message: "Bild hinzugefügt: " + name,
      content: bytesToB64(bytes),
      branch: CFG.branch,
    });
    localPreview[name] = URL.createObjectURL(blob);
    images.push(name);
    return name;
  }
  function shrink(file, maxW) {
    return new Promise(function (resolve) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        if (img.naturalWidth <= maxW && file.size < 900000) return resolve(file);
        const scale = Math.min(1, maxW / img.naturalWidth);
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext("2d");
        const keepPng = file.type === "image/png";
        if (!keepPng) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { resolve(b && b.size < file.size ? b : file); }, keepPng ? "image/png" : "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function loadImages() {
    try {
      const list = await gh("GET", contentsPath("data/images") + "?ref=" + encodeURIComponent(CFG.branch));
      images = list.filter(function (f) { return f.type === "file"; }).map(function (f) { return f.name; }).sort();
    } catch (e) { images = []; }
  }

  /* ---------------- Anmeldung ---------------- */

  function storedToken() {
    try { return sessionStorage.getItem("nc_token") || localStorage.getItem("nc_token") || ""; } catch (e) { return ""; }
  }
  function storeToken(t, remember) {
    try {
      sessionStorage.removeItem("nc_token"); localStorage.removeItem("nc_token");
      if (t) (remember ? localStorage : sessionStorage).setItem("nc_token", t);
    } catch (e) { /* Speicher evtl. gesperrt – Token gilt dann nur bis zum Neuladen */ }
  }

  function renderLogin(errorMsg) {
    logoutBtn.hidden = true;
    root.innerHTML = '<div class="card login form-stack">' +
      '<h1 class="section-title" style="margin:0">' + icon("admin_panel_settings") + "Verwaltung</h1>" +
      "<p style=\"margin:0\">Melden Sie sich mit Ihrem <strong>GitHub-Token</strong> an. Nur damit können Inhalte geändert werden.</p>" +
      '<form id="login-form" class="form-stack">' +
      '<label class="field">GitHub-Token<input type="password" id="tok" autocomplete="current-password" placeholder="github_pat_…" required></label>' +
      '<label class="check"><input type="checkbox" id="remember"> Auf diesem Gerät angemeldet bleiben</label>' +
      (errorMsg ? '<p class="err" style="margin:0">' + esc(errorMsg) + "</p>" : "") +
      '<button class="btn primary" type="submit">' + icon("key") + "Anmelden</button></form>" +
      '<details><summary style="cursor:pointer;font-weight:600">Wie bekomme ich einen Token?</summary><ol class="small" style="margin-top:8px">' +
      '<li>Auf GitHub anmelden und <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">neuen Fine-grained Token erstellen</a>.</li>' +
      "<li>Name z. B. „Networkcity Verwaltung“, Ablaufdatum wählen.</li>" +
      "<li>Repository access: <strong>Only select repositories</strong> → <strong>" + esc(CFG.repo.split("/")[1]) + "</strong>.</li>" +
      "<li>Permissions → Repository permissions → <strong>Contents: Read and write</strong>.</li>" +
      "<li>„Generate token“ klicken, Token kopieren und hier einfügen.</li></ol>" +
      '<p class="small muted" style="margin:8px 0 0">Den Token niemandem geben. Auf fremden Geräten „angemeldet bleiben“ nicht anhaken.</p></details></div>';

    document.getElementById("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const t = document.getElementById("tok").value.trim();
      const remember = document.getElementById("remember").checked;
      login(t, remember, e.target);
    });
  }

  async function login(t, remember, formEl) {
    token = t;
    if (formEl) formEl.classList.add("busy");
    try {
      await gh("GET", "/repos/" + CFG.repo);
      const res = await Promise.all([readJson("data/settings.json"), readJson("data/products.json"), loadImages()]);
      settings = res[0].data;
      products = Array.isArray(res[1].data) ? res[1].data : [];
      storeToken(t, remember);
      logoutBtn.hidden = false;
      renderApp();
    } catch (e) {
      token = "";
      storeToken("");
      renderLogin(e.message);
    }
  }

  logoutBtn.addEventListener("click", function () {
    token = ""; settings = null; products = [];
    storeToken("");
    renderLogin();
  });

  /* ---------------- Grundgerüst ---------------- */

  const TABS = [
    ["promo", "campaign", "Werbung"],
    ["products", "inventory", "Produkte"],
    ["business", "store", "Stammdaten"],
    ["texts", "edit_note", "Texte"],
    ["services", "receipt_long", "Preise & Services"],
    ["payment", "payments", "Bezahlung"],
    ["design", "palette", "Design"],
    ["images", "image", "Logo & Bilder"],
  ];

  function renderApp() {
    NC.applyTheme(settings.theme);
    root.innerHTML = '<p class="status-line">' + icon("cloud_done") + "Änderungen werden direkt in GitHub gespeichert und erscheinen nach ca. 1–2 Minuten auf der Website.</p>" +
      '<div class="tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === currentTab) + '">' + icon(t[1]) + t[2] + "</button>";
      }).join("") + '</div><div id="panel" class="panel" role="tabpanel"></div>';
    root.querySelector(".tabs").addEventListener("click", function (e) {
      const b = e.target.closest("[data-tab]");
      if (!b) return;
      currentTab = b.dataset.tab;
      root.querySelectorAll("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      renderPanel();
    });
    renderPanel();
  }

  function renderPanel() {
    const panel = document.getElementById("panel");
    ({ promo: tabPromo, products: tabProducts, business: tabBusiness, texts: tabTexts, services: tabServices,
      payment: tabPayment, design: tabDesign, images: tabImages })[currentTab](panel);
  }

  /* ---------------- Bausteine für Formulare ---------------- */

  function field(label, inputHtml, hint) {
    return '<label class="field">' + esc(label) + (hint ? '<span class="hint">' + esc(hint) + "</span>" : "") + inputHtml + "</label>";
  }
  function inp(id, value, type, attrs) {
    return '<input type="' + (type || "text") + '" id="' + id + '" value="' + esc(value == null ? "" : value) + '"' + (attrs || "") + ">";
  }
  function area(id, value, rows) {
    return '<textarea id="' + id + '" rows="' + (rows || 3) + '">' + esc(value || "") + "</textarea>";
  }
  function check(id, label, on) {
    return '<label class="check"><input type="checkbox" id="' + id + '"' + (on ? " checked" : "") + "> " + esc(label) + "</label>";
  }
  function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
  function checked(id) { const el = document.getElementById(id); return !!(el && el.checked); }
  function iconSelect(cls, current) {
    const list = ICON_CHOICES.indexOf(current) === -1 && current ? [current].concat(ICON_CHOICES) : ICON_CHOICES;
    return '<div style="display:flex;gap:8px;align-items:center"><span class="ms big" data-icon-preview>' + esc(current || "sell") + "</span>" +
      '<select class="' + cls + '">' + list.map(function (n) { return "<option" + (n === current ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") + "</select></div>";
  }
  function saveBtn(id, label) {
    return '<div class="btn-row"><button class="btn primary" type="button" id="' + id + '">' + icon("save") + esc(label || "Speichern") + "</button></div>";
  }
  function onClick(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", function () { withBusy(el.closest(".card") || el, fn); });
  }

  /* Liste mit bearbeitbaren Zeilen (Leistungen, Öffnungszeiten, Zahlungsarten …) */
  function rowsEditor(container, rows, fields, opts) {
    opts = opts || {};
    let data = rows.map(function (r) { return Object.assign({}, r); });

    function sync() {
      container.querySelectorAll(".row-item").forEach(function (item, i) {
        fields.forEach(function (f) {
          const el = item.querySelector('[data-k="' + f.key + '"]');
          if (!el) return;
          data[i][f.key] = f.type === "checkbox" ? el.checked : el.value.trim();
        });
      });
    }
    function draw() {
      container.innerHTML = '<div class="rows">' + (data.length ? data.map(function (r, i) {
        return '<div class="row-item"><div class="row-fields">' + fields.map(function (f) {
          const v = r[f.key];
          let input;
          if (f.type === "checkbox") return '<label class="check' + (f.wide ? " wide" : "") + '"><input type="checkbox" data-k="' + f.key + '"' + (v !== false ? " checked" : "") + "> " + esc(f.label) + "</label>";
          if (f.type === "readonly") input = '<input type="text" data-k="' + f.key + '" value="' + esc(v) + '" readonly>';
          else if (f.type === "textarea") input = '<textarea data-k="' + f.key + '" rows="2">' + esc(v) + "</textarea>";
          else if (f.type === "icon") input = iconSelect("", v).replace("<select", '<select data-k="' + f.key + '"');
          else input = '<input type="' + (f.type || "text") + '" data-k="' + f.key + '" value="' + esc(v == null ? "" : v) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "") + ">";
          return '<label class="field' + (f.wide ? " wide" : "") + '">' + esc(f.label) + (f.hint ? '<span class="hint">' + esc(f.hint) + "</span>" : "") + input + "</label>";
        }).join("") + "</div>" + (opts.fixed ? "" : '<div class="row-actions">' +
          '<button class="btn small icon-only" type="button" data-act="up" data-i="' + i + '" aria-label="Nach oben"' + (i ? "" : " disabled") + ">" + icon("arrow_upward") + "</button>" +
          '<button class="btn small icon-only" type="button" data-act="down" data-i="' + i + '" aria-label="Nach unten"' + (i < data.length - 1 ? "" : " disabled") + ">" + icon("arrow_downward") + "</button>" +
          '<button class="btn small danger" type="button" data-act="del" data-i="' + i + '">' + icon("delete") + "Entfernen</button></div>") + "</div>";
      }).join("") : '<p class="muted small" style="margin:0">Noch keine Einträge.</p>') + "</div>" +
        (opts.fixed ? "" : '<div class="btn-row" style="margin-top:10px"><button class="btn small" type="button" data-act="add">' + icon("add") + esc(opts.addLabel || "Eintrag hinzufügen") + "</button></div>");
    }
    container.addEventListener("click", function (e) {
      const b = e.target.closest("[data-act]");
      if (!b || !container.contains(b)) return;
      sync();
      const i = Number(b.dataset.i);
      if (b.dataset.act === "add") data.push(opts.newRow ? opts.newRow() : {});
      if (b.dataset.act === "del") data.splice(i, 1);
      if (b.dataset.act === "up" && i > 0) data.splice(i - 1, 0, data.splice(i, 1)[0]);
      if (b.dataset.act === "down" && i < data.length - 1) data.splice(i + 1, 0, data.splice(i, 1)[0]);
      draw();
    });
    container.addEventListener("change", function (e) {
      if (e.target.tagName === "SELECT") {
        const prev = e.target.parentElement.querySelector("[data-icon-preview]");
        if (prev) prev.textContent = e.target.value;
      }
    });
    draw();
    return { get: function () { sync(); return data.map(function (r) { return Object.assign({}, r); }); } };
  }

  // Bildauswahl: vorhandenes Bild oder neues hochladen
  function imagePicker(prefix, current) {
    const opts = [""].concat(images);
    if (current && opts.indexOf(current) === -1) opts.push(current);
    return '<div class="form-stack">' +
      '<img class="img-preview" id="' + prefix + '-prev" src="' + esc(imgSrc(current)) + '" alt="Vorschau"' + (current ? "" : " hidden") + ">" +
      field("Vorhandenes Bild", '<select id="' + prefix + '-sel">' + opts.map(function (n) {
        return '<option value="' + esc(n) + '"' + (n === current ? " selected" : "") + ">" + (n ? esc(n) : "(kein Bild)") + "</option>";
      }).join("") + "</select>") +
      field("… oder neues Bild hochladen", '<input type="file" id="' + prefix + '-file" accept="image/jpeg,image/png,image/webp">', "JPG, PNG oder WEBP. Große Bilder werden automatisch verkleinert.") +
      "</div>";
  }
  function wireImagePicker(prefix) {
    const sel = document.getElementById(prefix + "-sel");
    const file = document.getElementById(prefix + "-file");
    const prev = document.getElementById(prefix + "-prev");
    sel.addEventListener("change", function () { prev.hidden = !sel.value; prev.src = imgSrc(sel.value); file.value = ""; });
    file.addEventListener("change", function () {
      if (!file.files[0]) return;
      prev.src = URL.createObjectURL(file.files[0]); prev.hidden = false;
    });
  }
  async function pickedImage(prefix) {
    const file = document.getElementById(prefix + "-file");
    if (file.files && file.files[0]) return uploadImage(file.files[0]);
    return document.getElementById(prefix + "-sel").value;
  }

  function openDialog(title, bodyHtml, onSave, saveLabel) {
    dialog.innerHTML = '<div class="dialog-head"><h3 id="edit-title">' + esc(title) + '</h3><button class="btn icon-only small" type="button" data-close aria-label="Schließen">' + icon("close") + "</button></div>" +
      '<div class="dialog-body">' + bodyHtml + '<div class="btn-row end"><button class="btn" type="button" data-close>Abbrechen</button>' +
      '<button class="btn primary" type="button" id="dlg-save">' + icon("save") + esc(saveLabel || "Speichern") + "</button></div></div>";
    document.getElementById("dlg-save").addEventListener("click", function () {
      withBusy(dialog.querySelector(".dialog-body"), async function () {
        const ok = await onSave();
        if (ok !== false) { dialog.close(); toast(SAVED_MSG); renderPanel(); }
      });
    });
    dialog.showModal();
  }
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
  });
  dialog.addEventListener("cancel", function (e) { if (dialog.querySelector(".busy")) e.preventDefault(); });

  /* ---------------- Tab: Werbung ---------------- */

  function tabPromo(panel) {
    const cfg = settings.promo || {};
    const slides = cfg.slides || [];
    panel.innerHTML = '<div class="card form-stack"><h3>' + icon("campaign") + "Werbung & Angebote</h3>" +
      '<p class="muted small" style="margin:0">Die große Bildergalerie oben auf der Startseite. Die Bilder wechseln automatisch und können ein Label, eine Überschrift und eine Beschreibung haben.</p>' +
      '<div class="form-grid">' + check("pr-on", "Werbung anzeigen", !!cfg.enabled) + check("pr-auto", "Automatisch wechseln", cfg.autoplay !== false) +
      field("Wechsel alle (Sekunden)", inp("pr-int", cfg.interval || 5, "number", ' min="2" max="20"')) +
      field("Höhe (Pixel, Desktop)", inp("pr-h", cfg.height || 520, "number", ' min="240" max="760" step="20"')) + "</div>" +
      saveBtn("pr-save", "Einstellungen speichern") + "</div>" +
      '<div class="card form-stack"><h3>' + icon("photo_library") + "Bilder in der Werbung</h3>" +
      '<p class="muted small" style="margin:0">Reihenfolge = Ablauf der Werbung.</p><div class="rows">' +
      (slides.length ? slides.map(function (s, i) {
        return '<div class="list-item"><div class="thumb">' + (s.image ? '<img src="' + esc(imgSrc(s.image)) + '" alt="">' : icon("image")) + "</div>" +
          '<div class="meta"><strong>' + esc(s.title || "Bild " + (i + 1)) + "</strong><span class=\"small\">" +
          (s.enabled === false ? '<span class="tag off">ausgeblendet</span>' : "") + (s.badge ? '<span class="tag">' + esc(s.badge) + "</span>" : "") + "</span></div>" +
          '<div class="acts"><button class="btn small icon-only" type="button" data-up="' + i + '" aria-label="Nach oben"' + (i ? "" : " disabled") + ">" + icon("arrow_upward") + "</button>" +
          '<button class="btn small icon-only" type="button" data-down="' + i + '" aria-label="Nach unten"' + (i < slides.length - 1 ? "" : " disabled") + ">" + icon("arrow_downward") + "</button>" +
          '<button class="btn small icon-only" type="button" data-edit="' + i + '" aria-label="Bearbeiten">' + icon("edit") + "</button>" +
          '<button class="btn small icon-only danger" type="button" data-del="' + i + '" aria-label="Löschen">' + icon("delete") + "</button></div></div>";
      }).join("") : '<p class="muted">Noch keine Werbebilder vorhanden.</p>') + "</div>" +
      '<div class="btn-row"><button class="btn primary" type="button" id="pr-add">' + icon("add_photo_alternate") + "Neues Werbebild</button></div></div>";

    onClick("pr-save", async function () {
      await saveSettings(function (s) {
        s.promo = s.promo || {};
        s.promo.enabled = checked("pr-on");
        s.promo.autoplay = checked("pr-auto");
        s.promo.interval = Math.min(20, Math.max(2, parseInt(val("pr-int"), 10) || 5));
        s.promo.height = Math.min(760, Math.max(240, parseInt(val("pr-h"), 10) || 520));
      }, "Werbung: Einstellungen");
      toast(SAVED_MSG);
    });
    document.getElementById("pr-add").addEventListener("click", function () { editSlide(-1); });
    panel.querySelector(".rows").addEventListener("click", function (e) {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.edit) return editSlide(Number(b.dataset.edit));
      const card = b.closest(".card");
      withBusy(card, async function () {
        if (b.dataset.del) {
          const i = Number(b.dataset.del);
          if (!confirm("Dieses Werbebild wirklich löschen?")) return;
          const id = slides[i].id;
          await saveSettings(function (s) { s.promo.slides = (s.promo.slides || []).filter(function (x) { return x.id !== id; }); }, "Werbung: Bild gelöscht");
        } else {
          const i = Number(b.dataset.up || b.dataset.down);
          const dir = b.dataset.up ? -1 : 1;
          const id = slides[i].id;
          await saveSettings(function (s) {
            const arr = s.promo.slides || [];
            const k = arr.findIndex(function (x) { return x.id === id; });
            if (k === -1 || k + dir < 0 || k + dir >= arr.length) return;
            arr.splice(k + dir, 0, arr.splice(k, 1)[0]);
          }, "Werbung: Reihenfolge");
        }
        toast(SAVED_MSG);
        renderPanel();
      });
    });
  }

  function editSlide(index) {
    const s = index >= 0 ? settings.promo.slides[index] : { enabled: true };
    openDialog(index >= 0 ? "Werbebild bearbeiten" : "Neues Werbebild",
      imagePicker("sl", s.image || "") +
      field("Label / Badge (z. B. Angebot)", inp("sl-badge", s.badge)) +
      field("Überschrift", inp("sl-title", s.title)) +
      field("Beschreibung", area("sl-text", s.text)) +
      field("Link (optional)", inp("sl-link", s.link, "url", ' placeholder="https://…"'), "z. B. ein WhatsApp-Link (https://wa.me/…)") +
      field("Link-Text (optional)", inp("sl-ltext", s.link_label)) +
      check("sl-on", "Dieses Bild anzeigen", s.enabled !== false),
      async function () {
        const image = await pickedImage("sl");
        if (!image) { toast("Bitte ein Bild auswählen oder hochladen.", true); return false; }
        const slide = {
          id: s.id || NC.uid(), image: image, badge: val("sl-badge").trim(), title: val("sl-title").trim(),
          text: val("sl-text").trim(), link: val("sl-link").trim(), link_label: val("sl-ltext").trim(), enabled: checked("sl-on"),
        };
        await saveSettings(function (st) {
          st.promo = st.promo || { enabled: true, autoplay: true, interval: 5, height: 520 };
          st.promo.slides = st.promo.slides || [];
          const k = st.promo.slides.findIndex(function (x) { return x.id === slide.id; });
          if (k === -1) st.promo.slides.push(slide); else st.promo.slides[k] = slide;
        }, "Werbung: " + (slide.title || "Bild"));
      });
    wireImagePicker("sl");
  }

  /* ---------------- Tab: Produkte ---------------- */

  function tabProducts(panel) {
    const q = (panel.dataset.q || "");
    panel.innerHTML = '<div class="card form-stack"><h3>' + icon("inventory") + "Produkte (" + products.length + ")</h3>" +
      '<p class="muted small" style="margin:0">Ist ein Produkt verkauft, „Verkauft“ anhaken – es bleibt noch ' + esc(settings.sold_remove_days != null ? settings.sold_remove_days : 7) +
      ' Tag(e) mit Hinweis sichtbar und verschwindet dann automatisch.</p>' +
      '<div class="btn-row"><button class="btn primary" type="button" id="pd-add">' + icon("add_box") + 'Neues Produkt</button>' +
      '<input type="search" id="pd-q" placeholder="Produkt suchen …" value="' + esc(q) + '" style="flex:1 1 200px;width:auto"></div>' +
      '<div class="rows" id="pd-list"></div></div>';

    function drawList() {
      const qq = val("pd-q").trim().toLowerCase();
      panel.dataset.q = qq;
      const list = products.map(function (p, i) { return [p, i]; }).filter(function (x) { return !qq || String(x[0].name).toLowerCase().indexOf(qq) !== -1; });
      document.getElementById("pd-list").innerHTML = list.length ? list.map(function (x) {
        const p = x[0];
        const tags = [];
        if (p.sold) tags.push('<span class="tag off">Verkauft</span>');
        if (p.available === false) tags.push('<span class="tag off">Ausgeblendet</span>');
        if (p.featured) tags.push('<span class="tag">Angebot</span>');
        if (p.online_sale) tags.push('<span class="tag">Online</span>');
        return '<div class="list-item"><div class="thumb">' + (p.image ? '<img src="' + esc(imgSrc(p.image)) + '" alt="" loading="lazy">' : icon("phone_iphone")) + "</div>" +
          '<div class="meta"><strong>' + esc(p.name) + '</strong><span class="small">' + esc(NC.fmtPrice(p.price) || "ohne Preis") + " · " + esc(p.condition || "") + " · " + esc(p.category || "") + "</span><div>" + tags.join("") + "</div></div>" +
          '<div class="acts"><button class="btn small icon-only" type="button" data-edit="' + esc(p.id) + '" aria-label="Bearbeiten">' + icon("edit") + "</button>" +
          '<button class="btn small icon-only danger" type="button" data-del="' + esc(p.id) + '" aria-label="Löschen">' + icon("delete") + "</button></div></div>";
      }).join("") : '<p class="muted">Keine Produkte gefunden.</p>';
    }
    drawList();
    document.getElementById("pd-q").addEventListener("input", drawList);
    document.getElementById("pd-add").addEventListener("click", function () { editProduct(null); });
    document.getElementById("pd-list").addEventListener("click", function (e) {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.edit) return editProduct(b.dataset.edit);
      if (b.dataset.del) {
        const p = products.find(function (x) { return String(x.id) === b.dataset.del; });
        if (!p || !confirm("„" + p.name + "“ wirklich löschen?")) return;
        withBusy(b.closest(".card"), async function () {
          await saveProducts(function (list) { return list.filter(function (x) { return String(x.id) !== String(p.id); }); }, "Produkt gelöscht: " + p.name);
          toast(SAVED_MSG);
          renderPanel();
        });
      }
    });
  }

  function editProduct(id) {
    const p = id ? products.find(function (x) { return String(x.id) === String(id); }) : null;
    const d = p || { condition: "Neu", category: "Smartphone", available: true, online_sale: true };
    const cats = CATEGORIES.indexOf(d.category) === -1 && d.category ? CATEGORIES.concat([d.category]) : CATEGORIES;
    const methods = NC.enabledPaymentMethods(settings);
    const sel = d.payment_methods || [];
    openDialog(p ? "Produkt bearbeiten" : "Neues Produkt",
      field("Produktname", inp("p-name", d.name, "text", " required")) +
      '<div class="form-grid">' +
      field("Kategorie", '<select id="p-cat">' + cats.map(function (c) { return "<option" + (c === d.category ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>") +
      field("Zustand", '<select id="p-cond">' + ["Neu", "Gebraucht"].map(function (c) { return "<option" + (c === d.condition ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select>") +
      field("Preis (€)", inp("p-price", d.price != null ? d.price : "", "number", ' min="0" step="0.01" inputmode="decimal"')) +
      field("Alter Preis (€)", inp("p-old", d.old_price || "", "number", ' min="0" step="0.01" inputmode="decimal"'), "Optional – zeigt Streichpreis und Rabatt") +
      "</div>" +
      field("Beschreibung", area("p-desc", d.description)) +
      '<div class="form-stack">' +
      check("p-feat", "Als Angebot auf der Startseite anzeigen", !!d.featured) +
      check("p-avail", "Auf der Website anzeigen (verfügbar)", d.available !== false) +
      check("p-online", "Direkt online verkaufbar (Button „Online kaufen / anfragen“ per WhatsApp)", !!d.online_sale) +
      check("p-sold", "Verkauft", !!d.sold) + "</div>" +
      (methods.length ? '<fieldset class="form-stack" style="border:1px solid var(--nc-border);border-radius:12px;padding:12px"><legend style="font-weight:600;padding:0 6px">Zahlungsarten (keine Auswahl = alle)</legend>' +
        methods.map(function (m) { return '<label class="check"><input type="checkbox" class="p-pay" value="' + esc(m.id) + '"' + (sel.indexOf(m.id) !== -1 ? " checked" : "") + "> " + esc(m.label) + "</label>"; }).join("") + "</fieldset>" : "") +
      '<div class="form-stack"><strong>Produktbild</strong>' + imagePicker("pi", d.image || "") + "</div>",
      async function () {
        const name = val("p-name").trim();
        if (!name) { toast("Bitte einen Produktnamen eingeben.", true); return false; }
        const image = await pickedImage("pi");
        const price = parseFloat(String(val("p-price")).replace(",", "."));
        const old = parseFloat(String(val("p-old")).replace(",", "."));
        const sold = checked("p-sold");
        const rec = {
          id: d.id || NC.uid(), name: name, category: val("p-cat"), condition: val("p-cond"),
          price: isFinite(price) ? Math.round(price * 100) / 100 : 0,
          old_price: isFinite(old) && old > 0 ? Math.round(old * 100) / 100 : null,
          description: val("p-desc").trim(), image: image, featured: checked("p-feat"),
          available: checked("p-avail"), online_sale: checked("p-online"), sold: sold,
          sold_at: sold ? (d.sold_at || NC.todayIso()) : "",
          payment_methods: Array.from(dialog.querySelectorAll(".p-pay:checked")).map(function (c) { return c.value; }),
        };
        await saveProducts(function (list) {
          const k = list.findIndex(function (x) { return String(x.id) === String(rec.id); });
          if (k === -1) list.push(rec); else list[k] = Object.assign({}, list[k], rec);
        }, (p ? "Produkt geändert: " : "Neues Produkt: ") + name);
      });
    wireImagePicker("pi");
  }

  /* ---------------- Tab: Stammdaten ---------------- */

  function tabBusiness(panel) {
    const b = settings.business || {};
    const l = settings.legal || {};
    panel.innerHTML = '<div class="card form-stack"><h3>' + icon("store") + "Stammdaten</h3><div class=\"form-grid\">" +
      field("Ladenname", inp("b-name", b.name)) + field("Kurzbeschreibung (Slogan)", inp("b-tag", b.tagline)) +
      field("Straße & Hausnummer", inp("b-street", b.street)) + field("PLZ & Ort", inp("b-zip", b.zip_city)) +
      field("Telefon", inp("b-phone", b.phone, "tel")) + field("WhatsApp", inp("b-wa", b.whatsapp, "tel"), "mit Ländercode, z. B. 491751234567") +
      field("E-Mail", inp("b-mail", b.email, "email")) +
      field("Verkaufte Produkte ausblenden nach (Tagen)", inp("b-sold", settings.sold_remove_days != null ? settings.sold_remove_days : 7, "number", ' min="0" max="365"'), "0 = sofort ausblenden") +
      "</div>" + field("Google-Maps-Embed-URL", inp("b-map", b.map_url, "url"), "Für die Karte auf der Kontaktseite (beginnt mit https://www.google.com/maps/embed?… oder https://maps.google.com/…)") +
      saveBtn("b-save", "Stammdaten speichern") + "</div>" +
      '<div class="card form-stack"><h3>' + icon("badge") + "Impressum-Angaben</h3>" +
      (String(l.owner_name || "").trim() ? "" : '<p class="err" style="margin:0">Bitte den vollständigen Namen des Inhabers eintragen – ohne ihn ist das Impressum unvollständig.</p>') +
      '<p class="muted small" style="margin:0">Adresse, Telefon und E-Mail kommen automatisch aus den Stammdaten. Leere Felder werden im Impressum nicht angezeigt.</p><div class="form-grid">' +
      field("Inhaber (Vor- und Nachname)", inp("l-owner", l.owner_name)) +
      field("Firmenname", inp("l-company", l.company_name, "text", ' placeholder="' + esc(b.name || "") + '"'), "Leer = Ladenname") +
      field("Rechtsform", inp("l-form", l.legal_form, "text", ' placeholder="z. B. Einzelunternehmen"')) +
      field("Umsatzsteuer-ID", inp("l-vat", l.vat_id, "text", ' placeholder="DE…"'), "Nur falls vorhanden") +
      field("Registergericht", inp("l-court", l.register_court), "Nur bei Handelsregistereintrag") +
      field("Registernummer", inp("l-regno", l.register_number), "z. B. HRA 12345") +
      field("Verantwortlich für den Inhalt", inp("l-resp", l.content_responsible), "Optional, Name") +
      "</div>" + saveBtn("l-save", "Impressum-Angaben speichern") + "</div>" +
      '<div class="card form-stack"><h3>' + icon("schedule") + "Öffnungszeiten</h3><p class=\"muted small\" style=\"margin:0\">„Öffnet“ leer lassen = an diesem Tag geschlossen.</p><div id=\"hours\"></div>" + saveBtn("h-save", "Öffnungszeiten speichern") + "</div>" +
      '<div class="card form-stack"><h3>' + icon("event") + "Sonderöffnungszeiten</h3><p class=\"muted small\" style=\"margin:0\">Einmalige Änderungen mit Datum, z. B. Feiertage. Erscheinen automatisch auf Start- und Kontaktseite. „Öffnet“ leer = geschlossen.</p><div id=\"special\"></div>" + saveBtn("sp-save", "Sonderöffnungszeiten speichern") + "</div>";

    const hours = rowsEditor(document.getElementById("hours"), settings.hours || [], [
      { key: "day", label: "Tag", type: "readonly" }, { key: "open", label: "Öffnet", type: "time" }, { key: "close", label: "Schließt", type: "time" },
    ], { fixed: true });
    const special = rowsEditor(document.getElementById("special"), settings.special_hours || [], [
      { key: "date", label: "Datum", type: "date" }, { key: "open", label: "Öffnet", type: "time" }, { key: "close", label: "Schließt", type: "time" },
      { key: "note", label: "Hinweis (optional)", wide: true },
    ], { addLabel: "Datum hinzufügen", newRow: function () { return { date: NC.todayIso(), open: "", close: "", note: "" }; } });

    onClick("b-save", async function () {
      const days = parseInt(val("b-sold"), 10);
      await saveSettings(function (s) {
        s.business = Object.assign(s.business || {}, {
          name: val("b-name").trim(), tagline: val("b-tag").trim(), street: val("b-street").trim(), zip_city: val("b-zip").trim(),
          phone: val("b-phone").trim(), whatsapp: val("b-wa").trim(), email: val("b-mail").trim(), map_url: val("b-map").trim(),
        });
        s.sold_remove_days = isNaN(days) ? 7 : Math.max(0, Math.min(365, days));
      }, "Stammdaten");
      toast(SAVED_MSG);
    });
    onClick("l-save", async function () {
      await saveSettings(function (s) {
        s.legal = {
          owner_name: val("l-owner").trim(), company_name: val("l-company").trim(), legal_form: val("l-form").trim(),
          vat_id: val("l-vat").trim(), register_court: val("l-court").trim(), register_number: val("l-regno").trim(),
          content_responsible: val("l-resp").trim(),
        };
      }, "Impressum-Angaben");
      toast(SAVED_MSG);
      renderPanel();
    });
    onClick("h-save", async function () {
      const rows = hours.get().map(function (r) { return { day: r.day, open: r.open, close: r.open ? r.close : "" }; });
      await saveSettings(function (s) { s.hours = rows; }, "Öffnungszeiten");
      toast(SAVED_MSG);
    });
    onClick("sp-save", async function () {
      const rows = special.get().filter(function (r) { return r.date; }).map(function (r) { return { date: r.date, open: r.open, close: r.open ? r.close : "", note: r.note }; });
      await saveSettings(function (s) { s.special_hours = rows; }, "Sonderöffnungszeiten");
      toast(SAVED_MSG);
      renderPanel();
    });
  }

  /* ---------------- Tab: Texte ---------------- */

  function tabTexts(panel) {
    const b = settings.business || {}, c = settings.internetcafe || {}, r = settings.repair || {};
    panel.innerHTML = '<div class="card form-stack"><h3>' + icon("home") + "Startseite</h3>" +
      field("Startseiten-Titel", inp("t-ht", b.hero_title)) + field("Startseiten-Untertitel", area("t-hs", b.hero_subtitle, 2)) +
      field("Über-uns-Text", area("t-about", b.about_text, 5)) + "</div>" +
      '<div class="card form-stack"><h3>' + icon("computer") + "Internetcafé</h3>" +
      field("Titel", inp("t-ct", c.title)) + field("Text", area("t-cx", c.text)) +
      field("Stichpunkte", area("t-cp", (c.bullet_points || []).join("\n"), 4), "Eine Zeile pro Punkt") + "</div>" +
      '<div class="card form-stack"><h3>' + icon("build") + "Reparatur</h3>" +
      field("Titel", inp("t-rt", r.title)) + field("Text", area("t-rx", r.text)) +
      field("Ablauf", area("t-rs", (r.steps || []).join("\n"), 4), "Eine Zeile pro Schritt") +
      saveBtn("t-save", "Alle Texte speichern") + "</div>";
    const lines = function (s) { return s.split("\n").map(function (x) { return x.trim(); }).filter(Boolean); };
    onClick("t-save", async function () {
      await saveSettings(function (s) {
        s.business = Object.assign(s.business || {}, { hero_title: val("t-ht").trim(), hero_subtitle: val("t-hs").trim(), about_text: val("t-about").trim() });
        s.internetcafe = Object.assign(s.internetcafe || {}, { title: val("t-ct").trim(), text: val("t-cx").trim(), bullet_points: lines(val("t-cp")) });
        s.repair = Object.assign(s.repair || {}, { title: val("t-rt").trim(), text: val("t-rx").trim(), steps: lines(val("t-rs")) });
      }, "Texte");
      toast(SAVED_MSG);
    });
  }

  /* ---------------- Tab: Preise & Services ---------------- */

  function tabServices(panel) {
    const svcFields = [{ key: "name", label: "Leistung" }, { key: "price", label: "Preis", placeholder: "z. B. ab 49 €" }, { key: "description", label: "Beschreibung", type: "textarea", wide: true }];
    panel.innerHTML = '<div class="card form-stack"><h3>' + icon("computer") + 'Internetcafé – Leistungen</h3><div id="sv-cafe"></div>' + saveBtn("sv-cafe-save") + "</div>" +
      '<div class="card form-stack"><h3>' + icon("build") + 'Reparatur – Leistungen</h3><div id="sv-rep"></div>' + saveBtn("sv-rep-save") + "</div>" +
      '<div class="card form-stack"><h3>' + icon("handshake") + 'Weitere Services (Partner)</h3><p class="muted small" style="margin:0">z. B. Hermes Paketshop, Western Union. Erscheinen als Karten auf der Startseite.</p><div id="sv-extra"></div>' + saveBtn("sv-extra-save") + "</div>";
    const cafe = rowsEditor(document.getElementById("sv-cafe"), (settings.internetcafe || {}).services || [], svcFields, { addLabel: "Leistung hinzufügen" });
    const rep = rowsEditor(document.getElementById("sv-rep"), (settings.repair || {}).services || [], svcFields, { addLabel: "Leistung hinzufügen" });
    const extra = rowsEditor(document.getElementById("sv-extra"), settings.extra_services || [], [
      { key: "icon", label: "Symbol", type: "icon" }, { key: "name", label: "Leistung" }, { key: "description", label: "Beschreibung", type: "textarea", wide: true },
    ], { addLabel: "Service hinzufügen", newRow: function () { return { icon: "sell", name: "", description: "" }; } });
    const clean = function (rows) { return rows.filter(function (r) { return r.name; }); };
    onClick("sv-cafe-save", async function () {
      const rows = clean(cafe.get());
      await saveSettings(function (s) { s.internetcafe = s.internetcafe || {}; s.internetcafe.services = rows; }, "Internetcafé-Leistungen");
      toast(SAVED_MSG);
    });
    onClick("sv-rep-save", async function () {
      const rows = clean(rep.get());
      await saveSettings(function (s) { s.repair = s.repair || {}; s.repair.services = rows; }, "Reparatur-Leistungen");
      toast(SAVED_MSG);
    });
    onClick("sv-extra-save", async function () {
      const rows = clean(extra.get());
      await saveSettings(function (s) { s.extra_services = rows; }, "Weitere Services");
      toast(SAVED_MSG);
    });
  }

  /* ---------------- Tab: Bezahlung ---------------- */

  function tabPayment(panel) {
    panel.innerHTML = '<div class="card form-stack"><h3>' + icon("payments") + "Zahlungsarten</h3>" +
      '<p class="muted small" style="margin:0">Diese Zahlungsarten können Kunden bei der Kaufanfrage auswählen. Unter „Info“ z. B. einen Hinweis zur Abholung oder Überweisung eintragen.</p>' +
      '<div id="pay"></div>' + saveBtn("pay-save", "Zahlungsarten speichern") + "</div>";
    const ed = rowsEditor(document.getElementById("pay"), settings.payment_methods || [], [
      { key: "label", label: "Bezeichnung" }, { key: "icon", label: "Symbol", type: "icon" },
      { key: "info", label: "Info für Kunden (optional)", type: "textarea", wide: true }, { key: "enabled", label: "Aktiv", type: "checkbox", wide: true },
    ], { addLabel: "Zahlungsart hinzufügen", newRow: function () { return { id: NC.uid(), label: "", icon: "payments", enabled: true, info: "" }; } });
    onClick("pay-save", async function () {
      const rows = ed.get().filter(function (r) { return r.label; }).map(function (r) {
        return { id: r.id || NC.uid(), label: r.label, icon: r.icon || "payments", enabled: r.enabled !== false, info: r.info || "" };
      });
      await saveSettings(function (s) { s.payment_methods = rows; }, "Zahlungsarten");
      toast(SAVED_MSG);
    });
  }

  /* ---------------- Tab: Design ---------------- */

  function tabDesign(panel) {
    const cur = settings.theme || NC.DEFAULT_THEME;
    panel.innerHTML = '<div class="card form-stack"><h3>' + icon("palette") + "Design & Farben</h3>" +
      '<p class="muted small" style="margin:0">Das Aussehen der Website für alle Besucher.</p><div class="theme-opts">' +
      Object.keys(NC.THEMES).map(function (k) {
        const t = NC.THEMES[k];
        return '<label class="theme-opt"><span class="check"><input type="radio" name="theme" value="' + k + '"' + (k === cur ? " checked" : "") + "> <strong>" + esc(t.label) + "</strong></span>" +
          '<span class="swatches">' + t.swatch.map(function (c) { return '<span style="background:' + c + '"></span>'; }).join("") + "</span></label>";
      }).join("") + "</div>" + saveBtn("d-save", "Design speichern") + "</div>";
    panel.querySelectorAll("input[name=theme]").forEach(function (r) { r.addEventListener("change", function () { NC.applyTheme(r.value); }); });
    onClick("d-save", async function () {
      const k = (panel.querySelector("input[name=theme]:checked") || {}).value || NC.DEFAULT_THEME;
      await saveSettings(function (s) { s.theme = k; }, "Design");
      toast(SAVED_MSG);
    });
  }

  /* ---------------- Tab: Logo & Bilder ---------------- */

  function tabImages(panel) {
    const b = settings.business || {};
    const gallery = b.gallery || [];
    function single(key, title, hint, wide) {
      const cur = b[key];
      return '<div class="card form-stack"><h3>' + icon("image") + esc(title) + "</h3>" +
        (cur ? '<img class="img-preview' + (wide ? " wide" : "") + '" src="' + esc(imgSrc(cur)) + '" alt="Aktuelles Bild">' : '<p class="muted" style="margin:0">Kein Bild gesetzt.</p>') +
        field("Neues Bild hochladen", '<input type="file" id="up-' + key + '" accept="image/jpeg,image/png,image/webp">', hint) +
        '<div class="btn-row"><button class="btn primary" type="button" id="save-' + key + '">' + icon("upload") + "Bild speichern</button>" +
        (cur ? '<button class="btn danger" type="button" id="rm-' + key + '">' + icon("delete") + "Bild entfernen</button>" : "") + "</div></div>";
    }
    panel.innerHTML = single("logo", "Logo (oben links)", "Quadratisch oder breit, PNG empfohlen") +
      single("hero_image", "Titelbild (groß oben auf der Startseite)", "Ein breites Bild, z. B. vom Laden", true) +
      '<div class="card form-stack"><h3>' + icon("photo_library") + "Bilder vom Laden (Galerie)</h3>" +
      (gallery.length ? '<div class="gallery-admin" id="gal">' + gallery.map(function (f, i) {
        return '<figure><img src="' + esc(imgSrc(f)) + '" alt="Galeriebild ' + (i + 1) + '"><button class="btn small icon-only danger" type="button" data-gdel="' + i + '" aria-label="Entfernen">' + icon("delete") + "</button></figure>";
      }).join("") + "</div>" : '<p class="muted" style="margin:0">Noch keine Ladenbilder.</p>') +
      field("Ladenbilder hinzufügen", '<input type="file" id="up-gallery" accept="image/jpeg,image/png,image/webp" multiple>', "Mehrere Bilder auswählbar") +
      '<div class="btn-row"><button class="btn primary" type="button" id="save-gallery">' + icon("add_photo_alternate") + "Zur Galerie hinzufügen</button></div></div>";

    ["logo", "hero_image"].forEach(function (key) {
      onClick("save-" + key, async function () {
        const f = document.getElementById("up-" + key).files[0];
        if (!f) { toast("Bitte zuerst ein Bild auswählen.", true); return; }
        const name = await uploadImage(f);
        await saveSettings(function (s) { s.business = s.business || {}; s.business[key] = name; }, key === "logo" ? "Logo geändert" : "Titelbild geändert");
        toast(SAVED_MSG); renderPanel();
      });
      onClick("rm-" + key, async function () {
        if (!confirm("Bild wirklich entfernen?")) return;
        await saveSettings(function (s) { s.business[key] = ""; }, key === "logo" ? "Logo entfernt" : "Titelbild entfernt");
        toast(SAVED_MSG); renderPanel();
      });
    });
    onClick("save-gallery", async function () {
      const files = Array.from(document.getElementById("up-gallery").files || []);
      if (!files.length) { toast("Bitte zuerst Bilder auswählen.", true); return; }
      const names = [];
      for (const f of files) names.push(await uploadImage(f));
      await saveSettings(function (s) { s.business = s.business || {}; s.business.gallery = (s.business.gallery || []).concat(names); }, "Galerie: Bilder hinzugefügt");
      toast(SAVED_MSG); renderPanel();
    });
    const gal = document.getElementById("gal");
    if (gal) gal.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-gdel]"); if (!btn) return;
      const name = gallery[Number(btn.dataset.gdel)];
      if (!confirm("Bild aus der Galerie entfernen?")) return;
      withBusy(btn.closest(".card"), async function () {
        await saveSettings(function (s) { s.business.gallery = (s.business.gallery || []).filter(function (x) { return x !== name; }); }, "Galerie: Bild entfernt");
        toast(SAVED_MSG); renderPanel();
      });
    });
  }

  /* ---------------- Start ---------------- */

  const saved = storedToken();
  if (saved) login(saved, !!(function () { try { return localStorage.getItem("nc_token"); } catch (e) { return null; } })());
  else renderLogin();
})();
