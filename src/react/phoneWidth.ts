import {useSyncExternalStore} from 'react';
import {Breakpoint, maxWidthQuery} from './breakpoints.ts';

/** Phone width, as the stylesheets' phone media queries spell it (tests/breakpoints.test.ts keeps them equal). */
export const PHONE_WIDTH_QUERY = maxWidthQuery(Breakpoint.PHONE);
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(PHONE_WIDTH_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
/** Whether the window is phone width, for the places that swap a control rather than restyle one. */
export const usePhoneWidth = () => useSyncExternalStore(subscribe, () => window.matchMedia(PHONE_WIDTH_QUERY).matches,
  () => false);
