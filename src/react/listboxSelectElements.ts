import {element} from './elementContract.ts';

// DOM contract for ListboxSelect, shared with browser checks: its trigger (a combobox,
// or by ListboxForm a menu button; `data-shows-value` when it is drawn as a field),
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
 CARET:element('listbox-select-caret'),
});
// ListboxSelect's forms: the select holds a value and shows it; the step is a select whose arrows, while it is closed,
// step the choice to the next option instead of opening the list; the menu runs an action and holds none.
export const ListboxForm=Object.freeze({SELECT:'select',STEP:'step',MENU:'menu'} as const);
export type ListboxForm=typeof ListboxForm[keyof typeof ListboxForm];
// What each form's parts are to assistive technology: the trigger's role and the popup it opens, each item's role,
// whether the form holds a value (marking the chosen item and skipping a repeat choice), and where focus sits while it
// is open (the select-only combobox keeps it on its trigger; a menu button moves it into its menu), and whether the
// arrows on the closed trigger step the choice rather than open the list. Either way the focused part names the active
// item.
interface ListboxFormRoles {
 trigger: 'combobox'|'button';
 popup: 'listbox'|'menu';
 item: 'option'|'menuitem';
 holdsValue: boolean;
 focus: 'trigger'|'list';
 closedArrowsStep: boolean;
}
export const LISTBOX_FORM_ROLES: Readonly<Record<ListboxForm,Readonly<ListboxFormRoles>>>=Object.freeze({
 [ListboxForm.SELECT]:Object.freeze({trigger:'combobox',popup:'listbox',item:'option',holdsValue:true,focus:'trigger',
  closedArrowsStep:false}),
 [ListboxForm.STEP]:Object.freeze({trigger:'combobox',popup:'listbox',item:'option',holdsValue:true,focus:'trigger',
  closedArrowsStep:true}),
 [ListboxForm.MENU]:Object.freeze({trigger:'button',popup:'menu',item:'menuitem',holdsValue:false,focus:'list',
  closedArrowsStep:false}),
});
