import {element} from './elementContract.ts';

export const SettingElement=Object.freeze({
 FIELD:element('setting-field'),
 HEADING:element('setting-field-heading'),
 CHOICES:element('setting-choice'),
});

// The chosen step is a number; steps below a control's minimum remain clickable.
export const METER_VALUE_ATTRIBUTE='data-value';
export const METER_FIXED_ATTRIBUTE='data-fixed';
