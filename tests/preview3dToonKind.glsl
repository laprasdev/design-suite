// The stage's toon test kind (step E1): a soft two-step ramp on the look's own light, as the art direction paints a
// character, read only through the names the contract gives an unlit kind. Half-Lambert of the shading normal against
// the key, through two blurred steps: lit, the albedo in the key's colour; in shade, the albedo under the look's
// ambient pulled toward the look's shadow colour; and a thin rim on the lit side. Unlit, so this is the whole of its
// light (fog, the curve and the glow still apply). Tests and evidence only: Bloom's toon kind is written from the
// contract, in its own repository.
void kindSurface( inout vec4 diffuse, inout vec3 emissive ) {
  vec3 albedo = surfaceParameter_Color().rgb;
  vec2 steps = surfaceParameter_Steps();
  float soft = surfaceParameter_Softness();
  float facing = dot( kindNormal, stageKeyDirection ) * 0.5 + 0.5;
  float ramp = 0.5 * ( smoothstep( steps.x - soft, steps.x + soft, facing ) +
    smoothstep( steps.y - soft, steps.y + soft, facing ) );
  vec3 ambient = mix( stageAmbientGround, stageAmbientSky, kindNormal.y * 0.5 + 0.5 );
  vec3 shade = mix( albedo * ambient * RECIPROCAL_PI, stageShadow, surfaceParameter_ShadowMix() );
  vec3 lit = albedo * stageKeyColor * RECIPROCAL_PI;
  float edge = 1.0 - max( dot( kindNormal, kindViewDirection ), 0.0 );
  float rim = smoothstep( 1.0 - surfaceParameter_RimWidth(), 1.0, edge ) * ramp;
  diffuse.rgb = mix( shade, lit, ramp ) + rim * surfaceParameter_Rim() * stageKeyColor * RECIPROCAL_PI;
}
