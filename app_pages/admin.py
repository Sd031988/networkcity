import uuid
from datetime import date

import streamlit as st

from utils import auth
from utils.db import (
    delete_image,
    image_path,
    iso_date,
    list_images,
    load_products,
    load_settings,
    save_products,
    save_settings,
    save_uploaded_image,
)
from utils.theme import DEFAULT_THEME, THEMES, theme_label, theme_options


def to_records(data):
    if data is None:
        return []
    if hasattr(data, "to_dict"):
        return data.to_dict(orient="records")
    return list(data)


def store_promo(settings, slides):
    cfg = settings.get("promo") or {}
    cfg["slides"] = slides
    settings["promo"] = cfg
    save_settings(settings)


def pick_image(label, images, key, current=""):
    options = ["(kein Bild)"] + list(images)
    if current and current not in options:
        options.append(current)
    index = options.index(current) if current in options else 0
    choice = st.selectbox(
        label,
        options,
        index=index,
        key=key,
        format_func=lambda name: "– kein Bild –" if name == "(kein Bild)" else name,
    )
    return "" if choice == "(kein Bild)" else choice


st.title("Verwaltung", icon=":material/admin_panel_settings:")

if not auth.is_logged_in():
    st.write("Bitte melden Sie sich an, um Inhalte Ihrer Website zu verwalten.")
    with st.form("admin_login"):
        username = st.text_input("Benutzername")
        password = st.text_input("Passwort", type="password")
        submitted = st.form_submit_button("Anmelden", type="primary")
    if submitted:
        if auth.login(username, password):
            st.rerun()
        else:
            st.error("Login fehlgeschlagen. Bitte Zugangsdaten prüfen.")
    st.stop()

with st.container(horizontal=True, horizontal_alignment="right"):
    st.markdown(f"Aktuell: **Verwaltung**")
    if st.button("Abmelden", icon=":material/logout:"):
        auth.logout()
        st.rerun()

(
    tab_promo,
    tab_products,
    tab_business,
    tab_texts,
    tab_services,
    tab_payment,
    tab_design,
    tab_logo,
) = st.tabs(
    [
        "Werbung",
        "Produkte",
        "Stammdaten",
        "Texte",
        "Preise & Services",
        "Bezahlung",
        "Design",
        "Logo & Bilder",
    ]
)

with tab_promo:
    st.subheader("Werbung & Angebote", icon=":material/campaign:")
    st.caption(
        "Die große Bildergalerie oben auf der Startseite. Die Bilder wechseln "
        "automatisch (wie bei vielen anderen Websites) und können eine "
        "Überschrift, ein Label wie „Angebot“ und eine Beschreibung haben. "
        "So lässt sich hier Ihre eigene Werbung laufen lassen."
    )
    settings = load_settings()
    config = settings.get("promo") or {}
    slides = list(config.get("slides") or [])
    images = list_images()

    gc1, gc2, gc3, gc4 = st.columns(4)
    promo_enabled = gc1.toggle(
        "Werbung anzeigen", value=config.get("enabled", True)
    )
    promo_autoplay = gc2.toggle(
        "Automatisch wechseln",
        value=config.get("autoplay", True),
        help="Aus: Die Bilder wechseln nur, wenn Besucher auf die Pfeile klicken.",
    )
    promo_interval = gc3.slider(
        "Wechsel alle (Sekunden)", 2, 20, int(config.get("interval", 5))
    )
    promo_height = gc4.slider(
        "Höhe (Pixel)", 240, 760, int(config.get("height", 520)), step=20
    )
    if st.button("Einstellungen speichern", type="primary", icon=":material/save:"):
        config["enabled"] = promo_enabled
        config["autoplay"] = promo_autoplay
        config["interval"] = int(promo_interval)
        config["height"] = int(promo_height)
        config["slides"] = slides
        settings["promo"] = config
        save_settings(settings)
        st.rerun()

    st.space("medium")
    st.markdown("**Bilder in der Werbung**")
    st.caption(
        "Bild auswählen oder neu hochladen. Mit „Nach oben/Nach unten“ die "
        "Reihenfolge ändern. Reihenfolge = Ablauf der Werbung."
    )

    if not slides:
        st.info("Noch keine Werbebilder vorhanden. Fügen Sie unten welche hinzu.")

    for i, slide in enumerate(slides):
        slide_id = slide.get("id") or uuid.uuid4().hex
        slide["id"] = slide_id
        heading = slide.get("title") or f"Bild {i + 1}"
        with st.expander(f"{i + 1}. {heading}", expanded=False):
            edit_cols = st.columns([1, 2])
            current_image = slide.get("image", "")
            with edit_cols[0]:
                current_path = image_path(current_image)
                if current_path:
                    st.image(
                        current_path,
                        width="stretch",
                        alt=f"Werbebild {i + 1}",
                    )
                else:
                    st.caption("Kein Bild ausgewählt.")
            with edit_cols[1]:
                options = [""] + images
                if current_image and current_image not in options:
                    options.append(current_image)
                image_index = (
                    options.index(current_image) if current_image in options else 0
                )
                picked_image = st.selectbox(
                    "Vorhandenes Bild",
                    options,
                    index=image_index,
                    key=f"promo_img_{slide_id}",
                    format_func=lambda x: "(kein Bild)" if not x else x,
                )
                uploaded_image = st.file_uploader(
                    "… oder neues Bild hochladen",
                    type=["jpg", "jpeg", "png", "webp"],
                    key=f"promo_upload_{slide_id}",
                )
                badge = st.text_input(
                    "Label / Badge (z. B. Angebot)",
                    value=slide.get("badge", ""),
                    key=f"promo_badge_{slide_id}",
                )
                title = st.text_input(
                    "Überschrift",
                    value=slide.get("title", ""),
                    key=f"promo_title_{slide_id}",
                )
                text = st.text_area(
                    "Beschreibung",
                    value=slide.get("text", ""),
                    key=f"promo_text_{slide_id}",
                )
                link = st.text_input(
                    "Link (optional)",
                    value=slide.get("link", ""),
                    help="z. B. ein WhatsApp-Link oder die Adresse Ihrer Produktseite.",
                    key=f"promo_link_{slide_id}",
                )
                link_label = st.text_input(
                    "Link-Text (optional)",
                    value=slide.get("link_label", ""),
                    key=f"promo_label_{slide_id}",
                )
                slide_enabled = st.toggle(
                    "Dieses Bild anzeigen",
                    value=slide.get("enabled", True),
                    key=f"promo_on_{slide_id}",
                )

            action_cols = st.columns([1, 1, 1, 1, 1])
            if action_cols[0].button(
                "Speichern",
                type="primary",
                icon=":material/save:",
                key=f"promo_save_{slide_id}",
            ):
                new_image = (
                    save_uploaded_image(uploaded_image)
                    if uploaded_image
                    else picked_image
                )
                slides[i] = {
                    "id": slide_id,
                    "image": new_image,
                    "badge": badge.strip(),
                    "title": title.strip(),
                    "text": text.strip(),
                    "link": link.strip(),
                    "link_label": link_label.strip(),
                    "enabled": bool(slide_enabled),
                }
                config["slides"] = slides
                settings["promo"] = config
                save_settings(settings)
                st.rerun()
            if action_cols[1].button(
                "Nach oben",
                icon=":material/arrow_upward:",
                disabled=i == 0,
                key=f"promo_up_{slide_id}",
            ):
                slides[i - 1], slides[i] = slides[i], slides[i - 1]
                config["slides"] = slides
                settings["promo"] = config
                save_settings(settings)
                st.rerun()
            if action_cols[2].button(
                "Nach unten",
                icon=":material/arrow_downward:",
                disabled=i == len(slides) - 1,
                key=f"promo_down_{slide_id}",
            ):
                slides[i + 1], slides[i] = slides[i], slides[i + 1]
                config["slides"] = slides
                settings["promo"] = config
                save_settings(settings)
                st.rerun()
            if action_cols[3].button(
                "Löschen",
                icon=":material/delete:",
                key=f"promo_del_{slide_id}",
            ):
                slides.pop(i)
                config["slides"] = slides
                settings["promo"] = config
                save_settings(settings)
                st.rerun()

    st.space("medium")
    st.markdown("**Neues Werbebild hinzufügen**")
    with st.form("form_new_promo"):
        add_cols = st.columns([1, 2])
        with add_cols[0]:
            new_picked = st.selectbox(
                "Vorhandenes Bild",
                [""] + images,
                key="promo_new_image",
                format_func=lambda x: "(kein Bild)" if not x else x,
            )
        with add_cols[1]:
            new_uploaded = st.file_uploader(
                "… oder neues Bild hochladen",
                type=["jpg", "jpeg", "png", "webp"],
                key="promo_new_upload",
            )
            new_badge = st.text_input("Label / Badge (z. B. Angebot)")
            new_title = st.text_input("Überschrift")
            new_text = st.text_area("Beschreibung")
            new_link = st.text_input("Link (optional)")
            new_link_label = st.text_input("Link-Text (optional)")
        add_submitted = st.form_submit_button(
            "Bild hinzufügen", type="primary", icon=":material/add_photo_alternate:"
        )
    if add_submitted:
        new_image = (
            save_uploaded_image(new_uploaded) if new_uploaded else new_picked
        )
        if not new_image:
            st.error("Bitte ein vorhandenes Bild auswählen oder ein neues hochladen.")
        else:
            slides.append(
                {
                    "id": uuid.uuid4().hex,
                    "image": new_image,
                    "badge": new_badge.strip(),
                    "title": new_title.strip(),
                    "text": new_text.strip(),
                    "link": new_link.strip(),
                    "link_label": new_link_label.strip(),
                    "enabled": True,
                }
            )
            config["slides"] = slides
            settings["promo"] = config
            save_settings(settings)
            st.rerun()

with tab_products:
    st.subheader("Neues Produkt hinzufügen", icon=":material/add_box:")
    pay_label_to_id = {
        m["label"]: m["id"]
        for m in load_settings().get("payment_methods", [])
        if m.get("enabled", True)
    }
    with st.form("form_new_product"):
        np_cols = st.columns(2)
        np_name = np_cols[0].text_input("Produktname")
        np_category = np_cols[1].selectbox(
            "Kategorie", ["Smartphone", "Tablet", "Zubehör", "Laptop/PC", "Sonstiges"]
        )
        np_price = np_cols[0].number_input(
            "Preis (€)", min_value=0.0, step=5.0, format="%.2f"
        )
        np_old_price = np_cols[1].number_input(
            "Alter Preis (€)",
            min_value=0.0,
            step=5.0,
            format="%.2f",
            help="Leer lassen bzw. 0 = kein Rabatt. Bei Eingabe werden alter "
            "Preis (durchgestrichen) und Rabatt automatisch angezeigt.",
        )
        np_condition = st.segmented_control("Zustand", ["Neu", "Gebraucht"], default="Neu")
        np_description = st.text_area("Beschreibung")
        np_featured = st.toggle("Als Angebot auf der Startseite anzeigen")
        np_online_sale = st.toggle(
            "Direkt online verkaufbar",
            value=True,
            help="An: Kunden sehen einen Button „Online kaufen / anfragen“ "
            "(Anfrage per WhatsApp). Aus: Hinweis „Nur im Laden erhältlich“.",
        )
        np_payments = st.multiselect(
            "Zahlungsarten (leer = alle erlaubten)",
            list(pay_label_to_id),
            help="Welche Zahlungsarten können Kunden für dieses Produkt wählen?",
        )
        np_image = st.file_uploader(
            "Bild (optional, JPG/PNG/WEBP)",
            type=["jpg", "jpeg", "png", "webp"],
            key="np_image",
        )
        np_submit = st.form_submit_button("Produkt hinzufügen", type="primary")
    if np_submit:
        if not np_name.strip():
            st.error("Bitte einen Produktnamen eingeben.")
        else:
            records = load_products()
            records.append(
                {
                    "id": uuid.uuid4().hex,
                    "name": np_name.strip(),
                    "category": np_category,
                    "condition": np_condition,
                    "price": round(float(np_price or 0), 2),
                    "old_price": round(float(np_old_price or 0), 2)
                    if np_old_price
                    else None,
                    "description": np_description.strip(),
                    "image": save_uploaded_image(np_image) if np_image else "",
                    "featured": bool(np_featured),
                    "available": True,
                    "online_sale": bool(np_online_sale),
                    "payment_methods": [pay_label_to_id[l] for l in np_payments],
                }
            )
            save_products(records)
            st.session_state.pop("admin_products", None)
            st.rerun()

    st.space("medium")
    st.subheader("Vorhandene Produkte bearbeiten", icon=":material/inventory:")
    st.caption(
        "Zum Bearbeiten einfach in die Zelle klicken. Neue Zeile: über „+“ unten. "
        "Löschen: über das Menü (⋮) am Zeilenende. Danach auf „Produkte speichern“. "
        "Ist ein Produkt verkauft, das Häkchen „Verkauft“ setzen – es bleibt noch "
        "kurz mit Hinweis sichtbar und verschwindet danach automatisch."
    )
    products = load_products()
    for p in products:
        p.setdefault("sold", False)
        p.setdefault("sold_at", "")
        p.setdefault("payment_methods", [])
    edited = st.data_editor(
        products,
        num_rows="dynamic",
        hide_index=True,
        width="stretch",
        key="admin_products",
        column_config={
            "id": None,
            "name": st.column_config.TextColumn("Name", width="large"),
            "category": st.column_config.SelectboxColumn(
                "Kategorie",
                options=["Smartphone", "Tablet", "Zubehör", "Laptop/PC", "Sonstiges"],
            ),
            "condition": st.column_config.SelectboxColumn(
                "Zustand", options=["Neu", "Gebraucht"]
            ),
            "price": st.column_config.NumberColumn("Preis (€)", format="%.2f"),
            "old_price": st.column_config.NumberColumn(
                "Alter Preis (€)",
                help="Optional. Bei Eingabe werden Streichpreis und Rabatt "
                "automatisch auf der Website angezeigt.",
                format="%.2f",
            ),
            "description": st.column_config.TextColumn("Beschreibung"),
            "image": None,
            "featured": st.column_config.CheckboxColumn("Angebot"),
            "available": st.column_config.CheckboxColumn("Verfügbar"),
            "online_sale": st.column_config.CheckboxColumn(
                "Online", help="Häkchen = online verkaufbar (Anfrage per WhatsApp)"
            ),
            "sold": st.column_config.CheckboxColumn(
                "Verkauft",
                help="Häkchen = Produkt ist verkauft. Bleibt noch einige Tage mit "
                "Hinweis „Verkauft“ sichtbar und verschwindet danach automatisch.",
            ),
            "sold_at": None,
            "payment_methods": None,
        },
    )
    if st.button("Produkte speichern", type="primary", icon=":material/save:"):
        records = to_records(edited)
        today_iso = iso_date(date.today())
        existing_by_id = {
            p.get("id"): p for p in load_products() if p.get("id")
        }
        for record in records:
            if not record.get("id"):
                record["id"] = uuid.uuid4().hex
            record.setdefault("image", "")
            record.setdefault("online_sale", False)
            prev = existing_by_id.get(record["id"], {})
            record["payment_methods"] = prev.get("payment_methods", [])
            if record.get("sold"):
                record["sold_at"] = prev.get("sold_at") or today_iso
            else:
                record["sold_at"] = ""
        save_products(records)
        st.session_state.pop("admin_products", None)
        st.rerun()

    st.space("medium")
    st.subheader("Bilder zu Produkten", icon=":material/add_photo_alternate:")
    products = load_products()
    if products:
        indices = list(range(len(products)))
        upload_cols = st.columns([2, 2, 1], vertical_alignment="center")
        selected = upload_cols[0].selectbox(
            "Produkt wählen",
            indices,
            format_func=lambda i: products[i].get("name", f"Produkt {i + 1}"),
            key="admin_image_select",
        )
        uploaded = upload_cols[1].file_uploader(
            "Neues Bild (JPG, PNG oder WEBP)",
            type=["jpg", "jpeg", "png", "webp"],
            key="admin_image_upload",
        )
        if upload_cols[2].button("Bild speichern", icon=":material/image:"):
            if uploaded:
                filename = save_uploaded_image(uploaded)
                products[selected]["image"] = filename
                save_products(products)
                st.session_state.pop("admin_products", None)
                st.rerun()
            else:
                st.warning("Bitte zuerst ein Bild auswählen.")

        current_image = products[selected].get("image", "")
        current_path = image_path(current_image)
        if current_path:
            st.image(
                current_path,
                width=220,
                alt=f"Aktuelles Bild von {products[selected]['name']}",
            )
            if st.button("Bild entfernen", icon=":material/delete:"):
                delete_image(current_image)
                products[selected]["image"] = ""
                save_products(products)
                st.session_state.pop("admin_products", None)
                st.rerun()

    st.space("medium")
    st.subheader("Zahlungsarten je Produkt", icon=":material/payments:")
    st.caption(
        "Standard: Alle erlaubten Zahlungsarten. Hier können Sie für einzelne "
        "Produkte die Auswahl einschränken (leer = alle)."
    )
    products = load_products()
    if products:
        enabled_payments = [
            m
            for m in load_settings().get("payment_methods", [])
            if m.get("enabled", True)
        ]
        label_by_id = {m["id"]: m.get("label", m["id"]) for m in enabled_payments}
        id_by_label = {v: k for k, v in label_by_id.items()}
        pp_cols = st.columns([2, 2, 1], vertical_alignment="center")
        pp_index = pp_cols[0].selectbox(
            "Produkt",
            list(range(len(products))),
            format_func=lambda i: products[i].get("name", f"Produkt {i + 1}"),
            key="admin_pp_select",
        )
        current_ids = products[pp_index].get("payment_methods") or []
        pp_selected = pp_cols[1].multiselect(
            "Zahlungsarten",
            list(id_by_label),
            default=[label_by_id[i] for i in current_ids if i in label_by_id],
            key=f"admin_pp_methods_{pp_index}",
        )
        if pp_cols[2].button(
            "Speichern", key="admin_pp_save", icon=":material/save:"
        ):
            products[pp_index]["payment_methods"] = [
                id_by_label[label] for label in pp_selected
            ]
            save_products(products)
            st.session_state.pop("admin_products", None)
            st.success("Zahlungsarten gespeichert.")

with tab_business:
    st.subheader("Stammdaten", icon=":material/store:")
    settings = load_settings()
    business = settings["business"]
    with st.form("form_business"):
        name = st.text_input("Ladenname", value=business.get("name", ""))
        tagline = st.text_input(
            "Kurzbeschreibung (Slogan)", value=business.get("tagline", "")
        )
        street = st.text_input(
            "Straße & Hausnummer", value=business.get("street", "")
        )
        zip_city = st.text_input("PLZ & Ort", value=business.get("zip_city", ""))
        phone = st.text_input("Telefon", value=business.get("phone", ""))
        whatsapp = st.text_input(
            "WhatsApp (mit Ländercode, z. B. 491751234567)",
            value=business.get("whatsapp", ""),
        )
        email = st.text_input("E-Mail", value=business.get("email", ""))
        map_url = st.text_input(
            "Google-Maps-Embed-URL (für die Karte auf der Kontaktseite)",
            value=business.get("map_url", ""),
        )
        sold_remove_days = st.number_input(
            "Verkaufte Produkte ausblenden nach (Tagen)",
            min_value=0,
            max_value=365,
            value=int(settings.get("sold_remove_days", 7)),
            help="Verkaufte Produkte (Häkchen „Verkauft“) werden so lange noch mit "
            "Hinweis angezeigt und danach automatisch von der Website entfernt. "
            "0 = sofort ausblenden.",
        )
        save_business = st.form_submit_button(
            "Stammdaten speichern", type="primary", icon=":material/save:"
        )
    if save_business:
        business.update(
            name=name,
            tagline=tagline,
            street=street,
            zip_city=zip_city,
            phone=phone,
            whatsapp=whatsapp,
            email=email,
            map_url=map_url,
        )
        settings["business"] = business
        settings["sold_remove_days"] = int(sold_remove_days)
        save_settings(settings)

    st.space("medium")
    st.subheader("Öffnungszeiten", icon=":material/schedule:")
    settings = load_settings()
    edited_hours = st.data_editor(
        settings["hours"],
        num_rows="fixed",
        hide_index=True,
        width="stretch",
        key="admin_hours",
        column_config={
            "day": "Tag",
            "open": st.column_config.TextColumn(
                "Öffnet", help="Leer lassen = an diesem Tag geschlossen"
            ),
            "close": st.column_config.TextColumn("Schließt"),
        },
    )
    if st.button("Öffnungszeiten speichern", type="primary", icon=":material/save:"):
        settings["hours"] = to_records(edited_hours)
        save_settings(settings)

    st.space("medium")
    st.subheader("Sonderöffnungszeiten", icon=":material/event:")
    st.caption(
        "Hier einmalige Änderungen mit Datum eintragen, z. B. Feiertage oder "
        "verkürzte Zeiten. Diese erscheinen automatisch auf der Start- und "
        "Kontaktseite. „Öffnet“ leer lassen = an diesem Tag geschlossen."
    )
    settings = load_settings()
    edited_special = st.data_editor(
        settings.get("special_hours", []),
        num_rows="dynamic",
        hide_index=True,
        width="stretch",
        key="admin_special_hours",
        column_config={
            "date": st.column_config.DateColumn(
                "Datum", min_value=date.today(), format="DD.MM.YYYY"
            ),
            "open": st.column_config.TextColumn(
                "Öffnet",
                help="z. B. 09:00 – leer lassen, wenn geschlossen",
            ),
            "close": st.column_config.TextColumn("Schließt"),
            "note": st.column_config.TextColumn("Hinweis (optional)"),
        },
    )
    if st.button(
        "Sonderöffnungszeiten speichern", type="primary", icon=":material/save:"
    ):
        records = to_records(edited_special)
        for record in records:
            record["date"] = iso_date(record.get("date"))
        settings["special_hours"] = records
        save_settings(settings)

with tab_texts:
    st.subheader("Texte bearbeiten", icon=":material/edit_note:")
    settings = load_settings()
    business = settings["business"]

    st.markdown("**Startseite**")
    hero_title = st.text_input(
        "Startseiten-Titel", value=business.get("hero_title", ""), key="text_hero_title"
    )
    hero_subtitle = st.text_input(
        "Startseiten-Untertitel",
        value=business.get("hero_subtitle", ""),
        key="text_hero_subtitle",
    )
    about_text = st.text_area(
        "Über-uns-Text",
        value=business.get("about_text", ""),
        height=140,
        key="text_about",
    )

    st.space("medium")
    st.markdown("**Internetcafé**")
    cafe = settings["internetcafe"]
    cafe_title = st.text_input(
        "Internetcafé-Titel", value=cafe.get("title", ""), key="text_cafe_title"
    )
    cafe_text = st.text_area(
        "Internetcafé-Text", value=cafe.get("text", ""), key="text_cafe_text"
    )
    cafe_points = st.text_area(
        "Internetcafé-Stichpunkte (eine Zeile pro Punkt)",
        value="\n".join(cafe.get("bullet_points", [])),
        height=100,
        key="text_cafe_points",
    )

    st.space("medium")
    st.markdown("**Reparatur**")
    repair = settings["repair"]
    repair_title = st.text_input(
        "Reparatur-Titel", value=repair.get("title", ""), key="text_repair_title"
    )
    repair_text = st.text_area(
        "Reparatur-Text", value=repair.get("text", ""), key="text_repair_text"
    )
    repair_steps = st.text_area(
        "Reparatur-Ablauf (eine Zeile pro Schritt)",
        value="\n".join(repair.get("steps", [])),
        height=100,
        key="text_repair_steps",
    )

    if st.button("Texte speichern", type="primary", icon=":material/save:"):
        business.update(
            hero_title=hero_title.strip(),
            hero_subtitle=hero_subtitle.strip(),
            about_text=about_text.strip(),
        )
        cafe.update(
            title=cafe_title.strip(),
            text=cafe_text.strip(),
            bullet_points=[
                line.strip() for line in cafe_points.splitlines() if line.strip()
            ],
        )
        repair.update(
            title=repair_title.strip(),
            text=repair_text.strip(),
            steps=[line.strip() for line in repair_steps.splitlines() if line.strip()],
        )
        settings["business"] = business
        settings["internetcafe"] = cafe
        settings["repair"] = repair
        save_settings(settings)

with tab_services:
    st.subheader("Preise & Services", icon=":material/receipt_long:")

    st.markdown("**Internetcafé – Leistungen**")
    settings = load_settings()
    cafe_services = st.data_editor(
        settings["internetcafe"]["services"],
        num_rows="dynamic",
        hide_index=True,
        width="stretch",
        key="admin_cafe_services",
        column_config={
            "name": st.column_config.TextColumn("Leistung", width="medium"),
            "price": st.column_config.TextColumn("Preis", width="medium"),
            "description": st.column_config.TextColumn("Beschreibung"),
        },
    )
    if st.button(
        "Internetcafé-Leistungen speichern", type="primary", icon=":material/save:"
    ):
        settings["internetcafe"]["services"] = to_records(cafe_services)
        save_settings(settings)

    st.space("medium")
    st.markdown("**Reparatur – Leistungen**")
    settings = load_settings()
    repair_services = st.data_editor(
        settings["repair"]["services"],
        num_rows="dynamic",
        hide_index=True,
        width="stretch",
        key="admin_repair_services",
        column_config={
            "name": st.column_config.TextColumn("Leistung", width="medium"),
            "price": st.column_config.TextColumn("Preis", width="medium"),
            "description": st.column_config.TextColumn("Beschreibung"),
        },
    )
    if st.button(
        "Reparatur-Leistungen speichern", type="primary", icon=":material/save:"
    ):
        settings["repair"]["services"] = to_records(repair_services)
        save_settings(settings)

    st.space("medium")
    st.markdown("**Weitere Services (Partner)**")
    st.caption(
        "Zusätzliche Leistungen wie Hermes Paketshop, Ria Money Transfer, "
        "Western Union oder Amazon Paketabgabe. Sie erscheinen als Karten im "
        "Abschnitt „Weitere Services“ auf der Startseite. Symbol = Material-Name "
        "(z. B. local_shipping, currency_exchange, public, package_2)."
    )
    settings = load_settings()
    extra_services = st.data_editor(
        settings.get("extra_services", []),
        num_rows="dynamic",
        hide_index=True,
        width="stretch",
        key="admin_extra_services",
        column_config={
            "icon": st.column_config.TextColumn(
                "Symbol (Material-Name)", width="medium"
            ),
            "name": st.column_config.TextColumn("Leistung", width="medium"),
            "description": st.column_config.TextColumn("Beschreibung"),
        },
    )
    if st.button(
        "Weitere Services speichern", type="primary", icon=":material/save:"
    ):
        settings["extra_services"] = to_records(extra_services)
        save_settings(settings)

with tab_payment:
    st.subheader("Zahlungsarten", icon=":material/payments:")
    st.caption(
        "Diese Zahlungsarten können Kunden beim Online-Kauf auswählen. Unter "
        "„Info“ können Sie je Zahlungsart einen Hinweis eintragen (z. B. "
        "PayPal-Link, Hinweise zur Abholung oder Überweisung)."
    )
    settings = load_settings()
    methods = settings.get("payment_methods", [])
    edited_methods = st.data_editor(
        methods,
        num_rows="dynamic",
        hide_index=True,
        width="stretch",
        key="admin_payments",
        column_config={
            "id": None,
            "label": st.column_config.TextColumn("Bezeichnung", width="medium"),
            "icon": st.column_config.TextColumn(
                "Symbol (Material-Name, z. B. payments, credit_card)",
                width="medium",
            ),
            "enabled": st.column_config.CheckboxColumn("Aktiv"),
            "info": st.column_config.TextColumn("Info für Kunden", width="large"),
        },
    )
    if st.button(
        "Zahlungsarten speichern", type="primary", icon=":material/save:"
    ):
        records = to_records(edited_methods)
        for record in records:
            if not record.get("id"):
                record["id"] = uuid.uuid4().hex
            record.setdefault("label", "")
            record.setdefault("icon", "payments")
            record.setdefault("enabled", True)
            record.setdefault("info", "")
        settings["payment_methods"] = records
        save_settings(settings)
        st.session_state.pop("admin_payments", None)
        st.rerun()

with tab_design:
    st.subheader("Design & Farben", icon=":material/palette:")
    st.caption(
        "Wählen Sie das Aussehen der Website. Die Änderung wird sofort für alle "
        "Besucher übernommen."
    )
    settings = load_settings()
    current_theme = settings.get("theme", DEFAULT_THEME)
    options = theme_options()
    labels = [theme_label(k) for k in options]
    default_index = options.index(current_theme) if current_theme in options else 0
    choice = st.radio(
        "Design auswählen", labels, index=default_index, key="admin_theme"
    )
    chosen_key = options[labels.index(choice)]

    for col, key in zip(st.columns(len(options)), options):
        theme = THEMES[key]
        with col.container(border=True):
            st.markdown(f"**{theme['label']}**")
            swatches = " ".join(
                f"<span style='display:inline-block;width:26px;height:26px;"
                f"border-radius:8px;background:{c};border:1px solid #0002;'></span>"
                for c in theme["swatch"]
            )
            st.html(f"<div style='display:flex;gap:6px'>{swatches}</div>")
    if st.button("Design speichern", type="primary", icon=":material/save:"):
        settings["theme"] = chosen_key
        save_settings(settings)
        st.rerun()

with tab_logo:
    st.subheader("Logo, Titelbild & Ladenbilder", icon=":material/image:")

    st.markdown("**Logo (oben links)**")
    settings = load_settings()
    business = settings["business"]
    current_logo = business.get("logo", "")
    current_path = image_path(current_logo)
    if current_path:
        st.image(current_path, width=180, alt="Aktuelles Logo von Networkcity")

    uploaded_logo = st.file_uploader(
        "Logo hochladen (Transparentes PNG empfohlen)",
        type=["png", "jpg", "jpeg", "webp"],
        key="admin_logo_upload",
    )
    with st.container(horizontal=True):
        if st.button("Logo speichern", type="primary", icon=":material/save:"):
            if uploaded_logo:
                filename = save_uploaded_image(uploaded_logo)
                if current_logo and current_logo != filename:
                    delete_image(current_logo)
                business["logo"] = filename
                settings["business"] = business
                save_settings(settings)
                st.rerun()
            else:
                st.warning("Bitte zuerst ein Logo auswählen.")
        if current_logo and st.button("Logo entfernen", icon=":material/delete:"):
            delete_image(current_logo)
            business["logo"] = ""
            settings["business"] = business
            save_settings(settings)
            st.rerun()

    st.space("medium")
    st.markdown("**Titelbild (großes Bild oben auf der Startseite)**")
    settings = load_settings()
    business = settings["business"]
    hero = business.get("hero_image", "")
    hero_path = image_path(hero)
    if hero_path:
        st.image(hero_path, width="stretch", alt="Aktuelles Titelbild der Startseite")

    uploaded_hero = st.file_uploader(
        "Titelbild hochladen (ein breites Bild, z. B. vom Laden oder Teaser)",
        type=["jpg", "jpeg", "png", "webp"],
        key="admin_hero_upload",
    )
    with st.container(horizontal=True):
        if st.button("Titelbild speichern", type="primary", icon=":material/save:"):
            if uploaded_hero:
                filename = save_uploaded_image(uploaded_hero)
                if hero and hero != filename:
                    delete_image(hero)
                business["hero_image"] = filename
                settings["business"] = business
                save_settings(settings)
                st.rerun()
            else:
                st.warning("Bitte zuerst ein Titelbild auswählen.")
        if hero and st.button("Titelbild entfernen", icon=":material/delete:"):
            delete_image(hero)
            business["hero_image"] = ""
            settings["business"] = business
            save_settings(settings)
            st.rerun()

    st.space("medium")
    st.markdown("**Bilder vom Laden (Galerie auf der Startseite)**")
    settings = load_settings()
    business = settings["business"]
    gallery = business.get("gallery", [])
    if gallery:
        for index, filename in enumerate(gallery):
            path = image_path(filename)
            with st.container(border=True):
                cols = st.columns([4, 1], vertical_alignment="center")
                if path:
                    with cols[0]:
                        st.image(
                            path,
                            width="stretch",
                            alt=f"Galeriebild {index + 1} vom Laden",
                        )
                with cols[1].container(horizontal_alignment="center"):
                    if st.button(
                        "Entfernen",
                        icon=":material/delete:",
                        key=f"gallery_del_{index}",
                    ):
                        delete_image(filename)
                        gallery.pop(index)
                        business["gallery"] = gallery
                        settings["business"] = business
                        save_settings(settings)
                        st.rerun()

    uploaded_gallery = st.file_uploader(
        "Ladenbilder hinzufügen (mehrere auswählbar)",
        type=["jpg", "jpeg", "png", "webp"],
        accept_multiple_files=True,
        key="admin_gallery_upload",
    )
    if st.button(
        "Bilder zur Galerie hinzufügen",
        type="primary",
        icon=":material/add_photo_alternate:",
    ):
        if uploaded_gallery:
            for file in uploaded_gallery:
                gallery.append(save_uploaded_image(file))
            business["gallery"] = gallery
            settings["business"] = business
            save_settings(settings)
            st.rerun()
        else:
            st.warning("Bitte zuerst Bilder auswählen.")