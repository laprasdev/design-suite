// The serialized fields of ISM's `ParticleSubmodule` and the structs it holds, by struct, in the order ISM's generated
// configuration headers list them (`SerializedNames` in ISM's Native/Runtime/Generated/Configuration/
// ParticleSubmoduleFields.h, ParticleProfile*Fields.h and ParticleSystemMinMax*Fields.h). A pack's record states
// exactly these.
export const MODEL_PARTICLE_FIELDS = Object.freeze({
  submodule: ['submodules', 'enabled', 'nestedValidation', 'material', 'renderMode', 'mesh', 'shadowCasting',
    'emitterOrigin', 'attraction', 'attractionSpeed', 'attractionRamp', 'blendMode', 'mainSettings', 'emissionSettings',
    'emitOnContact', 'emissionProbability', 'shapeSettings', 'velocitySettings', 'sizeOverLifetime', 'noiseSettings',
    'colorOverLifetime', 'colorBySpeed', 'rotationOverLifetime', 'rotationBySpeed', 'textureSheetAnimation',
    'prefabSource', 'syncMode'],
  main: ['duration', 'looping', 'startLifetime', 'startSpeed', 'startSize', 'startColor', 'startRotation3D',
    'startRotationX', 'startRotationY', 'startRotationZ', 'maxParticles', 'simulationSpace', 'simulationSpeed',
    'gravitySource', 'gravityModifier'],
  emission: ['rateOverTime', 'rateOverDistance', 'hasBurst', 'burstTime', 'burstCount', 'burstCycleCount',
    'burstRepeatInterval', 'burstProbability'],
  shape: ['enabled', 'shapeType', 'scale', 'radius', 'radiusThickness', 'arc', 'arcMode', 'angle', 'position',
    'rotation', 'alignToDirection', 'texture', 'textureClipThreshold', 'textureColorAffectsParticles',
    'textureAlphaAffectsParticles'],
  velocity: ['enabled', 'linearX', 'linearY', 'linearZ', 'speedModifier', 'orbitalX', 'orbitalY', 'orbitalZ',
    'orbitalOffsetX', 'orbitalOffsetY', 'orbitalOffsetZ', 'radial', 'space'],
  axisCurve: ['enabled', 'separateAxes', 'x', 'y', 'z', 'speedRange'],
  noise: ['enabled', 'separateAxes', 'strength', 'strengthY', 'strengthZ', 'frequency', 'scrollSpeed', 'damping',
    'octaves', 'positionAmount', 'sizeAmount', 'quality'],
  color: ['enabled', 'color', 'speedRange'],
  textureSheet: ['enabled', 'tiles', 'animationType', 'rowMode', 'rowIndex', 'timeMode', 'framesPerSecond',
    'speedRange', 'frameOverTime', 'startFrame', 'cycleCount'],
  minMaxCurve: ['m_Mode', 'm_CurveMultiplier', 'm_CurveMin', 'm_CurveMax', 'm_ConstantMin', 'm_ConstantMax'],
  minMaxGradient: ['m_Mode', 'm_GradientMin', 'm_GradientMax', 'm_ColorMin', 'm_ColorMax'],
  rgba: ['r', 'g', 'b', 'a'],
  vector3: ['x', 'y', 'z'],
} as const);
