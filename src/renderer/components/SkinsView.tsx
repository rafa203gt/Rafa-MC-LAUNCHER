import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Upload,
  Download,
  RotateCw,
  Sparkles,
  CheckCircle2,
  Palette,
  Eye,
  RefreshCw,
  HelpCircle,
  FolderOpen
} from 'lucide-react';

interface SkinsViewProps {
  currentUsername: string;
  onUsernameChange?: (username: string) => void;
}

interface SkinPreset {
  id: string;
  name: string;
  category: string;
  skinUrl: string;
}

const PRESET_SKINS: SkinPreset[] = [
  {
    id: 'steve',
    name: 'Steve Clásico',
    category: 'Original',
    skinUrl: 'https://minotar.net/skin/Steve'
  },
  {
    id: 'alex',
    name: 'Alex Exploradora',
    category: 'Original',
    skinUrl: 'https://minotar.net/skin/Alex'
  },
  {
    id: 'cyber-knight',
    name: 'Cyber Knight',
    category: 'Futurista',
    skinUrl: 'https://minotar.net/skin/Technoblade'
  },
  {
    id: 'ender-mage',
    name: 'Ender Mage',
    category: 'Fantasía',
    skinUrl: 'https://minotar.net/skin/Dream'
  },
  {
    id: 'galactic-ranger',
    name: 'Galactic Ranger',
    category: 'Ciencia Ficción',
    skinUrl: 'https://minotar.net/skin/Mumbo'
  },
  {
    id: 'shadow-assassin',
    name: 'Shadow Assassin',
    category: 'Oscuro',
    skinUrl: 'https://minotar.net/skin/Grian'
  }
];

export const SkinsView: React.FC<SkinsViewProps> = ({ currentUsername, onUsernameChange }) => {
  const [usernameInput, setUsernameInput] = useState(currentUsername || 'Jugador');
  const [activeSkinUrl, setActiveSkinUrl] = useState<string>(
    `https://minotar.net/skin/${encodeURIComponent(currentUsername || 'Steve')}`
  );
  const [skinImg, setSkinImg] = useState<HTMLImageElement | null>(null);
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const [rotation, setRotation] = useState<{ x: number; y: number }>({ x: -10, y: 25 });
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrame = useRef<number | null>(null);
  const idleAngle = useRef(0);

  // Load active skin image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = activeSkinUrl;
    img.onload = () => setSkinImg(img);
    img.onerror = () => {
      const fallback = new Image();
      fallback.crossOrigin = 'anonymous';
      fallback.src = 'https://minotar.net/skin/Steve';
      fallback.onload = () => setSkinImg(fallback);
    };
  }, [activeSkinUrl]);

  // Handle Search by Nickname
  const handleFetchNickSkin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    const url = `https://minotar.net/skin/${encodeURIComponent(usernameInput.trim())}`;
    setActiveSkinUrl(url);
    if (onUsernameChange) {
      onUsernameChange(usernameInput.trim());
    }
    setToastMessage(`Skin de "${usernameInput}" cargada con éxito`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handle Local .png Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.png')) {
      alert('Por favor selecciona un archivo de imagen en formato .png');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setActiveSkinUrl(result);
      setToastMessage(`Skin local "${file.name}" cargada correctamente`);
      setTimeout(() => setToastMessage(null), 3000);
    };
    reader.readAsDataURL(file);
  };

  // Apply Preset
  const handleSelectPreset = (preset: SkinPreset) => {
    setActiveSkinUrl(preset.skinUrl);
    setToastMessage(`Aspecto "${preset.name}" aplicado`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 3D Rendering Canvas Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !skinImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const width = canvas.width;
    const height = canvas.height;

    const render = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      if (isAutoRotate && !isDragging) {
        idleAngle.current += 0.015;
      }
      const sway = isAutoRotate ? Math.sin(idleAngle.current) * 4 : 0;
      const rotY = ((rotation.y + (isAutoRotate ? idleAngle.current * 20 : 0)) * Math.PI) / 180;
      const rotX = (rotation.x * Math.PI) / 180;

      const centerX = width / 2;
      const centerY = height / 2 + 15;
      const scale = 5.2;

      ctx.save();
      ctx.translate(centerX, centerY);

      const project = (x: number, y: number, z: number) => {
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        return {
          px: x1 * scale,
          py: y2 * scale,
          z: z2
        };
      };

      const drawFace = (
        p1: [number, number, number],
        p2: [number, number, number],
        p3: [number, number, number],
        p4: [number, number, number],
        sx: number,
        sy: number,
        sw: number,
        sh: number,
        brightness = 1
      ) => {
        const pt1 = project(...p1);
        const pt2 = project(...p2);
        const pt3 = project(...p3);
        const pt4 = project(...p4);

        const v1x = pt2.px - pt1.px;
        const v1y = pt2.py - pt1.py;
        const v2x = pt4.px - pt1.px;
        const v2y = pt4.py - pt1.py;
        const normalZ = v1x * v2y - v1y * v2x;

        if (normalZ <= 0) return;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pt1.px, pt1.py);
        ctx.lineTo(pt2.px, pt2.py);
        ctx.lineTo(pt3.px, pt3.py);
        ctx.lineTo(pt4.px, pt4.py);
        ctx.closePath();
        ctx.clip();

        ctx.imageSmoothingEnabled = false;
        try {
          ctx.drawImage(
            skinImg,
            sx,
            sy,
            sw,
            sh,
            Math.min(pt1.px, pt2.px, pt3.px, pt4.px),
            Math.min(pt1.py, pt2.py, pt3.py, pt4.py),
            Math.abs(pt2.px - pt4.px) || sw * scale,
            Math.abs(pt3.py - pt1.py) || sh * scale
          );
        } catch {}

        if (brightness < 1) {
          ctx.fillStyle = `rgba(0, 0, 0, ${1 - brightness})`;
          ctx.fill();
        }
        ctx.restore();
      };

      const drawBox = (
        ox: number,
        oy: number,
        oz: number,
        w: number,
        h: number,
        d: number,
        u: number,
        v: number
      ) => {
        const x0 = ox - w / 2;
        const x1 = ox + w / 2;
        const y0 = oy - h / 2;
        const y1 = oy + h / 2;
        const z0 = oz - d / 2;
        const z1 = oz + d / 2;

        // Front
        drawFace([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], u + d, v + d, w, h, 1.0);
        // Back
        drawFace([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], u + d + w + d, v + d, w, h, 0.75);
        // Top
        drawFace([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], u + d, v, w, d, 1.15);
        // Bottom
        drawFace([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], u + d + w, v, w, d, 0.6);
        // Right
        drawFace([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], u + d + w, v + d, d, h, 0.85);
        // Left
        drawFace([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], u, v + d, d, h, 0.85);
      };

      // 1. Head (8x8x8)
      drawBox(0, -20, 0, 8, 8, 8, 0, 0);

      // 2. Torso (8x12x4)
      drawBox(0, -10, 0, 8, 12, 4, 16, 16);

      // 3. Right Arm (4x12x4)
      drawBox(-6, -10, 0, 4, 12, 4, 40, 16);

      // 4. Left Arm (4x12x4)
      drawBox(6, -10, 0, 4, 12, 4, 40, 16);

      // 5. Right Leg (4x12x4)
      drawBox(-2, 2, 0, 4, 12, 4, 0, 16);

      // 6. Left Leg (4x12x4)
      drawBox(2, 2, 0, 4, 12, 4, 0, 16);

      ctx.restore();
      animFrame.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [skinImg, rotation, isAutoRotate, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setIsAutoRotate(false);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    setRotation((prev) => ({
      x: Math.max(-45, Math.min(45, prev.x + dy * 0.5)),
      y: (prev.y + dx * 0.8) % 360
    }));

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-mc-card border border-mc-border p-6 rounded-2xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Personalizador de Skins & Aspecto</h2>
            <p className="text-xs text-slate-400 mt-1">
              Visualiza en 3D interactivo tu skin de Minecraft o carga un archivo .png local
            </p>
          </div>
        </div>

        {toastMessage && (
          <div className="flex items-center gap-2 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-xs px-4 py-2 rounded-full shadow-lg animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {toastMessage}
          </div>
        )}
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 3D Stage */}
        <div className="lg:col-span-7 bg-[#0a0d14] border border-mc-border rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
          {/* Controls Badge */}
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800/80 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-300">Escenario 3D en Vivo</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAutoRotate(!isAutoRotate)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isAutoRotate
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Giro automático suave"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Giro Automático</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRotation({ x: -10, y: 25 });
                  setIsAutoRotate(false);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
                title="Restablecer ángulo"
              >
                Centrar
              </button>
            </div>
          </div>

          {/* 3D Canvas Viewport */}
          <div
            className="cursor-grab active:cursor-grabbing relative flex items-center justify-center py-4"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <canvas
              ref={canvasRef}
              width={340}
              height={400}
              className="drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]"
            />
          </div>

          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-2">
            <span>🖱️ Arrastra con el ratón para rotar 360°</span>
          </div>
        </div>

        {/* Right Column: Customization Controls & Presets */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Nick Search & File Upload */}
          <div className="bg-mc-card border border-mc-border rounded-3xl p-6 shadow-xl space-y-5">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              Cargar Skin
            </h3>

            {/* Form by Nickname */}
            <form onSubmit={handleFetchNickSkin} className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">Buscar por Nombre de Usuario (Mojang)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="ej. Steve, Vegetta777..."
                  className="flex-1 bg-[#0a0d14] border border-mc-border focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Cargar
                </button>
              </div>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-mc-border/60"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-[10px] uppercase font-bold tracking-wider">o</span>
              <div className="flex-grow border-t border-mc-border/60"></div>
            </div>

            {/* Local .png upload button */}
            <div>
              <label
                htmlFor="full-skin-upload"
                className="w-full flex items-center justify-center gap-2.5 p-3.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-indigo-500/40 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-md text-xs font-bold text-indigo-300 hover:text-white"
              >
                <Upload className="w-4 h-4" />
                <span>Subir archivo Skin .png desde tu PC</span>
                <input
                  id="full-skin-upload"
                  type="file"
                  accept="image/png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <p className="text-[10px] text-slate-500 text-center mt-2">
                Formatos compatibles: skins estándar de Minecraft (64x64 o 64x32 px)
              </p>
            </div>
          </div>

          {/* Card 2: Preset Gallery */}
          <div className="bg-mc-card border border-mc-border rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Galería de Aspectos Populares
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {PRESET_SKINS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="p-3 bg-[#0a0d14] border border-mc-border/80 hover:border-emerald-500/40 rounded-2xl flex items-center gap-3 transition-all hover:bg-slate-800/60 active:scale-95 text-left group"
                >
                  <img
                    src={`https://minotar.net/avatar/${preset.id}/40`}
                    alt={preset.name}
                    className="w-8 h-8 rounded-lg border border-slate-700 group-hover:border-emerald-400 transition-colors shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate">{preset.name}</h4>
                    <span className="text-[10px] text-slate-500">{preset.category}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
