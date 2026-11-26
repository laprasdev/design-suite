// A browser scene that draws with three's renderer alone, outside the stage: a canvas of the viewport's size at pixel
// ratio 1, cleared to black, written in linear light with no antialiasing, so each byte read back is the program's own
// output. The scene mounts the canvas and reads whole frames back (framePixels.ts).
import * as THREE from 'three';
import {readFramePixels} from './framePixels.ts';
import {renderScene} from './renderScene.tsx';

/** A frame's bytes as they cross from the page to the test. */
export interface FramePixels {
  /** The whole frame's RGBA bytes, bottom row first. */
  readonly pixels: number[];
}

export function mountPixelReadScene({width, height}: {readonly width: number; readonly height: number}) {
  const renderer = new THREE.WebGLRenderer({antialias: false});
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  renderScene(<div ref={parent => { parent?.append(renderer.domElement); }}/>);
  return {
    /** Draws the scene through the camera and reads the frame back. */
    readFrame(scene: THREE.Scene, camera: THREE.Camera): FramePixels {
      renderer.render(scene, camera);
      return {pixels: Array.from(readFramePixels(renderer.getContext()))};
    },
  };
}
