import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';

// The panel actor's id, which its asset and its engine entity share, and the route its file is served at.
export const PANEL_GLB = Object.freeze({id: 'panel', route: 'http://scene.local/panel.glb'});
// The panel a browser scene's actor draws: a grey board standing a metre up, as a binary glTF's bytes.
export async function makePanelGlbBytes(): Promise<number[]> {
  const geometry = new THREE.BoxGeometry(1.6, 1.6, 0.2).translate(0, 1, 0);
  const material = new THREE.MeshStandardMaterial({color: new THREE.Color(0.55, 0.56, 0.6), roughness: 0.85});
  const glb = await new GLTFExporter().parseAsync(new THREE.Mesh(geometry, material), {binary: true});
  if (!(glb instanceof ArrayBuffer)) throw new Error('Expected binary GLB from GLTFExporter.');
  return Array.from(new Uint8Array(glb));
}
declare global {
  interface Window {
    makePanelGlbBytes: () => Promise<number[]>;
  }
}
