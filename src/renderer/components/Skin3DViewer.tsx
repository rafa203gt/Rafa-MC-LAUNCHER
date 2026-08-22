import React, { useEffect, useRef } from 'react';
import { SkinViewer, IdleAnimation } from 'skinview3d';

interface Skin3DViewerProps {
  username: string;
  width?: number;
  height?: number;
}

export const Skin3DViewer: React.FC<Skin3DViewerProps> = ({
  username,
  width = 220,
  height = 260
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const skinViewerRef = useRef<SkinViewer | null>(null);

  const loadSkinForUser = async (user: string) => {
    const cleanUser = (user || 'Steve').trim();
    let skinUrl = `https://minotar.net/skin/${encodeURIComponent(cleanUser)}`;
    let model: 'default' | 'slim' = 'default';
    let capeUrl: string | null = null;

    if (window.launcherAPI?.getUserSkin) {
      try {
        const customSkin = await window.launcherAPI.getUserSkin(cleanUser);
        if (customSkin && (customSkin.skinData || customSkin.skinUrl)) {
          skinUrl = customSkin.skinData || customSkin.skinUrl;
          model = customSkin.model || 'default';
          capeUrl = customSkin.capeUrl || null;
        }
      } catch {}
    }

    if (skinViewerRef.current) {
      try {
        await skinViewerRef.current.loadSkin(skinUrl, { model });
        if (capeUrl) {
          await skinViewerRef.current.loadCape(capeUrl);
        } else {
          skinViewerRef.current.resetCape();
        }
      } catch {
        skinViewerRef.current.loadSkin('https://minotar.net/skin/Steve').catch(() => {});
      }
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: width,
      height: height,
      skin: 'https://minotar.net/skin/Steve'
    });

    viewer.fov = 70;
    viewer.zoom = 0.9;
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.8;
    viewer.animation = new IdleAnimation();

    skinViewerRef.current = viewer;

    loadSkinForUser(username);

    return () => {
      viewer.dispose();
      skinViewerRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    if (skinViewerRef.current && username) {
      loadSkinForUser(username);
    }
  }, [username]);

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <canvas ref={canvasRef} className="rounded-xl drop-shadow-xl cursor-grab active:cursor-grabbing" />
    </div>
  );
};
