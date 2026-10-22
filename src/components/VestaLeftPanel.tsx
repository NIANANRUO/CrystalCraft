import React, { useState } from 'react';
import { 
  MousePointer, 
  Ruler, 
  Triangle, 
  Sliders, 
  ChevronDown, 
  ChevronRight,
  Eye,
  Box,
  Palette,
  Layers,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  RotateCcw,
  RefreshCw,
  FolderMinus,
  FolderPlus,
  Sun
} from 'lucide-react';
import { 
  RenderMode, 
  PresetMaterialType, 
  VisualSettings, 
  MeasureMode, 
  LabelMode, 
  BondStyle,
  CrystalStructure,
  Atom,
  DEFAULT_POLYHEDRA_SETTINGS
} from '../types/crystal';
import { getElement } from '../constants/elements';
import { PropertiesTab } from './VestaPropertiesModal';
import {MATERIAL_GROUPS} from '../materialCatalog';
import {MaterialDetails} from './MaterialDetails';

interface VestaLeftPanelProps {
  structure?: CrystalStructure | null;
  selectedAtom?: Atom | null;
  selectedAtoms?: Atom[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  renderMode: RenderMode;
  materialType: PresetMaterialType;
  visualSettings: VisualSettings;
  measureMode: MeasureMode;
  onRenderModeChange: (mode: RenderMode) => void;
  onMaterialChange: (mat: PresetMaterialType) => void;
  onUpdateVisualSettings: (settings: Partial<VisualSettings>) => void;
  onSetMeasureMode: (mode: MeasureMode) => void;
  onClearMeasurements: () => void;
  showLattice?: boolean;
  showAxes?: boolean;
  onToggleLattice?: () => void;
  onToggleAxes?: () => void;
  onOpenProperties: (tab?: PropertiesTab) => void;
  onOpenPeriodicTable: () => void;
  onOpenTransformModal?: () => void;
  onSupercell: (nx: number, ny: number, nz: number) => void;
  onViewAlong?: (axis: 'a' | 'b' | 'c' | 'a*' | 'b*' | 'c*' | 'reset') => void;
  hbondsCount?: number;
}

export const VestaLeftPanel: React.FC<VestaLeftPanelProps> = ({
  structure,
  selectedAtom,
  selectedAtoms = [],
  isCollapsed = false,
  onToggleCollapse,
  renderMode,
  materialType,
  visualSettings,
  measureMode,
  onRenderModeChange,
  onMaterialChange,
  onUpdateVisualSettings,
  onSetMeasureMode,
  onClearMeasurements,
  showLattice = true,
  showAxes = true,
  onToggleLattice,
  onToggleAxes,
  onOpenProperties,
  onOpenPeriodicTable,
  onOpenTransformModal,
  onSupercell,
  onViewAlong,
  hbondsCount
}) => {
  const [activeTab, setActiveTab] = useState<'style' | 'tools' | 'objects'>('style');
  const [modelsOpen, setModelsOpen] = useState(true);
  const [lightingOpen, setLightingOpen] = useState(true);
  const [geomOpen, setGeomOpen] = useState(false);

  // Supercell custom inputs
  const [supercellNx, setSupercellNx] = useState<number>(2);
  const [supercellNy, setSupercellNy] = useState<number>(2);
  const [supercellNz, setSupercellNz] = useState<number>(1);
  const [manualCenterId, setManualCenterId] = useState<string>('');

  // Toggle all accordions open/closed in one click
  const allOpen = modelsOpen && lightingOpen && geomOpen;
  const toggleAllAccordions = () => {
    const nextState = !allOpen;
    setModelsOpen(nextState);
    setLightingOpen(nextState);
    setGeomOpen(nextState);
  };

  // Compute element formula & inventory
  const formulaMap: Record<string, number> = {};
  structure?.atoms.forEach(a => {
    formulaMap[a.element] = (formulaMap[a.element] || 0) + 1;
  });

  return (
    <div className={`${isCollapsed ? 'w-8' : 'w-[min(340px,calc(100vw-48px))]'} shrink-0 bg-[#f8fafc] border-r border-[#d1d5db] flex select-none text-xs text-slate-800 transition-[width] duration-150`}>
      
      {/* 1. Far Left Vertical Action Strip (Cursor, Measure, Pan, Collapse toggle) */}
      <div className="w-8 border-r border-[#d1d5db] bg-[#f1f5f9] flex flex-col items-center py-2 gap-1.5 text-slate-600 shrink-0">
        {/* Sidebar Collapse / Expand Button */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-6 h-6 flex items-center justify-center rounded transition hover:bg-slate-200 text-slate-700 mb-1"
            title={isCollapsed ? '展开左侧面板' : '收起左侧面板'}
          >
            {isCollapsed ? <ChevronRightIcon size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}

        <button
          onClick={() => onSetMeasureMode('none')}
          className={`w-6 h-6 flex items-center justify-center rounded transition cursor-pointer ${
            measureMode === 'none' 
              ? 'bg-[#e2e8f0] text-slate-900 font-bold border border-[#94a3b8]' 
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="标准选择与旋转模式 (Orbit & Select)"
        >
          <MousePointer size={13} />
        </button>

        <button
          onClick={() => onSetMeasureMode(measureMode === 'distance' ? 'none' : 'distance')}
          className={`w-6 h-6 flex items-center justify-center rounded transition cursor-pointer ${
            measureMode === 'distance' 
              ? 'bg-slate-900 text-white font-bold border-2 border-slate-900 shadow-xs' 
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="原子间距测量模式 (Distance Measurement)：点击后在画布中依次点击 2 个原子测距"
        >
          <Ruler size={13} />
        </button>

        <button
          onClick={() => onSetMeasureMode(measureMode === 'angle' ? 'none' : 'angle')}
          className={`w-6 h-6 flex items-center justify-center rounded transition cursor-pointer ${
            measureMode === 'angle' 
              ? 'bg-slate-900 text-white font-bold border-2 border-slate-900 shadow-xs' 
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="键角测量模式 (Angle Measurement)：点击后在画布中依次点击 3 个原子测夹角"
        >
          <Triangle size={13} />
        </button>

        <div className="w-4 h-[1px] bg-slate-300 my-1" />

        <button
          onClick={onClearMeasurements}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500"
          title="Clear all measurement badges (清除测量标注)"
        >
          ✕
        </button>
      </div>

      {/* 2. Main Tabbed Body (Hidden when collapsed) */}
      {!isCollapsed && (
        <div className="flex-1 flex flex-col overflow-y-auto light-scrollbar min-w-[288px]">
          
          {/* Tab Headers: Style | Tools | Objects + Collapse All button */}
          <div className="flex items-center border-b border-[#d1d5db] bg-[#e5e7eb] text-[11px] font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab('style')}
              className={`flex-1 py-1.5 text-center transition border-r border-[#d1d5db] flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'style' ? 'bg-white text-slate-900 font-bold border-b-2 border-b-white' : 'hover:bg-slate-200/80'
              }`}
            >
              <Palette size={11} className="text-slate-500" />
              <span>Style</span>
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`flex-1 py-1.5 text-center transition border-r border-[#d1d5db] flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'tools' ? 'bg-white text-slate-900 font-bold border-b-2 border-b-white' : 'hover:bg-slate-200/80'
              }`}
            >
              <Sliders size={11} className="text-slate-500" />
              <span>Tools</span>
            </button>
            <button
              onClick={() => setActiveTab('objects')}
              className={`flex-1 py-1.5 text-center transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'objects' ? 'bg-white text-slate-900 font-bold border-b-2 border-b-white' : 'hover:bg-slate-200/80'
              }`}
            >
              <Box size={11} className="text-slate-500" />
              <span>Objects</span>
            </button>
            
            {/* Quick fold/unfold all button */}
            {activeTab === 'style' && (
              <button
                onClick={toggleAllAccordions}
                className="px-1.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition"
                title={allOpen ? '折叠全部模块' : '展开全部模块'}
              >
                {allOpen ? <FolderMinus size={13} /> : <FolderPlus size={13} />}
              </button>
            )}
          </div>

          {/* --- STYLE TAB --- */}
          {activeTab === 'style' && (
            <div className="p-2.5 space-y-2.5">
              
              {/* Top Master Properties Button */}
              <button
                onClick={() => onOpenProperties('general')}
                className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 hover:border-blue-400 font-bold text-slate-800 shadow-2xs transition flex items-center justify-between cursor-pointer text-xs group"
                title="打开属性配置面板 (Properties: General / Atoms / Bonds / Polyhedra / Isosurfaces)"
              >
                <span className="flex items-center gap-2">
                  <Sliders size={14} className="text-blue-600 group-hover:rotate-45 transition-transform" />
                  <span className="text-[12px]">Properties...</span>
                </span>
                <span className="text-[10px] bg-slate-100 group-hover:bg-blue-50 text-slate-500 group-hover:text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold transition">
                  配置 ⚙
                </span>
              </button>

              {/* Card 1: 结构模型与材质风格 (Model & Material) */}
              <div className="border border-slate-200/90 rounded-lg bg-white overflow-hidden shadow-2xs">
                <button
                  onClick={() => setModelsOpen(!modelsOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50/90 hover:bg-slate-100/90 border-b border-slate-200/70 font-semibold text-[11px] text-slate-700 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Palette size={13} className="text-slate-600" />
                    <span>模型与材质风格 (Model & Style)</span>
                  </span>
                  {modelsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {modelsOpen && (
                  <div className="p-2 space-y-2 text-xs text-slate-700">
                    {/* 5-Mode Segmented Pill Group */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-medium">模型表示 (Representation):</span>
                        <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visualSettings.showStructure !== false}
                            onChange={(event) => onUpdateVisualSettings({ showStructure: event.target.checked })}
                            className="accent-slate-700 rounded w-3 h-3"
                          />
                          <span>显示结构</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-5 gap-0.5 p-0.5 bg-slate-100/90 rounded-md border border-slate-200/80 text-[10px]">
                        <button
                          onClick={() => {
                            onRenderModeChange('ball-and-stick');
                            onUpdateVisualSettings({ showPolyhedra: false });
                          }}
                          className={`py-1 text-center rounded transition font-medium ${
                            renderMode === 'ball-and-stick' && !visualSettings.showPolyhedra
                              ? 'bg-white text-slate-900 font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="球棍模型 (Ball-and-stick)"
                        >
                          球棍
                        </button>
                        <button
                          onClick={() => {
                            onRenderModeChange('space-filling');
                            onUpdateVisualSettings({ showPolyhedra: false });
                          }}
                          className={`py-1 text-center rounded transition font-medium ${
                            renderMode === 'space-filling'
                              ? 'bg-white text-slate-900 font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="空间填充 CPK (Space-filling)"
                        >
                          CPK
                        </button>
                        <button
                          onClick={() => {
                            onUpdateVisualSettings({ showPolyhedra: !visualSettings.showPolyhedra });
                          }}
                          onDoubleClick={() => onOpenProperties('polyhedra')}
                          className={`py-1 text-center rounded transition font-medium ${
                            visualSettings.showPolyhedra
                              ? 'bg-blue-600 text-white font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="配位多面体 (Polyhedral) - 单击切换开启/关闭，双击打开 VESTA 配置"
                        >
                          多面体
                        </button>
                        <button
                          onClick={() => {
                            onRenderModeChange('wireframe');
                            onUpdateVisualSettings({ showPolyhedra: false });
                          }}
                          className={`py-1 text-center rounded transition font-medium ${
                            renderMode === 'wireframe'
                              ? 'bg-white text-slate-900 font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="线框模型 (Wireframe)"
                        >
                          线框
                        </button>
                        <button
                          onClick={() => {
                            onRenderModeChange('stick');
                            onUpdateVisualSettings({ showPolyhedra: false });
                          }}
                          className={`py-1 text-center rounded transition font-medium ${
                            renderMode === 'stick'
                              ? 'bg-white text-slate-900 font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="纯棍状模型 (Stick)"
                        >
                          纯棍
                        </button>
                      </div>
                    </div>

                    {/* Inline Polyhedra Controls when Polyhedral Representation is active */}
                    {visualSettings.showPolyhedra && (
                      <div className="p-2 bg-blue-50/70 rounded-md border border-blue-200 space-y-2 text-[11px] mt-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-900 flex items-center gap-1">
                            <Box size={12} className="text-blue-700" />
                            <span>配位多面体参数 (Polyhedra)</span>
                          </span>
                          <button
                            onClick={() => onOpenProperties('polyhedra')}
                            className="text-[10px] font-semibold text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>高级设置 ⚙</span>
                          </button>
                        </div>

                        {/* Styles 1~6 */}
                        <div className="space-y-1">
                          <div className="text-[10px] text-slate-600">表现样式 (Style 1~6):</div>
                          <div className="grid grid-cols-6 gap-1 p-1 bg-white rounded border border-blue-200/80">
                            {([1, 2, 3, 4, 5, 6] as const).map(styleNum => (
                              <button
                                key={styleNum}
                                type="button"
                                onClick={() => {
                                  onUpdateVisualSettings({
                                    polyhedraSettings: {
                                      ...(visualSettings.polyhedraSettings || DEFAULT_POLYHEDRA_SETTINGS),
                                      style: styleNum
                                    }
                                  });
                                }}
                                className={`py-1 text-center rounded font-mono text-[10px] font-bold transition cursor-pointer ${
                                  (visualSettings.polyhedraSettings?.style ?? 2) === styleNum
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                                title={`样式 ${styleNum}`}
                              >
                                {styleNum}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Center Mode Switcher */}
                        <div className="space-y-1.5 pt-1 border-t border-blue-200/60">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-600 font-medium">中心原子范围:</span>
                            <div className="flex rounded border border-blue-200 bg-white p-0.5 text-[9px]">
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateVisualSettings({
                                    polyhedraSettings: {
                                      ...(visualSettings.polyhedraSettings || DEFAULT_POLYHEDRA_SETTINGS),
                                      centerMode: 'all'
                                    }
                                  });
                                }}
                                className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                                  (visualSettings.polyhedraSettings?.centerMode || 'all') === 'all'
                                    ? 'bg-blue-600 font-bold text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                按元素批量
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateVisualSettings({
                                    polyhedraSettings: {
                                      ...(visualSettings.polyhedraSettings || DEFAULT_POLYHEDRA_SETTINGS),
                                      centerMode: 'custom'
                                    }
                                  });
                                }}
                                className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                                  visualSettings.polyhedraSettings?.centerMode === 'custom'
                                    ? 'bg-blue-600 font-bold text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                指定特定原子
                              </button>
                            </div>
                          </div>

                          {/* Specific Atom Mode Details */}
                          {visualSettings.polyhedraSettings?.centerMode === 'custom' && (
                            <div className="space-y-1.5 bg-white p-1.5 rounded border border-blue-200/80">
                              {/* Selected Atoms Multi-Action */}
                              {selectedAtoms && selectedAtoms.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentCustom = visualSettings.polyhedraSettings?.customAtomIds || [];
                                    const newIds = new Set(currentCustom);
                                    const allAlreadyIn = selectedAtoms.every(a => newIds.has(a.id));
                                    if (allAlreadyIn) {
                                      selectedAtoms.forEach(a => newIds.delete(a.id));
                                    } else {
                                      selectedAtoms.forEach(a => newIds.add(a.id));
                                    }
                                    onUpdateVisualSettings({
                                      polyhedraSettings: {
                                        ...(visualSettings.polyhedraSettings || DEFAULT_POLYHEDRA_SETTINGS),
                                        centerMode: 'custom',
                                        customAtomIds: Array.from(newIds)
                                      }
                                    });
                                  }}
                                  className="w-full py-1 px-2 rounded text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition cursor-pointer flex items-center justify-between"
                                >
                                  <span>
                                    {selectedAtoms.length === 1
                                      ? `为已选原子 #${selectedAtoms[0].id} (${selectedAtoms[0].element}) 切换多面体`
                                      : `将已选 ${selectedAtoms.length} 个原子设为多面体中心`}
                                  </span>
                                  <span className="font-bold">
                                    {selectedAtoms.every(a => visualSettings.polyhedraSettings?.customAtomIds?.includes(a.id))
                                      ? '✓ 已全选'
                                      : '+ 添加'}
                                  </span>
                                </button>
                              ) : (
                                <div className="text-[10px] text-slate-400 italic text-center py-0.5">
                                  按住 Ctrl 点选一个或多个原子设为中心
                                </div>
                              )}

                              {/* Manual ID Input */}
                              <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                                <span className="text-[9px] text-slate-500">原子ID:</span>
                                <input
                                  type="number"
                                  placeholder="如 71"
                                  value={manualCenterId}
                                  onChange={(e) => setManualCenterId(e.target.value)}
                                  className="w-16 bg-[#f8fafc] border border-slate-200 rounded px-1 py-0.5 text-center font-mono text-[10px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const id = parseInt(manualCenterId);
                                    if (!isNaN(id)) {
                                      const current = visualSettings.polyhedraSettings?.customAtomIds || [];
                                      if (!current.includes(id)) {
                                        onUpdateVisualSettings({
                                          polyhedraSettings: {
                                            ...(visualSettings.polyhedraSettings || DEFAULT_POLYHEDRA_SETTINGS),
                                            centerMode: 'custom',
                                            customAtomIds: [...current, id]
                                          }
                                        });
                                      }
                                      setManualCenterId('');
                                    }
                                  }}
                                  className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-medium cursor-pointer"
                                >
                                  + 添加
                                </button>
                              </div>

                              {/* Chips for existing custom atoms */}
                              {(visualSettings.polyhedraSettings?.customAtomIds || []).length > 0 && (
                                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pt-1 border-t border-slate-100">
                                  {(visualSettings.polyhedraSettings?.customAtomIds || []).map(id => {
                                    const at = structure?.atoms.find(a => a.id === id);
                                    return (
                                      <span
                                        key={id}
                                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-200 px-1.5 py-0.2 rounded font-mono text-[9px]"
                                      >
                                        <span>#{id} {at?.element || ''}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = (visualSettings.polyhedraSettings?.customAtomIds || []).filter(x => x !== id);
                                            onUpdateVisualSettings({
                                              polyhedraSettings: {
                                                ...(visualSettings.polyhedraSettings || DEFAULT_POLYHEDRA_SETTINGS),
                                                customAtomIds: updated
                                              }
                                            });
                                          }}
                                          className="text-slate-400 hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Material Presets Selector */}
                    <div className="space-y-1 pt-1.5 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-medium">材质与出版风格 (Style / PBR):</span>
                      </div>
                      <select
                        aria-label="材质预设" value={materialType}
                        onChange={(e) => onMaterialChange(e.target.value as PresetMaterialType)}
                        className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-800 font-medium focus:outline-none focus:border-slate-400 shadow-2xs"
                      >
                        {MATERIAL_GROUPS.map(group=><optgroup key={group.label} label={group.label}>{group.items.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>)}
                      </select>
                      <MaterialDetails type={materialType} settings={visualSettings} update={onUpdateVisualSettings}/>
                    </div>

                    {/* Core Visual Features */}
                    <div className="pt-1.5 border-t border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-medium">渲染特性 (Rendering Features):</span>
                      <div className="grid grid-cols-1 gap-0.5">
                        <label className="flex items-center justify-between p-1 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200/60 cursor-pointer transition">
                          <div className="flex items-center gap-2 text-[11px] text-slate-700">
                            <input
                              type="checkbox"
                              checked={visualSettings.showOutline}
                              onChange={(e) => onUpdateVisualSettings({ showOutline: e.target.checked })}
                              className="accent-slate-700 rounded w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="font-medium">高对比轮廓 (Outlines)</span>
                          </div>
                          <span className="text-[9px] text-slate-400">学术线框描边</span>
                        </label>

                        <label className="flex items-center justify-between p-1 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200/60 cursor-pointer transition">
                          <div className="flex items-center gap-2 text-[11px] text-slate-700">
                            <input
                              type="checkbox"
                              checked={visualSettings.showShadows}
                              onChange={(e) => onUpdateVisualSettings({ showShadows: e.target.checked })}
                              className="accent-slate-700 rounded w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="font-medium">原子投射光影 (Shadows)</span>
                          </div>
                          <span className="text-[9px] text-slate-400">物理级空间遮挡</span>
                        </label>

                        <label className="flex items-center justify-between p-1 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200/60 cursor-pointer transition">
                          <div className="flex items-center gap-2 text-[11px] text-slate-700">
                            <input
                              type="checkbox"
                              checked={visualSettings.showHBonds}
                              onChange={(e) => onUpdateVisualSettings({ showHBonds: e.target.checked })}
                              className="accent-slate-700 rounded w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="font-medium" title="几何候选：H–受体距离 1.5–3.1 Å，未校验供体与角度；金属弱作用按半径阈值推断。">候选氢键/弱作用虚线</span>
                          </div>
                          {visualSettings.showHBonds && hbondsCount !== undefined ? (
                            <span className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200/80 rounded font-mono font-semibold">
                              {hbondsCount} 条
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400">智能判定</span>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: 打光与光影调控 (Lighting & Shadows) */}
              <div className="border border-slate-200/90 rounded-lg bg-white overflow-hidden shadow-2xs">
                <button
                  onClick={() => setLightingOpen(!lightingOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-50/90 hover:bg-slate-100/90 border-b border-slate-200/70 font-semibold text-[11px] text-slate-700 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Sun size={13} className="text-amber-500" />
                    <span>打光与光影调控 (Lighting & Shadows)</span>
                  </span>
                  {lightingOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {lightingOpen && (
                  <div className="p-2 space-y-2 text-[11px] text-slate-600">
                    {/* Quick Presets */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-medium">打光快速预设 (Presets):</span>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <button
                          onClick={() => onUpdateVisualSettings({
                            lightAzimuth: 45,
                            lightAltitude: 55,
                            lightIntensity: 2.5,
                            ambientIntensity: 0.85,
                            headlightMode: false
                          })}
                          className={`px-2 py-1 rounded-md border text-left transition ${
                            visualSettings.lightAzimuth === 45 && visualSettings.lightAltitude === 55 && !visualSettings.headlightMode
                              ? 'bg-amber-50/90 border-amber-300 text-amber-900 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="font-semibold">☀ 右上自然光</div>
                          <div className="text-[9px] text-slate-400">45° 俯角 55°</div>
                        </button>
                        
                        <button
                          onClick={() => onUpdateVisualSettings({
                            lightAzimuth: 65,
                            lightAltitude: 25,
                            lightIntensity: 3.0,
                            ambientIntensity: 0.50,
                            headlightMode: false
                          })}
                          className={`px-2 py-1 rounded-md border text-left transition ${
                            visualSettings.lightAzimuth === 65 && visualSettings.lightAltitude === 25 && !visualSettings.headlightMode
                              ? 'bg-amber-50/90 border-amber-300 text-amber-900 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="font-semibold">🌓 低角长阴影</div>
                          <div className="text-[9px] text-slate-400">65° 俯角 25° 强立体</div>
                        </button>

                        <button
                          onClick={() => onUpdateVisualSettings({
                            lightAzimuth: 15,
                            lightAltitude: 75,
                            lightIntensity: 2.2,
                            ambientIntensity: 1.10,
                            headlightMode: false
                          })}
                          className={`px-2 py-1 rounded-md border text-left transition ${
                            visualSettings.lightAzimuth === 15 && visualSettings.lightAltitude === 75 && !visualSettings.headlightMode
                              ? 'bg-amber-50/90 border-amber-300 text-amber-900 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="font-semibold">☁ 正顶明光</div>
                          <div className="text-[9px] text-slate-400">15° 俯角 75° 柔和</div>
                        </button>

                        <button
                          onClick={() => onUpdateVisualSettings({
                            lightAzimuth: 120,
                            lightAltitude: 35,
                            lightIntensity: 3.2,
                            ambientIntensity: 0.45,
                            headlightMode: false
                          })}
                          className={`px-2 py-1 rounded-md border text-left transition ${
                            visualSettings.lightAzimuth === 120 && visualSettings.lightAltitude === 35 && !visualSettings.headlightMode
                              ? 'bg-amber-50/90 border-amber-300 text-amber-900 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="font-semibold">⚡ 侧逆雕塑光</div>
                          <div className="text-[9px] text-slate-400">120° 俯角 35° 鲜明</div>
                        </button>
                      </div>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      {/* 水平方位角 */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 font-medium">水平方位角 (Azimuth):</span>
                          <span className="font-mono text-slate-800 font-bold px-1 py-0.2 bg-slate-100 rounded border border-slate-200/60">
                            {Math.round(visualSettings.lightAzimuth ?? 45)}°
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="5"
                          value={visualSettings.lightAzimuth ?? 45}
                          onChange={(e) => onUpdateVisualSettings({ lightAzimuth: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                        />
                      </div>

                      {/* 垂直俯仰角 */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 font-medium">垂直高度角 (Altitude):</span>
                          <span className="font-mono text-slate-800 font-bold px-1 py-0.2 bg-slate-100 rounded border border-slate-200/60">
                            {Math.round(visualSettings.lightAltitude ?? 50)}°
                          </span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="85"
                          step="5"
                          value={visualSettings.lightAltitude ?? 50}
                          onChange={(e) => onUpdateVisualSettings({ lightAltitude: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                        />
                      </div>

                      {/* 主光照强度 */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 font-medium">主光源强度 (Direct Sun):</span>
                          <span className="font-mono text-slate-800 font-bold px-1 py-0.2 bg-slate-100 rounded border border-slate-200/60">
                            {(visualSettings.lightIntensity ?? 2.5).toFixed(1)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="5.0"
                          step="0.1"
                          value={visualSettings.lightIntensity ?? 2.5}
                          onChange={(e) => onUpdateVisualSettings({ lightIntensity: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                        />
                      </div>

                      {/* 环境补光 / 阴影对比 */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 font-medium">环境补光 / 阴影对比:</span>
                          <span className="font-mono text-slate-800 font-bold px-1 py-0.2 bg-slate-100 rounded border border-slate-200/60">
                            {(visualSettings.ambientIntensity ?? 0.85).toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.10"
                          max="2.50"
                          step="0.05"
                          value={visualSettings.ambientIntensity ?? 0.85}
                          onChange={(e) => onUpdateVisualSettings({ ambientIntensity: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                        />
                      </div>
                    </div>

                    {/* Headlight & Reset */}
                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                        <input
                          type="checkbox"
                          checked={!!visualSettings.headlightMode}
                          onChange={(e) => onUpdateVisualSettings({ headlightMode: e.target.checked })}
                          className="accent-slate-700 rounded w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-medium text-slate-700">跟随视角 (Headlight)</span>
                      </label>
                      <button
                        onClick={() => onUpdateVisualSettings({
                          lightAzimuth: 45,
                          lightAltitude: 50,
                          lightIntensity: 2.5,
                          ambientIntensity: 0.85,
                          headlightMode: false
                        })}
                        className="text-[10px] px-2 py-0.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded transition"
                      >
                        重置默认
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: 几何与化学键微调 (Geometry & Bonds) */}
              <div className="border border-slate-200/90 rounded-lg bg-white overflow-hidden shadow-2xs">
                <button
                  onClick={() => setGeomOpen(!geomOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50/90 hover:bg-slate-100/90 border-b border-slate-200/70 font-semibold text-[11px] text-slate-700 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders size={13} className="text-slate-500" />
                    <span>几何微调与化学键 (Geometry & Bonds)</span>
                  </span>
                  {geomOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {geomOpen && (
                  <div className="p-2.5 space-y-2.5 text-[11px] text-slate-600">
                    {/* Core Sliders: Atom scale, Bond cutoff, Bond radius */}
                    <div className="space-y-2">
                      {/* Atom Scale */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 font-medium">原子缩放 (Atom scale):</span>
                          <span className="font-mono text-slate-800 font-bold px-1 py-0.2 bg-slate-100 rounded border border-slate-200/60">
                            {visualSettings.atomScale.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.30"
                          max="1.80"
                          step="0.05"
                          value={visualSettings.atomScale}
                          onChange={(e) => onUpdateVisualSettings({ atomScale: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                        />
                      </div>

                      {/* Bond Cutoff Tolerance */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 font-medium">成键容差 (Cutoff tolerance):</span>
                          <span className="font-mono text-slate-800 font-bold px-1 py-0.2 bg-slate-100 rounded border border-slate-200/60">
                            {visualSettings.bondTolerance.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.80"
                          max="1.50"
                          step="0.02"
                          value={visualSettings.bondTolerance}
                          onChange={(e) => onUpdateVisualSettings({ bondTolerance: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                        />
                      </div>

                      {/* Bond Radius */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 font-medium">单键粗细 (Bond radius):</span>
                          <span className="font-mono text-slate-800 font-bold px-1 py-0.2 bg-slate-100 rounded border border-slate-200/60">
                            {visualSettings.bondRadius.toFixed(2)} Å
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.03"
                          max="0.16"
                          step="0.01"
                          value={visualSettings.bondRadius}
                          onChange={(e) => onUpdateVisualSettings({ bondRadius: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                        />
                      </div>
                    </div>

                    {/* Bond Style Dropdown */}
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-600 font-medium">化学键形态 (Bond style):</span>
                        <button onClick={() => onOpenProperties('bonds')} className="rounded px-1.5 py-1 text-blue-700 hover:bg-blue-50" title="按原子对编辑键长与边界搜索规则">Bonds 编辑…</button>
                      </div>
                      <select
                        value={visualSettings.bondStyle}
                        onChange={(e) => onUpdateVisualSettings({ bondStyle: e.target.value as BondStyle })}
                        className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-800 font-medium focus:outline-none focus:border-slate-400 shadow-2xs"
                      >
                        <option value="auto">Auto Aromatic (智能识别一实一虚)</option>
                        <option value="aromatic">Aromatic (一实一虚)</option>
                        <option value="tapered">Tapered (渐变锥形/楔形过渡)</option>
                        <option value="parallel">Parallel double (对称双实线)</option>
                        <option value="double">Double only (全部双线)</option>
                        <option value="single">Single (标准单键)</option>
                      </select>
                    </div>

                    {/* Bond Color Mode */}
                    <div className="pt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-600 font-medium">键颜色模式 (Bond color):</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={visualSettings.bondColorMode}
                          onChange={(e) => onUpdateVisualSettings({ bondColorMode: e.target.value as any })}
                          className="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-800 font-medium focus:outline-none focus:border-slate-400 shadow-2xs"
                        >
                          <option value="uniform">Uniform Slate (统一灰蓝)</option>
                          <option value="dark">Dark ink (深墨色出版风)</option>
                          <option value="split">By element (两端原子分色)</option>
                        </select>
                        {visualSettings.bondColorMode === 'uniform' && (
                          <div className="flex items-center gap-1 shrink-0 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                            <input
                              type="color"
                              value={visualSettings.customBondColor || '#8fa4ba'}
                              onChange={(e) => onUpdateVisualSettings({ customBondColor: e.target.value })}
                              className="w-4 h-4 rounded border border-slate-300 cursor-pointer p-0"
                              title="选择统一颜色"
                            />
                            <span className="font-mono text-[9px] text-slate-600">
                              {visualSettings.customBondColor || '#8fa4ba'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dynamic Sub-panel: Tapered Specific */}
                    {visualSettings.bondStyle === 'tapered' && (
                      <div className="space-y-2 p-2 bg-slate-50/90 rounded-md border border-slate-200/80">
                        <div className="text-[10px] font-bold text-slate-700">渐变锥形键微调:</div>
                        <div className="space-y-0.5">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-600">粗端半径 (Root):</span>
                            <span className="font-mono text-slate-800 font-bold px-1 bg-white rounded border border-slate-200">
                              {(visualSettings.taperRootRadius ?? 0.085).toFixed(3)} Å
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.04"
                            max="0.18"
                            step="0.005"
                            value={visualSettings.taperRootRadius ?? 0.085}
                            onChange={(e) => onUpdateVisualSettings({ taperRootRadius: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-slate-700"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-600">细端半径 (Tip):</span>
                            <span className="font-mono text-slate-800 font-bold px-1 bg-white rounded border border-slate-200">
                              {(visualSettings.taperTipRadius ?? 0.020).toFixed(3)} Å
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.008"
                            max="0.060"
                            step="0.002"
                            value={visualSettings.taperTipRadius ?? 0.020}
                            onChange={(e) => onUpdateVisualSettings({ taperTipRadius: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-slate-700"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1">
                          <span className="text-slate-600 font-medium">渐变模式:</span>
                          <select
                            value={visualSettings.taperMode ?? 'directional'}
                            onChange={(e) => onUpdateVisualSettings({ taperMode: e.target.value as any })}
                            className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-800"
                          >
                            <option value="directional">单向渐变 (依原子大→小)</option>
                            <option value="hourglass">双向收腰 (两头粗中间细)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Dynamic Sub-panel: Double bond gap */}
                    {(visualSettings.bondStyle === 'parallel' || visualSettings.bondStyle === 'double' || visualSettings.bondStyle === 'aromatic' || visualSettings.bondStyle === 'auto') && (
                      <div className="space-y-0.5 pt-1.5 border-t border-slate-100">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 font-medium">双键间隙 (Double bond gap):</span>
                          <span className="font-mono text-slate-800 font-bold px-1 bg-slate-100 rounded border border-slate-200/60">
                            {visualSettings.doubleBondGap.toFixed(2)} Å
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.08"
                          max="0.24"
                          step="0.01"
                          value={visualSettings.doubleBondGap}
                          onChange={(e) => onUpdateVisualSettings({ doubleBondGap: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                        />
                      </div>
                    )}

                    {/* Dynamic Sub-panel: Aromatic notch */}
                    {(visualSettings.bondStyle === 'aromatic' || visualSettings.bondStyle === 'auto') && (
                      <div className="space-y-0.5 pt-1 border-t border-slate-100">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600 font-medium">虚键缺口 (Aromatic notch):</span>
                          <span className="font-mono text-slate-800 font-bold px-1 bg-slate-100 rounded border border-slate-200/60">
                            {Math.round((visualSettings.aromaticGapRatio ?? 0.20) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.08"
                          max="0.36"
                          step="0.02"
                          value={visualSettings.aromaticGapRatio ?? 0.20}
                          onChange={(e) => onUpdateVisualSettings({ aromaticGapRatio: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                        />
                      </div>
                    )}

                    {/* Atom Labels */}
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <span className="text-[10px] text-slate-500 font-medium">原子标签显示 (Labels):</span>
                      <div className="grid grid-cols-4 gap-0.5 p-0.5 bg-slate-100/90 rounded-md border border-slate-200/80">
                        {[
                          { id: 'none', label: '无' },
                          { id: 'element', label: '元素' },
                          { id: 'id', label: '编号' },
                          { id: 'element+id', label: '元素+号' }
                        ].map(m => (
                          <button
                            key={m.id}
                            onClick={() => onUpdateVisualSettings({ showLabels: m.id as LabelMode })}
                            className={`py-1 text-center text-[10px] rounded transition font-medium ${
                              visualSettings.showLabels === m.id
                                ? 'bg-white text-slate-900 font-bold shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* --- TOOLS TAB --- */}
          {activeTab === 'tools' && (
            <div className="p-2.5 space-y-3 text-xs text-slate-700">
              {/* Orientation Shortcuts */}
              <div className="bg-white p-2.5 rounded border border-[#cbd5e1] shadow-2xs space-y-1.5">
                <div className="font-bold text-[11px] text-slate-800">Perspective & Orientation (视角)</div>
                <div className="grid grid-cols-3 gap-1 font-serif text-xs">
                  <button onClick={() => onViewAlong?.('a')} className="py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-red-700 font-bold">along a</button>
                  <button onClick={() => onViewAlong?.('b')} className="py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-emerald-700 font-bold">along b</button>
                  <button onClick={() => onViewAlong?.('c')} className="py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-blue-700 font-bold">along c</button>
                  <button onClick={() => onViewAlong?.('a*')} className="py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700">along a*</button>
                  <button onClick={() => onViewAlong?.('b*')} className="py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700">along b*</button>
                  <button onClick={() => onViewAlong?.('c*')} className="py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold">along c*</button>
                </div>
                <button 
                  onClick={() => onViewAlong?.('reset')}
                  className="w-full py-1 mt-1 rounded bg-slate-100 hover:bg-slate-200 font-sans text-slate-800 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>复位视角居中 (Reset View)</span>
                </button>
              </div>

              {/* Custom Supercell Expansion Card */}
              <div className="bg-white p-2.5 rounded border border-[#cbd5e1] shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5">
                    <Box size={13} className="text-blue-600" />
                    <span>Supercell Expansion (超胞扩展)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Na × Nb × Nc</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-mono mb-0.5">N(a)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={supercellNx}
                      onChange={(e) => setSupercellNx(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-mono mb-0.5">N(b)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={supercellNy}
                      onChange={(e) => setSupercellNy(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-mono mb-0.5">N(c)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={supercellNz}
                      onChange={(e) => setSupercellNz(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center font-mono font-bold text-xs"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1">
                  {[
                    { label: '1×1×1', x: 1, y: 1, z: 1 },
                    { label: '2×2×1', x: 2, y: 2, z: 1 },
                    { label: '2×2×2', x: 2, y: 2, z: 2 },
                    { label: '3×3×1', x: 3, y: 3, z: 1 },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setSupercellNx(p.x);
                        setSupercellNy(p.y);
                        setSupercellNz(p.z);
                        onSupercell(p.x, p.y, p.z);
                      }}
                      className="flex-1 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono cursor-pointer transition text-center"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => onSupercell(supercellNx, supercellNy, supercellNz)}
                  className="w-full py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  <span>应用扩胞 ({supercellNx}×{supercellNy}×{supercellNz})</span>
                </button>
              </div>

              {/* VESTA Unit Cell Transformation Button */}
              <div className="bg-white p-2.5 rounded border border-[#cbd5e1] shadow-2xs space-y-2">
                <div className="font-bold text-[11px] text-slate-800 flex items-center justify-between">
                  <span>Unit Cell Transformation (晶格变换)</span>
                  <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-mono font-semibold">VESTA</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  通过 3×3 旋转/畸变矩阵 (P) 与平移向量 (p) 对晶格基底和原子分数坐标进行齐次空间变换。
                </p>
                <button
                  onClick={() => onOpenTransformModal?.()}
                  className="w-full py-2 px-2.5 rounded-md bg-white hover:bg-slate-50 border border-slate-300 hover:border-blue-400 font-semibold text-slate-800 shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                >
                  <Sliders size={13} className="text-blue-600" />
                  <span>晶格基底矩阵变换 (Transform)...</span>
                </button>
              </div>

              {/* Tools list */}
              <button
                onClick={onOpenPeriodicTable}
                className="w-full py-2 rounded bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] font-semibold text-slate-800 shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open Periodic Table (元素周期表)</span>
              </button>

              <div className="bg-white p-2.5 rounded border border-[#cbd5e1] shadow-2xs text-[11px] text-slate-500 space-y-1">
                <div className="font-bold text-slate-800 font-sans mb-1">鼠标操作指南</div>
                <p>• 左键单击：单选原子</p>
                <p>• <b>按住 Ctrl + 左键单击</b>：多选 / 反选多个原子</p>
                <p>• 左键按住拖拽：自由空间旋转</p>
                <p>• 右键按住拖拽：平移视野</p>
                <p>• 滚轮缩放：放大 / 缩小结构</p>
              </div>
            </div>
          )}

          {/* --- OBJECTS TAB --- */}
          {activeTab === 'objects' && (
            <div className="p-2.5 space-y-3 text-xs text-slate-700">
              <div className="bg-white p-2.5 rounded border border-[#cbd5e1] shadow-2xs space-y-2">
                <div className="font-bold text-[11px] text-slate-800 flex items-center justify-between">
                  <span>包含元素清单 (Elements)</span>
                  <span className="font-mono text-[10px] text-slate-500">{Object.keys(formulaMap).length} 种元素</span>
                </div>

                <div className="space-y-1">
                  {Object.entries(formulaMap).map(([elem, count]) => {
                    const info = getElement(elem);
                    const customColor = visualSettings.elementColors[elem] || info.color;
                    return (
                      <div 
                        key={elem}
                        className="flex items-center justify-between py-1 px-2 rounded bg-slate-50 border border-slate-200/80 text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs shrink-0" 
                            style={{ backgroundColor: customColor }}
                          />
                          <span className="font-bold text-slate-800">{elem} ({info.name})</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200 text-[10px]">
                          {count} 个原子
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Structure Entity Controls */}
              <div className="bg-white p-2.5 rounded border border-[#cbd5e1] shadow-2xs space-y-2">
                <div className="font-bold text-[11px] text-slate-800">晶胞实体与显示控制</div>
                
                {/* Polyhedra toggle */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-[11px] text-slate-700">配位多面体 (Polyhedra)</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateVisualSettings({ showPolyhedra: !visualSettings.showPolyhedra })}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition ${
                        visualSettings.showPolyhedra ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {visualSettings.showPolyhedra ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() => onOpenProperties('polyhedra')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 text-[10px] border border-slate-200 cursor-pointer"
                      title="打开多面体配置"
                    >
                      <Sliders size={11} />
                    </button>
                  </div>
                </div>

                {/* Boundary atoms toggle */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-[11px] text-slate-700">周期性边界补全 (Boundary PBC)</span>
                  <button
                    onClick={() => onUpdateVisualSettings({ showBoundaryAtoms: !visualSettings.showBoundaryAtoms })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition ${
                      visualSettings.showBoundaryAtoms ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {visualSettings.showBoundaryAtoms ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Unit Cell Wireframe */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-[11px] text-slate-700">晶胞线框 (Unit Cell Box)</span>
                  <button
                    onClick={() => onToggleLattice?.()}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition ${
                      showLattice ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {showLattice ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Axes */}
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-[11px] text-slate-700">坐标轴 (Axes a, b, c)</span>
                  <button
                    onClick={() => onToggleAxes?.()}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition ${
                      showAxes ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {showAxes ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Hydrogen Bonds */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-slate-700" title="仅为距离判据的几何候选，不代表已确认的氢键或相互作用。">候选氢键/弱作用</span>
                  <button
                    onClick={() => onUpdateVisualSettings({ showHBonds: !visualSettings.showHBonds })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition ${
                      visualSettings.showHBonds ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {visualSettings.showHBonds ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
