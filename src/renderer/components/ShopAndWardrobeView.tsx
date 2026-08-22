import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SkinViewer,
  WalkingAnimation,
  RunningAnimation,
  FlyingAnimation,
  IdleAnimation,
  WaveAnimation
} from 'skinview3d';
import {
  ShoppingBag,
  Sparkles,
  Shirt,
  Coins,
  Gift,
  Check,
  Shield,
  Zap,
  Star,
  Flame,
  Search,
  Filter,
  Layers,
  RotateCw,
  Eye,
  Camera,
  Play,
  Pause,
  Crown,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { ShopCosmetic, UserEquippedCosmetics, UserEconomy } from '../types';
import { Cosmetics3DRenderer } from '../utils/cosmetics3d';

interface ShopAndWardrobeViewProps {
  currentUsername: string;
}

export const ShopAndWardrobeView: React.FC<ShopAndWardrobeViewProps> = ({ currentUsername }) => {
  // Navigation & Subtabs
  const [subTab, setSubTab] = useState<'shop' | 'wardrobe'>('shop');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'cape' | 'wings' | 'hat' | 'bandana'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data state
  const [catalog, setCatalog] = useState<ShopCosmetic[]>([]);
  const [inventory, setInventory] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<UserEquippedCosmetics>({
    username: currentUsername,
    cape_id: null,
    wings_id: null,
    hat_id: null,
    bandana_id: null
  });
  const [economy, setEconomy] = useState<UserEconomy>({
    username: currentUsername,
    coins: 500,
    playtime_minutes: 0,
    last_daily_reward: ''
  });

  // UI action states
  const [previewCosmetic, setPreviewCosmetic] = useState<ShopCosmetic | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuyingId, setIsBuyingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 3D Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const cosmeticsRendererRef = useRef<Cosmetics3DRenderer | null>(null);
  const [animationType, setAnimationType] = useState<'idle' | 'walk' | 'run' | 'fly' | 'wave'>('idle');
  const [isPaused, setIsPaused] = useState(false);

  // Clean username
  const cleanUsername = currentUsername.trim() || 'Jugador';

  // Load all initial data from main process / Supabase
  const loadData = async () => {
    setIsLoading(true);
    try {
      if (window.launcherAPI?.getCosmeticsCatalog) {
        const cat = await window.launcherAPI.getCosmeticsCatalog();
        setCatalog(cat);
      }
      if (window.launcherAPI?.getUserCosmeticsInventory) {
        const inv = await window.launcherAPI.getUserCosmeticsInventory(cleanUsername);
        setInventory(inv);
      }
      if (window.launcherAPI?.getUserEquippedCosmetics) {
        const eq = await window.launcherAPI.getUserEquippedCosmetics(cleanUsername);
        setEquipped(eq);
      }
      if (window.launcherAPI?.getUserEconomy) {
        const eco = await window.launcherAPI.getUserEconomy(cleanUsername);
        setEconomy(eco);
      }
    } catch (err: any) {
      console.warn('Error loading cosmetics data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [cleanUsername]);

  // Initialize 3D Viewer
  useEffect(() => {
    if (!canvasRef.current) return;

    if (cosmeticsRendererRef.current) {
      cosmeticsRendererRef.current.dispose();
      cosmeticsRendererRef.current = null;
    }

    if (viewerRef.current) {
      viewerRef.current.dispose();
      viewerRef.current = null;
    }

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: 320,
      height: 420,
      skin: `https://minotar.net/skin/${encodeURIComponent(cleanUsername)}`
    });

    viewer.fov = 70;
    viewer.zoom = 0.9;
    viewer.controls.enableRotate = true;
    viewer.controls.enableZoom = true;
    viewer.controls.enablePan = false;

    // Apply animation
    const anim = new IdleAnimation();
    viewer.animation = anim;

    viewerRef.current = viewer;
    cosmeticsRendererRef.current = new Cosmetics3DRenderer(viewer);

    return () => {
      if (cosmeticsRendererRef.current) {
        cosmeticsRendererRef.current.dispose();
        cosmeticsRendererRef.current = null;
      }
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [cleanUsername]);

  // Update 3D Viewer skin & all 3D cosmetics when preview/equipped/catalog changes
  useEffect(() => {
    if (!viewerRef.current || !cosmeticsRendererRef.current) return;

    // Resolver items activos por slot
    const activeCape =
      previewCosmetic?.category === 'cape'
        ? previewCosmetic
        : equipped.cape || catalog.find((c) => c.id === equipped.cape_id) || null;

    const activeWings =
      previewCosmetic?.category === 'wings'
        ? previewCosmetic
        : equipped.wings || catalog.find((c) => c.id === equipped.wings_id) || null;

    const activeHat =
      previewCosmetic?.category === 'hat'
        ? previewCosmetic
        : equipped.hat || catalog.find((c) => c.id === equipped.hat_id) || null;

    const activeBandana =
      previewCosmetic?.category === 'bandana'
        ? previewCosmetic
        : equipped.bandana || catalog.find((c) => c.id === equipped.bandana_id) || null;

    cosmeticsRendererRef.current.updateCosmetics(activeCape, activeWings, activeHat, activeBandana);
  }, [equipped, previewCosmetic, catalog]);

  // Handle animation changes
  const handleSetAnimation = (type: 'idle' | 'walk' | 'run' | 'fly' | 'wave') => {
    if (!viewerRef.current) return;
    setAnimationType(type);
    setIsPaused(false);

    let anim: any;
    switch (type) {
      case 'walk':
        anim = new WalkingAnimation();
        break;
      case 'run':
        anim = new RunningAnimation();
        break;
      case 'fly':
        anim = new FlyingAnimation();
        break;
      case 'wave':
        anim = new WaveAnimation();
        break;
      case 'idle':
      default:
        anim = new IdleAnimation();
        break;
    }
    viewerRef.current.animation = anim;
  };

  const handleTogglePause = () => {
    if (!viewerRef.current) return;
    if (viewerRef.current.animation) {
      viewerRef.current.animation.paused = !viewerRef.current.animation.paused;
      setIsPaused(viewerRef.current.animation.paused);
    }
  };

  const handleResetRotation = () => {
    if (!viewerRef.current) return;
    viewerRef.current.controls.reset();
  };

  // Buy cosmetic action
  const handleBuyCosmetic = async (cosmetic: ShopCosmetic) => {
    if (economy.coins < cosmetic.price) {
      setNotice({
        type: 'error',
        message: `No tienes suficientes Rafa Coins. Necesitas ${cosmetic.price} 🪙 y tienes ${economy.coins} 🪙.`
      });
      setTimeout(() => setNotice(null), 4000);
      return;
    }

    setIsBuyingId(cosmetic.id);
    try {
      if (window.launcherAPI?.buyCosmetic) {
        const res = await window.launcherAPI.buyCosmetic(cleanUsername, cosmetic.id);
        if (res.success) {
          setInventory((prev) => [...prev, cosmetic.id]);
          setEconomy((prev) => ({ ...prev, coins: res.remainingCoins }));
          setNotice({ type: 'success', message: res.message });
          setTimeout(() => setNotice(null), 4000);
          await loadData();
        }
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Error al procesar la compra' });
      setTimeout(() => setNotice(null), 4000);
    } finally {
      setIsBuyingId(null);
    }
  };

  // Equip / Unequip cosmetic slot
  const handleEquipSlot = async (slot: 'cape' | 'wings' | 'hat' | 'bandana', cosmeticId: string | null) => {
    try {
      if (window.launcherAPI?.equipCosmetic) {
        const updated = await window.launcherAPI.equipCosmetic(cleanUsername, slot, cosmeticId);
        setEquipped(updated);
        setNotice({
          type: 'success',
          message: cosmeticId ? `¡Cosmético equipado con éxito en ${slot.toUpperCase()}!` : `Cosmético desequipado de ${slot.toUpperCase()}.`
        });
        setTimeout(() => setNotice(null), 3000);
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
      setTimeout(() => setNotice(null), 3000);
    }
  };

  // Claim daily coins
  const handleClaimDaily = async () => {
    try {
      if (window.launcherAPI?.claimDailyCoins) {
        const res = await window.launcherAPI.claimDailyCoins(cleanUsername);
        if (res.success) {
          setEconomy((prev) => ({
            ...prev,
            coins: res.newBalance,
            last_daily_reward: new Date().toISOString().split('T')[0]
          }));
          setNotice({ type: 'success', message: res.message });
          setTimeout(() => setNotice(null), 4000);
        }
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const isTodayClaimed = economy.last_daily_reward === new Date().toISOString().split('T')[0];

  // Filtered Catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.rarity.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [catalog, selectedCategory, searchQuery]);

  // Owned Cosmetics list for Wardrobe
  const ownedCosmetics = useMemo(() => {
    return catalog.filter((item) => inventory.includes(item.id));
  }, [catalog, inventory]);

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-glow">
            <Crown className="w-3 h-3" /> Legendario
          </span>
        );
      case 'epic':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 shadow-glow">
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
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header Banner: Economy & Daily Claim */}
      <div className="bg-gradient-to-r from-[#141926] via-[#1a2236] to-[#0f141f] border border-mc-border/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-glow shrink-0">
            <Coins className="w-7 h-7 text-white animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">Tienda de Cosméticos & Armario</h2>
              <span className="text-[10px] px-2.5 py-0.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/30 rounded-full font-bold">
                Lunar Style
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Personaliza a <span className="text-white font-bold">{cleanUsername}</span> con capas exclusivas, alas 3D y accesorios.
            </p>
          </div>
        </div>

        {/* Economy Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 bg-black/40 hover:bg-black/60 border border-mc-border/60 text-slate-300 hover:text-white rounded-2xl text-xs font-bold transition-all shadow-inner active:scale-95 flex items-center gap-1.5"
            title="Recargar saldo y catálogo"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <div className="bg-black/50 border border-amber-500/40 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-inner">
            <Coins className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tus Rafa Coins</span>
              <span className="text-lg font-black text-amber-300 font-mono">{economy.coins.toLocaleString()} 🪙</span>
            </div>
          </div>

          <button
            onClick={handleClaimDaily}
            disabled={isTodayClaimed}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              isTodayClaimed
                ? 'bg-mc-darker/80 text-slate-500 border border-mc-border cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white shadow-glow'
            }`}
          >
            <Gift className="w-4 h-4" />
            {isTodayClaimed ? 'Reclamado Hoy' : 'Recompensa Diaria (+100 🪙)'}
          </button>
        </div>
      </div>

      {/* Notifications Alert */}
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

      {/* Main Grid: 3D Stage (Left) + Catalog / Wardrobe (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 3D Live Fitting Stage */}
        <div className="lg:col-span-5 bg-[#10141f] border border-mc-border/80 rounded-3xl p-5 shadow-xl flex flex-col items-center sticky top-20">
          <div className="w-full flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-slate-200">Probador 3D en Vivo</span>
            </div>
            {previewCosmetic && (
              <button
                onClick={() => setPreviewCosmetic(null)}
                className="text-[10px] text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-lg transition-colors"
              >
                Restablecer Vista
              </button>
            )}
          </div>

          {/* Canvas Wrapper */}
          <div className="relative w-full aspect-[4/5] max-h-[420px] bg-gradient-to-b from-[#181f30] to-[#0c0f17] border border-mc-border/60 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner group">
            <canvas ref={canvasRef} className="cursor-grab active:cursor-grabbing w-full h-full" />

            {/* Preview Active Tag */}
            {previewCosmetic && (
              <div className="absolute top-3 left-3 bg-purple-500/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-xl shadow-glow border border-purple-300/40">
                Probando: {previewCosmetic.name}
              </div>
            )}

            {/* Controls overlay */}
            <div className="absolute bottom-3 inset-x-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-2 flex items-center justify-between gap-1 text-slate-300">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSetAnimation('idle')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                    animationType === 'idle' ? 'bg-emerald-500 text-white' : 'hover:bg-white/10'
                  }`}
                >
                  Reposo
                </button>
                <button
                  onClick={() => handleSetAnimation('walk')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                    animationType === 'walk' ? 'bg-emerald-500 text-white' : 'hover:bg-white/10'
                  }`}
                >
                  Caminar
                </button>
                <button
                  onClick={() => handleSetAnimation('run')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                    animationType === 'run' ? 'bg-emerald-500 text-white' : 'hover:bg-white/10'
                  }`}
                >
                  Correr
                </button>
                <button
                  onClick={() => handleSetAnimation('fly')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                    animationType === 'fly' ? 'bg-emerald-500 text-white' : 'hover:bg-white/10'
                  }`}
                >
                  Volar
                </button>
              </div>

              <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                <button onClick={handleTogglePause} className="p-1 rounded hover:bg-white/10" title="Pausar / Reanudar">
                  {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
                <button onClick={handleResetRotation} className="p-1 rounded hover:bg-white/10" title="Resetear Cámara">
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Currently Equipped Slots Preview in Left Column */}
          <div className="w-full mt-4 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
              Equipamiento Actual
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-mc-darker/60 border border-mc-border/60 rounded-xl p-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block">Capa</span>
                  <span className="text-xs font-bold text-white truncate block">
                    {equipped.cape?.name || 'Ninguna'}
                  </span>
                </div>
                {equipped.cape_id && (
                  <button
                    onClick={() => handleEquipSlot('cape', null)}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold ml-1 shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>

              <div className="bg-mc-darker/60 border border-mc-border/60 rounded-xl p-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block">Alas 3D</span>
                  <span className="text-xs font-bold text-white truncate block">
                    {equipped.wings?.name || 'Ninguna'}
                  </span>
                </div>
                {equipped.wings_id && (
                  <button
                    onClick={() => handleEquipSlot('wings', null)}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold ml-1 shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>

              <div className="bg-mc-darker/60 border border-mc-border/60 rounded-xl p-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block">Sombrero</span>
                  <span className="text-xs font-bold text-white truncate block">
                    {equipped.hat?.name || 'Ninguno'}
                  </span>
                </div>
                {equipped.hat_id && (
                  <button
                    onClick={() => handleEquipSlot('hat', null)}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold ml-1 shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>

              <div className="bg-mc-darker/60 border border-mc-border/60 rounded-xl p-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block">Bandana</span>
                  <span className="text-xs font-bold text-white truncate block">
                    {equipped.bandana?.name || 'Ninguna'}
                  </span>
                </div>
                {equipped.bandana_id && (
                  <button
                    onClick={() => handleEquipSlot('bandana', null)}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold ml-1 shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Catalog / Wardrobe Explorer */}
        <div className="lg:col-span-7 space-y-5">
          {/* Subtabs Switcher & Search Bar */}
          <div className="bg-[#10141f] border border-mc-border/80 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-mc-border/60 w-full sm:w-auto">
              <button
                onClick={() => {
                  setSubTab('shop');
                  setPreviewCosmetic(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  subTab === 'shop'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Tienda de Items
              </button>

              <button
                onClick={() => {
                  setSubTab('wardrobe');
                  setPreviewCosmetic(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  subTab === 'wardrobe'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shirt className="w-3.5 h-3.5" />
                Mi Armario ({ownedCosmetics.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cosmético..."
                className="w-full bg-black/40 border border-mc-border/60 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-mc-darker/60 text-slate-400 hover:text-white border border-mc-border/50'
              }`}
            >
              Todos ({subTab === 'shop' ? catalog.length : ownedCosmetics.length})
            </button>
            <button
              onClick={() => setSelectedCategory('cape')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedCategory === 'cape'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-mc-darker/60 text-slate-400 hover:text-white border border-mc-border/50'
              }`}
            >
              🧣 Capas
            </button>
            <button
              onClick={() => setSelectedCategory('wings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedCategory === 'wings'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-mc-darker/60 text-slate-400 hover:text-white border border-mc-border/50'
              }`}
            >
              🪽 Alas 3D
            </button>
            <button
              onClick={() => setSelectedCategory('hat')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedCategory === 'hat'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-mc-darker/60 text-slate-400 hover:text-white border border-mc-border/50'
              }`}
            >
              👑 Sombreros
            </button>
            <button
              onClick={() => setSelectedCategory('bandana')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedCategory === 'bandana'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-mc-darker/60 text-slate-400 hover:text-white border border-mc-border/50'
              }`}
            >
              🕶️ Bandanas
            </button>
          </div>

          {/* Cards Grid */}
          {isLoading ? (
            <div className="bg-[#10141f] border border-mc-border/60 rounded-2xl p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
              <p className="text-xs font-bold text-slate-400">Cargando cosméticos desde la nube...</p>
            </div>
          ) : subTab === 'shop' ? (
            /* SHOP TAB ITEMS */
            filteredCatalog.length === 0 ? (
              <div className="bg-[#10141f] border border-dashed border-mc-border/80 rounded-2xl p-12 text-center space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No se encontraron cosméticos</p>
                <p className="text-xs text-slate-500">Prueba ajustando el filtro de categoría o búsqueda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredCatalog.map((item) => {
                  const isOwned = inventory.includes(item.id);
                  const isEquipped =
                    equipped.cape_id === item.id ||
                    equipped.wings_id === item.id ||
                    equipped.hat_id === item.id ||
                    equipped.bandana_id === item.id;
                  const isPreviewing = previewCosmetic?.id === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`group bg-[#10141f] border rounded-2xl p-4 transition-all flex flex-col justify-between relative overflow-hidden ${
                        isPreviewing
                          ? 'border-purple-500/80 shadow-glow bg-purple-500/5'
                          : 'border-mc-border/70 hover:border-slate-500 hover:bg-white/5'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        {getRarityBadge(item.rarity)}
                        {item.is_featured && (
                          <span className="text-[9px] bg-red-500/20 text-red-300 font-bold px-2 py-0.5 rounded-full border border-red-500/30 flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> Destacado
                          </span>
                        )}
                      </div>

                      {/* Visual Cosmetic Preview / Photo Banner */}
                      <div className="w-full h-28 rounded-xl bg-black/50 border border-mc-border/60 p-2.5 flex items-center justify-center relative overflow-hidden mb-3 group-hover:border-amber-500/50 transition-colors">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                        {item.texture_url ? (
                          <img
                            src={item.texture_url}
                            alt={item.name}
                            className="max-h-20 max-w-full object-contain rounded filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)] image-rendering-pixelated group-hover:scale-110 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/64.png';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                            <ShoppingBag className="w-6 h-6" />
                          </div>
                        )}
                        <span className="absolute bottom-1.5 left-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                          {item.category}
                        </span>
                      </div>

                      {/* Item Details */}
                      <div className="space-y-1 mb-4 flex-1">
                        <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                          {item.name}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.description}</p>
                      </div>

                      {/* Action Buttons & Price */}
                      <div className="pt-3 border-t border-mc-border/50 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-amber-400" />
                          <span className="text-sm font-black text-amber-300 font-mono">{item.price} 🪙</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Live 3D Preview button */}
                          <button
                            onClick={() => setPreviewCosmetic(isPreviewing ? null : item)}
                            className={`p-2 rounded-xl text-xs font-bold transition-all border ${
                              isPreviewing
                                ? 'bg-purple-600 text-white border-purple-400 shadow-glow'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-mc-border/60'
                            }`}
                            title="Probar en el modelo 3D"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Buy or Owned Status Button */}
                          {isOwned ? (
                            <button
                              onClick={() => handleEquipSlot(item.category as any, isEquipped ? null : item.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow ${
                                isEquipped
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-red-500/20 hover:text-red-300'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                            >
                              {isEquipped ? <Check className="w-3 h-3" /> : null}
                              {isEquipped ? 'Equipado' : 'Equipar'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBuyCosmetic(item)}
                              disabled={isBuyingId === item.id}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white rounded-xl text-xs font-bold shadow-glow transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                            >
                              {isBuyingId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ShoppingBag className="w-3.5 h-3.5" />
                              )}
                              Comprar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* WARDROBE TAB ITEMS */
            ownedCosmetics.length === 0 ? (
              <div className="bg-[#10141f] border border-dashed border-mc-border/80 rounded-2xl p-12 text-center space-y-3">
                <Shirt className="w-8 h-8 text-slate-500 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-300">Tu armario está vacío</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Explora la pestaña "Tienda" para desbloquear capas, alas y sombreros con tus Rafa Coins.
                  </p>
                </div>
                <button
                  onClick={() => setSubTab('shop')}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white rounded-xl text-xs font-bold shadow transition-all hover:scale-105"
                >
                  Ir a la Tienda de Items
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ownedCosmetics.map((item) => {
                  const isEquipped =
                    equipped.cape_id === item.id ||
                    equipped.wings_id === item.id ||
                    equipped.hat_id === item.id ||
                    equipped.bandana_id === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`bg-[#10141f] border rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 ${
                        isEquipped
                          ? 'border-emerald-500/60 bg-emerald-500/5 shadow-glow'
                          : 'border-mc-border/70 hover:border-slate-500 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {getRarityBadge(item.rarity)}
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Slot: {item.category.toUpperCase()}
                        </span>
                      </div>

                      {/* Visual Preview in Wardrobe Card */}
                      <div className="w-full h-24 rounded-xl bg-black/50 border border-mc-border/60 p-2 flex items-center justify-center relative overflow-hidden">
                        {item.texture_url ? (
                          <img
                            src={item.texture_url}
                            alt={item.name}
                            className="max-h-16 max-w-full object-contain rounded image-rendering-pixelated drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/64.png';
                            }}
                          />
                        ) : (
                          <ShoppingBag className="w-6 h-6 text-slate-500" />
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-white">{item.name}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{item.description}</p>
                      </div>

                      <div className="pt-2 border-t border-mc-border/50 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setPreviewCosmetic(item)}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 border border-mc-border/50"
                        >
                          <Eye className="w-3 h-3" /> Probar 3D
                        </button>

                        <button
                          onClick={() => handleEquipSlot(item.category as any, isEquipped ? null : item.id)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow ${
                            isEquipped
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow'
                          }`}
                        >
                          {isEquipped ? 'Desequipar' : 'Equipar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
