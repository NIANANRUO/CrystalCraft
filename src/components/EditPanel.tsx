import React, { useState } from 'react';
import { 
  Atom as AtomIcon, 
  Trash2, 
  RefreshCw, 
  Plus, 
  Layers, 
  Info,
  Sliders,
  Palette,
  Eye,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { Atom, CrystalStructure, VisualSettings, BondStyle } from '../types/crystal';
import { getElement, getDisplayRadius } from '../constants/elements';

interface EditPanelProps {
  structure: CrystalStructure | null;
  selectedAtom: Atom | null;
  visualSettings: VisualSettings;
  onUpdateVisualSettings: (settings: Partial<VisualSettings>) => void;
  onSetAtomColor: (atomId: number, color: string | null) => void;
  onSetElementColor: (element: string, color: string | null) => void;
  onSetAtomRadius: (atomId: number, radius: number | null) => void;
  onSetElementRadius: (element: string, radius: number | null) => void;
  onOpenPeriodicTable: () => void;
  onDeleteSelected: () => void;
  onQuickReplace: (elem: string) => void;
  onAddAtom: (element: string, fracCoords: { x: number; y: number; z: number }) => void;
}

// Signature LightCone & Publication Color Palette
const SIGNATURE_COLORS = [
  { name: 'LightCone 蓝绿', color: '#4aa1a1' },
  { name: '石墨烯 灰蓝',   color: '#9dafc6' },
  { name: '吡咯氮 宝蓝',   color: '#2b5893' },
  { name: '磷原子 亮橙',   color: '#e47200' },
  { name: '氧配位 纯红',   color: '#ef4444' },
  { name: '硫配位 鲜黄',   color: '#eab308' },
  { name: '过渡金属 翡翠', color: '#10b981' },
  { name: '贵金属 琥珀',   color: '#f59e0b' },
  { name: '深灰 碳棒',     color: '#334155' },
  { name: '纯白 氢球',     color: '#ffffff' }
];

export const EditPanel: React.FC<EditPanelProps> = ({
  structure,
  selectedAtom,
  visualSettings,
  onUpdateVisualSettings,
  onSetAtomColor,
  onSetElementColor,
  onSetAtomRadius,
  onSetElementRadius,
  onOpenPeriodicTable,
  onDeleteSelected,
  onQuickReplace,
  onAddAtom
}) => {
  // Color modification scope for selected atom: 'single' (当前原子独享) vs 'element' (整类元素批量)
  const [colorScope, setColorScope] = useState<'single' | 'element'>('element');

  // New atom addition form state
  const [newElem, setNewElem] = useState('O');
  const [newX, setNewX] = useState('0.5');
  const [newY, setNewY] = useState('0.5');
  const [newZ, setNewZ] = useState('0.5');

  const selectedElemInfo = selectedAtom ? getElement(selectedAtom.element) : null;

  // Determine current effective color of the selected atom
  const currentAtomColor = selectedAtom
    ? selectedAtom.colorOverride || visualSettings.elementColors[selectedAtom.element] || selectedElemInfo?.color || '#9dafc6'
    : '#9dafc6';

  // Determine current effective radius of the selected atom
  const currentAtomRadius = selectedAtom
    ? selectedAtom.radiusOverride ?? visualSettings.elementRadii[selectedAtom.element] ?? getDisplayRadius(selectedAtom.element)
    : 0.28;

  // Common doping / replacement quick-picks
  const QUICK_ELEMENTS = ['O', 'N', 'S', 'P', 'C', 'Ti', 'Zr', 'Fe', 'Co', 'Ni', 'Mo', 'Au'];

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const x = parseFloat(newX);
    const y = parseFloat(newY);
    const z = parseFloat(newZ);
    if ([x, y, z].every(Number.isFinite) && newElem.trim()) {
      onAddAtom(newElem.trim(), { x, y, z });
    }
  };

  // Compute stoichiometry formula and element inventory
  const formulaMap: Record<string, number> = {};
  structure?.atoms.forEach(a => {
    formulaMap[a.element] = (formulaMap[a.element] || 0) + 1;
  });
  const formulaStr = Object.entries(formulaMap)
    .map(([elem, count]) => `${elem}${count > 1 ? count : ''}`)
    .join('');

  return (
    <aside className="w-84 border-l border-slate-200 bg-white p-4 flex flex-col gap-4 overflow-y-auto select-none shadow-xs text-slate-800">
      
      {/* 1. Selected Atom Card & Customization */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <AtomIcon size={15} className="text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              选中原子位点
            </h2>
          </div>
          {selectedAtom && (
            <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
              ID: #{selectedAtom.id}
            </span>
          )}
        </div>

        {selectedAtom && selectedElemInfo ? (
          <div className="flex flex-col gap-3">
            {/* Element Identity Badge */}
            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span 
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-xs border border-black/10 transition-colors"
                  style={{ backgroundColor: currentAtomColor, color: '#ffffff' }}
                >
                  {selectedElemInfo.symbol}
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-900">{selectedElemInfo.nameCn}</span>
                    <span className="text-xs text-slate-500">({selectedElemInfo.name})</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    序数 {selectedElemInfo.number} • 半径 {currentAtomRadius.toFixed(2)} Å
                  </span>
                </div>
              </div>
            </div>

            {/* Atom Color Customization (Single Atom vs Whole Element) */}
            <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Palette size={13} className="text-slate-600" />
                  <span>原子颜色自定义</span>
                </span>
                {/* Scope Toggle: Single vs Element */}
                <div className="flex rounded-md bg-slate-100 p-0.5 text-[10px] border border-slate-200">
                  <button
                    onClick={() => setColorScope('single')}
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      colorScope === 'single'
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="仅修改当前选中的独立原子颜色"
                  >
                    独立修改
                  </button>
                  <button
                    onClick={() => setColorScope('element')}
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      colorScope === 'element'
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title={`批量修改晶胞中所有 ${selectedAtom.element} 原子的颜色`}
                  >
                    按元素整体
                  </button>
                </div>
              </div>

              {/* Color Picker Input & Hex */}
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-300 shadow-xs shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={currentAtomColor}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      if (colorScope === 'single') {
                        onSetAtomColor(selectedAtom.id, newColor);
                      } else {
                        onSetElementColor(selectedAtom.element, newColor);
                      }
                    }}
                    className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer border-0 p-0"
                  />
                </div>
                <input
                  type="text"
                  value={currentAtomColor}
                  onChange={(e) => {
                    const newColor = e.target.value;
                    if (colorScope === 'single') {
                      onSetAtomColor(selectedAtom.id, newColor);
                    } else {
                      onSetElementColor(selectedAtom.element, newColor);
                    }
                  }}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 text-center uppercase"
                />
                <button
                  onClick={() => {
                    if (colorScope === 'single') {
                      onSetAtomColor(selectedAtom.id, null);
                    } else {
                      onSetElementColor(selectedAtom.element, null);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-600 font-medium transition"
                  title="恢复默认预设颜色"
                >
                  <RotateCcw size={11} />
                  <span>恢复默认</span>
                </button>
              </div>

              {/* Signature Quick Palette */}
              <div className="pt-1">
                <div className="text-[10px] text-slate-400 font-medium mb-1">推荐出版级配色:</div>
                <div className="grid grid-cols-5 gap-1">
                  {SIGNATURE_COLORS.map(item => (
                    <button
                      key={item.color}
                      onClick={() => {
                        if (colorScope === 'single') {
                          onSetAtomColor(selectedAtom.id, item.color);
                        } else {
                          onSetElementColor(selectedAtom.element, item.color);
                        }
                      }}
                      className="w-full h-5 rounded-md border border-slate-300 shadow-xs hover:scale-105 transition"
                      style={{ backgroundColor: item.color }}
                      title={item.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Atom Size Override Slider */}
            <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700">
                  {colorScope === 'single' ? '此原子独立尺寸 (Radius)' : `${selectedAtom.element} 元素整体尺寸`}
                </span>
                <span className="font-mono text-slate-500 font-semibold">{currentAtomRadius.toFixed(2)} Å</span>
              </div>
              <input
                type="range"
                min="0.15"
                max="0.80"
                step="0.01"
                value={currentAtomRadius}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (colorScope === 'single') {
                    onSetAtomRadius(selectedAtom.id, val);
                  } else {
                    onSetElementRadius(selectedAtom.element, val);
                  }
                }}
                className="w-full accent-slate-800 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Coordinates Display */}
            <div className="bg-white rounded-xl p-2.5 border border-slate-200 text-[11px] font-mono space-y-1.5 shadow-xs">
              <div className="text-slate-500 font-sans font-semibold text-[10px] uppercase">
                分数坐标 (Fractional):
              </div>
              <div className="grid grid-cols-3 gap-1 text-center bg-slate-50 p-1.5 rounded-lg text-slate-800 border border-slate-200/60 font-medium">
                <span>x: {selectedAtom.fractional.x.toFixed(4)}</span>
                <span>y: {selectedAtom.fractional.y.toFixed(4)}</span>
                <span>z: {selectedAtom.fractional.z.toFixed(4)}</span>
              </div>

              <div className="text-slate-500 font-sans font-semibold text-[10px] uppercase pt-1">
                笛卡尔坐标 (Cartesian Å):
              </div>
              <div className="grid grid-cols-3 gap-1 text-center bg-slate-50 p-1.5 rounded-lg text-slate-800 border border-slate-200/60 font-medium">
                <span>X: {selectedAtom.cartesian.x.toFixed(3)}</span>
                <span>Y: {selectedAtom.cartesian.y.toFixed(3)}</span>
                <span>Z: {selectedAtom.cartesian.z.toFixed(3)}</span>
              </div>
            </div>

            {/* Atom Replace / Doping Action */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                <span>原子替换 / 掺杂</span>
                <span className="text-[10px] text-slate-400">VESTA 核心能力</span>
              </div>

              <button
                onClick={onOpenPeriodicTable}
                className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white shadow-xs transition"
              >
                <RefreshCw size={13} />
                <span>打开元素周期表替换...</span>
              </button>

              {/* Quick Pick Pills */}
              <div className="flex flex-wrap gap-1 pt-0.5">
                {QUICK_ELEMENTS.map(elem => (
                  <button
                    key={elem}
                    onClick={() => onQuickReplace(elem)}
                    className="px-2 py-0.5 rounded-md text-[11px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono shadow-xs transition"
                  >
                    {elem}
                  </button>
                ))}
              </div>
            </div>

            {/* Delete Atom Action */}
            <button
              onClick={onDeleteSelected}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs text-rose-700 font-medium transition"
            >
              <Trash2 size={13} />
              <span>删除此原子 (制造空位缺陷)</span>
            </button>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <Info size={20} className="text-slate-400" />
            <span>在 3D 场景中点击任意原子，<br/>即可调节独立颜色、尺寸、替换或删除</span>
          </div>
        )}
      </div>

      {/* 2. Global Bond & Geometry Visual Fine-Tuning */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders size={15} className="text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              成键形式与几何调节
            </h2>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            LightCone 标配
          </span>
        </div>

        {/* Bond Style: Auto (Double in aromatic) vs All Double vs Single */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
            <span>化学键显示样式:</span>
          </div>
          <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[11px]">
            <button
              onClick={() => onUpdateVisualSettings({ bondStyle: 'aromatic' })}
              className={`py-1 rounded-lg font-semibold transition ${
                visualSettings.bondStyle === 'aromatic'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="一实一虚芳香共振双键"
            >
              一实一虚
            </button>
            <button
              onClick={() => onUpdateVisualSettings({ bondStyle: 'tapered' })}
              className={`py-1 rounded-lg font-semibold transition ${
                visualSettings.bondStyle === 'tapered'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="根据原子半径渐变过渡的圆台锥形键"
            >
              渐变锥形
            </button>
            <button
              onClick={() => onUpdateVisualSettings({ bondStyle: 'parallel' })}
              className={`py-1 rounded-lg font-semibold transition ${
                visualSettings.bondStyle === 'parallel'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="对称双实线"
            >
              双实线
            </button>
            <button
              onClick={() => onUpdateVisualSettings({ bondStyle: 'single' })}
              className={`py-1 rounded-lg font-semibold transition ${
                visualSettings.bondStyle === 'single'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="所有成键均渲染为标准单棍"
            >
              标准单键
            </button>
          </div>
        </div>

        {/* Atom Scale Slider */}
        <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700">全局原子尺寸缩放 (Atom Scale)</span>
            <span className="font-mono text-slate-500 font-semibold">{visualSettings.atomScale.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.30"
            max="1.80"
            step="0.05"
            value={visualSettings.atomScale}
            onChange={(e) => onUpdateVisualSettings({ atomScale: parseFloat(e.target.value) })}
            className="w-full accent-slate-800 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>

        {/* Bond Cutoff Tolerance Slider (Solves "太挤了") */}
        <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700">成键距离容差 (Bond Cutoff)</span>
            <span className="font-mono text-slate-500 font-semibold">{visualSettings.bondTolerance.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.80"
            max="1.50"
            step="0.02"
            value={visualSettings.bondTolerance}
            onChange={(e) => onUpdateVisualSettings({ bondTolerance: parseFloat(e.target.value) })}
            className="w-full accent-slate-800 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>

        {/* Bond Radius (Thickness) Slider */}
        <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700">化学键粗细 (Bond Radius)</span>
            <span className="font-mono text-slate-500 font-semibold">{visualSettings.bondRadius.toFixed(2)} Å</span>
          </div>
          <input
            type="range"
            min="0.03"
            max="0.16"
            step="0.01"
            value={visualSettings.bondRadius}
            onChange={(e) => onUpdateVisualSettings({ bondRadius: parseFloat(e.target.value) })}
            className="w-full accent-slate-800 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>

        {/* Double Bond Gap Slider */}
        {visualSettings.bondStyle !== 'single' && (
          <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">双线平行间距 (Double Gap)</span>
              <span className="font-mono text-slate-500 font-semibold">{visualSettings.doubleBondGap.toFixed(2)} Å</span>
            </div>
            <input
              type="range"
              min="0.04"
              max="0.24"
              step="0.01"
              value={visualSettings.doubleBondGap}
              onChange={(e) => onUpdateVisualSettings({ doubleBondGap: parseFloat(e.target.value) })}
              className="w-full accent-slate-800 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        )}

        {/* Aromatic Gap Ratio Slider */}
        {(visualSettings.bondStyle === 'aromatic' || visualSettings.bondStyle === 'auto') && (
          <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">虚键缺口比例 (Aromatic Gap)</span>
              <span className="font-mono text-slate-500 font-semibold">{Math.round((visualSettings.aromaticGapRatio ?? 0.20) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.08"
              max="0.36"
              step="0.02"
              value={visualSettings.aromaticGapRatio ?? 0.20}
              onChange={(e) => onUpdateVisualSettings({ aromaticGapRatio: parseFloat(e.target.value) })}
              className="w-full accent-slate-800 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* 3. Element Inventory & Global Color Palette */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-xs space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Palette size={15} className="text-slate-700" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            元素配色与数量清单
          </h2>
        </div>

        <div className="space-y-1.5">
          {Object.entries(formulaMap).map(([elem, count]) => {
            const elemInfo = getElement(elem);
            const currentClr = visualSettings.elementColors[elem] || elemInfo.color;
            return (
              <div 
                key={elem}
                className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="relative w-5 h-5 rounded-full border border-slate-300 overflow-hidden cursor-pointer shadow-2xs">
                    <input
                      type="color"
                      value={currentClr}
                      onChange={(e) => onSetElementColor(elem, e.target.value)}
                      className="absolute -top-2 -left-2 w-9 h-9 cursor-pointer border-0 p-0"
                    />
                  </div>
                  <span className="font-bold text-slate-900">{elem}</span>
                  <span className="text-[11px] text-slate-500">({elemInfo.nameCn})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-slate-700">{count} 个</span>
                  {visualSettings.elementColors[elem] && (
                    <button
                      onClick={() => onSetElementColor(elem, null)}
                      className="text-[10px] text-slate-400 hover:text-slate-700"
                      title="重置为默认元素颜色"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Add New Atom to Cell */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-xs">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Plus size={15} className="text-slate-700" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            添加新原子
          </h2>
        </div>

        <form onSubmit={handleAddSubmit} className="flex flex-col gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <label className="text-slate-500 w-16">元素符号:</label>
            <input
              type="text"
              value={newElem}
              onChange={e => setNewElem(e.target.value)}
              placeholder="e.g. O, Fe, Si"
              className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-900 font-mono focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-500 w-16">分数坐标:</label>
            <div className="flex-1 grid grid-cols-3 gap-1">
              <input
                type="text"
                value={newX}
                onChange={e => setNewX(e.target.value)}
                placeholder="x"
                className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-slate-900 font-mono text-center focus:border-slate-400 focus:outline-none"
              />
              <input
                type="text"
                value={newY}
                onChange={e => setNewY(e.target.value)}
                placeholder="y"
                className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-slate-900 font-mono text-center focus:border-slate-400 focus:outline-none"
              />
              <input
                type="text"
                value={newZ}
                onChange={e => setNewZ(e.target.value)}
                placeholder="z"
                className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-slate-900 font-mono text-center focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 font-semibold text-white shadow-xs transition"
          >
            <Plus size={13} />
            <span>添加入晶胞</span>
          </button>
        </form>
      </div>

      {/* 5. Structure Parameters (Lattice & Formula) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-xs text-xs space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Layers size={15} className="text-slate-700" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            晶体物理参数
          </h2>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-slate-200">
          <span className="text-slate-500">化学式:</span>
          <span className="font-mono font-bold text-slate-900">{formulaStr || '无'}</span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-slate-200">
          <span className="text-slate-500">总原子数:</span>
          <span className="font-mono font-semibold text-slate-900">{structure?.atoms.length || 0}</span>
        </div>

        {structure?.lattice && (
          <>
            <div className="pt-1">
              <span className="text-slate-500 block mb-1">晶格常数 (Lattice Constants):</span>
              <div className="grid grid-cols-3 gap-1 bg-white p-2 rounded-lg border border-slate-200 font-mono text-[11px] text-center text-slate-800 shadow-xs">
                <div>a: {structure.lattice.a.toFixed(3)} Å</div>
                <div>b: {structure.lattice.b.toFixed(3)} Å</div>
                <div>c: {structure.lattice.c.toFixed(3)} Å</div>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block mb-1">晶胞夹角 (Angles):</span>
              <div className="grid grid-cols-3 gap-1 bg-white p-2 rounded-lg border border-slate-200 font-mono text-[11px] text-center text-slate-800 shadow-xs">
                <div>α: {structure.lattice.alpha.toFixed(1)}°</div>
                <div>β: {structure.lattice.beta.toFixed(1)}°</div>
                <div>γ: {structure.lattice.gamma.toFixed(1)}°</div>
              </div>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">晶胞体积 V:</span>
              <span className="font-mono text-slate-900 font-semibold">{structure.lattice.volume.toFixed(2)} Å³</span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
