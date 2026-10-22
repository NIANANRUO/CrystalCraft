/** Explicit runtime schema for project boundaries. Unknown fields are rejected so
 * they cannot hitchhike into React, renderers, future migrations or exported data.
 */
function fields(value: unknown, allowed: string, label: string): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}必须为对象。`);
  const keys = new Set(allowed.split(' '));
  for (const key of Object.keys(value)) if (!keys.has(key)) throw new Error(`${label}含不支持的字段：${key.slice(0, 80)}`);
}
function vector(value: unknown) { fields(value, 'x y z', '坐标'); }
function elementMap(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('元素映射无效。');
  const keys = Object.keys(value);
  if (keys.length > 2000 || keys.some(key => !/^[A-Za-z][A-Za-z0-9_+\-]{0,31}$/.test(key))) throw new Error('元素映射键名无效。');
}
export function assertProjectShape(state: unknown) {
  fields(state, 'migrationNotice structure visualSettings materialType renderMode showLattice showAxes', '项目');
  const structure = state.structure;
  fields(structure, 'scalarSource volumeData title lattice atoms isPeriodic format coordType hasSelectiveDynamics sourceCif', '结构');
  if (!Array.isArray(structure.atoms)) throw new Error('项目缺少原子数组。');
  for (const atom of structure.atoms) {
    fields(atom, 'id element name fractional cartesian occupancy charge scalarData displacement selected colorOverride radiusOverride selectiveDynamics isBoundary', '原子');
    if (atom.isBoundary !== undefined && atom.isBoundary !== false) throw new Error('项目基胞原子不能伪造周期镜像身份。');
    vector(atom.fractional); vector(atom.cartesian);
    if (atom.scalarData !== undefined) fields(atom.scalarData, 'esp orbital spin bFactor', '标量数据');
  }
  if (structure.format !== undefined && !['xyz','cif','poscar'].includes(structure.format)) throw new Error('项目结构格式标记无效。');
  if (structure.coordType !== undefined && !['Direct','Cartesian'].includes(structure.coordType)) throw new Error('项目坐标模式无效。');
  if (structure.hasSelectiveDynamics !== undefined && typeof structure.hasSelectiveDynamics !== 'boolean') throw new Error('项目弛豫约束开关无效。');
  if (structure.lattice !== undefined) {
    fields(structure.lattice, 'matrix a b c alpha beta gamma volume', '晶格');
    if (!Array.isArray(structure.lattice.matrix)) throw new Error('项目晶格矩阵无效。');
    structure.lattice.matrix.forEach(vector);
  }
  if (structure.sourceCif !== undefined) fields(structure.sourceCif, 'text originalGeometry', '原始 CIF');
  if (structure.volumeData !== undefined) {
    const data = structure.volumeData;
    fields(data, 'kind sourceName dimensions latticeMatrix channels originalDimensions samplingSteps sourceBytes units augmentationBlocks', '体数据');
    if (!Array.isArray(data.latticeMatrix) || !Array.isArray(data.channels)) throw new Error('体数据矩阵或通道无效。');
    data.latticeMatrix.forEach(vector);
    for (const channel of data.channels) {
      fields(channel, 'label values min max sourceStats', '体数据通道');
      if (channel.sourceStats !== undefined) fields(channel.sourceStats, 'min max mean count', '网格统计');
    }
  }
  const s = state.visualSettings;
  fields(s, 'bondSettings textureStrength textureScale volumeSettings ionicRadii atomSpecular atomShininess atomStacks atomSlices atomStyle radiiType hideNonbonding labelOffsetZ outlineWidth showStructure atomScale bondRadius bondTolerance bondStyle bondColorMode customBondColor doubleBondGap aromaticGapRatio taperRootRadius taperTipRadius taperMode elementColors elementRadii showPolyhedra showHBonds showOutline showShadows showFog showLabels isOrthographic autoRotate autoRotateSpeed ligandViewRadius showBoundaryAtoms polyhedraSettings lightAzimuth lightAltitude lightIntensity ambientIntensity headlightMode', '显示设置');
  elementMap(s.elementColors); elementMap(s.elementRadii);
  if (s.atomSpecular !== undefined) fields(s.atomSpecular, 'r g b', '高光颜色');
  if (s.ionicRadii !== undefined) { elementMap(s.ionicRadii); Object.values(s.ionicRadii).forEach(v => fields(v, 'charge coordination radius', '离子半径')); }
  if (s.bondSettings !== undefined) {
    fields(s.bondSettings, 'enabled rules', '成键规则');
    if (!Array.isArray(s.bondSettings.rules)) throw new Error('成键规则必须为数组。');
    s.bondSettings.rules.forEach((r: unknown) => fields(r, 'id searchMode boundaryMode searchByLabel atom1 atom2 minLength maxLength showPolyhedra', '化学键规则'));
  }
  if (s.volumeSettings !== undefined) fields(s.volumeSettings, 'channel isoEnabled isoValue paired isoColor negativeColor isoOpacity stride sectionEnabled sectionAxis sectionPosition sectionOpacity palette rangeMin rangeMax', '体显示设置');
  if (s.polyhedraSettings !== undefined) {
    const p = s.polyhedraSettings;
    fields(p, 'centerMode customAtomIds style centralElements material edges elementColors', '多面体设置');
    if (!Array.isArray(p.centralElements) || p.centralElements.length > 2000 || (p.customAtomIds !== undefined && (!Array.isArray(p.customAtomIds) || p.customAtomIds.length > 2000))) throw new Error('多面体位点列表无效。');
    fields(p.material, 'specular shininess opacity', '多面体材质'); fields(p.material.specular, 'r g b', '多面体高光');
    fields(p.edges, 'show color lineWidth', '多面体边框'); fields(p.edges.color, 'r g b', '边框颜色');
    elementMap(p.elementColors); Object.values(p.elementColors).forEach(v => fields(v, 'r g b a', '多面体颜色'));
  }
}

/** Bound nesting before JSON.parse's reviver can recurse into adversarial input. */
export function assertJsonDepth(text: string) {
  let depth = 0, quoted = false, escaped = false;
  for (const char of text) {
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') { if (++depth > 24) throw new Error('项目 JSON 嵌套超过安全上限。'); }
    else if (char === '}' || char === ']') depth--;
  }
}
