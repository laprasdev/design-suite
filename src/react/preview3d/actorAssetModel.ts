import {MODEL_ACTOR_REFUSAL as refusal, type ModelFileActor} from './actorModel.ts';
import {modelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// How an actor's file is bound to what describes it: its runtime material profile, and the digest it is read against.
/** An actor's runtime material profile, bound to its asset's exact identity; none when its asset declares none. */
export function modelRuntimeAssetProfile(value: ModelFileActor) {
  const {asset} = value;
  if (!asset.runtimeMaterials) return undefined;
  const profile = modelRuntimeMaterialProfile(asset.runtimeMaterials);
  if (profile.asset.id !== asset.id || profile.asset.revision !== asset.revision) {
    throw new ModelStageRefusal(refusal.profile(value.id));
  }
  if (asset.sha256 !== undefined && asset.sha256 !== profile.asset.sha256) {
    throw new ModelStageRefusal(refusal.digest(value.id));
  }
  return profile;
}

/**
 * The digest an actor's file is read against (files.ts): its runtime profile's while it states one (until step 5e
 * removes the profile; the asset's own, when stated, must equal it), else the asset's own; none stated, the file is
 * read unverified.
 */
export function modelAssetDigest(value: ModelFileActor): string | undefined {
  const profile = modelRuntimeAssetProfile(value);
  return profile ? profile.asset.sha256 : value.asset.sha256;
}
