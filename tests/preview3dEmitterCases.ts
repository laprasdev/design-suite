import {MODEL_ATTRACTION, MODEL_CURVE_MODE, MODEL_EMITTER_ORIGIN, MODEL_GRADIENT_MODE, MODEL_RENDER_MODE,
  MODEL_SHAPE_TYPE, MODEL_SIMULATION_SPACE} from '../src/react/preview3d/emitterModel.ts';

// A profile in the pack's whole `ParticleSubmodule` form, every struct with every serialized field and each value in
// the form a pack's export writes it: an `AnimationCurve` and a `Gradient` as `{}`, `Frames` as `{_raw}`, an
// `OverridableModule` with its phases, an asset as `{fileID, guid, type}`: the forms of the 30 `ParticleSubmodule`
// records in ISM's candidate-19 Synth pack (`claude-engine-lead/demo/candidate-19/bundle/pack.json` in ISM's
// artifacts, SHA-256 6a7a2ed9b039e62c...). The numbers are the test's own: the stage reads each of those 30 records
// whole and refuses each by name at a value it does not draw yet, so none can stand in for a drawn profile.
/** A start's routed values, each unlike the test profile's own. */
export const EMITTER_ROUTED = Object.freeze({rate: 40, tint: Object.freeze([0.5, 0.25, 2] as const), radius: 0.75});
export const EMITTER_ID = 'states/0/additionalModifiers/0/entranceProfile';
export const curve = (min: number, max: number, mode: number = MODEL_CURVE_MODE.twoConstants) =>
  ({m_Mode: mode, m_CurveMultiplier: max, m_CurveMin: {}, m_CurveMax: {}, m_ConstantMin: min, m_ConstantMax: max});
const zero = () => curve(0, 0, MODEL_CURVE_MODE.constant);
const rgba = (r: number, g: number, b: number, a: number) => ({r, g, b, a});
const vector = (x: number, y: number, z: number) => ({x, y, z});
const speedRange = () => ({x: 0, y: 1});
export const gradient = (mode: number = MODEL_GRADIENT_MODE.twoColors) => ({m_Mode: mode, m_GradientMin: {},
  m_GradientMax: {}, m_ColorMin: rgba(1, 0.55, 0.2, 1), m_ColorMax: rgba(1, 0.85, 0.4, 1)});
const PHASES = {maintain: {threshold: 0, active: true}, entrance: {threshold: 0, active: true}};
const unset = (raw: object) => ({phases: PHASES, modeAuthored: true, mode: 0, _raw: raw});
const asset = (type: number) => ({fileID: '1', guid: '00000000000000000000000000000001', type});
const axisCurve = (enabled: boolean) =>
  ({enabled, separateAxes: false, x: curve(0.5, 1), y: zero(), z: zero(), speedRange: speedRange()});
export const emitterProfile = (maxParticles = 256, size = 0.08) => ({
  submodules: [], enabled: true, nestedValidation: unset({submodules: []}), material: asset(2),
  renderMode: MODEL_RENDER_MODE.billboard, mesh: null, shadowCasting: 0,
  emitterOrigin: MODEL_EMITTER_ORIGIN.character, attraction: MODEL_ATTRACTION.natural, attractionSpeed: 12,
  attractionRamp: {_raw: 3}, blendMode: 0,
  mainSettings: {duration: 2, looping: true, startLifetime: curve(0.8, 1.6), startSpeed: curve(0.4, 1.2),
    startSize: curve(size / 2, size), startColor: rgba(1, 1, 1, 1), startRotation3D: false, startRotationX: zero(),
    startRotationY: zero(), startRotationZ: zero(), maxParticles, simulationSpace: MODEL_SIMULATION_SPACE.local,
    simulationSpeed: 1, gravitySource: 0, gravityModifier: zero()},
  emissionSettings: {rateOverTime: curve(0, 160, MODEL_CURVE_MODE.constant), rateOverDistance: zero(),
    hasBurst: false, burstTime: 0, burstCount: 30, burstCycleCount: 1, burstRepeatInterval: 0.01, burstProbability: 1},
  emitOnContact: false, emissionProbability: unset({submodules: [], elements: [], layerMode: 1}),
  shapeSettings: {enabled: true, shapeType: MODEL_SHAPE_TYPE.sphere, scale: vector(1, 1, 1), radius: 0.15,
    radiusThickness: 1, arc: 360, arcMode: 0, angle: 25, position: vector(0, 0, 0), rotation: vector(0, 0, 0),
    alignToDirection: false, texture: null, textureClipThreshold: 0, textureColorAffectsParticles: true,
    textureAlphaAffectsParticles: true},
  // On and at rest, so each of its values is read.
  velocitySettings: {enabled: true, linearX: zero(), linearY: zero(), linearZ: zero(),
    speedModifier: curve(1, 1, MODEL_CURVE_MODE.constant),
    orbitalX: zero(), orbitalY: zero(), orbitalZ: zero(), orbitalOffsetX: zero(), orbitalOffsetY: zero(),
    orbitalOffsetZ: zero(), radial: zero(), space: 0},
  sizeOverLifetime: axisCurve(true),
  noiseSettings: {enabled: false, separateAxes: false, strength: zero(), strengthY: zero(), strengthZ: zero(),
    frequency: 2, scrollSpeed: zero(), damping: true, octaves: 1, positionAmount: zero(), sizeAmount: zero(),
    quality: 1},
  colorOverLifetime: {enabled: true, color: gradient(), speedRange: speedRange()},
  colorBySpeed: {enabled: false, color: gradient(), speedRange: speedRange()},
  rotationOverLifetime: axisCurve(false), rotationBySpeed: axisCurve(false),
  textureSheetAnimation: {enabled: false, tiles: {}, animationType: 0, rowMode: 1, rowIndex: 0, timeMode: 0,
    framesPerSecond: 30, speedRange: speedRange(), frameOverTime: zero(), startFrame: zero(), cycleCount: 1},
  prefabSource: null, syncMode: 0,
});
export const emitterChange = (change: string, profile = EMITTER_ID) => ({profile, change});
