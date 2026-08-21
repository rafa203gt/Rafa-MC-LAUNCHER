$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0"
$libDir = "$cacheDir\darwin\10.12\lib"

if (-not (Test-Path $libDir)) {
    New-Item -ItemType Directory -Path $libDir -Force | Out-Null
}

Set-Content -Path "$libDir\libcrypto.dylib" -Value "dummy"
Set-Content -Path "$libDir\libssl.dylib" -Value "dummy"

Write-Output "winCodeSign cache prepared!"
