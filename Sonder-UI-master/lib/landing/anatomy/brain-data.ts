/**
 * Brain data, extracted and flattened from the Anatomy Atelier codebase.
 *
 * Source of the numbers/colours:  app/lib/anatomy-data.ts   (the `brain` entry)
 * Source of the English prose:     app/i18n/organs/en.ts     (the `brain` entry)
 *
 * The original app merged a locale-independent "structure" record with a
 * per-language "prose" record at runtime (app/i18n/merge.ts). There is no i18n
 * here, so the two are already joined below and the English strings are plain
 * constants.
 */

/** One labelled point on the model. `position` is in the normalised pivot space
 *  the viewer fits every model into (a cube of edge `FIT_SIZE`, see loaders.ts). */
export type Hotspot = {
  /** Stable id, also used as the DOM key and the picking identity. */
  id: string;
  /** Terminologia Anatomica (Latin) term — kept for reference/labelling. */
  ta: string;
  /** [x, y, z] in pivot space. */
  position: [number, number, number];
  /** Marker dot + callout accent colour. */
  color: string;
  /** Short human label shown in the callout and the screen-reader list. */
  label: string;
  /** One-line description shown under the label. */
  detail: string;
};

/** The minimal "organ" shape the viewer consumes. */
export type Organ = {
  id: string;
  /** URL the GLTFLoader fetches. Served from `public/` at the site root. */
  model: string;
  /** Accent colour used for the ambient glow behind the model. */
  accent: string;
  /** Display name. */
  name: string;
  /** Latin binomial, shown in the corner caption. */
  scientificName: string;
  hotspots: Hotspot[];
};

export const brain: Organ = {
  id: "brain",
  model: "/models/brain.glb",
  accent: "#39FF14",
  name: "Brain",
  scientificName: "Encephalon",
  hotspots: [
    {
      id: "frontal",
      ta: "Lobus frontalis",
      position: [-0.7, 0.65, 0.8],
      color: "#9dff7a",
      label: "Frontal Lobe",
      detail: "Planning & movement",
    },
    {
      id: "parietal",
      ta: "Lobus parietalis",
      position: [0.15, 1.1, 0.65],
      color: "#ffd27a",
      label: "Parietal Lobe",
      detail: "Sensory integration",
    },
    {
      id: "temporal",
      ta: "Lobus temporalis",
      position: [0.75, -0.1, 0.82],
      color: "#9ec5ff",
      label: "Temporal Lobe",
      detail: "Memory & hearing",
    },
    {
      id: "cerebellum",
      ta: "Cerebellum",
      position: [0.72, -0.9, 0.55],
      color: "#d3a6ff",
      label: "Cerebellum",
      detail: "Balance & coordination",
    },
  ],
};
