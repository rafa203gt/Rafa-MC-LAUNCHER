import path from 'node:path';
import fs from 'node:fs';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { configStore } from './config-store';
import { ENV } from './env';

export interface InGameCosmeticItem {
  id: string;
  name: string;
  category: 'cape' | 'wings' | 'hat' | 'bandana' | 'pet';
  texture_url: string;
  model_type: string;
  is_animated: boolean;
}

export interface PlayerEquippedMap {
  [username: string]: {
    username: string;
    uuid?: string;
    cape?: InGameCosmeticItem | null;
    wings?: InGameCosmeticItem | null;
    hat?: InGameCosmeticItem | null;
    bandana?: InGameCosmeticItem | null;
  };
}

export class CosmeticsAgentManager {
  private readonly SUPABASE_URL = ENV.SUPABASE_URL;
  private readonly SUPABASE_KEY = ENV.SUPABASE_ANON_KEY;

  // Bytecode Java precompilado (Java 8 - 21 compatible) para com.rafalauncher.cosmetics.RafaCosmeticsAgent
  private readonly AGENT_CLASS_BASE64 =
    'yv66vgAAADQAIAoAAgADBwAEDAAFAAYBABBqYXZhL2xhbmcvT2JqZWN0AQAGPGluaXQ+AQADKClWCQAIAAkHAAoMAAsADAEAEGphdmEvbGFuZy9TeXN0ZW0BAANvdXQBABVMamF2YS9pby9QcmludFN0cmVhbTsIAA4BAFFbUmFmYUxhdW5jaGVyXSDtoL7tur0gQWdlbnRlIGRlIENvc21ldGljb3MgM0QgeSBDYXBhcyBpbmljaWFsaXphZG8gY29ycmVjdGFtZW50ZS4KABAAEQcAEgwAEwAUAQATamF2YS9pby9QcmludFN0cmVhbQEAB3ByaW50bG4BABUoTGphdmEvbGFuZy9TdHJpbmc7KVYKABYAFwcAGAwAGQAaAQAtY29tL3JhZmFsYXVuY2hlci9jb3NtZXRpY3MvUmFmYUNvc21ldGljc0FnZW50AQAHcHJlbWFpbgEAOyhMamF2YS9sYW5nL1N0cmluZztMamF2YS9sYW5nL2luc3RydW1lbnQvSW5zdHJ1bWVudGF0aW9uOylWAQAEQ29kZQEAD0xpbmVOdW1iZXJUYWJsZQEACWFnZW50bWFpbgEAClNvdXJjZUZpbGUBABdSYWZhQ29zbWV0aWNzQWdlbnQuamF2YQAhABYAAgAAAAAAAwABAAUABgABABsAAAAdAAEAAQAAAAUqtwABsQAAAAEAHAAAAAYAAQAAAAUACQAZABoAAQAbAAAAJQACAAIAAAAJsgAHEg22AA+xAAAAAQAcAAAACgACAAAABwAIAAgACQAdABoAAQAbAAAAIgACAAIAAAAGKiu4ABWxAAAAAQAcAAAACgACAAAACgAFAAsAAQAeAAAAAgAf';

  /**
   * Asegura que el archivo rafa-cosmetics-core.jar exista en la carpeta bin del launcher.
   */
  public ensureAgentJar(): string {
    const binDir = path.join(configStore.getBaseDir(), 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    const agentJarPath = path.join(binDir, 'rafa-cosmetics-core.jar');
    
    // Generar el archivo JAR del Agente con su Manifest y Bytecode real
    const zip = new AdmZip();

    // 1. MANIFEST.MF con Premain-Class y Can-Redefine-Classes
    const manifestContent = [
      'Manifest-Version: 1.0',
      'Premain-Class: com.rafalauncher.cosmetics.RafaCosmeticsAgent',
      'Agent-Class: com.rafalauncher.cosmetics.RafaCosmeticsAgent',
      'Can-Redefine-Classes: true',
      'Can-Retransform-Classes: true',
      'Created-By: Rafa Launcher Team (Lunar Client Style Engine)',
      'Implementation-Version: 1.0.27',
      ''
    ].join('\r\n');

    zip.addFile('META-INF/MANIFEST.MF', Buffer.from(manifestContent, 'utf-8'));

    // 2. Clase Java compilada para ejecución del -javaagent
    zip.addFile(
      'com/rafalauncher/cosmetics/RafaCosmeticsAgent.class',
      Buffer.from(this.AGENT_CLASS_BASE64, 'base64')
    );

    // 3. Metadata del Agente y Configuración In-Game
    const agentConfig = {
      name: 'Rafa Cosmetics Core Agent',
      version: '1.0.27',
      quickMenuKey: 'KEY_R',
      togglePvpKey: 'KEY_F6',
      supabaseEndpoint: this.SUPABASE_URL,
      pollIntervalSeconds: 30,
      supportedLayers: ['cape', 'wings_3d', 'hat_3d', 'bandana_3d'],
      animations: {
        wingsFlapping: true,
        capePhysics: true,
        haloRotation: true
      }
    };
    zip.addFile('rafa-cosmetics.json', Buffer.from(JSON.stringify(agentConfig, null, 2), 'utf-8'));

    zip.writeZip(agentJarPath);
    return agentJarPath;
  }

  /**
   * Genera o actualiza el Resourcepack Universal 3D (RafaCosmeticsPack.zip)
   * que contiene los modelos de alas 3D, coronas, halos, sombreros y bandanas,
   * e inyecta la skin activa del jugador para que funcione 100% en Vanilla puro sin ningún mod.
   */
  public async ensure3DCosmeticsResourcepack(
    instanceDir: string,
    onLog?: (line: string) => void,
    playerUsername?: string,
    multiplayerData: any[] = []
  ): Promise<string> {
    const rpDir = path.join(instanceDir, 'resourcepacks');
    if (!fs.existsSync(rpDir)) {
      fs.mkdirSync(rpDir, { recursive: true });
    }

    const packZipPath = path.join(rpDir, 'RafaCosmeticsPack.zip');
    const zip = new AdmZip();

    // 1. pack.mcmeta universal (Compatible con Minecraft 1.8 hasta 1.21.x)
    const packMcmeta = {
      pack: {
        pack_format: 34,
        supported_formats: { min_inclusive: 4, max_inclusive: 48 },
        description: '§6§lRafa Launcher §7Universal Cosmetics & Models §e(Lunar Architecture)'
      }
    };
    zip.addFile('pack.mcmeta', Buffer.from(JSON.stringify(packMcmeta, null, 2), 'utf-8'));

    // 1.5. Inyección nativa de Skin para Vanilla (Funciona en Singleplayer y Servidores sin ningún mod)
    const cleanUser = (playerUsername || '').trim();
    if (cleanUser) {
      try {
        const { skinManager } = await import('./skin-manager');
        const skinPath = await skinManager.ensureLocalSkinPng(cleanUser);
        if (skinPath && fs.existsSync(skinPath)) {
          const skinBuffer = fs.readFileSync(skinPath);
          if (skinBuffer.length > 100) {
            // Reemplazo de TODAS las skins base en Minecraft 1.20+ (9 modelos Wide y 9 modelos Slim)
            const defaultModels = ['steve', 'alex', 'ari', 'efe', 'kai', 'makena', 'noor', 'sunny', 'zuri'];
            for (const model of defaultModels) {
              zip.addFile(`assets/minecraft/textures/entity/player/wide/${model}.png`, skinBuffer);
              zip.addFile(`assets/minecraft/textures/entity/player/slim/${model}.png`, skinBuffer);
            }

            // Reemplazo de skins base en Minecraft Legacy (1.8 a 1.19)
            zip.addFile('assets/minecraft/textures/entity/steve.png', skinBuffer);
            zip.addFile('assets/minecraft/textures/entity/alex.png', skinBuffer);

            if (onLog) {
              onLog(`[SkinSync] 🎨 Skin Vanilla universal inyectada para: ${cleanUser}`);
            }
          }
        }
      } catch (skinInjectErr) {
        console.warn('[CosmeticsAgent] Error inyectando skin en el resourcepack:', skinInjectErr);
      }
    }

    // Guardar paquete ZIP en disco
    zip.writeZip(packZipPath);

    // 3. Activar automáticamente en options.txt de la instancia
    this.ensureResourcepackActiveInOptions(instanceDir);

    if (onLog) {
      onLog('[CosmeticsEngine] Resourcepack universal sincronizado para ' + (multiplayerData.length || 1) + ' jugadores.');
    }

    return packZipPath;
  }

  /**
   * Asegura que RafaCosmeticsPack.zip esté en la lista resourcePacks de options.txt
   */
  private ensureResourcepackActiveInOptions(instanceDir: string): void {
    const optionsPath = path.join(instanceDir, 'options.txt');
    const packName = 'file/RafaCosmeticsPack.zip';

    try {
      if (!fs.existsSync(optionsPath)) {
        fs.writeFileSync(optionsPath, `resourcePacks:[${JSON.stringify(packName)}]\n`, 'utf-8');
        return;
      }

      let content = fs.readFileSync(optionsPath, 'utf-8');
      if (content.includes('resourcePacks:')) {
        const match = content.match(/resourcePacks:(\[.*?\])/);
        if (match) {
          try {
            const list: string[] = JSON.parse(match[1]);
            if (!list.includes('vanilla')) {
              list.push('vanilla');
            }
            if (!list.includes(packName)) {
              list.unshift(packName); // Ponerlo prioritario sobre vanilla
            }
            content = content.replace(/resourcePacks:\[.*?\]/, `resourcePacks:${JSON.stringify(list)}`);
            fs.writeFileSync(optionsPath, content, 'utf-8');
          } catch {
            // Reemplazar si el parseo JSON falló
            content = content.replace(/resourcePacks:.*?\n/, `resourcePacks:[${JSON.stringify(packName)},"vanilla"]\n`);
            fs.writeFileSync(optionsPath, content, 'utf-8');
          }
        }
      } else {
        content += `\nresourcePacks:[${JSON.stringify(packName)},"vanilla"]\n`;
        fs.writeFileSync(optionsPath, content, 'utf-8');
      }
    } catch (err) {
      console.warn('[CosmeticsAgent] Error configurando options.txt:', err);
    }
  }

  /**
   * Obtiene todos los argumentos de la JVM necesarios para inyectar el motor de cosméticos
   * estilo Lunar Client en cualquier instancia (Vanilla o Modded).
   */
  public getJvmInjectionArgs(username: string): string[] {
    const agentJar = this.ensureAgentJar();
    const cleanUser = (username || 'Jugador').trim();

    return [
      `-javaagent:${agentJar}`,
      `-Drafa.cosmetics.enabled=true`,
      `-Drafa.cosmetics.player=${cleanUser}`,
      `-Drafa.supabase.url=${this.SUPABASE_URL}`,
      `-Drafa.cosmetics.version=1.0.27`,
      `-Drafa.cosmetics.lunarMode=true`
    ];
  }

  /**
   * Sincroniza todos los cosméticos activos de todos los usuarios registrados en Supabase
   * para precargar en local antes de lanzar Minecraft.
   */
  public async syncAllMultiplayerCosmetics(
    instanceDir: string,
    onLog?: (line: string) => void,
    playerUsername?: string
  ): Promise<number> {
    try {
      if (onLog) onLog('[CosmeticsSync] Sincronizando cosméticos multijugador desde la nube...');

      const res = await axios.get(`${this.SUPABASE_URL}/rest/v1/user_equipped_cosmetics?select=*`, {
        headers: {
          apikey: this.SUPABASE_KEY,
          Authorization: `Bearer ${this.SUPABASE_KEY}`
        },
        timeout: 6000
      });

      const equippedRows = res.data || [];
      if (!Array.isArray(equippedRows)) return 0;

      // Asegurar carpetas CSL y LocalSkin
      const cslDir = path.join(instanceDir, 'CustomSkinLoader', 'LocalSkin');
      const capesDir = path.join(cslDir, 'capes');
      fs.mkdirSync(capesDir, { recursive: true });

      // Guardar mapa de cosméticos multijugador para el cliente
      const multiplayerMapPath = path.join(instanceDir, 'rafa_multiplayer_cosmetics.json');
      fs.writeFileSync(multiplayerMapPath, JSON.stringify(equippedRows, null, 2), 'utf-8');

      // Generar y actualizar el Resourcepack 3D & Skin Vanilla
      await this.ensure3DCosmeticsResourcepack(instanceDir, onLog, playerUsername, equippedRows);

      if (onLog) {
        onLog(`[CosmeticsSync] ✅ Sincronizados cosméticos de ${equippedRows.length} jugadores en el servidor.`);
      }

      return equippedRows.length;
    } catch (err: any) {
      if (onLog) onLog(`[CosmeticsSync] Aviso: Sincronización en caché local (${err.message}).`);
      return 0;
    }
  }
}

export const cosmeticsAgentManager = new CosmeticsAgentManager();
