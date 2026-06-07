$ErrorActionPreference = "Stop"

$postgresBin = "C:\Program Files\PostgreSQL\18\bin"
$dataDirPath = Join-Path $PSScriptRoot "..\.postgres-data"

if (Test-Path $dataDirPath) {
  & (Join-Path $postgresBin "pg_ctl.exe") -D $dataDirPath stop
}
