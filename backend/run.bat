@echo off
REM Insurance Fraud Detection - Flask Backend Runner
REM Usage: just double-click run.bat or type run.bat in cmd

cd /d "%~dp0"

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate

echo Installing dependencies...
pip install -r requirements.txt --quiet

echo.
echo Starting Flask server on http://localhost:5000
echo Press Ctrl+C to stop
echo.
python app.py

pause