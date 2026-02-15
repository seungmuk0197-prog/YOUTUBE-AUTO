@echo off
echo ==========================================
echo Starting YouTube Auto Dev Environment
echo ==========================================

:: 1. Activate Python Virtual Environment
if not exist ".venv\Scripts\activate.bat" (
    echo [WARNING] Virtual environment not found. Please run 'python -m venv .venv' first.
    pause
    exit /b
)

echo Activating virtual environment...
call .venv\Scripts\activate.bat

:: 2. Start Backend (Flask)
echo Starting Backend (Port 5000)...
start "YouTube Auto Backend" cmd /k "python -m backend.api"

:: 3. Start Frontend (Next.js) — UI는 web-ui 하나만 사용 (포트 3001)
echo Starting Frontend (web-ui, Port 3001)...
cd web-ui
start "YouTube Auto Frontend" cmd /k "npm run dev"

echo ==========================================
echo Development servers started!
echo - Backend: http://localhost:5000/api/health
echo - Frontend (UI): http://localhost:3001
echo   ^^^ 프로젝트 목록/편집은 이 주소만 사용하세요.
echo ==========================================
