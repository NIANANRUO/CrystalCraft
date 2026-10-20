import React, { useEffect, useRef } from 'react';
import { CrystalScene } from '../renderer/CrystalScene';
import { CrystalStructure, PresetMaterialType, RenderMode, Atom, VisualSettings } from '../types/crystal';
import { UploadCloud } from 'lucide-react';
import { VestaAxesOverlay } from './VestaAxesOverlay';
import type { VolumeStatus } from '../volume/VolumeLayer';
import { defaultVolumeSettings } from '../volume/data';
import { fieldRange } from '../volume/geometry';
import {MaterialLegend} from './MaterialLegend';
import {materialBackground} from '../materialCatalog';

interface Canvas3DProps {
  structure: CrystalStructure | null;
  materialType: PresetMaterialType;
  renderMode: RenderMode;
  showLattice: boolean;
  showAxes: boolean;
  bgColor: 'dark' | 'white';
  visualSettings: VisualSettings;
  selectedAtom: Atom | null;
  selectedAtoms?: Atom[];
  onCountsChange?: (counts: ReturnType<CrystalScene['getDisplayedCounts']>) => void;
  onAtomSelect: (atom: Atom | null, allSelected?: Atom[]) => void;
  onFileDrop: (file: File) => void;
  onRequestImport: () => void;
  crystalSceneRef: React.MutableRefObject<CrystalScene | null>;
  measureHint?: string | null;
  onCancelMeasure?: () => void;
  onMeasurementModeChange?: (mode: any) => void;
  onMeasurementProgress?: (step: number, total: number, pickedAtoms: number[]) => void;
  onMeasurementComplete?: (item: any) => void;
}

export const Canvas3D: React.FC<Canvas3DProps> = ({
  structure,
  materialType,
  renderMode,
  showLattice,
  showAxes,
  bgColor,
  visualSettings,
  selectedAtom,
  selectedAtoms,
  onCountsChange,
  onAtomSelect,
  onFileDrop,
  onRequestImport,
  crystalSceneRef,
  measureHint,
  onCancelMeasure,
  onMeasurementModeChange,
  onMeasurementProgress,
  onMeasurementComplete
}) => {
  const [canvasWidth,setCanvasWidth]=React.useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [sceneError, setSceneError] = React.useState<string | null>(null);
  const [volumeStatus,setVolumeStatus]=React.useState<VolumeStatus|null>(null);
  const [generation, setGeneration] = React.useState(0);
  const previousState = useRef<{ structure: CrystalStructure | null; materialType: PresetMaterialType; renderMode: RenderMode; showLattice: boolean; showAxes: boolean; bgColor: 'dark' | 'white'; visualSettings: VisualSettings } | null>(null);
  useEffect(()=>{
    const container=containerRef.current;if(!container)return;
    setCanvasWidth(container.clientWidth);
    const observer=new ResizeObserver(entries=>setCanvasWidth(entries[0]?.contentRect.width??0));
    observer.observe(container);return()=>observer.disconnect();
  },[]);

  // Initialize Scene
  useEffect(() => {
    if (!containerRef.current) return;

    let scene: CrystalScene;
    try {
      scene = new CrystalScene(containerRef.current);
      crystalSceneRef.current = scene;
      scene.onStatusChange = setSceneError;
      scene.onVolumeStateChange=setVolumeStatus;
      previousState.current = null;
      setSceneError(null);
    } catch (error) {
      setSceneError(`无法启动 3D 画布。请确认浏览器已启用硬件加速，或使用支持 WebGL 2 的浏览器。${error instanceof Error ? ` (${error.message})` : ''}`);
      return;
    }

    return () => {
      scene.dispose();
      crystalSceneRef.current = null;
    };
  }, [generation, crystalSceneRef]);

  // Refresh callbacks independently so interaction never closes over stale application state.
  useEffect(() => {
    const scene = crystalSceneRef.current;
    if (!scene) return;
    scene.onAtomSelect = onAtomSelect;
    scene.onMeasurementModeChange = onMeasurementModeChange;
    scene.onMeasurementProgress = onMeasurementProgress;
    scene.onMeasurementComplete = onMeasurementComplete;
    scene.onCountsChange = onCountsChange;
  }, [generation, onAtomSelect, onMeasurementModeChange, onMeasurementProgress, onMeasurementComplete, onCountsChange, crystalSceneRef]);

  // One rebuild per React update, including initial mount and recovery.
  useEffect(() => {
    const scene = crystalSceneRef.current;
    if (!scene) return;
    const prev = previousState.current;
    try {
      scene.batchUpdates(() => {
        if (structure !== prev?.structure) scene.setStructure(structure);
        if (materialType !== prev?.materialType) scene.setMaterialPreset(materialType);
        if (renderMode !== prev?.renderMode) scene.setRenderMode(renderMode);
        if (showLattice !== prev?.showLattice) scene.toggleLattice(showLattice);
        if (showAxes !== prev?.showAxes) scene.toggleAxes(showAxes);
        if (bgColor !== prev?.bgColor) scene.setBackgroundColor(bgColor);
        if (visualSettings !== prev?.visualSettings) scene.setVisualSettings(visualSettings);
        scene.setSelectedAtomIds((selectedAtoms ?? (selectedAtom ? [selectedAtom] : [])).map(atom => atom.originalId ?? atom.id), false);
      });
      previousState.current = { structure, materialType, renderMode, showLattice, showAxes, bgColor, visualSettings };
      setSceneError(scene.getStatusMessage());
    } catch (error) {
      setSceneError(error instanceof Error ? error.message : '结构渲染失败，请尝试降低显示复杂度。');
    }
  }, [generation, structure, materialType, renderMode, showLattice, showAxes, bgColor, visualSettings, selectedAtom, selectedAtoms, crystalSceneRef]);

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileDrop(file);
    }
  };

  return (
    <div 
      className="relative flex-1 h-full w-full overflow-hidden bg-white"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 3D WebGL Canvas Container: absolute fill to ensure exact flexbox pixel sizing */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" 
      />

      {sceneError && (
        <div role="alert" className="absolute inset-x-4 top-12 z-40 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-lg">
          <p>{sceneError}</p>
          <button type="button" onClick={() => setGeneration(value => value + 1)} className="mt-2 rounded border border-amber-400 px-3 py-1 font-semibold">重新初始化画布</button>
        </div>
      )}
      {!structure&&!sceneError&&canvasWidth>=240&&<div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6" aria-label="空白工作区">
        <div className="pointer-events-auto max-w-sm text-center text-slate-700">
          <UploadCloud size={38} className="mx-auto mb-4 text-slate-400" aria-hidden="true"/>
          <h1 className="text-lg font-semibold text-slate-800">导入晶体结构开始使用</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">将文件拖到此处，或选择本机文件。</p>
          <button type="button" onClick={onRequestImport} className="mt-5 rounded-lg bg-slate-800 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600">选择结构文件</button>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">支持 CIF、POSCAR / CONTCAR、XYZ 和 VASP 体数据<br/>文件仅在浏览器本机解析</p>
        </div>
      </div>}
      {structure&&canvasWidth>=280&&<MaterialLegend type={materialType} structure={structure} settings={visualSettings}/>}
      {structure?.volumeData && volumeStatus && <div role="status" className="absolute bottom-3 right-3 z-20 max-w-[240px] rounded border border-slate-300 bg-white/95 p-2 text-[11px] text-slate-800 shadow-sm">
        <div>{structure.volumeData.kind} · {structure.volumeData.units}</div>
        {structure.volumeData.originalDimensions&&<div>展示 {structure.volumeData.dimensions.join('×')}（原始 {structure.volumeData.originalDimensions.join('×')}）</div>}
        {(()=>{const s=visualSettings.volumeSettings??defaultVolumeSettings(structure.volumeData);return s.isoEnabled?<div>等值 {s.paired?'±':''}{s.isoValue.toPrecision(4)} · {structure.volumeData.units}</div>:null;})()}
        <div>{volumeStatus.loading?'体数据生成中…':`等值面：${volumeStatus.triangles} 三角形${volumeStatus.section?' · 切片已显示':''}`}</div>
        {volumeStatus.section && (()=>{try{const s=visualSettings.volumeSettings??defaultVolumeSettings(structure.volumeData);const range=fieldRange(structure.volumeData,s);return <><div className="my-1 h-2" style={{background:s.palette==='viridis'?'linear-gradient(to right,#440154,#3b528b,#21918c,#5ec962,#fde725)':'linear-gradient(to right,#2166ac,#f7f7f7,#e66101)'}}/><div>{range[0].toPrecision(4)} — {range[1].toPrecision(4)}</div></>;}catch{return <div>请检查色标范围。</div>;}})()}
      </div>}

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md border-2 border-dashed border-slate-400 text-slate-800">
          <UploadCloud size={52} className="animate-bounce mb-3 text-slate-700" />
          <span className="text-xl font-bold">释放文件以立即载入</span>
          <span className="text-sm text-slate-500 mt-1">支持 POSCAR, CONTCAR, CIF, XYZ 任意文件</span>
        </div>
      )}

      {/* Floating Measurement Banner */}
      {measureHint && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 text-white px-4 py-1.5 rounded-full shadow-lg border border-slate-700/60 backdrop-blur-md flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-medium whitespace-nowrap">{measureHint}</span>
          {onCancelMeasure && (
            <button
              onClick={onCancelMeasure}
              className="text-slate-300 hover:text-white ml-2 text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              退出
            </button>
          )}
        </div>
      )}

      {/* VESTA Top-Left Title Label */}
      {structure&&<div className="absolute top-3 left-4 z-10 pointer-events-none select-none">
        <span className={`text-xs font-bold tracking-wide font-sans ${materialBackground(materialType,'#ffffff')==='#05080f'?'text-slate-100':'text-slate-800'}`}>
          {structure.title}
        </span>
      </div>}

      {/* VESTA Orientation Axes (a in red, b in green, c in blue) */}
      {structure && showAxes && (
        <VestaAxesOverlay 
          structure={structure} 
          crystalSceneRef={crystalSceneRef} 
        />
      )}
    </div>
  );
};
