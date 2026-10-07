import hmac

import streamlit as st


def _admin_credentials():
    try:
        return st.secrets["admin"]["username"], st.secrets["admin"]["password"]
    except Exception:
        return None, None


def is_logged_in():
    return st.session_state.get("admin_logged_in", False)


def check_login(username, password):
    admin_user, admin_pass = _admin_credentials()
    if not admin_user or not admin_pass:
        return False
    return hmac.compare_digest(username or "", admin_user) and hmac.compare_digest(
        password or "", admin_pass
    )


def login(username, password):
    if check_login(username, password):
        st.session_state.admin_logged_in = True
        return True
    return False


def logout():
    st.session_state.admin_logged_in = False
    st.session_state.pop("admin_access", None)