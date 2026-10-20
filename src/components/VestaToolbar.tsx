import React, { useState } from 'react';
import { 
  RotateCw, 
  RotateCcw, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  Minus, 
  Box, 
  Compass, 
  Layers, 
  Maximize,
  RefreshCcw,
  Camera
} from 'lucide-react';
import { VisualSettings } from '../types/crystal';

interface VestaToolbarProps {
  showLattice: boolean;
  showAxes: boolean;
  visualSettings: VisualSettings;
  onViewAlong: (axis: 'a' | 'b' | 'c' | 'a*' | 'b*' | 'c*' | 'reset') => void;
  onRotateBy: (degX: number, degY: number) => void;
  onPanBy: (dx: number, dy: number) => void;
  onZoomBy: (percent: number) => void;
  onToggleLattice: () => void;
  onToggleAxes: () => void;
  onUpdateVisualSettings: (settings: Partial<VisualSettings>) => void;
  onOpenRenderModal?: () => void;
}

export const VestaToolbar: React.FC<VestaToolbarProps> = ({
  showLattice,
  showAxes,
  visualSettings,
  onOpenRenderModal,
  onViewAlong,
  onRotateBy,
  onPanBy,
  onZoomBy,
  onToggleLattice,
  onToggleAxes,
  onUpdateVisualSettings
}) => {
  const [rotateStep, setRotateStep] = useState<number>(45.0);
  const [panStep, setPanStep] = useState<number>(10);
  const [zoomStep, setZoomStep] = useState<number>(10);
  const safeStep = (value: string, current: number, maximum: number) => {
    const parsed = Number(value);
    return value.trim() && Number.isFinite(parsed) ? Math.max(0.1, Math.min(maximum, parsed)) : current;
  };

  const btnClass = "px-2 py-0.5 rounded text-xs font-semibold text-slate-700 hover:bg-[#e2e8f0] border border-[#cbd5e1] bg-white transition shadow-2xs active:bg-[#cbd5e1]";

  return (
    <div className="h-8 shrink-0 bg-[#f8fafc] border-b border-[#d1d5db] flex items-center px-2 gap-2 text-xs select-none text-slate-700 overflow-x-auto whitespace-nowrap [&>div]:shrink-0">
      
      {/* 1. Orientation axes buttons: a, b, c, a*, b*, c* */}
      <div className="flex items-center gap-1 font-serif">
        <button onClick={() => onViewAlong('a')} className={`${btnClass} text-red-700 font-bold`} title="View along a vector">
          a
        </button>
        <button onClick={() => onViewAlong('b')} className={`${btnClass} text-emerald-700 font-bold`} title="View along b vector">
          b
        </button>
        <button onClick={() => onViewAlong('c')} className={`${btnClass} text-blue-700 font-bold`} title="View along c vector (Top-down XY)">
          c
        </button>
        <button onClick={() => onViewAlong('a*')} className={btnClass} title="View along a* reciprocal vector">
          a*
        </button>
        <button onClick={() => onViewAlong('b*')} className={btnClass} title="View along b* reciprocal vector">
          b*
        </button>
        <button onClick={() => onViewAlong('c*')} className={`${btnClass} font-bold`} title="View along c* reciprocal vector (normal to ab)">
          c*
        </button>
      </div>

      <div className="w-[1px] h-5 bg-slate-300 mx-0.5" />

      {/* 2. Rotation Buttons with Step (°) */}
      <div className="flex items-center gap-1">
        <button onClick={() => onRotateBy(rotateStep, 0)} className={btnClass} title="Rotate left">
          ↺
        </button>
        <button onClick={() => onRotateBy(-rotateStep, 0)} className={btnClass} title="Rotate right">
          ↻
        </button>
        <button onClick={() => onRotateBy(0, rotateStep)} className={btnClass} title="Rotate up">
          ↶
        </button>
        <button onClick={() => onRotateBy(0, -rotateStep)} className={btnClass} title="Rotate down">
          ↷
        </button>
        <span className="text-[11px] text-slate-500 ml-1">Step (°):</span>
        <input
          type="number"
          value={rotateStep}
          onChange={(e) => setRotateStep(safeStep(e.target.value, rotateStep, 360))}
          min={0.1} max={360} step="any" aria-label="旋转步长（度）"
          className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center text-xs text-slate-800"
        />
      </div>

      <div className="w-[1px] h-5 bg-slate-300 mx-0.5" />

      {/* 3. Translation Buttons with Step (px) */}
      <div className="flex items-center gap-1">
        <button onClick={() => onPanBy(0, panStep)} className={btnClass} title="Pan up">
          ↑
        </button>
        <button onClick={() => onPanBy(0, -panStep)} className={btnClass} title="Pan down">
          ↓
        </button>
        <button onClick={() => onPanBy(-panStep, 0)} className={btnClass} title="Pan left">
          ←
        </button>
        <button onClick={() => onPanBy(panStep, 0)} className={btnClass} title="Pan right">
          →
        </button>
        <span className="text-[11px] text-slate-500 ml-1">Step (px):</span>
        <input
          type="number"
          value={panStep}
          onChange={(e) => setPanStep(safeStep(e.target.value, panStep, 1000))}
          min={0.1} max={1000} step="any" aria-label="平移步长（像素）"
          className="w-10 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center text-xs text-slate-800"
        />
      </div>

      <div className="w-[1px] h-5 bg-slate-300 mx-0.5" />

      {/* 4. Zoom Buttons with Step (%) */}
      <div className="flex items-center gap-1">
        <button onClick={() => onZoomBy(zoomStep)} className={btnClass} title="Zoom in">
          +
        </button>
        <button onClick={() => onZoomBy(-zoomStep)} className={btnClass} title="Zoom out">
          −
        </button>
        <span className="text-[11px] text-slate-500 ml-1">Step (%):</span>
        <input
          type="number"
          value={zoomStep}
          onChange={(e) => setZoomStep(safeStep(e.target.value, zoomStep, 95))}
          min={0.1} max={95} step="any" aria-label="缩放步长（百分比）"
          className="w-10 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center text-xs text-slate-800"
        />
      </div>

      <div className="w-[1px] h-5 bg-slate-300 mx-0.5" />

      {/* 5. VESTA Boundary & Display Toggles */}
      <div className="flex items-center gap-1.5 ml-auto">
        <button
          onClick={() => onUpdateVisualSettings({ showBoundaryAtoms: !visualSettings.showBoundaryAtoms })}
          className={`px-2 py-0.5 rounded text-xs font-semibold border transition ${
            visualSettings.showBoundaryAtoms
              ? 'bg-[#e2e8f0] border-slate-400 text-slate-900 font-bold'
              : 'bg-white border-[#cbd5e1] text-slate-600 hover:bg-[#f1f5f9]'
          }`}
          title="VESTA 周期性边界补全（补齐晶胞边界原子与成键，数量依当前结构而定）"
        >
          <span>Boundary PBC: {visualSettings.showBoundaryAtoms ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={onToggleLattice}
          className={`px-2 py-0.5 rounded text-xs font-semibold border transition ${
            showLattice
              ? 'bg-[#e2e8f0] border-slate-400 text-slate-900 font-bold'
              : 'bg-white border-[#cbd5e1] text-slate-600 hover:bg-[#f1f5f9]'
          }`}
          title="晶胞线框显示开关"
        >
          <span>Unit Cell: {showLattice ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={onToggleAxes}
          className={`px-2 py-0.5 rounded text-xs font-semibold border transition ${
            showAxes
              ? 'bg-[#e2e8f0] border-slate-400 text-slate-900 font-bold'
              : 'bg-white border-[#cbd5e1] text-slate-600 hover:bg-[#f1f5f9]'
          }`}
          title="晶格基矢量箭头 (a, b, c) 显示开关"
        >
          <span>Axes: {showAxes ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => onViewAlong('reset')}
          className={`${btnClass} flex items-center gap-1 text-slate-800 font-bold`}
          title="复位视角居中"
        >
          <RefreshCcw size={11} />
          <span>Reset</span>
        </button>

        {onOpenRenderModal && (
          <button
            onClick={onOpenRenderModal}
            className="px-2.5 py-0.5 rounded text-xs font-bold border border-[#cbd5e1] bg-white text-slate-800 hover:bg-[#e2e8f0] flex items-center gap-1.5 transition shadow-2xs cursor-pointer ml-1 active:bg-[#cbd5e1]"
            title="渲染图像 (1080p / 2K / 4K / 8K / 透明背景)"
          >
            <Camera size={12} className="text-slate-700" />
            <span>渲染图像</span>
          </button>
        )}
      </div>

    </div>
  );
};
