import { describe, it, expect } from 'vitest';
import { ProgressTracker } from '../src/main/progress-tracker';

describe('ProgressTracker Unit Tests', () => {
  it('debe calcular porcentaje y MB correctamente', () => {
    const total = 100 * 1024 * 1024; // 100 MB
    const tracker = new ProgressTracker(total);

    const metrics = tracker.update(50 * 1024 * 1024); // 50 MB
    expect(metrics.percent).toBe(50);
    expect(metrics.loadedMB).toBe('50.0');
    expect(metrics.totalMB).toBe('100.0');
    expect(metrics.speedMBs).toBeDefined();
    expect(metrics.etaFormatted).toBeDefined();
  });

  it('debe formatear tiempo de forma amigable al completarse', () => {
    const total = 10 * 1024 * 1024;
    const tracker = new ProgressTracker(total);
    const metrics = tracker.update(10 * 1024 * 1024);
    expect(metrics.percent).toBe(100);
    expect(metrics.etaFormatted).toBe('completando...');
  });
});
