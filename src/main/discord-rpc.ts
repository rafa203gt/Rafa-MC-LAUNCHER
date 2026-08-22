import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const CLIENT_ID = '1220000000000000000'; // Default Application ID

export interface DiscordActivityOptions {
  state?: string;
  details?: string;
  instanceName?: string;
  serverIp?: string;
  isPlaying?: boolean;
  startTimestamp?: number;
}

export class DiscordRPCManager {
  private socket: net.Socket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private currentActivity: DiscordActivityOptions | null = null;
  private startTimestamp: number = Math.floor(Date.now() / 1000);
  private enabled: boolean = true;

  constructor() {
    this.startTimestamp = Math.floor(Date.now() / 1000);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearActivity();
      this.disconnect();
    } else {
      this.connect();
    }
  }

  private getSocketPath(index: number = 0): string {
    if (process.platform === 'win32') {
      return `\\\\?\\pipe\\discord-ipc-${index}`;
    }
    const envPath = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp';
    return path.join(envPath, `discord-ipc-${index}`);
  }

  public connect(): void {
    if (!this.enabled || this.isConnected || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const socketPath = this.getSocketPath(0);
      this.socket = net.createConnection(socketPath, () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.sendHandshake();

        if (this.currentActivity) {
          this.updateActivity(this.currentActivity);
        }
      });

      this.socket.on('error', () => {
        this.isConnected = false;
        this.isConnecting = false;
        this.socket = null;
      });

      this.socket.on('close', () => {
        this.isConnected = false;
        this.isConnecting = false;
        this.socket = null;
      });
    } catch {
      this.isConnected = false;
      this.isConnecting = false;
      this.socket = null;
    }
  }

  private sendHandshake(): void {
    if (!this.socket || !this.isConnected) return;
    const payload = JSON.stringify({
      v: 1,
      client_id: '1205608821998592000'
    });
    this.send(0, payload);
  }

  private send(op: number, json: string): void {
    if (!this.socket || !this.isConnected) return;
    const buffer = Buffer.from(json, 'utf8');
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0);
    header.writeInt32LE(buffer.length, 4);

    try {
      this.socket.write(Buffer.concat([header, buffer]));
    } catch {
      // Ignore socket write errors
    }
  }

  public updateActivity(options: DiscordActivityOptions): void {
    this.currentActivity = options;
    if (!this.enabled) return;

    if (!this.isConnected) {
      this.connect();
      return;
    }

    const isPlaying = options.isPlaying ?? false;
    const instanceName = options.instanceName || 'All the Mods 10';

    const activity: any = {
      details: isPlaying ? `Jugando: ${instanceName}` : `En el Launcher • ${instanceName}`,
      state: options.serverIp ? `Servidor: ${options.serverIp}` : 'Preparando modpack',
      timestamps: {
        start: options.startTimestamp || this.startTimestamp
      },
      assets: {
        large_image: 'minecraft_logo',
        large_text: `Rafa MC Launcher - ${instanceName}`,
        small_image: isPlaying ? 'play_icon' : 'launcher_icon',
        small_text: isPlaying ? 'En Partida' : 'Navegando'
      }
    };

    const payload = JSON.stringify({
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity
      },
      nonce: `${Date.now()}`
    });

    this.send(1, payload);
  }

  public clearActivity(): void {
    if (!this.socket || !this.isConnected) return;
    const payload = JSON.stringify({
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: null
      },
      nonce: `${Date.now()}`
    });
    this.send(1, payload);
  }

  public disconnect(): void {
    if (this.socket) {
      try {
        this.socket.end();
      } catch {}
      this.socket = null;
      this.isConnected = false;
      this.isConnecting = false;
    }
  }
}

export const discordRPC = new DiscordRPCManager();
