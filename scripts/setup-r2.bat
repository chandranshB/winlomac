@echo off
REM R2 Setup Script for Racing Game (Windows CMD)
REM This script automates the R2 setup process

echo.
echo Racing Game R2 Setup
echo ========================
echo.

REM Check if wrangler is installed
where wrangler >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Wrangler not found. Installing dependencies...
    cd workers
    call npm install
    cd ..
) else (
    echo [OK] Wrangler found
)

REM Check if logged in
echo.
echo Checking Cloudflare authentication...
npx wrangler whoami >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Please login to Cloudflare:
    npx wrangler login
) else (
    echo [OK] Already logged in
)

REM Upload map
echo.
echo Uploading map to R2...
cd workers
call npm run upload-map
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to upload map
    cd ..
    pause
    exit /b 1
)

REM Deploy worker
echo.
echo Deploying worker...
call npm run deploy
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to deploy worker
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo Next steps:
echo 1. Copy the worker URL from above
echo 2. Create .env file: copy .env.example .env
echo 3. Update VITE_R2_BASE_URL in .env with your worker URL
echo 4. Run: npm run dev
echo.
echo See SETUP_R2.md for more details.
echo.
pause
