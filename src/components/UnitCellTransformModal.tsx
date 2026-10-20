import React, { useState } from 'react';
import { X, RotateCcw, HelpCircle, Check, Move } from 'lucide-react';
import { CrystalStructure } from '../types/crystal';
import { 
  Matrix3x3, 
  IDENTITY_MATRIX, 
  ZERO_VECTOR, 
  determinant3x3, 
  transformUnitCell, 
  TransformParams 
} from '../utils/unitCellTransform';
import { useDraggable } from '../hooks/useDraggable';
import { useModalDialog } from '../hooks/useModalDialog';

interface UnitCellTransformModalProps {
  isOpen: boolean;
  onClose: () => void;
  structure: CrystalStructure | null;
  onApplyTransform: (transformed: CrystalStructure) => void;
}

const UnitCellTransformModalContent: React.FC<UnitCellTransformModalProps> = ({
  onClose,
  structure,
  onApplyTransform
}) => {
  const { position, onMouseDown, resetPosition } = useDraggable();
  const dialogRef = useModalDialog(onClose);

  const [matrixInputs, setMatrixInputs] = useState<string[][]>(() => IDENTITY_MATRIX.map(row => row.map(String)));
  const [vectorInputs, setVectorInputs] = useState<string[]>(() => ZERO_VECTOR.map(String));
  const parseInput = (value: string) => value.trim() === '' ? NaN : Number(value);
  const P = matrixInputs.map(row => row.map(parseInput)) as Matrix3x3;
  const p = vectorInputs.map(parseInput) as [number, number, number];
  const [normalizeRange, setNormalizeRange] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const det = determinant3x3(P);
  const hasInvalidInput = !P.flat().every(Number.isFinite) || !p.every(Number.isFinite) || !Number.isFinite(det);
  const isSingular = hasInvalidInput || Math.abs(det) < 1e-6;

  const handleMatrixChange = (row: number, col: number, val: string) => {
    setMatrixInputs(prev => {
      const next = [
        [...prev[0]],
        [...prev[1]],
        [...prev[2]]
      ];
      next[row][col] = val;
      return next;
    });
    setErrorMsg(null);
  };

  const handlePVectorChange = (idx: number, val: string) => {
    setVectorInputs(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    setErrorMsg(null);
  };

  const handleResetMatrix = () => {
    setMatrixInputs(IDENTITY_MATRIX.map(row => row.map(String)));
    setVectorInputs(ZERO_VECTOR.map(String));
    setErrorMsg(null);
  };

  const applyPreset = (nx: number, ny: number, nz: number) => {
    setMatrixInputs([
      [String(nx), '0', '0'],
      ['0', String(ny), '0'],
      ['0', '0', String(nz)]
    ]);
    setVectorInputs(['0', '0', '0']);
    setErrorMsg(null);
  };

  const handleExecute = () => {
    if (!structure) return;
    if (isSingular) {
      setErrorMsg(hasInvalidInput ? '请填写完整、有限的矩阵和位移数值。' : '矩阵奇异 (det(P) ≈ 0)，无法作为有效晶格变换矩阵。');
      return;
    }

    try {
      const params: TransformParams = {
        rotationMatrix: P,
        translationVector: p,
        normalizeRange
      };
      const transformed = transformUnitCell(structure, params);
      onApplyTransform(transformed);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || '变换执行失败');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/30 pointer-events-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Unit cell transformation"
        tabIndex={-1}
        className="w-full max-w-[740px] max-h-[92vh] bg-[#f8fafc] rounded-lg shadow-2xl border border-[#cbd5e1] flex flex-col overflow-hidden text-xs text-slate-800 transition-shadow select-none"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`
        }}
      >
        {/* Title Bar (Draggable) */}
        <div
          onMouseDown={onMouseDown}
          className="min-h-[32px] shrink-0 bg-[#e2e8f0] border-b border-[#cbd5e1] px-3 flex items-center justify-between cursor-move hover:bg-[#d8e0ea] transition text-slate-800 font-semibold"
          title="按住鼠标左键可拖动此窗口"
        >
          <div className="flex items-center gap-1.5">
            <Move size={13} className="text-slate-500" />
            <span className="font-bold">Unit Cell Transformation (晶格与基矢空间变换)</span>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭晶格变换窗口"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500 hover:text-white text-slate-600 transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 min-h-0 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
          
          {/* Left Column: Matrices */}
          <div className="space-y-3.5">
            <div>
              <div className="font-bold text-slate-800 text-[11px] mb-2 flex items-center justify-between">
                <span>Transformation matrix (变换矩阵)</span>
                <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded border font-semibold ${
                  isSingular 
                    ? 'bg-red-50 text-red-700 border-red-300' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                }`}>
                  det(P) = {Number.isFinite(det) ? det.toFixed(4) : '无效输入'}
                </span>
              </div>

              {/* Rotation matrix (P) & Translation vector (p) */}
              <div className="flex gap-3 items-start">
                {/* 3x3 Matrix P */}
                <div className="flex-1 space-y-1">
                  <div className="text-[10px] text-slate-600 font-medium">Rotation matrix (P):</div>
                  <div className="grid grid-cols-3 gap-1 bg-[#f1f5f9] p-1.5 rounded border border-[#cbd5e1]">
                    {[0, 1, 2].map(r =>
                      [0, 1, 2].map(c => (
                        <input
                          key={`p_${r}_${c}`}
                          type="number"
                          step="any"
                          value={matrixInputs[r][c]}
                          aria-label={`变换矩阵第 ${r + 1} 行第 ${c + 1} 列`}
                          onChange={(e) => handleMatrixChange(r, c, e.target.value)}
                          className={`w-full bg-white border rounded px-1 py-1 text-center font-mono text-[11px] font-semibold focus:outline-none focus:border-blue-500 ${
                            r === c && P[r][c] !== 0 ? 'text-blue-700' : 'text-slate-800'
                          }`}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Vector p */}
                <div className="w-24 space-y-1">
                  <div className="text-[10px] text-slate-600 font-medium truncate" title="Translation vector (p)">
                    Translation (p):
                  </div>
                  <div className="flex flex-col gap-1 bg-[#f1f5f9] p-1.5 rounded border border-[#cbd5e1]">
                    {[0, 1, 2].map(idx => (
                      <input
                        key={`vec_p_${idx}`}
                        type="number"
                        step="any"
                        value={vectorInputs[idx]}
                        aria-label={`平移向量 ${['x', 'y', 'z'][idx]}`}
                        onChange={(e) => handlePVectorChange(idx, e.target.value)}
                        className="w-full bg-white border border-[#cbd5e1] rounded px-1 py-1 text-center font-mono text-[11px] focus:outline-none focus:border-blue-500"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Presets & Actions */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <div className="text-[10px] text-slate-500 font-medium">快速超胞预设 (Supercell Presets):</div>
              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  onClick={() => applyPreset(2, 2, 1)}
                  className="py-1 px-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded font-mono text-[10px] text-slate-700 font-semibold transition"
                >
                  2×2×1 (4x)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(2, 2, 2)}
                  className="py-1 px-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded font-mono text-[10px] text-slate-700 font-semibold transition"
                >
                  2×2×2 (8x)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(3, 3, 1)}
                  className="py-1 px-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded font-mono text-[10px] text-slate-700 font-semibold transition"
                >
                  3×3×1 (9x)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(1, 1, 2)}
                  className="py-1 px-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded font-mono text-[10px] text-slate-700 font-semibold transition"
                >
                  1×1×2 (2x)
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetMatrix}
                  className="flex-1 py-1 px-2 rounded bg-white hover:bg-slate-100 border border-[#cbd5e1] font-semibold text-slate-700 flex items-center justify-center gap-1 shadow-2xs transition"
                >
                  <RotateCcw size={12} className="text-slate-500" />
                  <span>Initialize current matrix (复位单位阵)</span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-[11px]">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Right Column: Mathematical Relationship Formula (Matching VESTA) */}
          <div className="bg-[#f8fafc] p-3 rounded-md border border-[#cbd5e1] flex flex-col justify-between space-y-2.5">
            <div className="space-y-2 text-[11px] text-slate-700">
              <div className="font-semibold text-slate-800">
                基矢变换数学关系 (Basis Vector Transformation):
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                新基矢 (a', b', c') 与原基矢 (a, b, c) 满足标准 VESTA 空间变换：
              </p>

              {/* KaTeX / Math Formula Block */}
              <div className="p-2 bg-white rounded border border-slate-200/90 font-mono text-[10px] leading-relaxed text-slate-800 shadow-2xs space-y-1">
                <div className="font-bold text-blue-900">(a', b', c') = (a, b, c) · P</div>
                <div className="text-[9px] text-slate-600 pl-2">
                  = ( P₁₁a + P₂₁b + P₃₁c,<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;P₁₂a + P₂₂b + P₃₂c,<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;P₁₃a + P₂₃b + P₃₃c )
                </div>
                <div className="pt-1 border-t border-slate-100 text-[9px] text-slate-600">
                  原点平移矢量: t = (a, b, c) · p = p₁a + p₂b + p₃c
                </div>
              </div>

              {/* Volume factor preview */}
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">晶胞体积缩放比:</span>
                <span className="font-mono font-bold text-slate-800">
                  {Number.isFinite(det) ? Math.abs(det).toFixed(2) : '—'} 倍
                </span>
              </div>
            </div>

            {/* Checkbox: Normalize fractional coordinates */}
            <div className="pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold text-[11px]">
                <input
                  type="checkbox"
                  checked={normalizeRange}
                  onChange={(e) => setNormalizeRange(e.target.checked)}
                  className="rounded accent-blue-600 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Normalize the range of fractional coordinates</span>
              </label>
              <span className="block text-[9px] text-slate-400 pl-5.5 mt-0.5">
                自动归一化分数坐标至 [0, 1) 晶胞范围内
              </span>
            </div>

          </div>

        </div>

        {/* Footer Buttons */}
        <div className="h-10 shrink-0 px-3 bg-[#f1f5f9] border-t border-[#cbd5e1] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleExecute}
            disabled={isSingular || !structure?.lattice}
            className={`px-4 py-1 rounded font-semibold shadow-2xs transition cursor-pointer ${
              isSingular
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white font-bold'
            }`}
          >
            OK
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-white hover:bg-slate-100 border border-[#cbd5e1] text-slate-700 shadow-2xs transition cursor-pointer"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};

export const UnitCellTransformModal: React.FC<UnitCellTransformModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <UnitCellTransformModalContent {...props} />;
};
