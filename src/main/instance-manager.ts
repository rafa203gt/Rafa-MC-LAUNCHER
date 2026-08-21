import path from 'node:path';
import fs from 'node:fs';
import { configStore } from './config-store';

export interface MinecraftInstance {
  id: string;
  name: string;
  description: string;
  minecraftVersion: string;
  modLoader: 'fabric' | 'forge' | 'neoforge' | 'vanilla';
  modLoaderVersion: string;
  modpackManifestUrl: string;
  bannerUrl?: string;
  icon?: string;
  author?: string;
  customRam?: number;
  totalMods?: number;
  isDefault?: boolean;
  isActive?: boolean;
  createdAt: string;
  lastPlayed?: string;
}

export class InstanceManager {
  private instancesFile: string;
  private activeInstanceId: string = 'atm10';
  private cachedInstances: MinecraftInstance[] | null = null;

  constructor() {
    this.instancesFile = path.join(configStore.getBaseDir(), 'instances.json');
    this.init();
  }

  private getDefaultInstances(): MinecraftInstance[] {
    return [
      {
        id: 'atm10',
        name: 'All the Mods 10 (ATM 10)',
        description: 'Modpack insignia con más de 470 mods de magia, tecnología, misiones FTB y dimensiones.',
        minecraftVersion: '1.21.1',
        modLoader: 'neoforge',
        modLoaderVersion: '21.1.247',
        modpackManifestUrl: 'https://raw.githubusercontent.com/rafa203gt/Rafa-MC-LAUNCHER/main/modpack/manifest.json',
        bannerUrl: 'https://media.forgecdn.net/attachments/description/1018698/description_0dc51a80-0a25-412e-836b-7ca4ee79dc07.png',
        icon: 'atom',
        author: 'ATM Team',
        totalMods: 479,
        isDefault: true,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'vanilla-1-21-1',
        name: 'Minecraft Vanilla 1.21.1',
        description: 'Experiencia pura y original de Minecraft 1.21.1 sin modificaciones para rendimiento máximo.',
        minecraftVersion: '1.21.1',
        modLoader: 'vanilla',
        modLoaderVersion: '',
        modpackManifestUrl: '',
        icon: 'box',
        author: 'Mojang Studios',
        totalMods: 0,
        isDefault: false,
        isActive: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'fabric-light',
        name: 'Fabric FPS Boost (1.21.1)',
        description: 'Perfil ligero optimizado con Sodium, Lithium e Iris Shaders para jugar con el máximo rendimiento.',
        minecraftVersion: '1.21.1',
        modLoader: 'fabric',
        modLoaderVersion: '0.16.9',
        modpackManifestUrl: '',
        icon: 'feather',
        author: 'Comunidad',
        totalMods: 15,
        isDefault: false,
        isActive: false,
        createdAt: new Date().toISOString()
      }
    ];
  }

  private init(): void {
    const defaultInstances = this.getDefaultInstances();

    if (!fs.existsSync(this.instancesFile)) {
      fs.writeFileSync(this.instancesFile, JSON.stringify(defaultInstances, null, 2), 'utf-8');
      this.cachedInstances = defaultInstances;
      this.activeInstanceId = 'atm10';
    } else {
      try {
        const raw = fs.readFileSync(this.instancesFile, 'utf-8');
        const list: MinecraftInstance[] = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          this.cachedInstances = list;
          const active = list.find((i) => i.isActive);
          this.activeInstanceId = active ? active.id : list[0].id;
        } else {
          this.cachedInstances = defaultInstances;
        }
      } catch {
        this.cachedInstances = defaultInstances;
      }
    }

    // Ensure directory for active instance
    this.ensureInstanceFolder(this.activeInstanceId);
  }

  public getInstances(): MinecraftInstance[] {
    if (!this.cachedInstances) {
      this.init();
    }
    return this.cachedInstances!.map((inst) => ({
      ...inst,
      isActive: inst.id === this.activeInstanceId
    }));
  }

  public getActiveInstance(): MinecraftInstance {
    const instances = this.getInstances();
    return instances.find((i) => i.id === this.activeInstanceId) || instances[0];
  }

  public getActiveInstanceId(): string {
    return this.activeInstanceId;
  }

  public getInstanceDir(instanceId?: string): string {
    const id = instanceId || this.activeInstanceId || 'default';
    // Backwards compatibility: atm10 maps to default
    const folderName = id === 'atm10' ? 'default' : id;
    const dir = path.join(configStore.getBaseDir(), 'instances', folderName);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public ensureInstanceFolder(instanceId: string): string {
    return this.getInstanceDir(instanceId);
  }

  public setActiveInstance(instanceId: string): MinecraftInstance {
    const instances = this.getInstances();
    const target = instances.find((i) => i.id === instanceId);
    if (!target) {
      throw new Error(`Instancia no encontrada: ${instanceId}`);
    }

    this.activeInstanceId = instanceId;
    this.cachedInstances = instances.map((inst) => ({
      ...inst,
      isActive: inst.id === instanceId
    }));

    this.save();
    this.ensureInstanceFolder(instanceId);

    // Synchronize active instance config to ConfigStore
    configStore.saveSettings({
      minecraftVersion: target.minecraftVersion,
      modLoader: target.modLoader,
      modLoaderVersion: target.modLoaderVersion,
      modpackManifestUrl: target.modpackManifestUrl,
      maxRam: target.customRam || (target.id === 'atm10' ? 6144 : 4096)
    });

    return target;
  }

  public createInstance(data: Partial<MinecraftInstance>): MinecraftInstance {
    const id = (data.id || data.name || 'instance')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-') + '-' + Date.now().toString(36);

    const newInst: MinecraftInstance = {
      id,
      name: data.name || 'Nueva Instancia',
      description: data.description || 'Instancia personalizada de Minecraft.',
      minecraftVersion: data.minecraftVersion || '1.21.1',
      modLoader: data.modLoader || 'neoforge',
      modLoaderVersion: data.modLoaderVersion || '21.1.247',
      modpackManifestUrl: data.modpackManifestUrl || '',
      bannerUrl: data.bannerUrl,
      icon: data.icon || 'box',
      author: data.author || 'Usuario',
      customRam: data.customRam || 4096,
      totalMods: 0,
      isDefault: false,
      isActive: false,
      createdAt: new Date().toISOString()
    };

    const list = this.getInstances();
    list.push(newInst);
    this.cachedInstances = list;
    this.save();
    this.ensureInstanceFolder(id);

    return newInst;
  }

  public deleteInstance(instanceId: string): boolean {
    if (instanceId === 'atm10') {
      throw new Error('No se puede eliminar la instancia principal de All The Mods 10.');
    }

    const list = this.getInstances().filter((i) => i.id !== instanceId);
    this.cachedInstances = list;

    if (this.activeInstanceId === instanceId) {
      this.setActiveInstance('atm10');
    } else {
      this.save();
    }

    // Remove folder
    const dir = path.join(configStore.getBaseDir(), 'instances', instanceId);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`No se pudo eliminar directorio de instancia ${dir}:`, err);
      }
    }

    return true;
  }

  private save(): void {
    if (this.cachedInstances) {
      fs.writeFileSync(this.instancesFile, JSON.stringify(this.cachedInstances, null, 2), 'utf-8');
    }
  }
}

export const instanceManager = new InstanceManager();
