import * as THREE from 'three';

// The bounds three culls a renderer by, grown by how far its kind may move its vertices. three r180 culls a mesh by a
// sphere (Frustum.intersectsObject): the mesh's own `boundingSphere` where it has that field (a skinned, instanced or
// batched mesh), else its geometry's, carried into world space by the mesh's world matrix, whose largest scale on an
// axis multiplies the radius. A kind moves a vertex at most its reach, in metres of world space. So while a moving
// kind draws a renderer, the renderer has a sphere of its own: the one three would use, its radius grown by the reach
// divided by that scale, read when three reads it, so that in world space the sphere grows by exactly the reach,
// whatever the renderer's scale and whatever reach the frame gives this renderer. A scale of 0 grows it without end:
// a renderer shrunk to a point that moves its vertices is drawn whatever the view.
const FIELD = 'boundingSphere';
type Bounded = THREE.Mesh & {boundingSphere?: THREE.Sphere | null; computeBoundingSphere?: () => void};

/** Grows the renderer's culling sphere by `reach()` metres; the returned function gives three its own back. */
export function padModelBoundsByReach(node: THREE.Mesh, reach: () => number): () => void {
  const mesh = node as Bounded, own = Object.hasOwn(mesh, FIELD);
  // A mesh that keeps its own sphere has it computed now, as three would at its first cull, before the field is the
  // stage's (three computes it only while the field is null).
  if (own && mesh.boundingSphere === null) mesh.computeBoundingSphere!();
  const kept = own ? mesh.boundingSphere! : null;
  const base = () => {
    if (kept) return kept;
    if (mesh.geometry.boundingSphere === null) mesh.geometry.computeBoundingSphere();
    return mesh.geometry.boundingSphere!;
  };
  const grown = new THREE.Sphere();
  Object.defineProperty(mesh, FIELD, {configurable: true, enumerable: true, get() {
    const sphere = base();
    grown.center.copy(sphere.center);
    grown.radius = sphere.radius + reach() / mesh.matrixWorld.getMaxScaleOnAxis();
    return grown;
  }});
  return () => {
    Reflect.deleteProperty(mesh, FIELD);
    if (own) mesh.boundingSphere = kept;
  };
}
