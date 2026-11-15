// A scene a browser test measures: esbuild bundles the scene module (a .tsx rendering into #root) with the suite's
// stylesheets, and Chromium opens it at the given viewport with reduced motion. A script error in the scene fails the
// test. The browser closes after the file's tests. Playwright is a gate tool: `npm test` installs it and its Chromium.
import assert from 'node:assert/strict';
import {after} from 'node:test';
import {build} from 'esbuild';
import playwright from '../scripts/gateTools/node_modules/playwright/index.js';
import type {Page} from '../scripts/gateTools/node_modules/playwright/index.js';
import {SUITE_ROOT} from './bundled.ts';

export interface Viewport {readonly width: number; readonly height: number}

export async function openScene(scene: string,viewport: Viewport): Promise<Page> {
 const {outputFiles}=await build({absWorkingDir:SUITE_ROOT,entryPoints:[scene],bundle:true,write:false,outdir:'scene',
  format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'css'},define:{'process.env.NODE_ENV':'"production"'},
  logLevel:'warning'});
 const bundledText=(extension: string)=>outputFiles.find(file=>file.path.endsWith(extension))?.text
  ??assert.fail(`esbuild wrote no ${extension} file for ${scene}`);
 const browser=await playwright.chromium.launch();
 after(()=>browser.close());
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});
 page.on('pageerror',error=>assert.fail(`${scene} threw: ${error.message}`));
 await page.setContent('<!doctype html><body><div id="root"></div></body>');
 await page.addStyleTag({content:bundledText('.css')});
 await page.addScriptTag({content:bundledText('.js')});
 return page;
}
