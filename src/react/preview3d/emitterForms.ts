import * as THREE from 'three';
import {MODEL_EMITTER_FORM, type ModelEmitterForm, type ModelEmitterMesh, type ModelEmitterProfile}
  from './emitterModel.ts';

// How each of a profile's forms draws (emitters.ts runs them): its geometry, material and object, and the lines its
// program places and projects a particle's vertex with.
/** The particle's look until the owner decides its material: added light, a point drawn as a soft disc. A named
 * placeholder. */
export const MODEL_EMITTER_PLACEHOLDER = Object.freeze({blending: THREE.AdditiveBlending,
  shade: Object.freeze({[MODEL_EMITTER_FORM.points]:
    'diffuseColor.a *= 1.0 - smoothstep( 0.0, 0.5, length( gl_PointCoord - 0.5 ) );', [MODEL_EMITTER_FORM.mesh]: ''})});
// A dead slot draws no pixel: no size, and outside the clip volume.
const CULL_DEAD = 'if ( vEmitterSize <= 0.0 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );';
// A built-in mesh's geometry, from its row's segments (the sphere is the one row).
const meshGeometry = ({segments: {radius, widthSegments, heightSegments}}: ModelEmitterMesh) =>
  new THREE.SphereGeometry(radius, widthSegments, heightSegments);
// A profile's geometry, one slot per particle: a point each, or one instance each of its mesh's vertices.
export function modelParticleGeometry({particle, maxParticles}: ModelEmitterProfile) {
  const slots = Float32Array.from({length: maxParticles}, (_, slot) => slot);
  if (particle.form === MODEL_EMITTER_FORM.points) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxParticles * 3), 3));
    geometry.setAttribute('emitterSlot', new THREE.BufferAttribute(slots, 1));
    return geometry;
  }
  const mesh = meshGeometry(particle.mesh), geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(mesh.index);
  for (const [name, attribute] of Object.entries(mesh.attributes)) geometry.setAttribute(name, attribute);
  geometry.setAttribute('emitterSlot', new THREE.InstancedBufferAttribute(slots, 1));
  geometry.instanceCount = maxParticles;
  return geometry;
}
// Each form: its material, its object, and where its program puts a vertex.
export const MODEL_EMITTER_FORMS = Object.freeze({
  [MODEL_EMITTER_FORM.points]: Object.freeze({
    material: () => new THREE.PointsMaterial({size: 1, sizeAttenuation: true}),
    object: (geometry: THREE.BufferGeometry, material: THREE.Material) => new THREE.Points(geometry, material),
    place: 'vec3 transformed = emitterCentre;',
    project: `gl_PointSize = vEmitterSize * projectionMatrix[ 1 ][ 1 ] * scale / - mvPosition.z;\n${CULL_DEAD}`,
  }),
  [MODEL_EMITTER_FORM.mesh]: Object.freeze({
    material: () => new THREE.MeshBasicMaterial(),
    object: (geometry: THREE.BufferGeometry, material: THREE.Material) => new THREE.Mesh(geometry, material),
    place: 'vec3 transformed = emitterCentre + position * vEmitterSize;',
    project: CULL_DEAD,
  }),
} satisfies Record<ModelEmitterForm, unknown>);

