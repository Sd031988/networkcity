import streamlit as st

from utils.db import active_promo_slides, image_data_uri, promo_config
from utils.theme import DEFAULT_THEME, THEMES

_PROMO_HTML = """
<div class="nc-promo" id="nc-promo">
  <div class="nc-track" id="nc-track"></div>
  <button class="nc-nav nc-prev" id="nc-prev" type="button" aria-label="Vorheriges Bild">&#10094;</button>
  <button class="nc-nav nc-next" id="nc-next" type="button" aria-label="N&auml;chstes Bild">&#10095;</button>
  <div class="nc-dots" id="nc-dots"></div>
</div>
"""

_PROMO_CSS = """
:host { display: block; width: 100%; }
.nc-promo {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  border-radius: 22px;
  background: var(--nc-surface, #ffffff);
  border: 1px solid var(--nc-border, rgba(0,0,0,0.12));
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.18);
}
.nc-track {
  display: flex;
  height: 100%;
  transition: transform 0.6s cubic-bezier(.4, 0, .2, 1);
  will-change: transform;
}
.nc-slide {
  position: relative;
  flex: 0 0 100%;
  min-width: 100%;
  height: 100%;
  background: #101214;
}
.nc-slide img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.nc-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 30px 34px 30px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.80) 0%, rgba(0, 0, 0, 0.38) 55%, rgba(0, 0, 0, 0) 100%);
}
.nc-badge {
  display: inline-block;
  margin-bottom: 10px;
  padding: 4px 13px;
  background: var(--nc-primary, #F5740A);
  color: var(--nc-on-primary, #ffffff);
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.nc-title {
  margin: 0 0 0.35rem 0;
  color: #ffffff;
  font-size: clamp(1.25rem, 2.4vw, 2.05rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.01em;
}
.nc-text {
  margin: 0;
  color: rgba(255, 255, 255, 0.93);
  font-size: clamp(0.9rem, 1.1vw, 1.05rem);
  line-height: 1.45;
  max-width: 760px;
}
.nc-link {
  display: inline-block;
  margin-top: 0.7rem;
  color: #ffffff;
  font-weight: 600;
  text-decoration: underline;
}
.nc-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.38);
  color: #ffffff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  z-index: 3;
  transition: background 0.15s ease;
}
.nc-nav:hover { background: var(--nc-primary, #F5740A); color: var(--nc-on-primary, #ffffff); }
.nc-prev { left: 16px; }
.nc-next { right: 16px; }
.nc-dots {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14px;
  display: flex;
  justify-content: center;
  gap: 8px;
  z-index: 3;
}
.nc-dot {
  width: 9px;
  height: 9px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  transition: all 0.2s ease;
}
.nc-dot.is-active { width: 26px; background: #ffffff; }
@media (max-width: 640px) {
  .nc-caption, .nc-overlay { padding: 18px 18px; }
  .nc-nav { width: 36px; height: 36px; font-size: 15px; }
  .nc-prev { left: 8px; }
  .nc-next { right: 8px; }
}
"""

_PROMO_JS = """
export default function (component) {
  const { data, parentElement } = component;
  const host = parentElement.host || parentElement;
  const root = parentElement.querySelector("#nc-promo");
  const track = parentElement.querySelector("#nc-track");
  const dots = parentElement.querySelector("#nc-dots");
  const prev = parentElement.querySelector("#nc-prev");
  const next = parentElement.querySelector("#nc-next");
  if (!root || !track || !dots) return;

  host.style.setProperty("--nc-primary", data.primary || "#F5740A");
  host.style.setProperty("--nc-on-primary", data.onPrimary || "#ffffff");

  const slides = Array.isArray(data.slides) ? data.slides : [];
  track.innerHTML = "";
  dots.innerHTML = "";

  slides.forEach(function (slide, i) {
    const item = document.createElement("div");
    item.className = "nc-slide";

    const img = document.createElement("img");
    img.src = slide.image || "";
    img.alt = slide.title || "Werbung";
    img.loading = i === 0 ? "eager" : "lazy";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.objectPosition = "center";
    item.appendChild(img);

    const overlay = document.createElement("div");
    overlay.className = "nc-overlay";
    if (slide.badge) {
      const badge = document.createElement("span");
      badge.className = "nc-badge";
      badge.textContent = slide.badge;
      overlay.appendChild(badge);
    }
    if (slide.title) {
      const title = document.createElement("div");
      title.className = "nc-title";
      title.textContent = slide.title;
      overlay.appendChild(title);
    }
    if (slide.text) {
      const text = document.createElement("p");
      text.className = "nc-text";
      text.textContent = slide.text;
      overlay.appendChild(text);
    }
    if (slide.link && slide.linkLabel) {
      const link = document.createElement("a");
      link.className = "nc-link";
      link.href = slide.link;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = slide.linkLabel;
      overlay.appendChild(link);
    }
    if (overlay.childElementCount > 0) item.appendChild(overlay);
    track.appendChild(item);

    const dot = document.createElement("button");
    dot.className = "nc-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", "Bild " + (i + 1) + " von " + slides.length);
    dot.addEventListener("click", function () { go(i); });
    dots.appendChild(dot);
  });

  const count = slides.length;
  const autoplay = !!data.autoplay && count > 1;
  const interval = Math.max(2, Number(data.interval) || 5) * 1000;
  let index = 0;
  let timer = null;

  if (count <= 1) {
    if (prev) prev.style.display = "none";
    if (next) next.style.display = "none";
    dots.style.display = "none";
  }

  function render() {
    track.style.transform = "translateX(" + (-index * 100) + "%)";
    const items = dots.querySelectorAll(".nc-dot");
    items.forEach(function (dot, i) {
      dot.classList.toggle("is-active", i === index);
    });
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function start() {
    stop();
    if (autoplay) timer = setInterval(function () { go(index + 1); }, interval);
  }

  function go(i) {
    index = ((i % count) + count) % count;
    render();
    start();
  }

  if (prev) prev.addEventListener("click", function () { go(index - 1); });
  if (next) next.addEventListener("click", function () { go(index + 1); });
  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);

  render();
  start();

  return function () { stop(); };
}
"""

_promo_carousel = st.components.v2.component(
    "nc_promo_carousel_v2",
    html=_PROMO_HTML,
    css=_PROMO_CSS,
    js=_PROMO_JS,
)


def render_promo_carousel(settings):
    """Render the advertising carousel (big rotating images) if enabled."""
    config = promo_config(settings)
    if not config["enabled"]:
        return
    slides = active_promo_slides(settings)
    if not slides:
        return

    theme = THEMES.get(settings.get("theme", DEFAULT_THEME), THEMES[DEFAULT_THEME])
    payload = {
        "slides": [
            {
                "image": image_data_uri(s.get("image", "")),
                "badge": s.get("badge", ""),
                "title": s.get("title", ""),
                "text": s.get("text", ""),
                "link": s.get("link", ""),
                "linkLabel": s.get("link_label", ""),
            }
            for s in slides
        ],
        "autoplay": config["autoplay"],
        "interval": config["interval"],
        "primary": theme["primary"],
        "onPrimary": theme["on_primary"],
    }
    _promo_carousel(data=payload, height=config["height"], key="nc_promo_carousel")