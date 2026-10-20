import { parseCIF } from './parsers/cif';
import { parsePOSCAR } from './parsers/poscar';
import { parseXYZ } from './parsers/xyz';
import { assertStructureValid, assertTextSize } from './utils/validation';
import { volumeKind } from './volume/data';
import { parseVaspVolume } from './parsers/vaspVolume';

export function importStructure(content: string, filename: string) {
  if(volumeKind(filename))return parseVaspVolume(content,filename);
  assertTextSize(content);
  if (!content.trim()) throw new Error('文件为空，请选择包含原子坐标的结构文件。');
  const name = filename.toLowerCase();
  if (/^xdatcar(?:\.|$)/.test(name)) throw new Error('当前尚不支持多帧轨迹文件，请先提取单帧 POSCAR/CIF 坐标。');
  if (name.endsWith('.mcif')) throw new Error('磁性 CIF 尚不支持，请使用专业晶体学软件提取普通单帧 CIF。');
  // A malformed identified format must not be reinterpreted as a different one.
  let structure;
  if (name.endsWith('.cif')) structure = parseCIF(content, filename);
  else if (name.endsWith('.xyz')) structure = parseXYZ(content, filename);
  else if (/\.(poscar|vasp)$/.test(name) || /^(poscar|contcar)(\.|$)/.test(name)) structure = parsePOSCAR(content, filename);
  else if (/^\s*(data_|_cell_length)/im.test(content)) structure = parseCIF(content, filename);
  else if (/^\s*\d+\s*\r?\n/.test(content)) structure = parseXYZ(content, filename);
  else structure = parsePOSCAR(content, filename);
  assertStructureValid(structure);
  return structure;
}
