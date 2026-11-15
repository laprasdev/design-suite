// The page the action bar height test measures in a browser: a compact ActionBar holding a Button in each slot.
import {createRoot} from 'react-dom/client';
import {ActionBar,Button} from '../src/react/index.ts';
import {applyTheme,createTheme} from '../src/theme.ts';
import {ACTION_BAR_BUTTONS} from './actionBarHeightCases.ts';
import '../src/react/styles.css';

const root=document.getElementById('root');
if(!root)throw new Error('The action bar scene renders into #root, which its page lacks.');
applyTheme(createTheme());
createRoot(root).render(<ActionBar compact slots={{
 left:<Button variant="primary">{ACTION_BAR_BUTTONS.left}</Button>,
 center:<Button>{ACTION_BAR_BUTTONS.center}</Button>,
 right:<Button variant="subtle">{ACTION_BAR_BUTTONS.right}</Button>,
}}/>);
