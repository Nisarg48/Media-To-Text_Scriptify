@echo off
setlocal

if not exist .env (
    echo Error: .env file not found. Please copy .env.example to .env and configure MONGODB_URL to point to your Atlas database.
    exit /b 1
)

REM docker compose needs a subcommand: ./start.bat --build -> up --build ; empty -> up ; log -> logs
set "COMPOSE_CMD=%*"
if "%~1"=="" set "COMPOSE_CMD=up"
if /i "%~1"=="--build" set "COMPOSE_CMD=up %*"
if "%~1"=="-d" set "COMPOSE_CMD=up %*"
if /i "%~1"=="log" for /f "tokens=1* delims= " %%a in ("%*") do set "COMPOSE_CMD=logs %%b"

nvidia-smi >nul 2>&1
if %errorlevel% neq 0 goto desktop_or_cpu

docker --context default info 2>nul | findstr /i "nvidia" >nul 2>&1
if %errorlevel% neq 0 goto desktop_or_cpu

echo GPU detected — using host Docker (context: default).
echo Status and logs should be checked in terminal, not Docker Desktop.
docker --context default compose -f docker-compose.yml -f docker-compose.gpu.yml %COMPOSE_CMD%
goto end

:desktop_or_cpu
docker context inspect desktop-linux >nul 2>&1
if %errorlevel% neq 0 goto cpu
echo GPU mode not available — using Docker Desktop (context: desktop-linux) on CPU.
docker --context desktop-linux compose -f docker-compose.yml %COMPOSE_CMD%
goto end

:cpu
echo GPU mode not available — using current Docker context on CPU.
docker compose -f docker-compose.yml %COMPOSE_CMD%

:end
endlocal
