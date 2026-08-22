export type JVMProfile = 'auto' | 'zgc_turbo' | 'aikar' | 'low_end' | 'custom';

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
      // In Java 21+ with 5GB+ RAM, Generational ZGC Turbo is undisputed king for frame pacing and 0ms stutters
      if (javaVersion >= 21 && allocatedRamMb >= 5120) {
        activeProfile = 'zgc_turbo';
      } else if (allocatedRamMb <= 3500) {
        activeProfile = 'low_end';
      } else {
        activeProfile = 'aikar';
      }
    }

    switch (activeProfile) {
      case 'zgc_turbo':
        return [
          '-XX:+UseZGC',
          ...(javaVersion >= 21 ? ['-XX:+ZGenerational'] : []),
          '-XX:+AlwaysPreTouch',
          '-XX:+DisableExplicitGC',
          '-XX:+PerfDisableSharedMem',
          '-XX:+UseFastAccessorMethods',
          '-XX:+OptimizeStringConcat',
          '-XX:+UseStringDeduplication',
          '-XX:+UseCompressedOops',
          '-XX:+UseCompressedClassPointers',
          '-XX:CICompilerCount=4',
          '-XX:ParallelGCThreads=4',
          '-XX:ConcGCThreads=2',
          '-Dsun.rmi.dgc.server.gcInterval=2147483646',
          '-Dsun.rmi.dgc.client.gcInterval=2147483646',
          '-Djava.net.preferIPv4Stack=true'
        ];

      case 'low_end':
        return [
          '-XX:+UseG1GC',
          '-XX:+ParallelRefProcEnabled',
          '-XX:MaxGCPauseMillis=120',
          '-XX:+UnlockExperimentalVMOptions',
          '-XX:+DisableExplicitGC',
          '-XX:+AlwaysPreTouch',
          '-XX:G1NewSizePercent=20',
          '-XX:G1MaxNewSizePercent=30',
          '-XX:G1ReservePercent=15',
          '-XX:+PerfDisableSharedMem',
          '-XX:+UseFastAccessorMethods',
          '-XX:+OptimizeStringConcat'
        ];

      case 'aikar':
      default:
        return [
          '-XX:+UseG1GC',
          '-XX:+ParallelRefProcEnabled',
          '-XX:MaxGCPauseMillis=150',
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
          '-XX:+UseFastAccessorMethods',
          '-XX:+OptimizeStringConcat',
          '-XX:+UseStringDeduplication',
          '-XX:CICompilerCount=4',
          '-Dsun.rmi.dgc.server.gcInterval=2147483646',
          '-Dsun.rmi.dgc.client.gcInterval=2147483646'
        ];
    }
  }
}
