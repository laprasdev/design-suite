// Presentation only: these do not change game rolls or ability assignments.
export const PARTICIPANT_REACTION_MS=1800;
export const PARTICIPANT_WIGGLE=Object.freeze({duration:260,easing:'ease-in-out'});
export const PARTICIPANT_WIGGLE_DEGREES=2;
export const PositiveReaction=Object.freeze({HEART:'heart',SMILE:'smile',SPARKLE:'sparkle'} as const);
export type PositiveReactionName=typeof PositiveReaction[keyof typeof PositiveReaction];
export const positiveReaction=(random: ()=>number)=>Object.values(PositiveReaction)[Math.floor(random()*Object.keys(PositiveReaction).length)];
