import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CrashAnalyzer } from '../src/main/crash-analyzer';

describe('CrashAnalyzer Unit & Boundary Tests', () => {
  let tempDir: string;
  let analyzer: CrashAnalyzer;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rafa-crash-test-'));
    fs.mkdirSync(path.join(tempDir, 'logs'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'crash-reports'), { recursive: true });
    analyzer = new CrashAnalyzer();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('debe diagnosticar correctamente OutOfMemoryError y recomendar aumento de RAM', () => {
    const logPath = path.join(tempDir, 'logs', 'latest.log');
    fs.writeFileSync(logPath, 'Starting Minecraft...\n[Render thread/FATAL]: java.lang.OutOfMemoryError: Java heap space', 'utf-8');

    const result = analyzer.diagnose(tempDir, 1);
    expect(result.type).toBe('out_of_memory');
    expect(result.recommendedAction).toBe('increase_ram');
    expect(result.actionButtonText).toContain('Aumentar RAM');
  });

  it('debe detectar fallo de driver gráfico / OpenGL y recomendar forzado de GPU', () => {
    const logPath = path.join(tempDir, 'logs', 'latest.log');
    fs.writeFileSync(logPath, '[Render thread/ERROR]: Failed to create GLFW window: GLFW error 65542 WGL_ARB_create_context', 'utf-8');

    const result = analyzer.diagnose(tempDir, -1073740791);
    expect(result.type).toBe('graphics_driver');
    expect(result.recommendedAction).toBe('force_gpu');
  });

  it('debe detectar mod corrupto y extraer el nombre del archivo culpable', () => {
    const crashPath = path.join(tempDir, 'crash-reports', 'crash-2026-08-22_01.00.00-client.txt');
    fs.writeFileSync(crashPath, 'net.neoforged.fml.ModLoadingException: Failed to load mod jei from jei-1.21.1-19.21.0.jar', 'utf-8');

    const result = analyzer.diagnose(tempDir, 1);
    expect(result.type).toBe('corrupt_mod');
    expect(result.culpritFile).toBe('jei-1.21.1-19.21.0.jar');
    expect(result.recommendedAction).toBe('reinstall_modpack');
  });

  it('debe detectar error de versión de Java (UnsupportedClassVersionError)', () => {
    const logPath = path.join(tempDir, 'logs', 'latest.log');
    fs.writeFileSync(logPath, 'java.lang.UnsupportedClassVersionError: net/minecraft/client/main/Main has been compiled by a more recent version of the Java Runtime', 'utf-8');

    const result = analyzer.diagnose(tempDir, 1);
    expect(result.type).toBe('java_version');
    expect(result.recommendedAction).toBe('repair_java');
  });

  it('debe manejar directorios vacíos o logs inexistentes con fallback genérico sin romperse', () => {
    const emptyDir = path.join(tempDir, 'empty_inst');
    fs.mkdirSync(emptyDir);

    const result = analyzer.diagnose(emptyDir, 137);
    expect(result.type).toBe('generic');
    expect(result.exitCode).toBe(137);
    expect(result.recommendedAction).toBe('reinstall_modpack');
    expect(result.timestamp).toBeDefined();
  });
});
