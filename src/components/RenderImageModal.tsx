import React, { useEffect, useRef, useState } from 'react';
import { useModalDialog } from '../hooks/useModalDialog';
import { 
  X, 
  Camera, 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Loader2, 
  Sliders, 
  Sparkles, 
  Layers,
  Info
} from 'lucide-react';

export interface RenderExportOptions {
  width: number;
  transparent: boolean;
  quality: 'normal' | 'high' | 'ultra';
  aspectRatio?: 'original' | '16:9' | '4:3' | '1:1';
}

interface RenderImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: RenderExportOptions) => Promise<void>;
  structureTitle?: string;
}

const RESOLUTION_OPTIONS = [
  { width: 1920, label: '1920px (1080p 全高清)', tag: 'FHD', desc: '常规展示 / PPT 演示' },
  { width: 2560, label: '2560px (2K 极清)', tag: '2K', desc: '高分屏 / 封面大图' },
  { width: 3840, label: '3840px (4K 超清)', tag: '4K', desc: '顶刊论文印刷 (推荐)' },
  { width: 5120, label: '5120px (5K 印刷级)', tag: '5K', desc: '大型海报 / 展板印刷' },
  { width: 7680, label: '7680px (8K 极致巨幅)', tag: '8K', desc: '科研主页巨幅海报' },
];

export const RenderImageModal: React.FC<RenderImageModalProps> = ({
  isOpen,
  onClose,
  onExport,
  structureTitle
}) => {
  // Active Tab: 'quick' (快速渲染) | 'advanced' (高级配置)
  const [activeTab, setActiveTab] = useState<'quick' | 'advanced'>('quick');

  // Core settings
  const [resolution, setResolution] = useState<number>(3840); // 4K default for publications
  const [isTransparent, setIsTransparent] = useState<boolean>(false);
  const [quality, setQuality] = useState<'normal' | 'high' | 'ultra'>('high');
  const [aspectRatio, setAspectRatio] = useState<'original' | '16:9' | '4:3' | '1:1'>('original');

  // Collapsible sections
  const [isResDropdownOpen, setIsResDropdownOpen] = useState<boolean>(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportInProgress = useRef(false);
  const dialogRef = useModalDialog(() => {
    if (!exportInProgress.current) onClose();
  }, isOpen);
  useEffect(() => {
    if (isOpen) setExportError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentResObj = RESOLUTION_OPTIONS.find(r => r.width === resolution) || RESOLUTION_OPTIONS[2];

  const handleStartExport = async () => {
    if (exportInProgress.current) return;
    exportInProgress.current = true;
    setIsExporting(true);
    setExportError(null);
    try {
      await onExport({
        width: resolution,
        transparent: isTransparent,
        quality,
        aspectRatio
      });
      onClose();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '图像导出失败，请降低分辨率后重试。');
    } finally {
      exportInProgress.current = false;
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150 p-4">
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="render-image-title"
        aria-busy={isExporting}
        tabIndex={-1}
        className="w-[430px] max-w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-slate-800 relative select-none max-h-[92vh] flex flex-col"
        onClick={() => { if (isResDropdownOpen) setIsResDropdownOpen(false); }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shadow-2xs">
              <Camera size={16} />
            </div>
            <div>
              <h2 id="render-image-title" className="text-base font-bold tracking-tight text-slate-900">渲染图像</h2>
              <p className="text-[11px] text-slate-400">导出出版级高分辨率结构图像</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-slate-400 hover:text-slate-700 transition p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
            title="关闭"
          >
            <X size={17} />
          </button>
        </div>

        {/* Tab Navigation: 统一白色极简分段控件 */}
        <div className="mt-3.5 mb-4 p-1 bg-slate-100 rounded-xl flex gap-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'quick'
                ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>快速渲染</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'advanced'
                ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders size={13} />
            <span>高级选项</span>
          </button>
        </div>

        {/* Body Content (Tab 1: 快速渲染) */}
        {activeTab === 'quick' && (
          <div className="space-y-4 overflow-y-auto pr-0.5">
            {/* Section 1: Resolution */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">渲染分辨率</label>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {currentResObj.tag} · {currentResObj.width}px
                </span>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsResDropdownOpen(!isResDropdownOpen);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white rounded-xl text-xs font-medium transition cursor-pointer ${
                    isResDropdownOpen 
                      ? 'border-2 border-slate-800 ring-2 ring-slate-100' 
                      : 'border border-slate-300 hover:border-slate-500 shadow-2xs'
                  }`}
                >
                  <div className="text-left">
                    <span className="font-semibold text-slate-800">{currentResObj.label}</span>
                    <span className="text-[10px] text-slate-400 block">{currentResObj.desc}</span>
                  </div>
                  <ChevronDown size={16} className={`text-slate-500 transition-transform ${isResDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu (纯白整洁卡片) */}
                {isResDropdownOpen && (
                  <div 
                    className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-30 py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {RESOLUTION_OPTIONS.map((opt) => {
                      const isSel = resolution === opt.width;
                      return (
                        <button
                          key={opt.width}
                          type="button"
                          onClick={() => {
                            setResolution(opt.width);
                            setIsResDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition cursor-pointer ${
                            isSel 
                              ? 'bg-slate-100 font-bold text-slate-900' 
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <span className="block">{opt.label}</span>
                            <span className="text-[10px] text-slate-400">{opt.desc}</span>
                          </div>
                          {isSel && <Check size={15} className="text-slate-900 stroke-[2.5]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Background (不透明 vs 透明) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">背景通道</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsTransparent(false)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    !isTransparent
                      ? 'bg-slate-900 border-2 border-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400 shrink-0" />
                  <span>不透明 (纯白底)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsTransparent(true)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    isTransparent
                      ? 'bg-slate-900 border-2 border-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-transparent border border-dashed border-slate-400 shrink-0" />
                  <span>透明通道 (PNG Alpha)</span>
                </button>
              </div>
            </div>

            {/* Section 3: Quality (Normal / High / Ultra) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">渲染质量与抗锯齿</label>
              <div className="grid grid-cols-3 gap-2">
                {(['normal', 'high', 'ultra'] as const).map((q) => {
                  const label = q === 'normal' ? 'Normal' : q === 'high' ? 'High' : 'Ultra';
                  const desc = q === 'normal' ? '标准 1x' : q === 'high' ? '最高 2x' : '最高 4x';
                  const isSelected = quality === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuality(q)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold transition cursor-pointer text-center ${
                        isSelected
                          ? 'bg-slate-900 border-2 border-slate-900 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="font-bold">{label}</div>
                      <div className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>{desc}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">超采样按设备能力和输出尺寸自动调整；8K 等大图在资源不足时会提示降低分辨率。</p>
            </div>

            {/* 折叠收纳区: 规格信息一览 */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/70">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition"
              >
                <span className="flex items-center gap-1.5">
                  <Info size={12} className="text-slate-500" />
                  <span>展开输出规格详情</span>
                </span>
                {isDetailsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {isDetailsOpen && (
                <div className="p-3 pt-1 border-t border-slate-200/60 font-mono text-[10px] text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">输出宽:</span>
                    <span className="font-bold text-slate-800">{resolution} 像素 (px)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">背景模式:</span>
                    <span className="text-slate-800">{isTransparent ? '32-bit RGBA (透明)' : '24-bit RGB (纯白)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">抗锯齿超采样:</span>
                    <span className="text-slate-800">{quality === 'ultra' ? '最高 4096px 阴影 + 4x 采样' : quality === 'high' ? '最高 2048px 阴影 + 2x 采样' : '标准贴图'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">300 DPI 印刷尺寸:</span>
                    <span className="text-slate-800">{(resolution / 300 * 2.54).toFixed(1)} cm</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Body Content (Tab 2: 高级选项 - 纵横比与出版规范) */}
        {activeTab === 'advanced' && (
          <div className="space-y-4 overflow-y-auto pr-0.5">
            {/* Aspect Ratio */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">图像纵横比 (Aspect Ratio)</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'original', label: '原始画布视口', desc: '与当前窗口比例一致' },
                  { id: '16:9', label: '16 : 9 (宽屏)', desc: 'PPT 与高清显示屏' },
                  { id: '4:3', label: '4 : 3 (经典)', desc: '学术期刊常规单栏' },
                  { id: '1:1', label: '1 : 1 (正方形)', desc: '图形摘要 / TOC 图标' },
                ].map((item) => {
                  const isSel = aspectRatio === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAspectRatio(item.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        isSel
                          ? 'bg-slate-900 border-2 border-slate-900 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs">{item.label}</div>
                      <div className={`text-[10px] ${isSel ? 'text-slate-300' : 'text-slate-400'}`}>{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Publication Tips Box */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles size={13} className="text-slate-700" />
                <span>顶刊出版建议</span>
              </div>
              <p>• 论文正文图推荐选择 <strong>4K (3840px) + 4:3 或 16:9</strong>，300 DPI 下满足大多数顶级期刊 (Nature / Science / JACS) 严格要求。</p>
              <p>• 需要无缝插入 PPT 或做多图拼接时，请开启 <strong>透明通道 (PNG Alpha)</strong>。</p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {exportError && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{exportError}</p>}
        <div className="grid grid-cols-2 gap-3 pt-5 mt-auto border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            关闭
          </button>

          <button
            type="button"
            onClick={handleStartExport}
            disabled={isExporting}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin text-white" />
                <span>正在渲染高清图...</span>
              </>
            ) : (
              <span>导出 PNG 图像</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
