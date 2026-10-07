import streamlit as st

from utils.cards import render_special_hours
from utils.db import digits_only, load_settings, wa_link

settings = load_settings()
business = settings["business"]

st.title("Kontakt & Anfahrt", icon=":material/contact_phone:")

render_special_hours(settings)

contact_cols = st.columns(2)
with contact_cols[0].container(border=True, height="stretch"):
    st.subheader("Kontakt", icon=":material/contact_page:")
    st.markdown(
        f"**Adresse**  \n{business['street']}  \n{business['zip_city']}"
    )
    st.markdown(f"**Telefon:** {business['phone']}")
    st.markdown(f"**WhatsApp:** {business['whatsapp']}")
    st.markdown(f"**E-Mail:** {business['email']}")
    st.space("small")
    with st.container(horizontal=True):
        st.link_button("Anrufen", "tel:" + digits_only(business["phone"]), icon=":material/call:")
        st.link_button("WhatsApp", wa_link(business["whatsapp"]), icon=":material/chat:")
        st.link_button("E-Mail", "mailto:" + business["email"], icon=":material/mail:")

with contact_cols[1].container(border=True, height="stretch"):
    st.subheader("Öffnungszeiten", icon=":material/schedule:")
    for row in settings["hours"]:
        if row.get("open"):
            st.markdown(f"**{row['day']}:** {row['open']} – {row['close']} Uhr")
        else:
            st.markdown(f"**{row['day']}:** Geschlossen")

if business.get("map_url"):
    st.space("medium")
    st.subheader("Anfahrt", icon=":material/map:")
    st.iframe(
        business["map_url"],
        height=420,
        alt="Google-Maps-Karte mit dem Standort von Networkcity Heidelberg",
    )