import streamlit as st

from utils.db import digits_only, load_settings

settings = load_settings()
repair = settings["repair"]

st.title(repair.get("title", "Handy-Reparatur"), icon=":material/build:")
st.write(repair["text"])

st.space("medium")
st.header("So einfach geht's", icon=":material/checklist:")

for index, step in enumerate(repair.get("steps", []), start=1):
    with st.container(border=True):
        cols = st.columns([1, 5])
        with cols[0]:
            st.markdown(f"### {index}.")
        with cols[1]:
            st.markdown(step)

st.space("medium")
st.header("Leistungen & Preise", icon=":material/receipt_long:")

for service in repair.get("services", []):
    with st.container(border=True):
        cols = st.columns([1, 2, 3])
        with cols[0]:
            st.markdown(f"**{service['name']}**")
        with cols[1]:
            st.markdown(f"**{service['price']}**")
        with cols[2]:
            st.markdown(service["description"])

st.space("medium")
business = settings["business"]
with st.container(border=True):
    c_cols = st.columns([2, 1])
    with c_cols[0]:
        st.markdown(
            "**Bringen Sie Ihr Gerät einfach vorbei** oder rufen Sie vorher kurz an. "
            "Die Prüfung ist kostenlos und Sie bekommen für alles ein faires Angebot."
        )
    with c_cols[1].container(horizontal=True, horizontal_alignment="right"):
        st.link_button("Anrufen", "tel:" + digits_only(business["phone"]), icon=":material/call:")
        st.link_button(
            "WhatsApp",
            "https://wa.me/" + digits_only(business["whatsapp"]),
            icon=":material/chat:",
        )