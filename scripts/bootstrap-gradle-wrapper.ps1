$ErrorActionPreference = 'Stop'

$templateSha = 'd47f792150f4dcc4f47aace6227f8b8c52aa84de'
$base = "https://raw.githubusercontent.com/revenge-mod/revenge-plugin-template/$templateSha"
$wrapperDir = Join-Path $PSScriptRoot '..\gradle\wrapper'
$wrapperPath = Join-Path $wrapperDir 'gradle-wrapper.jar'

New-Item -ItemType Directory -Force -Path $wrapperDir | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri "$base/gradle/wrapper/gradle-wrapper.jar" -OutFile $wrapperPath

$expected = '498495120a03b9a6ab5d155f5de3c8f0d986a449153702fb80fc80e134484f17'
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $wrapperPath).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
    throw "Gradle wrapper JAR checksum mismatch: $actual"
}

Write-Host "Gradle wrapper ready ($templateSha)."
