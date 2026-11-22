// What the pending test renders (buttonPendingScene.tsx) and reads: each row of Buttons and SettingBooleans by its
// element, the consumer Button that sets its own `data-pending`, the form whose submits the scene counts, a swept
// SegmentedControl in each form saving one of its options, and live tabs with detail and pending tabs,
// each counting its changes.
import {element} from '../src/react/elementContract.ts';

export const PendingSceneElement=Object.freeze({
 LIVE:element('pending-scene-live'),PENDING:element('pending-scene-pending'),
 CONSUMER_ATTRIBUTE:element('pending-scene-consumer-attribute'),DETAIL:element('pending-scene-detail'),
 FORM:element('pending-scene-form'),FIELD:element('pending-scene-field'),SUBMIT:element('pending-scene-submit'),
 SEGMENT:element('pending-scene-segment'),TABS:element('pending-scene-tabs'),
 LIVE_TABS:element('pending-scene-live-tabs'),
});
// The form's submit count, written on the form element each time it submits, and each tab list's change count,
// written on the element around it each time it changes.
export const SUBMIT_COUNT_ATTRIBUTE='data-submits';
export const CHANGE_COUNT_ATTRIBUTE='data-changes';
export const SETTING_LABEL='Pool colliders';
// The swept SegmentedControls' options (whether each draws a glyph beside its text), and the one they are saving with
// what it says meanwhile.
export const SEGMENT_OPTIONS=Object.freeze([{value:'draft',label:'Draft',glyph:true},
 {value:'final',label:'Final',glyph:false}] as const);
export const SEGMENT_SAVING=Object.freeze({value:SEGMENT_OPTIONS[1].value,label:'Saving'});
