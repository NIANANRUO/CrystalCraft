import {NEW_MATERIALS} from './materialCatalog';
import { encodeProject, parseProject, ProjectHistory, ProjectState, MAX_PROJECT_BYTES } from './project';
import { readRecovery, writeRecovery } from './projectStorage';
import { parseImportedBlob, cancelImport } from './importClient';
import { MAX_VOLUME_BYTES, volumeKind, defaultVolumeSettings } from './volume/data';
import React, { useState, useEffect, useRef } from 'react';
import { VestaMenuBar } from './components/VestaMenuBar';
import { VestaToolbar } from './components/VestaToolbar';
import { VestaLeftPanel } from './components/VestaLeftPanel';
import { VestaBottomPanel } from './components/VestaBottomPanel';
import { VestaPropertiesModal, PropertiesTab } from './components/VestaPropertiesModal';
import { PeriodicTableModal } from './components/PeriodicTableModal';
import { Canvas3D } from './components/Canvas3D';
import { CrystalScene } from './renderer/CrystalScene';
import { 
  CrystalStructure, 
  PresetMaterialType, 
  RenderMode, 
  Atom, 
  VisualSettings,
  MeasureMode,
  Vec3,
  DEFAULT_POLYHEDRA_SETTINGS
} from './types/crystal';
import { exportPOSCAR } from './parsers/poscar';
import { exportCIF, geometrySignature } from './parsers/cif';
import { exportXYZ } from './parsers/xyz';
import { fractionalToCartesian, calculateLatticeFromMatrix } from './utils/math';
import { RenderImageModal, RenderExportOptions } from './components/RenderImageModal';
import { UnitCellTransformModal } from './components/UnitCellTransformModal';
import { readStartupOptions } from './config';
import { MAX_FILE_BYTES, assertAtomCount, assertFiniteVector, assertElementToken, assertStructureValid } from './utils/validation';
import { createSupercell } from './utils/supercell';
import { loadSavedPolyhedraSettings } from './components/savedPolyhedraSettings';

export function App() {
  const crystalSceneRef = useRef<CrystalScene | null>(null);

  const [startup] = useState(() => readStartupOptions(window.location.search));
  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Core App State
  const [structure, setStructure] = useState<CrystalStructure | null>(null);
  const [materialType, setMaterialType] = useState<PresetMaterialType>(startup.material);
  const [renderMode, setRenderMode] = useState<RenderMode>('ball-and-stick');
  const [showLattice, setShowLattice] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [selectedAtom, setSelectedAtom] = useState<Atom | null>(null);
  const [selectedAtoms, setSelectedAtoms] = useState<Atom[]>([]);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState<boolean>(startup.openProperties);
  const [isTransformModalOpen, setIsTransformModalOpen] = useState<boolean>(false);
  const [propertiesTab, setPropertiesTab] = useState<PropertiesTab>(startup.propertiesTab);
  const [isPeriodicModalOpen, setIsPeriodicModalOpen] = useState<boolean>(false);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState<boolean>(false);
  // Keep the model usable on first visit to a phone-sized viewport; every panel
  // remains accessible through its existing expand button.
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState<boolean>(() => window.matchMedia('(max-width: 640px)').matches);
  const [measureMode, setMeasureMode] = useState<MeasureMode>('none');
  const [measureHint, setMeasureHint] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Visual Customization Settings (VESTA style defaults)
  const [visualSettings, setVisualSettings] = useState<VisualSettings>(() => ({
    atomScale: startup.atomScale,
    bondRadius: startup.bondRadius,
    bondTolerance: 1.15,
    bondStyle: startup.bondStyle,
    bondColorMode: 'uniform',
    customBondColor: '#8fa4ba',
    doubleBondGap: 0.14,
    aromaticGapRatio: 0.20,
    taperRootRadius: startup.taperRoot,
    taperTipRadius: startup.taperTip,
    taperMode: 'directional',
    elementColors: {},
    elementRadii: {},
    showPolyhedra: startup.polyhedra,
    polyhedraSettings: loadSavedPolyhedraSettings() ?? {
      ...DEFAULT_POLYHEDRA_SETTINGS,
      material: { ...DEFAULT_POLYHEDRA_SETTINGS.material },
      edges: { ...DEFAULT_POLYHEDRA_SETTINGS.edges },
      elementColors: {}
    },
    showHBonds: startup.showHBonds,
    showOutline: startup.showOutline,
    showShadows: startup.showShadows,
    showFog: false,
    showLabels: 'none',
    isOrthographic: false,
    autoRotate: false,
    autoRotateSpeed: 2.0,
    ligandViewRadius: null,
    showBoundaryAtoms: true,
    lightAzimuth: startup.lightAzimuth,
    lightAltitude: startup.lightAltitude,
    lightIntensity: startup.lightIntensity,
    ambientIntensity: startup.ambientIntensity,
    headlightMode: false
  }));

  const history = useRef(new ProjectHistory());
  const [, refreshHistory] = useState(0);
  const [recovery, setRecovery] = useState<ProjectState | null>(null);
  const [storageStatus, setStorageStatus] = useState('等待导入结构');
  const [migrationNotice,setMigrationNotice]=useState<string|undefined>(startup.migrationNotice);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress,setImportProgress]=useState(0);
  const importGeneration = useRef(0);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const project = structure ? { structure, visualSettings, materialType, renderMode, showLattice, showAxes } : null;
  const applyProject = (state: ProjectState) => {
    setMigrationNotice(state.migrationNotice);
    cancelImport(); importGeneration.current++; setIsImporting(false);
    setStructure(state.structure); setVisualSettings(state.visualSettings); setMaterialType(state.materialType);
    setRenderMode(state.renderMode); setShowLattice(state.showLattice); setShowAxes(state.showAxes);
    setSelectedAtom(null); setSelectedAtoms([]); crystalSceneRef.current?.clearMeasurements(); handleSetMeasureMode('none');
  };
  useEffect(() => {
    let active = true;
    readRecovery().then(text => { if (active && text) setRecovery(parseProject(text)); })
      .catch(() => { if (active) setStorageStatus('恢复记录不可用；请使用项目文件保存'); })
      .finally(() => { if (active) setRecoveryReady(true); });
    return () => { active = false; cancelImport(); };
  }, []);
  useEffect(() => {
    if (!project || isPropertiesOpen) return;
    history.current.observe(project); refreshHistory(n => n + 1);
  }, [structure, visualSettings, materialType, renderMode, showLattice, showAxes, isPropertiesOpen]);
  useEffect(() => {
    if (!project || !recoveryReady || recovery || isPropertiesOpen || isImporting) return;
    setStorageStatus('正在自动保存…');
    let active = true;
    const timer = setTimeout(() => {
      try {
        const text = encodeProject(project);
        writeRecovery(text).then(() => { if (active) setStorageStatus('已自动保存到本机'); })
          .catch(() => { if (active) setStorageStatus('自动保存失败；请保存项目文件'); });
      } catch { setStorageStatus('自动保存失败；请保存项目文件'); }
    }, 700);
    return () => { active = false; clearTimeout(timer); };
  }, [structure, visualSettings, materialType, renderMode, showLattice, showAxes, recoveryReady, recovery, isPropertiesOpen, isImporting]);
  const moveHistory = (direction: 'undo' | 'redo') => {
    if (isPropertiesOpen || !project) return;
    const state = history.current[direction]();
    if (state) { applyProject(state); refreshHistory(n => n + 1); }
  };
  const saveProject = () => {
    if (!project) return;
    try { const url = URL.createObjectURL(new Blob([encodeProject(project)], { type: 'application/json' })); downloadFile(url, 'crystal.crystalcraft.json'); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : String(error)); }
  };

  const [counts, setCounts] = useState<{ atomsCount: number; bondsCount: number; polyhedraCount: number; hbondsCount: number }>({
    atomsCount: 0,
    bondsCount: 0,
    polyhedraCount: 0,
    hbondsCount: 0
  });

  const handleUpdateVisualSettings = (newSettings: Partial<VisualSettings>) => {
    setVisualSettings(prev => {
      const updated = { ...prev, ...newSettings };
      return updated;
    });
  };

  const handleSetMeasureMode = (mode: MeasureMode) => {
    if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
    setMeasureMode(mode);
    crystalSceneRef.current?.setMeasureMode(mode);
    if (mode === 'distance') {
      setMeasureHint('【原子间距测量模式】请在 3D 画布中点击第 1 个原子...');
    } else if (mode === 'angle') {
      setMeasureHint('【键角测量模式】请在 3D 画布中点击第 1 个原子...');
    } else {
      setMeasureHint(null);
    }
  };

  const handleSetAtomColor = (atomId: number, color: string | null) => {
    if (!structure) return;
    atomId = selectedAtom?.id === atomId ? (selectedAtom.originalId ?? atomId) : atomId;
    const updatedAtoms = structure.atoms.map(a => {
      if (a.id === atomId) {
        const copy = { ...a };
        if (color) copy.colorOverride = color;
        else delete copy.colorOverride;
        return copy;
      }
      return a;
    });
    setStructure({ ...structure, atoms: updatedAtoms });
    if (selectedAtom && selectedAtom.id === atomId) {
      setSelectedAtom(prev => prev ? ({ ...prev, colorOverride: color || undefined }) : null);
    }
  };

  const handleSetElementColor = (element: string, color: string | null) => {
    setVisualSettings(prev => {
      const updatedColors = { ...prev.elementColors };
      if (color) updatedColors[element] = color;
      else delete updatedColors[element];
      const updated = { ...prev, elementColors: updatedColors };
      return updated;
    });
  };

  const handleSetAtomRadius = (atomId: number, radius: number | null) => {
    if (!structure) return;
    if (radius !== null && (!Number.isFinite(radius) || radius <= 0 || radius > 5)) { setErrorMessage('原子半径必须在 0 到 5 Å 之间。'); return; }
    atomId = selectedAtom?.id === atomId ? (selectedAtom.originalId ?? atomId) : atomId;
    const updatedAtoms = structure.atoms.map(a => {
      if (a.id === atomId) {
        const copy = { ...a };
        if (radius) copy.radiusOverride = radius;
        else delete copy.radiusOverride;
        return copy;
      }
      return a;
    });
    setStructure({ ...structure, atoms: updatedAtoms });
    if (selectedAtom && selectedAtom.id === atomId) {
      setSelectedAtom(prev => prev ? ({ ...prev, radiusOverride: radius || undefined }) : null);
    }
  };

  const handleSetElementRadius = (element: string, radius: number | null) => {
    if (radius !== null && (!Number.isFinite(radius) || radius <= 0 || radius > 5)) { setErrorMessage('元素半径必须在 0 到 5 Å 之间。'); return; }
    setVisualSettings(prev => {
      const updatedRadii = { ...prev.elementRadii };
      if (radius) updatedRadii[element] = radius;
      else delete updatedRadii[element];
      const updated = { ...prev, elementRadii: updatedRadii };
      return updated;
    });
  };

  // Structure changes and scene selection use the same atom records.
  useEffect(() => {
    if (!structure) return;
    const resolve = (atom: Atom) => structure.atoms.find(a => a.id === (atom.originalId ?? atom.id));
    setSelectedAtom(previous => previous ? resolve(previous) ?? null : null);
    setSelectedAtoms(previous => previous.map(resolve).filter((a): a is Atom => Boolean(a)));
  }, [structure]);

  useEffect(() => {
    const zoomTimer = startup.zoom > 0 ? setTimeout(() => crystalSceneRef.current?.zoomBy(startup.zoom), 120) : null;
    return () => {
      if (zoomTimer) clearTimeout(zoomTimer);
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
    };
  }, []);

  const handleFileUpload = (file: File) => {
    const generation=++importGeneration.current;
    cancelImport();setIsImporting(false);setImportProgress(0);
    const limit=file.name.toLowerCase().endsWith('.crystalcraft.json')?MAX_PROJECT_BYTES:volumeKind(file.name)?MAX_VOLUME_BYTES:MAX_FILE_BYTES;
    if(file.size>limit){setErrorMessage(`文件超过 ${limit/1024/1024} MiB，请先缩小文件。`);return;}
    setIsImporting(true);
    parseImportedBlob(file,progress=>{if(generation===importGeneration.current)setImportProgress(Math.floor(progress.loaded/Math.max(1,progress.total)*100));}).then(parsed=>{
      if(generation!==importGeneration.current)return;
      if(parsed.kind==='project')applyProject(parsed.state);
      else {setMigrationNotice(undefined);handleApplyTransform(parsed.structure);setVisualSettings(prev=>({...prev,bondSettings:undefined,volumeSettings:parsed.structure.volumeData?defaultVolumeSettings(parsed.structure.volumeData):undefined}));}
      setRecovery(null);handleSetMeasureMode('none');crystalSceneRef.current?.clearMeasurements();setErrorMessage(null);
    }).catch(error=>{if(generation===importGeneration.current)setErrorMessage(`解析失败 [${file.name}]: ${error instanceof Error?error.message:String(error)}`);})
      .finally(()=>{if(generation===importGeneration.current)setIsImporting(false);});
  };

  // Handle VESTA Unit Cell Transformation
  const handleApplyTransform = (transformed: CrystalStructure) => {
    assertStructureValid(transformed);
    setStructure(transformed);
    const firstAtom = transformed.atoms[0] || null;
    setSelectedAtom(firstAtom);
    setSelectedAtoms(firstAtom ? [firstAtom] : []);
  };

  // Handle Export
  const handleExport = (format: 'cif' | 'source-cif' | 'poscar' | 'xyz' | 'png') => {
    if (!structure && format !== 'png') return;

    if (format === 'png') {
      setIsRenderModalOpen(true);
      return;
    }

    try {
      let text = '';
      let filename = (structure?.title || 'crystal').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120);

      if (format === 'source-cif') {
        if (!structure?.sourceCif) throw new Error('当前结构没有原始 CIF 存档。');
        text = structure.sourceCif.text; filename += '.source.cif';
      } else if (format === 'poscar') {
        text = exportPOSCAR(structure!);
        filename += '.poscar';
      } else if (format === 'cif') {
        text = exportCIF(structure!);
        filename += '.cif';
      } else if (format === 'xyz') {
        text = exportXYZ(structure!);
        filename += '.xyz';
      }

      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      downloadFile(url, filename);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      setErrorMessage('导出失败: ' + err.message);
    }
  };

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRenderImageExport = async (options: RenderExportOptions) => {
    if (!crystalSceneRef.current) throw new Error('3D 渲染器尚未就绪，请稍后重试。');
    try {
      const imageUrl = await crystalSceneRef.current.renderHighResImage(options);
      const title = structure?.title ? structure.title.replace(/[\s\/\\]+/g, '_') : 'crystal';
      const filename = `${title}_${options.width}px_${options.transparent ? 'transparent' : 'opaque'}.png`;
      try { downloadFile(imageUrl, filename); } finally { setTimeout(() => URL.revokeObjectURL(imageUrl), 1000); }
    } catch (err: any) {
      setErrorMessage('渲染图像导出失败: ' + err.message);
      throw err;
    }
  };

  const handleSupercell = (nx: number, ny: number, nz: number) => {
    if (!structure?.lattice) return;
    try {
      handleApplyTransform(createSupercell(structure, nx, ny, nz));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleAddVacuum = () => {
    if (!structure || !structure.lattice) return;
    try {
    const [va, vb, vc] = structure.lattice.matrix;
    const oldC = structure.lattice.c;
    const newC = oldC + 15.0; // Add 15 A
    const scaleZ = newC / oldC;
    const newVC = { x: vc.x * scaleZ, y: vc.y * scaleZ, z: vc.z * scaleZ };
    const newMatrix: [Vec3, Vec3, Vec3] = [va, vb, newVC];
    const newLattice = calculateLatticeFromMatrix(newMatrix);

    const updatedAtoms = structure.atoms.map(a => ({
      ...a,
      fractional: {
        x: a.fractional.x,
        y: a.fractional.y,
        z: (a.fractional.z * oldC) / newC
      }
    }));

    const updated: CrystalStructure = {
      ...structure,
      title: `${structure.title} (+15Å 真空层)`,
      lattice: newLattice,
      atoms: updatedAtoms
    };

    assertStructureValid(updated);
    setStructure(updated);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : String(error)); }
  };

  const handleQuickReplace = (element: string) => {
    if (!structure || !selectedAtom) return;
    const updatedAtoms = structure.atoms.map(a => 
      a.id === (selectedAtom.originalId ?? selectedAtom.id) ? { ...a, element } : a
    );
    const updated = { ...structure, atoms: updatedAtoms };
    setStructure(updated);
    setSelectedAtom({ ...selectedAtom, element });
  };

  const handleDeleteSelected = () => {
    if (!structure || !selectedAtom) return;
    const updated = {
      ...structure,
      atoms: structure.atoms.filter(a => a.id !== (selectedAtom.originalId ?? selectedAtom.id))
    };
    setStructure(updated);
    setSelectedAtom(null);
    setSelectedAtoms([]);
  };

  const handleAddAtom = (element: string, fracCoords: { x: number; y: number; z: number }) => {
    if (!structure) return;
    try {
      assertAtomCount(structure.atoms.length + 1);
      assertFiniteVector(fracCoords, '原子坐标');
      assertElementToken(element);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      return;
    }
    const nextId = structure.atoms.length > 0 
      ? Math.max(...structure.atoms.map(a => a.id)) + 1 
      : 1;

    let cartesian = { ...fracCoords };
    if (structure.lattice) {
      cartesian = fractionalToCartesian(fracCoords, structure.lattice.matrix);
    }

    const newAtom: Atom = {
      id: nextId,
      element,
      fractional: fracCoords,
      cartesian,
      selected: true
    };

    const updated = {
      ...structure,
      atoms: [...structure.atoms, newAtom]
    };
    try { assertStructureValid(updated); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : String(error)); return; }
    setStructure(updated);
    setSelectedAtom(newAtom);
    setSelectedAtoms([newAtom]);
  };

  const displayedAtoms = crystalSceneRef.current?.getDisplayedAtoms() || structure?.atoms || [];

  return (
    <div className="flex flex-col h-dvh w-full bg-[#f3f4f6] text-slate-800 overflow-hidden font-sans">
      
      {recovery && <div role="status" className="flex shrink-0 flex-wrap items-center justify-center gap-3 bg-blue-50 px-3 py-2 text-xs text-blue-950">
        <span>检测到本机上次项目：{recovery.structure.title}</span>
        <button onClick={() => { applyProject(recovery); setRecovery(null); }}>恢复上次项目</button>
        <button onClick={async () => { try { await writeRecovery(null);setRecovery(null);setStorageStatus('等待导入结构'); } catch { setErrorMessage('清除恢复记录失败，请稍后重试。'); } }}>清除本机恢复记录</button>
      </div>}
      {migrationNotice&&<div role="status" aria-label="材质迁移提示" className="flex shrink-0 items-center gap-3 bg-amber-50 px-3 py-2 text-xs text-amber-950"><span>{migrationNotice}</span><button type="button" onClick={()=>setMigrationNotice(undefined)}>关闭提示</button></div>}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
        <button onClick={saveProject} disabled={!structure || isPropertiesOpen || isImporting} className="rounded border border-slate-300 px-2 py-1">保存项目</button>
        <span role="status" aria-live="polite">{isImporting ? `正在分块解析文件… ${importProgress}%` : recovery ? '等待选择恢复项目' : storageStatus}</span>
        {isImporting&&<button onClick={()=>{importGeneration.current++;cancelImport();setIsImporting(false);setImportProgress(0);}} className="rounded border border-slate-300 px-2 py-1">取消导入</button>}
        <span className="ml-auto text-slate-500">{structure?.sourceCif ? geometrySignature(structure) === structure.sourceCif.originalGeometry ? '保留原始 CIF 存档' : '结构已编辑 · CIF 导出为 P1 · 原始存档独立保留' : '结构与显示设置保存在本机'}</span>
      </div>
      {(structure?.atoms.length ?? 0) >= 500 && <div className="shrink-0 bg-amber-50 px-3 py-1 text-xs text-amber-900">大结构已降低默认球细分；若拖动卡顿，可关闭阴影、标签并切换为不透明材质。自定义细分仍优先。</div>}
      {/* 1. VESTA Menu Bar (File, Edit, View, Objects, Utilities, Help) */}
      <VestaMenuBar
        structure={structure}
        visualSettings={visualSettings}
        renderMode={renderMode}
        materialType={materialType}
        showLattice={showLattice}
        showAxes={showAxes}
        onSaveProject={saveProject}
        onUndo={() => moveHistory('undo')} onRedo={() => moveHistory('redo')}
        canUndo={history.current.past.length > 0 && !isPropertiesOpen} canRedo={history.current.future.length > 0 && !isPropertiesOpen}
        onFileUpload={handleFileUpload}
        onExport={handleExport}
        onViewAlong={(axis) => crystalSceneRef.current?.viewAlong(axis)}
        onToggleLattice={() => setShowLattice(!showLattice)}
        onToggleAxes={() => setShowAxes(!showAxes)}
        onUpdateVisualSettings={handleUpdateVisualSettings}
        onRenderModeChange={setRenderMode}
        onMaterialChange={(mat) => {
          setMaterialType(mat);
          if(NEW_MATERIALS.includes(mat)){
              setVisualSettings(prev=>({...prev,showOutline:false,showShadows:false}));
            } else if (mat === 'clay') {
            setVisualSettings(prev => ({ ...prev, showOutline: false, showShadows: true }));
          } else if (mat === 'mof') {
            setVisualSettings(prev => ({ ...prev, showOutline: true, showPolyhedra: true }));
          } else if (mat === 'popart') {
            setVisualSettings(prev => ({ ...prev, showOutline: true, showShadows: true }));
          } else if (['comic', 'handdrawn', 'flat2d', 'toon', 'bubble'].includes(mat)) {
            setVisualSettings(prev => ({ ...prev, showOutline: true }));
          } else if (['plastic', 'glossy', 'metallic', 'glass', 'smooth'].includes(mat)) {
            setVisualSettings(prev => ({ ...prev, showOutline: false, showShadows: true }));
          } else if (mat === 'flat') {
            setVisualSettings(prev => ({ ...prev, showOutline: true, showShadows: false }));
          }
        }}
        onOpenPeriodicTable={() => setIsPeriodicModalOpen(true)}
        onDeleteSelected={handleDeleteSelected}
        onSupercell={handleSupercell}
        onAddVacuum={handleAddVacuum}
        onOpenRenderModal={() => setIsRenderModalOpen(true)}
        onOpenProperties={(tab) => {
          setPropertiesTab(tab || 'polyhedra');
          setIsPropertiesOpen(true);
        }}
        onOpenTransformModal={() => setIsTransformModalOpen(true)}
      />

      {/* 2. VESTA Quick Toolbar (a, b, c, a*, b*, c*, Rotate, Pan, Zoom, PBC) */}
      <VestaToolbar
        showLattice={showLattice}
        showAxes={showAxes}
        visualSettings={visualSettings}
        onViewAlong={(axis) => crystalSceneRef.current?.viewAlong(axis)}
        onRotateBy={(degX, degY) => crystalSceneRef.current?.rotateBy(degX, degY)}
        onPanBy={(dx, dy) => crystalSceneRef.current?.panBy(dx, dy)}
        onZoomBy={(percent) => crystalSceneRef.current?.zoomBy(percent)}
        onToggleLattice={() => setShowLattice(!showLattice)}
        onToggleAxes={() => setShowAxes(!showAxes)}
        onUpdateVisualSettings={handleUpdateVisualSettings}
        onOpenRenderModal={() => setIsRenderModalOpen(true)}
      />

      {/* 3. Main Center Split: Left VESTA Panel & 3D WebGL Canvas */}
      <div className="flex-1 flex overflow-hidden relative">
        <VestaLeftPanel
          structure={structure}
          selectedAtom={selectedAtom}
          selectedAtoms={selectedAtoms}
          isCollapsed={isLeftPanelCollapsed}
          onToggleCollapse={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
          renderMode={renderMode}
          materialType={materialType}
          visualSettings={visualSettings}
          measureMode={measureMode}
          onRenderModeChange={setRenderMode}
          onMaterialChange={(mat) => {
            setMaterialType(mat);
              if(NEW_MATERIALS.includes(mat)){
              setVisualSettings(prev=>({...prev,showOutline:false,showShadows:false}));
            } else if (mat === 'clay') {
              setVisualSettings(prev => ({ ...prev, showOutline: false, showShadows: true }));
            } else if (mat === 'mof') {
              setVisualSettings(prev => ({ ...prev, showOutline: true, showPolyhedra: true }));
            } else if (mat === 'popart') {
              setVisualSettings(prev => ({ ...prev, showOutline: true, showShadows: true }));
            } else if (['comic', 'handdrawn', 'flat2d', 'toon', 'bubble'].includes(mat)) {
              setVisualSettings(prev => ({ ...prev, showOutline: true }));
            } else if (['plastic', 'glossy', 'metallic', 'glass', 'smooth'].includes(mat)) {
              setVisualSettings(prev => ({ ...prev, showOutline: false, showShadows: true }));
            } else if (mat === 'flat') {
              setVisualSettings(prev => ({ ...prev, showOutline: true, showShadows: false }));
            }
          }}
          onUpdateVisualSettings={handleUpdateVisualSettings}
          onSetMeasureMode={handleSetMeasureMode}
          onClearMeasurements={() => crystalSceneRef.current?.clearMeasurements()}
          onOpenProperties={(tab?: PropertiesTab) => {
            setPropertiesTab(tab || 'polyhedra');
            setIsPropertiesOpen(true);
          }}
          onOpenPeriodicTable={() => setIsPeriodicModalOpen(true)}
          onOpenTransformModal={() => setIsTransformModalOpen(true)}
          showLattice={showLattice}
          showAxes={showAxes}
          onToggleLattice={() => setShowLattice(!showLattice)}
          onToggleAxes={() => setShowAxes(!showAxes)}
          onSupercell={handleSupercell}
          onViewAlong={(axis) => crystalSceneRef.current?.viewAlong(axis)}
          hbondsCount={counts.hbondsCount}
        />

        {/* Center: 3D Pure White Canvas with VESTA Axes & Title */}
        <Canvas3D
          structure={structure}
          materialType={materialType}
          renderMode={renderMode}
          showLattice={showLattice}
          showAxes={showAxes}
          bgColor="white"
          visualSettings={visualSettings}
          selectedAtom={selectedAtom}
          selectedAtoms={selectedAtoms}
          onCountsChange={setCounts}
          onAtomSelect={(atom, allSelected) => {
            setSelectedAtom(atom);
            if (allSelected) {
              setSelectedAtoms(allSelected);
            } else {
              setSelectedAtoms(atom ? [atom] : []);
            }
          }}
          onFileDrop={handleFileUpload}
          onRequestImport={() => document.getElementById('structure-file-input')?.click()}
          crystalSceneRef={crystalSceneRef}
          measureHint={measureHint}
          onCancelMeasure={() => handleSetMeasureMode('none')}
          onMeasurementModeChange={(mode) => setMeasureMode(mode)}
          onMeasurementProgress={(step, total, pickedIds) => {
            if (step === 1 && total === 2) {
              setMeasureHint(`已选原子 #${pickedIds[0]}，请在画布中点击第 2 个原子完成测距`);
            } else if (step === 1 && total === 3) {
              setMeasureHint(`已选原子 #${pickedIds[0]}，请点击第 2 个原子（夹角顶点）`);
            } else if (step === 2 && total === 3) {
              setMeasureHint(`已选顶点原子 #${pickedIds[1]}，请点击第 3 个原子完成测角`);
            }
          }}
          onMeasurementComplete={(item) => {
            if (item.type === 'distance') {
              setMeasureHint(`✔ 测距完成：原子间距 = ${item.value.toFixed(3)} Å`);
            } else {
              setMeasureHint(`✔ 测角完成：键角 = ${item.value.toFixed(2)}°`);
            }
            if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
            measureTimerRef.current = setTimeout(() => setMeasureHint(null), 3500);
          }}
        />
      </div>

      {/* 4. VESTA Bottom Output Panel (Table, Summary, Comment, Status) */}
      <VestaBottomPanel
        structure={structure}
        displayedAtoms={displayedAtoms}
        selectedAtom={selectedAtom}
        selectedAtoms={selectedAtoms}
        onSelectAtom={(atom, isMulti) => {
          if (isMulti) {
            crystalSceneRef.current?.toggleSelectAtom(atom.id);
          } else {
            crystalSceneRef.current?.selectAtom(atom.id);
          }
        }}
        counts={counts}
      />

      {/* Properties Modal */}
      <VestaPropertiesModal
        isOpen={isPropertiesOpen}
        onClose={() => setIsPropertiesOpen(false)}
        structure={structure}
        selectedAtom={selectedAtom}
        selectedAtoms={selectedAtoms}
        visualSettings={visualSettings}
        onUpdateVisualSettings={handleUpdateVisualSettings}
        onSetAtomColor={handleSetAtomColor}
        onSetElementColor={handleSetElementColor}
        onSetAtomRadius={handleSetAtomRadius}
        onSetElementRadius={handleSetElementRadius}
        onOpenPeriodicTable={() => setIsPeriodicModalOpen(true)}
        onDeleteSelected={handleDeleteSelected}
        onQuickReplace={handleQuickReplace}
        onAddAtom={handleAddAtom}
        onRestoreStructure={restored => {if(restored)handleApplyTransform(restored);else {setStructure(null);setSelectedAtom(null);setSelectedAtoms([]);}}}
        onFileUpload={handleFileUpload}
        initialTab={propertiesTab}
      />

      {/* Periodic Table Modal */}
      <PeriodicTableModal
        isOpen={isPeriodicModalOpen}
        onClose={() => setIsPeriodicModalOpen(false)}
        onSelectElement={handleQuickReplace}
        title="选择目标替换元素 (原子替换/掺杂)"
      />

      {/* Render Image (High-Res & Transparent) Modal */}
      <RenderImageModal
        isOpen={isRenderModalOpen}
        onClose={() => setIsRenderModalOpen(false)}
        onExport={handleRenderImageExport}
        structureTitle={structure?.title}
      />

      {/* Unit Cell Transformation Modal */}
      <UnitCellTransformModal
        isOpen={isTransformModalOpen}
        onClose={() => setIsTransformModalOpen(false)}
        structure={structure}
        onApplyTransform={handleApplyTransform}
      />

      {/* Error Toast */}
      {errorMessage && (
        <div role="alert" className="max-w-[95vw] absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-white border border-rose-300 text-rose-700 px-4 py-2.5 rounded shadow-lg flex items-center gap-3 text-xs">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-700 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

    </div>
  );
}
