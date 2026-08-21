$dest = "$env:APPDATA\.rafa-mc-launcher\instances\default"
if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

$rarPath = "C:\Users\rafa2\Downloads\All the Mods 10 - ATM10.rar"
$unrar = "C:\Program Files\WinRAR\UnRAR.exe"

Write-Output "Extrayendo All the Mods 10 en $dest..."
& $unrar x -y $rarPath "$dest\"

Write-Output "¡Extracción completada con éxito!"
