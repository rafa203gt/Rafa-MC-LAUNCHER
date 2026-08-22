import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { AuthManager } from '../src/main/auth-manager';
import { configStore } from '../src/main/config-store';

describe('AuthManager Unit & Security Tests', () => {
  let tempDir: string;
  let authManager: AuthManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
    authManager = new AuthManager();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('debe poder crear y gestionar cuentas Offline / No-Premium de forma segura', () => {
    const acc1 = authManager.addOfflineAccount('RafaGamer');
    expect(acc1).toBeDefined();
    expect(acc1.type).toBe('offline');
    expect(acc1.username).toBe('RafaGamer');
    expect(acc1.uuid).toBeDefined();
    expect(acc1.active).toBe(true);

    const accounts = authManager.getAccounts();
    expect(accounts.some((a) => a.username === 'RafaGamer')).toBe(true);
  });

  it('debe alternar la cuenta activa correctamente entre múltiples perfiles', () => {
    const acc1 = authManager.addOfflineAccount('Jugador1');
    const acc2 = authManager.addOfflineAccount('Jugador2');

    expect(authManager.getActiveAccount()?.username).toBe('Jugador2');

    const switched = authManager.setActiveAccount(acc1.id);
    expect(switched).toBe(true);
    expect(authManager.getActiveAccount()?.username).toBe('Jugador1');
  });

  it('debe generar un payload de autorización de juego offline válido', async () => {
    authManager.addOfflineAccount('TestPlayer');

    const auth = await authManager.getValidAuthForLaunch();
    expect(auth).toBeDefined();
    expect(auth.name).toBe('TestPlayer');
    expect(auth.uuid).toBeDefined();
    expect(auth.isMicrosoft).toBe(false);
    expect(auth.user_properties).toBe('{}');
  });

  it('debe eliminar cuentas registradas y reasignar la cuenta activa si es necesario', () => {
    const acc1 = authManager.addOfflineAccount('UsuarioAEliminar');
    const acc2 = authManager.addOfflineAccount('UsuarioQueQueda');

    const removed = authManager.removeAccount(acc1.id);
    expect(removed).toBe(true);

    const accounts = authManager.getAccounts();
    expect(accounts.some((a) => a.id === acc1.id)).toBe(false);
    expect(accounts.some((a) => a.id === acc2.id)).toBe(true);
  });
});
