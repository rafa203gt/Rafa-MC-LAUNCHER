export type JVMProfile = 'auto' | 'aikar' | 'zgc' | 'low_end' | 'custom';

export class JVMOptimizer {
  public static getOptimizedFlags(
    profile: JVMProfile = 'auto',
    javaVersion: number = 21,
    allocatedRamMb: number = 4096,
    customArgs: string[] = []
  ): string[] {
    if (profile === 'custom') {
      return customArgs;
    }

    let activeProfile = profile;
    if (profile === 'auto') {
      // If Java 21+ and RAM is at least 8GB, ZGC is supreme; otherwise Aikar G1GC
      if (javaVersion >= 21 && allocatedRamMb >= 8192) {
        activeProfile = 'zgc';
      } else if (allocatedRamMb <= 3072) {
        activeProfile = 'low_end';
      } else {
        activeProfile = 'aikar';
      }
    }

    switch (activeProfile) {
      case 'zgc':
        return [
          '-XX:+UseZGC',
          ...(javaVersion >= 21 ? ['-XX:+ZGenerational'] : []),
          '-XX:+AlwaysPreTouch',
          '-XX:+DisableExplicitGC',
          '-XX:+PerfDisableSharedMem',
          '-Dsun.rmi.dgc.server.gcInterval=2147483646',
          '-Dsun.rmi.dgc.client.gcInterval=2147483646'
        ];

      case 'low_end':
        return [
          '-XX:+UseG1GC',
          '-XX:+ParallelRefProcEnabled',
          '-XX:MaxGCPauseMillis=150',
          '-XX:+UnlockExperimentalVMOptions',
          '-XX:+DisableExplicitGC',
          '-XX:+AlwaysPreTouch',
          '-XX:G1NewSizePercent=20',
          '-XX:G1MaxNewSizePercent=30',
          '-XX:G1ReservePercent=15',
          '-XX:+PerfDisableSharedMem'
        ];

      case 'aikar':
      default:
        return [
          '-XX:+UseG1GC',
          '-XX:+ParallelRefProcEnabled',
          '-XX:MaxGCPauseMillis=200',
          '-XX:+UnlockExperimentalVMOptions',
          '-XX:+DisableExplicitGC',
          '-XX:+AlwaysPreTouch',
          '-XX:G1NewSizePercent=30',
          '-XX:G1MaxNewSizePercent=40',
          '-XX:G1ReservePercent=20',
          '-XX:G1HeapWastePercent=5',
          '-XX:G1MixedGCCountTarget=4',
          '-XX:InitiatingHeapOccupancyPercent=15',
          '-XX:G1MixedGCLiveThresholdPercent=90',
          '-XX:G1RSetUpdatingPauseTimePercent=5',
          '-XX:SurvivorRatio=32',
          '-XX:+PerfDisableSharedMem',
          '-XX:MaxTenuringThreshold=1',
          '-Dsun.rmi.dgc.server.gcInterval=2147483646',
          '-Dsun.rmi.dgc.client.gcInterval=2147483646'
        ];
    }
  }
}
