import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Table, FileText, Info } from 'lucide-react';
import { CrystalStructure, Atom } from '../types/crystal';

interface VestaBottomPanelProps {
  structure: CrystalStructure | null;
  displayedAtoms: Atom[];
  selectedAtom: Atom | null;
  selectedAtoms?: Atom[];
  onSelectAtom: (atom: Atom, isMulti?: boolean) => void;
  counts: { atomsCount: number; bondsCount: number; polyhedraCount: number };
}

export const VestaBottomPanel: React.FC<VestaBottomPanelProps> = ({
  structure,
  displayedAtoms,
  selectedAtom,
  selectedAtoms = [],
  onSelectAtom,
  counts
}) => {
  const [activeTab, setActiveTab] = useState<'output' | 'summary' | 'comment'>('output');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 200;
  const pageCount = Math.max(1, Math.ceil(displayedAtoms.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleAtoms = displayedAtoms.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selectedIds = useMemo(() => new Set(selectedAtoms.length > 0
    ? selectedAtoms.map(atom => atom.id)
    : selectedAtom ? [selectedAtom.id] : []), [selectedAtoms, selectedAtom]);
  const baseAtoms = useMemo(() => new Map(structure?.atoms.map(atom => [atom.id, atom]) || []), [structure]);

  // Stoichiometry formula
  const formulaMap: Record<string, number> = {};
  structure?.atoms.forEach(a => {
    formulaMap[a.element] = (formulaMap[a.element] || 0) + 1;
  });
  const formulaStr = Object.entries(formulaMap)
    .map(([elem, count]) => `${elem}${count > 1 ? count : ''}`)
    .join('');

  return (
    <div className="shrink-0 min-w-0 border-t border-[#d1d5db] bg-white select-none text-xs flex flex-col z-20 shadow-xs">
      {/* 1. Header with Tab Navigation, Status Bar and Collapse Button */}
      <div className="h-7 shrink-0 bg-[#f8fafc] border-b border-[#e2e8f0] px-2 flex items-center justify-between text-[11px] text-slate-600">
        
        {/* Left: Clean Segmented Tabs */}
        <div className="flex items-center gap-1 font-sans overflow-x-auto whitespace-nowrap min-w-0 shrink [&>button]:shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('output');
              if (isCollapsed) setIsCollapsed(false);
            }}
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border ${
              activeTab === 'output' && !isCollapsed
                ? 'bg-white text-slate-900 border-[#cbd5e1] shadow-2xs font-bold'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-200/70 hover:text-slate-800'
            }`}
          >
            <Table size={12} className="text-slate-500" />
            <span>Output (原子列表)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('summary');
              if (isCollapsed) setIsCollapsed(false);
            }}
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border ${
              activeTab === 'summary' && !isCollapsed
                ? 'bg-white text-slate-900 border-[#cbd5e1] shadow-2xs font-bold'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-200/70 hover:text-slate-800'
            }`}
          >
            <Info size={12} className="text-slate-500" />
            <span>Summary (晶胞参数)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('comment');
              if (isCollapsed) setIsCollapsed(false);
            }}
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border ${
              activeTab === 'comment' && !isCollapsed
                ? 'bg-white text-slate-900 border-[#cbd5e1] shadow-2xs font-bold'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-200/70 hover:text-slate-800'
            }`}
          >
            <FileText size={12} className="text-slate-500" />
            <span>Comment (备注)</span>
          </button>
        </div>

        {/* Center: Status Summary */}
        <div className="hidden sm:flex items-center gap-2.5 font-mono text-[11px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap px-2">
          <span className="font-semibold text-slate-800">
            {counts.atomsCount} atoms, {counts.bondsCount} bonds, {counts.polyhedraCount} polyhedra
          </span>
          <span>•</span>
          <span className="truncate max-w-[200px]" title={structure?.title || '未导入结构'}>
            Title: {structure?.title || '未导入结构'}
          </span>
          <span>•</span>
          <span>Formula: {formulaStr || '—'}</span>
        </div>

        {/* Right: Collapse / Expand Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="shrink-0 text-slate-600 hover:text-slate-900 font-sans flex items-center gap-1 text-[11px] px-2 py-0.5 rounded hover:bg-slate-200/70 transition cursor-pointer"
          title={isCollapsed ? '展开底部数据面板' : '收起底部数据面板'}
        >
          <span>{isCollapsed ? '展开面板' : '收起面板'}</span>
          {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* 2. Collapsible Body */}
      {!isCollapsed && (
        <div className="h-44 max-h-[35vh] min-h-0 flex flex-col bg-white">
          
          {/* Output Content */}
          {activeTab === 'output' && (
            <div className="flex-1 overflow-auto font-mono text-[11px] text-slate-800 p-2">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-left text-slate-400 font-semibold sticky top-0 bg-white">
                    <th className="py-1 px-2 w-12">No.</th>
                    <th className="py-1 px-2 w-12">Elem</th>
                    <th className="py-1 px-2 w-14">Label</th>
                    <th className="py-1 px-2">x (frac)</th>
                    <th className="py-1 px-2">y (frac)</th>
                    <th className="py-1 px-2">z (frac)</th>
                    <th className="py-1 px-2">Occ</th>
                    <th className="py-1 px-2">Site</th>
                    <th className="py-1 px-2">X (Å)</th>
                    <th className="py-1 px-2">Y (Å)</th>
                    <th className="py-1 px-2">Z (Å)</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAtoms.map((atom, idx) => {
                    const effId = atom.originalId ?? atom.id;
                    const isSelected = selectedIds.has(effId);
                    const isBoundary = atom.isBoundary;

                    return (
                      <tr
                        key={`${atom.id}-${idx}`}
                        tabIndex={0}
                        aria-selected={isSelected}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            const base = baseAtoms.get(effId);
                            if (base) onSelectAtom(base, event.ctrlKey || event.metaKey);
                          }
                        }}
                        onClick={(e) => {
                          const base = baseAtoms.get(effId);
                          if (base) onSelectAtom(base, e.ctrlKey || e.metaKey);
                        }}
                        className={`hover:bg-[#f1f5f9] cursor-pointer transition ${
                          isSelected ? 'bg-blue-100/70 font-bold text-slate-900 border-l-2 border-l-blue-600' : ''
                        } ${isBoundary ? 'text-slate-500 italic' : ''}`}
                      >
                        <td className="py-0.5 px-2">{atom.originalId ?? atom.id}</td>
                        <td className="py-0.5 px-2 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <span 
                              className="w-2 h-2 rounded-full shrink-0" 
                              style={{ backgroundColor: atom.colorOverride || undefined }} 
                            />
                            {atom.element}
                          </span>
                        </td>
                        <td className="py-0.5 px-2">
                          {atom.name || `${atom.element}${atom.originalId ?? atom.id}`}
                          {isBoundary ? '*' : ''}
                        </td>
                        <td className="py-0.5 px-2">{atom.fractional.x.toFixed(5)}</td>
                        <td className="py-0.5 px-2">{atom.fractional.y.toFixed(5)}</td>
                        <td className="py-0.5 px-2">{atom.fractional.z.toFixed(5)}</td>
                        <td className="py-0.5 px-2">{(atom.occupancy ?? 1).toFixed(3)}</td>
                        <td className="py-0.5 px-2" title="源文件未提供 Wyckoff 位点信息">—</td>
                        <td className="py-0.5 px-2">{atom.cartesian.x.toFixed(3)}</td>
                        <td className="py-0.5 px-2">{atom.cartesian.y.toFixed(3)}</td>
                        <td className="py-0.5 px-2">{atom.cartesian.z.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pageCount > 1 && (
                <nav aria-label="原子列表分页" className="sticky bottom-0 flex items-center gap-3 border-t bg-white py-1">
                  <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded border px-2">上一页</button>
                  <span>第 {currentPage + 1} / {pageCount} 页，共 {displayedAtoms.length} 个原子（每页 {pageSize} 个）</span>
                  <button disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} className="rounded border px-2">下一页</button>
                </nav>
              )}
            </div>
          )}

          {/* Summary Content */}
          {activeTab === 'summary' && (
            <div className="flex-1 p-3 font-mono text-[11px] text-slate-700 overflow-auto space-y-2">
              <div className="font-bold text-xs text-slate-900 font-sans border-b border-slate-200 pb-1">
                Lattice Parameters & Crystal Information
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1">
                  <div className="text-slate-500 font-sans text-[10px] font-semibold">Lattice Lengths:</div>
                  <div>a = {structure?.lattice?.a.toFixed(4)} Å</div>
                  <div>b = {structure?.lattice?.b.toFixed(4)} Å</div>
                  <div>c = {structure?.lattice?.c.toFixed(4)} Å</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1">
                  <div className="text-slate-500 font-sans text-[10px] font-semibold">Lattice Angles:</div>
                  <div>alpha = {structure?.lattice?.alpha.toFixed(2)}°</div>
                  <div>beta  = {structure?.lattice?.beta.toFixed(2)}°</div>
                  <div>gamma = {structure?.lattice?.gamma.toFixed(2)}°</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1">
                  <div className="text-slate-500 font-sans text-[10px] font-semibold">Volume & Counts:</div>
                  <div>Volume = {structure?.lattice?.volume.toFixed(2)} Å³</div>
                  <div>Raw Atoms = {structure?.atoms.length}</div>
                  <div>PBC Expanded = {displayedAtoms.length}</div>
                </div>
              </div>
            </div>
          )}

          {/* Comment Content */}
          {activeTab === 'comment' && (
            <div className="flex-1 p-3 font-mono text-xs text-slate-700 overflow-auto">
              <div className="text-slate-500 text-[10px] mb-1 font-sans font-semibold">Structure File Header / Comment:</div>
              <div className="bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
                {structure?.title || 'No comment in structure file.'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
