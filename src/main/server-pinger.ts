import * as mcUtil from 'minecraft-server-util';

export interface ServerStatusResult {
  online: boolean;
  ip: string;
  port: number;
  latency?: number;
  players?: {
    online: number;
    max: number;
    sample?: { name: string; id: string }[];
  };
  motd?: {
    clean: string;
    raw?: any;
  };
  version?: string;
  favicon?: string;
  lastUpdated: number;
}

export class ServerPinger {
  public async pingServer(ip: string, port = 25565): Promise<ServerStatusResult> {
    const timestamp = Date.now();
    if (!ip || ip.trim() === '') {
      return {
        online: false,
        ip: '',
        port,
        lastUpdated: timestamp
      };
    }

    try {
      const response = await mcUtil.status(ip, port, {
        timeout: 4000,
        enableSRV: true
      });

      return {
        online: true,
        ip,
        port,
        latency: response.roundTripLatency,
        players: {
          online: response.players.online,
          max: response.players.max,
          sample: response.players.sample || []
        },
        motd: {
          clean: response.motd.clean,
          raw: response.motd.raw
        },
        version: response.version.name,
        favicon: response.favicon || undefined,
        lastUpdated: timestamp
      };
    } catch (err: any) {
      return {
        online: false,
        ip,
        port,
        motd: {
          clean: 'Servidor desconectado o no disponible'
        },
        lastUpdated: timestamp
      };
    }
  }
}

export const serverPinger = new ServerPinger();
