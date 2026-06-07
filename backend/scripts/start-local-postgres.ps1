$ErrorActionPreference = "Stop"

$postgresBin = "C:\Program Files\PostgreSQL\18\bin"
$dataDir = Resolve-Path (Join-Path $PSScriptRoot "..\.postgres-data") -ErrorAction SilentlyContinue

if (-not $dataDir) {
  $dataDirPath = Join-Path $PSScriptRoot "..\.postgres-data"
  & (Join-Path $postgresBin "initdb.exe") -D $dataDirPath -U cofre --auth=trust --encoding=UTF8
  $dataDir = Resolve-Path $dataDirPath
}

& (Join-Path $postgresBin "pg_ctl.exe") -D $dataDir -o "-p 5433" -l (Join-Path $dataDir "postgres.log") status *> $null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $postgresBin "pg_ctl.exe") -D $dataDir -o "-p 5433" -l (Join-Path $dataDir "postgres.log") start
}

$exists = & (Join-Path $postgresBin "psql.exe") -p 5433 -U cofre -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'cofre_digital';"
if ($exists.Trim() -ne "1") {
  & (Join-Path $postgresBin "createdb.exe") -p 5433 -U cofre cofre_digital
}

Write-Output "PostgreSQL local pronto em localhost:5433, banco cofre_digital."
