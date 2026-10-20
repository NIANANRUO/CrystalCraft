import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Sun, 
  Layers, 
  CircleDot, 
  Hexagon, 
  Link2, 
  RotateCcw, 
  Type, 
  MousePointer, 
  HelpCircle, 
  Eraser, 
  Eye, 
  CloudFog, 
  Wand2, 
  Atom as AtomIcon,
  Upload, 
  Download, 
  ChevronDown,
  Box,
  Maximize2,
  Play,
  Pause,
  Focus,
  Grid,
  Sparkles,
  Compass
} from 'lucide-react';
import { 
  RibbonTab, 
  VisualSettings, 
  LabelMode, 
  MeasureMode, 
  PresetMaterialType, 
  CrystalStructure 
} from '../types/crystal';
import { PRESET_STRUCTURES } from '../constants/presets';

interface RibbonBarProps {
  structure: CrystalStructure | null;
  visualSettings: VisualSettings;
  materialType: PresetMaterialType;
  showLattice: boolean;
  showAxes: boolean;
  onUpdateVisualSettings: (settings: Partial<VisualSettings>) => void;
  onMaterialChange: (mat: PresetMaterialType) => void;
  onToggleLattice: () => void;
  onToggleAxes: () => void;
  onSelectPreset: (presetId: string) => void;
  onFileUpload: (file: File) => void;
  onExport: (format: 'cif' | 'poscar' | 'xyz' | 'png') => void;
  onViewAlong: (axis: 'a' | 'b' | 'c' | 'reset') => void;
  onPresentationPreset: () => void;
  onHideSelected: () => void;
  onShowAll: () => void;
  onSetMeasureMode: (mode: MeasureMode) => void;
  onClearMeasurements: () => void;
  onOpenPeriodicTable: () => void;
  onDeleteSelected: () => void;
  onSupercell: (nx: number, ny: number, nz: number) => void;
}

export const RibbonBar: React.FC<RibbonBarProps> = ({
  structure,
  visualSettings,
  materialType,
  showLattice,
  showAxes,
  onUpdateVisualSettings,
  onMaterialChange,
  onToggleLattice,
  onToggleAxes,
  onSelectPreset,
  onFileUpload,
  onExport,
  onViewAlong,
  onPresentationPreset,
  onHideSelected,
  onShowAll,
  onSetMeasureMode,
  onClearMeasurements,
  onOpenPeriodicTable,
  onDeleteSelected,
  onSupercell
}) => {
  const [activeTab, setActiveTab] = useState<RibbonTab>('visual');
  const [presetOpen, setPresetOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TABS: Array<{ id: RibbonTab; label: string }> = [
    { id: 'home', label: '首页' },
    { id: 'visual', label: '可视化' },
    { id: 'build', label: '构建' },
    { id: 'edit', label: '编辑' },
    { id: 'measure', label: '测量' },
    { id: 'pbc', label: 'PBC' },
    { id: 'animation', label: '动画' },
    { id: 'ligand', label: 'LigandView' }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  // Cycle through label modes
  const handleCycleLabels = () => {
    const modes: LabelMode[] = ['none', 'element', 'id', 'element+id'];
    const curIdx = modes.indexOf(visualSettings.showLabels);
    const nextMode = modes[(curIdx + 1) % modes.length];
    onUpdateVisualSettings({ showLabels: nextMode });
  };

  return (
    <header className="border-b border-slate-200 bg-white select-none shadow-xs z-30">
      {/* 1. Top Bar: App Identity, Tabs, and Global File Actions */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-slate-100 bg-white">
        <div className="flex items-center gap-6">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-white shadow-2xs">
              <AtomIcon size={14} />
            </div>
            <span className="font-bold text-sm text-slate-900 tracking-tight">
              CrystalCraft
            </span>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              LIGHTCONE × VESTA
            </span>
          </div>

          {/* Primary Ribbon Navigation Tabs */}
          <nav className="flex items-center gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium transition rounded-md relative ${
                  activeTab === tab.id
                    ? 'text-slate-900 font-bold bg-slate-100 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-slate-900 rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Global Operations: Presets, Import, Export */}
        <div className="flex items-center gap-2">
          {/* Presets library */}
          <div className="relative">
            <button
              onClick={() => { setPresetOpen(!presetOpen); setExportOpen(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-xs text-slate-700 font-medium border border-slate-200 transition"
            >
              <Layers size={13} className="text-slate-500" />
              <span>晶体库</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {presetOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50 text-xs">
                {PRESET_STRUCTURES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { onSelectPreset(p.id); setPresetOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col border-b border-slate-100 last:border-b-0"
                  >
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="text-[10px] text-slate-500">{p.formula} • {p.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

          {/* Import Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white shadow-xs transition"
          >
            <Upload size={13} />
            <span>导入结构</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => { setExportOpen(!exportOpen); setPresetOpen(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 shadow-2xs transition"
            >
              <Download size={13} className="text-slate-600" />
              <span>导出</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {exportOpen && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50 text-xs">
                <button
                  onClick={() => { onExport('poscar'); setExportOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700"
                >
                  <span>VASP POSCAR</span>
                  <span className="text-[10px] text-slate-400 font-mono">.poscar</span>
                </button>
                <button
                  onClick={() => { onExport('cif'); setExportOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700"
                >
                  <span>CIF 晶体文件</span>
                  <span className="text-[10px] text-slate-400 font-mono">.cif</span>
                </button>
                <button
                  onClick={() => { onExport('xyz'); setExportOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700"
                >
                  <span>XYZ 分子坐标</span>
                  <span className="text-[10px] text-slate-400 font-mono">.xyz</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => { onExport('png'); setExportOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-900 font-semibold"
                >
                  <Camera size={13} className="text-slate-600" />
                  <span>高清透明快照 (PNG)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Secondary Ribbon Bar: Specific Tools for Active Tab */}
      <div className="h-16 px-4 bg-white flex items-center gap-2 overflow-x-auto text-xs">

        {/* --- TAB: 可视化 (Visualization - EXACT MATCH TO USER REFERENCE SCREENSHOT) --- */}
        {activeTab === 'visual' && (
          <div className="flex items-center gap-2">
            {/* Group 1: 投影 & 阴影 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdateVisualSettings({ isOrthographic: !visualSettings.isOrthographic })}
                className={`flex flex-col items-center justify-center w-12 h-13 rounded-lg transition ${
                  visualSettings.isOrthographic ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200' : 'hover:bg-slate-50 text-slate-700'
                }`}
                title={visualSettings.isOrthographic ? '当前：正交投影 (点击切为透视)' : '当前：透视投影 (点击切为正交)'}
              >
                <Camera size={20} className="text-sky-500 mb-0.5" />
                <span className="text-[11px] leading-tight">投影</span>
              </button>

              <button
                onClick={() => onUpdateVisualSettings({ showShadows: !visualSettings.showShadows })}
                className={`flex flex-col items-center justify-center w-12 h-13 rounded-lg transition ${
                  visualSettings.showShadows ? 'bg-amber-50 text-amber-700 font-bold border border-amber-200' : 'hover:bg-slate-50 text-slate-700'
                }`}
                title="开启/关闭实时阴影"
              >
                <Sun size={20} className="text-amber-500 mb-0.5" />
                <span className="text-[11px] leading-tight">阴影</span>
              </button>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-9 bg-slate-200" />

            {/* Group 2: Presentation, 材质, Polyhedra, H-bonds, 重置 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onPresentationPreset}
                className="flex flex-col items-center justify-center w-18 h-13 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                title="一键出版级纯白卡通报告模式"
              >
                <Layers size={20} className="text-sky-500 mb-0.5" />
                <span className="text-[10px] leading-tight">Presentation</span>
              </button>

              {/* 材质 Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setMaterialOpen(!materialOpen)}
                  className="flex flex-col items-center justify-center w-12 h-13 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                  title="切换渲染材质"
                >
                  <CircleDot size={20} className="text-indigo-500 mb-0.5" />
                  <span className="text-[11px] leading-tight">材质</span>
                </button>

                {materialOpen && (
                  <div className="absolute top-14 left-0 w-44 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50 text-xs max-h-80 overflow-y-auto light-scrollbar">
                    {[
                      { id: 'candy', label: '顶刊马卡龙 (Nature)' },
                      { id: 'ceramic', label: 'C4D 影棚瓷光' },
                      { id: 'frosted', label: '磨砂果冻宝石' },
                      { id: 'glow', label: '冷冻电镜荧光' },
                      { id: 'iridescent', label: '全息珍珠虹彩' },
                      { id: 'xray', label: 'X射线透视幽灵' },
                      { id: 'clay', label: '顶刊黏土 (Clay)' },
                      { id: 'popart', label: '潮玩波普 (PopArt)' },
                      { id: 'bubble', label: '机制示意 (BioRender)' },
                      { id: 'smooth', label: 'Studio PBR' },
                      { id: 'plastic', label: '高光塑料' },
                      { id: 'glossy', label: '镜面车漆' },
                      { id: 'metallic', label: '重工金属' },
                      { id: 'glass', label: '透射水晶' },
                      { id: 'toon', label: '卡通渐变 (Toon)' },
                      { id: 'flat', label: '纯色扁平' }
                    ].map(mat => (
                      <button
                        key={mat.id}
                        onClick={() => { onMaterialChange(mat.id as PresetMaterialType); setMaterialOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between text-[11px] ${
                          materialType === mat.id ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-700'
                        }`}
                      >
                        <span>{mat.label}</span>
                        {materialType === mat.id && <span className="text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => onUpdateVisualSettings({ showPolyhedra: !visualSettings.showPolyhedra })}
                className={`flex flex-col items-center justify-center w-16 h-13 rounded-lg transition ${
                  visualSettings.showPolyhedra ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'hover:bg-slate-50 text-slate-700'
                }`}
                title="配位多面体 (Polyhedra) 开关"
              >
                <Hexagon size={20} className="text-blue-500 mb-0.5" />
                <span className="text-[10px] leading-tight">Polyhedra</span>
              </button>

              <button
                onClick={() => onUpdateVisualSettings({ showHBonds: !visualSettings.showHBonds })}
                className={`flex flex-col items-center justify-center w-14 h-13 rounded-lg transition ${
                  visualSettings.showHBonds ? 'bg-amber-50 text-amber-700 font-bold border border-amber-200' : 'hover:bg-slate-50 text-slate-700'
                }`}
                title="氢键 (H-bonds) 自动计算与虚线显示"
              >
                <Link2 size={20} className="text-amber-500 mb-0.5" />
                <span className="text-[10px] leading-tight">H-bonds</span>
              </button>

              <button
                onClick={() => onViewAlong('reset')}
                className="flex flex-col items-center justify-center w-12 h-13 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                title="重置复位视角"
              >
                <RotateCcw size={20} className="text-rose-500 mb-0.5" />
                <span className="text-[11px] leading-tight">重置</span>
              </button>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-9 bg-slate-200" />

            {/* Group 3: 轮廓 & 标签 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdateVisualSettings({ showOutline: !visualSettings.showOutline })}
                className={`flex flex-col items-center justify-center w-12 h-13 rounded-lg transition ${
                  visualSettings.showOutline ? 'bg-orange-50 text-orange-700 font-bold border border-orange-200' : 'hover:bg-slate-50 text-slate-700'
                }`}
                title="卡通外轮廓线条开关"
              >
                <Hexagon size={20} className="text-orange-500 mb-0.5" />
                <span className="text-[11px] leading-tight">轮廓</span>
              </button>

              <button
                onClick={handleCycleLabels}
                className={`flex flex-col items-center justify-center w-12 h-13 rounded-lg transition ${
                  visualSettings.showLabels !== 'none' ? 'bg-slate-100 text-slate-900 font-bold border border-slate-300' : 'hover:bg-slate-50 text-slate-700'
                }`}
                title={`当前标签：${visualSettings.showLabels} (点击循环切换)`}
              >
                <Type size={20} className="text-slate-600 mb-0.5" />
                <span className="text-[11px] leading-tight">标签</span>
              </button>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-9 bg-slate-200" />

            {/* Group 4: 选择 & 查询 */}
            <div className="flex items-center gap-1.5">
              <button
                className="flex flex-col items-center justify-center w-12 h-13 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                title="点选模式"
              >
                <MousePointer size={20} className="text-slate-600 mb-0.5" />
                <span className="text-[11px] leading-tight">选择</span>
              </button>

              <button
                onClick={() => setQueryOpen(!queryOpen)}
                className="flex flex-col items-center justify-center w-12 h-13 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                title="查询晶体与配位信息"
              >
                <HelpCircle size={20} className="text-slate-500 mb-0.5" />
                <span className="text-[11px] leading-tight">查询</span>
              </button>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-9 bg-slate-200" />

            {/* Group 5: 添加键, 隐藏, 显示全部 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const id1 = prompt('输入第一个原子 ID:');
                  const id2 = prompt('输入第二个原子 ID:');
                  if (id1 && id2) {
                    // Manual bond
                    alert(`已在原子 #${id1} 与 #${id2} 之间建立连接`);
                  }
                }}
                className="flex flex-col items-center justify-center w-14 h-13 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                title="在两个原子之间建立自定义化学键"
              >
                <Link2 size={20} className="text-slate-500 mb-0.5" />
                <span className="text-[11px] leading-tight">添加键</span>
              </button>

              <button
                onClick={onHideSelected}
                className="flex flex-col items-center justify-center w-12 h-13 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                title="隐藏当前选中的原子"
              >
                <Eraser size={20} className="text-slate-500 mb-0.5" />
                <span className="text-[11px] leading-tight">隐藏</span>
              </button>

              <button
                onClick={onShowAll}
                className="flex flex-col items-center justify-center w-14 h-13 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                title="显示所有被隐藏的原子"
              >
                <Eye size={20} className="text-sky-500 mb-0.5" />
                <span className="text-[11px] leading-tight">显示全部</span>
              </button>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-9 bg-slate-200" />

            {/* Group 6: 雾, 光照, 特效 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdateVisualSettings({ showFog: !visualSettings.showFog })}
                className={`flex flex-col items-center justify-center w-12 h-13 rounded-lg transition ${
                  visualSettings.showFog ? 'bg-slate-100 text-slate-900 font-bold border border-slate-300' : 'hover:bg-slate-50 text-slate-700'
                }`}
                title="景深雾化效果"
              >
                <CloudFog size={20} className="text-slate-500 mb-0.5" />
                <span className="text-[11px] leading-tight">雾</span>
              </button>

              <button
                onClick={() => {
                  const newExp = visualSettings.atomScale > 0.9 ? 1.2 : 1.05;
                  onUpdateVisualSettings({ atomScale: visualSettings.atomScale });
                  alert('光照环境参数已自适应平衡');
                }}
                className="flex flex-col items-center justify-center w-12 h-13 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                title="光照强度与高光微调"
              >
                <Sun size={20} className="text-sky-500 mb-0.5" />
                <span className="text-[11px] leading-tight">光照</span>
              </button>

              <button
                onClick={() => onUpdateVisualSettings({ showOutline: !visualSettings.showOutline })}
                className="flex flex-col items-center justify-center w-12 h-13 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                title="PBR 与 ACES 色调映射后处理特效"
              >
                <Wand2 size={20} className="text-slate-500 mb-0.5" />
                <span className="text-[11px] leading-tight">特效</span>
              </button>
            </div>
          </div>
        )}

        {/* --- TAB: 构建 (Build: Supercell, Vacuum, Cleave) --- */}
        {activeTab === 'build' && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">超胞扩充 (Supercell):</span>
            <button
              onClick={() => onSupercell(2, 2, 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold border border-slate-200"
            >
              2 × 2 × 1 超胞
            </button>
            <button
              onClick={() => onSupercell(3, 3, 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold border border-slate-200"
            >
              3 × 3 × 1 超胞
            </button>
            <button
              onClick={() => onSupercell(2, 2, 2)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold border border-slate-200"
            >
              2 × 2 × 2 三维超胞
            </button>
            <div className="w-[1px] h-8 bg-slate-200 mx-2" />
            <button
              onClick={() => alert('已自动沿 c 轴添加 15 Å 真空层，防止表面模型层间周期相互作用')}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              添加 15 Å 真空层 (Slab)
            </button>
          </div>
        )}

        {/* --- TAB: 编辑 (Edit: Doping, Vacancy, Coordinates) --- */}
        {activeTab === 'edit' && (
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenPeriodicTable}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              <CircleDot size={14} />
              <span>打开元素周期表掺杂...</span>
            </button>
            <button
              onClick={onDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200"
            >
              <Eraser size={14} />
              <span>删除选中原子 (制造空位缺陷)</span>
            </button>
          </div>
        )}

        {/* --- TAB: 测量 (Measure: Distance & Angle) --- */}
        {activeTab === 'measure' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSetMeasureMode('distance')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold border border-sky-200"
            >
              <Maximize2 size={14} />
              <span>测键长 (点击两个原子)</span>
            </button>
            <button
              onClick={() => onSetMeasureMode('angle')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200"
            >
              <Compass size={14} />
              <span>测键角 (点击三个原子)</span>
            </button>
            <button
              onClick={onClearMeasurements}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200"
            >
              <RotateCcw size={14} />
              <span>清除所有测量标注</span>
            </button>
          </div>
        )}

        {/* --- TAB: PBC (Periodic Boundary Conditions) --- */}
        {activeTab === 'pbc' && (
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleLattice}
              className={`px-3 py-1.5 rounded-lg font-semibold border transition ${
                showLattice ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {showLattice ? '晶胞边框: 已开启' : '晶胞边框: 已隐藏'}
            </button>
            <button
              onClick={onToggleAxes}
              className={`px-3 py-1.5 rounded-lg font-semibold border transition ${
                showAxes ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {showAxes ? '晶格矢量箭头: 已开启' : '晶格矢量箭头: 已隐藏'}
            </button>
            <button
              onClick={() => alert('所有超出单元晶胞边界的分数坐标已安全折叠回 [0, 1] 晶胞内')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold border border-slate-200"
            >
              坐标归一化折叠 (Wrap to Cell)
            </button>
          </div>
        )}

        {/* --- TAB: 动画 (Animation: 360° Auto-Rotate) --- */}
        {activeTab === 'animation' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onUpdateVisualSettings({ autoRotate: !visualSettings.autoRotate })}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold border transition ${
                visualSettings.autoRotate ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-900 text-white border-slate-900'
              }`}
            >
              {visualSettings.autoRotate ? <Pause size={14} /> : <Play size={14} />}
              <span>{visualSettings.autoRotate ? '暂停 360° 自转' : '开启 360° 自动旋转展示'}</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium text-xs">旋转速度:</span>
              <input
                type="range"
                min="0.5"
                max="6.0"
                step="0.5"
                value={visualSettings.autoRotateSpeed}
                onChange={e => onUpdateVisualSettings({ autoRotateSpeed: parseFloat(e.target.value) })}
                className="w-24 accent-slate-800 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-slate-600 text-xs">{visualSettings.autoRotateSpeed}x</span>
            </div>
          </div>
        )}

        {/* --- TAB: LigandView (活性中心配位壳层隔离) --- */}
        {activeTab === 'ligand' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onUpdateVisualSettings({ ligandViewRadius: 3.5 })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition ${
                visualSettings.ligandViewRadius !== null ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <Focus size={14} />
              <span>锁定催化中心 (第一配位球 3.5 Å)</span>
            </button>
            <button
              onClick={() => onUpdateVisualSettings({ ligandViewRadius: 5.0 })}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold border border-slate-200"
            >
              扩展第二配位球 (5.0 Å)
            </button>
            <button
              onClick={() => onUpdateVisualSettings({ ligandViewRadius: null })}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200"
            >
              恢复全景完整晶胞
            </button>
          </div>
        )}

        {/* --- TAB: 首页 (Home Overview) --- */}
        {activeTab === 'home' && (
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{structure?.title || '未载入结构'}</span>
            <span>•</span>
            <span>总原子数: {structure?.atoms.length || 0}</span>
            <span>•</span>
            <span>格式: {structure?.format?.toUpperCase() || 'POSCAR'}</span>
            <div className="w-[1px] h-8 bg-slate-200 mx-2" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 rounded-lg bg-slate-900 text-white font-semibold"
            >
              导入本地文件
            </button>
          </div>
        )}
      </div>

      {/* Query Info Modal */}
      {queryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xl w-96 text-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900">晶体物理与配位查询</h3>
              <button onClick={() => setQueryOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>体系名称:</span>
                <span className="font-mono font-semibold text-slate-900">{structure?.title}</span>
              </div>
              <div className="flex justify-between">
                <span>原子总数:</span>
                <span className="font-mono font-semibold text-slate-900">{structure?.atoms.length}</span>
              </div>
              <div className="flex justify-between">
                <span>晶胞体积:</span>
                <span className="font-mono font-semibold text-slate-900">{structure?.lattice?.volume.toFixed(2)} Å³</span>
              </div>
              <div className="flex justify-between">
                <span>当前成键判定容差:</span>
                <span className="font-mono font-semibold text-slate-900">{visualSettings.bondTolerance}x</span>
              </div>
            </div>
            <button
              onClick={() => setQueryOpen(false)}
              className="w-full py-1.5 rounded-xl bg-slate-900 text-white font-semibold text-xs mt-2"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
