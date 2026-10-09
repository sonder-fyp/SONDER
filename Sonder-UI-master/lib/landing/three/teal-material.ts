import * as THREE from "three";
import {
  BRAIN_COLOR,
  BRAIN_EMISSIVE,
  BRAIN_EMISSIVE_INTENSITY,
  BRAIN_ROUGHNESS,
  BRAIN_METALNESS,
  BRAIN_ENV_INTENSITY,
  BRAIN_NORMAL_SCALE,
  FACING_ALPHA,
  EDGE_ALPHA,
  FRESNEL_POWER,
  RIM_COLOR,
  RIM_STRENGTH,
  USE_FRESNEL,
} from "./teal-theme";

/** GLSL requires a decimal point on float literals: `1` is an int, `1.0` is a float. */
function glsl(n: number) {
  return n.toFixed(5);
}

/**
 * `String.replace` silently does nothing when the needle is absent, which would
 * leave a half-patched shader that compiles but looks wrong. Fail loudly instead.
 */
function replaceOrThrow(source: string, needle: string, replacement: string) {
  if (!source.includes(needle)) {
    throw new Error(
      `[teal-material] shader chunk "${needle}" not found — three.js internals ` +
        `changed. Set USE_FRESNEL = false in teal-theme.ts to fall back, then ` +
        `see the troubleshooting section of IMPLEMENTATION-PLAN-teal-brain.md.`,
    );
  }
  return source.replace(needle, replacement);
}

/**
 * Builds the transparent teal material.
 *
 * The GLB ships a photoreal PBR material (base colour + metallic-roughness +
 * normal). We keep ONLY the normal map — it carries the sulci/gyri relief and is
 * what stops the brain reading as a smooth blob — and discard the colour and
 * metallic-roughness maps, which would fight the flat teal.
 *
 * @param source   the material GLTFLoader produced; disposed before returning
 * @param anisotropy max anisotropy to apply to the retained normal map
 */
export function createTealBrainMaterial(
  source: THREE.Material,
  anisotropy: number,
): THREE.MeshPhysicalMaterial {
  const normalMap =
    source instanceof THREE.MeshStandardMaterial ? source.normalMap : null;

  if (normalMap) {
    normalMap.anisotropy = anisotropy;
    normalMap.generateMipmaps = true;
    normalMap.minFilter = THREE.LinearMipmapLinearFilter;
    normalMap.magFilter = THREE.LinearFilter;
    normalMap.needsUpdate = true;
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(BRAIN_COLOR),
    emissive: new THREE.Color(BRAIN_EMISSIVE),
    emissiveIntensity: BRAIN_EMISSIVE_INTENSITY,
    roughness: BRAIN_ROUGHNESS,
    metalness: BRAIN_METALNESS,
    envMapIntensity: BRAIN_ENV_INTENSITY,
    normalMap,
    transparent: true,
    opacity: 1,
    // No depth writing: the brain must not occlude its own far side, and the
    // hotspot dots must remain visible through it.
    depthWrite: false,
    depthTest: true,
    // DoubleSide + forceSinglePass:false makes three render back faces then front
    // faces as two passes, which is what gives correct ordering through the model.
    side: THREE.DoubleSide,
    forceSinglePass: false,
    // Transmission is per-pixel expensive and adds nothing over the Fresnel term.
    transmission: 0,
    thickness: 0,
    clearcoat: 0,
  });

  if (normalMap) material.normalScale.set(BRAIN_NORMAL_SCALE, BRAIN_NORMAL_SCALE);

  if (USE_FRESNEL) {
    const rim = new THREE.Color(RIM_COLOR); // already linear — do not convert again

    material.onBeforeCompile = (shader) => {
      let fs = shader.fragmentShader;

      // 1. Declare the Fresnel global at file scope.
      fs = replaceOrThrow(
        fs,
        "#include <common>",
        `#include <common>
float gFresnel = 0.0;`,
      );

      // 2. Compute it once the shading normal is final (i.e. after the normal
      //    map has perturbed it), so the relief drives the rim.
      //    `normal` and `vViewPosition` are both view-space and always present
      //    in the MeshPhysicalMaterial fragment shader.
      fs = replaceOrThrow(
        fs,
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
gFresnel = pow(
  1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 ),
  ${glsl(FRESNEL_POWER)}
);`,
      );

      // 3. Drive alpha and the rim glow from it. `outgoingLight` is declared by
      //    three immediately before this chunk.
      fs = replaceOrThrow(
        fs,
        "#include <opaque_fragment>",
        `float bvAlpha = mix( ${glsl(FACING_ALPHA)}, ${glsl(EDGE_ALPHA)}, gFresnel );
vec3 bvRim = vec3( ${glsl(rim.r)}, ${glsl(rim.g)}, ${glsl(rim.b)} );
vec3 bvColor = outgoingLight + bvRim * ( ${glsl(RIM_STRENGTH)} * gFresnel );
gl_FragColor = vec4( bvColor, diffuseColor.a * bvAlpha );`,
      );

      shader.fragmentShader = fs;
    };

    // Without this, three may hand back a cached program compiled before the
    // injection, or fail to recompile when a constant above is edited.
    material.customProgramCacheKey = () =>
      `teal-brain|${FRESNEL_POWER}|${FACING_ALPHA}|${EDGE_ALPHA}|${RIM_STRENGTH}|${RIM_COLOR}`;
  } else {
    // Fallback: flat transparent teal, no Fresnel.
    material.opacity = 0.35;
  }

  // Safe: Material.dispose() releases the material's own GPU program, never its
  // textures — the normal map we kept a reference to survives.
  source.dispose();

  return material;
}
