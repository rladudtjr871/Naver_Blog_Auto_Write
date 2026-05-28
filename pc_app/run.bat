@echo off
title Naver Blog Auto-Write Daemon
echo ==================================================
echo   Naver Blog Auto-Write Local Daemon Controller
echo ==================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not added to your system PATH.
    echo Please install Python 3.8+ and check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [INFO] Installing required dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo [WARNING] Dependency installation failed. Trying user mode...
    pip install --user -r requirements.txt
)

echo.
echo [INFO] Starting local daemon on http://localhost:5000 ...
python local_server.py
pause
