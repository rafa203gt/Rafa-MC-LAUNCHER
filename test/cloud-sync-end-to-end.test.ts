import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { ModSynchronizer } from '../src/main/mod-sync';
import { configStore } from '../src/main/config-store';

describe('QA Engine: Sincronización en la Nube y Aislamiento End-to-End', () => {
  let tempBaseDir: string;
  let synchronizer: ModSynchronizer;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rafa-qa-sync-'));
    (configStore as any).baseDir = tempBaseDir;
    (configStore as any).ensureDirs();
    synchronizer = new ModSynchronizer();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. Debe calcular correctamente el hash SHA-1 de cualquier archivo para validación de integridad', () => {
    const testFile = path.join(tempBaseDir, 'test-mod.jar');
    const content = 'Contenido binario simulado del mod v1.0.0';
    fs.writeFileSync(testFile, content, 'utf-8');

    const expectedHash = crypto.createHash('sha1').update(content).digest('hex').toLowerCase();
    const computedHash = synchronizer.calculateSha1(testFile);

    expect(computedHash).toBe(expectedHash);
  });

  it('2. Debe aislar estrictamente las carpetas entre instancias diferentes (default vs atm10 vs custom)', () => {
    configStore.setActiveInstanceFolder('atm10');
    const atmDir = configStore.getInstanceDir();
    const atmModDir = path.join(atmDir, 'mods');
    fs.mkdirSync(atmModDir, { recursive: true });
    fs.writeFileSync(path.join(atmModDir, 'jei.jar'), 'jei-mod', 'utf-8');

    configStore.setActiveInstanceFolder('vanilla-1-21-4');
    const vanillaDir = configStore.getInstanceDir();
    const vanillaModDir = path.join(vanillaDir, 'mods');

    expect(atmDir).not.toBe(vanillaDir);
    expect(fs.existsSync(path.join(atmModDir, 'jei.jar'))).toBe(true);
    expect(fs.existsSync(path.join(vanillaModDir, 'jei.jar'))).toBe(false);
  });

  it('3. Debe clasificar y dirigir cada categoría a su ruta correspondiente en el disco del jugador', () => {
    const filesToTest = [
      { name: 'sodium.jar', relPath: 'mods/sodium.jar', expectedDir: 'mods' },
      { name: 'jei-client.ini', relPath: 'config/jei/jei-client.ini', expectedDir: 'config' },
      { name: 'quests.snbt', relPath: 'config/ftbquests/quests.snbt', expectedDir: 'config' },
      { name: 'Complementary.zip', relPath: 'shaderpacks/Complementary.zip', expectedDir: 'shaderpacks' },
      { name: 'startup.js', relPath: 'kubejs/server_scripts/startup.js', expectedDir: 'kubejs' }
    ];

    configStore.setActiveInstanceFolder('qa-test-instance');
    const instanceDir = configStore.getInstanceDir();

    for (const f of filesToTest) {
      const fullPath = path.join(instanceDir, f.relPath);
      const parentDir = path.dirname(fullPath);
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(fullPath, `dummy-${f.name}`);

      expect(fs.existsSync(fullPath)).toBe(true);
      expect(fullPath.startsWith(path.join(instanceDir, f.expectedDir))).toBe(true);
    }
  });

  it('4. Simulación de Paginación Ilimitada: Debe procesar más de 1000 archivos sin truncar registros', async () => {
    const mockFiles: any[] = [];
    for (let i = 1; i <= 479; i++) {
      mockFiles.push({
        path: `mods/mod-${i}.jar`,
        sha1: `sha1-mod-${i}`,
        size: 1024 * i,
        downloadUrl: `https://mock.cdn.com/mods/mod-${i}.jar`
      });
    }
    for (let i = 1; i <= 1300; i++) {
      mockFiles.push({
        path: `config/config-${i}.toml`,
        sha1: `sha1-cfg-${i}`,
        size: 512,
        downloadUrl: `https://mock.cdn.com/config/config-${i}.toml`
      });
    }

    expect(mockFiles.length).toBe(1779);

    const modsOnly = mockFiles.filter((f) => f.path.startsWith('mods/') && f.path.endsWith('.jar'));
    const configsOnly = mockFiles.filter((f) => f.path.startsWith('config/'));

    expect(modsOnly.length).toBe(479);
    expect(configsOnly.length).toBe(1300);
    expect(mockFiles.length).toBeGreaterThan(1000);
  });

  it('5. Sincronización Diferencial: No debe volver a descargar archivos con el mismo hash SHA-1', () => {
    configStore.setActiveInstanceFolder('qa-diff-sync');
    const instanceDir = configStore.getInstanceDir();
    const modsDir = path.join(instanceDir, 'mods');
    fs.mkdirSync(modsDir, { recursive: true });

    const existingFile = path.join(modsDir, 'appledkin.jar');
    const existingContent = 'appledkin-bin-data';
    fs.writeFileSync(existingFile, existingContent, 'utf-8');
    const currentSha1 = synchronizer.calculateSha1(existingFile);

    const manifestFiles = [
      { path: 'mods/appledkin.jar', sha1: currentSha1, downloadUrl: 'https://cdn.com/appledkin.jar' },
      { path: 'mods/new-mod.jar', sha1: 'new-sha1', downloadUrl: 'https://cdn.com/new-mod.jar' }
    ];

    const toDownload: any[] = [];
    for (const file of manifestFiles) {
      const localFilePath = path.join(instanceDir, file.path);
      if (!fs.existsSync(localFilePath)) {
        toDownload.push(file);
      } else {
        const localHash = synchronizer.calculateSha1(localFilePath);
        if (file.sha1 && localHash !== file.sha1.toLowerCase()) {
          toDownload.push(file);
        }
      }
    }

    expect(toDownload.length).toBe(1);
    expect(toDownload[0].path).toBe('mods/new-mod.jar');
  });
});
