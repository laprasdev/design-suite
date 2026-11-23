// DOM contract for GridModule, shared with browser checks.
import { element } from '../elementContract.ts';

/** A module's header, which holds its title and its row, names its module in this attribute. */
export const MODULE_HEADER_ATTRIBUTE = 'data-module-header';
/** A module header's form; omitted on a plain header so only a choice header marks itself. */
export const MODULE_HEADER_FORM_ATTRIBUTE = 'data-header-form';
export const ModuleHeaderForm = Object.freeze({ CHOICE: 'choice' } as const);
export type ModuleHeaderFormValue = typeof ModuleHeaderForm[keyof typeof ModuleHeaderForm];
/** The title's choice: its word and the chosen option's name are the trigger of a list, its step carets beside it. */
export const ModuleTitleChoiceElement = element('module-title-choice');
/** The chosen option's name inside the title's choice. */
export const ModuleTitleChosenElement = element('module-title-chosen');
