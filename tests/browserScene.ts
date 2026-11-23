// A scene a browser test measures: esbuild bundles the scene module (a .tsx calling renderScene) with the suite's
// stylesheets, and Chromium opens it at the given viewport with reduced motion. A script error in the scene fails the
// test. The browser closes after the file's tests. Playwright is a gate tool: `npm test` installs it and its Chromium.
import assert from 'node:assert/strict';
import {after} from 'node:test';
import {build} from 'esbuild';
import playwright from '../scripts/gateTools/node_modules/playwright/index.js';
import type {Page,ViewportSize} from '../scripts/gateTools/node_modules/playwright/index.js';
import {FONT_ROUTE_FILES} from '../src/fonts.ts';
import {Breakpoint} from '../src/react/breakpoints.ts';
import {SUITE_ROOT} from './bundled.ts';
import {SCENE_ROOT_ID} from './sceneRoot.ts';

// The desktop window a scene opens in, and a phone's: the widest window the phone layout takes (its query is
// inclusive), as tall as the desktop one.
export const DESKTOP_VIEWPORT: ViewportSize=Object.freeze({width:1280,height:800});
export const PHONE_VIEWPORT: ViewportSize=Object.freeze({width:Breakpoint.PHONE,height:DESKTOP_VIEWPORT.height});
// A handheld phone's window, narrower than every breakpoint: where a module header has the least room.
export const HANDSET_VIEWPORT: ViewportSize=Object.freeze({width:390,height:844});

// The GL a scene draws with: the gate's software rasteriser, which every machine running the gate has, or this
// machine's GPU through ANGLE's Metal backend, which a frame's cost is measured on.
export const SCENE_GL=Object.freeze({software:Object.freeze([]),
 metal:Object.freeze(['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'])});
export type SceneGl=typeof SCENE_GL[keyof typeof SCENE_GL];

// The page's origin: localhost is a secure context, so the scene has what only one has (crypto.subtle's digests, which
// the stage's file reads check); every file a scene reads is routed by its test.
const SCENE_ORIGIN='http://localhost/';

export async function openScene(scene: string,viewport: ViewportSize,gl: SceneGl): Promise<Page> {
 const {outputFiles}=await build({absWorkingDir:SUITE_ROOT,entryPoints:[scene],bundle:true,write:false,outdir:'scene',
  format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'css'},external:[FONT_ROUTE_FILES],
  define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
 const bundledText=(extension: string)=>outputFiles.find(file=>file.path.endsWith(extension))?.text
  ??assert.fail(`esbuild wrote no ${extension} file for ${scene}`);
 const browser=await playwright.chromium.launch({args:[...gl]});
 after(()=>browser.close());
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});
 page.on('pageerror',error=>assert.fail(`${scene} threw: ${error.message}`));
 // A file the scene's test does not route is one the origin does not hold.
 await page.route(`${SCENE_ORIGIN}**`,route=>route.fulfill({status:404}));
 await page.route(SCENE_ORIGIN,route=>route.fulfill({contentType:'text/html',
  body:`<!doctype html><body><div id="${SCENE_ROOT_ID}"></div></body>`}));
 await page.goto(SCENE_ORIGIN);
 await page.addStyleTag({content:bundledText('.css')});
 await page.addScriptTag({content:bundledText('.js')});
 return page;
}
