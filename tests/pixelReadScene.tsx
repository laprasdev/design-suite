// A browser scene that draws with three's renderer alone, outside the stage: a canvas of the viewport's size at pixel
// ratio 1, cleared to black, written in linear light with no antialiasing, so each byte read back is the program's own
// output. The scene mounts the canvas and reads whole frames back (framePixels.ts), drawn by three's renderer straight
// or by a draw over it, such as the stage's (draw.ts).
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
    renderer,
    /** Draws a frame with the renderer and reads it back. */
    readFrame(draw: () => void): FramePixels {
      draw();
      return {pixels: Array.from(readFramePixels(renderer.getContext()))};
    },
  };
}
