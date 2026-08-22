import { describe, it, expect } from 'vitest';
import { JVMOptimizer } from '../src/main/jvm-optimizer';

describe('JVMOptimizer Performance Flag Tests', () => {
  it('debe seleccionar ZGC Turbo automáticamente para Java 21+ con 8GB de RAM', () => {
    const flags = JVMOptimizer.getOptimizedFlags('auto', 21, 8192);
    expect(flags).toContain('-XX:+UseZGC');
    expect(flags).toContain('-XX:+ZGenerational');
    expect(flags).toContain('-XX:+AlwaysPreTouch');
    expect(flags).toContain('-XX:CICompilerCount=4');
    expect(flags).toContain('-XX:+UseFastAccessorMethods');
  });

  it('debe seleccionar Aikar G1GC para Java 17 o RAM moderada (4GB)', () => {
    const flags = JVMOptimizer.getOptimizedFlags('auto', 17, 4096);
    expect(flags).toContain('-XX:+UseG1GC');
    expect(flags).toContain('-XX:G1NewSizePercent=30');
  });

  it('debe permitir perfil custom sin sobreescrituras', () => {
    const custom = ['-Xmx6G', '-Dcustom=true'];
    const flags = JVMOptimizer.getOptimizedFlags('custom', 21, 6144, custom);
    expect(flags).toEqual(custom);
  });
});
