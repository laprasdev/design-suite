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
});
// ListboxSelect's forms: the select holds a value and shows it; the menu runs an action and holds none.
export const ListboxForm=Object.freeze({SELECT:'select',MENU:'menu'} as const);
export type ListboxForm=typeof ListboxForm[keyof typeof ListboxForm];
// What each form's parts are to assistive technology: the trigger's role and the popup it opens, each item's role,
// whether the form holds a value (marking the chosen item and skipping a repeat choice), and where focus sits while it
// is open (the select-only combobox keeps it on its trigger; a menu button moves it into its menu). Either way the
// focused part names the active item.
interface ListboxFormRoles {
 trigger: 'combobox'|'button';
 popup: 'listbox'|'menu';
 item: 'option'|'menuitem';
 holdsValue: boolean;
 focus: 'trigger'|'list';
}
export const LISTBOX_FORM_ROLES: Readonly<Record<ListboxForm,Readonly<ListboxFormRoles>>>=Object.freeze({
 [ListboxForm.SELECT]:Object.freeze({trigger:'combobox',popup:'listbox',item:'option',holdsValue:true,focus:'trigger'}),
 [ListboxForm.MENU]:Object.freeze({trigger:'button',popup:'menu',item:'menuitem',holdsValue:false,focus:'list'}),
});
