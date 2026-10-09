/**
 * Catmull-Rom control polylines for bioelectric pathways.
 * Coordinates are in the normalised organ pivot space (cube of edge FIT_SIZE).
 *
 * Seed nodes reuse the former hotspot cortex landmarks; interior midpoints
 * pull arcs through the volume so signals read as traveling inside the brain.
 */

export type NeuronPathPoints = [number, number, number][];

const FRONTAL: [number, number, number] = [-0.7, 0.65, 0.8];
const PARIETAL: [number, number, number] = [0.15, 1.1, 0.65];
const TEMPORAL: [number, number, number] = [0.75, -0.1, 0.82];
const CEREBELLUM: [number, number, number] = [0.72, -0.9, 0.55];
const CORE: [number, number, number] = [0.05, 0.15, 0.1];
const LEFT_CORE: [number, number, number] = [-0.45, 0.2, 0.05];
const RIGHT_CORE: [number, number, number] = [0.5, 0.25, 0.08];
const STEM: [number, number, number] = [0.1, -0.55, -0.15];
const LEFT_TEMP: [number, number, number] = [-0.85, -0.05, 0.7];
const OCCIPITAL: [number, number, number] = [0.05, 0.35, -0.85];

export const NEURON_PATHS: NeuronPathPoints[] = [
  // Frontal ↔ parietal arc over the crown
  [FRONTAL, [-0.35, 1.0, 0.55], PARIETAL],
  // Frontal down through core to temporal
  [FRONTAL, LEFT_CORE, CORE, RIGHT_CORE, TEMPORAL],
  // Parietal ↔ occipital ↔ contralateral sweep
  [PARIETAL, [0.1, 0.7, -0.2], OCCIPITAL, [-0.2, 0.55, -0.35], [-0.55, 0.75, 0.4]],
  // Temporal ↔ cerebellum via brainstem
  [TEMPORAL, RIGHT_CORE, STEM, CEREBELLUM],
  // Left temporal ↔ frontal
  [LEFT_TEMP, LEFT_CORE, FRONTAL],
  // Cross-hemisphere commissure
  [LEFT_TEMP, LEFT_CORE, CORE, RIGHT_CORE, TEMPORAL],
  // Parietal down to cerebellum
  [PARIETAL, [0.35, 0.4, 0.2], STEM, CEREBELLUM],
  // Occipital ↔ cerebellum
  [OCCIPITAL, [0.2, -0.15, -0.4], STEM, CEREBELLUM],
  // Frontal ↔ left temporal lateral loop
  [FRONTAL, [-1.0, 0.35, 0.35], LEFT_TEMP, [-0.6, 0.1, 0.45], LEFT_CORE],
  // Deep thalamic-style loop
  [CORE, LEFT_CORE, [-0.2, -0.1, -0.3], RIGHT_CORE, CORE],
  // Crown ring fragment
  [FRONTAL, PARIETAL, [0.55, 0.85, 0.2], TEMPORAL],
  // Cerebellum ↔ contralateral cortex
  [CEREBELLUM, STEM, LEFT_CORE, FRONTAL],
];
