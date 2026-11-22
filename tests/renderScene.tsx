// A browser scene's boot: the suite's stylesheets and default theme, then the scene mounted into the page's root,
// which is an application root, as every consumer mounts the suite's controls.
import type {ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {ApplicationElement} from '../src/react/applicationElements.ts';
import {applyTheme,createTheme} from '../src/theme.ts';
import {SCENE_ROOT_ID} from './sceneRoot.ts';
import '../src/react/styles.css';

export function renderScene(scene: ReactNode): void {
 const root=document.getElementById(SCENE_ROOT_ID);
 if(!root)throw new Error(`A browser scene renders into #${SCENE_ROOT_ID}, which its page lacks.`);
 root.classList.add(ApplicationElement.ROOT.className);
 applyTheme(createTheme());
 createRoot(root).render(scene);
}
