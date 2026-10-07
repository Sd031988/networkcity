import streamlit as st

st.set_page_config(
    page_title="Networkcity Heidelberg",
    page_icon=":material/storefront:",
    layout="wide",
)

from utils.db import image_path, load_settings
from utils.theme import inject_theme

# Der Verwaltungsbereich ist nicht sichtbar. Zugang nur über den geheimen Link:
#   http://localhost:8501/?admin=networkcity-2026
ADMIN_ACCESS_TOKEN = "networkcity-2026"

if "admin_access" not in st.session_state:
    if st.query_params.get("admin") == ADMIN_ACCESS_TOKEN:
        st.session_state.admin_access = True
    st.query_params.clear()

settings = load_settings()
business = settings["business"]

inject_theme(settings.get("theme", "orange"))

logo = business.get("logo")
if logo and image_path(logo):
    st.logo(image_path(logo), size="small")

pages = [
    st.Page("app_pages/home.py", title="Start", icon=":material/home:", default=True),
    st.Page(
        "app_pages/internetcafe.py", title="Internetcafé", icon=":material/computer:"
    ),
    st.Page("app_pages/shop.py", title="Handy-Shop", icon=":material/smartphone:"),
    st.Page("app_pages/reparatur.py", title="Reparatur", icon=":material/build:"),
    st.Page("app_pages/kontakt.py", title="Kontakt", icon=":material/contact_phone:"),
]

if st.session_state.get("admin_access"):
    pages.append(
        st.Page(
            "app_pages/admin.py", title="Verwaltung", icon=":material/admin_panel_settings:"
        )
    )

page = st.navigation(pages, position="top")
page.run()

st.space("medium")
with st.container(border=True):
    cols = st.columns(2)
    with cols[0]:
        st.markdown(
            f"**{business['name']}**  \n"
            f"{business['street']}, {business['zip_city']}"
        )
    with cols[1].container(horizontal=True, horizontal_alignment="right"):
        st.markdown(
            f":material/call: {business['phone']}  \n"
            f":material/mail: {business['email']}"
        )