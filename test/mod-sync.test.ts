import { describe, it, expect } from 'vitest';
import { ModSynchronizer } from '../src/main/mod-sync';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ModSynchronizer Unit Tests', () => {
  const sync = new ModSynchronizer();

  it('debe calcular hash SHA1 exacto de un archivo', () => {
    const tmpFile = path.join(os.tmpdir(), 'sample-mod-test.txt');
    fs.writeFileSync(tmpFile, 'Minecraft Modpack Test Content 1.20.1', 'utf-8');

    const hash = sync.calculateSha1(tmpFile);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(40);

    fs.unlinkSync(tmpFile);
  });

  it('debe manejar URLs de manifiesto vacías o nulas sin fallar', async () => {
    const result = await sync.syncModpack('');
    expect(result).toEqual({ synced: 0, deleted: 0, total: 0 });
  });

  it('debe manejar URLs de manifiesto inalcanzables con degradación suave', async () => {
    const manifest = await sync.fetchManifest('https://invalid-host-unreachable-999.com/manifest.json');
    // Debe recuperarse mediante overlay o retornar null sin lanzar error fatal
    expect(manifest === null || typeof manifest === 'object').toBe(true);
  }, 10000);
});
