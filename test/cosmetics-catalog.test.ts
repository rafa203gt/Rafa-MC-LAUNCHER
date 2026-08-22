import { describe, it, expect, beforeEach } from 'vitest';
import { CosmeticsManager } from '../src/main/cosmetics-manager';

describe('Cosmetics Real & Functional Catalog Tests', () => {
  let cosmeticsMgr: CosmeticsManager;

  beforeEach(() => {
    cosmeticsMgr = new CosmeticsManager();
  });

  it('debe contener un catálogo de cosméticos reales y activos', async () => {
    const catalog = await cosmeticsMgr.getCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(1);

    // Validar que cada cosmético tenga campos obligatorios bien estructurados
    for (const item of catalog) {
      expect(['cape', 'wings', 'hat', 'bandana', 'pet']).toContain(item.category);
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.texture_url).toBeTruthy();
    }
  });

  it('debe incluir cosméticos funcionales con texturas reales', async () => {
    const catalog = await cosmeticsMgr.getCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(1);
    for (const item of catalog) {
      expect(item.texture_url).toBeTruthy();
      expect(item.texture_url.length).toBeGreaterThan(5);
    }
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
