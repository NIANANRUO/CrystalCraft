import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, RotateCcw } from 'lucide-react';
import type { BondRule, BondSettings, CrystalStructure } from '../types/crystal';
import { atomSiteLabel, defaultBondRules, MAX_BOND_LENGTH, MAX_BOND_RULES } from '../utils/bonding';

interface Props {
  structure: CrystalStructure | null;
  settings: BondSettings;
  tolerance: number;
  showBoundaryAtoms: boolean;
  onChange: (settings: BondSettings) => void;
  onBoundaryChange: (enabled: boolean) => void;
  error: string | null;
}

const control = 'min-h-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-blue-600';
const button = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40';
const searchModes = [
  ['pair', 'Search A2 bonded to A1', '按 A1–A2 原子对搜索'],
  ['all', 'Search atoms bonded to A1', '搜索与 A1 成键的所有元素'],
  ['molecule', 'Search molecules', '搜索所有原子对'],
] as const;
const boundaryModes = [
  [1, 'Do not search atoms beyond the boundary', '只搜索边界内的原子'],
  [2, 'Search additional atoms if A1 is included in the boundary', 'A1 在边界内时补全其邻接原子'],
  [3, 'Search additional atoms recursively if either A1 or A2 is visible', '从可见原子递归补全连接的原子'],
] as const;
const lengthText = (value: number) => Number.isFinite(value) ? String(value) : '—';

export const BondEditor: React.FC<Props> = ({ structure, settings, tolerance, showBoundaryAtoms, onChange, onBoundaryChange, error }) => {
  const [selectedId, setSelectedId] = useState<string | null>(settings.rules[0]?.id ?? null);
  const selectedIndex = settings.rules.findIndex(r => r.id === selectedId);
  const selected = settings.rules[selectedIndex];
  const atoms = structure?.atoms ?? [];
  const elements = [...new Set(atoms.map(a => a.element))];
  const tooManyDefaults = elements.length * (elements.length + 1) / 2 > MAX_BOND_RULES;
  const labels = [...new Set(atoms.map(atomSiteLabel))];
  const options = selected?.searchByLabel ? labels : elements;
  const update = (patch: Partial<BondRule>) => {
    onChange({ enabled: true, rules: settings.rules.map(r => r.id === selectedId ? { ...r, ...patch } : r) });
  };
  const replace = (rules: BondRule[]) => onChange({ enabled: true, rules });
  const add = () => {
    const rule: BondRule = { id: crypto.randomUUID(), atom1: elements[0], atom2: elements[0], minLength: 0, maxLength: 1.6,
      searchMode: 'pair', boundaryMode: 2, searchByLabel: false, showPolyhedra: true };
    replace([...settings.rules, rule]); setSelectedId(rule.id);
  };
  const remove = () => {
    const rules = settings.rules.filter(r => r.id !== selectedId);
    replace(rules); setSelectedId(rules[Math.min(selectedIndex, rules.length - 1)]?.id ?? null);
  };
  const move = (direction: number) => {
    const rules = [...settings.rules];
    [rules[selectedIndex], rules[selectedIndex + direction]] = [rules[selectedIndex + direction], rules[selectedIndex]];
    replace(rules);
  };
  const chooseLabelMode = (checked: boolean) => {
    const convert = (value: string) => checked
      ? atomSiteLabel(atoms.find(a => a.element === value) ?? atoms[0])
      : (atoms.find(a => atomSiteLabel(a) === value)?.element ?? elements[0]);
    update({ searchByLabel: checked, atom1: convert(selected.atom1), atom2: convert(selected.atom2) });
  };
  const atomSelect = (name: 'atom1' | 'atom2', disabled: boolean) => (
    <label className="flex min-w-0 items-center gap-2">
      <span className="shrink-0">{name === 'atom1' ? 'A1:' : 'A2:'}</span>
      <select aria-label={name === 'atom1' ? '成键原子 A1' : '成键原子 A2'} className={`${control} w-full min-w-0`} value={selected?.[name] ?? ''} disabled={disabled || !selected}
        onChange={e => update({ [name]: e.target.value })}>
        {selected && !options.includes(selected[name]) && <option value={selected[name]}>{selected[name]}（未匹配）</option>}
        {options.map(value => <option key={value}>{value}</option>)}
      </select>
    </label>
  );

  return <section aria-label="Bonds 规则编辑" className="space-y-3 text-xs">
    <div className="flex min-w-0 items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="shrink-0 text-slate-600">Phase: <strong className="ml-1 text-slate-900">1</strong></span>
      <span className="truncate text-slate-800" title={structure?.title}>{structure?.title ?? '未导入结构'}</span>
      <span className="ml-auto max-w-[35%] truncate font-mono text-slate-600" title={elements.join('  ')}>{elements.join('  ')}</span>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="accent-blue-600" checked={settings.enabled}
        onChange={e => onChange({ ...settings, enabled: e.target.checked })} />按规则成键 (Use bond rules)</label>
      <label className="flex items-center gap-2 text-slate-700"><input type="checkbox" className="accent-blue-600" checked={showBoundaryAtoms}
        onChange={e => onBoundaryChange(e.target.checked)} />周期边界补全</label>
    </div>

    <fieldset className="rounded border border-slate-300 bg-slate-50/60 p-3">
      <legend className="px-1.5 font-semibold text-slate-800">Search bonds and atoms</legend>
      {!selected && <p className="pb-2 text-slate-600">选择一条规则进行编辑，或点击 New 新建规则。</p>}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
        <fieldset disabled={!selected} className="min-w-0 rounded border border-slate-200 p-2.5 disabled:opacity-50">
          <legend className="px-1 text-slate-700">Search mode</legend>
          <div className="space-y-2.5">{searchModes.map(([value, text, title]) => <label key={value} title={title} className="flex items-start gap-2 leading-5">
            <input type="radio" name="bond-search-mode" className="mt-1 accent-blue-600" checked={selected?.searchMode === value}
              onChange={() => update({ searchMode: value, boundaryMode: value === 'molecule' ? 3 : 2 })} /><span>{text}</span>
          </label>)}</div>
        </fieldset>
        <fieldset disabled={!selected} className="min-w-0 rounded border border-slate-200 p-2.5 disabled:opacity-50">
          <legend className="px-1 text-slate-700">Boundary mode</legend>
          <div className="space-y-2.5">{boundaryModes.map(([value, text, title]) => <label key={value} title={title} className="flex items-start gap-2 leading-5">
            <input type="radio" name="bond-boundary-mode" className="mt-1 accent-blue-600" checked={selected?.boundaryMode === value}
              onChange={() => update({ boundaryMode: value })} /><span><span className="mr-1.5 text-slate-500">{value}.</span>{text}</span>
          </label>)}</div>
        </fieldset>
      </div>
      <div className="my-3 flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-blue-600" checked={selected?.searchByLabel ?? false} disabled={!selected || selected.searchMode === 'molecule' || !atoms.length}
          onChange={e => chooseLabelMode(e.target.checked)} />Search by label</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-blue-600" checked={selected?.searchMode !== 'molecule' && (selected?.showPolyhedra ?? false)} disabled={!selected || selected.searchMode === 'molecule'}
          onChange={e => update({ showPolyhedra: e.target.checked })} />Show polyhedra</label>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        {atomSelect('atom1', selected?.searchMode === 'molecule')}
        {atomSelect('atom2', selected?.searchMode !== 'pair')}
        {(['minLength', 'maxLength'] as const).map((key, i) => <label key={key} className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">{i ? 'Max.' : 'Min.'} (Å):</span>
          <input aria-label={i ? '最大键长 Max. length (Å)' : '最小键长 Min. length (Å)'} type="number" min={0} max={MAX_BOND_LENGTH} step="any" disabled={!selected}
            className={`${control} w-full min-w-0 font-mono`} value={selected && Number.isFinite(selected[key]) ? selected[key] : ''}
            aria-invalid={!!error} aria-describedby={error ? 'bond-rule-error' : undefined}
            onChange={e => update({ [key]: e.target.value === '' ? NaN : Number(e.target.value) })} />
        </label>)}
      </div>
    </fieldset>

    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="min-w-0 flex-1 overflow-auto rounded border border-slate-300 max-h-60">
        <table aria-label="化学键规则列表" className="w-full min-w-[510px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700"><tr>{['No.', 'Atom 1', 'Atom 2', 'Min. (Å)', 'Max. (Å)', 'Bound.', 'Poly.'].map(t => <th scope="col" key={t} className="border-b border-r border-slate-200 px-2 py-2 font-medium whitespace-nowrap">{t}</th>)}</tr></thead>
          <tbody>{settings.rules.map((r, i) => <tr key={r.id} aria-selected={r.id === selectedId} tabIndex={0} title={searchModes.find(([v]) => v === r.searchMode)?.[2]}
            className={`cursor-pointer border-b border-slate-100 outline-blue-600 ${r.id === selectedId ? 'bg-blue-100 text-blue-950' : 'odd:bg-white even:bg-slate-50 hover:bg-blue-50'}`}
            onClick={() => setSelectedId(r.id)} onKeyDown={e => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(r.id); }
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault(); const next = settings.rules[i + (e.key === 'ArrowDown' ? 1 : -1)];
                if (next) { setSelectedId(next.id); (e.currentTarget[e.key === 'ArrowDown' ? 'nextElementSibling' : 'previousElementSibling'] as HTMLElement)?.focus(); }
              }
            }}>
            <td className="px-2 py-2 font-mono">{i + 1}</td>
            <td className="px-2 py-2">{r.searchMode === 'molecule' ? '*' : r.atom1}</td>
            <td className="px-2 py-2">{r.searchMode === 'pair' ? r.atom2 : '*'}</td>
            <td className="px-2 py-2 font-mono">{lengthText(r.minLength)}</td><td className="px-2 py-2 font-mono">{lengthText(r.maxLength)}</td>
            <td className="px-2 py-2 font-mono">{r.boundaryMode}</td>
            <td className="px-2 py-2"><input type="checkbox" className="accent-blue-600" aria-label={`规则 ${i + 1} Poly.`} checked={r.showPolyhedra && r.searchMode !== 'molecule'} disabled={r.searchMode === 'molecule'}
              onChange={e => { setSelectedId(r.id); replace(settings.rules.map(rule => rule.id === r.id ? { ...rule, showPolyhedra: e.target.checked } : rule)); }} /></td>
          </tr>)}</tbody>
        </table>
        {!settings.rules.length && <p className="p-6 text-center text-slate-500">暂无规则。启用规则时，空列表不生成自动化学键。</p>}
      </div>
      <div className="flex flex-wrap gap-2 sm:w-28 sm:shrink-0 sm:flex-col">
        <button className={button} onClick={add} disabled={!atoms.length || settings.rules.length >= MAX_BOND_RULES}><Plus size={13} />New</button>
        <button className={button} onClick={remove} disabled={!selected}><Trash2 size={13} />Delete</button>
        <button className={button} onClick={() => { replace([]); setSelectedId(null); }} disabled={!settings.rules.length}>Clear</button>
        <div className="flex gap-2"><button className={`${button} flex-1 px-2`} aria-label="上移规则" onClick={() => move(-1)} disabled={selectedIndex <= 0}><ArrowUp size={15} /></button>
          <button className={`${button} flex-1 px-2`} aria-label="下移规则" onClick={() => move(1)} disabled={selectedIndex < 0 || selectedIndex >= settings.rules.length - 1}><ArrowDown size={15} /></button></div>
        <button className={`${button} sm:mt-auto`} disabled={!atoms.length || tooManyDefaults} title="按当前元素半径和全局容差重新生成原子对规则" onClick={() => {
          const rules = defaultBondRules(structure, tolerance); replace(rules); setSelectedId(rules[0]?.id ?? null);
        }}><RotateCcw size={12} />自动生成</button>
      </div>
    </div>
    {error && <p id="bond-rule-error" role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}
    {tooManyDefaults && <p className="text-amber-800">元素组合超过 {MAX_BOND_RULES} 条，无法自动生成完整列表，请使用 New 按需添加规则。</p>}
    <p className="text-[11px] leading-relaxed text-slate-600">
      {settings.enabled ? '当前使用列表内规则，满足任意一条即成键。' : '当前使用元素半径 × 全局容差自动成键；编辑规则后启用规则模式。'}
      {' '}Poly. 将 A1 设为配位中心，请在 Polyhedra 页开启多面体显示。{!showBoundaryAtoms && ' 周期边界补全已关闭，Boundary 模式仅在开启后扩展晶胞外原子。'}
      {' '}修改后点击 Apply 预览，OK 确认；Cancel 撤销本次窗口内的修改。
    </p>
  </section>;
};
