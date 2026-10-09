/**
 * Every tunable for the transparent neon-green brain look.
 *
 * Colours are authored as sRGB hex strings (what you'd pick in a design tool).
 * three.js converts them to linear working space automatically when they are
 * passed to `new THREE.Color(...)`, so do NOT call `.convertSRGBToLinear()`
 * on them anywhere — that would double-convert and wash the colour out.
 */

/* ------------------------------------------------------------------ brain */

/** Base albedo of the brain. Deep so the lit result stays saturated neon. */
export const BRAIN_COLOR = "#0d4a08";
/** Floor colour, so unlit areas never go to pure black. Keep this dim. */
export const BRAIN_EMISSIVE = "#083a05";
export const BRAIN_EMISSIVE_INTENSITY = 0.55;
export const BRAIN_ROUGHNESS = 0.32;
export const BRAIN_METALNESS = 0.0;
export const BRAIN_ENV_INTENSITY = 1.15;
/** Strength of the surface relief taken from the GLB's normal map. Raise for
 *  more pronounced sulci/gyri, lower if the surface looks noisy. 0 disables. */
export const BRAIN_NORMAL_SCALE = 0.85;

/* ------------------------------------------------------- fresnel / opacity */

/**
 * Opacity where the surface faces the camera head-on. Low — this is what makes
 * the brain see-through and stops overlapping layers turning into mud.
 */
export const FACING_ALPHA = 0.1;
/** Opacity at the silhouette / edge-on. High — this draws the form. */
export const EDGE_ALPHA = 0.85;
/** Fresnel falloff. Higher = tighter, more edge-only. 1.5–4.0 is the useful range. */
export const FRESNEL_POWER = 2.2;
/** Bright neon rim at grazing angles. */
export const RIM_COLOR = "#39FF14";
/** How much rim colour to add. 0 disables the rim entirely. */
export const RIM_STRENGTH = 0.9;

/* ------------------------------------------------------------------ scene */

export const ACCENT = "#39FF14";

export const LIGHT_AMBIENT = { color: "#9fe88a", intensity: 0.55 };
export const LIGHT_HEMI = { sky: "#c8ffb0", ground: "#0a1a06", intensity: 0.85 };
export const LIGHT_KEY = { color: "#e8ffe0", intensity: 2.6 };
export const LIGHT_FILL = { color: "#8fd97a", intensity: 1.0 };
/** The rim light does most of the work on a translucent object — keep it strong. */
export const LIGHT_RIM = { color: "#39FF14", intensity: 2.4 };
export const LIGHT_POINT_COOL = { color: "#1f8c14", intensity: 0.8 };
export const LIGHT_GLOW_INTENSITY = 0.9;

/** Environment probe gradient (drives reflections and overall material read). */
export const ENV_TOP = "#c8ffb0";
export const ENV_BOTTOM = "#0a1f08";

export const PLINTH_COLOR = "#0c1f0a";
export const PLINTH_ROUGHNESS = 0.5;
export const PLINTH_METALNESS = 0.1;
/** Set false to remove the plinth entirely — recommended for a floating hero. */
export const SHOW_PLINTH = false;

/** Contact shadow. A translucent brain must not cast a solid shadow. */
export const SHADOW_RGB = "8, 28, 6";
export const SHADOW_OPACITY = 0.3;

export const PARTICLE_COLOR = "#39FF14";
export const PARTICLE_SIZE = 0.016;
export const PARTICLE_OPACITY = 0.3;

export const TONE_MAPPING_EXPOSURE = 1.15;

/* ---------------------------------------------------------- neuron activity */

/** Master switch for pathway filaments, traveling pulses, and cortex flashes. */
export const SHOW_NEURON_ACTIVITY = true;

export const NEURON_PATH_COLOR = "#1a8c10";
export const NEURON_PATH_OPACITY = 0.18;

export const NEURON_PULSE_COLOR = "#39FF14";
export const NEURON_PULSE_SIZE = 0.06;
/** How fast a pulse advances along a unit-length path (t per second). */
export const NEURON_PULSE_SPEED = 0.35;
export const NEURON_PULSE_SPEED_CLICK = 0.55;
export const NEURON_MAX_PULSES = 24;

export const NEURON_FLASH_COLOR = "#39FF14";
export const NEURON_FLASH_SIZE = 0.14;
export const NEURON_FLASH_SIZE_CLICK = 0.22;
export const NEURON_FLASH_PEAK = 0.55;
export const NEURON_FLASH_PEAK_CLICK = 0.95;
export const NEURON_FLASH_DURATION = 0.55;
export const NEURON_FLASH_DURATION_CLICK = 0.7;
export const NEURON_MAX_FLASHES = 8;

/** Ambient spawn interval range (seconds). */
export const NEURON_PULSE_INTERVAL = [0.35, 0.7] as const;
export const NEURON_FLASH_INTERVAL = [0.8, 1.4] as const;
/** How many pulses a click burst fans out. */
export const NEURON_CLICK_PULSE_COUNT = 5;

/* ------------------------------------------------------------ escape hatch */

/**
 * Set to `false` to disable the custom shader injection and fall back to a
 * plain (non-Fresnel) transparent material. Use this ONLY if the shader
 * fails to compile — see the troubleshooting section of the plan.
 */
export const USE_FRESNEL = true;
