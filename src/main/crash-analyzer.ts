import fs from 'node:fs';
import path from 'node:path';

export interface CrashDiagnosis {
  exitCode: number;
  type: 'out_of_memory' | 'graphics_driver' | 'corrupt_mod' | 'java_version' | 'generic';
  title: string;
  description: string;
  culpritFile?: string;
  recommendedAction: 'increase_ram' | 'force_gpu' | 'reinstall_modpack' | 'repair_java' | 'view_logs';
  actionButtonText: string;
  rawLogSnippet: string;
  timestamp: string;
}

export class CrashAnalyzer {
  public diagnose(instanceDir: string, exitCode: number): CrashDiagnosis {
    const logsDir = path.join(instanceDir, 'logs');
    const crashReportsDir = path.join(instanceDir, 'crash-reports');
    const latestLogPath = path.join(logsDir, 'latest.log');

    let logContent = '';
    let crashReportContent = '';

    // 1. Read latest crash report if exists
    if (fs.existsSync(crashReportsDir)) {
      try {
        const files = fs
          .readdirSync(crashReportsDir)
          .filter((f) => f.startsWith('crash-') && f.endsWith('.txt'))
          .sort()
          .reverse();

        if (files.length > 0) {
          const newestCrash = path.join(crashReportsDir, files[0]);
          crashReportContent = fs.readFileSync(newestCrash, 'utf-8');
        }
      } catch (err) {
        console.warn('No se pudo leer crash report:', err);
      }
    }

    // 2. Read latest.log
    if (fs.existsSync(latestLogPath)) {
      try {
        logContent = fs.readFileSync(latestLogPath, 'utf-8');
      } catch (err) {
        console.warn('No se pudo leer latest.log:', err);
      }
    }

    const combinedText = `${crashReportContent}\n${logContent}`.slice(-10000);
    const lastLines = (logContent || crashReportContent).split(/\r?\n/).slice(-30).join('\n');

    // A. Out Of Memory
    if (
      combinedText.includes('OutOfMemoryError') ||
      combinedText.includes('Java heap space') ||
      combinedText.includes('GC overhead limit exceeded')
    ) {
      return {
        exitCode,
        type: 'out_of_memory',
        title: 'Falta de Memoria RAM Asignada',
        description:
          'Minecraft se ha quedado sin memoria RAM disponible para cargar todos los mods y texturas del modpack.',
        recommendedAction: 'increase_ram',
        actionButtonText: 'Aumentar RAM a 8 GB y Reintentar',
        rawLogSnippet: lastLines || 'java.lang.OutOfMemoryError: Java heap space',
        timestamp: new Date().toISOString()
      };
    }

    // B. Graphics Driver / OpenGL Failure
    if (
      combinedText.includes('nvoglv64.dll') ||
      combinedText.includes('ig9ic64.dll') ||
      combinedText.includes('atig6pxx.dll') ||
      combinedText.includes('OpenGL') ||
      combinedText.includes('GLFW error 65542') ||
      combinedText.includes('WGL_ARB_create_context')
    ) {
      return {
        exitCode,
        type: 'graphics_driver',
        title: 'Incompatibilidad con el Driver Gráfico u OpenGL',
        description:
          'El controlador gráfico de tu tarjeta falló al iniciar el renderizado OpenGL o el juego intentó abrirse en una gráfica no acelerada.',
        recommendedAction: 'force_gpu',
        actionButtonText: 'Activar Forzado de GPU Dedicada y Relanzar',
        rawLogSnippet: lastLines,
        timestamp: new Date().toISOString()
      };
    }

    // C. Corrupt Mod / Missing Dependency / Jar Error
    const modMatch =
      combinedText.match(/(?:ModLoadingException|Failed to load mod|Invalid ZIP archive|error loading)[^\n]*?\s([a-zA-Z0-9_\-\.]+\.jar)/i) ||
      combinedText.match(/([a-zA-Z0-9_\-\.]+\.jar)/i) ||
      combinedText.match(/Failed to load mod\s+([a-zA-Z0-9_\-]+)/i) ||
      combinedText.match(/DuplicateModsException/i);

    if (
      modMatch ||
      combinedText.includes('MixinPrepareException') ||
      combinedText.includes('Invalid ZIP file') ||
      combinedText.includes('ClassNotFoundException')
    ) {
      const culprit = modMatch ? modMatch[1] : undefined;
      return {
        exitCode,
        type: 'corrupt_mod',
        title: 'Archivo de Mod Incompleto o Dañado',
        description: culprit
          ? `Se detectó un problema en el archivo "${culprit}". Es posible que se descargara de forma incompleta.`
          : 'Uno o varios mods del modpack tienen dependencias faltantes o se descargaron con errores.',
        culpritFile: culprit,
        recommendedAction: 'reinstall_modpack',
        actionButtonText: 'Reparar y Sincronizar Modpack en 1 Clic',
        rawLogSnippet: lastLines,
        timestamp: new Date().toISOString()
      };
    }

    // D. Java Version Issue
    if (
      combinedText.includes('UnsupportedClassVersionError') ||
      combinedText.includes('has been compiled by a more recent version of the Java Runtime')
    ) {
      return {
        exitCode,
        type: 'java_version',
        title: 'Versión de Java Incompatible',
        description:
          'La versión de Minecraft seleccionada requiere un entorno de Java más reciente (Java 21).',
        recommendedAction: 'repair_java',
        actionButtonText: 'Auto-Aprovisionar OpenJDK 21',
        rawLogSnippet: lastLines,
        timestamp: new Date().toISOString()
      };
    }

    // E. Generic Fallback
    return {
      exitCode,
      type: 'generic',
      title: `Cierre Inesperado del Juego (Código: ${exitCode})`,
      description:
        'Minecraft se cerró de forma imprevista. Puedes intentar reparar los archivos o revisar el reporte detallado.',
      recommendedAction: 'reinstall_modpack',
      actionButtonText: 'Reparar Modpack y Reintentar',
      rawLogSnippet: lastLines || `Process exited with code ${exitCode}`,
      timestamp: new Date().toISOString()
    };
  }
}

export const crashAnalyzer = new CrashAnalyzer();
