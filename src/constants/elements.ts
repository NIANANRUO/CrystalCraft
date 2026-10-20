export interface ElementInfo {
  number: number;
  symbol: string;
  name: string;
  nameCn: string;
  color: string;
  radius: number;     // Covalent / empirical radius in Å
  vdwRadius: number;  // Van der Waals radius in Å
  mass: number;
}

export const ELEMENTS: Record<string, ElementInfo> = {
  H:  { number: 1, symbol: 'H', name: 'Hydrogen', nameCn: '氢', color: '#FFFFFF', radius: 0.31, vdwRadius: 1.20, mass: 1.008 },
  He: { number: 2, symbol: 'He', name: 'Helium', nameCn: '氦', color: '#D9FFFF', radius: 0.28, vdwRadius: 1.40, mass: 4.003 },
  Li: { number: 3, symbol: 'Li', name: 'Lithium', nameCn: '锂', color: '#CC80FF', radius: 1.28, vdwRadius: 1.82, mass: 6.941 },
  Be: { number: 4, symbol: 'Be', name: 'Beryllium', nameCn: '铍', color: '#C2FF00', radius: 0.96, vdwRadius: 1.53, mass: 9.012 },
  B:  { number: 5, symbol: 'B', name: 'Boron', nameCn: '硼', color: '#FFB5B5', radius: 0.84, vdwRadius: 1.92, mass: 10.81 },
  C:  { number: 6, symbol: 'C', name: 'Carbon', nameCn: '碳', color: '#8fa4ba', radius: 0.76, vdwRadius: 1.70, mass: 12.011 },
  N:  { number: 7, symbol: 'N', name: 'Nitrogen', nameCn: '氮', color: '#1e40af', radius: 0.71, vdwRadius: 1.55, mass: 14.007 },
  O:  { number: 8, symbol: 'O', name: 'Oxygen', nameCn: '氧', color: '#FF0D0D', radius: 0.66, vdwRadius: 1.52, mass: 15.999 },
  F:  { number: 9, symbol: 'F', name: 'Fluorine', nameCn: '氟', color: '#90E050', radius: 0.57, vdwRadius: 1.47, mass: 18.998 },
  Ne: { number: 10, symbol: 'Ne', name: 'Neon', nameCn: '氖', color: '#B3E3F5', radius: 0.58, vdwRadius: 1.54, mass: 20.180 },
  Na: { number: 11, symbol: 'Na', name: 'Sodium', nameCn: '钠', color: '#AB5CF2', radius: 1.66, vdwRadius: 2.27, mass: 22.990 },
  Mg: { number: 12, symbol: 'Mg', name: 'Magnesium', nameCn: '镁', color: '#8AFF00', radius: 1.41, vdwRadius: 1.73, mass: 24.305 },
  Al: { number: 13, symbol: 'Al', name: 'Aluminium', nameCn: '铝', color: '#BFA6A6', radius: 1.21, vdwRadius: 1.84, mass: 26.982 },
  Si: { number: 14, symbol: 'Si', name: 'Silicon', nameCn: '硅', color: '#F0C8A0', radius: 1.11, vdwRadius: 2.10, mass: 28.085 },
  P:  { number: 15, symbol: 'P', name: 'Phosphorus', nameCn: '磷', color: '#ea580c', radius: 1.07, vdwRadius: 1.80, mass: 30.974 },
  S:  { number: 16, symbol: 'S', name: 'Sulfur', nameCn: '硫', color: '#FFFF30', radius: 1.05, vdwRadius: 1.80, mass: 32.065 },
  Cl: { number: 17, symbol: 'Cl', name: 'Chlorine', nameCn: '氯', color: '#1FF01F', radius: 1.02, vdwRadius: 1.75, mass: 35.453 },
  Ar: { number: 18, symbol: 'Ar', name: 'Argon', nameCn: '氩', color: '#80D1E3', radius: 1.06, vdwRadius: 1.88, mass: 39.948 },
  K:  { number: 19, symbol: 'K', name: 'Potassium', nameCn: '钾', color: '#8F40D4', radius: 2.03, vdwRadius: 2.75, mass: 39.098 },
  Ca: { number: 20, symbol: 'Ca', name: 'Calcium', nameCn: '钙', color: '#3DFF00', radius: 1.76, vdwRadius: 2.31, mass: 40.078 },
  Sc: { number: 21, symbol: 'Sc', name: 'Scandium', nameCn: '钪', color: '#E6E6E6', radius: 1.70, vdwRadius: 2.11, mass: 44.956 },
  Ti: { number: 22, symbol: 'Ti', name: 'Titanium', nameCn: '钛', color: '#BFC2C7', radius: 1.60, vdwRadius: 2.00, mass: 47.867 },
  V:  { number: 23, symbol: 'V', name: 'Vanadium', nameCn: '钒', color: '#A6A6AB', radius: 1.53, vdwRadius: 2.00, mass: 50.942 },
  Cr: { number: 24, symbol: 'Cr', name: 'Chromium', nameCn: '铬', color: '#8A99C7', radius: 1.39, vdwRadius: 2.00, mass: 51.996 },
  Mn: { number: 25, symbol: 'Mn', name: 'Manganese', nameCn: '锰', color: '#9C7AC7', radius: 1.39, vdwRadius: 2.00, mass: 54.938 },
  Fe: { number: 26, symbol: 'Fe', name: 'Iron', nameCn: '铁', color: '#E06633', radius: 1.32, vdwRadius: 2.00, mass: 55.845 },
  Co: { number: 27, symbol: 'Co', name: 'Cobalt', nameCn: '钴', color: '#F090A0', radius: 1.26, vdwRadius: 2.00, mass: 58.933 },
  Ni: { number: 28, symbol: 'Ni', name: 'Nickel', nameCn: '镍', color: '#50D050', radius: 1.24, vdwRadius: 1.63, mass: 58.693 },
  Cu: { number: 29, symbol: 'Cu', name: 'Copper', nameCn: '铜', color: '#C88033', radius: 1.32, vdwRadius: 1.40, mass: 63.546 },
  Zn: { number: 30, symbol: 'Zn', name: 'Zinc', nameCn: '锌', color: '#7D80B0', radius: 1.22, vdwRadius: 1.39, mass: 65.38 },
  Ga: { number: 31, symbol: 'Ga', name: 'Gallium', nameCn: '镓', color: '#C28F8F', radius: 1.22, vdwRadius: 1.87, mass: 69.723 },
  Ge: { number: 32, symbol: 'Ge', name: 'Germanium', nameCn: '锗', color: '#668F8F', radius: 1.20, vdwRadius: 2.11, mass: 72.64 },
  As: { number: 33, symbol: 'As', name: 'Arsenic', nameCn: '砷', color: '#BD80E3', radius: 1.19, vdwRadius: 1.85, mass: 74.922 },
  Se: { number: 34, symbol: 'Se', name: 'Selenium', nameCn: '硒', color: '#FFA100', radius: 1.20, vdwRadius: 1.90, mass: 78.96 },
  Br: { number: 35, symbol: 'Br', name: 'Bromine', nameCn: '溴', color: '#A62929', radius: 1.20, vdwRadius: 1.85, mass: 79.904 },
  Kr: { number: 36, symbol: 'Kr', name: 'Krypton', nameCn: '氪', color: '#5CB8D1', radius: 1.16, vdwRadius: 2.02, mass: 83.798 },
  Rb: { number: 37, symbol: 'Rb', name: 'Rubidium', nameCn: '铷', color: '#702EB0', radius: 2.20, vdwRadius: 3.03, mass: 85.468 },
  Sr: { number: 38, symbol: 'Sr', name: 'Strontium', nameCn: '锶', color: '#00FF00', radius: 1.95, vdwRadius: 2.49, mass: 87.62 },
  Y:  { number: 39, symbol: 'Y', name: 'Yttrium', nameCn: '钇', color: '#94FFFF', radius: 1.90, vdwRadius: 2.00, mass: 88.906 },
  Zr: { number: 40, symbol: 'Zr', name: 'Zirconium', nameCn: '锆', color: '#94E0E0', radius: 1.75, vdwRadius: 2.00, mass: 91.224 },
  Nb: { number: 41, symbol: 'Nb', name: 'Niobium', nameCn: '铌', color: '#73C2C9', radius: 1.64, vdwRadius: 2.00, mass: 92.906 },
  Mo: { number: 42, symbol: 'Mo', name: 'Molybdenum', nameCn: '钼', color: '#0d9488', radius: 1.54, vdwRadius: 2.00, mass: 95.96 },
  Ru: { number: 44, symbol: 'Ru', name: 'Ruthenium', nameCn: '钌', color: '#248F8F', radius: 1.46, vdwRadius: 2.00, mass: 101.07 },
  Rh: { number: 45, symbol: 'Rh', name: 'Rhodium', nameCn: '铑', color: '#0A788C', radius: 1.42, vdwRadius: 2.00, mass: 102.91 },
  Pd: { number: 46, symbol: 'Pd', name: 'Palladium', nameCn: '钯', color: '#006985', radius: 1.39, vdwRadius: 1.63, mass: 106.42 },
  Ag: { number: 47, symbol: 'Ag', name: 'Silver', nameCn: '银', color: '#C0C0C0', radius: 1.45, vdwRadius: 1.72, mass: 107.87 },
  Cd: { number: 48, symbol: 'Cd', name: 'Cadmium', nameCn: '镉', color: '#FFD98F', radius: 1.44, vdwRadius: 1.58, mass: 112.41 },
  In: { number: 49, symbol: 'In', name: 'Indium', nameCn: '铟', color: '#A67573', radius: 1.42, vdwRadius: 1.93, mass: 114.82 },
  Sn: { number: 50, symbol: 'Sn', name: 'Tin', nameCn: '锡', color: '#668080', radius: 1.39, vdwRadius: 2.17, mass: 118.71 },
  Sb: { number: 51, symbol: 'Sb', name: 'Antimony', nameCn: '锑', color: '#9E63B5', radius: 1.39, vdwRadius: 2.06, mass: 121.76 },
  Te: { number: 52, symbol: 'Te', name: 'Tellurium', nameCn: '碲', color: '#D47A00', radius: 1.38, vdwRadius: 2.06, mass: 127.60 },
  I:  { number: 53, symbol: 'I', name: 'Iodine', nameCn: '碘', color: '#940094', radius: 1.39, vdwRadius: 1.98, mass: 126.90 },
  Cs: { number: 55, symbol: 'Cs', name: 'Caesium', nameCn: '铯', color: '#57178F', radius: 2.44, vdwRadius: 3.43, mass: 132.91 },
  Ba: { number: 56, symbol: 'Ba', name: 'Barium', nameCn: '钡', color: '#00C900', radius: 2.15, vdwRadius: 2.68, mass: 137.33 },
  La: { number: 57, symbol: 'La', name: 'Lanthanum', nameCn: '镧', color: '#70D4FF', radius: 2.07, vdwRadius: 2.00, mass: 138.91 },
  Ce: { number: 58, symbol: 'Ce', name: 'Cerium', nameCn: '铈', color: '#FFFFC7', radius: 2.04, vdwRadius: 2.00, mass: 140.12 },
  Nd: { number: 60, symbol: 'Nd', name: 'Neodymium', nameCn: '钕', color: '#C7FFC7', radius: 2.01, vdwRadius: 2.00, mass: 144.24 },
  Eu: { number: 63, symbol: 'Eu', name: 'Europium', nameCn: '铕', color: '#61FFC7', radius: 1.99, vdwRadius: 2.00, mass: 151.96 },
  Gd: { number: 64, symbol: 'Gd', name: 'Gadolinium', nameCn: '钆', color: '#45FFC7', radius: 1.96, vdwRadius: 2.00, mass: 157.25 },
  W:  { number: 74, symbol: 'W', name: 'Tungsten', nameCn: '钨', color: '#2194D6', radius: 1.62, vdwRadius: 2.00, mass: 183.84 },
  Re: { number: 75, symbol: 'Re', name: 'Rhenium', nameCn: '铼', color: '#267DAB', radius: 1.51, vdwRadius: 2.00, mass: 186.21 },
  Os: { number: 76, symbol: 'Os', name: 'Osmium', nameCn: '锇', color: '#266696', radius: 1.44, vdwRadius: 2.00, mass: 190.23 },
  Ir: { number: 77, symbol: 'Ir', name: 'Iridium', nameCn: '铱', color: '#175487', radius: 1.41, vdwRadius: 2.00, mass: 192.22 },
  Pt: { number: 78, symbol: 'Pt', name: 'Platinum', nameCn: '铂', color: '#D0D0E0', radius: 1.36, vdwRadius: 1.75, mass: 195.08 },
  Au: { number: 79, symbol: 'Au', name: 'Gold', nameCn: '金', color: '#FFD123', radius: 1.36, vdwRadius: 1.66, mass: 196.97 },
  Hg: { number: 80, symbol: 'Hg', name: 'Mercury', nameCn: '汞', color: '#B8B8D0', radius: 1.32, vdwRadius: 1.55, mass: 200.59 },
  Pb: { number: 82, symbol: 'Pb', name: 'Lead', nameCn: '铅', color: '#575961', radius: 1.46, vdwRadius: 2.02, mass: 207.2 },
  Bi: { number: 83, symbol: 'Bi', name: 'Bismuth', nameCn: '铋', color: '#9E4FB5', radius: 1.48, vdwRadius: 2.07, mass: 208.98 },
  U:  { number: 92, symbol: 'U', name: 'Uranium', nameCn: '铀', color: '#008FFF', radius: 1.96, vdwRadius: 1.86, mass: 238.03 }
};

// Periodic Table Layout definition for interactive selector modal
export interface PeriodicElementGridItem {
  symbol: string;
  row: number; // 1-7
  col: number; // 1-18
}

export const PERIODIC_GRID: PeriodicElementGridItem[] = [
  { symbol: 'H', row: 1, col: 1 },
  { symbol: 'He', row: 1, col: 18 },
  { symbol: 'Li', row: 2, col: 1 }, { symbol: 'Be', row: 2, col: 2 },
  { symbol: 'B', row: 2, col: 13 }, { symbol: 'C', row: 2, col: 14 }, { symbol: 'N', row: 2, col: 15 }, { symbol: 'O', row: 2, col: 16 }, { symbol: 'F', row: 2, col: 17 }, { symbol: 'Ne', row: 2, col: 18 },
  { symbol: 'Na', row: 3, col: 1 }, { symbol: 'Mg', row: 3, col: 2 },
  { symbol: 'Al', row: 3, col: 13 }, { symbol: 'Si', row: 3, col: 14 }, { symbol: 'P', row: 3, col: 15 }, { symbol: 'S', row: 3, col: 16 }, { symbol: 'Cl', row: 3, col: 17 }, { symbol: 'Ar', row: 3, col: 18 },
  { symbol: 'K', row: 4, col: 1 }, { symbol: 'Ca', row: 4, col: 2 }, { symbol: 'Sc', row: 4, col: 3 }, { symbol: 'Ti', row: 4, col: 4 }, { symbol: 'V', row: 4, col: 5 }, { symbol: 'Cr', row: 4, col: 6 }, { symbol: 'Mn', row: 4, col: 7 }, { symbol: 'Fe', row: 4, col: 8 }, { symbol: 'Co', row: 4, col: 9 }, { symbol: 'Ni', row: 4, col: 10 }, { symbol: 'Cu', row: 4, col: 11 }, { symbol: 'Zn', row: 4, col: 12 }, { symbol: 'Ga', row: 4, col: 13 }, { symbol: 'Ge', row: 4, col: 14 }, { symbol: 'As', row: 4, col: 15 }, { symbol: 'Se', row: 4, col: 16 }, { symbol: 'Br', row: 4, col: 17 }, { symbol: 'Kr', row: 4, col: 18 },
  { symbol: 'Rb', row: 5, col: 1 }, { symbol: 'Sr', row: 5, col: 2 }, { symbol: 'Y', row: 5, col: 3 }, { symbol: 'Zr', row: 5, col: 4 }, { symbol: 'Nb', row: 5, col: 5 }, { symbol: 'Mo', row: 5, col: 6 }, { symbol: 'Ru', row: 5, col: 8 }, { symbol: 'Rh', row: 5, col: 9 }, { symbol: 'Pd', row: 5, col: 10 }, { symbol: 'Ag', row: 5, col: 11 }, { symbol: 'Cd', row: 5, col: 12 }, { symbol: 'In', row: 5, col: 13 }, { symbol: 'Sn', row: 5, col: 14 }, { symbol: 'Sb', row: 5, col: 15 }, { symbol: 'Te', row: 5, col: 16 }, { symbol: 'I', row: 5, col: 17 },
  { symbol: 'Cs', row: 6, col: 1 }, { symbol: 'Ba', row: 6, col: 2 }, { symbol: 'La', row: 6, col: 3 }, { symbol: 'W', row: 6, col: 6 }, { symbol: 'Re', row: 6, col: 7 }, { symbol: 'Os', row: 6, col: 8 }, { symbol: 'Ir', row: 6, col: 9 }, { symbol: 'Pt', row: 6, col: 10 }, { symbol: 'Au', row: 6, col: 11 }, { symbol: 'Hg', row: 6, col: 12 }, { symbol: 'Pb', row: 6, col: 14 }, { symbol: 'Bi', row: 6, col: 15 },
  { symbol: 'U', row: 7, col: 3 }
];

export function getElement(symbol: string): ElementInfo {
  // Normalize symbol e.g., 'NA' -> 'Na', 'c' -> 'C'
  const normalized = symbol.length > 1 
    ? symbol[0].toUpperCase() + symbol.slice(1).toLowerCase() 
    : symbol.toUpperCase();
  return ELEMENTS[normalized] || {
    number: 0,
    symbol: normalized,
    name: normalized,
    nameCn: normalized,
    color: '#9E9E9E',
    radius: 1.0,
    vdwRadius: 1.7,
    mass: 1.0
  };
}

// Compact and realistic ball-and-stick display radii (Å) for clean publication figures
export const DEFAULT_DISPLAY_RADII: Record<string, number> = {
  H: 0.18, He: 0.20,
  Li: 0.38, Be: 0.32, B: 0.30, C: 0.28, N: 0.29, O: 0.27, F: 0.26, Ne: 0.24,
  Na: 0.44, Mg: 0.40, Al: 0.40, Si: 0.38, P: 0.38, S: 0.38, Cl: 0.35, Ar: 0.30,
  K: 0.50, Ca: 0.46, Sc: 0.48, Ti: 0.48, V: 0.48, Cr: 0.48, Mn: 0.48, Fe: 0.48,
  Co: 0.48, Ni: 0.48, Cu: 0.48, Zn: 0.46, Ga: 0.42, Ge: 0.40, As: 0.40, Se: 0.40, Br: 0.38, Kr: 0.36,
  Rb: 0.54, Sr: 0.50, Y: 0.52, Zr: 0.52, Nb: 0.52, Mo: 0.52, Ru: 0.50, Rh: 0.50,
  Pd: 0.50, Ag: 0.50, Cd: 0.48, In: 0.46, Sn: 0.44, Sb: 0.44, Te: 0.44, I: 0.42,
  Cs: 0.58, Ba: 0.54, La: 0.54, W: 0.54, Re: 0.52, Os: 0.52, Ir: 0.52, Pt: 0.52,
  Au: 0.52, Hg: 0.50, Pb: 0.50, Bi: 0.48, U: 0.56
};

export function getDisplayRadius(symbol: string): number {
  const normalized = symbol.length > 1 
    ? symbol[0].toUpperCase() + symbol.slice(1).toLowerCase() 
    : symbol.toUpperCase();
  if (DEFAULT_DISPLAY_RADII[normalized]) {
    return DEFAULT_DISPLAY_RADII[normalized];
  }
  const elem = getElement(normalized);
  return Math.min(0.55, Math.max(0.24, elem.radius * 0.35));
}
