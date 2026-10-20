import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CrystalScene } from '../renderer/CrystalScene';
import { CrystalStructure } from '../types/crystal';

interface VestaAxesOverlayProps {
  structure: CrystalStructure | null;
  crystalSceneRef: React.MutableRefObject<CrystalScene | null>;
}

export const VestaAxesOverlay: React.FC<VestaAxesOverlayProps> = ({
  structure,
  crystalSceneRef
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number | null = null;

    const render = () => {
      animId = null;
      if (document.hidden) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scene = crystalSceneRef.current;
      if (scene && structure?.lattice) {
        const camera = (scene as any).activeCamera as THREE.Camera;
        if (camera) {
          const [va, vb, vc] = structure.lattice.matrix;
          
          const origin = new THREE.Vector3(0, 0, 0);
          const pA = new THREE.Vector3(va.x, va.y, va.z).normalize().multiplyScalar(40);
          const pB = new THREE.Vector3(vb.x, vb.y, vb.z).normalize().multiplyScalar(40);
          const pC = new THREE.Vector3(vc.x, vc.y, vc.z).normalize().multiplyScalar(40);

          // Get camera rotation matrix (view matrix without translation)
          const rotMat = new THREE.Matrix4().extractRotation(camera.matrixWorldInverse);

          const rA = pA.clone().applyMatrix4(rotMat);
          const rB = pB.clone().applyMatrix4(rotMat);
          const rC = pC.clone().applyMatrix4(rotMat);

          const cx = 50;
          const cy = 60;

          // Draw axes: Red (a), Green (b), Blue (c)
          const drawArrow = (v: THREE.Vector3, color: string, label: string) => {
            const tx = cx + v.x;
            const ty = cy - v.y; // screen y is inverted

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            // Arrow head
            const angle = Math.atan2(ty - cy, tx - cx);
            const headLen = 7;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx - headLen * Math.cos(angle - Math.PI / 6), ty - headLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(tx - headLen * Math.cos(angle + Math.PI / 6), ty - headLen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();

            // Label
            ctx.font = 'bold 12px serif';
            ctx.fillText(label, tx + 6 * Math.cos(angle), ty + 6 * Math.sin(angle) + 4);
          };

          // Sort by depth (v.z) so back arrows are drawn first
          const axes = [
            { v: rA, color: '#ef4444', label: 'a' },
            { v: rB, color: '#16a34a', label: 'b' },
            { v: rC, color: '#2563eb', label: 'c' }
          ].sort((x, y) => x.v.z - y.v.z);

          axes.forEach(a => drawArrow(a.v, a.color, a.label));
        }
      }

      animId = requestAnimationFrame(render);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (animId !== null) cancelAnimationFrame(animId);
        animId = null;
      } else if (animId === null) render();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    render();

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [structure, crystalSceneRef]);

  return (
    <div className="absolute bottom-3 left-3 z-20 pointer-events-none select-none">
      <canvas ref={canvasRef} width={120} height={110} className="w-[120px] h-[110px]" />
    </div>
  );
};
