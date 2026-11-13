// Synthetic actors for the stage's actor and layer tests: no file, no renderer. Each clip moves one bone's x so that
// clip k at time t reads clipValue(k, t), which makes every blended value predictable.
import * as THREE from 'three';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {createModelActor, type ModelActorContext} from '../src/react/preview3d/actor.ts';
import {MODEL_ACTOR_ANIMATION, MODEL_ANIMATION_LAYER, MODEL_STAGE_FRAMING, MODEL_STAGE_ORIGIN, MODEL_STAGE_SIZE,
  MODEL_STAGE_THEME_LIGHTING, modelStagePolicy,
  type ModelStageActor, type ModelStageClock}
  from '../src/react/preview3d/model.ts';

export const BONE = 'tip';
export const BIND: readonly [number, number, number] = [2, 3, 4];
export const clipValue = (index: number, time: number) => (index + 1) * 10 + time;
export interface ClipSpec {name: string; duration: number}

export function actorAsset(clips: readonly ClipSpec[], skeleton = true) {
  // With a skeleton, the box is skinned whole to its one bone, so the bone is a joint the skin uses.
  const geometry = new THREE.BoxGeometry(1, 1, 1), count = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(
    Array.from({length: count}, () => [1, 0, 0, 0]).flat(), 4));
  const scene = new THREE.Group(), body = skeleton ? new THREE.SkinnedMesh(geometry) : new THREE.Mesh(geometry);
  scene.add(body);
  const bone = new THREE.Bone();
  bone.name = BONE;
  bone.position.fromArray(BIND);
  if (body instanceof THREE.SkinnedMesh) {
    scene.add(bone);
    scene.updateMatrixWorld(true);
    body.bind(new THREE.Skeleton([bone]));
  }
  const animations = clips.map(({name, duration}, index) => new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack(`${BONE}.position`, [0, duration],
      [clipValue(index, 0), 0, 0, clipValue(index, duration), 0, 0]),
  ]));
  return {asset: {scene, animations} as unknown as GLTF, bone, body};
}

export function actorContext(clock: ModelStageClock = 'external') {
  const scene = new THREE.Scene();
  const context: ModelActorContext = {
    policy: modelStagePolicy({reviewKey: 'review', clock, floor: false, grid: false, kinds: []}), scene,
    theme: {colors: {stage: '#000', text: '#fff', surface: '#111', surfaceHi: '#222', accent: '#f00',
      accentDeep: '#800', teal: '#0ff'}},
    lighting: {attach: () => () => undefined}, rendered: () => undefined,
    fog: createModelFog(scene).change, surfaceModes: createModelSurfaceModes(),
  };
  return {context, scene};
}

export const REST = Object.freeze({kind: MODEL_ACTOR_ANIMATION.rest});
export const held = (name: string, timeSeconds: number) => ({kind: MODEL_ACTOR_ANIMATION.held, name, timeSeconds});
export const playing = (name: string) => ({kind: MODEL_ACTOR_ANIMATION.playing, name});
// The identity, stated whole as every placement is.
export const STANDING = Object.freeze({position: [0, 0, 0], rotationQuaternion: [0, 0, 0, 1],
  scale: [1, 1, 1]} as const);
export const standingAt = (position: readonly [number, number, number]) => ({...STANDING, position});
export const FILE_SURFACES = Object.freeze({kind: 'file'} as const);
export const declaration = (id: string, modelId = 'otter', extra: Partial<ModelStageActor> = {}): ModelStageActor =>
  ({id, asset: {id: modelId, path: `${modelId}.glb`}, placement: STANDING, animation: REST,
    surfaces: FILE_SURFACES, ...extra});

export function makeActor(id: string, clips: readonly ClipSpec[], extra: Partial<ModelStageActor> = {},
  context = actorContext().context) {
  const {asset, bone, body} = actorAsset(clips);
  return {actor: createModelActor(asset, declaration(id, 'otter', extra), context), bone, body};
}

export const sample = (clipId: string, timeSeconds: number, weight = 1, sampleId = `base/${clipId}#0`) =>
  ({sampleId, clipId, timeSeconds, weight});
export const layer = (...samples: ReturnType<typeof sample>[]) =>
  ({layerId: 'base', weight: 1, blendMode: MODEL_ANIMATION_LAYER.override, samples});
export const entity = (entityId: string, animationLayers: unknown[] = [], position = [0, 0, 0], modelId = 'otter') =>
  ({entityId, modelId, animationLayers, partPoses: [], materials: [],
    pose: {position, rotationQuaternion: [0, 0, 0, 1], scale: [1, 1, 1]}});
export const frame = (simulationTimeSeconds: number, ...entities: unknown[]) => ({simulationTimeSeconds, entities});
export const close = (actual: number, expected: number, tolerance = 1e-6) =>
  {if (Math.abs(actual - expected) > tolerance) throw new Error(`Expected ${expected}, read ${actual}.`);};
// A whole stage description with one declared actor a; a test overrides the parts it is about.
export const describing = (changes: Record<string, unknown> = {}) => ({
  actors: {focus: 'a', actors: [declaration('a')]}, environment: null, framing: {kind: MODEL_STAGE_FRAMING.focus},
  orbit: true, lighting: MODEL_STAGE_THEME_LIGHTING, surfaceSets: {}, display: 'model', materialMode: 'lit',
  size: {rule: MODEL_STAGE_SIZE.real}, origin: MODEL_STAGE_ORIGIN.file,
  ...changes});
