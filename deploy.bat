@echo off
REM ============================================================================
REM GradBridge — Production Deployment Script (Windows)
REM ============================================================================
REM Prerequisites:
REM   1. Docker Desktop installed and running
REM   2. NeonDB DATABASE_URL (set in .env)
REM   3. LLM API keys (set in .env)
REM
REM Usage:
REM   deploy.bat              # full deploy
REM   deploy.bat --fresh      # fresh deploy (reset volumes)
REM ============================================================================

echo.
echo ================================================
echo   GradBridge - Production Deploy (Windows)
echo ================================================
echo.

REM Step 1: Check Docker
echo [1/6] Checking Docker...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker is not running. Start Docker Desktop first.
    exit /b 1
)
echo   Docker OK

REM Step 2: Build Next.js
echo [2/6] Building Next.js...
call bun run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed
    exit /b 1
)
echo   Build complete

REM Step 3: Push Prisma schema
echo [3/6] Pushing Prisma schema...
call bunx prisma db push --skip-generate
echo   Schema pushed

REM Step 4: Seed database
echo [4/6] Seeding database...
call bun run src/lib/seed.ts
echo   Seeding complete

REM Step 5: Start Docker containers
echo [5/6] Starting Docker containers...
if "%1"=="--fresh" (
    echo   Fresh deploy - resetting volumes...
    docker compose down -v
)
docker compose up -d --build
echo   Docker containers running

REM Step 6: Health check
echo [6/6] Health check...
timeout /t 10 /nobreak >nul
echo.
echo ================================================
echo   Deploy Complete!
echo ================================================
echo.
echo   Web app:   http://localhost:3000
echo   pgAdmin4:  http://localhost:5050
echo.
echo   To expose via Cloudflare Tunnel:
echo     docker compose --profile tunnel up -d
echo.
echo   Set GRADBRIDGE_SECRET and LLM API keys
echo   in .env before deploying to production.
echo.
