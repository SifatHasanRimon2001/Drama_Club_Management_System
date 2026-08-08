#Requires -Version 5.1
<#
.SYNOPSIS
    One-command launcher for the BRAC University Drama Club Management System (DCMS) —
    Next.js + Socket.IO realtime app (custom server.js).

.DESCRIPTION
    Checks prerequisites, installs dependencies (if missing), generates the
    Prisma client, syncs the database schema, resets the database and seeds a
    CLEAN demo dataset (db:reset), verifies database integrity (verify-db.ts),
    opens the browser and starts the server on http://localhost:3000.

    Recommended invocation (bypasses the execution-policy restriction in a
    single command):

        powershell -NoProfile -ExecutionPolicy Bypass -File .\run-website.ps1

.PARAMETER Prod
    Build + run in production mode (npm run build, then npm start) instead of
    the dev server.

.PARAMETER SkipInstall
    Do not run npm install (assumes node_modules already present).

.PARAMETER SkipDb
    Do not run `prisma db push` (assumes the schema is already applied).

.PARAMETER SkipSeed
    Do not reset + seed the demo data (keeps whatever is currently in the DB).
    Ignored when -FullCheck is also passed — the test suite truncates the DB,
    so a clean re-seed is mandatory afterwards.

.PARAMETER SkipVerify
    Do not run the post-seed database integrity check (verify-db.ts).

.PARAMETER FullCheck
    Before seeding, run `npx tsc --noEmit` and the full unit test suite
    (`npm test`). The test suite truncates the dev database, so a clean
    re-seed (db:reset) always runs afterwards — even with -SkipSeed.

.PARAMETER NoBrowser
    Do not open the browser automatically.

.PARAMETER Port
    Port to run on (default 3000).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\run-website.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\run-website.ps1 -Prod -NoBrowser
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\run-website.ps1 -SkipSeed -SkipDb -SkipInstall
#>
[CmdletBinding()]
param(
    [switch]$Prod,
    [switch]$SkipInstall,
    [switch]$SkipDb,
    [switch]$SkipSeed,
    [switch]$SkipVerify,
    [switch]$FullCheck,
    [switch]$NoBrowser,
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ---- clear the console first, then everything else ----
Clear-Host

# ---- resolve project root (works from any working directory) ----
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    $m" -ForegroundColor Green }
function Warn($m) { Write-Host "!   $m" -ForegroundColor Yellow }

# ---- 1. preflight ----
Step "Preflight"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js not found on PATH — install it from https://nodejs.org"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm not found on PATH"
}
Ok "node $(node --version) / npm $(npm --version)"

# ---- 2. environment (.env) ----
Step "Environment (.env)"
$envFile = Join-Path $Root ".env"
if (-not (Test-Path $envFile)) {
    $exampleFile = Join-Path $Root ".env.example"
    if (Test-Path $exampleFile) {
        Copy-Item $exampleFile $envFile
        Warn ".env was created from .env.example — open it and set DATABASE_URL"
        Warn "  (a reachable Postgres instance is required)."
    } else {
        throw ".env is missing (and there is no .env.example to copy)."
    }
} else {
    Ok ".env present"
}

# ---- 3. install dependencies ----
if (-not $SkipInstall) {
    if (-not (Test-Path (Join-Path $Root "node_modules"))) {
        Step "Installing dependencies (npm install)"
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
        Ok "dependencies installed"
    } else {
        Ok "node_modules present — skipping install (use -SkipInstall)"
    }
}

# ---- 4. prisma client ----
Step "Generating Prisma client"
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate failed." }

# ---- 5. database schema ----
if (-not $SkipDb) {
    Step "Syncing database schema (prisma db push)"
    npx prisma db push
    if ($LASTEXITCODE -ne 0) {
        Warn "prisma db push failed — is DATABASE_URL correct and is Postgres reachable?"
        Warn "Fix .env, or skip this step with -SkipDb if the schema is already applied."
    }
}

# ---- 6. full check (optional): typecheck + unit tests ----
if ($FullCheck) {
    Step "Full check: TypeScript typecheck (npx tsc --noEmit)"
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed (npx tsc --noEmit)." }
    Ok "TypeScript clean"

    Step "Full check: unit tests (npm test)"
    npm test
    if ($LASTEXITCODE -ne 0) { throw "Unit tests failed — see output above." }
    Ok "All unit tests passed"

    # npm test truncates the dev database (unit tests share DATABASE_URL), so a
    # clean re-seed afterwards is mandatory even when -SkipSeed was passed.
    if ($SkipSeed) {
        Warn "-SkipSeed was passed but -FullCheck ran the test suite (which truncates the DB) — re-seeding clean demo data anyway."
    }
}

# ---- 7. clean + seed demo data (db:reset => truncate + seed) ----
# db:reset rebuilds user + content data from scratch while reference data is
# upserted, so every run yields an identical, clean dataset (no stale rows).
if ((-not $SkipSeed) -or $FullCheck) {
    Step "Resetting database + seeding clean demo data (members, events, gallery, applicants, promotions, …)"
    npm run db:reset
    if ($LASTEXITCODE -ne 0) {
        throw "Database reset + seed failed — check DATABASE_URL and that the schema was pushed (or use -SkipSeed)."
    }

    # Integrity gate: fail loudly if the seeded DB is not clean.
    if (-not $SkipVerify) {
        Step "Verifying database integrity (verify-db.ts)"
        $verifyOut = npx tsx scripts/verify-db.ts 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Database integrity check errored (verify-db.ts failed)."
        }
        $verifyText = $verifyOut -join "`n"
        if ($verifyText -match "ORPHANED FK ROWS: NONE" -and $verifyText -match "DEMO ACCOUNTS PRESENT") {
            Ok "Integrity OK — no orphaned rows, demo accounts present"
        } else {
            throw "Database integrity check failed — expected 'ORPHANED FK ROWS: NONE' and 'DEMO ACCOUNTS PRESENT', see output above (or use -SkipVerify)."
        }
    }
}

# ---- 8. port conflict check ----
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listener) {
    Warn "Port $Port is already in use by PID $($listener.OwningProcess)."
    $answer = Read-Host "Stop that process and continue? [Y/n]"
    if ($answer -notmatch '^n') {
        try {
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
            Start-Sleep -Seconds 1
            Ok "stopped PID $($listener.OwningProcess)"
        } catch {
            throw "Could not stop PID $($listener.OwningProcess) (run as Administrator, or use -Port <other>)."
        }
    } else {
        throw "Port $Port is occupied — stop the other server or pass -Port <other>."
    }
}

# ---- 9. open the browser ----
if (-not $NoBrowser) {
    Start-Process "http://localhost:$Port"
    Ok "Opening browser: http://localhost:$Port"
}

# ---- 10. start the server (custom server.js with Socket.IO realtime) ----
Step "Starting DCMS on http://localhost:$Port  (Socket.IO realtime on /socket.io)"
$env:PORT = "$Port"
if ($Prod) {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed." }
    npm start
} else {
    npm run dev
}
