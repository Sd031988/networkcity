from string import Template

import streamlit as st

DEFAULT_THEME = "orange"

THEMES = {
    "orange": {
        "label": "Modern Orange & Schwarz",
        "swatch": ["#F5740A", "#1C1917", "#FFF1E3"],
        "primary": "#F5740A",
        "primary_hover": "#D9640A",
        "primary_soft": "#FFF1E3",
        "bg": "#FFFFFF",
        "bg_grad": "radial-gradient(1200px 620px at 18% -12%, #FFF1E3 0%, #FFFFFF 58%)",
        "surface": "#FFFFFF",
        "surface2": "#FFF7F0",
        "text": "#1C1917",
        "muted": "#6B7280",
        "border": "#F1D9C2",
        "header": "rgba(255,255,255,0.82)",
        "shadow": "0 12px 30px rgba(245,116,10,0.10)",
        "on_primary": "#FFFFFF",
    },
    "blue": {
        "label": "Modern & hell (Blau)",
        "swatch": ["#2563EB", "#0F172A", "#E8F0FF"],
        "primary": "#2563EB",
        "primary_hover": "#1D4ED8",
        "primary_soft": "#E8F0FF",
        "bg": "#FFFFFF",
        "bg_grad": "radial-gradient(1200px 620px at 18% -12%, #E8F0FF 0%, #FFFFFF 58%)",
        "surface": "#FFFFFF",
        "surface2": "#F2F6FF",
        "text": "#0F172A",
        "muted": "#64748B",
        "border": "#DBE4F5",
        "header": "rgba(255,255,255,0.82)",
        "shadow": "0 12px 30px rgba(37,99,235,0.10)",
        "on_primary": "#FFFFFF",
    },
    "dark": {
        "label": "Dunkel & edel",
        "swatch": ["#FF8A3D", "#0D0D12", "#1E1E27"],
        "primary": "#FF8A3D",
        "primary_hover": "#FF9E5C",
        "primary_soft": "#2A1B0E",
        "bg": "#0D0D12",
        "bg_grad": "radial-gradient(1200px 620px at 18% -12%, #1D1307 0%, #0D0D12 58%)",
        "surface": "#17171E",
        "surface2": "#1E1E27",
        "text": "#F4F4F7",
        "muted": "#9BA1AC",
        "border": "#2A2A36",
        "header": "rgba(13,13,18,0.75)",
        "shadow": "0 16px 36px rgba(0,0,0,0.45)",
        "on_primary": "#1A1005",
    },
}


def theme_options():
    return list(THEMES.keys())


def theme_label(key):
    return THEMES.get(key, THEMES[DEFAULT_THEME])["label"]


_STYLE = Template(
    """
<style>
:root {
  --nc-primary: $primary;
  --nc-primary-hover: $primary_hover;
  --nc-primary-soft: $primary_soft;
  --nc-bg: $bg;
  --nc-surface: $surface;
  --nc-surface-2: $surface2;
  --nc-text: $text;
  --nc-muted: $muted;
  --nc-border: $border;
  --nc-on-primary: $on_primary;
}

html, body, .stApp, [data-testid="stAppViewContainer"] {
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

[data-testid="stAppViewContainer"] {
  background: $bg_grad;
  color: var(--nc-text);
}
[data-testid="stHeader"] {
  background: $header;
  backdrop-filter: blur(12px);
}
[data-testid="stToolbar"] { color: var(--nc-text); }

/* Text */
[data-testid="stAppViewContainer"] h1,
[data-testid="stAppViewContainer"] h2,
[data-testid="stAppViewContainer"] h3,
[data-testid="stAppViewContainer"] h4,
[data-testid="stAppViewContainer"] h5,
[data-testid="stAppViewContainer"] h6 {
  color: var(--nc-text);
  letter-spacing: -0.01em;
}
[data-testid="stAppViewContainer"] p,
[data-testid="stAppViewContainer"] li,
[data-testid="stAppViewContainer"] label {
  color: var(--nc-text);
}
[data-testid="stCaptionContainer"], [data-testid="stCaptionContainer"] * {
  color: var(--nc-muted);
}
[data-testid="stAppViewContainer"] a {
  color: var(--nc-primary);
}

/* Buttons */
button[kind="primary"], [data-testid="stBaseButton-primary"] {
  background: var(--nc-primary) !important;
  border: 1px solid var(--nc-primary) !important;
  color: var(--nc-on-primary) !important;
  border-radius: 999px !important;
  font-weight: 600 !important;
  padding: 0.5rem 1.25rem !important;
  box-shadow: 0 8px 20px rgba(0,0,0,0.08) !important;
  transition: all 0.15s ease !important;
}
button[kind="primary"]:hover, [data-testid="stBaseButton-primary"]:hover {
  background: var(--nc-primary-hover) !important;
  border-color: var(--nc-primary-hover) !important;
  transform: translateY(-1px);
}
button[kind="secondary"], [data-testid="stBaseButton-secondary"] {
  border-radius: 999px !important;
  border: 1px solid var(--nc-border) !important;
  color: var(--nc-text) !important;
  background: var(--nc-surface) !important;
}
button[kind="secondary"]:hover {
  border-color: var(--nc-primary) !important;
  color: var(--nc-primary) !important;
}
button[kind="tertiary"] {
  color: var(--nc-text) !important;
}

/* Cards: bordered containers */
[data-testid="stVerticalBlockBorderWrapper"] {
  background: var(--nc-surface) !important;
  border: 1px solid var(--nc-border) !important;
  border-radius: 18px !important;
  box-shadow: $shadow !important;
}

/* Inputs */
[data-testid="stTextInput"] input,
[data-testid="stNumberInput"] input,
[data-testid="stTextArea"] textarea,
[data-baseweb="select"] > div,
[data-baseweb="input"] {
  border-radius: 12px !important;
  background: var(--nc-surface) !important;
  color: var(--nc-text) !important;
  border-color: var(--nc-border) !important;
}
[data-baseweb="select"] svg, [data-testid="stTextInput"] svg {
  fill: var(--nc-muted) !important;
}

/* Dropdown menus / popovers */
[data-baseweb="popover"] [role="listbox"],
ul[role="listbox"] {
  background: var(--nc-surface) !important;
  border: 1px solid var(--nc-border) !important;
}
li[role="option"] {
  color: var(--nc-text) !important;
}
li[role="option"]:hover {
  background: var(--nc-primary-soft) !important;
}

/* Tabs */
[data-baseweb="tab-list"] {
  gap: 6px;
}
button[data-baseweb="tab"] {
  border-radius: 999px !important;
  color: var(--nc-muted) !important;
}
button[data-baseweb="tab"][aria-selected="true"] {
  color: var(--nc-primary) !important;
}
[data-baseweb="tab-highlight"] {
  background: var(--nc-primary) !important;
}

/* Pills / segmented control */
[data-testid="stPills"] button[aria-pressed="true"],
[data-testid="stSegmentedControl"] button[aria-pressed="true"] {
  background: var(--nc-primary) !important;
  color: var(--nc-on-primary) !important;
  border-color: var(--nc-primary) !important;
}

/* Alerts */
[data-testid="stAlertContainer"] {
  border-radius: 14px !important;
}

/* Code */
code {
  background: var(--nc-surface-2) !important;
  color: var(--nc-text) !important;
}
</style>
"""
)


def inject_theme(theme_key):
    """Inject the selected theme's CSS variables and modern styling globally."""
    theme = THEMES.get(theme_key) or THEMES[DEFAULT_THEME]
    st.html(_STYLE.substitute(theme))