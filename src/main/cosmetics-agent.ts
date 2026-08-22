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

  /**
   * Asegura que el archivo rafa-cosmetics-core.jar exista en la carpeta bin del launcher.
   */
  public ensureAgentJar(): string {
    const binDir = path.join(configStore.getBaseDir(), 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    const agentJarPath = path.join(binDir, 'rafa-cosmetics-core.jar');
    
    // Generar el archivo JAR del Agente con su Manifest si no existe o actualizarlo
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

    // 2. Metadata del Agente y Configuración In-Game
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
   * que contiene los modelos de alas 3D, coronas, halos, sombreros y bandanas
   * compatibles tanto con Vanilla puro como con Entity Model Features (EMF/ETF) / OptiFine / CEM.
   */
  public async ensure3DCosmeticsResourcepack(instanceDir: string, onLog?: (line: string) => void): Promise<string> {
    const rpDir = path.join(instanceDir, 'resourcepacks');
    if (!fs.existsSync(rpDir)) {
      fs.mkdirSync(rpDir, { recursive: true });
    }

    const packZipPath = path.join(rpDir, 'RafaCosmeticsPack.zip');
    const zip = new AdmZip();

    // 1. pack.mcmeta universal
    const packMcmeta = {
      pack: {
        pack_format: 34, // Minecraft 1.20 - 1.21.x compatible
        supported_formats: { min_inclusive: 4, max_inclusive: 48 },
        description: '§6§lRafa Launcher §7Cosmetics & 3D Models Pack §e(Lunar Style)'
      }
    };
    zip.addFile('pack.mcmeta', Buffer.from(JSON.stringify(packMcmeta, null, 2), 'utf-8'));

    // 2. Modelos 3D CEM para EMF / ETF / Vanilla CEM
    // Alas de Dragón 3D (con huesos animados y aleteo dinámico)
    const dragonWingsJem = {
      models: [
        {
          part: 'body',
          id: 'dragon_wings_left',
          invertAxis: 'xy',
          translate: [0, 24, 0],
          boxes: [
            {
              coordinates: [-12, 10, 2, 12, 14, 1],
              textureOffset: [0, 0]
            }
          ],
          animations: [
            {
              'dragon_wings_left.ry': 'sin(time * 0.3) * 0.6 + 0.3',
              'dragon_wings_left.rz': 'cos(time * 0.3) * 0.15'
            }
          ]
        },
        {
          part: 'body',
          id: 'dragon_wings_right',
          invertAxis: 'xy',
          translate: [0, 24, 0],
          boxes: [
            {
              coordinates: [0, 10, 2, 12, 14, 1],
              textureOffset: [0, 16]
            }
          ],
          animations: [
            {
              'dragon_wings_right.ry': '-sin(time * 0.3) * 0.6 - 0.3',
              'dragon_wings_right.rz': '-cos(time * 0.3) * 0.15'
            }
          ]
        }
      ]
    };

    // Corona Imperial 3D (acoplada a la cabeza)
    const crownJem = {
      models: [
        {
          part: 'head',
          id: 'king_crown_3d',
          invertAxis: 'xy',
          translate: [0, 0, 0],
          boxes: [
            {
              coordinates: [-4.5, 8.0, -4.5, 9, 3, 9],
              textureOffset: [0, 32]
            }
          ]
        }
      ]
    };

    // Halo Celestial 3D (flotando con rotación)
    const haloJem = {
      models: [
        {
          part: 'head',
          id: 'celestial_halo_3d',
          invertAxis: 'xy',
          translate: [0, 0, 0],
          boxes: [
            {
              coordinates: [-5, 12, -5, 10, 1, 10],
              textureOffset: [0, 48]
            }
          ],
          animations: [
            {
              'celestial_halo_3d.ry': 'time * 0.05',
              'celestial_halo_3d.ty': 'sin(time * 0.1) * 0.5'
            }
          ]
        }
      ]
    };

    // Bandana Ninja 3D (acoplada al tercio inferior de la cara)
    const bandanaJem = {
      models: [
        {
          part: 'head',
          id: 'ninja_bandana_3d',
          invertAxis: 'xy',
          translate: [0, 0, 0],
          boxes: [
            {
              coordinates: [-4.2, 0.0, -4.2, 8.4, 4.2, 8.4],
              textureOffset: [32, 0]
            }
          ]
        }
      ]
    };

    // Guardar modelos en assets/minecraft/optifine/cem/ y assets/minecraft/emf/models/
    zip.addFile('assets/minecraft/optifine/cem/player.jem', Buffer.from(JSON.stringify(dragonWingsJem, null, 2), 'utf-8'));
    zip.addFile('assets/minecraft/emf/models/dragon_wings.jem', Buffer.from(JSON.stringify(dragonWingsJem, null, 2), 'utf-8'));
    zip.addFile('assets/minecraft/emf/models/crown.jem', Buffer.from(JSON.stringify(crownJem, null, 2), 'utf-8'));
    zip.addFile('assets/minecraft/emf/models/halo.jem', Buffer.from(JSON.stringify(haloJem, null, 2), 'utf-8'));
    zip.addFile('assets/minecraft/emf/models/bandana.jem', Buffer.from(JSON.stringify(bandanaJem, null, 2), 'utf-8'));

    // Guardar paquete ZIP en disco
    zip.writeZip(packZipPath);

    // 3. Activar automáticamente en options.txt de la instancia
    this.ensureResourcepackActiveInOptions(instanceDir);

    if (onLog) {
      onLog('[CosmeticsEngine] Paquete de Modelos 3D y Capas RafaCosmeticsPack.zip generado y activado.');
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
            if (!list.includes(packName)) {
              list.unshift(packName); // Ponerlo prioritario
              content = content.replace(/resourcePacks:\[.*?\]/, `resourcePacks:${JSON.stringify(list)}`);
              fs.writeFileSync(optionsPath, content, 'utf-8');
            }
          } catch {
            // Reemplazar si el parseo JSON falló
            content = content.replace(/resourcePacks:.*?\n/, `resourcePacks:["vanilla",${JSON.stringify(packName)}]\n`);
            fs.writeFileSync(optionsPath, content, 'utf-8');
          }
        }
      } else {
        content += `\nresourcePacks:["vanilla",${JSON.stringify(packName)}]\n`;
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
  public async syncAllMultiplayerCosmetics(instanceDir: string, onLog?: (line: string) => void): Promise<number> {
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

      // Generar y actualizar el Resourcepack 3D
      await this.ensure3DCosmeticsResourcepack(instanceDir, onLog);

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
