import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigStore } from '../src/main/config-store';
import fs from 'fs';
import path from 'path';

describe('ConfigStore Unit Tests', () => {
  let store: ConfigStore;

  beforeEach(() => {
    store = new ConfigStore();
  });

  it('debe inicializar las rutas de aislamiento correctamente', () => {
    const baseDir = store.getBaseDir();
    const instanceDir = store.getInstanceDir();
    const runtimeDir = store.getRuntimeDir();

    expect(baseDir).toContain('.rafa-mc-launcher');
    expect(instanceDir).toContain('instances');
    expect(runtimeDir).toContain('runtime');
    expect(fs.existsSync(baseDir)).toBe(true);
    expect(fs.existsSync(instanceDir)).toBe(true);
    expect(fs.existsSync(runtimeDir)).toBe(true);
  });

  it('debe devolver la configuración por defecto válida para Minecraft 1.20.1', () => {
    const settings = store.getSettings();

    expect(settings.minecraftVersion).toBeDefined();
    expect(typeof settings.minecraftVersion).toBe('string');
    expect(settings.minRam).toBeGreaterThanOrEqual(1024);
    expect(settings.maxRam).toBeGreaterThanOrEqual(2048);
    expect(settings.autoJava).toBe(true);
    expect(settings.autoConnect).toBe(false);
  });

  it('debe guardar y persistir cambios de configuración', () => {
    const updated = store.saveSettings({
      username: 'TesterPlayer',
      maxRam: 6144
    });

    expect(updated.username).toBe('TesterPlayer');
    expect(updated.maxRam).toBe(6144);

    const reloaded = store.getSettings();
    expect(reloaded.username).toBe('TesterPlayer');
    expect(reloaded.maxRam).toBe(6144);
  });
});
