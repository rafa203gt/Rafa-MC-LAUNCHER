export interface ProgressSnapshot {
  timestamp: number;
  bytes: number;
}

export class ProgressTracker {
  private totalBytes: number;
  private startTime: number;
  private samples: ProgressSnapshot[] = [];
  private windowDurationMs: number = 1500; // 1.5 seconds rolling window
  private smoothedSpeedMBs: number = 0;
  private hasInitializedSpeed: boolean = false;

  constructor(totalBytes: number) {
    this.totalBytes = Math.max(1, totalBytes);
    this.startTime = Date.now();
  }

  public update(currentBytes: number): {
    speedMBs: string;
    etaFormatted: string;
    percent: number;
    loadedMB: string;
    totalMB: string;
  } {
    const now = Date.now();
    this.samples.push({ timestamp: now, bytes: currentBytes });

    // Clean old samples outside the rolling window
    const cutoff = now - this.windowDurationMs;
    this.samples = this.samples.filter((s) => s.timestamp >= cutoff);

    // Calculate instantaneous speed over rolling window
    let instantSpeedMBs = 0;
    if (this.samples.length >= 2) {
      const oldest = this.samples[0];
      const newest = this.samples[this.samples.length - 1];
      const deltaBytes = Math.max(0, newest.bytes - oldest.bytes);
      const deltaSec = Math.max(0.05, (newest.timestamp - oldest.timestamp) / 1000);
      instantSpeedMBs = deltaBytes / 1024 / 1024 / deltaSec;
    } else {
      const elapsed = Math.max(0.1, (now - this.startTime) / 1000);
      instantSpeedMBs = currentBytes / 1024 / 1024 / elapsed;
    }

    // Apply Exponential Moving Average (EMA) for rock-solid stability
    if (!this.hasInitializedSpeed && instantSpeedMBs > 0) {
      this.smoothedSpeedMBs = instantSpeedMBs;
      this.hasInitializedSpeed = true;
    } else {
      const alpha = 0.25; // 25% new sample weight, 75% history smoothing
      this.smoothedSpeedMBs = this.smoothedSpeedMBs * (1 - alpha) + instantSpeedMBs * alpha;
    }

    const currentSpeed = Math.max(0.01, this.smoothedSpeedMBs);
    const remainingBytes = Math.max(0, this.totalBytes - currentBytes);
    const remainingMB = remainingBytes / 1024 / 1024;
    const remainingSec = Math.ceil(remainingMB / currentSpeed);

    const percent = Math.min(100, Math.round((currentBytes / this.totalBytes) * 100));
    const loadedMB = (currentBytes / 1024 / 1024).toFixed(1);
    const totalMB = (this.totalBytes / 1024 / 1024).toFixed(1);

    return {
      speedMBs: currentSpeed.toFixed(1),
      etaFormatted: this.formatSeconds(remainingSec, percent),
      percent,
      loadedMB,
      totalMB
    };
  }

  private formatSeconds(seconds: number, percent: number): string {
    if (percent >= 100 || seconds <= 1) {
      return 'completando...';
    }
    if (seconds < 4) {
      return 'unos segundos restantes';
    }
    if (seconds < 60) {
      return `${seconds}s restantes`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m restantes`;
    }
    return `${mins}m ${secs}s restantes`;
  }
}
