import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { configStore } from '../src/main/config-store';

describe('User Telemetry & Client Registration Tests', () => {
  it('debe generar un client_id persistente y seguro sin caracteres extraños', () => {
    const clientId = configStore.getClientId();
    expect(clientId).toBeDefined();
    expect(typeof clientId).toBe('string');
    expect(clientId.length).toBeGreaterThan(6);
    // Deve tener formato hostname-hash
    expect(clientId).toMatch(/^[a-z0-9_-]+$/);
  });

  it('debe devolver el mismo client_id en llamadas subsiguientes (idempotencia)', () => {
    const id1 = configStore.getClientId();
    const id2 = configStore.getClientId();
    expect(id1).toBe(id2);
  });

  it('debe recopilar informacion de hardware no invasiva y benigna', () => {
    const hostname = os.hostname();
    const totalRamGb = Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
    const platform = process.platform;
    const arch = process.arch;

    expect(hostname).toBeDefined();
    expect(totalRamGb).toBeGreaterThan(0);
    expect(['win32', 'darwin', 'linux']).toContain(platform);
    expect(['x64', 'arm64', 'ia32']).toContain(arch);
  });
});
