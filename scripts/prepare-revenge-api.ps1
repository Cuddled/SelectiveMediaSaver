param(
    [string]$Checkout = (Join-Path $PSScriptRoot '..\.deps\revenge-xposed')
)

$ErrorActionPreference = 'Stop'
$revengeXposedSha = '9a1426d0a3df000beb4174d0071d4d80e8be42fc'

if (-not (Test-Path -LiteralPath (Join-Path $Checkout '.git'))) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Checkout) | Out-Null
    git init --quiet $Checkout
    git -C $Checkout remote add origin https://github.com/revenge-mod/revenge-xposed.git
}

git -C $Checkout fetch --quiet --depth 1 origin $revengeXposedSha
git -C $Checkout checkout --quiet --detach FETCH_HEAD
$resolved = (git -C $Checkout rev-parse HEAD).Trim()
if ($resolved -ne $revengeXposedSha) {
    throw "Unexpected RevengeXposed revision: $resolved"
}

& (Join-Path $Checkout 'gradlew.bat') -p $Checkout --no-daemon :api:publishToMavenLocal
if ($LASTEXITCODE -ne 0) {
    throw 'Publishing the Revenge native API failed.'
}

Write-Host "Published io.github.revenge:api:1.0.0 from $revengeXposedSha."
