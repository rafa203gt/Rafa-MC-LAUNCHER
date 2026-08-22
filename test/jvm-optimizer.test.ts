import { describe, it, expect } from 'vitest';
import { JVMOptimizer } from '../src/main/jvm-optimizer';

describe('JVMOptimizer Performance & Boundary Tests', () => {
  it('debe seleccionar ZGC Turbo automáticamente para Java 21+ con 5120MB o más de RAM', () => {
    const flags = JVMOptimizer.getOptimizedFlags('auto', 21, 5120);
    expect(flags).toContain('-XX:+UseZGC');
    expect(flags).toContain('-XX:+ZGenerational');
    expect(flags).toContain('-XX:+AlwaysPreTouch');
    expect(flags).toContain('-XX:CICompilerCount=4');
    expect(flags).toContain('-XX:+OptimizeStringConcat');
  });

  it('debe aplicar perfil low_end en el límite de RAM baja (<= 3500MB)', () => {
    const flagsBoundary = JVMOptimizer.getOptimizedFlags('auto', 21, 3500);
    expect(flagsBoundary).toContain('-XX:+UseG1GC');
    expect(flagsBoundary).toContain('-XX:G1NewSizePercent=20');
    expect(flagsBoundary).toContain('-XX:MaxGCPauseMillis=120');

    const flagsExtremeLow = JVMOptimizer.getOptimizedFlags('auto', 17, 2048);
    expect(flagsExtremeLow).toContain('-XX:G1NewSizePercent=20');
  });

  it('debe seleccionar Aikar G1GC en el rango medio (3501MB - 5119MB) o con Java < 21', () => {
    const flagsMidRam = JVMOptimizer.getOptimizedFlags('auto', 21, 4096);
    expect(flagsMidRam).toContain('-XX:+UseG1GC');
    expect(flagsMidRam).toContain('-XX:G1NewSizePercent=30');
    expect(flagsMidRam).toContain('-XX:SurvivorRatio=32');

    const flagsJava17HighRam = JVMOptimizer.getOptimizedFlags('auto', 17, 8192);
    expect(flagsJava17HighRam).toContain('-XX:+UseG1GC');
  });

  it('NUNCA debe incluir el flag obsoleto -XX:+UseFastAccessorMethods en ningún perfil', () => {
    const profiles: ('auto' | 'zgc_turbo' | 'aikar' | 'low_end')[] = ['auto', 'zgc_turbo', 'aikar', 'low_end'];
    for (const p of profiles) {
      const flags = JVMOptimizer.getOptimizedFlags(p, 21, 6144);
      expect(flags).not.toContain('-XX:+UseFastAccessorMethods');
    }
  });

  it('debe respetar argumentos personalizados en modo custom sin mutaciones', () => {
    const custom = ['-Xmx10G', '-XX:+UnlockDiagnosticVMOptions', '-DcustomFlag=1'];
    const flags = JVMOptimizer.getOptimizedFlags('custom', 21, 6144, custom);
    expect(flags).toEqual(custom);
  });
});
