// A scene a browser test measures: esbuild bundles the scene module (a .tsx calling renderScene) with the suite's
// stylesheets, and Chromium opens it at the given viewport with reduced motion. A script error in the scene fails the
// test. The browser closes after the file's tests. Playwright is a gate tool: `npm test` installs it and its Chromium.
import assert from 'node:assert/strict';
import {after} from 'node:test';
import {build} from 'esbuild';
import playwright from '../scripts/gateTools/node_modules/playwright/index.js';
import type {Page,ViewportSize} from '../scripts/gateTools/node_modules/playwright/index.js';
import {Breakpoint} from '../src/react/breakpoints.ts';
import {SUITE_ROOT} from './bundled.ts';
import {SCENE_ROOT_ID} from './sceneRoot.ts';

// The desktop window a scene opens in, and a phone's: the widest window the phone layout takes (its query is
// inclusive), as tall as the desktop one.
export const DESKTOP_VIEWPORT: ViewportSize=Object.freeze({width:1280,height:800});
export const PHONE_VIEWPORT: ViewportSize=Object.freeze({width:Breakpoint.PHONE,height:DESKTOP_VIEWPORT.height});

export async function openScene(scene: string,viewport: ViewportSize): Promise<Page> {
 const {outputFiles}=await build({absWorkingDir:SUITE_ROOT,entryPoints:[scene],bundle:true,write:false,outdir:'scene',
  format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'css'},define:{'process.env.NODE_ENV':'"production"'},
  logLevel:'warning'});
 const bundledText=(extension: string)=>outputFiles.find(file=>file.path.endsWith(extension))?.text
  ??assert.fail(`esbuild wrote no ${extension} file for ${scene}`);
 const browser=await playwright.chromium.launch();
 after(()=>browser.close());
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});
 page.on('pageerror',error=>assert.fail(`${scene} threw: ${error.message}`));
 await page.setContent(`<!doctype html><body><div id="${SCENE_ROOT_ID}"></div></body>`);
 await page.addStyleTag({content:bundledText('.css')});
 await page.addScriptTag({content:bundledText('.js')});
 return page;
}
