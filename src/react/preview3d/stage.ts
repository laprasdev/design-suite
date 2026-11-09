import * as THREE from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MODEL_STAGE as settings, modelStagePolicy} from './model.ts';
import type {ModelStageAsset, ModelStageController, ModelStageOptions, ModelStageTheme} from './model.ts';
import {applyModelTransform, disposeModelObject, modelAttachments, prepareModelAsset} from './asset.ts';
import {createModelScene} from './scene.ts';
import {createModelRig} from './rig.ts';
import {createModelPlayback} from './playback.ts';
import {createModelMaterialInspection} from './materials.ts';
import {bindModelRuntimeMaterials, loadModelRuntimeAsset, modelRuntimeAssetProfile} from './runtimeMaterialBinding.ts';
import {modelPreviewPresentation} from './presentation.ts';
import type {ModelPreviewPresentation} from './presentation.ts';
import {createModelEnvironment} from './environment.ts';

interface LoadedModel {
  asset: GLTF;
  placement: THREE.Group;
  playback: ReturnType<typeof createModelPlayback>;
  materials: ReturnType<typeof createModelMaterialInspection>;
  runtimeMaterials?: ReturnType<typeof bindModelRuntimeMaterials>;
  presentation?: ModelPreviewPresentation;
  rig: ReturnType<typeof createModelRig>;
  markers: ReturnType<typeof modelAttachments>;
}
const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error));

export function createModelStage(
  host: HTMLElement, character: ModelStageAsset, theme: ModelStageTheme,
  onReady: (controller: ModelStageController) => void, onError: (error: Error) => void,
  options: ModelStageOptions = {},
): () => void {
  const source = Object.freeze({id: character.id, path: character.path, revision: character.revision,
    attachments: Object.freeze({...character.attachments}), runtimeMaterials: modelRuntimeAssetProfile(character)});
  const policy = modelStagePolicy(options);
  const stage = createModelScene(host, theme, policy);
  const request = new AbortController();
  let loaded: LoadedModel | undefined;
  let environment: ReturnType<typeof createModelEnvironment> | undefined;
  let disposed = false, lastTime = performance.now(), frame = 0;
  const renderedMeshes = new Set<string>();
  const current = () => {
    if (!loaded || disposed) throw new Error('The preview model is not ready.');
    return loaded;
  };
  const setAnimation = (name: string) => {
    current().playback.setAnimation(name);
    stage.requestFit();
  };
  const api: ModelStageController = {
    setAnimation,
    setAnimationTime: value => current().playback.setAnimationTime(value),
    setPlaying: value => current().playback.setPlaying(value),
    setSkeleton: value => api.setDisplay(value ? 'both' : 'model'),
    setDisplay(value) {
      const model = current();
      model.rig.setDisplay(value);
      if (model.presentation) api.setPresentation(model.presentation);
      stage.requestFit();
    },
    setMaterialMode(value) {
      if (current().presentation && value !== 'lit') throw new Error('Runtime presentation requires lit materials.');
      current().materials.setMode(value);
    },
    setTransform: value => applyModelTransform(current().placement, value),
    setPresentation(value) {
      const model = current();
      if (policy.clock !== 'external') throw new Error('Runtime presentation requires an external clock.');
      const accepted = modelPreviewPresentation(value, source.id, source.runtimeMaterials);
      const commit = model.runtimeMaterials?.prepare(accepted.materials);
      if (model.materials.snapshot().materialMode !== 'lit') {
        throw new Error('Runtime presentation requires lit materials.');
      }
      commit?.();
      applyModelTransform(model.placement, accepted.pose);
      model.presentation = accepted;
      if (model.rig.display === 'rig') model.rig.setDisplay('rig');
    },
    setEnvironment(value) {
      if (disposed) throw new Error('The preview has been disposed.');
      if (value !== null && environment?.update(value)) return;
      const next = value === null ? undefined : createModelEnvironment(value);
      environment?.dispose();
      environment = next;
      if (next) stage.scene.add(next.group);
    },
    setCamera: stage.setCamera,
    resetCamera: stage.resetCamera,
    snapshot() {
      const model = current();
      const positions = model.markers.map(({key, bone}) => [key, bone.getWorldPosition(new THREE.Vector3()).toArray()]);
      const projections = model.markers.map(({key, bone}) =>
        [key, bone.getWorldPosition(new THREE.Vector3()).project(stage.camera).toArray()]);
      const poses: Record<string, THREE.QuaternionTuple> = {};
      model.asset.scene.traverse(node => {
        if (node instanceof THREE.Bone) poses[node.name] = node.quaternion.toArray();
      });
      return {
        id: source.id, ...model.playback.snapshot(), ...model.rig.snapshot(), ...model.materials.snapshot(),
        attachmentPositions: Object.fromEntries(positions), attachmentProjections: Object.fromEntries(projections),
        poses, triangles: stage.renderer.info.render.triangles, renderedModelMeshes: renderedMeshes.size,
        canvas: {width: stage.renderer.domElement.width, height: stage.renderer.domElement.height},
      };
    },
  };
  const animate = (now: number) => {
    const delta = Math.min((now - lastTime) / settings.millisecondsPerSecond, settings.maxFrameDelta);
    lastTime = now;
    if (loaded) {
      loaded.playback.update(delta, !document.hidden);
      loaded.placement.updateMatrixWorld(true);
      loaded.rig.update();
      stage.fit(loaded.placement, loaded.rig.display === 'model' ? undefined : loaded.rig.bounds());
    }
    if (stage.controls.enabled) stage.controls.update();
    stage.renderer.render(stage.scene, stage.camera);
    frame = requestAnimationFrame(animate);
  };
  const load = (asset: GLTF) => {
    if (disposed) {disposeModelObject(asset.scene); return;}
    const acquired: Array<() => void> = [];
    try {
      const placement = prepareModelAsset(asset, policy);
      const markers = modelAttachments(asset, source, theme);
      acquired.push(() => markers.forEach(({marker}) => {marker.removeFromParent(); disposeModelObject(marker);}));
      asset.scene.traverse(node => {
        if (node instanceof THREE.Mesh) node.onAfterRender = () => {renderedMeshes.add(node.uuid);};
      });
      const materials = createModelMaterialInspection(asset.scene);
      acquired.push(() => materials.dispose());
      const runtimeMaterials = source.runtimeMaterials
        ? bindModelRuntimeMaterials(asset, source.runtimeMaterials) : undefined;
      if (runtimeMaterials) acquired.push(() => runtimeMaterials.dispose());
      const rig = createModelRig(asset.scene, theme, markers);
      acquired.push(() => {rig.root.removeFromParent(); disposeModelObject(rig.root);});
      stage.scene.add(placement, rig.root, ...markers.map(({marker}) => marker));
      const playback = createModelPlayback(asset.scene, asset.animations, policy.clock);
      loaded = {asset, placement, markers, rig, playback, materials, runtimeMaterials};
      if (options.reviewKey) Object.defineProperty(host, options.reviewKey, {value: api, configurable: true});
      onReady(api);
    } catch (error) {
      if (!loaded) {
        for (const dispose of acquired.reverse()) dispose();
        asset.scene.parent?.removeFromParent();
        disposeModelObject(asset.scene);
      }
      if (!disposed) onError(asError(error));
    }
  };
  const fail = (error: unknown) => {if (!disposed) onError(asError(error));};
  if (source.runtimeMaterials) {
    loadModelRuntimeAsset(source.path, source.runtimeMaterials, request.signal).then(load, fail);
  }
  else new GLTFLoader().load(source.path, load, undefined, fail);
  frame = requestAnimationFrame(animate);
  return () => {
    if (disposed) return;
    disposed = true;
    request.abort();
    cancelAnimationFrame(frame);
    loaded?.playback.dispose();
    loaded?.runtimeMaterials?.dispose();
    loaded?.materials.dispose();
    environment?.dispose();
    stage.dispose();
    if (options.reviewKey && Reflect.get(host, options.reviewKey) === api) {
      Reflect.deleteProperty(host, options.reviewKey);
    }
  };
}
