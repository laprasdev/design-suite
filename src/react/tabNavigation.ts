// Key navigation through a tab list (SegmentedControl's `tabs`): the arrows along its orientation step through its
// enabled options, coming round at the ends, and Home and End reach the ends. The option a key reaches takes focus,
// then its own press, as from a pointer.
import type {KeyboardEvent} from 'react';
import {listMoves,type ListOrientation} from './listboxNavigation.ts';

// A tab list: its orientation, its options in order (each one button), which is chosen, and how one is pressed.
export interface TabList<O extends {disabled?: boolean}> {
  orientation: ListOrientation;
  options: readonly O[];
  chosen(option: O): boolean;
  press(option: O): void;
}

export function moveTab<O extends {disabled?: boolean}>(event: KeyboardEvent<HTMLElement>,list: TabList<O>) {
  const move=listMoves(list.orientation,true)[event.key],enabled=list.options.filter(option=>!option.disabled);
  if(!move)return;
  if(!enabled.length)return;
  event.preventDefault();
  // A chosen option that is disabled is not among the enabled ones: findIndex gives NO_ACTIVE.
  const option=enabled[move(enabled.findIndex(list.chosen),enabled.length)];
  event.currentTarget.querySelectorAll('button')[list.options.indexOf(option)].focus();
  list.press(option);
}
