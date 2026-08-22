import path from 'node:path';
import fs from 'node:fs';
import axios from 'axios';
import { configStore } from './config-store';
import { ENV } from './env';

export interface ShopCosmetic {
  id: string;
  name: string;
  description: string;
  category: 'cape' | 'wings' | 'hat' | 'bandana' | 'pet';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price: number;
  texture_url: string;
  model_type: string;
  is_animated: boolean;
  is_featured: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface UserEquippedCosmetics {
  username: string;
  client_id?: string;
  uuid?: string;
  cape_id: string | null;
  wings_id: string | null;
  hat_id: string | null;
  bandana_id: string | null;
  updated_at?: string;
  // Resolved cosmetic objects
  cape?: ShopCosmetic | null;
  wings?: ShopCosmetic | null;
  hat?: ShopCosmetic | null;
  bandana?: ShopCosmetic | null;
}

export interface UserEconomy {
  username: string;
  client_id?: string;
  coins: number;
  playtime_minutes: number;
  last_daily_reward: string;
  updated_at?: string;
}

export class CosmeticsManager {
  private readonly SUPABASE_URL = ENV.SUPABASE_URL;
  private readonly SUPABASE_KEY = ENV.SUPABASE_ANON_KEY;

  // Memoria local de respaldo y alta velocidad
  private localEconomy: Map<string, UserEconomy> = new Map();
  private localInventory: Map<string, string[]> = new Map();
  private localEquipped: Map<string, UserEquippedCosmetics> = new Map();

  private get headers() {
    return {
      apikey: this.SUPABASE_KEY,
      Authorization: `Bearer ${this.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    };
  }

  /**
   * Obtiene todos los cosméticos activos disponibles en la tienda.
   */
  public async getCatalog(): Promise<ShopCosmetic[]> {
    if (!this.SUPABASE_URL || !this.SUPABASE_KEY) {
      console.warn('[CosmeticsManager] SUPABASE_URL no configurada.');
      return [];
    }

    try {
      const res = await axios.get(`${this.SUPABASE_URL}/rest/v1/shop_cosmetics?is_active=eq.true&order=price.asc`, {
        headers: this.headers,
        timeout: 8000
      });
      return res.data || [];
    } catch (err: any) {
      console.warn('[CosmeticsManager] Error cargando catálogo de cosméticos:', err.message);
      return [];
    }
  }

  /**
   * Obtiene el inventario de cosméticos adquiridos por el usuario o su equipo.
   */
  public async getUserInventory(username: string): Promise<string[]> {
    const cleanUser = (username || '').trim();
    if (!this.SUPABASE_URL) return [];

    try {
      const { configStore } = await import('./config-store');
      const clientId = configStore.getClientId();

      const queryUrl = clientId && cleanUser
        ? `${this.SUPABASE_URL}/rest/v1/user_cosmetics_inventory?or=(client_id.eq.${encodeURIComponent(clientId)},username.eq.${encodeURIComponent(cleanUser)})&select=cosmetic_id`
        : clientId
        ? `${this.SUPABASE_URL}/rest/v1/user_cosmetics_inventory?client_id=eq.${encodeURIComponent(clientId)}&select=cosmetic_id`
        : `${this.SUPABASE_URL}/rest/v1/user_cosmetics_inventory?username=eq.${encodeURIComponent(cleanUser)}&select=cosmetic_id`;

      const res = await axios.get(queryUrl, { headers: this.headers, timeout: 8000 });
      return Array.from(new Set((res.data || []).map((row: any) => row.cosmetic_id)));
    } catch (err: any) {
      console.warn('[CosmeticsManager] Error cargando inventario del usuario:', err.message);
      return [];
    }
  }

  /**
   * Obtiene los cosméticos actualmente equipados por el equipo o usuario.
   */
  public async getUserEquipped(username: string): Promise<UserEquippedCosmetics> {
    const cleanUser = (username || '').trim();
    const fallback: UserEquippedCosmetics = {
      username: cleanUser,
      cape_id: null,
      wings_id: null,
      hat_id: null,
      bandana_id: null
    };

    if (!this.SUPABASE_URL) return fallback;

    try {
      const { configStore } = await import('./config-store');
      const clientId = configStore.getClientId();

      let row: any = null;

      // 1. Prioridad: Buscar por ID único del equipo (client_id)
      if (clientId) {
        const clientRes = await axios.get(
          `${this.SUPABASE_URL}/rest/v1/user_equipped_cosmetics?client_id=eq.${encodeURIComponent(clientId)}`,
          { headers: this.headers, timeout: 8000 }
        );
        if (clientRes.data && clientRes.data.length > 0) {
          row = clientRes.data[0];
          // Actualizar nombre si cambió
          if (cleanUser && row.username !== cleanUser) {
            axios.patch(
              `${this.SUPABASE_URL}/rest/v1/user_equipped_cosmetics?client_id=eq.${encodeURIComponent(clientId)}`,
              { username: cleanUser, updated_at: new Date().toISOString() },
              { headers: this.headers, timeout: 5000 }
            ).catch(() => {});
          }
        }
      }

      // 2. Si no existe por client_id, buscar por username
      if (!row && cleanUser) {
        const userRes = await axios.get(
          `${this.SUPABASE_URL}/rest/v1/user_equipped_cosmetics?username=eq.${encodeURIComponent(cleanUser)}`,
          { headers: this.headers, timeout: 8000 }
        );
        if (userRes.data && userRes.data.length > 0) {
          row = userRes.data[0];
          if (clientId && !row.client_id) {
            axios.patch(
              `${this.SUPABASE_URL}/rest/v1/user_equipped_cosmetics?username=eq.${encodeURIComponent(cleanUser)}`,
              { client_id: clientId },
              { headers: this.headers, timeout: 5000 }
            ).catch(() => {});
          }
        }
      }

      if (row) {
        const catalog = await this.getCatalog();
        const catalogMap = new Map(catalog.map((c) => [c.id, c]));

        return {
          username: cleanUser || row.username,
          client_id: row.client_id || clientId,
          uuid: row.uuid,
          cape_id: row.cape_id,
          wings_id: row.wings_id,
          hat_id: row.hat_id,
          bandana_id: row.bandana_id,
          updated_at: row.updated_at,
          cape: row.cape_id ? catalogMap.get(row.cape_id) || null : null,
          wings: row.wings_id ? catalogMap.get(row.wings_id) || null : null,
          hat: row.hat_id ? catalogMap.get(row.hat_id) || null : null,
          bandana: row.bandana_id ? catalogMap.get(row.bandana_id) || null : null
        };
      }

      return fallback;
    } catch (err: any) {
      console.warn('[CosmeticsManager] Error cargando cosméticos equipados:', err.message);
      return fallback;
    }
  }

  /**
   * Equipa o desequipa un cosmético en el slot correspondiente.
   */
  public async equipCosmetic(
    username: string,
    slot: 'cape' | 'wings' | 'hat' | 'bandana',
    cosmeticId: string | null,
    uuid?: string
  ): Promise<UserEquippedCosmetics> {
    const cleanUser = (username || '').trim();
    if (!cleanUser) throw new Error('Nombre de usuario no especificado');

    // Obtener estado actual
    const current = await this.getUserEquipped(cleanUser);
    const slotKey = `${slot}_id` as 'cape_id' | 'wings_id' | 'hat_id' | 'bandana_id';

    const { configStore } = await import('./config-store');
    const clientId = configStore.getClientId();

    const payload = {
      username: cleanUser,
      client_id: clientId,
      uuid: uuid || current.uuid || '',
      cape_id: slot === 'cape' ? cosmeticId : current.cape_id,
      wings_id: slot === 'wings' ? cosmeticId : current.wings_id,
      hat_id: slot === 'hat' ? cosmeticId : current.hat_id,
      bandana_id: slot === 'bandana' ? cosmeticId : current.bandana_id,
      updated_at: new Date().toISOString()
    };

    try {
      await axios.post(`${this.SUPABASE_URL}/rest/v1/user_equipped_cosmetics`, payload, {
        headers: {
          ...this.headers,
          Prefer: 'resolution=merge-duplicates'
        },
        timeout: 8000
      });

      // Si se equipó una capa, sincronizarla con el SkinManager de Supabase y localmente
      if (slot === 'cape') {
        const catalog = await this.getCatalog();
        const capeCosmetic = cosmeticId ? catalog.find((c) => c.id === cosmeticId) : null;
        try {
          const { skinManager } = await import('./skin-manager');
          const existingSkin = await skinManager.getUserSkin(cleanUser);
          await skinManager.saveUserSkin({
            username: cleanUser,
            skinUrl: existingSkin?.skinUrl || `https://minotar.net/skin/${encodeURIComponent(cleanUser)}`,
            model: existingSkin?.model || 'default',
            capeUrl: capeCosmetic?.texture_url || null
          });
        } catch (skinErr) {
          console.warn('[CosmeticsManager] No se pudo sincronizar capa con skinManager:', skinErr);
        }
      }

      return await this.getUserEquipped(cleanUser);
    } catch (err: any) {
      throw new Error(`Error al equipar cosmético: ${err.message}`);
    }
  }

  /**
   * Obtiene la economía y saldo de Rafa Coins anclado al equipo o usuario.
   */
  public async getUserEconomy(username: string): Promise<UserEconomy> {
    const cleanUser = (username || '').trim();
    let clientId = '';
    try {
      const { configStore } = await import('./config-store');
      clientId = configStore.getClientId();
    } catch {}

    const fallback: UserEconomy = this.localEconomy.get(cleanUser) || {
      username: cleanUser,
      client_id: clientId,
      coins: 500, // Bono inicial de bienvenida
      playtime_minutes: 0,
      last_daily_reward: ''
    };

    if (this.SUPABASE_URL && this.SUPABASE_KEY) {
      try {
        let remote: any = null;

        // 1. Prioridad: Buscar por ID único del equipo (client_id)
        if (clientId) {
          const clientRes = await axios.get(
            `${this.SUPABASE_URL}/rest/v1/user_economy?client_id=eq.${encodeURIComponent(clientId)}`,
            { headers: this.headers, timeout: 8000 }
          );
          if (clientRes.data && clientRes.data.length > 0) {
            remote = clientRes.data[0];
            // Si el nombre de usuario cambió en este equipo, sincronizar el nuevo nombre manteniendo todas las monedas
            if (cleanUser && remote.username !== cleanUser) {
              remote.username = cleanUser;
              axios.patch(
                `${this.SUPABASE_URL}/rest/v1/user_economy?client_id=eq.${encodeURIComponent(clientId)}`,
                { username: cleanUser, updated_at: new Date().toISOString() },
                { headers: this.headers, timeout: 5000 }
              ).catch(() => {});
            }
          }
        }

        // 2. Si no existe por client_id, buscar por username
        if (!remote && cleanUser) {
          const userRes = await axios.get(
            `${this.SUPABASE_URL}/rest/v1/user_economy?username=eq.${encodeURIComponent(cleanUser)}`,
            { headers: this.headers, timeout: 8000 }
          );
          if (userRes.data && userRes.data.length > 0) {
            remote = userRes.data[0];
            if (clientId && !remote.client_id) {
              remote.client_id = clientId;
              axios.patch(
                `${this.SUPABASE_URL}/rest/v1/user_economy?username=eq.${encodeURIComponent(cleanUser)}`,
                { client_id: clientId },
                { headers: this.headers, timeout: 5000 }
              ).catch(() => {});
            }
          }
        }

        if (remote) {
          this.localEconomy.set(cleanUser, remote);
          return remote;
        }

        // Crear registro inicial si no existe
        const newRecord = { ...fallback, username: cleanUser || 'Player', client_id: clientId };
        await axios.post(`${this.SUPABASE_URL}/rest/v1/user_economy`, newRecord, {
          headers: { ...this.headers, Prefer: 'resolution=merge-duplicates' },
          timeout: 8000
        });
        this.localEconomy.set(cleanUser, newRecord);
        return newRecord;
      } catch (err: any) {
        console.warn('[CosmeticsManager] Error obteniendo economía remota de usuario:', err.message);
      }
    }

    return this.localEconomy.get(cleanUser) || fallback;
  }

  /**
   * Compra un cosmético con Rafa Coins.
   */
  public async buyCosmetic(username: string, cosmeticId: string): Promise<{ success: boolean; message: string; remainingCoins: number }> {
    const cleanUser = (username || '').trim();
    const { configStore } = await import('./config-store');
    const clientId = configStore.getClientId();

    // 1. Obtener detalles del cosmético
    const catalog = await this.getCatalog();
    const item = catalog.find((c) => c.id === cosmeticId);
    if (!item) throw new Error('Cosmético no encontrado en el catálogo');

    // 2. Verificar si ya lo tiene
    const inventory = await this.getUserInventory(cleanUser);
    if (inventory.includes(cosmeticId)) {
      throw new Error('Ya posees este cosmético en tu armario.');
    }

    // 3. Verificar balance de monedas
    const economy = await this.getUserEconomy(cleanUser);
    if (economy.coins < item.price) {
      throw new Error(`Rafa Coins insuficientes. Necesitas ${item.price} 🪙 y tienes ${economy.coins} 🪙.`);
    }

    // 4. Deducir monedas
    const remainingCoins = economy.coins - item.price;
    const updatedEconomy: UserEconomy = {
      ...economy,
      username: cleanUser || economy.username,
      client_id: clientId,
      coins: remainingCoins,
      updated_at: new Date().toISOString()
    };
    this.localEconomy.set(cleanUser, updatedEconomy);

    if (this.SUPABASE_URL && this.SUPABASE_KEY) {
      try {
        await axios.post(`${this.SUPABASE_URL}/rest/v1/user_economy`, updatedEconomy, {
          headers: { ...this.headers, Prefer: 'resolution=merge-duplicates' },
          timeout: 8000
        });
      } catch {}

      try {
        await axios.post(
          `${this.SUPABASE_URL}/rest/v1/user_cosmetics_inventory`,
          {
            username: cleanUser || economy.username,
            client_id: clientId,
            cosmetic_id: cosmeticId,
            acquired_at: new Date().toISOString()
          },
          { headers: { ...this.headers, Prefer: 'resolution=merge-duplicates' }, timeout: 8000 }
        );
      } catch {}
    }

    // 5. Auto-equipar el cosmético comprado
    try {
      await this.equipCosmetic(cleanUser, item.category as any, cosmeticId);
    } catch {}

    return {
      success: true,
      message: `¡Has comprado "${item.name}" con éxito y se ha equipado en tu personaje!`,
      remainingCoins
    };
  }

  /**
   * Reclama la recompensa diaria de Rafa Coins (+100 monedas cada 24 horas).
   */
  public async claimDailyCoins(username: string): Promise<{ success: boolean; message: string; coinsAdded: number; newBalance: number }> {
    const cleanUser = (username || '').trim();
    if (!cleanUser) throw new Error('Usuario requerido');

    const economy = await this.getUserEconomy(cleanUser);
    const today = new Date().toISOString().split('T')[0];

    if (economy.last_daily_reward === today) {
      throw new Error('Ya has reclamado tu recompensa diaria de hoy. ¡Vuelve mañana!');
    }

    const reward = 100;
    const newBalance = economy.coins + reward;
    const updatedEconomy: UserEconomy = {
      ...economy,
      coins: newBalance,
      last_daily_reward: today,
      updated_at: new Date().toISOString()
    };

    this.localEconomy.set(cleanUser, updatedEconomy);

    if (this.SUPABASE_URL && this.SUPABASE_KEY) {
      try {
        await axios.post(`${this.SUPABASE_URL}/rest/v1/user_economy`, updatedEconomy, {
          headers: { ...this.headers, Prefer: 'resolution=merge-duplicates' },
          timeout: 8000
        });
      } catch {}
    }

    return {
      success: true,
      message: `¡Recompensa diaria reclamada con éxito! +${reward} Rafa Coins 🪙`,
      coinsAdded: reward,
      newBalance
    };
  }
}

export const cosmeticsManager = new CosmeticsManager();
