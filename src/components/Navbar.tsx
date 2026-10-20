import React, { useRef } from 'react';
import { 
  Atom, 
  Upload, 
  Download, 
  RotateCcw, 
  Layers, 
  Camera, 
  ChevronDown 
} from 'lucide-react';
import { PRESET_STRUCTURES } from '../constants/presets';

interface NavbarProps {
  currentTitle: string;
  onSelectPreset: (presetId: string) => void;
  onFileUpload: (file: File) => void;
  onExport: (format: 'cif' | 'poscar' | 'xyz' | 'png') => void;
  onViewAlong: (axis: 'a' | 'b' | 'c' | 'reset') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTitle,
  onSelectPreset,
  onFileUpload,
  onExport,
  onViewAlong
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [presetOpen, setPresetOpen] = React.useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between z-30 select-none shadow-xs">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
          <Atom size={18} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-slate-900">
              CrystalCraft
            </span>
            <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              LightCone × VESTA
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate max-w-[260px]" title={currentTitle}>
            {currentTitle || '未载入结构'}
          </p>
        </div>
      </div>

      {/* Preset Library & Quick Views */}
      <div className="flex items-center gap-3">
        {/* Preset Selector */}
        <div className="relative">
          <button
            onClick={() => { setPresetOpen(!presetOpen); setExportOpen(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-xs font-medium text-slate-800 border border-slate-200 transition"
          >
            <Layers size={14} className="text-slate-600" />
            <span>示例晶体库</span>
            <ChevronDown size={14} className="text-slate-500" />
          </button>

          {presetOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-40 text-xs">
              {PRESET_STRUCTURES.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectPreset(p.id);
                    setPresetOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col transition border-b border-slate-100 last:border-b-0"
                >
                  <span className="font-semibold text-slate-800">{p.name}</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">{p.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View Along Axes */}
        <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          <span className="text-[11px] text-slate-500 px-2 font-medium">投影:</span>
          <button
            onClick={() => onViewAlong('a')}
            className="px-2.5 py-1 rounded-md text-xs hover:bg-white hover:shadow-xs text-slate-700 hover:text-slate-900 font-semibold transition"
            title="沿 a 轴投影 (View along a)"
          >
            A 轴
          </button>
          <button
            onClick={() => onViewAlong('b')}
            className="px-2.5 py-1 rounded-md text-xs hover:bg-white hover:shadow-xs text-slate-700 hover:text-slate-900 font-semibold transition"
            title="沿 b 轴投影 (View along b)"
          >
            B 轴
          </button>
          <button
            onClick={() => onViewAlong('c')}
            className="px-2.5 py-1 rounded-md text-xs hover:bg-white hover:shadow-xs text-slate-700 hover:text-slate-900 font-semibold transition"
            title="沿 c 轴投影 (View along c)"
          >
            C 轴
          </button>
          <button
            onClick={() => onViewAlong('reset')}
            className="px-2.5 py-1 rounded-md text-xs hover:bg-white hover:shadow-xs text-slate-600 hover:text-slate-900 transition flex items-center gap-1"
            title="重置视角 (Fit camera)"
          >
            <RotateCcw size={12} />
            <span>复位</span>
          </button>
        </div>
      </div>

      {/* Import & Export Operations */}
      <div className="flex items-center gap-2">
        {/* Hidden File Input (Allow all files so POSCAR/CONTCAR without extension are selectable) */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-medium text-white shadow-xs transition"
        >
          <Upload size={14} />
          <span>导入结构</span>
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => { setExportOpen(!exportOpen); setPresetOpen(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 shadow-xs transition"
          >
            <Download size={14} className="text-slate-600" />
            <span>导出</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-40 text-xs">
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
                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-900 font-medium"
              >
                <Camera size={13} className="text-slate-600" />
                <span>高清透明快照 (PNG)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
