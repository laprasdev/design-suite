import type {ActionBarNotice} from '../ActionBar.tsx';
import {NoticeTone} from '../actionBarElements.ts';
import {MODEL_PREVIEW_TEXT} from './model.ts';
import type {ModelEmitterSkip} from './emitterModel.ts';
import {MODEL_STAGE_FAILURE, type ModelStageFailure} from './refusal.ts';

// Each setting the skipped effects hold a value of that the stage does not draw yet, with how many effects hold one.
function skippedDetail(skipped: readonly ModelEmitterSkip[]) {
  const counts = new Map<string, number>();
  for (const {setting} of skipped) counts.set(setting, (counts.get(setting) ?? 0) + 1);
  return [...counts].map(([setting, count]) => `${setting} ${MODEL_PREVIEW_TEXT.effects(count)}`).join(' · ');
}
/** The one place the stage's state becomes visible: a failure, what failed in a few words, its own message and the
 * recovery; else the effects the stage skips, by the settings it does not draw yet. */
export function modelPreviewNotice(failure: ModelStageFailure | null, skipped: readonly ModelEmitterSkip[],
  retry: () => void): ActionBarNotice | null {
  if (!failure) {
    return skipped.length ? {message: MODEL_PREVIEW_TEXT.skipped, tone: NoticeTone.INFO,
      detail: skippedDetail(skipped)} : null;
  }
  const stopped = failure.kind === MODEL_STAGE_FAILURE.unusable;
  return {message: stopped ? MODEL_PREVIEW_TEXT.stopped : MODEL_PREVIEW_TEXT.refused, tone: NoticeTone.ERROR,
    detail: failure.message, ...(stopped && {action: {label: MODEL_PREVIEW_TEXT.retry, onClick: retry}})};
}
