import path from 'node:path';
import fs from 'node:fs';
import { safeStorage, BrowserWindow } from 'electron';
import axios from 'axios';
import crypto from 'node:crypto';
import { configStore } from './config-store';

export interface MicrosoftAccount {
  id: string; // Minecraft UUID or unique string
  type: 'microsoft' | 'offline';
  username: string;
  uuid: string;
  skinUrl?: string;
  capeUrl?: string;
  skinModel?: 'default' | 'slim';
  hasGameOwnership: boolean;
  active: boolean;
  addedAt: string;
  // Encrypted tokens
  tokens?: {
    msAccessToken: string;
    msRefreshToken: string;
    msExpiresAt: number;
    mcAccessToken: string;
    mcExpiresAt: number;
  };
}

export class AuthManager {
  private readonly CLIENT_ID = '00000000402b5328'; // Official Mojang Public Desktop Client ID
  private readonly REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
  private readonly SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';
  private accounts: MicrosoftAccount[] = [];

  constructor() {
    this.loadAccounts();
  }

  private getAccountsFilePath(): string {
    return path.join(configStore.getBaseDir(), 'accounts.enc');
  }

  /**
   * Carga y desencripta las cuentas de usuario almacenadas con hardware encryption (safeStorage).
   */
  private loadAccounts(): void {
    const filePath = this.getAccountsFilePath();
    if (!fs.existsSync(filePath)) {
      this.accounts = [];
      return;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      let jsonStr = '';

      const isSafeAvailable =
        typeof safeStorage?.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable();

      if (isSafeAvailable) {
        jsonStr = safeStorage.decryptString(buffer);
      } else {
        // Fallback decryption
        const key = this.getFallbackKey();
        const iv = buffer.subarray(0, 16);
        const authTag = buffer.subarray(16, 32);
        const encryptedData = buffer.subarray(32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        jsonStr = decipher.update(encryptedData, undefined, 'utf8') + decipher.final('utf8');
      }

      this.accounts = JSON.parse(jsonStr);
    } catch (err) {
      console.warn('[AuthManager] Error desencriptando cuentas guardadas, reiniciando almacén:', err);
      this.accounts = [];
    }
  }

  /**
   * Encripta y guarda las cuentas en disco de forma segura.
   */
  private saveAccounts(): void {
    const filePath = this.getAccountsFilePath();
    const jsonStr = JSON.stringify(this.accounts, null, 2);

    try {
      const isSafeAvailable =
        typeof safeStorage?.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable();

      if (isSafeAvailable) {
        const encrypted = safeStorage.encryptString(jsonStr);
        fs.writeFileSync(filePath, encrypted);
      } else {
        // Fallback encryption
        const key = this.getFallbackKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        const combined = Buffer.concat([iv, authTag, encrypted]);
        fs.writeFileSync(filePath, combined);
      }
    } catch (err) {
      console.error('[AuthManager] Error guardando cuentas encriptadas:', err);
    }
  }

  private getFallbackKey(): Buffer {
    const seed = configStore.getClientId() || 'rafa-mc-launcher-hardware-key-fallback';
    return crypto.createHash('sha256').update(seed).digest();
  }

  /**
   * Obtiene la lista de cuentas (sin tokens sensibles expuestos).
   */
  public getAccounts(): Omit<MicrosoftAccount, 'tokens'>[] {
    return this.accounts.map(({ tokens, ...rest }) => rest);
  }

  /**
   * Obtiene la cuenta actualmente activa.
   */
  public getActiveAccount(): MicrosoftAccount | null {
    const active = this.accounts.find((a) => a.active);
    return active || this.accounts[0] || null;
  }

  /**
   * Cambia la cuenta activa.
   */
  public setActiveAccount(accountId: string): boolean {
    let found = false;
    this.accounts.forEach((acc) => {
      if (acc.id === accountId) {
        acc.active = true;
        found = true;
      } else {
        acc.active = false;
      }
    });

    if (found) {
      this.saveAccounts();
    }
    return found;
  }

  /**
   * Elimina una cuenta registrada.
   */
  public removeAccount(accountId: string): boolean {
    const beforeLen = this.accounts.length;
    this.accounts = this.accounts.filter((a) => a.id !== accountId);

    if (this.accounts.length > 0 && !this.accounts.some((a) => a.active)) {
      this.accounts[0].active = true;
    }

    this.saveAccounts();
    return this.accounts.length < beforeLen;
  }

  /**
   * Añade o actualiza una cuenta Offline / No-Premium.
   */
  public addOfflineAccount(username: string): MicrosoftAccount {
    const cleanUser = username.trim() || 'Jugador';
    const id = `offline_${cleanUser.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;

    // Desactivar las demás si esta se activa
    this.accounts.forEach((a) => (a.active = false));

    const existingIdx = this.accounts.findIndex((a) => a.id === id);
    const newAcc: MicrosoftAccount = {
      id,
      type: 'offline',
      username: cleanUser,
      uuid: crypto.createHash('md5').update(`OfflinePlayer:${cleanUser}`).digest('hex'),
      hasGameOwnership: true,
      active: true,
      addedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      this.accounts[existingIdx] = newAcc;
    } else {
      this.accounts.push(newAcc);
    }

    this.saveAccounts();
    return newAcc;
  }

  /**
   * Inicia el flujo de autenticación oficial de Microsoft abriendo una ventana segura.
   */
  public loginWithMicrosoft(parentWindow?: BrowserWindow): Promise<MicrosoftAccount> {
    return new Promise((resolve, reject) => {
      const loginUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${this.CLIENT_ID}&response_type=code&scope=${encodeURIComponent(
        this.SCOPE
      )}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}`;

      const authWindow = new BrowserWindow({
        width: 520,
        height: 680,
        title: 'Iniciar Sesión con Microsoft - Rafa Launcher',
        parent: parentWindow || undefined,
        modal: true,
        show: true,
        autoHideMenuBar: true,
        backgroundColor: '#121620',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      let isResolved = false;

      const handleCallback = async (targetUrl: string) => {
        if (targetUrl.startsWith(this.REDIRECT_URI)) {
          const urlObj = new URL(targetUrl);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error_description') || urlObj.searchParams.get('error');

          if (code) {
            isResolved = true;
            authWindow.destroy();

            try {
              // 1. Canjear código de autorización por tokens
              const tokenParams = new URLSearchParams({
                client_id: this.CLIENT_ID,
                code,
                grant_type: 'authorization_code',
                redirect_uri: this.REDIRECT_URI,
                scope: this.SCOPE
              });

              const tokenRes = await axios.post(
                'https://login.live.com/oauth20_token.srf',
                tokenParams.toString(),
                {
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  timeout: 15000
                }
              );

              const msAccessToken = tokenRes.data.access_token;
              const msRefreshToken = tokenRes.data.refresh_token;
              const msExpiresIn = tokenRes.data.expires_in || 86400;

              // 2. Completar la cadena completa de autenticación Xbox -> Mojang
              const account = await this.completeMinecraftAuthChain(
                msAccessToken,
                msRefreshToken,
                msExpiresIn
              );
              resolve(account);
            } catch (err: any) {
              reject(new Error(`Error completando inicio de sesión: ${err.message || err}`));
            }
          } else if (error) {
            isResolved = true;
            authWindow.destroy();
            reject(new Error(`Inicio de sesión cancelado o denegado: ${error}`));
          }
        }
      };

      authWindow.webContents.on('will-redirect', (_event, url) => {
        handleCallback(url);
      });

      authWindow.webContents.on('will-navigate', (_event, url) => {
        handleCallback(url);
      });

      authWindow.webContents.on('did-navigate', (_event, url) => {
        handleCallback(url);
      });

      authWindow.on('closed', () => {
        if (!isResolved) {
          reject(new Error('Ventana de inicio de sesión cerrada'));
        }
      });

      authWindow.loadURL(loginUrl);
    });
  }

  /**
   * Ejecuta la cadena de validación: Xbox Live -> XSTS -> Mojang Auth -> Perfil & Entitlements.
   */
  public async completeMinecraftAuthChain(
    msAccessToken: string,
    msRefreshToken: string,
    msExpiresIn: number
  ): Promise<MicrosoftAccount> {
    // 1. Xbox Live User Authentication
    const xblRes = await axios.post(
      'https://user.auth.xboxlive.com/user/authenticate',
      {
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${msAccessToken}`
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT'
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
    );

    const xblToken = xblRes.data.Token;
    const userHash = xblRes.data.DisplayClaims?.xui?.[0]?.uhs;

    if (!xblToken || !userHash) {
      throw new Error('No se pudo obtener el token de Xbox Live');
    }

    // 2. XSTS Token (Minecraft Services)
    let xstsRes: any;
    try {
      xstsRes = await axios.post(
        'https://xsts.auth.xboxlive.com/xsts/authorize',
        {
          Properties: {
            SandboxId: 'RETAIL',
            UserTokens: [xblToken]
          },
          RelyingParty: 'rp://api.minecraftservices.com/',
          TokenType: 'JWT'
        },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
      );
    } catch (err: any) {
      if (err.response?.data?.XErr) {
        const xErr = err.response.data.XErr;
        if (xErr === 2148916233) {
          throw new Error('Esta cuenta Microsoft no tiene un perfil de Xbox Live. Crea uno en xbox.com e inténtalo de nuevo.');
        } else if (xErr === 2148916238) {
          throw new Error('Esta cuenta Microsoft es de un menor de edad y requiere ser autorizada por una cuenta familiar.');
        }
      }
      throw new Error(`Error en autorización XSTS: ${err.message}`);
    }

    const xstsToken = xstsRes.data.Token;

    // 3. Login with Xbox in Minecraft Services
    const mcLoginRes = await axios.post(
      'https://api.minecraftservices.com/authentication/login_with_xbox',
      {
        identityToken: `XBL3.0 x=${userHash};${xstsToken}`
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
    );

    const mcAccessToken = mcLoginRes.data.access_token;
    const mcExpiresIn = mcLoginRes.data.expires_in || 86400;

    // 4. Check Game Ownership (Entitlements)
    let hasOwnership = false;
    try {
      const entitlementsRes = await axios.get('https://api.minecraftservices.com/entitlements/mcstore', {
        headers: { Authorization: `Bearer ${mcAccessToken}` },
        timeout: 10000
      });
      const items = entitlementsRes.data?.items || [];
      hasOwnership = items.some((item: any) => item.name === 'game_minecraft' || item.name === 'product_minecraft');
    } catch {
      hasOwnership = true; // Si la API de entitlements falla o está lenta, continuar con el perfil
    }

    // 5. Get Minecraft Profile (Username, UUID, Skins)
    const profileRes = await axios.get('https://api.minecraftservices.com/minecraft/profile', {
      headers: { Authorization: `Bearer ${mcAccessToken}` },
      timeout: 10000
    });

    const profileData = profileRes.data;
    const username = profileData.name;
    const uuid = profileData.id;
    const activeSkin = profileData.skins?.find((s: any) => s.state === 'ACTIVE') || profileData.skins?.[0];
    const skinUrl = activeSkin?.url;
    const skinModel: 'default' | 'slim' = activeSkin?.variant?.toLowerCase() === 'slim' ? 'slim' : 'default';
    const activeCape = profileData.capes?.find((c: any) => c.state === 'ACTIVE') || profileData.capes?.[0];
    const capeUrl = activeCape?.url;

    // Desactivar las cuentas previas
    this.accounts.forEach((a) => (a.active = false));

    const now = Date.now();
    const account: MicrosoftAccount = {
      id: uuid,
      type: 'microsoft',
      username,
      uuid,
      skinUrl,
      capeUrl,
      skinModel,
      hasGameOwnership: hasOwnership,
      active: true,
      addedAt: new Date().toISOString(),
      tokens: {
        msAccessToken,
        msRefreshToken,
        msExpiresAt: now + msExpiresIn * 1000,
        mcAccessToken,
        mcExpiresAt: now + mcExpiresIn * 1000
      }
    };

    const existingIdx = this.accounts.findIndex((a) => a.id === uuid);
    if (existingIdx >= 0) {
      this.accounts[existingIdx] = account;
    } else {
      this.accounts.push(account);
    }

    this.saveAccounts();

    // Sincronizar skin oficial con el SkinManager de Rafa Launcher
    if (skinUrl) {
      try {
        const { skinManager } = await import('./skin-manager');
        await skinManager.saveUserSkin({
          username,
          skinUrl,
          model: skinModel,
          capeUrl
        });
      } catch (err) {
        console.warn('[AuthManager] No se pudo sincronizar skin en Supabase:', err);
      }
    }

    return account;
  }

  /**
   * Obtiene un token válido de Minecraft para la cuenta activa, refrescándolo si ha expirado.
   */
  public async getValidAuthForLaunch(): Promise<{
    access_token: string;
    client_token: string;
    uuid: string;
    name: string;
    user_properties: string;
    isMicrosoft: boolean;
  }> {
    const active = this.getActiveAccount();
    if (!active || active.type === 'offline') {
      const cleanName = active?.username || configStore.getSettings().username || 'Jugador';
      const uuid = crypto.createHash('md5').update(`OfflinePlayer:${cleanName}`).digest('hex');
      return {
        access_token: uuid,
        client_token: uuid,
        uuid,
        name: cleanName,
        user_properties: '{}',
        isMicrosoft: false
      };
    }

    // Cuenta de Microsoft: verificar expiración
    if (!active.tokens) {
      throw new Error('La cuenta de Microsoft no tiene tokens válidos. Inicia sesión de nuevo.');
    }

    const now = Date.now();
    // Si el token de Minecraft expira en menos de 5 minutos, refrescarlo
    if (now > active.tokens.mcExpiresAt - 5 * 60 * 1000) {
      console.log('[AuthManager] Refrescando token de sesión de Microsoft...');
      await this.refreshMicrosoftSession(active);
    }

    return {
      access_token: active.tokens.mcAccessToken,
      client_token: active.uuid,
      uuid: active.uuid,
      name: active.username,
      user_properties: '{}',
      isMicrosoft: true
    };
  }

  /**
   * Refresca la sesión usando el refresh_token de Microsoft.
   */
  private async refreshMicrosoftSession(account: MicrosoftAccount): Promise<void> {
    if (!account.tokens?.msRefreshToken) {
      throw new Error('No hay refresh token disponible');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.CLIENT_ID,
      refresh_token: account.tokens.msRefreshToken,
      redirect_uri: this.REDIRECT_URI,
      scope: this.SCOPE
    });

    const res = await axios.post(
      'https://login.live.com/oauth20_token.srf',
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      }
    );

    const msAccessToken = res.data.access_token;
    const msRefreshToken = res.data.refresh_token || account.tokens.msRefreshToken;
    const msExpiresIn = res.data.expires_in || 86400;

    await this.completeMinecraftAuthChain(msAccessToken, msRefreshToken, msExpiresIn);
  }
}

export const authManager = new AuthManager();
