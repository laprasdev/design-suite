import {element} from './elementContract.ts';
import {barSlotsWithin} from './barElements.ts';
export const ActionBarElement=element('action-bar');
export const ActionBarSlotElement=Object.freeze(barSlotsWithin(ActionBarElement));
/** How a notice, or the control a failure marks, reads: something went wrong, or only something to know. */
export type NoticeTone='error'|'info';
// The glyph that says a notice's tone, in the notice or on what a failure marks.
export const NoticeIconElement=element('notice-icon');
// The notice and the detail beside its message.
export const ActionNoticeElement=Object.freeze({
 ROOT:element('action-bar-notice'),DETAIL:element('action-bar-notice-detail'),
});
// The participant strip, its message, and each actor group; an actor is its sprite and chat over its grass blades.
export const BarParticipantElement=Object.freeze({
 ROOT:element('bar-participants'),MESSAGE:element('bar-participant-message'),GROUP:element('bar-participant-group'),
 ACTOR:element('bar-participant'),SPRITE:element('bar-participant-sprite'),CHAT:element('bar-participant-chat'),
 GRASS:element('bar-participant-grass'),BLADE:element('bar-participant-blade'),
});
