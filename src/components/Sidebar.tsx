import React from 'react';
import { 
  Sparkles, 
  Box, 
  CircleDot, 
  Share2, 
  Grid, 
  Compass, 
  Palette, 
  Sun,
  Moon
} from 'lucide-react';
import { PresetMaterialType, RenderMode } from '../types/crystal';

interface SidebarProps {
  materialType: PresetMaterialType;
  renderMode: RenderMode;
  showLattice: boolean;
  showAxes: boolean;
  bgColor: 'dark' | 'white';
  onMaterialChange: (mat: PresetMaterialType) => void;
  onRenderModeChange: (mode: RenderMode) => void;
  onToggleLattice: () => void;
  onToggleAxes: () => void;
  onBgColorChange: (color: 'dark' | 'white') => void;
}

const MATERIALS: { id: PresetMaterialType; label: string; desc: string; dotColor: string }[] = [
  { id: 'toon', label: '卡通', desc: '离散切面阶梯着色与高对比外轮廓', dotColor: 'bg-rose-500' },
  { id: 'metallic', label: '金属', desc: '镜面强反射与各向异性金属光', dotColor: 'bg-amber-500' },
  { id: 'glossy', label: '光泽', desc: '晶莹清漆层，通透高反射', dotColor: 'bg-sky-500' },
  { id: 'plastic', label: '塑料', desc: '经典分子模型球体质感', dotColor: 'bg-emerald-500' },
  { id: 'smooth', label: '平滑', desc: '柔和漫反射，耐看立体', dotColor: 'bg-slate-400' },
  { id: 'flat', label: '纯色', desc: '无光照恒定色，极简示意', dotColor: 'bg-indigo-500' }
];

const RENDER_MODES: { id: RenderMode; label: string; icon: React.ReactNode }[] = [
  { id: 'ball-and-stick', label: '球棍模型', icon: <Share2 size={14} /> },
  { id: 'space-filling', label: '空间填充 (CPK)', icon: <CircleDot size={14} /> },
  { id: 'stick', label: '纯棍状', icon: <Box size={14} /> },
  { id: 'wireframe', label: '线框网格', icon: <Grid size={14} /> }
];

export const Sidebar: React.FC<SidebarProps> = ({
  materialType,
  renderMode,
  showLattice,
  showAxes,
  bgColor,
  onMaterialChange,
  onRenderModeChange,
  onToggleLattice,
  onToggleAxes,
  onBgColorChange
}) => {
  return (
    <aside className="w-64 border-r border-slate-200 bg-white p-4 flex flex-col gap-6 overflow-y-auto select-none shadow-xs">
      {/* 1. LightCone 1:1 Material Styles */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Palette size={15} className="text-slate-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            材质渲染风格 (PBR)
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {MATERIALS.map(m => {
            const isActive = materialType === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onMaterialChange(m.id)}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 w-full mb-1">
                  <span className={`w-2 h-2 rounded-full ${m.dotColor}`} />
                  <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-800'}`}>
                    {m.label}
                  </span>
                </div>
                <span className={`text-[10px] leading-tight ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                  {m.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Display Model (Ball-and-stick, Space-filling...) */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Box size={15} className="text-slate-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            结构模型显示
          </h2>
        </div>

        <div className="flex flex-col gap-1.5 bg-slate-100/70 p-1 rounded-xl border border-slate-200">
          {RENDER_MODES.map(mode => {
            const isActive = renderMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onRenderModeChange(mode.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {mode.icon}
                  <span>{mode.label}</span>
                </div>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Lattice & Axes Controls (VESTA feature) */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Compass size={15} className="text-slate-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            晶格与边界控制
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {/* Lattice Box Toggle */}
          <button
            onClick={onToggleLattice}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition ${
              showLattice
                ? 'bg-slate-50 border-slate-300 text-slate-900'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span>显示晶胞边框 (Unit Cell)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${showLattice ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {showLattice ? '开启' : '关闭'}
            </span>
          </button>

          {/* Axes Helper Toggle */}
          <button
            onClick={onToggleAxes}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition ${
              showAxes
                ? 'bg-slate-50 border-slate-300 text-slate-900'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span>晶格矢量箭头 (a, b, c)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${showAxes ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {showAxes ? '开启' : '关闭'}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Background Color Switcher (Pure White vs Dark) */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Sun size={15} className="text-slate-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            视口底色
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onBgColorChange('white')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-medium transition ${
              bgColor === 'white'
                ? 'bg-slate-900 border-slate-900 text-white shadow-xs font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sun size={13} className={bgColor === 'white' ? 'text-amber-300' : 'text-slate-400'} />
            <span>纯白底色</span>
          </button>

          <button
            onClick={() => onBgColorChange('dark')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-medium transition ${
              bgColor === 'dark'
                ? 'bg-slate-900 border-slate-900 text-white shadow-xs font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Moon size={13} className={bgColor === 'dark' ? 'text-sky-300' : 'text-slate-400'} />
            <span>暗夜深色</span>
          </button>
        </div>
      </div>

      {/* 5. Clean Professional Tips */}
      <div className="mt-auto p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700 flex items-center gap-1">
          <Sparkles size={12} className="text-slate-600" />
          <span>交互提示</span>
        </p>
        <p>• 鼠标左键拖拽：自由旋转视图</p>
        <p>• 鼠标滚轮缩放：放大/缩小视角</p>
        <p>• 点击任意原子：选中并在右侧编辑</p>
      </div>
    </aside>
  );
};
