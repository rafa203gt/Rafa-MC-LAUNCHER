import { describe, it, expect } from 'vitest';
import { remoteConfigManager } from '../src/main/remote-config';

describe('Crash Reporting Telemetry Tests', () => {
  it('debe inicializar el cliente de Supabase con las credenciales por defecto', () => {
    expect((remoteConfigManager as any).supabase).toBeDefined();
    expect((remoteConfigManager as any).supabase).not.toBeNull();
  });

  it('debe poder enviar reportes de telemetria de crash sin fallar', async () => {
    const success = await remoteConfigManager.reportCrash({
      username: 'TestTelemetryPlayer',
      minecraftVersion: '1.21.1',
      launcherVersion: '1.0.25',
      ramAllocated: 4096,
      errorMessage: '[TEST] Telemetry verification crash report',
      crashLog: 'Verification stack trace log'
    });
    expect(success).toBe(true);
  });
});
