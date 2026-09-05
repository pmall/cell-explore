/**
 * Colour palette inspired by Sanzo Wada's "A Dictionary of Color Combinations" —
 * muted, slightly dusty pastels that sit well together and stay legible when
 * layered as translucent shells.
 *
 * Each organelle owns a `base` (body colour) and a `rim` (fresnel edge glow).
 * The rim is always a lighter, slightly desaturated sibling of the base so the
 * silhouettes read clearly against the dark cytosol.
 */

export const palette = {
  // ── environment ────────────────────────────────────────────────────────────
  void: '#0e141b', // outside the cell
  cytosol: '#16202b', // fog / interior haze
  cytosolLight: '#24384a',

  // ── boundary ───────────────────────────────────────────────────────────────
  membrane: { base: '#8fbfc4', rim: '#cdeae6' }, // Nile Blue
  glycocalyx: '#a7cfd0',

  // ── nucleus ────────────────────────────────────────────────────────────────
  nucleus: { base: '#a99bc1', rim: '#d9cfe8' }, // Light Grape Violet
  nucleolus: { base: '#b98fa8', rim: '#e3bfd2' }, // Corinthian Purple
  nuclearPore: '#c9b6dd',
  chromatin: ['#e7a4b4', '#8fa1c7', '#9fc7a8', '#e0ce8a', '#c3a3cc'],

  // ── nucleic acids ──────────────────────────────────────────────────────────
  dnaBackbone: '#a8b8d0', // Etain Blue
  // The four bases sat within a hand's breadth of each other in value, so at the
  // transcription close-up they read as one pastel confetti rather than as four
  // letters. Now they split two ways at once: warm and light for A and T, cool
  // and dark for G and C. That is also how they actually pair up, so the ladder
  // reads as alternating light and dark rungs instead of noise.
  dnaBases: {
    A: '#f4948c', // Rose, warmer
    T: '#f5e394', // Sulphur Yellow, lighter
    G: '#5fa87c', // Cobalt Green, deeper
    C: '#6f9ecb', // Pale Blue, deeper
  },
  mrna: { base: '#f0d18a', rim: '#f8e9bd' },
  trna: { base: '#a9cfbc', rim: '#d3e8dc' },
  rnaPolymerase: '#c8a6d6',

  // ── endomembrane system ────────────────────────────────────────────────────
  // The ER used to be warm tan, which put it in the same hue family as the
  // mitochondria it is physically tangled with, and the middle of the cell read
  // as one undifferentiated warm mass. It is now the cool, low-saturation half
  // of the interior: the mitochondria keep the warm, saturated end to
  // themselves, and the two separate at a glance. Rough and smooth stay
  // siblings — it is one continuous membrane — but split on hue temperature so
  // the smooth tubules do not blur into the Golgi they run past.
  roughER: { base: '#c0c8b4', rim: '#e2e8d7' }, // dusty sage-stone
  smoothER: { base: '#8d9ba1', rim: '#b7c6cc' }, // cooler, greyer, no ribosomes
  ribosome: '#b57f62', // Vandyke Brown, lightened
  golgi: { base: '#8fc1a9', rim: '#c8e5d5' }, // Turquoise Green
  golgiTrans: { base: '#7fb0a4', rim: '#bcdfd6' },
  vesicle: { base: '#cfe4d8', rim: '#e9f4ee' },
  coatedVesicle: { base: '#b8cfe4', rim: '#dcebf5' },
  lysosome: { base: '#b49bc8', rim: '#ded1ec' }, // Slate Purple
  peroxisome: { base: '#e0ce8a', rim: '#f2e7bd' }, // Sulphur Yellow

  // ── mitochondrion ──────────────────────────────────────────────────────────
  mitoOuter: { base: '#e8897f', rim: '#f9c4bb' }, // Coral Red
  mitoInner: { base: '#dd7468', rim: '#f2ab9c' },
  crista: { base: '#e28374', rim: '#f6b9ab' },
  atpSynthase: '#f0c07f',
  etc: '#c98f80',
  proton: '#bfe8e8',
  atp: '#f5d98b',

  // ── cytoskeleton ───────────────────────────────────────────────────────────
  microtubule: '#a8b8d0', // Etain Blue
  actin: '#c9cbe2', // Pale Blue Violet
  intermediate: '#b6c4bd',
  centrosome: { base: '#8fa1c7', rim: '#c4d0e5' },
  motorProtein: '#dbb7c4',

  // ── proteins & signalling ──────────────────────────────────────────────────
  protein: { base: '#e9a8ae', rim: '#f6d4d7' }, // Rose Pink
  proteinFolded: { base: '#d78f9e', rim: '#efc3cd' },
  glycoprotein: { base: '#e3bfa0', rim: '#f4dfcb' },
  receptor: '#9fbfd6',
  ligand: '#f19c7c', // Coral Red
  secondMessenger: '#f4c9a0',

  // ── ui accents ─────────────────────────────────────────────────────────────
  ink: '#eef3f6',
  inkSoft: '#9fb3c0',
  accent: '#8fc1a9',
  accentWarm: '#f0d18a',
} as const

export type ColorPair = { base: string; rim: string }
