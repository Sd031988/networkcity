import streamlit as st

from utils.cards import product_card
from utils.db import digits_only, load_products, load_settings, product_is_hidden

st.title("Handy-Shop", icon=":material/shopping_bag:")
st.write(
    "Neu und geprüft gebraucht – zum fairen Preis, mit Gewährleistung und "
    "persönlicher Beratung direkt im Laden."
)

settings = load_settings()
business = settings["business"]
sold_remove_days = settings.get("sold_remove_days", 7)
products = [
    p for p in load_products() if not product_is_hidden(p, sold_remove_days)
]

with st.container(horizontal=True, wrap=False):
    search = st.text_input(
        "Produkt suchen",
        placeholder="z. B. iPhone, Samsung, Hülle …",
        label_visibility="collapsed",
    )
    condition = st.pills(
        "Zustand",
        ["Alle", "Neu", "Gebraucht"],
        default="Alle",
        key="shop_condition",
    )

categories = sorted({p.get("category", "") for p in products if p.get("category")})
selected_categories = st.multiselect("Kategorie", categories, default=categories)

sorting = st.segmented_control(
    "Sortierung",
    ["Empfohlen", "Preis aufsteigend", "Preis absteigend"],
    default="Empfohlen",
    key="shop_sorting",
)

query = (search or "").strip().lower()
filtered = []
for p in products:
    if query and query not in p["name"].lower() and query not in (
        p.get("description") or ""
    ).lower():
        continue
    if condition != "Alle" and p.get("condition", "") != condition:
        continue
    if p.get("category", "") not in selected_categories:
        continue
    filtered.append(p)

if sorting == "Preis aufsteigend":
    filtered.sort(key=lambda p: (bool(p.get("sold")), float(p.get("price") or 0)))
elif sorting == "Preis absteigend":
    filtered.sort(key=lambda p: (bool(p.get("sold")), -float(p.get("price") or 0)))
else:
    filtered.sort(
        key=lambda p: (
            bool(p.get("sold")),
            not p.get("featured", False),
            float(p.get("price") or 0),
        )
    )

if not filtered:
    st.info("Keine Produkte gefunden. Schauen Sie bald wieder vorbei!")
else:
    st.space("small")
    st.caption(f"{len(filtered)} Produkte")

    for i in range(0, len(filtered), 3):
        row = filtered[i : i + 3]
        cols = st.columns(3)
        for col, product in zip(cols, row):
            with col:
                product_card(
                    product, whatsapp=business["whatsapp"], settings=settings
                )

    st.space("medium")
    with st.container(border=True):
        c_cols = st.columns([2, 1])
        with c_cols[0]:
            st.markdown(
                "**Sie interessieren sich für ein Produkt?** Rufen Sie uns an oder "
                "schreiben Sie uns per WhatsApp – wir legen es gerne für Sie zur Seite."
            )
        with c_cols[1].container(horizontal=True, horizontal_alignment="right"):
            st.link_button("Anrufen", "tel:" + digits_only(business["phone"]), icon=":material/call:")
            st.link_button(
                "WhatsApp",
                "https://wa.me/" + digits_only(business["whatsapp"]),
                icon=":material/chat:",
            )