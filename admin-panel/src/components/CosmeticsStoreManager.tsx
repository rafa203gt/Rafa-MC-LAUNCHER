import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Edit3,
  Trash2,
  Sparkles,
  Coins,
  Crown,
  Zap,
  Shield,
  Flame,
  Search,
  Check,
  X,
  Layers,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Upload,
  Eye,
  Tag
} from 'lucide-react';
import { supabase } from '../supabase';
import { gitHubStorage } from '../github-storage';

export interface AdminShopCosmetic {
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

export const CosmeticsStoreManager: React.FC = () => {
  const [cosmetics, setCosmetics] = useState<AdminShopCosmetic[]>([]);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'cape' | 'wings' | 'hat' | 'bandana'>('all');

  // Modal create/edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminShopCosmetic | null>(null);
  const [formDraft, setFormDraft] = useState<Partial<AdminShopCosmetic>>({
    id: '',
    name: '',
    description: '',
    category: 'cape',
    rarity: 'rare',
    price: 250,
    texture_url: '',
    model_type: 'standard',
    is_animated: false,
    is_featured: false,
    is_active: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingTexture, setUploadingTexture] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load cosmetics and purchase statistics
  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shop_cosmetics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCosmetics(data || []);

      // Count purchases
      const purchasesRes = await supabase.from('user_cosmetics_inventory').select('id', { count: 'exact' });
      setTotalPurchases(purchasesRes.count || 0);
    } catch (err: any) {
      console.warn('Error cargando cosméticos:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormDraft({
      id: `cosmetic-${Date.now().toString(36)}`,
      name: '',
      description: '',
      category: 'cape',
      rarity: 'rare',
      price: 250,
      texture_url: '',
      model_type: 'standard',
      is_animated: false,
      is_featured: false,
      is_active: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: AdminShopCosmetic) => {
    setEditingItem(item);
    setFormDraft({ ...item });
    setIsModalOpen(true);
  };

  // Upload texture file directly to GitHub CDN
  const handleUploadTextureFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingTexture(true);
    try {
      const tag = 'modpack-cosmetics-assets';
      const uploaded = await gitHubStorage.uploadAsset(file, undefined, tag);
      setFormDraft((prev) => ({ ...prev, texture_url: uploaded.url }));
      setNotice({ type: 'success', message: '¡Textura subida exitosamente al CDN!' });
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setNotice({ type: 'error', message: `Error subiendo textura: ${err.message}` });
      setTimeout(() => setNotice(null), 4000);
    } finally {
      setUploadingTexture(false);
    }
  };

  // Save cosmetic (insert or update)
  const handleSaveCosmetic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDraft.name || !formDraft.id || !formDraft.texture_url) {
      setNotice({ type: 'error', message: 'Completa todos los campos obligatorios (ID, Nombre, Textura).' });
      setTimeout(() => setNotice(null), 3000);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        id: formDraft.id.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
        name: formDraft.name.trim(),
        description: formDraft.description || '',
        category: formDraft.category || 'cape',
        rarity: formDraft.rarity || 'rare',
        price: Number(formDraft.price) || 100,
        texture_url: formDraft.texture_url.trim(),
        model_type: formDraft.model_type || 'standard',
        is_animated: Boolean(formDraft.is_animated),
        is_featured: Boolean(formDraft.is_featured),
        is_active: Boolean(formDraft.is_active)
      };

      const { error } = await supabase.from('shop_cosmetics').upsert(payload, { onConflict: 'id' });
      if (error) throw error;

      setNotice({
        type: 'success',
        message: editingItem ? `¡"${payload.name}" actualizado con éxito!` : `¡"${payload.name}" creado con éxito!`
      });
      setTimeout(() => setNotice(null), 3000);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', message: `Error al guardar: ${err.message}` });
      setTimeout(() => setNotice(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete cosmetic
  const handleDeleteCosmetic = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el cosmético "${name}"?`)) return;

    try {
      const { error } = await supabase.from('shop_cosmetics').delete().eq('id', id);
      if (error) throw error;

      setNotice({ type: 'success', message: `Cosmético "${name}" eliminado.` });
      setTimeout(() => setNotice(null), 3000);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', message: `Error al eliminar: ${err.message}` });
      setTimeout(() => setNotice(null), 4000);
    }
  };

  // Toggle active / featured
  const handleToggleField = async (id: string, field: 'is_active' | 'is_featured', currentVal: boolean) => {
    try {
      const { error } = await supabase
        .from('shop_cosmetics')
        .update({ [field]: !currentVal })
        .eq('id', id);
      if (error) throw error;
      setCosmetics((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: !currentVal } : c)));
    } catch (err: any) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return cosmetics.filter((c) => {
      const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [cosmetics, selectedCategory, searchQuery]);

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <Crown className="w-3 h-3" /> Legendario
          </span>
        );
      case 'epic':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Épico
          </span>
        );
      case 'rare':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Raro
          </span>
        );
      case 'common':
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
            <Shield className="w-3 h-3" /> Común
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-mc-card/80 border border-mc-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">Total Cosméticos</span>
            <span className="text-xl font-black text-white font-mono">{cosmetics.length}</span>
          </div>
        </div>

        <div className="bg-mc-card/80 border border-mc-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
          <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">Capas Activas</span>
            <span className="text-xl font-black text-white font-mono">
              {cosmetics.filter((c) => c.category === 'cape' && c.is_active).length}
            </span>
          </div>
        </div>

        <div className="bg-mc-card/80 border border-mc-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">Alas & Sombreros</span>
            <span className="text-xl font-black text-white font-mono">
              {cosmetics.filter((c) => (c.category === 'wings' || c.category === 'hat') && c.is_active).length}
            </span>
          </div>
        </div>

        <div className="bg-mc-card/80 border border-mc-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">Desbloqueos de Jugadores</span>
            <span className="text-xl font-black text-emerald-400 font-mono">{totalPurchases}</span>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-bold border animate-scaleUp ${
            notice.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-300'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-mc-card/80 border border-mc-border/80 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              Gestión de Tienda & Cosméticos
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Crea items para la tienda de Rafa Coins, sube texturas y gestiona precios para todos los jugadores.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2.5 bg-mc-darker hover:bg-white/10 text-slate-300 border border-mc-border/60 rounded-xl transition-all active:scale-95"
              title="Refrescar"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreateModal}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white rounded-xl text-xs font-bold shadow-glow transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Crear Nuevo Cosmético
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-white shadow'
                  : 'bg-mc-darker text-slate-400 hover:text-white border border-mc-border/50'
              }`}
            >
              Todos ({cosmetics.length})
            </button>
            <button
              onClick={() => setSelectedCategory('cape')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === 'cape'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-mc-darker text-slate-400 hover:text-white border border-mc-border/50'
              }`}
            >
              🧣 Capas
            </button>
            <button
              onClick={() => setSelectedCategory('wings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === 'wings'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-mc-darker text-slate-400 hover:text-white border border-mc-border/50'
              }`}
            >
              🪽 Alas
            </button>
            <button
              onClick={() => setSelectedCategory('hat')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === 'hat'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-mc-darker text-slate-400 hover:text-white border border-mc-border/50'
              }`}
            >
              👑 Sombreros
            </button>
            <button
              onClick={() => setSelectedCategory('bandana')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === 'bandana'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-mc-darker text-slate-400 hover:text-white border border-mc-border/50'
              }`}
            >
              🕶️ Bandanas
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o ID..."
              className="w-full bg-mc-darker/80 border border-mc-border/60 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
            />
          </div>
        </div>

        {/* Table / List */}
        <div className="overflow-x-auto border border-mc-border/60 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-mc-border/60 bg-mc-darker/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-3.5">Cosmético</th>
                <th className="p-3.5">Categoría</th>
                <th className="p-3.5">Rareza</th>
                <th className="p-3.5">Precio</th>
                <th className="p-3.5 text-center">Destacado</th>
                <th className="p-3.5 text-center">Estado</th>
                <th className="p-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mc-border/40 text-xs font-medium">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No se encontraron cosméticos en esta categoría.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-black/40 border border-mc-border/60 flex items-center justify-center p-1 shrink-0">
                          {item.texture_url ? (
                            <img
                              src={item.texture_url}
                              alt={item.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/64.png';
                              }}
                            />
                          ) : (
                            <Tag className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-white block">{item.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 block">{item.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className="text-[11px] text-slate-300 font-bold uppercase">{item.category}</span>
                    </td>

                    <td className="p-3.5">{getRarityBadge(item.rarity)}</td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-1 font-mono font-bold text-amber-300">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        {item.price} 🪙
                      </div>
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleField(item.id, 'is_featured', item.is_featured)}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                          item.is_featured
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-white/5 text-slate-500 hover:text-white'
                        }`}
                        title="Alternar Destacado"
                      >
                        <Flame className="w-4 h-4" />
                      </button>
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleField(item.id, 'is_active', item.is_active)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                          item.is_active
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {item.is_active ? 'Disponible' : 'Oculto'}
                      </button>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCosmetic(item.id, item.name)}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#121620] border border-mc-border/80 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp">
            {/* Modal Header */}
            <div className="p-6 border-b border-mc-border/60 flex items-center justify-between bg-mc-darker/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingItem ? 'Editar Cosmético' : 'Crear Nuevo Cosmético'}
                  </h3>
                  <p className="text-xs text-slate-400">Configura los detalles del item para la tienda oficial</p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCosmetic} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">ID Único</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingItem}
                    value={formDraft.id}
                    onChange={(e) => setFormDraft({ ...formDraft, id: e.target.value })}
                    placeholder="ej. cape-fire-dragon"
                    className="w-full bg-black/40 border border-mc-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Nombre Visible</label>
                  <input
                    type="text"
                    required
                    value={formDraft.name}
                    onChange={(e) => setFormDraft({ ...formDraft, name: e.target.value })}
                    placeholder="ej. Capa Dragón de Fuego"
                    className="w-full bg-black/40 border border-mc-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Descripción</label>
                <textarea
                  value={formDraft.description}
                  onChange={(e) => setFormDraft({ ...formDraft, description: e.target.value })}
                  placeholder="Detalles sobre el diseño, lore o efectos del cosmético..."
                  rows={2}
                  className="w-full bg-black/40 border border-mc-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Categoría</label>
                  <select
                    value={formDraft.category}
                    onChange={(e) => setFormDraft({ ...formDraft, category: e.target.value as any })}
                    className="w-full bg-black/40 border border-mc-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="cape">Capa</option>
                    <option value="wings">Alas 3D</option>
                    <option value="hat">Sombrero / Corona</option>
                    <option value="bandana">Bandana / Máscara</option>
                    <option value="pet">Mascota</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Rareza</label>
                  <select
                    value={formDraft.rarity}
                    onChange={(e) => setFormDraft({ ...formDraft, rarity: e.target.value as any })}
                    className="w-full bg-black/40 border border-mc-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="common">Común</option>
                    <option value="rare">Raro</option>
                    <option value="epic">Épico</option>
                    <option value="legendary">Legendario</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Precio (Rafa Coins)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formDraft.price}
                    onChange={(e) => setFormDraft({ ...formDraft, price: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-mc-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">URL de Textura PNG</label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    required
                    value={formDraft.texture_url}
                    onChange={(e) => setFormDraft({ ...formDraft, texture_url: e.target.value })}
                    placeholder="https://textures.minecraft.net/texture/..."
                    className="flex-1 bg-black/40 border border-mc-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <label className="cursor-pointer px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-mc-border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingTexture ? 'Subiendo...' : 'Subir'}</span>
                    <input type="file" accept="image/png" className="hidden" onChange={handleUploadTextureFile} />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formDraft.is_featured}
                    onChange={(e) => setFormDraft({ ...formDraft, is_featured: e.target.checked })}
                    className="rounded text-amber-500 focus:ring-amber-500"
                  />
                  <span>Destacar en Portada</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formDraft.is_active}
                    onChange={(e) => setFormDraft({ ...formDraft, is_active: e.target.checked })}
                    className="rounded text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Activo para Compra</span>
                </label>
              </div>

              <div className="pt-4 border-t border-mc-border/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-mc-darker hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white rounded-xl text-xs font-bold shadow-glow transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : editingItem ? 'Guardar Cambios' : 'Crear Cosmético'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
