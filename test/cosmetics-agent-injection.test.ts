import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import AdmZip from 'adm-zip';
import { CosmeticsAgentManager } from '../src/main/cosmetics-agent';

describe('CosmeticsAgentManager & In-Game 3D Injection Tests', () => {
  let agentMgr: CosmeticsAgentManager;
  let testInstanceDir: string;

  beforeEach(() => {
    agentMgr = new CosmeticsAgentManager();
    testInstanceDir = path.join(os.tmpdir(), `rafa-test-inst-${Date.now()}`);
    fs.mkdirSync(testInstanceDir, { recursive: true });
  });

  it('debe generar el JAR del Agente Java con MANIFEST.MF y configuración válidos', () => {
    const jarPath = agentMgr.ensureAgentJar();
    expect(fs.existsSync(jarPath)).toBe(true);

    const zip = new AdmZip(jarPath);
    const manifestEntry = zip.getEntry('META-INF/MANIFEST.MF');
    expect(manifestEntry).toBeDefined();

    const manifestText = manifestEntry!.getData().toString('utf-8');
    expect(manifestText).toContain('Premain-Class: com.rafalauncher.cosmetics.RafaCosmeticsAgent');

    const configEntry = zip.getEntry('rafa-cosmetics.json');
    expect(configEntry).toBeDefined();
  });

  it('debe generar y activar el Resourcepack Universal de Modelos 3D (RafaCosmeticsPack.zip)', async () => {
    const packPath = await agentMgr.ensure3DCosmeticsResourcepack(testInstanceDir);
    expect(fs.existsSync(packPath)).toBe(true);

    const zip = new AdmZip(packPath);
    expect(zip.getEntry('pack.mcmeta')).toBeDefined();
    expect(zip.getEntry('assets/minecraft/optifine/cem/player.jem')).toBeDefined();
    expect(zip.getEntry('assets/minecraft/emf/models/dragon_wings.jem')).toBeDefined();
    expect(zip.getEntry('assets/minecraft/emf/models/crown.jem')).toBeDefined();
    expect(zip.getEntry('assets/minecraft/emf/models/halo.jem')).toBeDefined();
    expect(zip.getEntry('assets/minecraft/emf/models/bandana.jem')).toBeDefined();

    // Validar que options.txt lo contenga
    const optionsFile = path.join(testInstanceDir, 'options.txt');
    expect(fs.existsSync(optionsFile)).toBe(true);
    const optionsContent = fs.readFileSync(optionsFile, 'utf-8');
    expect(optionsContent).toContain('file/RafaCosmeticsPack.zip');
  });

  it('debe construir los argumentos JVM para inyección estilo Lunar Client en cualquier instancia', () => {
    const args = agentMgr.getJvmInjectionArgs('RafaDev');
    expect(args.some((a) => a.startsWith('-javaagent:'))).toBe(true);
    expect(args).toContain('-Drafa.cosmetics.enabled=true');
    expect(args).toContain('-Drafa.cosmetics.player=RafaDev');
    expect(args).toContain('-Drafa.cosmetics.lunarMode=true');
  });

  it('debe sincronizar cosméticos multijugador y persistir el mapa local en la instancia', async () => {
    const count = await agentMgr.syncAllMultiplayerCosmetics(testInstanceDir);
    expect(count).toBeGreaterThanOrEqual(0);

    const mapPath = path.join(testInstanceDir, 'rafa_multiplayer_cosmetics.json');
    expect(fs.existsSync(mapPath)).toBe(true);
  });
});
