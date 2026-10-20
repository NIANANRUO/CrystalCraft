import * as THREE from 'three';

/** Only opaque objects are batched; transmission/alpha need per-object sorting. */
export function batchOpaqueMeshes(group: THREE.Group, cache: Map<string, THREE.Material>) {
  const buckets = new Map<string, THREE.Mesh[]>();
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || Array.isArray(child.material) || child.material.transparent || (child.material as THREE.MeshPhysicalMaterial).transmission > 0) continue;
    const key = `${child.material.uuid}:${child.geometry.uuid}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(child); buckets.set(key, bucket);
  }
  for (const meshes of buckets.values()) {
    const original = meshes[0].material as THREE.Material;
    if (meshes.length < 2 || meshes.some(mesh => mesh.geometry !== meshes[0].geometry)) continue;
    let material = original;
    if (original instanceof THREE.ShaderMaterial) {
      // All app shaders use these two expressions. Refuse unfamiliar shaders.
      const mainEntry=/void\s+main\s*\(\s*\)\s*\{/;
      if (!mainEntry.test(original.vertexShader)||!original.vertexShader.includes('normalMatrix * normal') || !original.vertexShader.includes('vec4(position, 1.0)')) continue;
      const key = `instance:${original.uuid}`;
      if (!cache.has(key)) {
        const clone = original.clone();
        for (const key of ['uLightDir', 'uLightAngle']) if (original.uniforms[key]) clone.uniforms[key] = original.uniforms[key];
        clone.vertexShader = clone.vertexShader.replace(mainEntry, `void main() {
          vec3 instanceNormal = mat3(instanceMatrix) * (normal / vec3(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz), dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz)));`)
          .split('normalMatrix * normal').join('normalMatrix * instanceNormal')
          .split('vec4(position, 1.0)').join('(instanceMatrix * vec4(position, 1.0))');
        cache.set(key, clone);
      }
      material = cache.get(key)!;
    }
    const batch = new THREE.InstancedMesh(meshes[0].geometry, material, meshes.length);
    batch.castShadow = meshes[0].castShadow; batch.receiveShadow = meshes[0].receiveShadow;
    batch.userData.atomIds = meshes.map(mesh => mesh.userData.atomId);
    if (meshes[0].userData.atomId === undefined) batch.raycast = () => {};
    meshes.forEach((mesh, index) => { mesh.updateMatrix(); batch.setMatrixAt(index, mesh.matrix); group.remove(mesh); });
    batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); group.add(batch);
  }
}
export function instanceAtomId(hit: THREE.Intersection): number | undefined {
  return hit.instanceId !== undefined ? hit.object.userData.atomIds?.[hit.instanceId] : hit.object.userData.atomId;
}
export function renderedInstanceCount(group: THREE.Group): number {
  return group.children.reduce((count, child) => count + (child instanceof THREE.InstancedMesh ? child.count : 1), 0);
}
