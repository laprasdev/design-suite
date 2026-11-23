// DOM contract for GridModule, shared with browser checks.
import { element } from '../elementContract.ts';

/** A module's header, which holds its title and its row, names its module in this attribute. */
export const MODULE_HEADER_ATTRIBUTE = 'data-module-header';
/** A module header's form; omitted on a plain header so only a choice header marks itself. */
export const MODULE_HEADER_FORM_ATTRIBUTE = 'data-header-form';
export const ModuleHeaderForm = Object.freeze({ CHOICE: 'choice' } as const);
/** The title's word when it heads a choice: the trigger of a step list, followed by its carets flanking the name. */
export const ModuleTitleChoiceElement = element('module-title-choice');
