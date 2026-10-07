@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\streamlit.exe" (
    echo Streamlit wird eingerichtet ...
    python -m venv .venv
    ".venv\Scripts\pip" install -r requirements.txt
)
echo Netz werk ist als Networkcity-Website gestartet.
".venv\Scripts\streamlit" run streamlit_app.py
pause