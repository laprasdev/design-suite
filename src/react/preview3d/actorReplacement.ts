import type {ModelStageController} from './model.ts';
import type {ModelStageActor} from './actorModel.ts';
import type {ModelPresentationStatus} from './presentation.ts';

// The view's side of setActors. Only the latest call reports; its failure goes to the view's one failure reader.
export function createModelActorReplacement(pending: (value: boolean) => void, failure: (error: unknown) => void) {
  let latest = 0;
  return {
    request(api: Pick<ModelStageController, 'setActors'>, actors: readonly ModelStageActor[]) {
      const call = ++latest, current = () => call === latest;
      let replacement: Promise<void>;
      try {replacement = api.setActors(actors);}
      catch (error) {failure(error); return;}
      pending(true);
      replacement.then(() => {if (current()) pending(false);},
        (error: unknown) => {if (!current()) return; pending(false); failure(error);});
    },
  };
}

// The ready attribute: loaded, the runtime pose shown when external, and no actor replacement in flight.
export function modelPreviewReady(loaded: boolean, external: boolean, poseStatus: ModelPresentationStatus,
  actorsPending: boolean) {
  return loaded && (!external || poseStatus === 'ready') && !actorsPending;
}
