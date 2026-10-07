import streamlit as st

from utils.db import (
    date,
    fmt_price,
    image_path,
    payment_methods_for,
    upcoming_special_hours,
    wa_link,
)


def _discount_text(product):
    """Automatisch berechneter Rabatt, z. B. '−50,00 € (−13 %)'."""
    try:
        price = float(product.get("price") or 0)
        old_price = float(product.get("old_price") or 0)
    except (TypeError, ValueError):
        return ""
    if old_price <= 0 or price <= 0 or old_price <= price:
        return ""
    diff = old_price - price
    pct = round(diff / old_price * 100)
    return f"−{fmt_price(diff)} (−{pct} %)"


def render_special_hours(settings):
    entries = upcoming_special_hours(settings)
    if not entries:
        return
    with st.container(border=True):
        st.markdown(":material/event: **Sonderöffnungszeiten**")
        for d_obj, label, is_today, row in entries:
            if is_today:
                extra = " – **heute**"
            elif (d_obj - date.today()).days == 1:
                extra = " – **morgen**"
            else:
                extra = ""
            if row.get("open"):
                line = f"{label}{extra}: {row['open']} – {row['close']} Uhr"
            else:
                line = f"{label}{extra}: **geschlossen**"
            note = (row.get("note") or "").strip()
            if note:
                line += f"  \n{note}"
            st.markdown(line)


@st.dialog("Kaufanfrage", width="small")
def buy_dialog(product, methods, whatsapp):
    price = fmt_price(product.get("price"))
    st.markdown(f"### {product['name']}")
    if price:
        st.markdown(f"**{price}**")
    st.caption(
        "Wählen Sie Ihre Zahlungsart – wir bestätigen die Verfügbarkeit per WhatsApp."
    )

    if methods:
        labels = [m["label"] for m in methods]
        chosen_label = st.radio(
            "Zahlungsart", labels, key=f"buy_method_{product.get('id')}"
        )
        chosen = next((m for m in methods if m["label"] == chosen_label), methods[0])
        if chosen.get("info"):
            st.info(chosen["info"], icon=":material/info:")
        message = (
            f"Hallo, ich möchte folgendes Produkt kaufen: {product['name']}"
            + (f" ({price})" if price else "")
            + f".\nZahlungsart: {chosen['label']}."
            + "\nIst es noch verfügbar?"
        )
        st.link_button(
            "Bestellung per WhatsApp senden",
            wa_link(whatsapp, message),
            icon=":material/send:",
            type="primary",
        )
    else:
        st.warning(
            "Für dieses Produkt sind aktuell keine Zahlungsarten hinterlegt. "
            "Bitte kontaktieren Sie uns direkt.",
            icon=":material/error:",
        )


def product_card(product, whatsapp="", show_cta=True, settings=None):
    with st.container(border=True, height="stretch"):
        img = image_path(product.get("image", ""))
        if img:
            st.image(
                img,
                alt=f"Produktbild: {product['name']}",
                width="stretch",
            )
        else:
            with st.container(height=120, horizontal_alignment="center"):
                st.markdown("### :material/phone_iphone:")

        is_sold = bool(product.get("sold"))
        condition = product.get("condition", "")
        if is_sold:
            st.badge("Verkauft", icon=":material/sell:", color="red")
        elif condition == "Neu":
            st.badge("Neu", icon=":material/new_releases:", color="green")
        elif condition == "Gebraucht":
            st.badge("Gebraucht", icon=":material/history:", color="blue")

        st.markdown(f"**{product['name']}**")

        price = fmt_price(product.get("price"))
        old_price = fmt_price(product.get("old_price"))
        discount = _discount_text(product)
        if price:
            if is_sold:
                st.markdown(f":gray[~~{price}~~]")
            else:
                st.markdown(f"### {price}")
                if old_price:
                    if discount:
                        st.markdown(f":gray[~~{old_price}~~] :red[{discount}]")
                    else:
                        st.markdown(f":gray[~~{old_price}~~]")

        description = (product.get("description") or "").strip()
        if description:
            st.caption(description)

        if show_cta:
            if is_sold:
                st.caption(":material/block: Bereits verkauft.")
            elif product.get("online_sale") and whatsapp:
                methods = payment_methods_for(product, settings) if settings else []
                if methods:
                    names = " · ".join(m["label"] for m in methods)
                    st.caption(f":material/payments: Bezahlung: {names}")
                if st.button(
                    "Online kaufen / anfragen",
                    key=f"buy_{product.get('id')}",
                    icon=":material/shopping_cart:",
                    type="primary",
                ):
                    buy_dialog(product, methods, whatsapp)
            else:
                st.caption(":material/storefront: Nur im Laden erhältlich.")