import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, Upload, Sparkles, User } from 'lucide-react';

interface Skin3DViewerProps {
  username: string;
  width?: number;
  height?: number;
}

export const Skin3DViewer: React.FC<Skin3DViewerProps> = ({
  username,
  width = 240,
  height = 280
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState<{ x: number; y: number }>({ x: -10, y: 25 });
  const [skinImg, setSkinImg] = useState<HTMLImageElement | null>(null);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrame = useRef<number | null>(null);
  const idleAngle = useRef(0);

  // Load Skin Image
  useEffect(() => {
    const cleanUser = username?.trim() || 'Steve';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://minotar.net/skin/${encodeURIComponent(cleanUser)}`;

    img.onload = () => {
      setSkinImg(img);
    };

    img.onerror = () => {
      // Fallback to Steve base skin
      const fallback = new Image();
      fallback.crossOrigin = 'anonymous';
      fallback.src = 'https://minotar.net/skin/Steve';
      fallback.onload = () => setSkinImg(fallback);
    };
  }, [username]);

  const handleCustomSkinUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.png')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => setSkinImg(img);
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Render 3D Minecraft Character to 2D Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !skinImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      idleAngle.current += 0.02;
      const sway = Math.sin(idleAngle.current) * 3;
      const rotY = ((rotation.y + sway) * Math.PI) / 180;
      const rotX = (rotation.x * Math.PI) / 180;

      const centerX = width / 2;
      const centerY = height / 2 + 10;
      const scale = 3.6;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Simple 3D projection helper
      const project = (x: number, y: number, z: number) => {
        // Rotate around Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        // Rotate around X
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

      // Draw Cube Face with texture
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

        // Check normal / backface culling
        const v1x = pt2.px - pt1.px;
        const v1y = pt2.py - pt1.py;
        const v2x = pt4.px - pt1.px;
        const v2y = pt4.py - pt1.py;
        const normalZ = v1x * v2y - v1y * v2x;

        if (normalZ <= 0) return; // Backface culled

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pt1.px, pt1.py);
        ctx.lineTo(pt2.px, pt2.py);
        ctx.lineTo(pt3.px, pt3.py);
        ctx.lineTo(pt4.px, pt4.py);
        ctx.closePath();
        ctx.clip();

        // Sample texture
        ctx.imageSmoothingEnabled = false;
        try {
          ctx.drawImage(skinImg, sx, sy, sw, sh, Math.min(pt1.px, pt2.px, pt3.px, pt4.px), Math.min(pt1.py, pt2.py, pt3.py, pt4.py), Math.abs(pt2.px - pt4.px) || sw * scale, Math.abs(pt3.py - pt1.py) || sh * scale);
        } catch {}

        if (brightness < 1) {
          ctx.fillStyle = `rgba(0, 0, 0, ${1 - brightness})`;
          ctx.fill();
        }
        ctx.restore();
      };

      // Draw Box Helper
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

      // 1. Head (8x8x8 at 0, -20, 0) - Texture [0, 0]
      drawBox(0, -20, 0, 8, 8, 8, 0, 0);

      // 2. Torso (8x12x4 at 0, -10, 0) - Texture [16, 16]
      drawBox(0, -10, 0, 8, 12, 4, 16, 16);

      // 3. Right Arm (4x12x4 at -6, -10, 0) - Texture [40, 16]
      drawBox(-6, -10, 0, 4, 12, 4, 40, 16);

      // 4. Left Arm (4x12x4 at 6, -10, 0) - Texture [32, 48] or [40, 16]
      drawBox(6, -10, 0, 4, 12, 4, 40, 16);

      // 5. Right Leg (4x12x4 at -2, 2, 0) - Texture [0, 16]
      drawBox(-2, 2, 0, 4, 12, 4, 0, 16);

      // 6. Left Leg (4x12x4 at 2, 2, 0) - Texture [16, 48] or [0, 16]
      drawBox(2, 2, 0, 4, 12, 4, 0, 16);

      ctx.restore();
      animFrame.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [skinImg, rotation, width, height]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
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
    <div className="relative group flex flex-col items-center select-none">
      <div
        className="relative cursor-grab active:cursor-grabbing rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900/60 to-[#0a0d14]/80 border border-slate-800/60 p-2 shadow-2xl backdrop-blur-md transition-all hover:border-emerald-500/30"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block drop-shadow-2xl"
        />

        {/* 3D Rotation hint badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-[10px] text-slate-300 font-bold backdrop-blur-md">
          <RotateCw className="w-3 h-3 text-emerald-400 animate-spin-slow" />
          <span>Rotación 3D</span>
        </div>

        {/* Custom Skin Upload Button */}
        <label
          htmlFor="skin-upload-input"
          className="absolute bottom-3 right-3 p-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-xl cursor-pointer transition-all active:scale-95 shadow-lg flex items-center gap-1.5 text-xs font-bold"
          title="Cambiar Skin (.png)"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">Skin .png</span>
          <input
            id="skin-upload-input"
            type="file"
            accept="image/png"
            onChange={handleCustomSkinUpload}
            className="hidden"
          />
        </label>
      </div>

      <span className="text-[11px] font-bold text-slate-400 mt-2 flex items-center gap-1.5">
        <User className="w-3.5 h-3.5 text-emerald-400" />
        {username || 'Steve'}
      </span>
    </div>
  );
};
