import { describe, it, expect } from 'vitest';
import { ShaderManager } from '../src/main/shader-manager';
import { InstanceManager } from '../src/main/instance-manager';

describe('Instance Asset Isolation Tests', () => {
  it('debe aislar las carpetas de shaders por cada ID de instancia', () => {
    const shaderMgr = new ShaderManager();
    const atm10Shaders = shaderMgr.getInstalledShaders('atm10');
    const vanillaShaders = shaderMgr.getInstalledShaders('vanilla-1-21-4');

    expect(Array.isArray(atm10Shaders)).toBe(true);
    expect(Array.isArray(vanillaShaders)).toBe(true);
    expect(shaderMgr['getShaderpacksDir']('vanilla-1-21-4')).toContain('vanilla-1-21-4');
    expect(shaderMgr['getShaderpacksDir']('atm10')).toContain('default');
  });

  it('debe mantener carpetas de instancias separadas para mods y configuraciones', () => {
    const instMgr = new InstanceManager();
    const dirAtm10 = instMgr.getInstanceDir('atm10');
    const dirVanilla = instMgr.getInstanceDir('vanilla-1-21-4');
    const dirCustom = instMgr.getInstanceDir('custom-modpack-xyz');

    expect(dirAtm10).not.toEqual(dirVanilla);
    expect(dirVanilla).not.toEqual(dirCustom);
    expect(dirVanilla).toContain('vanilla-1-21-4');
    expect(dirCustom).toContain('custom-modpack-xyz');
  });
});
