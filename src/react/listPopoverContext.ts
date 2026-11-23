import {createContext} from 'react';
import type {PopoverPlacementFromAnchor} from './modalElements.ts';
import type {Without} from './refusedKeys.ts';

// Where a list popover goes beside its anchor: the list scrolls in its own frame, so it refuses `scroll`.
export type ListPopoverPlacement=Without<PopoverPlacementFromAnchor,'scroll'>;
// Where a surface asks the list popovers inside it to go. A control's own placement still wins.
export const ListPopoverDefaultsContext=createContext<ListPopoverPlacement>({});
