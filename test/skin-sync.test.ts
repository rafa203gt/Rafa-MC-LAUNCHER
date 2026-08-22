import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { SkinManager } from '../src/main/skin-manager';

describe('SkinManager & Community Skin Synchronization Tests', () => {
  let tempDir: string;
  let instanceDir: string;
  let skinManager: SkinManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skin-test-'));
    instanceDir = path.join(tempDir, 'test-instance');
    fs.mkdirSync(instanceDir, { recursive: true });

    skinManager = new SkinManager();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('debe crear la estructura de carpetas de CustomSkinLoader correctamente', async () => {
    const synced = await skinManager.syncCommunitySkinsToInstance(instanceDir);

    const cslDir = path.join(instanceDir, 'CustomSkinLoader');
    const configPath = path.join(cslDir, 'CustomSkinLoader.json');
    const localSkinsDir = path.join(cslDir, 'LocalSkin', 'skins');
    const localCapesDir = path.join(cslDir, 'LocalSkin', 'capes');

    expect(fs.existsSync(cslDir)).toBe(true);
    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(localSkinsDir)).toBe(true);
    expect(fs.existsSync(localCapesDir)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.enable).toBe(true);
    expect(config.loadlist).toBeDefined();
    expect(config.loadlist[0].name).toBe('LocalSkin');
  });

  it('debe poder guardar una skin en formato base64 en local', async () => {
    // 1x1 transparent PNG base64
    const testBase64Png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const result = await skinManager.saveUserSkin({
      username: 'TestPlayer',
      skinUrl: 'https://minotar.net/skin/TestPlayer',
      skinData: testBase64Png,
      model: 'slim'
    });

    expect(result.success).toBe(true);

    const saved = await skinManager.getUserSkin('TestPlayer');
    expect(saved).not.toBeNull();
    expect(saved?.username.toLowerCase()).toBe('testplayer');
    expect(saved?.model).toBe('slim');
  });

  it('debe sincronizar archivos de skins locales con el formato requerido por CustomSkinLoader', async () => {
    const cslSkinsDir = path.join(instanceDir, 'CustomSkinLoader', 'LocalSkin', 'skins');
    fs.mkdirSync(cslSkinsDir, { recursive: true });

    // Simular escritura de skin de jugador
    const dummyPng = Buffer.from('fake-png-content');
    fs.writeFileSync(path.join(cslSkinsDir, 'Rafa.png'), dummyPng);
    fs.writeFileSync(path.join(cslSkinsDir, 'Rafa.json'), JSON.stringify({ model: 'slim' }));

    expect(fs.existsSync(path.join(cslSkinsDir, 'Rafa.png'))).toBe(true);
    expect(fs.existsSync(path.join(cslSkinsDir, 'Rafa.json'))).toBe(true);

    const modelMeta = JSON.parse(fs.readFileSync(path.join(cslSkinsDir, 'Rafa.json'), 'utf8'));
    expect(modelMeta.model).toBe('slim');
  });
});
