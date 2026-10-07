import base64
import io
import json
import mimetypes
import uuid
from datetime import date
from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import streamlit as st

try:
    from PIL import Image
except ImportError:  # Pillow is a Streamlit dependency, but stay safe.
    Image = None

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
IMAGES_DIR = DATA_DIR / "images"


def _read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


@st.cache_data(ttl=120, show_spinner=False)
def load_settings():
    return _read_json(DATA_DIR / "settings.json")


@st.cache_data(ttl=120, show_spinner=False)
def load_products():
    return _read_json(DATA_DIR / "products.json")


def save_settings(data):
    _write_json(DATA_DIR / "settings.json", data)
    st.cache_data.clear()


def save_products(products):
    _write_json(DATA_DIR / "products.json", list(products))
    st.cache_data.clear()


def image_path(filename):
    if not filename:
        return None
    p = IMAGES_DIR / Path(filename).name
    return str(p) if p.exists() else None


def save_uploaded_image(uploaded_file):
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(uploaded_file.name).suffix.lower() or ".jpg"
    filename = uuid.uuid4().hex + suffix
    (IMAGES_DIR / filename).write_bytes(uploaded_file.getvalue())
    return filename


def delete_image(filename):
    if not filename:
        return
    p = IMAGES_DIR / Path(filename).name
    if p.exists():
        p.unlink()


def list_images():
    """Return the file names of all uploaded images (sorted)."""
    if not IMAGES_DIR.exists():
        return []
    return sorted(p.name for p in IMAGES_DIR.iterdir() if p.is_file())


@st.cache_data(ttl=300, show_spinner=False)
def image_data_uri(filename, max_width=1920):
    """Return a (downscaled) base64 data URI so an image can be embedded in HTML/JS."""
    if not filename:
        return ""
    p = IMAGES_DIR / Path(filename).name
    if not p.exists():
        return ""
    mime = mimetypes.guess_type(p.name)[0] or "image/jpeg"
    encoded = p.read_bytes()
    if Image is not None:
        try:
            with Image.open(p) as image:
                has_alpha = (
                    image.mode in ("RGBA", "LA") or "transparency" in image.info
                )
                if image.width > max_width:
                    ratio = max_width / image.width
                    image = image.resize((max_width, round(image.height * ratio)))
                buffer = io.BytesIO()
                if has_alpha:
                    image.save(buffer, format="PNG", optimize=True)
                    mime = "image/png"
                else:
                    image.convert("RGB").save(
                        buffer, format="JPEG", quality=85, optimize=True
                    )
                    mime = "image/jpeg"
                encoded = buffer.getvalue()
        except Exception:
            pass
    return f"data:{mime};base64," + base64.b64encode(encoded).decode("ascii")


def promo_config(settings):
    """Normalized advertising/promo configuration with sensible defaults."""
    cfg = settings.get("promo") or {}
    try:
        interval = max(2, int(cfg.get("interval", 5) or 5))
    except (TypeError, ValueError):
        interval = 5
    try:
        height = max(180, int(cfg.get("height", 520) or 520))
    except (TypeError, ValueError):
        height = 520
    return {
        "enabled": bool(cfg.get("enabled", False)),
        "autoplay": bool(cfg.get("autoplay", True)),
        "interval": interval,
        "height": height,
        "slides": list(cfg.get("slides") or []),
    }


def active_promo_slides(settings):
    """Enabled promo slides whose image file actually exists."""
    slides = promo_config(settings)["slides"]
    return [
        s
        for s in slides
        if s.get("enabled", True) and image_path(s.get("image", ""))
    ]


def fmt_price(value):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return ""
    if v <= 0:
        return ""
    return f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def iso_date(value):
    """Normalize a date value (datetime.date, str, None) to 'YYYY-MM-DD' or ''."""
    if value is None or value == "":
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    return str(value)[:10]


WEEKDAYS_DE = [
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
    "Sonntag",
]


def upcoming_special_hours(settings, window_days=35):
    """Return future/current special-hour entries sorted by date.

    Each entry: (date_object, date_label, is_today, row)
    """
    today = date.today()
    entries = []
    for row in settings.get("special_hours", []):
        raw = row.get("date", "")
        try:
            d_obj = date.fromisoformat(iso_date(raw))
        except (ValueError, TypeError):
            continue
        days = (d_obj - today).days
        if days < 0 or days > window_days:
            continue
        label = d_obj.strftime("%d.%m.%Y") + " (" + WEEKDAYS_DE[d_obj.weekday()] + ")"
        entries.append((d_obj, label, days == 0, row))
    entries.sort(key=lambda e: e[0])
    return entries


def product_is_hidden(product, sold_remove_days=7):
    """True, wenn ein Produkt öffentlich nicht mehr angezeigt werden soll.

    - Nicht verfügbare Produkte sind immer ausgeblendet.
    - Verkaufte Produkte bleiben noch einige Tage sichtbar (mit Hinweis
      „Verkauft“) und verschwinden danach automatisch aus dem Shop.
    """
    if not product.get("available", True):
        return True
    if not product.get("sold"):
        return False
    sold_at = iso_date(product.get("sold_at"))
    if not sold_at:
        return False
    try:
        days_since = (date.today() - date.fromisoformat(sold_at)).days
    except ValueError:
        return False
    try:
        limit = int(sold_remove_days)
    except (TypeError, ValueError):
        limit = 7
    return days_since >= limit


def enabled_payment_methods(settings):
    """Return the globally enabled payment methods (list of dicts)."""
    return [m for m in settings.get("payment_methods", []) if m.get("enabled", True)]


def payment_methods_for(product, settings):
    """Payment methods available for a product.

    Uses the per-product selection when set, otherwise all enabled methods.
    """
    enabled = enabled_payment_methods(settings)
    selected = product.get("payment_methods") or []
    if not selected:
        return enabled
    selected_set = set(selected)
    return [m for m in enabled if m.get("id") in selected_set]


def digits_only(phone):
    return "".join(ch for ch in str(phone) if ch.isdigit())


def wa_link(phone, text=""):
    digits = digits_only(phone)
    if not digits:
        return ""
    base = f"https://wa.me/{digits}"
    if text:
        return base + "?text=" + quote(text)
    return base


def tel_link(phone):
    digits = digits_only(phone)
    return f"tel:{digits}" if digits else ""