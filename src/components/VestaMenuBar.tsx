import {MATERIAL_GROUPS} from '../materialCatalog';
import React, { useState, useRef, useEffect } from 'react';
import { version } from '../../package.json';
import { 
  FolderOpen, 
  Save, 
  RotateCcw, 
  Camera, 
  HelpCircle, 
  Layers, 
  Sliders, 
  Maximize2,
  Atom,
  Scissors,
  Eye,
  Sun,
  Grid
} from 'lucide-react';
import { 
  CrystalStructure, 
  RenderMode, 
  PresetMaterialType, 
  VisualSettings 
} from '../types/crystal';

interface VestaMenuBarProps {
  onSaveProject: () => void; onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
  structure: CrystalStructure | null;
  visualSettings: VisualSettings;
  renderMode: RenderMode;
  materialType: PresetMaterialType;
  showLattice: boolean;
  showAxes: boolean;
  onFileUpload: (file: File) => void;
  onExport: (format: 'poscar' | 'cif' | 'source-cif' | 'xyz' | 'png') => void;
  onSelectPreset?: (presetId: string) => void;
  onViewAlong: (axis: 'a' | 'b' | 'c' | 'a*' | 'b*' | 'c*' | 'reset') => void;
  onToggleLattice: () => void;
  onToggleAxes: () => void;
  onUpdateVisualSettings: (settings: Partial<VisualSettings>) => void;
  onRenderModeChange: (mode: RenderMode) => void;
  onMaterialChange: (mat: PresetMaterialType) => void;
  onOpenPeriodicTable: () => void;
  onDeleteSelected: () => void;
  onSupercell: (nx: number, ny: number, nz: number) => void;
  onAddVacuum: () => void;
  onOpenRenderModal?: () => void;
  onOpenProperties?: (tab?: 'general' | 'atoms' | 'bonds' | 'polyhedra' | 'isosurfaces' | 'sections') => void;
  onOpenTransformModal?: () => void;
}

export const VestaMenuBar: React.FC<VestaMenuBarProps> = ({
  onSaveProject, onUndo, onRedo, canUndo, canRedo,
  structure,
  visualSettings,
  renderMode,
  materialType,
  showLattice,
  showAxes,
  onFileUpload,
  onExport,
  onSelectPreset,
  onViewAlong,
  onToggleLattice,
  onToggleAxes,
  onUpdateVisualSettings,
  onRenderModeChange,
  onMaterialChange,
  onOpenPeriodicTable,
  onDeleteSelected,
  onSupercell,
  onAddVacuum,
  onOpenRenderModal,
  onOpenProperties,
  onOpenTransformModal
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Match the shortcuts advertised by the menu while leaving text editing and
  // open dialogs in control of their own keyboard input.
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]') ||
        document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.shiftKey && !(command && key === 'z')) return;
      let action: (() => void) | undefined;
      if (command && key === 'z' && !event.shiftKey && canUndo) action = onUndo;
      if (command && ((key === 'z' && event.shiftKey) || key === 'y') && canRedo) action = onRedo;
      if (command && key === 's') action = onSaveProject;
      if (command && key === 'o') action = () => fileInputRef.current?.click();
      if (command && key === 'e' && structure) action = onOpenPeriodicTable;
      if (command && key === 'p' && onOpenProperties) action = () => onOpenProperties('atoms');
      if (!command && event.key === 'Delete' && structure) action = onDeleteSelected;
      if (action) {
        event.preventDefault();
        setOpenMenu(null);
        action();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [structure, onOpenPeriodicTable, onOpenProperties, onDeleteSelected, onUndo, onRedo, canUndo, canRedo, onSaveProject]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
      setOpenMenu(null);
    }
  };

  const MENUS = [
    { id: 'file', label: 'File' },
    { id: 'edit', label: 'Edit' },
    { id: 'view', label: 'View' },
    { id: 'objects', label: 'Objects' },
    { id: 'utilities', label: 'Utilities' },
    { id: 'help', label: 'Help' }
  ];

  return (
    <div ref={menuRef} className="vesta-menu-bar h-7 shrink-0 bg-[#f3f4f6] border-b border-[#d1d5db] flex items-center px-1 sm:px-2 text-xs select-none text-slate-800 z-40">
      <input id="structure-file-input" type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      {MENUS.map(m => (
        <div key={m.id} className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
            onMouseEnter={() => { if (openMenu) setOpenMenu(m.id); }}
            aria-expanded={openMenu === m.id}
            aria-haspopup="true"
            className={`px-1.5 sm:px-2.5 py-1 rounded hover:bg-[#e5e7eb] font-normal transition text-slate-800 ${
              openMenu === m.id ? 'bg-[#e5e7eb] font-semibold' : ''
            }`}
          >
            {m.label}
          </button>

          {/* FILE MENU */}
          {openMenu === 'file' && m.id === 'file' && (
            <div className="absolute left-0 top-7 w-56 bg-white border border-[#d1d5db] shadow-lg rounded py-1 z-50 text-slate-700 text-xs">
              <button
                onClick={() => { fileInputRef.current?.click(); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between"
              >
                <span>Open / Import... (CONTCAR/POSCAR/CIF/XYZ)</span>
                <span className="text-[10px] text-slate-400">Ctrl+O</span>
              </button>
              
              <div className="border-t border-slate-200 my-1" />

              <button onClick={() => { onSaveProject(); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100">保存项目… Ctrl+S</button>
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Export Data (导出)
              </div>
              <button
                onClick={() => { onExport('poscar'); setOpenMenu(null); }}
                className="w-full text-left px-4 py-1 hover:bg-[#f3f4f6] text-[11px]"
              >
                Export VASP POSCAR
              </button>
              <button
                onClick={() => { onExport('cif'); setOpenMenu(null); }}
                className="w-full text-left px-4 py-1 hover:bg-[#f3f4f6] text-[11px]"
              >
                Export CIF File (P1)
              </button>
              <button disabled={!structure?.sourceCif} onClick={() => { onExport('source-cif'); setOpenMenu(null); }} className="w-full text-left px-4 py-1 hover:bg-slate-100 text-[11px]">下载原始 CIF 存档（不含编辑）</button>
              <button
                onClick={() => { onExport('xyz'); setOpenMenu(null); }}
                className="w-full text-left px-4 py-1 hover:bg-[#f3f4f6] text-[11px]"
              >
                Export XYZ Coordinate File
              </button>
              <button
                onClick={() => { 
                  if (onOpenRenderModal) onOpenRenderModal();
                  else onExport('png');
                  setOpenMenu(null); 
                }}
                className="w-full text-left px-4 py-1.5 hover:bg-[#f3f4f6] text-[11px] font-semibold text-slate-800 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Camera size={13} className="text-slate-600" />
                  <span>渲染图像 / 导出高清图...</span>
                </span>
                <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded font-mono font-medium border border-slate-200">1080p~8K</span>
              </button>
            </div>
          )}

          {/* EDIT MENU */}
          {openMenu === 'edit' && m.id === 'edit' && (
            <div className="absolute left-0 top-7 w-52 bg-white border border-[#d1d5db] shadow-lg rounded py-1 z-50 text-slate-700 text-xs">
              <button disabled={!canUndo} onClick={() => { onUndo(); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100">撤销 Undo · Ctrl+Z</button>
              <button disabled={!canRedo} onClick={() => { onRedo(); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100">重做 Redo · Ctrl+Shift+Z</button>
              <button
                onClick={() => { onOpenPeriodicTable(); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between"
              >
                <span>Edit / Replace Element...</span>
                <span className="text-[10px] text-slate-400">Ctrl+E</span>
              </button>
              <button
                onClick={() => { onDeleteSelected(); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] text-rose-600 flex items-center justify-between"
              >
                <span>Delete Selected Atom (Vacancy)</span>
                <span className="text-[10px] text-slate-400">Del</span>
              </button>
              <div className="border-t border-slate-200 my-1" />
              <button
                onClick={() => { if (onOpenTransformModal) onOpenTransformModal(); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between text-slate-800 font-semibold"
              >
                <span>Unit Cell / Transform...</span>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-1 rounded font-bold">VESTA</span>
              </button>
              <button
                onClick={() => { if (onOpenProperties) onOpenProperties('polyhedra'); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between text-blue-700 font-medium"
              >
                <span>Properties - Polyhedra...</span>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-1 rounded font-bold">VESTA</span>
              </button>
              <button
                onClick={() => { onOpenProperties?.('bonds'); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] text-blue-700 font-medium"
              >Bonds... (化学键规则)</button>
              <button
                onClick={() => { if (onOpenProperties) onOpenProperties('atoms'); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between"
              >
                <span>Properties - Atoms...</span>
                <span className="text-[10px] text-slate-400">Ctrl+P</span>
              </button>
            </div>
          )}

          {/* VIEW MENU */}
          {openMenu === 'view' && m.id === 'view' && (
            <div className="absolute left-0 top-7 w-56 bg-white border border-[#d1d5db] shadow-lg rounded py-1 z-50 text-slate-700 text-xs">
              <button onClick={() => { onViewAlong('a'); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6]">
                View along a axis
              </button>
              <button onClick={() => { onViewAlong('b'); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6]">
                View along b axis
              </button>
              <button onClick={() => { onViewAlong('c'); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] font-semibold text-slate-900">
                View along c axis (Top-down XY)
              </button>
              <button onClick={() => { onViewAlong('a*'); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6]">
                View along a* axis
              </button>
              <button onClick={() => { onViewAlong('b*'); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6]">
                View along b* axis
              </button>
              <button onClick={() => { onViewAlong('c*'); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6]">
                View along c* axis
              </button>
              <div className="border-t border-slate-200 my-1" />
              <button onClick={() => { onViewAlong('reset'); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6]">
                Reset Orientation & Fit
              </button>
              <div className="border-t border-slate-200 my-1" />
              <button 
                onClick={() => { onUpdateVisualSettings({ isOrthographic: !visualSettings.isOrthographic }); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between"
              >
                <span>Projection</span>
                <span className="font-semibold text-slate-600">{visualSettings.isOrthographic ? 'Orthographic' : 'Perspective'}</span>
              </button>
              <button onClick={()=>{onUpdateVisualSettings({autoRotate:!visualSettings.autoRotate});setOpenMenu(null);}} className="w-full text-left px-3 py-2 hover:bg-slate-100">{visualSettings.autoRotate?'暂停自动旋转':'开启自动旋转'}</button>
              <label className="flex items-center gap-2 px-3 py-2">旋转速度<input aria-label="自动旋转速度" type="range" min=".1" max="10" step=".1" value={Math.abs(visualSettings.autoRotateSpeed)} onChange={e=>onUpdateVisualSettings({autoRotateSpeed:Number(e.target.value)})}/></label>
            </div>
          )}

          {/* OBJECTS MENU */}
          {openMenu === 'objects' && m.id === 'objects' && (
            <div aria-label="模型与材质菜单" className="absolute left-0 top-7 -translate-x-1/2 sm:translate-x-0 w-80 max-w-[90vw] max-h-[75vh] overflow-y-auto bg-white border border-[#d1d5db] shadow-lg rounded py-1 z-50 text-slate-700 text-xs">
              <button onClick={()=>{onOpenProperties?.('isosurfaces');setOpenMenu(null);}} className="w-full text-left px-3 py-2 hover:bg-slate-100">Isosurfaces / 等值面…</button>
              <button onClick={()=>{onOpenProperties?.('sections');setOpenMenu(null);}} className="w-full text-left px-3 py-2 hover:bg-slate-100">Sections / 二维切片…</button>
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Display Style (模型显示)
              </div>
              {(['ball-and-stick', 'space-filling', 'polyhedral', 'wireframe', 'stick'] as const).map(mode => {
                const isActive = mode === 'polyhedral' ? visualSettings.showPolyhedra : (renderMode === mode && !visualSettings.showPolyhedra);
                return (
                  <button
                    key={mode}
                    onClick={() => { 
                      if (mode === 'polyhedral') {
                        onUpdateVisualSettings({ showPolyhedra: !visualSettings.showPolyhedra });
                      } else {
                        onRenderModeChange(mode as RenderMode);
                        onUpdateVisualSettings({ showPolyhedra: false });
                      }
                      setOpenMenu(null); 
                    }}
                    className={`w-full text-left px-4 py-1 hover:bg-[#f3f4f6] capitalize flex items-center justify-between ${
                      isActive ? 'font-bold text-slate-900 bg-slate-100' : ''
                    }`}
                  >
                    <span>{mode}</span>
                    {isActive && <span className="text-[10px]">✓</span>}
                  </button>
                );
              })}

              <div className="border-t border-slate-200 my-1" />

              {MATERIAL_GROUPS.map(group=><React.Fragment key={group.label}>
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">{group.label}</div>
                {group.items.map(item=><button type="button" key={item.id} onClick={()=>{onMaterialChange(item.id);setOpenMenu(null);}}
                  className={`w-full px-4 py-1.5 text-left text-[11px] hover:bg-slate-100 ${materialType===item.id?'font-bold text-slate-900 bg-slate-100':''}`}>
                  {item.label}{materialType===item.id?' ✓':''}
                </button>)}
                <div className="my-1 border-t border-slate-200"/>
              </React.Fragment>)}

              <button
                onClick={() => { onUpdateVisualSettings({ showPolyhedra: !visualSettings.showPolyhedra }); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between"
              >
                <span>Coordination Polyhedra</span>
                <span>{visualSettings.showPolyhedra ? '✓' : ''}</span>
              </button>
              <button
                onClick={() => { if (onOpenProperties) onOpenProperties('polyhedra'); setOpenMenu(null); }}
                className="w-full text-left px-4 py-1 hover:bg-[#f3f4f6] text-[11px] text-blue-700 flex items-center justify-between cursor-pointer"
              >
                <span>Polyhedra Properties...</span>
                <span className="text-[10px] text-slate-400">设置</span>
              </button>

              <button
                onClick={() => { onUpdateVisualSettings({ showHBonds: !visualSettings.showHBonds }); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between"
              >
                <span title="H–受体距离 1.5–3.1 Å；未校验供体与角度。金属虚线为半径阈值候选。">候选氢键 / 弱相互作用</span>
                <span>{visualSettings.showHBonds ? '✓' : ''}</span>
              </button>

              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Bond Color (键配色)
              </div>
              <button
                onClick={() => {
                  onUpdateVisualSettings({ bondColorMode: 'uniform' });
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between"
              >
                <span>Uniform Slate (统一灰蓝)</span>
                <span>{visualSettings.bondColorMode === 'uniform' ? '✓' : ''}</span>
              </button>

              <button
                onClick={() => {
                  onUpdateVisualSettings({ bondColorMode: 'dark' });
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between"
              >
                <span>Dark Ink (深墨色出版风)</span>
                <span>{visualSettings.bondColorMode === 'dark' ? '✓' : ''}</span>
              </button>

              <button
                onClick={() => {
                  onUpdateVisualSettings({ bondColorMode: 'split' });
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] flex items-center justify-between"
              >
                <span>By Element (两端原子分色)</span>
                <span>{visualSettings.bondColorMode === 'split' ? '✓' : ''}</span>
              </button>

              <div className="border-t border-slate-200 my-1" />

              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Bond Style (化学键样式)
              </div>
              {[
                { id: 'aromatic', label: 'Aromatic (一实一虚)' },
                { id: 'tapered', label: 'Tapered (渐变锥形/楔形过渡)' },
                { id: 'parallel', label: 'Parallel (双实线)' },
                { id: 'single', label: 'Single (标准单键)' }
              ].map(bs => (
                <button
                  key={bs.id}
                  onClick={() => {
                    onUpdateVisualSettings({ bondStyle: bs.id as any });
                    setOpenMenu(null);
                  }}
                  className={`w-full text-left px-4 py-1 hover:bg-[#f3f4f6] text-[11px] flex items-center justify-between ${
                    visualSettings.bondStyle === bs.id ? 'font-bold text-slate-900 bg-slate-100' : ''
                  }`}
                >
                  <span>{bs.label}</span>
                  {visualSettings.bondStyle === bs.id && <span className="text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* UTILITIES MENU */}
          {openMenu === 'utilities' && m.id === 'utilities' && (
            <div className="absolute right-0 sm:left-0 sm:right-auto top-7 w-56 bg-white border border-[#d1d5db] shadow-lg rounded py-1 z-50 text-slate-700 text-xs">
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Supercell Expansion (扩胞)
              </div>
              <button onClick={() => { onSupercell(2, 2, 1); setOpenMenu(null); }} className="w-full text-left px-4 py-1 hover:bg-[#f3f4f6]">
                2 × 2 × 1 Supercell
              </button>
              <button onClick={() => { onSupercell(3, 3, 1); setOpenMenu(null); }} className="w-full text-left px-4 py-1 hover:bg-[#f3f4f6]">
                3 × 3 × 1 Supercell
              </button>
              <button onClick={() => { onSupercell(2, 2, 2); setOpenMenu(null); }} className="w-full text-left px-4 py-1 hover:bg-[#f3f4f6]">
                2 × 2 × 2 Supercell
              </button>

              <div className="border-t border-slate-200 my-1" />

              <button
                onClick={() => { if (onOpenTransformModal) onOpenTransformModal(); setOpenMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6] text-blue-800 font-semibold flex items-center justify-between"
              >
                <span>Matrix Transformation (变换)...</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-bold">P</span>
              </button>

              <button onClick={() => { onAddVacuum(); setOpenMenu(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#f3f4f6]">
                Add 15 Å Vacuum Layer along c
              </button>
            </div>
          )}

          {/* HELP MENU */}
          {openMenu === 'help' && m.id === 'help' && (
            <div className="absolute right-0 sm:left-0 sm:right-auto top-7 w-48 bg-white border border-[#d1d5db] shadow-lg rounded py-1 z-50 text-slate-700 text-xs">
              <div className="px-3 py-2 text-slate-600 leading-relaxed text-[11px]">
                <p className="font-bold text-slate-900">CrystalCraft VESTA</p>
                <p>Web Crystal & Structure Viewer</p>
                <p className="text-[10px] text-slate-400 mt-1">Version {version} (Pure VESTA Desktop Edition)</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
