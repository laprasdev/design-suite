// DOM contract for GridModule, shared with browser checks.
import { element } from '../elementContract.ts';

/** A module's header, which holds its title and its row. */
export const ModuleHeaderElement = element('module-header');
/** The title's choice: its word and the chosen option's name are the trigger of a list. */
export const ModuleTitleChoiceElement = element('module-title-choice');
/** The chosen option's name inside the title's choice. */
export const ModuleTitleChosenElement = element('module-title-chosen');
