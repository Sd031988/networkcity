import streamlit as st

from utils.cards import product_card, render_special_hours
from utils.db import (
    digits_only,
    image_path,
    load_products,
    load_settings,
    product_is_hidden,
)
from utils.promo import render_promo_carousel

settings = load_settings()
business = settings["business"]

hero_image = image_path(business.get("hero_image", ""))
if hero_image:
    with st.container(horizontal_alignment="center"):
        st.image(hero_image, width=520, alt="Logo des Ladens Networkcity")

st.title(business["hero_title"], icon=":material/storefront:", text_alignment="center")
st.markdown(business["hero_subtitle"], text_alignment="center")

st.markdown(
    ":orange-badge[Neu & geprüft gebraucht] :orange-badge[Reparatur] "
    ":orange-badge[Internetcafé] :orange-badge[Zubehör]",
    text_alignment="center",
)

st.space("small")
with st.container(horizontal=True, horizontal_alignment="center"):
    st.page_link("app_pages/shop.py", label="Zum Handy-Shop", icon=":material/shopping_bag:")
    st.page_link(
        "app_pages/kontakt.py", label="Kontakt & Anfahrt", icon=":material/route:"
    )

st.space("small")
render_promo_carousel(settings)

render_special_hours(settings)

st.space("medium")
st.header("Unsere Services", icon=":material/grid_view:")

service_cards = [
    (
        "computer",
        "Internetcafé",
        "PC-Arbeitsplätze, Drucken, Kopieren, Scannen und WLAN für alle.",
    ),
    (
        "smartphone",
        "Handys neu & gebraucht",
        "Aktuelle Modelle und geprüfte Gebrauchtgeräte zum fairen Preis.",
    ),
    (
        "build",
        "Reparaturservice",
        "Schnelle Reparatur von Display, Akku, Ladebuchse und mehr.",
    ),
    (
        "headphones",
        "Zubehör",
        "Hüllen, Ladegeräte, Kabel, Kopfhörer und vieles mehr im Laden.",
    ),
]
cols = st.columns(4)
for col, (icon, title, text) in zip(cols, service_cards):
    with col.container(border=True, height="stretch"):
        st.markdown(f":material/{icon}:")
        st.markdown(f"**{title}**")
        st.caption(text)

extra_services = settings.get("extra_services", [])
if extra_services:
    st.space("medium")
    st.header("Weitere Services", icon=":material/handshake:")
    for start in range(0, len(extra_services), 4):
        row = extra_services[start : start + 4]
        cols = st.columns(len(row))
        for col, service in zip(cols, row):
            with col.container(border=True, height="stretch"):
                st.markdown(f":material/{service.get('icon', 'sell')}:")
                st.markdown(f"**{service.get('name', '')}**")
                if service.get("description"):
                    st.caption(service["description"])

st.space("medium")
info_cols = st.columns([2, 1])
with info_cols[0].container(border=True, height="stretch"):
    st.subheader("Über uns", icon=":material/info:")
    st.write(business["about_text"])
    st.markdown(":material/place: " + business["street"] + ", " + business["zip_city"])

with info_cols[1].container(border=True, height="stretch"):
    st.subheader("Öffnungszeiten", icon=":material/schedule:")
    for row in settings["hours"]:
        if row.get("open"):
            st.markdown(f"**{row['day']}:** {row['open']} – {row['close']} Uhr")
        else:
            st.markdown(f"**{row['day']}:** Geschlossen")

featured = [
    p
    for p in load_products()
    if p.get("featured") and not product_is_hidden(p, settings.get("sold_remove_days", 7))
][:6]

if featured:
    st.space("medium")
    st.header("Aktuelle Angebote", icon=":material/local_offer:")
    for i in range(0, len(featured), 3):
        row = featured[i : i + 3]
        cols = st.columns(3)
        for col, product in zip(cols, row):
            with col:
                product_card(
                    product, whatsapp=business["whatsapp"], settings=settings
                )

gallery = business.get("gallery", [])
if gallery:
    st.space("medium")
    st.header("Ein Blick in unseren Laden", icon=":material/photo_library:")
    for i in range(0, len(gallery), 3):
        row = gallery[i : i + 3]
        cols = st.columns(3)
        for col, filename in zip(cols, row):
            path = image_path(filename)
            if path:
                with col:
                    st.image(path, width="stretch", alt="Foto aus dem Laden")

st.space("medium")
with st.container(border=True):
    cta_cols = st.columns([2, 1])
    with cta_cols[0]:
        st.markdown(
            f"**Haben Sie Fragen?** Rufen Sie uns an unter **{business['phone']}** "
            "oder schreiben Sie uns per WhatsApp – wir beraten Sie gerne."
        )
    with cta_cols[1].container(horizontal=True, horizontal_alignment="right"):
        st.link_button("Anrufen", "tel:" + digits_only(business["phone"]), icon=":material/call:")
        st.link_button(
            "WhatsApp",
            "https://wa.me/" + digits_only(business["whatsapp"]),
            icon=":material/chat:",
        )