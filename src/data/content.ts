import * as THREE from 'three'
import { palette } from '../theme/palette'
import {
  CELL_RADIUS, CENTROSOME, ER_EXIT_SITE, EXPORT_PORE_DIR, FEATURED_MITOCHONDRION,
  GOLGI, LYSOSOMES, MITOCHONDRIA, MITO_SYNTHASE_WORLD, NUCLEOLUS,
  NUCLEUS, PEROXISOMES, RIBOSOME_FOCUS, ROUGH_ER_FOCUS, SIGNAL_RECEPTOR_DIR,
  VESICLE_CLUSTER,
} from './layout'

const FEATURED_MITO = MITOCHONDRIA[FEATURED_MITOCHONDRION].position

export type MechanismId =
  | 'centralDogma'
  | 'secretory'
  | 'bioenergetics'
  | 'signalling'
  | 'trafficking'

export type StructureId =
  | 'plasmaMembrane' | 'membraneProteins' | 'cytosol'
  | 'nucleus' | 'nuclearPore' | 'nucleolus' | 'chromatin'
  | 'roughER' | 'smoothER' | 'ribosome' | 'golgi' | 'vesicle'
  | 'mitochondrion' | 'lysosome' | 'peroxisome'
  | 'microtubule' | 'actin' | 'centrosome'

export type Focus = { target: THREE.Vector3; distance: number }

export type Structure = {
  id: StructureId
  name: string
  aka?: string
  tagline: string
  /** Two or three sentences. Written for someone meeting this for the first time. */
  body: string
  /** Concrete, memorable facts — numbers wherever numbers help. */
  facts: string[]
  color: string
  focus: Focus
  /** Rough real-world size, shown as a scale cue. */
  size: string
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export const OVERVIEW_FOCUS: Focus = { target: v(0, 0, 0), distance: 30 }

export const STRUCTURES: Structure[] = [
  {
    id: 'plasmaMembrane',
    name: 'Plasma membrane',
    aka: 'cell membrane',
    tagline: 'The border that decides what gets in and out',
    body:
      'A double layer of fat molecules — a lipid bilayer — only about 5 nanometres thick, wrapped around the entire cell. It is not a wall but a fluid: individual lipids drift sideways through it constantly, like people in a crowd. Because its interior is oily, water-soluble things cannot cross on their own, which is precisely the point.',
    facts: [
      'About 5 nm thick — roughly 1/10,000th the width of a human hair.',
      'Lipids swap places with their neighbours ~10 million times per second.',
      'Studded with proteins that act as doors, sensors and pumps.',
      'The outer face carries sugar chains (the glycocalyx) that give the cell its identity.',
    ],
    color: palette.membrane.base,
    size: '~5 nm thick',
    focus: { target: v(0, 0, 0), distance: 26 },
  },
  {
    id: 'membraneProteins',
    name: 'Membrane proteins',
    aka: 'receptors, channels, pumps',
    tagline: 'The doors, sensors and turnstiles in the border',
    body:
      'Roughly half the mass of the membrane is protein, not lipid. Channels let specific ions trickle through, pumps push molecules uphill using energy, and receptors sit waiting for a signal molecule to arrive from outside and then change shape to pass the message inward.',
    facts: [
      'A receptor never lets the signal itself into the cell — it only changes shape.',
      'The sodium-potassium pump alone can consume a quarter of your resting energy.',
      'Most prescription drugs act on a membrane protein.',
    ],
    color: palette.receptor,
    size: '~5-10 nm',
    focus: { target: SIGNAL_RECEPTOR_DIR.clone().multiplyScalar(CELL_RADIUS), distance: 6 },
  },
  {
    id: 'cytosol',
    name: 'Cytosol',
    aka: 'cytoplasm',
    tagline: 'Not empty space — a crowded, gel-like soup',
    body:
      'Textbook drawings leave the inside of a cell looking spacious. It is not. The cytosol is packed to roughly 300 grams of protein per litre — closer to jelly than to water. A protein diffusing across the cell bumps into something else every few nanometres.',
    facts: [
      '20-30% of the cytosol volume is occupied by macromolecules.',
      'A mid-sized protein crosses the whole cell in a few seconds by diffusion alone.',
      'This crowding actually helps reactions: it forces partners into contact.',
    ],
    color: palette.cytosolLight,
    size: '10-30 µm across',
    focus: { target: v(3, 0, 3), distance: 12 },
  },
  {
    id: 'nucleus',
    name: 'Nucleus',
    tagline: 'The library where the genome is kept and read',
    body:
      'The nucleus holds the cell\'s DNA behind a double membrane. Keeping the genome in a separate room is the defining feature of eukaryotes: it means an RNA copy can be edited and checked before it ever reaches a ribosome. DNA never leaves; only copies do.',
    facts: [
      'Typically 5-10 µm across — the largest organelle.',
      'Contains about 2 metres of DNA folded into that space.',
      'Wrapped in two membranes, not one, pierced by nuclear pores.',
    ],
    color: palette.nucleus.base,
    size: '~6 µm',
    focus: { target: NUCLEUS.center.clone(), distance: 11 },
  },
  {
    id: 'nuclearPore',
    name: 'Nuclear pore complex',
    tagline: 'A guarded gate, one of the largest machines in the cell',
    body:
      'Each pore is a ring of about 30 different proteins, repeated in eight-fold symmetry, threading through both nuclear membranes. Small molecules slip through freely; anything large needs a molecular passport in the form of a targeting signal that a carrier protein recognises.',
    facts: [
      'A single pore is built from ~1,000 protein subunits.',
      'A typical nucleus has 2,000-4,000 pores.',
      'Around 1,000 molecules pass through each pore every second.',
    ],
    color: palette.nuclearPore,
    size: '~120 nm wide',
    focus: {
      target: NUCLEUS.center.clone().add(EXPORT_PORE_DIR.clone().multiplyScalar(NUCLEUS.radius)),
      distance: 4.2,
    },
  },
  {
    id: 'nucleolus',
    name: 'Nucleolus',
    tagline: 'The ribosome factory inside the nucleus',
    body:
      'A dense blob with no membrane of its own — it is simply the place where ribosomal RNA genes are transcribed at furious speed and assembled with proteins into ribosome subunits. It condenses out of the nucleoplasm the way an oil droplet separates from water.',
    facts: [
      'A growing cell builds ~7,500 ribosome subunits per minute here.',
      'It has no membrane: it is a liquid droplet held together by molecular stickiness.',
      'It dissolves during cell division and reforms afterwards.',
    ],
    color: palette.nucleolus.base,
    size: '~1-3 µm',
    focus: { target: NUCLEOLUS.center.clone(), distance: 4.5 },
  },
  {
    id: 'chromatin',
    name: 'Chromatin & DNA',
    tagline: 'Two metres of instructions, folded into six micrometres',
    body:
      'DNA is wound around spool-shaped histone proteins, and those spools are coiled again and again. How tightly a region is packed decides whether its genes can be read at all — tightly wound DNA is effectively switched off. Each chromosome keeps to its own neighbourhood rather than mixing freely.',
    facts: [
      '~3.2 billion base pairs in a human cell, in 46 chromosomes.',
      'The double helix makes one full turn every 10.5 base pairs.',
      'Only ~2% of human DNA codes for protein; much of the rest is regulatory.',
      'A, T, G and C — A always pairs with T, G always with C.',
    ],
    color: palette.chromatin[0],
    size: '2 nm wide, 2 m long',
    focus: { target: NUCLEUS.center.clone().add(v(0.2, -0.3, 1.4)), distance: 5.5 },
  },
  {
    id: 'roughER',
    name: 'Rough endoplasmic reticulum',
    aka: 'rough ER',
    tagline: 'Where proteins destined for export are born and folded',
    body:
      'A maze of flattened sheets continuous with the nuclear envelope, "rough" because its surface is covered in ribosomes. A ribosome that starts making a protein carrying an ER address signal gets pulled to this surface and threads the growing chain directly into the lumen inside.',
    facts: [
      'Roughly a third of all your proteins are made here rather than in the cytosol.',
      'Proteins are folded and quality-checked here; failures are destroyed.',
      'Its membrane can account for over half of all membrane in the cell.',
    ],
    color: palette.roughER.base,
    size: 'sheets ~50 nm apart',
    focus: { target: ROUGH_ER_FOCUS.clone(), distance: 9 },
  },
  {
    id: 'smoothER',
    name: 'Smooth endoplasmic reticulum',
    aka: 'smooth ER',
    tagline: 'Lipid workshop, detox plant and calcium store',
    body:
      'The same continuous membrane network, but tubular and free of ribosomes. It builds the lipids that all other membranes are made from, breaks down drugs and toxins, and holds calcium at concentrations ten thousand times higher than the cytosol — ready to release as a signal.',
    facts: [
      'In liver cells it detoxifies alcohol and drugs; it expands when you drink.',
      'In muscle it stores the calcium that triggers each contraction.',
      'Makes cholesterol and steroid hormones.',
    ],
    color: palette.smoothER.base,
    size: 'tubules ~30 nm wide',
    focus: { target: v(4.6, -0.4, 2.8), distance: 6 },
  },
  {
    id: 'ribosome',
    name: 'Ribosome',
    tagline: 'The machine that reads RNA and builds protein',
    body:
      'Two interlocking subunits made mostly of RNA, not protein. The small subunit grips the messenger RNA; the large subunit joins amino acids together. Crucially, the chemistry is performed by the RNA itself — the ribosome is a ribozyme, a leftover from an earlier RNA-based world.',
    facts: [
      'Adds ~20 amino acids per second in humans, with one error in ~10,000.',
      'A single cell can carry 10 million of them.',
      'Many antibiotics work by jamming the bacterial ribosome specifically.',
    ],
    color: palette.ribosome,
    size: '~25 nm',
    focus: { target: RIBOSOME_FOCUS.clone(), distance: 2.2 },
  },
  {
    id: 'golgi',
    name: 'Golgi apparatus',
    tagline: 'The sorting office and finishing shop',
    body:
      'A stack of flattened sacs that receives vesicles from the ER on one face and releases them from the other. As cargo moves through, sugar chains are trimmed and rebuilt, tags are added, and each protein is sorted towards its correct destination — the surface, a lysosome, or outside the cell.',
    facts: [
      'Cargo enters at the cis face and leaves at the trans face.',
      'The sacs themselves mature and move forward, carrying cargo with them.',
      'Adds the sugar patterns that determine your blood group.',
    ],
    color: palette.golgi.base,
    size: '~1-2 µm stack',
    focus: { target: GOLGI.center.clone(), distance: 6 },
  },
  {
    id: 'vesicle',
    name: 'Transport vesicles',
    tagline: 'Membrane bubbles that ferry cargo between compartments',
    body:
      'Cargo never swims through the cytosol between organelles — it travels inside small spheres of membrane pinched off from one compartment and fused into the next. A protein coat assembles on the outside to force the membrane to curve, then falls away once the bubble is free.',
    facts: [
      'COPII coats bud vesicles out of the ER; COPI brings them back.',
      'Clathrin coats pull material in from the cell surface.',
      'Each vesicle carries a molecular zip code so it only fuses with the right target.',
    ],
    color: palette.vesicle.base,
    size: '50-100 nm',
    focus: { target: VESICLE_CLUSTER.centre.clone(), distance: 3.4 },
  },
  {
    id: 'mitochondrion',
    name: 'Mitochondrion',
    tagline: 'Where food energy becomes usable energy',
    body:
      'Two membranes: a smooth outer one and a deeply folded inner one. Those folds — cristae — carry the electron transport chain, which uses energy from food to pump protons into the gap between the membranes. The protons then flood back through a rotating turbine, ATP synthase, which builds ATP.',
    facts: [
      'You produce and consume roughly your own body weight in ATP every day.',
      'They carry their own small circular genome and divide independently.',
      'Almost certainly descended from a free-living bacterium engulfed ~1.5 billion years ago.',
      'Inherited only from your mother.',
    ],
    color: palette.mitoOuter.base,
    size: '0.5-3 µm long',
    focus: { target: FEATURED_MITO.clone(), distance: 5 },
  },
  {
    id: 'lysosome',
    name: 'Lysosome',
    tagline: 'The recycling centre — acidic and dangerous',
    body:
      'A membrane bag holding around 60 different digestive enzymes, kept at pH 4.5 by pumps that push protons inward. It breaks down worn-out organelles and material brought in from outside, returning the building blocks to the cytosol. The acidity is a safety feature: the enzymes barely work at the cytosol\'s neutral pH.',
    facts: [
      'Interior pH ~4.5, about 100x more acidic than the cytosol.',
      'Consuming a damaged organelle is called autophagy — "self-eating".',
      'A single missing enzyme causes a lysosomal storage disease such as Tay-Sachs.',
    ],
    color: palette.lysosome.base,
    size: '0.1-1.2 µm',
    focus: { target: LYSOSOMES[0].position.clone(), distance: 4 },
  },
  {
    id: 'peroxisome',
    name: 'Peroxisome',
    tagline: 'Handles the chemistry too reactive for the rest of the cell',
    body:
      'A small vesicle that carries out oxidation reactions which generate hydrogen peroxide — a corrosive by-product — and then immediately destroys it with the enzyme catalase. Isolating both steps in one compartment keeps the peroxide away from everything else.',
    facts: [
      'Catalase is among the fastest enzymes known: millions of reactions per second.',
      'Breaks down very-long-chain fatty acids no other organelle can handle.',
      'Also builds the myelin lipids that insulate nerve fibres.',
    ],
    color: palette.peroxisome.base,
    size: '0.1-1 µm',
    focus: { target: PEROXISOMES[0].position.clone(), distance: 3.5 },
  },
  {
    id: 'microtubule',
    name: 'Microtubules',
    tagline: 'Rigid rails radiating out from the cell centre',
    body:
      'Hollow tubes built from tubulin, stiff enough to act as the cell\'s scaffolding and as tracks for motor proteins. They are constantly growing and abruptly collapsing — "dynamic instability" — which lets the cell rearrange its interior in minutes and, during division, capture chromosomes.',
    facts: [
      '25 nm across; the largest cytoskeletal filament.',
      'Directional: motors read which end they are walking towards.',
      'Kinesin walks outward, dynein walks inward, both hand over hand.',
    ],
    color: palette.microtubule,
    size: '25 nm wide',
    focus: { target: CENTROSOME.center.clone().add(v(1.5, -0.5, 1.5)), distance: 8 },
  },
  {
    id: 'actin',
    name: 'Actin filaments',
    tagline: 'The mesh just under the skin that gives the cell its shape',
    body:
      'Thin, flexible, two-stranded filaments concentrated in a dense layer beneath the plasma membrane. They set the cell\'s shape and stiffness, and by growing at one end while shrinking at the other they push the membrane forward — this is how cells crawl.',
    facts: [
      'Only 7 nm across, but the most abundant protein in many cells.',
      'The same filaments, with myosin, contract your muscles.',
      'Rebuilt continuously: a filament can turn over in under a minute.',
    ],
    color: palette.actin,
    size: '7 nm wide',
    focus: { target: v(0, 6.5, 5.5), distance: 7 },
  },
  {
    id: 'centrosome',
    name: 'Centrosome',
    tagline: 'The organising centre microtubules grow from',
    body:
      'A pair of barrel-shaped centrioles sitting at right angles, surrounded by a cloud of proteins that nucleate new microtubules. Nearly every microtubule in the cell starts here, which is why the network looks like a star. Before division it duplicates, and the two copies become the poles of the spindle.',
    facts: [
      'Each centriole is nine triplets of microtubules in a barrel.',
      'The two centrioles sit almost exactly perpendicular to each other.',
      'The same structure, repurposed, builds cilia and sperm tails.',
    ],
    color: palette.centrosome.base,
    size: '~1 µm',
    focus: { target: CENTROSOME.center.clone(), distance: 4 },
  },
]

export const STRUCTURE_BY_ID = Object.fromEntries(
  STRUCTURES.map((s) => [s.id, s]),
) as Record<StructureId, Structure>

// ── guided tours ─────────────────────────────────────────────────────────────

export type TourStep = {
  title: string
  text: string
  focus: Focus
  /** Structures kept bright; everything else fades back. Empty = show all. */
  highlight: StructureId[]
  /** Animated mechanism to bring to the front during this step. */
  mechanism?: MechanismId
  /** Seconds before auto-advance. */
  duration: number
}

export type Tour = {
  id: string
  name: string
  subtitle: string
  color: string
  steps: TourStep[]
}

export const TOURS: Tour[] = [
  {
    id: 'firstLook',
    name: 'First look',
    subtitle: 'A two-minute orientation to the whole cell',
    color: palette.membrane.rim,
    steps: [
      {
        title: 'One cell',
        text: 'This is a generic animal cell, about 20 micrometres across. Everything you can see is inside a single one of the roughly 30 trillion cells in your body. Drag to look around at any time.',
        focus: OVERVIEW_FOCUS,
        highlight: [],
        duration: 12,
      },
      {
        title: 'A border, not a wall',
        text: 'The plasma membrane is a fluid sheet of lipids two molecules thick. It keeps the inside in — but it is peppered with proteins that let specific things across, so the cell can still trade with the world.',
        focus: { target: v(6, 2, 5), distance: 9 },
        highlight: ['plasmaMembrane', 'membraneProteins'],
        duration: 13,
      },
      {
        title: 'The genome, kept apart',
        text: 'The nucleus stores the DNA behind a double membrane. That separation is what makes us eukaryotes: RNA copies can be checked and edited before they are ever used to build a protein.',
        focus: { target: NUCLEUS.center.clone(), distance: 10 },
        highlight: ['nucleus', 'chromatin', 'nucleolus', 'nuclearPore'],
        duration: 13,
      },
      {
        title: 'The production line',
        text: 'Around the nucleus sits the endoplasmic reticulum, and beyond it the Golgi stack. Together they make, fold, decorate and dispatch nearly everything the cell exports.',
        focus: { target: v(2.5, -1.5, 2.0), distance: 10 },
        highlight: ['roughER', 'smoothER', 'golgi', 'vesicle'],
        mechanism: 'secretory',
        duration: 13,
      },
      {
        title: 'The power plants',
        text: 'Mitochondria drift through the cytosol converting food into ATP, the cell\'s energy currency. They were once free-living bacteria, and they still keep their own DNA.',
        focus: { target: FEATURED_MITO.clone(), distance: 6.5 },
        highlight: ['mitochondrion'],
        mechanism: 'bioenergetics',
        duration: 13,
      },
      {
        title: 'Not a bag of soup',
        text: 'Finally, the cytoskeleton: rigid microtubules radiating from the cell centre and a fine actin mesh under the membrane. They give the cell its shape and act as roads for cargo.',
        focus: { target: v(1.5, 1.5, 1.5), distance: 20 },
        highlight: ['microtubule', 'actin', 'centrosome'],
        mechanism: 'trafficking',
        duration: 13,
      },
    ],
  },
  {
    id: 'centralDogma',
    name: 'The central dogma',
    subtitle: 'DNA → RNA → protein, the flow of genetic information',
    color: palette.mrna.base,
    steps: [
      {
        title: 'The instructions',
        text: 'Inside the nucleus, DNA is coiled into chromatin. To use a gene, the cell first has to unwind that stretch of the double helix and expose the bases: A, T, G and C.',
        focus: { target: NUCLEUS.center.clone().add(v(0.1, -0.3, 1.5)), distance: 5.5 },
        highlight: ['chromatin', 'nucleus'],
        mechanism: 'centralDogma',
        duration: 14,
      },
      {
        title: 'Transcription',
        text: 'RNA polymerase clamps onto the DNA and crawls along it, reading one strand and building a matching RNA copy behind it. The DNA zips shut again as the enzyme passes. This copy is messenger RNA.',
        focus: { target: NUCLEUS.center.clone().add(v(0.1, -0.3, 1.5)), distance: 3.8 },
        highlight: ['chromatin'],
        mechanism: 'centralDogma',
        duration: 15,
      },
      {
        title: 'Export',
        text: 'The finished mRNA is escorted to a nuclear pore and threaded out into the cytosol. DNA itself never leaves the nucleus — only the copy travels.',
        focus: {
          target: NUCLEUS.center.clone().add(EXPORT_PORE_DIR.clone().multiplyScalar(NUCLEUS.radius * 1.1)),
          distance: 4.5,
        },
        highlight: ['nuclearPore', 'nucleus'],
        mechanism: 'centralDogma',
        duration: 13,
      },
      {
        title: 'Translation',
        text: 'A ribosome grips the mRNA and reads it three bases at a time. For each triplet, a transfer RNA arrives carrying the matching amino acid, and the chain grows — about twenty amino acids every second.',
        focus: { target: NUCLEUS.center.clone().add(v(3.2, -1.0, 2.9)), distance: 3.2 },
        highlight: ['ribosome', 'roughER'],
        mechanism: 'centralDogma',
        duration: 16,
      },
      {
        title: 'Folding',
        text: 'The finished chain collapses into a precise three-dimensional shape. That shape is the function: change one amino acid in the wrong place and the protein may not work at all.',
        focus: { target: NUCLEUS.center.clone().add(v(3.4, -1.2, 3.1)), distance: 3.0 },
        highlight: ['roughER'],
        mechanism: 'centralDogma',
        duration: 13,
      },
    ],
  },
  {
    id: 'secretory',
    name: 'The secretory pathway',
    subtitle: 'How a protein travels from the ER to the outside world',
    color: palette.golgi.base,
    steps: [
      {
        title: 'Into the ER',
        text: 'A protein carrying an ER address signal is pushed through the rough ER membrane as it is being built, arriving inside the lumen where it folds and gets its first sugar chains.',
        focus: { target: NUCLEUS.center.clone().add(v(2.8, -0.8, 2.6)), distance: 5.5 },
        highlight: ['roughER', 'ribosome'],
        mechanism: 'secretory',
        duration: 14,
      },
      {
        title: 'Budding out',
        text: 'At an exit site, a COPII protein coat assembles on the outside of the ER membrane and forces it to curve until a vesicle pinches off, carrying the cargo with it.',
        focus: { target: ER_EXIT_SITE.clone(), distance: 3.6 },
        highlight: ['vesicle', 'roughER'],
        mechanism: 'secretory',
        duration: 14,
      },
      {
        title: 'Through the Golgi',
        text: 'The vesicle fuses with the cis face of the Golgi. As cargo moves through the stack, enzymes in each sac trim and rebuild its sugar chains — a molecular assembly line that also acts as a sorting signal.',
        focus: { target: GOLGI.center.clone(), distance: 5.5 },
        highlight: ['golgi'],
        mechanism: 'secretory',
        duration: 15,
      },
      {
        title: 'Dispatch and exocytosis',
        text: 'A vesicle leaves the trans face, travels to the plasma membrane and fuses with it. The membrane opens outward and the cargo is released — the vesicle\'s own membrane becomes part of the cell surface.',
        focus: { target: v(5.5, -3.0, 4.5), distance: 7 },
        highlight: ['vesicle', 'plasmaMembrane'],
        mechanism: 'secretory',
        duration: 15,
      },
    ],
  },
  {
    id: 'bioenergetics',
    name: 'Powering the cell',
    subtitle: 'How a proton gradient becomes ATP',
    color: palette.mitoOuter.base,
    steps: [
      {
        title: 'Two membranes',
        text: 'A mitochondrion has a smooth outer membrane and a heavily folded inner one. Those folds — cristae — multiply the working surface, and the narrow gap between the membranes is where the trick happens.',
        focus: { target: FEATURED_MITO.clone(), distance: 5 },
        highlight: ['mitochondrion'],
        mechanism: 'bioenergetics',
        duration: 14,
      },
      {
        title: 'The electron transport chain',
        text: 'Electrons stripped from food are passed down a series of protein complexes embedded in the cristae. Each transfer releases energy, which the complexes use to pump protons out of the matrix.',
        focus: { target: FEATURED_MITO.clone(), distance: 2.9 },
        highlight: ['mitochondrion'],
        mechanism: 'bioenergetics',
        duration: 16,
      },
      {
        title: 'ATP synthase',
        text: 'Protons crowd in the intermembrane space, then rush back through a single channel: ATP synthase. The flow physically spins its rotor, and each turn forces ADP and phosphate together into ATP.',
        focus: { target: MITO_SYNTHASE_WORLD.clone(), distance: 1.9 },
        highlight: ['mitochondrion'],
        mechanism: 'bioenergetics',
        duration: 16,
      },
      {
        title: 'The currency',
        text: 'ATP diffuses out into the cytosol, where every energy-hungry process spends it. You turn over roughly your own body weight in ATP each day — recycled thousands of times, not made afresh.',
        focus: { target: FEATURED_MITO.clone(), distance: 8 },
        highlight: ['mitochondrion', 'cytosol'],
        mechanism: 'bioenergetics',
        duration: 13,
      },
    ],
  },
  {
    id: 'signalling',
    name: 'Signals at the surface',
    subtitle: 'How a message crosses a membrane it cannot pass through',
    color: palette.ligand,
    steps: [
      {
        title: 'A message arrives',
        text: 'A signal molecule — a hormone, say — drifts up to the cell. It cannot cross the oily membrane, and it does not need to. It only has to be recognised.',
        focus: { target: SIGNAL_RECEPTOR_DIR.clone().multiplyScalar(CELL_RADIUS + 1), distance: 5 },
        highlight: ['membraneProteins', 'plasmaMembrane'],
        mechanism: 'signalling',
        duration: 13,
      },
      {
        title: 'Binding and shape change',
        text: 'The signal locks into a receptor whose shape fits it exactly. That binding twists the part of the receptor sticking into the cytosol — the message has crossed the membrane as a change of shape, not as a molecule.',
        focus: { target: SIGNAL_RECEPTOR_DIR.clone().multiplyScalar(CELL_RADIUS - 0.4), distance: 3.2 },
        highlight: ['membraneProteins'],
        mechanism: 'signalling',
        duration: 15,
      },
      {
        title: 'Amplification',
        text: 'The activated receptor switches on relay proteins inside, each of which activates many more. One signal molecule outside can produce hundreds of thousands of active molecules within seconds.',
        focus: { target: SIGNAL_RECEPTOR_DIR.clone().multiplyScalar(CELL_RADIUS * 0.55), distance: 6.5 },
        highlight: ['membraneProteins', 'cytosol'],
        mechanism: 'signalling',
        duration: 15,
      },
      {
        title: 'Taking material in',
        text: 'The cell can also swallow the outside world. A clathrin coat bends a patch of membrane inward until it pinches off as a vesicle — endocytosis — and the contents are delivered to a lysosome.',
        focus: { target: v(-6.0, -3.2, 4.2), distance: 5.5 },
        highlight: ['plasmaMembrane', 'lysosome', 'vesicle'],
        mechanism: 'signalling',
        duration: 15,
      },
    ],
  },
  {
    id: 'trafficking',
    name: 'The cell\'s highways',
    subtitle: 'Scaffolding, rails and the motors that walk them',
    color: palette.microtubule,
    steps: [
      {
        title: 'The organising centre',
        text: 'Almost every microtubule in the cell grows outward from the centrosome, near the nucleus. That is why the network radiates like a star, and why the cell has a definable centre at all.',
        focus: { target: CENTROSOME.center.clone(), distance: 4.5 },
        highlight: ['centrosome', 'microtubule'],
        mechanism: 'trafficking',
        duration: 14,
      },
      {
        title: 'Dynamic instability',
        text: 'Microtubules do not sit still. They grow steadily, then abruptly collapse and rebuild. Constant demolition sounds wasteful, but it lets the cell reorganise its whole interior within minutes.',
        focus: { target: CENTROSOME.center.clone().add(v(2, -1, 2)), distance: 9 },
        highlight: ['microtubule'],
        mechanism: 'trafficking',
        duration: 14,
      },
      {
        title: 'Motor proteins',
        text: 'Kinesin literally walks along a microtubule, one 8-nanometre step at a time, hauling a vesicle behind it and burning one ATP per step. Dynein walks the opposite way, back towards the centre.',
        focus: { target: CENTROSOME.center.clone().add(v(2.6, -1.4, 2.4)), distance: 4 },
        highlight: ['microtubule', 'vesicle'],
        mechanism: 'trafficking',
        duration: 16,
      },
      {
        title: 'The cortex',
        text: 'Just under the plasma membrane lies a dense actin mesh. It sets the cell\'s shape and stiffness, and by growing against the membrane it pushes the cell forward when it crawls.',
        focus: { target: v(0, 6.0, 5.0), distance: 8 },
        highlight: ['actin', 'plasmaMembrane'],
        mechanism: 'trafficking',
        duration: 14,
      },
    ],
  },
]

export const TOUR_BY_ID = Object.fromEntries(TOURS.map((t) => [t.id, t])) as Record<string, Tour>
