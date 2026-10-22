import React, { useState, useEffect, useMemo } from 'react';
import { cloneEditableStructure } from '../projectSnapshot';
import { 
  X, 
  Layers, 
  Atom as AtomIcon, 
  GitCommit, 
  Box, 
  Check, 
  RotateCcw, 
  Save, 
  Info,
  Sliders,
  CheckSquare,
  Square
} from 'lucide-react';
import { 
  Atom, 
  CrystalStructure, 
  VisualSettings, 
  PolyhedralStyle, 
  PolyhedraSettings, 
  PolyhedraCenterMode,
  DEFAULT_POLYHEDRA_SETTINGS 
} from '../types/crystal';
import type { BondSettings } from '../types/crystal';
import { assertBondSettings, defaultBondRules } from '../utils/bonding';
import { BondEditor } from './BondEditor';
import { getElement, getDisplayRadius } from '../constants/elements';
import { useDraggable } from '../hooks/useDraggable';
import { useModalDialog } from '../hooks/useModalDialog';
import { savePolyhedraDefaults } from './savedPolyhedraSettings';
import { VolumePanel } from './VolumePanel';
import { IonicRadiusEditor } from './IonicRadiusEditor';

export type PropertiesTab = 'general' | 'atoms' | 'bonds' | 'polyhedra' | 'isosurfaces' | 'sections';

interface VestaPropertiesModalProps {
  onCancelImport?: () => void;
  onFileUpload?: (file:File)=>void;
  isOpen: boolean;
  onClose: () => void;
  onRestoreStructure?: (structure: CrystalStructure | null) => void;
  structure: CrystalStructure | null;
  selectedAtom: Atom | null;
  selectedAtoms?: Atom[];
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
  initialTab?: PropertiesTab;
}

// Helpers for color conversion
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16)
    };
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toH = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

// VESTA & Standard Publication Color Swatches for Atoms
const VESTA_SWATCHES = [
  { name: 'VESTA Carbon 碳棕', color: '#906040' },
  { name: 'VESTA Nitrogen 氮淡蓝', color: '#80B0F0' },
  { name: 'VESTA Phosphorus 磷紫', color: '#9966CC' },
  { name: 'VESTA Molybdenum 钼紫红', color: '#B070B0' },
  { name: 'VESTA Oxygen 氧红', color: '#FF0D0D' },
  { name: 'VESTA Sulfur 硫黄', color: '#FFFF30' },
  { name: 'VESTA Silicon 硅橙', color: '#F0C8A0' },
  { name: 'VESTA Titanium 钛灰', color: '#BFC2C7' },
  { name: 'VESTA Platinum 铂蓝灰', color: '#D0D0E0' },
  { name: 'VESTA Hydrogen 氢白', color: '#FFFFFF' }
];

const VestaPropertiesModalContent: React.FC<VestaPropertiesModalProps> = ({
  onCancelImport,
  onFileUpload,
  onClose,
  onRestoreStructure,
  structure,
  selectedAtom,
  selectedAtoms = [],
  visualSettings,
  onUpdateVisualSettings,
  onSetAtomColor,
  onSetElementColor,
  onSetAtomRadius,
  onSetElementRadius,
  onOpenPeriodicTable,
  onDeleteSelected,
  onQuickReplace,
  onAddAtom,
  initialTab = 'polyhedra'
}) => {
  const { position, onMouseDown } = useDraggable();

  // Active tab in properties dialog
  const [activeTab, setActiveTab] = useState<PropertiesTab>(initialTab);

  // Backup initial settings for Cancel action
  const [initialSettingsSnapshot] = useState<VisualSettings>(() => ({
    bondSettings: undefined,textureStrength:undefined,textureScale:undefined,atomSpecular: undefined, atomShininess: undefined, atomStacks: undefined, atomSlices: undefined,
    atomStyle: undefined, radiiType: undefined, hideNonbonding: undefined, labelOffsetZ: undefined, outlineWidth: undefined,volumeSettings:undefined,ionicRadii:undefined,
    ...JSON.parse(JSON.stringify(visualSettings))
  }));
  const [initialStructureSnapshot] = useState<CrystalStructure | null>(() => structure ? cloneEditableStructure(structure) : null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [bondDraft, setBondDraft] = useState<BondSettings>(() => visualSettings.bondSettings
    ? structuredClone(visualSettings.bondSettings)
    : { enabled: false, rules: defaultBondRules(structure, visualSettings.bondTolerance, visualSettings.polyhedraSettings?.centralElements) });
  const [bondsEdited, setBondsEdited] = useState(false);
  const bondError = useMemo(() => {
    if (!bondsEdited) return null;
    try { assertBondSettings(bondDraft); return null; }
    catch (error) { return error instanceof Error ? error.message : '化学键规则无效。'; }
  }, [bondDraft, bondsEdited]);

  // Polyhedra settings working copy
  const currentPolySettings: PolyhedraSettings = visualSettings.polyhedraSettings || DEFAULT_POLYHEDRA_SETTINGS;

  // Master switch for polyhedra rendering
  const [isPolyhedraEnabled, setIsPolyhedraEnabled] = useState<boolean>(visualSettings.showPolyhedra);

  // Center mode: 'all' (按元素全量) vs 'custom' (指定特定原子)
  const [centerMode, setCenterMode] = useState<PolyhedraCenterMode>(currentPolySettings.centerMode || 'all');
  const [customAtomIds, setCustomAtomIds] = useState<number[]>(currentPolySettings.customAtomIds || []);
  const [inputAtomId, setInputAtomId] = useState<string>('');

  const [polyStyle, setPolyStyle] = useState<PolyhedralStyle>(currentPolySettings.style ?? 2);
  const [centralElements, setCentralElements] = useState<string[]>(
    currentPolySettings.centralElements
      ? currentPolySettings.centralElements
      : DEFAULT_POLYHEDRA_SETTINGS.centralElements
  );
  const [specular, setSpecular] = useState(currentPolySettings.material?.specular || { r: 255, g: 255, b: 255 });
  const [shininess, setShininess] = useState(currentPolySettings.material?.shininess ?? 100);
  const [opacity, setOpacity] = useState(currentPolySettings.material?.opacity ?? 204);

  // Working copy of element-specific RGBA colors
  const [elementColors, setElementColors] = useState<Record<string, { r: number; g: number; b: number; a: number }>>(
    currentPolySettings.elementColors || {}
  );

  // Edges working copy
  const [showEdges, setShowEdges] = useState<boolean>(currentPolySettings.edges?.show ?? true);
  const [edgeLineWidth, setEdgeLineWidth] = useState<number>(currentPolySettings.edges?.lineWidth ?? 1.0);
  const [edgeColor, setEdgeColor] = useState<{ r: number; g: number; b: number }>(
    currentPolySettings.edges?.color || { r: 180, g: 180, b: 180 }
  );

  // Preview toggle
  const [previewEnabled, setPreviewEnabled] = useState<boolean>(true);

  // All unique elements present in the active crystal structure
  const structureElements = useMemo(() => {
    if (!structure || !structure.atoms || structure.atoms.length === 0) {
      return ['Co', 'Ti', 'Fe', 'Si', 'Al', 'O'];
    }
    const set = new Set<string>();
    structure.atoms.forEach(a => set.add(a.element));
    return Array.from(set);
  }, [structure]);

  // Selected central element in the Planes section
  const [selectedCentralElem, setSelectedCentralElem] = useState<string>(() => {
    // Pick first transition metal or first element present
    const metals = ['Co', 'Ti', 'Fe', 'Ni', 'Cu', 'Mn', 'Cr', 'V', 'Mo', 'Zr', 'Pt', 'Si', 'Al'];
    const found = structureElements.find(e => metals.includes(e));
    return found || structureElements[0] || 'Co';
  });

  // Atom tab state (matching VESTA Atoms Properties)
  const [selectedAtomElem, setSelectedAtomElem] = useState<string>(() => {
    if (selectedAtom) return selectedAtom.element;
    if (structure && structure.atoms.length > 0) return structure.atoms[0].element;
    return 'P';
  });

  useEffect(() => {
    if (selectedAtom) {
      setSelectedAtomElem(selectedAtom.element);
    }
  }, [selectedAtom]);

  const [colorScope, setColorScope] = useState<'single' | 'element'>('element');
  const [atomSpecular, setAtomSpecular] = useState<{ r: number; g: number; b: number }>(visualSettings.atomSpecular ?? { r: 204, g: 204, b: 204 });
  const [atomShininess, setAtomShininess] = useState<number>(visualSettings.atomShininess ?? 20);
  const [atomStacks, setAtomStacks] = useState<number>(visualSettings.atomStacks ?? ((structure?.atoms.length ?? 0) >= 500 ? 12 : 24));
  const [atomSlices, setAtomSlices] = useState<number>(visualSettings.atomSlices ?? ((structure?.atoms.length ?? 0) >= 500 ? 16 : 32));
  const [atomStyleMode, setAtomStyleMode] = useState<'balls' | 'ellipsoids'>(visualSettings.atomStyle ?? 'balls');
  const [radiiType, setRadiiType] = useState<'atomic' | 'covalent' | 'ionic' | 'vdw'>(visualSettings.radiiType ?? 'atomic');
  const [hideNonbonding, setHideNonbonding] = useState<boolean>(visualSettings.hideNonbonding ?? false);
  const [labelType, setLabelType] = useState<string>(visualSettings.showLabels || 'none');
  const [labelOffsetZ, setLabelOffsetZ] = useState<number>(visualSettings.labelOffsetZ ?? 0);

  const [newElem, setNewElem] = useState('O');
  const [newX, setNewX] = useState('0.5');
  const [newY, setNewY] = useState('0.5');
  const [newZ, setNewZ] = useState('0.5');

  const selectedElemInfo = getElement(selectedAtomElem);

  const currentAtomColor = useMemo(() => {
    if (colorScope === 'single' && selectedAtom && selectedAtom.element === selectedAtomElem) {
      return selectedAtom.colorOverride || visualSettings.elementColors[selectedAtom.element] || getElement(selectedAtom.element).color || '#906040';
    }
    return visualSettings.elementColors[selectedAtomElem] || getElement(selectedAtomElem).color || '#906040';
  }, [colorScope, selectedAtom, selectedAtomElem, visualSettings.elementColors]);

  const currentAtomColorRgb = useMemo(() => hexToRgb(currentAtomColor), [currentAtomColor]);

  const currentAtomRadius = useMemo(() => {
    if (colorScope === 'single' && selectedAtom && selectedAtom.element === selectedAtomElem) {
      return selectedAtom.radiusOverride ?? visualSettings.elementRadii[selectedAtom.element] ?? (radiiType === 'vdw' ? getElement(selectedAtom.element).vdwRadius : radiiType === 'covalent' ? getElement(selectedAtom.element).radius : radiiType === 'ionic' ? visualSettings.ionicRadii?.[selectedAtom.element]?.radius ?? getDisplayRadius(selectedAtom.element) : getDisplayRadius(selectedAtom.element));
    }
    return visualSettings.elementRadii[selectedAtomElem] ?? (radiiType === 'vdw' ? getElement(selectedAtomElem).vdwRadius : radiiType === 'covalent' ? getElement(selectedAtomElem).radius : radiiType === 'ionic' ? visualSettings.ionicRadii?.[selectedAtomElem]?.radius ?? getDisplayRadius(selectedAtomElem) : getDisplayRadius(selectedAtomElem));
  }, [colorScope, selectedAtom, selectedAtomElem, visualSettings.elementRadii, radiiType, visualSettings.ionicRadii]);

  const updateAtomSpecular = (channel: 'r' | 'g' | 'b', value: number) => {
    if (!Number.isFinite(value)) return;
    const next = { ...atomSpecular, [channel]: Math.max(0, Math.min(255, value)) };
    setAtomSpecular(next); onUpdateVisualSettings({ atomSpecular: next });
  };
  const updateAtomShine = (value: number) => { if (Number.isFinite(value)) { const next = Math.max(0, Math.min(100, value)); setAtomShininess(next); onUpdateVisualSettings({ atomShininess: next }); } };
  const updateResolution = (key: 'atomStacks' | 'atomSlices', value: number) => {
    if (!Number.isInteger(value) || value < 8 || value > 64) return;
    if (key === 'atomStacks') setAtomStacks(value); else setAtomSlices(value);
    onUpdateVisualSettings({ [key]: value });
  };
  const handleAtomColorChange = (hex: string) => {
    if (colorScope === 'single') {
      if (selectedAtom && selectedAtom.element === selectedAtomElem) onSetAtomColor(selectedAtom.id, hex);
    } else {
      onSetElementColor(selectedAtomElem, hex);
    }
  };

  const handleAtomRgbChange = (channel: 'r' | 'g' | 'b', val: number) => {
    const clamped = Math.max(0, Math.min(255, isNaN(val) ? 0 : val));
    const newRgb = { ...currentAtomColorRgb, [channel]: clamped };
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    handleAtomColorChange(hex);
  };

  const handleAtomRadiusChange = (radius: number) => {
    if (!Number.isFinite(radius) || radius < 0.1 || radius > 5) return;
    if (colorScope === 'single') {
      if (selectedAtom && selectedAtom.element === selectedAtomElem) onSetAtomRadius(selectedAtom.id, radius);
    } else {
      onSetElementRadius(selectedAtomElem, radius);
    }
  };

  const handleResetAtomDefault = () => {
    if (colorScope === 'single') {
      if (selectedAtom && selectedAtom.element === selectedAtomElem) {
        onSetAtomColor(selectedAtom.id, null);
        onSetAtomRadius(selectedAtom.id, null);
      }
    } else {
      onSetElementColor(selectedAtomElem, null);
      onSetElementRadius(selectedAtomElem, null);
    }
  };

  const QUICK_ELEMENTS = ['C', 'N', 'O', 'P', 'S', 'Mo', 'Ti', 'Fe', 'Ni', 'Co', 'Au', 'Pt'];

  // Current active RGBA for selected central atom
  const currentPlaneRgba = useMemo(() => {
    if (elementColors[selectedCentralElem]) {
      return elementColors[selectedCentralElem];
    }
    // Fallback: derive from element color and current opacity
    const elemHex = visualSettings.elementColors[selectedCentralElem] || getElement(selectedCentralElem).color || '#0000af';
    const rgb = hexToRgb(elemHex);
    return { ...rgb, a: opacity };
  }, [elementColors, selectedCentralElem, visualSettings.elementColors, opacity]);

  // Commit changes to visualSettings (called on preview or OK)
  const commitPolySettings = (
    newEnabled = isPolyhedraEnabled,
    newCenterMode = centerMode,
    newCustomAtomIds = customAtomIds,
    newStyle = polyStyle,
    newCentral = centralElements,
    newSpec = specular,
    newShine = shininess,
    newOpac = opacity,
    newElemColors = elementColors,
    newShowEdges = showEdges,
    newEdgeWidth = edgeLineWidth,
    newEdgeColor = edgeColor
  ) => {
    const updatedPolySettings: PolyhedraSettings = {
      centerMode: newCenterMode,
      customAtomIds: newCustomAtomIds,
      style: newStyle,
      centralElements: newCentral,
      material: {
        specular: newSpec,
        shininess: newShine,
        opacity: newOpac
      },
      elementColors: newElemColors,
      edges: {
        show: newShowEdges,
        lineWidth: newEdgeWidth,
        color: newEdgeColor
      }
    };

    onUpdateVisualSettings({
      showPolyhedra: newEnabled && newStyle !== 1,
      polyhedraSettings: updatedPolySettings
    });
  };

  // Trigger live preview whenever polyhedra settings change
  useEffect(() => {
    if (previewEnabled && activeTab === 'polyhedra') {
      commitPolySettings();
    }
  }, [
    isPolyhedraEnabled,
    centerMode,
    customAtomIds,
    polyStyle, 
    centralElements, 
    specular, 
    shininess, 
    opacity, 
    elementColors, 
    showEdges, 
    edgeLineWidth, 
    edgeColor, 
    previewEnabled, 
    activeTab
  ]);

  const handleToggleCentralElement = (elem: string) => {
    const next = centralElements.includes(elem)
      ? centralElements.filter(e => e !== elem)
      : [...centralElements, elem];
    setCentralElements(next);
  };

  const handleUpdatePlaneRgba = (part: 'r' | 'g' | 'b' | 'a', val: number) => {
    const clamped = Math.max(0, Math.min(255, isNaN(val) ? 0 : val));
    const current = { ...currentPlaneRgba, [part]: clamped };
    setElementColors(prev => ({
      ...prev,
      [selectedCentralElem]: current
    }));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const x = parseFloat(newX);
    const y = parseFloat(newY);
    const z = parseFloat(newZ);
    if ([x, y, z].every(Number.isFinite) && newElem.trim()) {
      onAddAtom(newElem.trim(), { x, y, z });
    }
  };

  const handleOk = () => {
    if (bondError) { setActiveTab('bonds'); return; }
    if (bondsEdited) onUpdateVisualSettings({ bondSettings: bondDraft });
    commitPolySettings();
    onClose();
  };

  const handleApply = () => {
    if (bondError) { setActiveTab('bonds'); return; }
    if (bondsEdited) onUpdateVisualSettings({ bondSettings: bondDraft });
    commitPolySettings();
    setSaveMessage('已应用到视图；OK 确认，Cancel 恢复打开窗口前的状态。');
  };

  const handleCancel = () => {
    onCancelImport?.();
    // Revert visualSettings to initial state before modal was opened
    onUpdateVisualSettings(initialSettingsSnapshot);
    onRestoreStructure?.(initialStructureSnapshot);
    onClose();
  };
  const dialogRef = useModalDialog(handleCancel);

  const handleSaveAsDefault = () => {
    const toSave: PolyhedraSettings = {
      centerMode,
      customAtomIds,
      style: polyStyle,
      centralElements,
      material: {
        specular,
        shininess,
        opacity
      },
      elementColors,
      edges: {
        show: showEdges,
        lineWidth: edgeLineWidth,
        color: edgeColor
      }
    };
    if (savePolyhedraDefaults(toSave)) {
      setSaveMessage('已保存默认设置，下次打开网站时加载；特定位点编号不跨结构保存。');
    } else {
      setSaveMessage('浏览器未允许保存默认设置；当前设置仍可正常使用。');
    }
  };

  // Render SVG Icon for the 6 VESTA polyhedral styles
  const renderStyleIcon = (styleNum: PolyhedralStyle) => {
    const isSelected = polyStyle === styleNum;
    const activeBg = isSelected ? '#ffff99' : 'transparent'; // VESTA signature pale yellow active box

    return (
      <button
        key={styleNum}
        type="button"
        onClick={() => setPolyStyle(styleNum)}
        className={`w-12 h-14 rounded border flex flex-col items-center justify-center p-1 transition relative cursor-pointer ${
          isSelected 
            ? 'border-blue-600 shadow-xs' 
            : 'border-slate-300 hover:border-slate-400 bg-white'
        }`}
        style={{ backgroundColor: isSelected ? activeBg : undefined }}
        title={`样式 ${styleNum}: ${
          styleNum === 1 ? '球棍无面 (Atoms & Bonds)' :
          styleNum === 2 ? '全显 (多面体面 + 中心 + 顶点 + 内部键)' :
          styleNum === 3 ? '无内键 (多面体面 + 中心 + 顶点)' :
          styleNum === 4 ? '仅中心 (多面体面 + 中心原子)' :
          styleNum === 5 ? '纯多面体 (仅多面体面)' :
          '线框多面体 (Wireframe)'
        }`}
      >
        <svg viewBox="0 0 50 50" className="w-9 h-9 overflow-visible">
          {/* Style 1: Atoms & Bonds (No face) */}
          {styleNum === 1 && (
            <g>
              <line x1="25" y1="24" x2="25" y2="7" stroke="#64748b" strokeWidth="2.5" />
              <line x1="25" y1="24" x2="9" y2="35" stroke="#64748b" strokeWidth="2.5" />
              <line x1="25" y1="24" x2="20" y2="42" stroke="#64748b" strokeWidth="2.5" />
              <line x1="25" y1="24" x2="41" y2="34" stroke="#64748b" strokeWidth="2.5" />
              <circle cx="25" cy="24" r="5.2" fill="#2563eb" stroke="#1d4ed8" strokeWidth="0.8" />
              <circle cx="25" cy="7" r="3.6" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
              <circle cx="9" cy="35" r="3.6" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
              <circle cx="20" cy="42" r="3.6" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
              <circle cx="41" cy="34" r="3.6" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
            </g>
          )}

          {/* Style 2: Polyhedra + Center + Vertices + Bonds */}
          {styleNum === 2 && (
            <g>
              <polygon points="25,7 9,35 20,42" fill="#3b82f6" fillOpacity="0.55" stroke="#1d4ed8" strokeWidth="1.0" />
              <polygon points="25,7 20,42 41,34" fill="#60a5fa" fillOpacity="0.45" stroke="#1d4ed8" strokeWidth="1.0" />
              <line x1="25" y1="24" x2="25" y2="7" stroke="#475569" strokeWidth="2.0" />
              <line x1="25" y1="24" x2="9" y2="35" stroke="#475569" strokeWidth="2.0" />
              <line x1="25" y1="24" x2="20" y2="42" stroke="#475569" strokeWidth="2.0" />
              <line x1="25" y1="24" x2="41" y2="34" stroke="#475569" strokeWidth="2.0" />
              <circle cx="25" cy="24" r="4.6" fill="#1e40af" stroke="#172554" strokeWidth="0.6" />
              <circle cx="25" cy="7" r="3.3" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
              <circle cx="9" cy="35" r="3.3" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
              <circle cx="20" cy="42" r="3.3" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
              <circle cx="41" cy="34" r="3.3" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
            </g>
          )}

          {/* Style 3: Polyhedra + Center + Vertices (No internal bonds) */}
          {styleNum === 3 && (
            <g>
              <polygon points="25,7 9,35 20,42" fill="#3b82f6" fillOpacity="0.55" stroke="#1d4ed8" strokeWidth="1.0" />
              <polygon points="25,7 20,42 41,34" fill="#60a5fa" fillOpacity="0.45" stroke="#1d4ed8" strokeWidth="1.0" />
              <circle cx="25" cy="24" r="4.6" fill="#1e40af" stroke="#172554" strokeWidth="0.6" />
              <circle cx="25" cy="7" r="3.3" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
              <circle cx="9" cy="35" r="3.3" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
              <circle cx="20" cy="42" r="3.3" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
              <circle cx="41" cy="34" r="3.3" fill="#dc2626" stroke="#991b1b" strokeWidth="0.6" />
            </g>
          )}

          {/* Style 4: Polyhedra + Center (No vertex atoms) */}
          {styleNum === 4 && (
            <g>
              <polygon points="25,7 9,35 20,42" fill="#3b82f6" fillOpacity="0.65" stroke="#1d4ed8" strokeWidth="1.0" />
              <polygon points="25,7 20,42 41,34" fill="#60a5fa" fillOpacity="0.55" stroke="#1d4ed8" strokeWidth="1.0" />
              <circle cx="25" cy="24" r="5.0" fill="#1e40af" stroke="#172554" strokeWidth="0.6" />
            </g>
          )}

          {/* Style 5: Polyhedra only (Faces only) */}
          {styleNum === 5 && (
            <g>
              <polygon points="25,7 9,35 20,42" fill="#2563eb" fillOpacity="0.85" stroke="#1d4ed8" strokeWidth="1.0" />
              <polygon points="25,7 20,42 41,34" fill="#3b82f6" fillOpacity="0.75" stroke="#1d4ed8" strokeWidth="1.0" />
            </g>
          )}

          {/* Style 6: Wireframe / skeleton */}
          {styleNum === 6 && (
            <g>
              <line x1="25" y1="24" x2="25" y2="7" stroke="#475569" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="25" y1="24" x2="9" y2="35" stroke="#475569" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="25" y1="24" x2="20" y2="42" stroke="#475569" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="25" y1="24" x2="41" y2="34" stroke="#475569" strokeWidth="2.8" strokeLinecap="round" />
              <circle cx="25" cy="24" r="2.0" fill="#334155" />
            </g>
          )}
        </svg>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-2xs p-3 select-none pointer-events-auto">
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Structure properties"
        tabIndex={-1}
        className={`bg-[#f8fafc] border border-[#cbd5e1] rounded-lg shadow-2xl ${activeTab === 'bonds' ? 'max-w-[940px]' : 'max-w-xl'} w-full flex flex-col max-h-[92vh] text-xs text-slate-800 font-sans`}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`
        }}
      >
        
        {/* Title bar - VESTA Style (Draggable) */}
        <div 
          onMouseDown={onMouseDown}
          className="h-8 shrink-0 px-3 bg-[#e2e8f0] border-b border-[#cbd5e1] flex items-center justify-between rounded-t-lg cursor-move hover:bg-[#d8e0ea] transition"
          title="按住鼠标左键可拖动此窗口"
        >
          <span className="font-bold text-slate-800 text-[11px] tracking-wide truncate">
            {activeTab === 'bonds' ? 'Bonds' : 'Properties'} - {structure?.title || 'Structure'}
          </span>
          <button onClick={handleCancel} aria-label="取消并关闭属性窗口" className="text-slate-500 hover:text-slate-800 font-bold p-1 cursor-pointer shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Tab Navigation - Exact VESTA Tabs */}
        <div className="flex shrink-0 overflow-x-auto border-b border-[#cbd5e1] bg-[#f1f5f9] px-2 pt-1 gap-1 text-[11px]">
          {[
            { id: 'general', label: 'General' },
            { id: 'atoms', label: 'Atoms' },
            { id: 'bonds', label: 'Bonds' },
            { id: 'polyhedra', label: 'Polyhedra' },
            { id: 'isosurfaces', label: 'Isosurfaces' },
            { id: 'sections', label: 'Sections' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as PropertiesTab)}
              className={`shrink-0 px-3 py-1 rounded-t border-t border-l border-r transition font-semibold ${
                activeTab === tab.id
                  ? 'bg-white border-[#cbd5e1] -mb-[1px] text-slate-900 border-b-transparent shadow-2xs'
                  : 'bg-[#e2e8f0]/60 border-transparent text-slate-600 hover:bg-slate-200/80 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal body */}
        <div className="p-3.5 overflow-auto space-y-3.5 bg-white flex-1 min-h-0">
          {saveMessage && <p role="status" className="p-2 rounded bg-blue-50 text-blue-800 text-[11px]">{saveMessage}</p>}
          
          {/* ================= POLYHEDRA TAB ================= */}
          {activeTab === 'polyhedra' && (
            <div className="space-y-3 text-xs">
              
              {/* Master Switch: Enable / Disable Polyhedra */}
              <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPolyhedraEnabled}
                    onChange={(e) => setIsPolyhedraEnabled(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 text-xs">
                      启用配位多面体渲染 (Enable Coordination Polyhedra)
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      取消勾选将彻底关闭 3D 多面体显示，保留球棍/CPK 洁净视图
                    </span>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => setIsPolyhedraEnabled(!isPolyhedraEnabled)}
                  className={`text-[10px] font-mono px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                    isPolyhedraEnabled 
                      ? 'bg-blue-600 text-white shadow-2xs hover:bg-blue-700' 
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {isPolyhedraEnabled ? '● ON (开启)' : '○ OFF (关闭)'}
                </button>
              </div>

              {/* Group 1: Material */}
              <fieldset className="border border-[#cbd5e1] rounded p-2.5 bg-[#fafafa]">
                <legend className="px-1.5 font-bold text-slate-700 text-[11px]">Material (材质光泽)</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  
                  {/* Specular */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 text-[11px] w-16">Specular:</span>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={specular.r}
                      onChange={(e) => setSpecular(prev => ({ ...prev, r: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) }))}
                      className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={specular.g}
                      onChange={(e) => setSpecular(prev => ({ ...prev, g: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) }))}
                      className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={specular.b}
                      onChange={(e) => setSpecular(prev => ({ ...prev, b: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) }))}
                      className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <div 
                      className="w-5 h-5 rounded border border-[#cbd5e1] shadow-2xs ml-1"
                      style={{ backgroundColor: rgbToHex(specular.r, specular.g, specular.b) }}
                    />
                  </div>

                  <button type="button" onClick={() => { setAtomSpecular({ r: 204, g: 204, b: 204 }); setAtomShininess(20); onUpdateVisualSettings({ atomSpecular: undefined, atomShininess: undefined }); }} className="rounded border border-slate-300 bg-white px-2 py-1">恢复材质预设</button>
                  {/* Shininess */}
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-slate-600 text-[11px]">Shininess (%):</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={shininess}
                      onChange={(e) => setShininess(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      className="w-14 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={shininess}
                      onChange={(e) => setShininess(parseInt(e.target.value))}
                      className="w-20 h-1 bg-slate-200 rounded cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Opacity */}
                  <div className="flex items-center gap-2 md:col-span-2 justify-end pt-1 border-t border-slate-200/60">
                    <span className="text-slate-600 text-[11px]">Opacity (0 ~ 255):</span>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={opacity}
                      onChange={(e) => setOpacity(Math.max(0, Math.min(255, parseInt(e.target.value) || 0)))}
                      className="w-14 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={opacity}
                      onChange={(e) => setOpacity(parseInt(e.target.value))}
                      className="w-32 h-1 bg-slate-200 rounded cursor-pointer accent-blue-600"
                    />
                    <span className="text-[10px] text-slate-500 font-mono w-12 text-right">
                      {Math.round((opacity / 255) * 100)}%
                    </span>
                  </div>

                </div>
              </fieldset>

              {/* Group 2: Polyhedral style */}
              <fieldset className="border border-[#cbd5e1] rounded p-2.5 bg-[#fafafa]">
                <legend className="px-1.5 font-bold text-slate-700 text-[11px]">Polyhedral style (表现样式)</legend>
                <div className="flex items-center justify-between gap-1.5 py-1 px-1 bg-white border border-[#e2e8f0] rounded">
                  {([1, 2, 3, 4, 5, 6] as PolyhedralStyle[]).map(num => renderStyleIcon(num))}
                </div>
              </fieldset>

              {/* Group 3: Planes (Central Atom & Colors) */}
              <fieldset className="border border-[#cbd5e1] rounded p-2.5 bg-[#fafafa] space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <legend className="px-1 font-bold text-slate-700 text-[11px]">Planes (多面体面与中心原子)</legend>
                  
                  {/* Mode switcher: All elements vs Specific atoms */}
                  <div className="flex rounded border border-[#cbd5e1] bg-white p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setCenterMode('all')}
                      className={`px-2.5 py-0.5 rounded transition cursor-pointer font-medium ${
                        centerMode === 'all'
                          ? 'bg-blue-50 font-bold text-blue-700 border border-blue-200 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      按元素批量全部显示
                    </button>
                    <button
                      type="button"
                      onClick={() => setCenterMode('custom')}
                      className={`px-2.5 py-0.5 rounded transition cursor-pointer font-medium ${
                        centerMode === 'custom'
                          ? 'bg-blue-50 font-bold text-blue-700 border border-blue-200 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      指定特定原子单独显示
                    </button>
                  </div>
                </div>

                {centerMode === 'custom' ? (
                  /* --- MODE 1: CUSTOM ATOMS ONLY --- */
                  <div className="space-y-2 bg-white p-2.5 rounded border border-[#e2e8f0]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-[11px]">
                        当前指定中心原子列表 ({customAtomIds.length} 个):
                      </span>
                      {customAtomIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCustomAtomIds([])}
                          className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                        >
                          清空列表
                        </button>
                      )}
                    </div>

                    {/* Chips of designated center atoms */}
                    {customAtomIds.length === 0 ? (
                      <div className="text-[11px] text-slate-400 p-2.5 bg-slate-50 rounded border border-dashed border-slate-200 text-center">
                        暂未指定任何中心原子。请点击下方按钮添加当前选中原子，或输入原子编号添加。
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-slate-50 rounded border border-slate-200">
                        {customAtomIds.map(id => {
                          const atom = structure?.atoms.find(a => a.id === id);
                          const elem = atom?.element || '?';
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-blue-300 text-blue-800 rounded-md font-mono text-[11px] shadow-2xs font-semibold"
                            >
                              <span>#{id} {elem}</span>
                              <button
                                type="button"
                                onClick={() => setCustomAtomIds(customAtomIds.filter(x => x !== id))}
                                className="text-slate-400 hover:text-rose-600 font-bold text-[12px] leading-none cursor-pointer"
                                title="移除此中心原子"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick Add Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                      {selectedAtoms && selectedAtoms.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const newIds = new Set(customAtomIds);
                            selectedAtoms.forEach(a => newIds.add(a.id));
                            setCustomAtomIds(Array.from(newIds));
                          }}
                          className="px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        >
                          <span>+ 添加所有选中的 {selectedAtoms.length} 个原子为多面体中心</span>
                        </button>
                      ) : selectedAtom ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!customAtomIds.includes(selectedAtom.id)) {
                              setCustomAtomIds([...customAtomIds, selectedAtom.id]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border ${
                            customAtomIds.includes(selectedAtom.id)
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          <span>{customAtomIds.includes(selectedAtom.id) ? '✓ 当前已选中原子已在列表' : `+ 添加当前选中原子 (#${selectedAtom.id} ${selectedAtom.element})`}</span>
                        </button>
                      ) : null}

                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="number"
                          placeholder="原子编号 ID"
                          value={inputAtomId}
                          onChange={(e) => setInputAtomId(e.target.value)}
                          className="w-24 bg-white border border-[#cbd5e1] rounded px-1.5 py-0.5 text-center font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = parseInt(inputAtomId);
                            if (!isNaN(val) && val >= 0 && !customAtomIds.includes(val)) {
                              setCustomAtomIds([...customAtomIds, val]);
                              setInputAtomId('');
                            }
                          }}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-[#cbd5e1] rounded text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          + 添加
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* --- MODE 2: ALL ATOMS OF SELECTED ELEMENTS --- */
                  <div className="space-y-2">
                    {/* Central atom dropdown & enable toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 rounded border border-[#e2e8f0]">
                      <div className="flex items-center gap-2">
                        <label className="text-slate-700 font-semibold text-[11px]">Central atom (中心原子):</label>
                        <select
                          value={selectedCentralElem}
                          onChange={(e) => setSelectedCentralElem(e.target.value)}
                          className="bg-white border border-[#cbd5e1] rounded px-2.5 py-1 text-slate-800 font-bold font-mono text-[11px] cursor-pointer"
                        >
                          {structureElements.map(el => (
                            <option key={el} value={el}>
                              {el} - {getElement(el).nameCn} ({getElement(el).name})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Checkbox to toggle whether selectedCentralElem generates polyhedra */}
                      <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100 transition">
                        <input
                          type="checkbox"
                          checked={centralElements.includes(selectedCentralElem)}
                          onChange={() => handleToggleCentralElement(selectedCentralElem)}
                          className="rounded accent-blue-600 cursor-pointer"
                        />
                        <span className="text-[11px] font-semibold text-slate-800">
                          启用 {selectedCentralElem} 作为多面体中心
                        </span>
                      </label>
                    </div>

                    {/* Active Central Elements Pill List */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      <span className="text-slate-500 font-medium">当前已选中心原子:</span>
                      {structureElements.map(el => {
                        const isActive = centralElements.includes(el);
                        return (
                          <button
                            key={el}
                            type="button"
                            onClick={() => handleToggleCentralElement(el)}
                            className={`px-2 py-0.5 rounded-full border flex items-center gap-1 transition cursor-pointer font-bold ${
                              isActive 
                                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                                : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <span>{el}</span>
                            {isActive ? <Check size={10} /> : <span className="text-[9px]">+</span>}
                          </button>
                        );
                      })}
                      <div className="ml-auto flex gap-1">
                        <button
                          type="button"
                          onClick={() => setCentralElements(structureElements.filter(e => ['Ti', 'Co', 'Fe', 'Ni', 'Cu', 'Mn', 'Cr', 'V', 'Mo', 'Zr', 'Pt', 'Si', 'Al'].includes(e)))}
                          className="text-[10px] text-blue-600 hover:underline px-1 cursor-pointer"
                        >
                          仅金属
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setCentralElements([...structureElements])}
                          className="text-[10px] text-blue-600 hover:underline px-1 cursor-pointer"
                        >
                          全选
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Color (RGBA) Steppers */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 text-[11px] font-medium">Color (RGBA):</span>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={currentPlaneRgba.r}
                      onChange={(e) => handleUpdatePlaneRgba('r', parseInt(e.target.value))}
                      className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                      title="Red (0 ~ 255)"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={currentPlaneRgba.g}
                      onChange={(e) => handleUpdatePlaneRgba('g', parseInt(e.target.value))}
                      className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                      title="Green (0 ~ 255)"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={currentPlaneRgba.b}
                      onChange={(e) => handleUpdatePlaneRgba('b', parseInt(e.target.value))}
                      className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                      title="Blue (0 ~ 255)"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={currentPlaneRgba.a}
                      onChange={(e) => handleUpdatePlaneRgba('a', parseInt(e.target.value))}
                      className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                      title="Alpha (0 ~ 255)"
                    />
                  </div>

                  {/* Dual swatches: solid + alpha checkerboard */}
                  <div className="flex items-center gap-2">
                    {/* Solid Swatch */}
                    <div 
                      className="w-6 h-6 rounded border border-slate-300 shadow-2xs"
                      style={{ backgroundColor: rgbToHex(currentPlaneRgba.r, currentPlaneRgba.g, currentPlaneRgba.b) }}
                      title="固体颜色 (RGB)"
                    />
                    {/* Alpha Checkerboard Swatch */}
                    <div 
                      className="w-6 h-6 rounded border border-slate-300 shadow-2xs relative overflow-hidden"
                      style={{
                        backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                      }}
                      title="带透明度颜色 (RGBA)"
                    >
                      <div 
                        className="absolute inset-0"
                        style={{
                          backgroundColor: `rgba(${currentPlaneRgba.r}, ${currentPlaneRgba.g}, ${currentPlaneRgba.b}, ${currentPlaneRgba.a / 255})`
                        }}
                      />
                    </div>

                    <input
                      type="color"
                      value={rgbToHex(currentPlaneRgba.r, currentPlaneRgba.g, currentPlaneRgba.b)}
                      onChange={(e) => {
                        const rgb = hexToRgb(e.target.value);
                        setElementColors(prev => ({
                          ...prev,
                          [selectedCentralElem]: { ...rgb, a: currentPlaneRgba.a }
                        }));
                      }}
                      className="w-6 h-6 rounded cursor-pointer border border-[#cbd5e1] p-0"
                      title="调色盘选取颜色"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const elemColor = visualSettings.elementColors[selectedCentralElem] || getElement(selectedCentralElem).color || '#2563eb';
                        const rgb = hexToRgb(elemColor);
                        setElementColors(prev => ({
                          ...prev,
                          [selectedCentralElem]: { ...rgb, a: opacity }
                        }));
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-[#cbd5e1] text-[10px] text-slate-600 transition"
                      title="重置为元素默认颜色"
                    >
                      默认
                    </button>
                  </div>
                </div>

              </fieldset>

              {/* Group 4: Edges */}
              <fieldset className="border border-[#cbd5e1] rounded p-2.5 bg-[#fafafa]">
                <legend className="px-1.5 font-bold text-slate-700 text-[11px]">Edges (多面体边缘线)</legend>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  
                  {/* Show edges checkbox */}
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showEdges}
                      onChange={(e) => setShowEdges(e.target.checked)}
                      className="rounded accent-blue-600 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-800 text-[11px]">Show polyhedral edges</span>
                  </label>

                  {/* Line width */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 text-[11px]">Line width:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="5.0"
                      value={edgeLineWidth}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value)) setEdgeLineWidth(Math.max(0.1, Math.min(10, value)));
                      }}
                      className="w-14 bg-white border border-[#cbd5e1] rounded px-1.5 py-0.5 text-center font-mono text-[11px]"
                    />
                  </div>

                  {/* Color (RGB) */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 text-[11px]">Color (RGB):</span>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={edgeColor.r}
                      onChange={(e) => setEdgeColor(prev => ({ ...prev, r: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) }))}
                      className="w-11 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={edgeColor.g}
                      onChange={(e) => setEdgeColor(prev => ({ ...prev, g: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) }))}
                      className="w-11 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={edgeColor.b}
                      onChange={(e) => setEdgeColor(prev => ({ ...prev, b: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) }))}
                      className="w-11 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <div 
                      className="w-5 h-5 rounded border border-[#cbd5e1] shadow-2xs ml-1"
                      style={{ backgroundColor: rgbToHex(edgeColor.r, edgeColor.g, edgeColor.b) }}
                    />
                  </div>

                </div>
              </fieldset>

            </div>
          )}

          {/* ================= ATOMS TAB (VESTA Atoms Properties) ================= */}
          {activeTab === 'atoms' && (
            <div className="space-y-3 text-xs">
              <p role="note" className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-900">
                高光参数修改后应用自定义光照材质；细分、隐藏孤立原子、半径类型、标签 Z 偏移和轮廓宽度均实时预览。热位移椭球采用 CIF U/B 数据的 50% 概率面，无数据的位点保留普通球。离子半径可录入已核实的半径、价态与配位数；未指定元素仍使用默认显示半径。
              </p>
              
              {/* Group 1: Material (Specular & Shininess) */}
              <fieldset className="border border-[#cbd5e1] rounded p-2.5 bg-[#fafafa]">
                <legend className="px-1.5 font-bold text-slate-700 text-[11px]">Material (材质与高光)</legend>
                <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
                  
                  {/* Specular R, G, B */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 text-[11px] w-16">Specular:</span>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={atomSpecular.r}
                      onChange={(e) => updateAtomSpecular('r', Number(e.target.value))}
                      className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={atomSpecular.g}
                      onChange={(e) => updateAtomSpecular('g', Number(e.target.value))}
                      className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={atomSpecular.b}
                      onChange={(e) => updateAtomSpecular('b', Number(e.target.value))}
                      className="w-12 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <div 
                      className="w-5 h-5 rounded border border-[#cbd5e1] shadow-2xs ml-1"
                      style={{ backgroundColor: rgbToHex(atomSpecular.r, atomSpecular.g, atomSpecular.b) }}
                    />
                  </div>

                  {/* Shininess */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-[11px]">Shininess (%):</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={atomShininess}
                      onChange={(e) => updateAtomShine(Number(e.target.value))}
                      className="w-14 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={atomShininess}
                      onChange={(e) => updateAtomShine(Number(e.target.value))}
                      className="w-20 h-1 bg-slate-200 rounded cursor-pointer accent-blue-600"
                    />
                  </div>

                </div>
              </fieldset>

              {/* Group 2 & 3: Resolution & Radius and color */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                
                {/* Resolution (Left Column) */}
                <fieldset className="md:col-span-4 border border-[#cbd5e1] rounded p-2.5 bg-[#fafafa]">
                  <legend className="px-1.5 font-bold text-slate-700 text-[11px]">Resolution (细分分辨率)</legend>
                  <div className="space-y-2 text-[11px] pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Stacks:</span>
                      <input
                        type="number"
                        min="8"
                        max="64"
                        aria-label="原子 Stacks" value={atomStacks}
                        onChange={(e) => updateResolution('atomStacks', Number(e.target.value))}
                        className="w-14 bg-white border border-[#cbd5e1] rounded px-1.5 py-0.5 text-center font-mono text-[11px]"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Slices:</span>
                      <input
                        type="number"
                        min="8"
                        max="64"
                        aria-label="原子 Slices" value={atomSlices}
                        onChange={(e) => updateResolution('atomSlices', Number(e.target.value))}
                        className="w-14 bg-white border border-[#cbd5e1] rounded px-1.5 py-0.5 text-center font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Radius and color (Right Column - VESTA Core Element Switcher) */}
                <fieldset className="md:col-span-8 border border-[#cbd5e1] rounded p-2.5 bg-[#fafafa]">
                  <legend className="px-1.5 font-bold text-slate-700 text-[11px]">Radius and color (元素/位点半径与颜色)</legend>
                  <div className="space-y-2 text-[11px]">
                    
                    {/* Top Row: Element Combobox Dropdown + Radius */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        {/* Element Dropdown: user can freely switch between ANY elements in structure without closing dialog! */}
                        <select
                          value={selectedAtomElem}
                          onChange={(e) => setSelectedAtomElem(e.target.value)}
                          className="bg-white border border-[#cbd5e1] rounded px-2 py-1 font-bold text-slate-900 text-xs shadow-2xs focus:outline-none focus:border-blue-500 cursor-pointer min-w-[120px]"
                        >
                          <optgroup label="当前晶体中的元素 (In Structure):">
                            {structureElements.map(elem => (
                              <option key={elem} value={elem}>
                                {elem} ({getElement(elem).nameCn || getElement(elem).name})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="其他常用元素 (Other Elements):">
                            {['H', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I', 'Li', 'Na', 'K', 'Mg', 'Ca', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Mo', 'Ru', 'Rh', 'Pd', 'Ag', 'Pt', 'Au', 'Si', 'Al']
                              .filter(e => !structureElements.includes(e))
                              .map(elem => (
                                <option key={elem} value={elem}>
                                  {elem} ({getElement(elem).nameCn || getElement(elem).name})
                                </option>
                              ))}
                          </optgroup>
                        </select>

                        {/* Scope Switch: Single Atom vs All atoms of this Element */}
                        <div className="flex rounded border border-[#cbd5e1] bg-white p-0.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setColorScope('element')}
                            className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                              colorScope === 'element' ? 'bg-[#e2e8f0] font-bold text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="修改将应用至当前选中的元素（全部原子）"
                          >
                            按元素全部
                          </button>
                          <button
                            type="button"
                            onClick={() => setColorScope('single')}
                            disabled={!selectedAtom || selectedAtom.element !== selectedAtomElem}
                            className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                              colorScope === 'single' ? 'bg-[#e2e8f0] font-bold text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="仅修改当前在画布选中的单个原子位点"
                          >
                            {selectedAtom && selectedAtom.element === selectedAtomElem ? `位点 #${selectedAtom.id}` : '单点独立'}
                          </button>
                        </div>
                      </div>

                      {/* Radius Input */}
                      <div className="flex items-center gap-1">
                        <span className="text-slate-600 font-medium">Radius:</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0.10"
                          max="5.00"
                          aria-label="原子显示半径"
                          value={currentAtomRadius}
                          onChange={(e) => handleAtomRadiusChange(Number(e.target.value))}
                          className="w-16 bg-white border border-[#cbd5e1] rounded px-1.5 py-0.5 text-center font-mono font-bold text-slate-800"
                        />
                        <span className="text-slate-400 text-[10px]">Å</span>
                      </div>
                    </div>

                    {/* Bottom Row: Color: [ R ] [ G ] [ B ] [ Swatch ] */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600 font-medium">Color:</span>
                        <input
                          type="number"
                          min="0"
                          max="255"
                          value={currentAtomColorRgb.r}
                          onChange={(e) => handleAtomRgbChange('r', parseInt(e.target.value))}
                          className="w-11 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                          title="Red (0 ~ 255)"
                        />
                        <input
                          type="number"
                          min="0"
                          max="255"
                          value={currentAtomColorRgb.g}
                          onChange={(e) => handleAtomRgbChange('g', parseInt(e.target.value))}
                          className="w-11 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                          title="Green (0 ~ 255)"
                        />
                        <input
                          type="number"
                          min="0"
                          max="255"
                          value={currentAtomColorRgb.b}
                          onChange={(e) => handleAtomRgbChange('b', parseInt(e.target.value))}
                          className="w-11 bg-white border border-[#cbd5e1] rounded px-1 py-0.5 text-center font-mono text-[11px]"
                          title="Blue (0 ~ 255)"
                        />

                        {/* Interactive Color Swatch */}
                        <div className="relative flex items-center ml-0.5">
                          <input
                            type="color"
                            value={currentAtomColor}
                            onChange={(e) => handleAtomColorChange(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border border-[#cbd5e1] p-0"
                            title="点击打开取色器"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleResetAtomDefault}
                          className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-[#cbd5e1] text-[10px] text-slate-600 transition cursor-pointer"
                          title="恢复该元素的默认颜色与半径"
                        >
                          默认 (Reset)
                        </button>
                      </div>
                    </div>

                    {/* VESTA Palette Swatches */}
                    <div className="flex items-center gap-1 pt-1 overflow-x-auto light-scrollbar">
                      <span className="text-[10px] text-slate-400 shrink-0">预设色:</span>
                      {VESTA_SWATCHES.map(s => (
                        <button
                          key={s.color}
                          type="button"
                          onClick={() => handleAtomColorChange(s.color)}
                          className="w-4 h-4 rounded border border-[#cbd5e1] shadow-2xs hover:scale-115 transition shrink-0 cursor-pointer"
                          style={{ backgroundColor: s.color }}
                          title={s.name}
                        />
                      ))}
                    </div>

                  </div>
                </fieldset>

              </div>

              {/* Group 3: Atom style (Show as balls / displacement ellipsoids) */}
              <fieldset className="border border-[#cbd5e1] rounded p-2.5 bg-[#fafafa]">
                <legend className="px-1.5 font-bold text-slate-700 text-[11px]">Atom style (显示模式与样式)</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  
                  {/* Left Column: Radio Modes */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                      <input
                        type="radio"
                        name="atomStyleOption"
                        checked={atomStyleMode === 'balls'}
                        onChange={() => { setAtomStyleMode('balls'); onUpdateVisualSettings({ atomStyle: 'balls' }); }}
                        className="accent-blue-600 cursor-pointer"
                      />
                      <span>Show as balls (球体模型)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                      <input
                        type="radio"
                        name="atomStyleOption"
                        checked={atomStyleMode === 'ellipsoids'}
                        onChange={() => { setAtomStyleMode('ellipsoids'); onUpdateVisualSettings({ atomStyle: 'ellipsoids' }); }}
                        className="accent-blue-600 cursor-pointer"
                      />
                      <span>Show as displacement ellipsoids (热位移椭球)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-600 pt-1 border-t border-slate-200/60">
                      <input
                        type="checkbox"
                        checked={hideNonbonding}
                        onChange={(e) => { setHideNonbonding(e.target.checked); onUpdateVisualSettings({ hideNonbonding: e.target.checked }); }}
                        className="rounded accent-blue-600 cursor-pointer"
                      />
                      <span>Hide nonbonding atoms (隐藏孤立无键原子)</span>
                    </label>
                  </div>

                  {/* Right Column: Radii type & Outline */}
                  <div className="space-y-1.5 border-l border-slate-200/70 pl-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Radii type:</span>
                      <select
                        value={radiiType}
                        aria-label="半径类型"
                        onChange={(e) => { setRadiiType(e.target.value as 'atomic' | 'covalent' | 'vdw' | 'ionic'); onUpdateVisualSettings({ radiiType: e.target.value as 'atomic' | 'covalent' | 'vdw' | 'ionic' }); }}
                        className="bg-white border border-[#cbd5e1] rounded px-2 py-0.5 text-[11px] font-medium text-slate-800 cursor-pointer"
                      >
                        <option value="atomic">Atomic（默认显示半径）</option>
                        <option value="covalent">Covalent（共价半径）</option>
                        <option value="ionic">Ionic（指定价态/配位半径）</option>
                        <option value="vdw">van der Waals (范德华半径)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Outline width:</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="5.0"
                        aria-label="轮廓宽度" value={visualSettings.showOutline ? (visualSettings.outlineWidth ?? 2) : 0}
                        onChange={(e) => { const value = Number(e.target.value); if (Number.isFinite(value) && value >= 0 && value <= 5) onUpdateVisualSettings({ showOutline: value > 0, outlineWidth: value }); }}
                        className="w-14 bg-white border border-[#cbd5e1] rounded px-1.5 py-0.5 text-center font-mono text-[11px]"
                      />
                    </div>
                  </div>

                </div>
              </fieldset>

              {radiiType === 'ionic' && <IonicRadiusEditor key={selectedAtomElem} element={selectedAtomElem} settings={visualSettings} update={onUpdateVisualSettings}/>}
              {/* Group 4: Label (Names of sites, offset) */}
              <fieldset className="border border-[#cbd5e1] rounded p-2.5 bg-[#fafafa]">
                <legend className="px-1.5 font-bold text-slate-700 text-[11px]">Label (原子标注与位点文字)</legend>
                <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Type:</span>
                    <select
                      value={labelType}
                      onChange={(e) => {
                        setLabelType(e.target.value);
                        onUpdateVisualSettings({ showLabels: e.target.value as any });
                      }}
                      className="bg-white border border-[#cbd5e1] rounded px-2 py-1 text-[11px] font-semibold text-slate-800 cursor-pointer"
                    >
                      <option value="none">None (无标注)</option>
                      <option value="element">Chemical elements (元素符号, 如 P, Mo)</option>
                      <option value="id">Names of sites (位点序号, 如 #1, #2)</option>
                      <option value="element+id">Elements and site numbers (符号+序号, 如 P1, Mo2)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600">Offset along z direction (Å):</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="5.0"
                      value={labelOffsetZ}
                      aria-label="标签 Z 偏移" onChange={(e) => { const value = Number(e.target.value); if (Number.isFinite(value) && value >= 0 && value <= 5) { setLabelOffsetZ(value); onUpdateVisualSettings({ labelOffsetZ: value }); } }}
                      className="w-14 bg-white border border-[#cbd5e1] rounded px-1.5 py-0.5 text-center font-mono text-[11px]"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Optional Selected Atom Detailed Coordinates & Actions */}
              {selectedAtom && (
                <div className="border border-blue-200 rounded p-2 bg-blue-50/50 space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900">
                      已选原子: #{selectedAtom.id} ({selectedAtom.element})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={onOpenPeriodicTable}
                        className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-[#cbd5e1] font-semibold text-slate-700 transition cursor-pointer"
                      >
                        周期表替换...
                      </button>
                      <button
                        type="button"
                        onClick={onDeleteSelected}
                        className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 font-semibold transition cursor-pointer"
                      >
                        删除 (空位)
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-slate-600 grid grid-cols-3 gap-1 bg-white p-1 rounded border border-blue-200/60 text-center">
                    <span>x: {selectedAtom.fractional.x.toFixed(4)}</span>
                    <span>y: {selectedAtom.fractional.y.toFixed(4)}</span>
                    <span>z: {selectedAtom.fractional.z.toFixed(4)}</span>
                  </div>
                </div>
              )}

              {/* Add New Atom Form */}
              <form onSubmit={handleAddSubmit} className="border border-[#cbd5e1] rounded p-3 bg-[#f8fafc] space-y-2">
                <span className="font-bold text-slate-700">Add New Atom (添加新原子):</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">元素:</label>
                    <input
                      type="text"
                      value={newElem}
                      onChange={(e) => setNewElem(e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded p-1 text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">frac x:</label>
                    <input
                      type="text"
                      value={newX}
                      onChange={(e) => setNewX(e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded p-1 text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">frac y:</label>
                    <input
                      type="text"
                      value={newY}
                      onChange={(e) => setNewY(e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded p-1 text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">frac z:</label>
                    <input
                      type="text"
                      value={newZ}
                      onChange={(e) => setNewZ(e.target.value)}
                      className="w-full bg-white border border-[#cbd5e1] rounded p-1 text-center font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-1 rounded bg-white hover:bg-slate-100 border border-[#cbd5e1] font-semibold text-slate-800 transition cursor-pointer"
                >
                  + 确认添加此原子至晶胞
                </button>
              </form>
            </div>
          )}

          {/* ================= BONDS TAB ================= */}
          {activeTab === 'bonds' && (
            <div className="space-y-3">
              <BondEditor structure={structure} settings={bondDraft} tolerance={visualSettings.bondTolerance}
                showBoundaryAtoms={visualSettings.showBoundaryAtoms} onBoundaryChange={showBoundaryAtoms => onUpdateVisualSettings({ showBoundaryAtoms })}
                onChange={settings => { setBondDraft(settings); setBondsEdited(true); setSaveMessage(null); }} error={bondError} />
              <fieldset className="border border-[#cbd5e1] rounded p-3 bg-[#fafafa] space-y-3">
                <legend className="px-1.5 font-bold text-slate-700 text-[11px]">Bonds Specification (化学键规格)</legend>
                
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">自动成键容差 (Tolerance):{bondDraft.enabled && <span className="ml-1 font-normal text-slate-500">仅自动模式</span>}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{visualSettings.bondTolerance.toFixed(2)}</span>
                    <input
                      type="range"
                      min="0.8"
                      max="1.6"
                      step="0.05"
                      disabled={bondDraft.enabled}
                      value={visualSettings.bondTolerance}
                      onChange={(e) => onUpdateVisualSettings({ bondTolerance: parseFloat(e.target.value) })}
                      className="w-28 h-1 bg-slate-200 rounded cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">单键粗细 (Bond Radius):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{visualSettings.bondRadius.toFixed(3)} Å</span>
                    <input
                      type="range"
                      min="0.02"
                      max="0.15"
                      step="0.005"
                      value={visualSettings.bondRadius}
                      onChange={(e) => onUpdateVisualSettings({ bondRadius: parseFloat(e.target.value) })}
                      className="w-28 h-1 bg-slate-200 rounded cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">键样式 (Bond Style):</span>
                  <select
                    value={visualSettings.bondStyle}
                    onChange={(e) => onUpdateVisualSettings({ bondStyle: e.target.value as any })}
                    className="bg-white border border-[#cbd5e1] rounded px-2 py-0.5 text-slate-800 font-medium"
                  >
                    <option value="aromatic">Aromatic (一实一虚)</option>
                    <option value="tapered">Tapered (渐变锥形)</option>
                    <option value="parallel">Parallel (双实线)</option>
                    <option value="single">Single (标准单键)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">键配色 (Bond Color Mode):</span>
                  <select
                    value={visualSettings.bondColorMode}
                    onChange={(e) => onUpdateVisualSettings({ bondColorMode: e.target.value as any })}
                    className="bg-white border border-[#cbd5e1] rounded px-2 py-0.5 text-slate-800 font-medium"
                  >
                    <option value="uniform">Uniform Slate (统一灰蓝)</option>
                    <option value="dark">Dark Ink (深墨色出版风)</option>
                    <option value="split">By Element (两端原子分色)</option>
                  </select>
                </div>
              </fieldset>
            </div>
          )}

          {/* ================= GENERAL TAB ================= */}
          {activeTab === 'general' && (
            <div className="space-y-3">
              <div className="border border-[#cbd5e1] rounded p-3 bg-[#fafafa] space-y-2 text-[11px]">
                <div className="font-bold text-slate-800 border-b pb-1">Structure Summary (晶体基本信息)</div>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>名称 / 标题: <span className="font-semibold text-slate-800">{structure?.title || '未命名'}</span></div>
                  <div>总原子数: <span className="font-semibold text-slate-800">{structure?.atoms.length || 0}</span></div>
                  <div>格式类型: <span className="font-mono uppercase text-slate-800">{structure?.format || '未知'}</span></div>
                  <div>坐标系: <span className="font-mono text-slate-800">{structure?.coordType || 'Direct'}</span></div>
                  <div>周期性体系: <span className="font-semibold text-slate-800">{structure?.isPeriodic ? '是 (Periodic)' : '否 (Molecular)'}</span></div>
                </div>

                {structure?.lattice && (
                  <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                    <div className="font-bold text-slate-700">Lattice Parameters (晶胞常数):</div>
                    <div className="grid grid-cols-3 gap-1.5 font-mono text-center bg-white p-2 rounded border border-slate-200">
                      <div>a = {structure.lattice.a.toFixed(4)} Å</div>
                      <div>b = {structure.lattice.b.toFixed(4)} Å</div>
                      <div>c = {structure.lattice.c.toFixed(4)} Å</div>
                      <div>α = {structure.lattice.alpha.toFixed(2)}°</div>
                      <div>β = {structure.lattice.beta.toFixed(2)}°</div>
                      <div>γ = {structure.lattice.gamma.toFixed(2)}°</div>
                    </div>
                    <div className="text-right text-[10px] text-slate-500 pt-1">
                      Unit Cell Volume: {structure.lattice.volume.toFixed(3)} Å³
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= ISOSURFACES & SECTIONS TABS ================= */}
          {(activeTab === 'isosurfaces' || activeTab === 'sections') && (
            <VolumePanel tab={activeTab} structure={structure} settings={visualSettings} update={onUpdateVisualSettings} restore={onRestoreStructure} upload={onFileUpload}/>
          )}

        </div>

        {/* Footer Actions - Matching VESTA */}
        <div className="min-h-[44px] shrink-0 p-2 bg-[#f1f5f9] border-t border-[#cbd5e1] flex flex-wrap gap-2 items-center justify-between rounded-b-lg">
          
          {/* Live Preview Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-semibold text-[11px]">
            <input
              type="checkbox"
              checked={previewEnabled}
              onChange={(e) => setPreviewEnabled(e.target.checked)}
              className="rounded accent-blue-600 cursor-pointer"
            />
            <span>Polyhedra Preview (多面体预览)</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOk}
              disabled={!!bondError}
              className="px-4 py-1 rounded bg-white hover:bg-slate-100 border border-[#cbd5e1] font-semibold text-slate-800 shadow-2xs cursor-pointer transition disabled:opacity-40"
            >
              OK
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 rounded bg-white hover:bg-slate-100 border border-[#cbd5e1] text-slate-700 shadow-2xs cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!!bondError}
              className="px-3 py-1 rounded bg-white hover:bg-slate-100 border border-[#cbd5e1] text-slate-700 shadow-2xs cursor-pointer transition disabled:opacity-40"
            >
              Apply
            </button>
            {activeTab !== 'bonds' && <button
              onClick={handleSaveAsDefault}
              className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-[#cbd5e1] text-slate-700 text-[11px] shadow-2xs cursor-pointer transition"
              title="保存当前设置为全局默认配置"
            >
              Save as Default
            </button>}
          </div>

        </div>

      </div>
    </div>
  );
};

export const VestaPropertiesModal: React.FC<VestaPropertiesModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <VestaPropertiesModalContent {...props} />;
};
