import {element} from './elementContract.ts';

// DOM contract for ListboxSelect, shared with browser checks: its trigger (a
// combobox button; `data-shows-value` when it shows the chosen option as a field),
// the listbox popover and each option (`data-active` on the one the keys are on).
export const ListboxElement=Object.freeze({
 TRIGGER:element('listbox-select'),
 POPOVER:element('listbox-select-popover'),
 LIST:element('listbox-select-list'),
 DETAIL:element('listbox-select-detail'),
 OPTION:element('listbox-select-option'),
 CONTENT:element('listbox-select-content'),
 LABEL:element('listbox-select-label'),
 IMPACT:element('listbox-select-impact'),
});
