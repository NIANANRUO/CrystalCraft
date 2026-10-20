import React from 'react';
import { PERIODIC_GRID, ELEMENTS, getElement } from '../constants/elements';
import { X } from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog';

interface PeriodicTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectElement: (element: string) => void;
  title?: string;
}

export const PeriodicTableModal: React.FC<PeriodicTableModalProps> = ({
  isOpen,
  onClose,
  onSelectElement,
  title = '选择目标化学元素 (原子替换)'
}) => {
  const dialogRef = useModalDialog(onClose, isOpen);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full p-3 sm:p-6 text-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              {title}
            </span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              点击元素即刻完成替换
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭元素周期表"
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Periodic Table Grid */}
        <div className="overflow-auto min-h-0 pb-4">
          <div 
            className="grid gap-1 min-w-[700px]"
            style={{
              gridTemplateColumns: 'repeat(18, minmax(36px, 1fr))',
              gridTemplateRows: 'repeat(7, 42px)'
            }}
          >
            {PERIODIC_GRID.map(item => {
              const elem = ELEMENTS[item.symbol] || getElement(item.symbol);
              return (
                <button
                  key={item.symbol}
                  onClick={() => {
                    onSelectElement(item.symbol);
                    onClose();
                  }}
                  style={{
                    gridColumn: item.col,
                    gridRow: item.row
                  }}
                  className="group relative flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-400 hover:shadow-xs transition-all p-0.5"
                >
                  <div className="flex items-center justify-between w-full px-1 text-[9px] text-slate-400">
                    <span>{elem.number}</span>
                    <span 
                      className="w-1.5 h-1.5 rounded-full border border-black/10" 
                      style={{ backgroundColor: elem.color }}
                    />
                  </div>
                  <span className="font-bold text-xs text-slate-800 group-hover:text-slate-900">
                    {elem.symbol}
                  </span>
                  <span className="text-[9px] text-slate-500 truncate max-w-full">
                    {elem.nameCn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-auto shrink-0 pt-4 border-t border-slate-200 flex gap-2 justify-between items-center text-xs text-slate-500">
          <span>支持过渡金属、主族非金属、活泼金属及常见半导体元素</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};
