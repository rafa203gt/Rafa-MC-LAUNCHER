import path from 'node:path';
import fs from 'node:fs';
import axios from 'axios';
import { configStore } from './config-store';

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
  uuid?: string;
  cape_id?: string | null;
  wings_id?: string | null;
  hat_id?: string | null;
  bandana_id?: string | null;
  updated_at?: string;
  // Resolved cosmetic objects
  cape?: ShopCosmetic | null;
  wings?: ShopCosmetic | null;
  hat?: ShopCosmetic | null;
  bandana?: ShopCosmetic | null;
}

export interface UserEconomy {
  username: string;
  coins: number;
  playtime_minutes: number;
  last_daily_reward: string;
  updated_at?: string;
}

export class CosmeticsManager {
  private readonly SUPABASE_URL = 'https://wukhkwwstsfvqcnyqoqu.supabase.co';
  private readonly SUPABASE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1a2hrd3dzdHNmdnFjbnlxb3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDk5NDUsImV4cCI6MjEwMjkyNTk0NX0.2NfFdLXOH4LHNJyAAqAeeUxtWsGnt6mcrT1VhQ22qzg';

  private headers = {
    apikey: this.SUPABASE_KEY,
    Authorization: `Bearer ${this.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  /**
   * Obtiene todos los cosméticos activos disponibles en la tienda.
   */
  public async getCatalog(): Promise<ShopCosmetic[]> {
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
   * Obtiene el inventario de cosméticos adquiridos por el usuario.
   */
  public async getUserInventory(username: string): Promise<string[]> {
    const cleanUser = (username || '').trim();
    if (!cleanUser) return [];

    try {
      const res = await axios.get(
        `${this.SUPABASE_URL}/rest/v1/user_cosmetics_inventory?username=eq.${encodeURIComponent(cleanUser)}&select=cosmetic_id`,
        { headers: this.headers, timeout: 8000 }
      );
      return (res.data || []).map((row: any) => row.cosmetic_id);
    } catch (err: any) {
      console.warn('[CosmeticsManager] Error cargando inventario del usuario:', err.message);
      return [];
    }
  }

  /**
   * Obtiene los cosméticos actualmente equipados por el usuario.
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

    if (!cleanUser) return fallback;

    try {
      const res = await axios.get(
        `${this.SUPABASE_URL}/rest/v1/user_equipped_cosmetics?username=eq.${encodeURIComponent(cleanUser)}`,
        { headers: this.headers, timeout: 8000 }
      );

      if (res.data && res.data.length > 0) {
        const row = res.data[0];
        const catalog = await this.getCatalog();
        const catalogMap = new Map(catalog.map((c) => [c.id, c]));

        return {
          username: row.username,
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

    const payload = {
      username: cleanUser,
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
   * Obtiene la economía y saldo de Rafa Coins del usuario.
   */
  public async getUserEconomy(username: string): Promise<UserEconomy> {
    const cleanUser = (username || '').trim();
    const fallback: UserEconomy = {
      username: cleanUser,
      coins: 500, // Bono inicial de bienvenida
      playtime_minutes: 0,
      last_daily_reward: ''
    };

    if (!cleanUser) return fallback;

    try {
      const res = await axios.get(
        `${this.SUPABASE_URL}/rest/v1/user_economy?username=eq.${encodeURIComponent(cleanUser)}`,
        { headers: this.headers, timeout: 8000 }
      );

      if (res.data && res.data.length > 0) {
        return res.data[0];
      }

      // Crear registro inicial si no existe
      await axios.post(`${this.SUPABASE_URL}/rest/v1/user_economy`, fallback, {
        headers: { ...this.headers, Prefer: 'resolution=merge-duplicates' },
        timeout: 8000
      });
      return fallback;
    } catch (err: any) {
      console.warn('[CosmeticsManager] Error obteniendo economía de usuario:', err.message);
      return fallback;
    }
  }

  /**
   * Compra un cosmético con Rafa Coins.
   */
  public async buyCosmetic(username: string, cosmeticId: string): Promise<{ success: boolean; message: string; remainingCoins: number }> {
    const cleanUser = (username || '').trim();
    if (!cleanUser) throw new Error('Nombre de usuario requerido');

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
    await axios.post(
      `${this.SUPABASE_URL}/rest/v1/user_economy`,
      {
        username: cleanUser,
        coins: remainingCoins,
        updated_at: new Date().toISOString()
      },
      { headers: { ...this.headers, Prefer: 'resolution=merge-duplicates' }, timeout: 8000 }
    );

    // 5. Añadir al inventario
    await axios.post(
      `${this.SUPABASE_URL}/rest/v1/user_cosmetics_inventory`,
      {
        username: cleanUser,
        cosmetic_id: cosmeticId,
        acquired_at: new Date().toISOString()
      },
      { headers: { ...this.headers, Prefer: 'resolution=merge-duplicates' }, timeout: 8000 }
    );

    // 6. Auto-equipar el cosmético comprado
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

    await axios.post(
      `${this.SUPABASE_URL}/rest/v1/user_economy`,
      {
        username: cleanUser,
        coins: newBalance,
        last_daily_reward: today,
        updated_at: new Date().toISOString()
      },
      { headers: { ...this.headers, Prefer: 'resolution=merge-duplicates' }, timeout: 8000 }
    );

    return {
      success: true,
      message: `¡Recompensa diaria reclamada con éxito! +${reward} Rafa Coins 🪙`,
      coinsAdded: reward,
      newBalance
    };
  }
}

export const cosmeticsManager = new CosmeticsManager();
