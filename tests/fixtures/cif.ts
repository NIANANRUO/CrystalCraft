/** Artificial coordinates for parser/UI regression, not user research structures. */
export const TEST_LEGACY_SITE_ORDER_CIF = `data_synthetic_legacy
_cell_length_a 6
_cell_length_b 7
_cell_length_c 8
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_space_group_IT_number 2
loop_
_space_group_symop_operation_xyz
'x,y,z'
'-x,-y,-z'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_symmetry_multiplicity
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
C1 C 1 .15 .27 .31 .5
O1 O 2 0 0 0 1
`;

// Conventional P 63/m m c operators; source coordinates deliberately round 1/3.
export const TEST_ROUNDED_HEXAGONAL_CIF = `data_synthetic_hexagonal
_cell_length_a 4.2
_cell_length_b 4.2
_cell_length_c 20
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 120
_space_group_IT_number 194
loop_
_space_group_symop_operation_xyz
'x,y,z'
'-x,-y,-z'
'x-y,x,z+1/2'
'-x+y,-x,-z+1/2'
'-y,x-y,z'
'y,-x+y,-z'
'-x,-y,z+1/2'
'x,y,-z+1/2'
'-x+y,-x,z'
'x-y,x,-z'
'y,-x+y,z+1/2'
'-y,x-y,-z+1/2'
'-y,-x,-z+1/2'
'y,x,z+1/2'
'-x,-x+y,-z'
'x,x-y,z'
'-x+y,y,-z+1/2'
'x-y,-y,z+1/2'
'y,x,-z'
'-y,-x,z'
'x,x-y,-z+1/2'
'-x,-x+y,z+1/2'
'x-y,-y,-z'
'-x+y,y,z'
loop_
_atom_site_type_symbol
_atom_site_label
_atom_site_symmetry_multiplicity
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
Zr Zr1 4 .33333333 .66666667 .13712345 1
Zr Zr2 2 0 0 0 1
Si Si1 2 0 0 .25 1
N N1 4 .33333333 .66666667 .41324851 1
`;

// A different artificial special site written with only five decimal places.
export const TEST_ROUNDED_PLANAR_CIF = TEST_ROUNDED_HEXAGONAL_CIF.slice(0, TEST_ROUNDED_HEXAGONAL_CIF.indexOf('Zr Zr1'))
  + 'C C1 6 .18183 .36365 .25 1\n';
