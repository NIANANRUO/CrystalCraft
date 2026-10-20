export interface PresetSample {
  id: string;
  name: string;
  formula: string;
  type: 'cif' | 'poscar';
  description: string;
  data: string;
}

// No structure data ships with the application. Import local files to begin.
export const PRESET_STRUCTURES: PresetSample[] = [];
