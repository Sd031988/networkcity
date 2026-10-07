import streamlit as st

from utils.db import load_settings

settings = load_settings()
cafe = settings["internetcafe"]

st.title(cafe.get("title", "Internetcafé"), icon=":material/computer:")
st.write(cafe["text"])

bullet_points = cafe.get("bullet_points", [])
if bullet_points:
    st.markdown("".join(f"- {point}\n" for point in bullet_points))

st.space("medium")
st.header("Leistungen & Preise", icon=":material/receipt_long:")

for service in cafe.get("services", []):
    with st.container(border=True):
        cols = st.columns([1, 2, 3])
        with cols[0]:
            st.markdown(f"**{service['name']}**")
        with cols[1]:
            st.markdown(f"**{service['price']}**")
        with cols[2]:
            st.markdown(service["description"])

st.space("medium")
with st.container(border=True):
    st.markdown(
        "**Gerne können Sie einfach vorbeikommen** – meist ist direkt ein Platz frei. "
        "Egal ob für die schnelle E-Mail, das Ausdrucken von Tickets oder eine Zeit "
        "am Rechner: Wir sind für Sie da."
    )