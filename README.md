# 🚀 Rafa-MC-LAUNCHER (Minecraft 1.20.1)

Launcher personalizado de Minecraft para la comunidad del servidor, diseñado para usuarios **No-Premium** (y Premium), con **auto-instalación de Java 17**, **sincronización diferencial de mods/configs** y **conexión directa en 1 clic**.

---

## ✨ Características Principales

- 🎮 **Minecraft 1.20.1 (Fabric / Forge / NeoForge):** Descarga automática de assets oficiales, dependencias y librerías nativas desde los servidores de Mojang.
- ☕ **Gestión Automática de Java 17:** Descarga e instala en segundo plano **OpenJDK 17 (Adoptium Eclipse Temurin)** en un directorio aislado (`%APPDATA%/.rafa-mc-launcher/runtime`), para que los jugadores no tengan que instalar Java manualmente.
- 👤 **Acceso No-Premium:** Permite ingresar cualquier apodo/nickname directamente, generando un UUID offline válido con avatar en tiempo real.
- ⚡ **Auto-Conexión Directa:** Al pulsar "JUGAR", Minecraft arranca y se conecta automáticamente a la IP y puerto del servidor (`--quickPlayMultiplayer`).
- 📦 **Sincronización Diferencial con GitHub Releases:**
  - Consulta el archivo `manifest.json`.
  - Calcula hashes SHA1 para descargar solo los mods nuevos o actualizados.
  - Elimina automáticamente mods obsoletos o desactualizados.
- 📡 **Monitor de Estado del Servidor en Vivo:** Muestra jugadores conectados, ping/latencia y el MOTD en tiempo real.
- 🛠️ **Panel de Ajustes Completo:** Slider interactivo de asignación de memoria RAM (2 GB a 16 GB), resolución de pantalla, pantalla completa y consola de logs en vivo.

---

## 🛠️ Requisitos Previos

- [Node.js 18+](https://nodejs.org/)
- npm / yarn / pnpm

---

## 🚀 Instalación y Desarrollo

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Ejecutar en modo desarrollo:**
   ```bash
   npm run dev
   ```

3. **Compilar instalador y ejecutable portable para Windows (.exe):**
   ```bash
   npm run build:win
   ```
   *El ejecutable generado se guardará en la carpeta `release/` listo para distribuir.*

---

## 📦 Cómo Actualizar el Modpack del Servidor

1. Coloca los nuevos archivos `.jar` en la carpeta `modpack/mods/` y las configs en `modpack/config/`.
2. Ejecuta el generador de manifiesto:
   ```bash
   npm run pack-builder
   ```
3. Sube los archivos `.jar` a una Release en tu repositorio de GitHub (por ejemplo tag `v1.0.0`).
4. Haz `git commit` y `git push` de `modpack/manifest.json`.
5. ¡Listo! Cuando los jugadores abran el launcher, sus clientes se sincronizarán automáticamente.

---

## ⚙️ Configuración del Servidor (`default-config.json`)

Edita `default-config.json` para cambiar la IP o versión por defecto:

```json
{
  "serverName": "Rafa Server",
  "serverIp": "play.tuserver.com",
  "serverPort": 25565,
  "autoConnect": true,
  "minecraftVersion": "1.20.1",
  "modLoader": "fabric",
  "modLoaderVersion": "0.15.11",
  "modpackManifestUrl": "https://raw.githubusercontent.com/rafa203gt/Rafa-MC-LAUNCHER/main/modpack/manifest.json"
}
```

---

## 📄 Licencia

MIT © [rafa203gt](https://github.com/rafa203gt)
