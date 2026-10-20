import * as THREE from 'three';

/** Dispose textures as well as materials; Material.dispose alone leaves textures alive. */
export function disposeMaterial(material: THREE.Material, textures = new Set<THREE.Texture>()) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture && !textures.has(value)) {
      textures.add(value);
      value.dispose();
    }
  }
  material.dispose();
}

/** Recurse through helpers/groups, keeping resources explicitly owned by the scene cache. */
export function disposeObjectTree(
  root: THREE.Object3D,
  retainedGeometries = new Set<THREE.BufferGeometry>(),
  retainedMaterials = new Set<THREE.Material>()
) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (object instanceof THREE.InstancedMesh) object.dispose();
    const mesh = object as THREE.Mesh;
    // Sprites share Three.js's internal geometry, which is not scene-owned.
    if (mesh.geometry && !(object instanceof THREE.Sprite)) geometries.add(mesh.geometry);
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    }
  });
  geometries.forEach(geometry => { if (!retainedGeometries.has(geometry)) geometry.dispose(); });
  materials.forEach(material => { if (!retainedMaterials.has(material)) disposeMaterial(material, textures); });
}
