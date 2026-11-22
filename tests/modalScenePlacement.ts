// What a Modal in the dismissal scene (modalScene.ts) takes besides its placement: the ModalPlacementProps member of
// that placement, with the scene's anchor in place of the page's wherever the member names one.
import type {ModalPlacementProps,ModalPlacementValue} from '../src/react/modalElements.ts';

type Member<Placement extends ModalPlacementValue>=Extract<ModalPlacementProps,{placement?: Placement}>;
type SceneMember<Placement extends ModalPlacementValue,Anchor>=Omit<Member<Placement>,'placement'|'anchor'>&
 (Member<Placement> extends {anchor: unknown}?{anchor: Anchor}:{anchor?: never});
// `Handled` is what any Modal of the scene takes, `Anchor` the scene's anchor.
type PlacedProps<Placement extends ModalPlacementValue,Handled,Anchor>=Handled&SceneMember<Placement,Anchor>;
export type PlacedArguments<Placement extends ModalPlacementValue,Handled,Anchor>=
 Partial<PlacedProps<Placement,Handled,Anchor>> extends PlacedProps<Placement,Handled,Anchor>
  ?[PlacedProps<Placement,Handled,Anchor>?]:[PlacedProps<Placement,Handled,Anchor>];
