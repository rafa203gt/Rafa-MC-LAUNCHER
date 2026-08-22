import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface SystemHardwareInfo {
  cpuModel: string;
  cpuCores: number;
  cpuSpeedMhz: number;
  totalRamGb: number;
  freeRamGb: number;
  gpus: string[];
  dedicatedGpu?: string;
  isHighEnd: boolean;
  osPlatform: string;
  osRelease: string;
}

export class HardwareDetector {
  private cachedInfo: SystemHardwareInfo | null = null;

  public async getHardwareInfo(): Promise<SystemHardwareInfo> {
    if (this.cachedInfo) return this.cachedInfo;

    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Procesador Desconocido';
    const cpuCores = cpus.length || 4;
    const cpuSpeedMhz = cpus[0]?.speed || 2500;
    const totalRamBytes = os.totalmem();
    const freeRamBytes = os.freemem();
    const totalRamGb = Math.round((totalRamBytes / (1024 * 1024 * 1024)) * 10) / 10;
    const freeRamGb = Math.round((freeRamBytes / (1024 * 1024 * 1024)) * 10) / 10;

    let gpus: string[] = [];

    // Detect GPUs on Windows using PowerShell / WMIC
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(
          'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"'
        );
        gpus = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.toLowerCase().includes('remote'));
      } catch {
        try {
          const { stdout } = await execAsync('wmic path win32_VideoController get name');
          gpus = stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && line.toLowerCase() !== 'name');
        } catch {
          gpus = ['Tarjeta Gráfica Genérica (Direct3D / OpenGL)'];
        }
      }
    } else {
      gpus = ['Tarjeta Gráfica Estándar'];
    }

    if (gpus.length === 0) {
      gpus = ['Tarjeta Gráfica Predeterminada'];
    }

    // Determine dedicated GPU (NVIDIA or AMD preferred over Intel)
    const nvidiaGpu = gpus.find((g) => g.toLowerCase().includes('nvidia') || g.toLowerCase().includes('geforce') || g.toLowerCase().includes('rtx') || g.toLowerCase().includes('gtx'));
    const amdGpu = gpus.find((g) => g.toLowerCase().includes('amd') || g.toLowerCase().includes('radeon') || g.toLowerCase().includes('rx '));
    const dedicatedGpu = nvidiaGpu || amdGpu || gpus[0];

    const isHighEnd = totalRamGb >= 15 && (!!nvidiaGpu || !!amdGpu || cpuCores >= 8);

    this.cachedInfo = {
      cpuModel,
      cpuCores,
      cpuSpeedMhz,
      totalRamGb,
      freeRamGb,
      gpus,
      dedicatedGpu,
      isHighEnd,
      osPlatform: os.platform(),
      osRelease: os.release()
    };

    return this.cachedInfo;
  }

  public getGpuForceEnv(): NodeJS.ProcessEnv {
    return {
      // Windows / NVIDIA Prime & High-Performance flags
      SHIM_MCCOMPAT: '0x800000001',
      __NV_PRIME_RENDER_OFFLOAD: '1',
      __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
      __VK_LAYER_NV_optimus: 'NVIDIA_only',
      DRI_PRIME: '1',
      GPU_MAX_HEAP_SIZE: '100',
      GPU_USE_SYNC_OBJECTS: '1',
      GPU_MAX_ALLOC_PERCENT: '100',
      GPU_SINGLE_ALLOC_PERCENT: '100'
    };
  }
}

export const hardwareDetector = new HardwareDetector();
