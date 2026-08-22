import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CosmeticsManager } from '../src/main/cosmetics-manager';

describe('CosmeticsManager & Economy Unit Tests', () => {
  let cosmeticsMgr: CosmeticsManager;

  beforeEach(() => {
    cosmeticsMgr = new CosmeticsManager();
  });

  it('debe poder obtener el catálogo de cosméticos activos', async () => {
    const catalog = await cosmeticsMgr.getCatalog();
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog[0]).toHaveProperty('id');
    expect(catalog[0]).toHaveProperty('name');
    expect(catalog[0]).toHaveProperty('price');
    expect(catalog[0]).toHaveProperty('category');
  });

  it('debe inicializar la economía del jugador con balance inicial de Rafa Coins', async () => {
    const economy = await cosmeticsMgr.getUserEconomy('TestPlayer_' + Date.now());
    expect(economy).toBeDefined();
    expect(economy.coins).toBeGreaterThanOrEqual(0);
  });

  it('debe poder obtener el inventario de cosméticos del jugador', async () => {
    const inv = await cosmeticsMgr.getUserInventory('TestPlayer_Inventory');
    expect(Array.isArray(inv)).toBe(true);
  });

  it('debe permitir equipar y desequipar slots de cosméticos (Capa, Alas, Sombreros, Bandanas)', async () => {
    const testUser = 'TestEquipUser_' + Date.now();
    const equipped = await cosmeticsMgr.getUserEquipped(testUser);
    expect(equipped).toBeDefined();
    expect(equipped.username).toBe(testUser);

    // Equipar alas activas
    const updated = await cosmeticsMgr.equipCosmetic(testUser, 'wings', 'wings-fallen-angel-void');
    expect(updated.wings_id).toBe('wings-fallen-angel-void');

    // Desequipar alas
    const unequipped = await cosmeticsMgr.equipCosmetic(testUser, 'wings', null);
    expect(unequipped.wings_id).toBeNull();
  });

  it('debe mantener las monedas e inventario al cambiar de nickname en el mismo equipo', async () => {
    const originalName = 'InitialPlayer_' + Date.now();
    const eco1 = await cosmeticsMgr.getUserEconomy(originalName);
    expect(eco1.coins).toBeGreaterThanOrEqual(500);

    const changedName = 'RenamedPlayer_' + Date.now();
    const eco2 = await cosmeticsMgr.getUserEconomy(changedName);
    // El mismo equipo conserva su balance completo
    expect(eco2.coins).toBe(eco1.coins);
    expect(eco2.client_id).toBe(eco1.client_id);
  });
});
