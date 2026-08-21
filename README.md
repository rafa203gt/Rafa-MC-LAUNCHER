# 🎮 Rafa-MC-LAUNCHER (Minecraft 1.21.1 & All The Mods 10)

<div align="center">

![GitHub release (latest by date)](https://img.shields.io/github/v/release/rafa203gt/Rafa-MC-LAUNCHER?color=10b981&label=Release&style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-29.4-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)

**Launcher personalizado de Minecraft de alto rendimiento para All The Mods 10 (ATM 10) e Instancias Vanilla de cualquier versión.**  
Diseñado para jugadores **No-Premium y Premium**, con **auto-instalación de Java 21/17/8**, **descargas aceleradas en 16 hilos**, **auto-actualizaciones en caliente**, **flags anti-lag G1GC** y **conexión directa en 1 clic**.

[📥 Descargar Última Versión (GitHub Releases)](https://github.com/rafa203gt/Rafa-MC-LAUNCHER/releases/latest) • [✨ Características](#-características-principales) • [🚀 Instalación](#-instalación-y-desarrollo) • [📦 Gestión de Modpacks](#-gestión-y-publicación-de-mods)

---

</div>

## ✨ Características Principales

### 🌌 Modpack Insignia: All The Mods 10 (ATM 10)
- **Minecraft 1.21.1 + NeoForge 21.1.247:** Configurado de fábrica con más de 470 mods de magia, tecnología, misiones FTB Quests y nuevas dimensiones.
- **Sincronización Inteligente Diferencial:** Descarga el bundle completo en segundos durante la primera instalación y sincroniza mods sueltos de forma incremental mediante hashes SHA1.
- **Botón de Reinstalación Limpia:** Permite reparar cualquier mod corrupto o faltante con 1 clic preservando intactos tus mundos guardados.

### ⛏️ Instancias Vanilla Dinámicas Multi-Versión
- **Selector Universal de Versiones Oficiales:** Crea perfiles Vanilla para **cualquier versión oficial de Mojang** (`1.21.4`, `1.21.3`, `1.21.1`, `1.20.6`, `1.20.1`, `1.19.4`, `1.18.2`, `1.16.5`, `1.12.2`, `1.8.9`, `1.7.10` o versiones personalizadas).
- **Descarga 100% Automatizada:** Descarga el cliente base oficial, librerías nativas (LWJGL) y assets de sonido y texturas directamente desde los servidores de Mojang.

### ⚡ Motor de Descargas Turbo (16 Hilos Paralelos)
- **Multi-Segmentos HTTP Range:** Descargas divididas en **16 fragmentos simultáneos** para paquetes pesados (Modpack bundle, Java OpenJDK, cliente de juego y actualizaciones).
- **Piscina Concurrente de 64 Conexiones:** Para la sincronización ultrarrápida de librerías y mods sueltos.
- **Optimización de Red TCP:** Forzado de IPv4 (`family: 4`) y `noDelay: true` para latencia cero y buffers de disco de **4 MB**.
- **Temporizadores Suaves EMA:** Cálculo preciso de velocidad (`MB/s`) y tiempo restante (`ETA`) mediante Media Móvil Exponencial (Rolling Window de 1.5s).

### 🔄 Auto-Actualizador In-App Hot-Swap
- **Actualizaciones Desatendidas:** Al publicar una nueva versión en GitHub, el launcher avisa con un banner en 1 clic.
- **Detección Real de Rutas Portables (`PORTABLE_EXECUTABLE_FILE`):** Sustituye automáticamente el archivo `.exe` en la carpeta de Descargas/Escritorio del usuario y reinicia el programa en la nueva versión de forma 100% invisible.

### 🛡️ Optimización de Rendimiento & Anti-Lag (G1GC)
- **Flags de Garbage Collection de Latencia Ultra-Baja:** Parámetros JVM profesionales (`-XX:MaxGCPauseMillis=100`, `-XX:+AlwaysPreTouch`, `-XX:+DisableExplicitGC`) para eliminar micro-tirones y congelamientos de FPS.
- **Protección Dinámica de Memoria RAM:** Detecta la RAM física del equipo y reserva siempre un mínimo de **1.5 GB libres para Windows**, evitando caídas con `OutOfMemoryError` o bloqueos del PC.

### 🎨 Dashboard Hero & Hub de Herramientas Rápidas
- **Hero Launch Station:** Selector desplegable de perfiles activos, control deslizante de RAM y botón masivo *"JUGAR AHORA"*.
- **Avatar 3D Dinámico:** Muestra la cabeza de tu skin de Minecraft en tiempo real según el apodo que introduzcas.
- **Quick Tools Bar:** Accesos directos para abrir en 1 clic:
  - 📁 **Carpeta Juego** (`.minecraft` / instancia)
  - 📸 **Capturas de Pantalla** (`screenshots`)
  - 🗺️ **Mundos Guardados** (`saves` para copias de seguridad)
  - 📦 **Carpeta de Mods** (`mods`)
  - 📜 **Registros y Consola** (`logs`)
- **Banner de Servidor:** Copia de IP en 1 clic con confirmación visual y medidor de calidad de ping (🟢 `< 60ms`, 🟡 `< 120ms`, 🔴 `> 120ms`).

---

## 🛠️ Requisitos del Sistema

- **Sistema Operativo:** Windows 10 / Windows 11 (64-bit).
- **Memoria RAM:** 8 GB mínimo (16 GB recomendado para All The Mods 10).
- **Java:** **No es necesario instalar Java.** El launcher descarga automáticamente la versión correcta (Adoptium OpenJDK 21, 17 u 8) en un directorio aislado (`%APPDATA%/.rafa-mc-launcher/runtime`).

---

## 🚀 Instalación y Desarrollo

### Requisitos de Desarrollo
- [Node.js 18+](https://nodejs.org/)
- Git

### 1. Clonar el repositorio:
```bash
git clone https://github.com/rafa203gt/Rafa-MC-LAUNCHER.git
cd Rafa-MC-LAUNCHER
```

### 2. Instalar dependencias:
```bash
npm install
```

### 3. Ejecutar en modo desarrollo:
```bash
npm run dev
```

### 4. Ejecutar pruebas unitarias:
```bash
npm test
```

### 5. Compilar binarios de Windows (Portable e Instalador):
```bash
npm run build:win
```
*Los archivos `.exe` se generarán en la carpeta `release/`.*

---

## 📦 Gestión y Publicación de Mods

El launcher incluye scripts automatizados para gestionar modpacks y lanzar actualizaciones:

### 1. Sincronizar un solo mod nuevo o actualizado:
```bash
npm run sync-mod
```

### 2. Generar el manifiesto del modpack:
```bash
npm run pack-builder
```

### 3. Publicar el modpack completo en GitHub:
```bash
npm run publish-pack
```

### 4. Compilar y publicar una nueva versión del Launcher (GitHub Release):
```bash
npm run release:app
```

---

## ⚙️ Configuración del Servidor (`default-config.json`)

Puedes personalizar la configuración predeterminada del launcher editando [`default-config.json`](file:///C:/Users/rafa2/Downloads/rafa-mc-launcher/default-config.json):

```json
{
  "serverName": "All the Mods 10 (ATM10)",
  "serverIp": "play.tuserver.com",
  "serverPort": 25565,
  "autoConnect": false,
  "minecraftVersion": "1.21.1",
  "modLoader": "neoforge",
  "modLoaderVersion": "21.1.247",
  "modpackManifestUrl": "https://raw.githubusercontent.com/rafa203gt/Rafa-MC-LAUNCHER/main/modpack/manifest.json",
  "newsFeedUrl": "https://raw.githubusercontent.com/rafa203gt/Rafa-MC-LAUNCHER/main/news.json",
  "client": {
    "minRam": 4096,
    "maxRam": 8192,
    "fullscreen": false,
    "width": 1280,
    "height": 720
  }
}
```

---

## 🏗️ Estructura del Proyecto

```text
rafa-mc-launcher/
├── src/
│   ├── main/                  # Proceso Principal de Electron
│   │   ├── main.ts            # Punto de entrada, ventanas y eventos IPC
│   │   ├── launcher.ts        # Motor de inicio de Minecraft y flags JVM
│   │   ├── mod-sync.ts        # Sincronizador multi-hilo de mods y bundles
│   │   ├── java-manager.ts    # Gestor y descargador de Adoptium OpenJDK
│   │   ├── instance-manager.ts# Gestor de instancias y perfiles aislados
│   │   ├── app-updater.ts     # Auto-actualizador in-app hot-swap
│   │   ├── progress-tracker.ts# Estimador suave de velocidad y tiempo (EMA)
│   │   └── config-store.ts    # Almacenamiento persistente de ajustes
│   ├── renderer/              # Interfaz de Usuario (React + TailwindCSS)
│   │   ├── App.tsx            # Vista principal y orquestador de pestañas
│   │   ├── components/        # Componentes UI (Dashboard, Modal, Tools, etc.)
│   │   └── assets/            # Logos e imágenes empaquetadas (ATM10 logo)
├── scripts/                   # Scripts de publicación y empaquetado
├── modpack/                   # Manifiesto y archivos locales del modpack
└── release/                   # Ejecutables compilados para Windows (.exe)
```

---

---

## ⚖️ Aviso Legal y Descargo de Responsabilidad (Copyright & Trademarks)

> **⚠️ NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**  
> **⚠️ NO ES UN PRODUCTO OFICIAL DE MINECRAFT. NO ESTÁ APROBADO NI ASOCIADO CON MOJANG STUDIOS NI MICROSOFT.**

- **Minecraft** es una marca comercial y propiedad registrada de **Mojang Synergies AB / Microsoft Corporation**.
- Este software es un lanzador cliente independiente desarrollado por la comunidad bajo licencia de código abierto con fines educativos y de conectividad para servidores privados.
- Este lanzador **no distribuye ni aloja contenido protegido por derechos de autor**, binarios propietarios de Minecraft ni assets comerciales en su código fuente. Todas las librerías oficiales de Mojang, texturas, sonidos y runtimes de Java se descargan en tiempo de ejecución de manera legal directamente desde las APIs y servidores oficiales de distribución de Mojang Studios y Eclipse Adoptium.
- Todos los nombres de modpacks, mods, marcas comerciales y logotipos mencionados en este proyecto pertenecen a sus respectivos autores y creadores.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT** — consulta el archivo [LICENSE](LICENSE) para más detalles.

Desarrollado con ❤️ por [rafa203gt](https://github.com/rafa203gt).
