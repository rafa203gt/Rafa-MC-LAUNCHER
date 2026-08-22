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

  useEffect(() => {
    if (!canvasRef.current) return;

    const cleanUser = (username || 'Steve').trim();
    const skinUrl = `https://minotar.net/skin/${encodeURIComponent(cleanUser)}`;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: width,
      height: height,
      skin: skinUrl
    });

    viewer.fov = 70;
    viewer.zoom = 0.9;
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.8;
    viewer.animation = new IdleAnimation();

    skinViewerRef.current = viewer;

    return () => {
      viewer.dispose();
      skinViewerRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    if (skinViewerRef.current && username) {
      const cleanUser = username.trim() || 'Steve';
      skinViewerRef.current.loadSkin(`https://minotar.net/skin/${encodeURIComponent(cleanUser)}`).catch(() => {
        skinViewerRef.current?.loadSkin('https://minotar.net/skin/Steve');
      });
    }
  }, [username]);

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <canvas ref={canvasRef} className="rounded-xl drop-shadow-xl cursor-grab active:cursor-grabbing" />
    </div>
  );
};
