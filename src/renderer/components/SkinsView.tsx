import React, { useState, useEffect, useRef } from 'react';
import {
  SkinViewer,
  WalkingAnimation,
  RunningAnimation,
  FlyingAnimation,
  IdleAnimation,
  WaveAnimation
} from 'skinview3d';
import {
  User,
  Upload,
  Download,
  RotateCw,
  Sparkles,
  CheckCircle2,
  Palette,
  Eye,
  Camera,
  Play,
  Pause,
  Layers,
  Search,
  Flame,
  Tv,
  Sword,
  Bot,
  Cat,
  Zap,
  Tag,
  ShieldAlert,
  FolderOpen
} from 'lucide-react';

interface SkinsViewProps {
  currentUsername: string;
  onUsernameChange?: (username: string) => void;
}

export interface CatalogSkin {
  id: string;
  name: string;
  category: 'trending' | 'anime' | 'fantasy' | 'creators' | 'cyber' | 'mobs';
  usernameOrUrl: string;
  model: 'default' | 'slim';
  author: string;
  capeUrl?: string;
}

const SKIN_CATALOG: CatalogSkin[] = [
  // 🔥 TENDENCIAS
  { id: 't1', name: 'Steve Clásico', category: 'trending', usernameOrUrl: 'Steve', model: 'default', author: 'Mojang' },
  { id: 't2', name: 'Alex Exploradora', category: 'trending', usernameOrUrl: 'Alex', model: 'slim', author: 'Mojang' },
  { id: 't3', name: 'Technoblade King', category: 'trending', usernameOrUrl: 'Technoblade', model: 'default', author: 'Techno', capeUrl: 'https://textures.minecraft.net/texture/b621415777174e98f4e64f89d3ea3d2f9b8dd986c75cc9e5f1b5bc16e88a0ab8' },
  { id: 't4', name: 'Dream Smile', category: 'trending', usernameOrUrl: 'Dream', model: 'default', author: 'Dream' },
  { id: 't5', name: 'Notch Legend', category: 'trending', usernameOrUrl: 'Notch', model: 'default', author: 'Mojang' },
  { id: 't6', name: 'Jeb_ Developer', category: 'trending', usernameOrUrl: 'jeb_', model: 'default', author: 'Mojang' },

  // 🎬 ANIME & SERIES
  { id: 'a1', name: 'Goku Super Saiyan', category: 'anime', usernameOrUrl: 'Goku', model: 'default', author: 'Dragon Ball' },
  { id: 'a2', name: 'Naruto Uzumaki', category: 'anime', usernameOrUrl: 'Naruto', model: 'default', author: 'Naruto' },
  { id: 'a3', name: 'Tanjiro Kamado', category: 'anime', usernameOrUrl: 'Tanjiro', model: 'default', author: 'Demon Slayer' },
  { id: 'a4', name: 'Gojo Satoru', category: 'anime', usernameOrUrl: 'Gojo', model: 'slim', author: 'Jujutsu Kaisen' },
  { id: 'a5', name: 'Monkey D. Luffy', category: 'anime', usernameOrUrl: 'Luffy', model: 'default', author: 'One Piece' },
  { id: 'a6', name: 'Levi Ackerman', category: 'anime', usernameOrUrl: 'Levi', model: 'slim', author: 'AOT' },

  // ⚔️ GUERREROS & FANTASÍA
  { id: 'f1', name: 'Paladín Sagrado', category: 'fantasy', usernameOrUrl: 'Paladin', model: 'default', author: 'Fantasy Realm' },
  { id: 'f2', name: 'Nigromante del Vacío', category: 'fantasy', usernameOrUrl: 'Necromancer', model: 'default', author: 'Dark Arts' },
  { id: 'f3', name: 'Asesino de Sombras', category: 'fantasy', usernameOrUrl: 'Assassin', model: 'slim', author: 'Shadow Guild' },
  { id: 'f4', name: 'Elfo Guardián', category: 'fantasy', usernameOrUrl: 'Elf', model: 'slim', author: 'Mystic Forest' },
  { id: 'f5', name: 'Caballero Dragón', category: 'fantasy', usernameOrUrl: 'DragonKnight', model: 'default', author: 'Draconic' },
  { id: 'f6', name: 'Vikingo Berserker', category: 'fantasy', usernameOrUrl: 'Viking', model: 'default', author: 'Nordic' },

  // 🎮 STREAMERS & YOUTUBERS
  { id: 'c1', name: 'Vegetta777 Morado', category: 'creators', usernameOrUrl: 'Vegetta777', model: 'default', author: 'Karmaland' },
  { id: 'c2', name: 'Auronplay Traje', category: 'creators', usernameOrUrl: 'Auronplay', model: 'default', author: 'Tortillaland' },
  { id: 'c3', name: 'ElRubiusOMG', category: 'creators', usernameOrUrl: 'Rubius', model: 'default', author: 'Madkat' },
  { id: 'c4', name: 'Ibai Rey de la Noche', category: 'creators', usernameOrUrl: 'Ibai', model: 'default', author: 'KOI' },
  { id: 'c5', name: 'IlloJuan Camiseta', category: 'creators', usernameOrUrl: 'IlloJuan', model: 'default', author: 'Málaga' },
  { id: 'c6', name: 'Spreen Pato', category: 'creators', usernameOrUrl: 'Spreen', model: 'default', author: 'SpreenDMC' },
  { id: 'c7', name: 'DanTDM Classic', category: 'creators', usernameOrUrl: 'DanTDM', model: 'default', author: 'The Diamond Minecart' },
  { id: 'c8', name: 'Mumbo Jumbo Traje', category: 'creators', usernameOrUrl: 'Mumbo', model: 'default', author: 'Hermitcraft' },

  // 🤖 CYBER & SCI-FI
  { id: 's1', name: 'Cyber Samurai 2077', category: 'cyber', usernameOrUrl: 'CyberSamurai', model: 'default', author: 'NeoTokyo' },
  { id: 's2', name: 'Androide Neón', category: 'cyber', usernameOrUrl: 'NeonAndroid', model: 'slim', author: 'CyberCity' },
  { id: 's3', name: 'Space Marine', category: 'cyber', usernameOrUrl: 'SpaceMarine', model: 'default', author: 'Galactic Empire' },
  { id: 's4', name: 'Hacker Anon', category: 'cyber', usernameOrUrl: 'Hacker', model: 'default', author: 'DarkNet' },

  // 🐾 CRIATURAS & MONSTRUOS
  { id: 'm1', name: 'Ender Lord Volumétrico', category: 'mobs', usernameOrUrl: 'EnderLord', model: 'default', author: 'The End' },
  { id: 'm2', name: 'Rey Creeper de Gala', category: 'mobs', usernameOrUrl: 'CreeperKing', model: 'default', author: 'Overworld' },
  { id: 'm3', name: 'Ajolote Explorador', category: 'mobs', usernameOrUrl: 'Axolotl', model: 'slim', author: 'Lush Caves' },
  { id: 'm4', name: 'Panda Maestro', category: 'mobs', usernameOrUrl: 'Panda', model: 'default', author: 'Bamboo Forest' }
];

export const SkinsView: React.FC<SkinsViewProps> = ({ currentUsername, onUsernameChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const skinViewerRef = useRef<SkinViewer | null>(null);

  // States
  const [activeCategory, setActiveCategory] = useState<'all' | 'trending' | 'anime' | 'fantasy' | 'creators' | 'cyber' | 'mobs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customSearchName, setCustomSearchName] = useState(currentUsername || '');
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'default' | 'slim'>('default');
  const [currentSkinUrl, setCurrentSkinUrl] = useState<string>(
    `https://minotar.net/skin/${encodeURIComponent(currentUsername || 'Steve')}`
  );
  const [currentCapeUrl, setCurrentCapeUrl] = useState<string | null>(null);
  const [activeSkinName, setActiveSkinName] = useState<string>(currentUsername || 'Steve Clásico');

  // Animation & View States
  const [activeAnimation, setActiveAnimation] = useState<'idle' | 'walk' | 'run' | 'wave' | 'fly' | 'none'>('idle');
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [showOuterLayers, setShowOuterLayers] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initialize SkinViewer
  useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: 320,
      height: 400,
      skin: currentSkinUrl,
      model: selectedModel
    });

    viewer.fov = 70;
    viewer.zoom = 0.9;
    viewer.autoRotate = isAutoRotating;
    viewer.autoRotateSpeed = 0.8;
    viewer.animation = new IdleAnimation();

    skinViewerRef.current = viewer;

    return () => {
      viewer.dispose();
      skinViewerRef.current = null;
    };
  }, []);

  // Update Animation
  useEffect(() => {
    const viewer = skinViewerRef.current;
    if (!viewer) return;

    switch (activeAnimation) {
      case 'idle':
        viewer.animation = new IdleAnimation();
        break;
      case 'walk':
        viewer.animation = new WalkingAnimation();
        break;
      case 'run':
        viewer.animation = new RunningAnimation();
        break;
      case 'wave':
        viewer.animation = new WaveAnimation();
        break;
      case 'fly':
        viewer.animation = new FlyingAnimation();
        break;
      case 'none':
        viewer.animation = null;
        break;
    }
  }, [activeAnimation]);

  // Update Auto-Rotate
  useEffect(() => {
    if (skinViewerRef.current) {
      skinViewerRef.current.autoRotate = isAutoRotating;
    }
  }, [isAutoRotating]);

  // Update Layers
  useEffect(() => {
    if (skinViewerRef.current && skinViewerRef.current.playerObject) {
      skinViewerRef.current.playerObject.skin.head.outerLayer.visible = showOuterLayers;
      skinViewerRef.current.playerObject.skin.body.outerLayer.visible = showOuterLayers;
      skinViewerRef.current.playerObject.skin.leftArm.outerLayer.visible = showOuterLayers;
      skinViewerRef.current.playerObject.skin.rightArm.outerLayer.visible = showOuterLayers;
      skinViewerRef.current.playerObject.skin.leftLeg.outerLayer.visible = showOuterLayers;
      skinViewerRef.current.playerObject.skin.rightLeg.outerLayer.visible = showOuterLayers;
    }
  }, [showOuterLayers]);

  // Load Skin to 3D Viewer
  const applySkinToViewer = async (skinUrl: string, model: 'default' | 'slim', name: string, cape?: string) => {
    setCurrentSkinUrl(skinUrl);
    setSelectedModel(model);
    setActiveSkinName(name);
    setCurrentCapeUrl(cape || null);

    if (skinViewerRef.current) {
      try {
        await skinViewerRef.current.loadSkin(skinUrl, { model });
        if (cape) {
          await skinViewerRef.current.loadCape(cape);
        } else {
          skinViewerRef.current.resetCape();
        }
      } catch (err) {
        console.warn('Error loading skin texture into WebGL canvas:', err);
      }
    }
  };

  // Search User via Public Mojang / Ashcon API
  const handleSearchMojangUser = async () => {
    if (!customSearchName.trim()) return;
    setIsSearchingApi(true);

    const name = customSearchName.trim();
    try {
      // 1. Try Ashcon Mojang API
      const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        const skinUrl = data.textures?.skin?.url || `https://minotar.net/skin/${encodeURIComponent(name)}`;
        const model: 'default' | 'slim' = data.textures?.slim ? 'slim' : 'default';
        const capeUrl = data.textures?.cape?.url;

        await applySkinToViewer(skinUrl, model, data.username || name, capeUrl);
        showToast(`¡Skin oficial de ${data.username || name} cargada con éxito!`);
      } else {
        // Fallback to Minotar
        const fallbackUrl = `https://minotar.net/skin/${encodeURIComponent(name)}`;
        await applySkinToViewer(fallbackUrl, 'default', name);
        showToast(`Skin de ${name} cargada desde Minotar API`);
      }
    } catch {
      const fallbackUrl = `https://minotar.net/skin/${encodeURIComponent(name)}`;
      await applySkinToViewer(fallbackUrl, 'default', name);
      showToast(`Skin de ${name} cargada`);
    } finally {
      setIsSearchingApi(false);
    }
  };

  // Local .png Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.png')) {
      alert('Por favor, selecciona un archivo de imagen en formato .png válido para Minecraft.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        applySkinToViewer(result, selectedModel, file.name.replace('.png', ''));
        showToast(`¡Skin local "${file.name}" cargada en el visor 3D!`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Download .png file
  const handleDownloadSkinPng = () => {
    const link = document.createElement('a');
    link.href = currentSkinUrl;
    link.download = `${activeSkinName.toLowerCase().replace(/\s+/g, '_')}_skin.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Descargando archivo .png de la skin...');
  };

  // HD Snapshot
  const handleTakeSnapshot = () => {
    if (!skinViewerRef.current) return;
    skinViewerRef.current.render();
    const dataUrl = skinViewerRef.current.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${activeSkinName.toLowerCase().replace(/\s+/g, '_')}_render_3d.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📸 ¡Captura HD 3D guardada con fondo transparente!');
  };

  // Apply to Launcher Profile
  const handleApplyToProfile = () => {
    if (onUsernameChange && activeSkinName) {
      onUsernameChange(activeSkinName);
    }
    showToast(`✅ ¡Aspecto "${activeSkinName}" aplicado a tu perfil del Launcher!`);
  };

  // Filter Catalog
  const filteredCatalog = SKIN_CATALOG.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const matchesQuery =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.usernameOrUrl.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-mc-card border border-mc-border p-6 rounded-3xl shadow-xl backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <Palette className="w-6 h-6 text-purple-400" />
            Estudio de Skins 3D & Explorador de Aspectos
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visualizador 3D WebGL con animaciones, capas y catálogo público con búsqueda por Mojang API.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 px-4 py-2.5 bg-mc-darker hover:bg-white/10 text-slate-200 border border-mc-border rounded-xl text-xs font-bold cursor-pointer transition-all hover:border-purple-500/50 shadow-sm active:scale-95">
            <Upload className="w-4 h-4 text-purple-400" />
            Subir .PNG Local
            <input type="file" accept=".png" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={handleApplyToProfile}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-glow transition-all active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            Aplicar a mi Perfil
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-emerald-500/95 backdrop-blur-md text-white font-bold px-4 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-white" />
          {toastMessage}
        </div>
      )}

      {/* Main Split Grid: 3D Stage on Left + Catalog on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 3D WebGL Studio & Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* 3D Canvas Box */}
          <div className="bg-gradient-to-b from-[#111624] via-[#0d101a] to-[#090b12] border border-mc-border rounded-3xl p-5 shadow-2xl flex flex-col items-center relative overflow-hidden group">
            {/* Stage Title / Active Skin Info */}
            <div className="w-full flex items-center justify-between z-10 mb-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Aspecto Activo</span>
                <h3 className="font-extrabold text-white text-base truncate max-w-[180px]">{activeSkinName}</h3>
              </div>
              <span className="text-[10px] font-mono font-bold bg-white/10 px-2.5 py-1 rounded-full border border-white/10 text-slate-300">
                {selectedModel === 'slim' ? 'Alex (Slim 3px)' : 'Steve (Classic 4px)'}
              </span>
            </div>

            {/* Canvas WebGL */}
            <div className="relative cursor-grab active:cursor-grabbing flex items-center justify-center">
              <canvas ref={canvasRef} className="rounded-2xl drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]" />
              
              {/* Overlay Hint */}
              <div className="absolute bottom-2 bg-black/50 backdrop-blur-md text-[10px] text-slate-400 px-3 py-1 rounded-full border border-white/5 pointer-events-none">
                🖱️ Arrastra para rotar 360° • Rueda para zoom
              </div>
            </div>

            {/* Quick Action Bar under Canvas */}
            <div className="w-full grid grid-cols-3 gap-2 mt-4 z-10">
              <button
                onClick={() => setIsAutoRotating(!isAutoRotating)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  isAutoRotating
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-mc-darker text-slate-400 border-mc-border hover:text-white'
                }`}
                title="Activar/Desactivar giro automático"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin' : ''}`} />
                {isAutoRotating ? 'Giro ON' : 'Giro OFF'}
              </button>

              <button
                onClick={() => setShowOuterLayers(!showOuterLayers)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  showOuterLayers
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-mc-darker text-slate-400 border-mc-border hover:text-white'
                }`}
                title="Mostrar u ocultar segunda capa 3D (sombrero, chaqueta)"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Capas 3D
              </button>

              <button
                onClick={handleTakeSnapshot}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-mc-darker hover:bg-pink-500/20 text-slate-300 hover:text-pink-300 border border-mc-border hover:border-pink-500/40 transition-all"
                title="Guardar render HD del personaje con fondo transparente"
              >
                <Camera className="w-3.5 h-3.5 text-pink-400" />
                Foto HD
              </button>
            </div>
          </div>

          {/* Animation & Model Control Panel */}
          <div className="bg-mc-card border border-mc-border rounded-3xl p-5 space-y-4 shadow-xl">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Play className="w-3.5 h-3.5 text-purple-400" />
              Animación en Vivo
            </h4>

            {/* Animation Selector Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'idle', label: '🧍 Respirar' },
                { id: 'walk', label: '🚶 Caminar' },
                { id: 'run', label: '🏃 Correr' },
                { id: 'wave', label: '👋 Saludar' },
                { id: 'fly', label: '🪽 Volar' },
                { id: 'none', label: '⏸️ Quieto' }
              ].map((anim) => (
                <button
                  key={anim.id}
                  onClick={() => setActiveAnimation(anim.id as any)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition-all border text-center ${
                    activeAnimation === anim.id
                      ? 'bg-purple-500 text-white border-purple-400 shadow-md scale-105'
                      : 'bg-mc-darker/80 text-slate-400 border-mc-border hover:bg-mc-card hover:text-white'
                  }`}
                >
                  {anim.label}
                </button>
              ))}
            </div>

            {/* Model & Download Controls */}
            <div className="pt-2 border-t border-mc-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Modelo:</span>
                <button
                  onClick={() => applySkinToViewer(currentSkinUrl, selectedModel === 'default' ? 'slim' : 'default', activeSkinName, currentCapeUrl || undefined)}
                  className="text-xs font-bold px-3 py-1 bg-mc-darker border border-mc-border hover:border-purple-400 text-purple-300 rounded-lg transition-all"
                >
                  {selectedModel === 'default' ? 'Classic (4px)' : 'Slim (3px)'} 🔁
                </button>
              </div>

              <button
                onClick={handleDownloadSkinPng}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-emerald-400 transition-colors"
                title="Descargar archivo .png de la skin"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Descargar .PNG
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Mojang Search + Categorized Public Catalog */}
        <div className="lg:col-span-7 space-y-4">
          {/* Public Mojang / Ashcon API Search Bar */}
          <div className="bg-mc-card border border-mc-border rounded-3xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              Buscar Skin Oficial por Jugador (Mojang API)
            </h4>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customSearchName}
                  onChange={(e) => setCustomSearchName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchMojangUser()}
                  placeholder="Ej: Vegetta777, Technoblade, Dream, Auronplay..."
                  className="w-full bg-mc-darker border border-mc-border focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all pl-9"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>

              <button
                onClick={handleSearchMojangUser}
                disabled={isSearchingApi || !customSearchName.trim()}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                {isSearchingApi ? <Zap className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isSearchingApi ? 'Buscando...' : 'Cargar'}
              </button>
            </div>
          </div>

          {/* Category Filter Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'Todas', icon: Tag },
              { id: 'trending', label: 'Tendencias', icon: Flame },
              { id: 'creators', label: 'YouTubers', icon: Tv },
              { id: 'anime', label: 'Anime & Manga', icon: Sparkles },
              { id: 'fantasy', label: 'Fantasía', icon: Sword },
              { id: 'cyber', label: 'Cyber & Sci-Fi', icon: Bot },
              { id: 'mobs', label: 'Criaturas', icon: Cat }
            ].map((cat) => {
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                    activeCategory === cat.id
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md scale-105'
                      : 'bg-mc-card text-slate-400 border-mc-border hover:text-slate-200 hover:bg-mc-darker'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Skins Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredCatalog.map((skin) => {
              const skinImgUrl = skin.usernameOrUrl.startsWith('http')
                ? skin.usernameOrUrl
                : `https://minotar.net/skin/${encodeURIComponent(skin.usernameOrUrl)}`;
              const avatarHeadUrl = skin.usernameOrUrl.startsWith('http')
                ? skin.usernameOrUrl
                : `https://minotar.net/helm/${encodeURIComponent(skin.usernameOrUrl)}/100.png`;

              const isSelected = activeSkinName === skin.name;

              return (
                <div
                  key={skin.id}
                  onClick={() => applySkinToViewer(skinImgUrl, skin.model, skin.name, skin.capeUrl)}
                  className={`group bg-mc-card/80 hover:bg-mc-card border rounded-2xl p-3.5 flex flex-col items-center gap-2 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-xl relative overflow-hidden ${
                    isSelected
                      ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-500/10'
                      : 'border-mc-border/80 hover:border-purple-500/50'
                  }`}
                >
                  {/* Model Tag */}
                  <span className="absolute top-2 right-2 text-[9px] font-mono bg-black/40 text-slate-400 px-1.5 py-0.5 rounded border border-white/5">
                    {skin.model === 'slim' ? 'Slim' : 'Classic'}
                  </span>

                  {/* Avatar Head / Preview */}
                  <div className="w-16 h-16 rounded-xl bg-mc-darker border border-mc-border/80 flex items-center justify-center overflow-hidden shadow-inner group-hover:border-purple-500/50 transition-colors p-1">
                    <img
                      src={avatarHeadUrl}
                      alt={skin.name}
                      className="w-full h-full object-contain pixelated transition-transform duration-300 group-hover:scale-110"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://minotar.net/helm/Steve/100.png`;
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="text-center w-full">
                    <h5 className="font-bold text-xs text-white truncate group-hover:text-purple-300 transition-colors">
                      {skin.name}
                    </h5>
                    <span className="text-[10px] text-slate-500 block truncate">{skin.author}</span>
                  </div>

                  {/* Try in 3D Action */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      applySkinToViewer(skinImgUrl, skin.model, skin.name, skin.capeUrl);
                    }}
                    className={`w-full py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-purple-500 text-white'
                        : 'bg-mc-darker/80 text-slate-300 hover:bg-purple-600 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    {isSelected ? 'Activo en 3D' : 'Ver en 3D'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
