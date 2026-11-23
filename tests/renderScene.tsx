// A browser scene's boot: the suite's stylesheets and default theme, then the scene mounted into the page's root,
// which is an application root, as every consumer mounts the suite's controls, in the theme's text colour, as a
// consumer's root sets it: a control whose text inherits its colour reads on the suite's surfaces.
import type {ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {ApplicationElement} from '../src/react/applicationElements.ts';
import {applyTheme,createTheme} from '../src/theme.ts';
import {SCENE_ROOT_ID} from './sceneRoot.ts';
import '../src/react/styles.css';

export function renderScene(scene: ReactNode): void {
 const root=document.getElementById(SCENE_ROOT_ID);
 if(!root)throw new Error(`A browser scene renders into #${SCENE_ROOT_ID}, which its page lacks.`);
 const theme=createTheme();
 root.classList.add(ApplicationElement.ROOT.className);
 root.style.color=theme.colors.text;
 applyTheme(theme);
 createRoot(root).render(scene);
}
