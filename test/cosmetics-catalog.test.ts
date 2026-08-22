import { describe, it, expect, beforeEach } from 'vitest';
import { CosmeticsManager } from '../src/main/cosmetics-manager';

describe('Cosmetics 50+ Community Catalog Tests', () => {
  let cosmeticsMgr: CosmeticsManager;

  beforeEach(() => {
    cosmeticsMgr = new CosmeticsManager();
  });

  it('debe contener un catálogo extenso con más de 30 cosméticos activos', async () => {
    const catalog = await cosmeticsMgr.getCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(30);

    // Validar que existan cosméticos en todas las categorías principales
    const categories = new Set(catalog.map((c) => c.category));
    expect(categories.has('cape')).toBe(true);
    expect(categories.has('wings')).toBe(true);
    expect(categories.has('hat')).toBe(true);
    expect(categories.has('bandana')).toBe(true);
  });

  it('debe incluir cosméticos exclusivos de Rafa Launcher', async () => {
    const catalog = await cosmeticsMgr.getCatalog();
    const rafaCosmetics = catalog.filter((c) => c.id.includes('rafa'));
    expect(rafaCosmetics.length).toBeGreaterThanOrEqual(3);
  });

  it('debe tener precios y rarezas válidos en todos los items', async () => {
    const catalog = await cosmeticsMgr.getCatalog();
    for (const item of catalog) {
      expect(item.price).toBeGreaterThan(0);
      expect(['common', 'rare', 'epic', 'legendary']).toContain(item.rarity);
      expect(item.texture_url).toBeTruthy();
    }
  });
});
