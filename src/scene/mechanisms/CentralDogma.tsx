import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ribosomeGeometry, tubeGeometry } from '../../lib/geometry'
import { useSolidMaterial } from '../../lib/materials'
import { palette } from '../../theme/palette'
import { ACTIVE_GENE, EXPORT_PORE_DIR, NUCLEUS } from '../../data/layout'
import { DoubleHelix } from '../organelles/Chromatin'
import { Nameable } from '../Nameable'
import { pickWhenVisible, instanceSphereRaycast } from '../picking'
import { cellTime, phase, smooth } from '../clock'
import { MechanismGroup, proteinGeometry, strandCurve } from './common'

/**
 * DNA -> RNA -> protein, end to end, on a 44-second loop:
 *
 *   0.00-0.34  transcription: RNA polymerase crawls the gene, mRNA grows behind it
 *   0.34-0.48  export: the transcript is threaded out through a nuclear pore
 *   0.48-0.86  translation: a ribosome reads the message, tRNAs deliver amino acids
 *   0.86-1.00  folding: the finished chain collapses into a working protein
 *
 * Every stage is driven by one shared progress value, so the phases can never
 * drift out of order no matter how long the page has been open.
 */

const PERIOD = 44

const GENE_START = NUCLEUS.center.clone().add(ACTIVE_GENE.start)
const GENE_END = NUCLEUS.center.clone().add(ACTIVE_GENE.end)
const PORE = NUCLEUS.center.clone().add(EXPORT_PORE_DIR.clone().multiplyScalar(NUCLEUS.radius))
const RIBOSOME_SITE = NUCLEUS.center.clone().add(new THREE.Vector3(3.2, -1.0, 2.9))

/** tRNAs are 0.1 across and dart about; give the cursor something to catch. */
const TRNA_PICK = instanceSphereRaycast(0.17)

const TRANSCRIBE = [0.0, 0.34] as const
const EXPORT = [0.34, 0.48] as const
const TRANSLATE = [0.48, 0.86] as const
const FOLD = [0.86, 1.0] as const

export function CentralDogma() {
  const bubbleRef = useRef<number | null>(0)

  // ── geometries ─────────────────────────────────────────────────────────────
  const geneDir = useMemo(() => GENE_END.clone().sub(GENE_START).normalize(), [])
  const geneLength = useMemo(() => GENE_END.distanceTo(GENE_START), [])

  /** The nascent transcript, peeling away from the helix as it is made. */
  const nascentGeo = useMemo(() => {
    const up = Math.abs(geneDir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const side = new THREE.Vector3().crossVectors(geneDir, up).normalize()
    const lift = new THREE.Vector3().crossVectors(geneDir, side).normalize()
    const pts: THREE.Vector3[] = []
    const steps = 40
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      pts.push(
        GENE_START.clone()
          .addScaledVector(geneDir, t * geneLength)
          .addScaledVector(side, 0.42 + Math.sin(t * 9) * 0.16)
          .addScaledVector(lift, Math.cos(t * 7.5) * 0.18 + 0.1),
      )
    }
    return tubeGeometry(pts, 0.05, 130, 6)
  }, [geneDir, geneLength])

  /** The free transcript once it detaches: a compact wiggly strand. */
  const strandGeo = useMemo(() => {
    const curve = strandCurve(1.5, 5, 0.13, 1.2)
    return new THREE.TubeGeometry(curve, 90, 0.05, 6, false)
  }, [])

  const polymeraseGeo = useMemo(() => proteinGeometry(0.26, 4), [])
  const ribosomeGeo = useMemo(() => ribosomeGeometry(0.5), [])
  const trnaGeo = useMemo(() => proteinGeometry(0.1, 9), [])
  const proteinGeo = useMemo(() => proteinGeometry(0.24, 2), [])

  /** The polypeptide chain, revealed link by link as translation proceeds. */
  const peptideGeo = useMemo(() => {
    const curve = strandCurve(1.7, 6, 0.12, 3.4)
    return new THREE.TubeGeometry(curve, 100, 0.045, 6, false)
  }, [])

  // ── materials ──────────────────────────────────────────────────────────────
  const mrnaMat = useSolidMaterial(palette.mrna.base, { emissive: 0.8 })
  const polMat = useSolidMaterial(palette.rnaPolymerase, { emissive: 0.5 })
  const riboMat = useSolidMaterial(palette.ribosome, { emissive: 0.4 })
  const trnaMat = useSolidMaterial(palette.trna.base, { emissive: 0.6 })
  const peptideMat = useSolidMaterial(palette.protein.base, { emissive: 0.55 })
  const proteinMat = useSolidMaterial(palette.proteinFolded.base, { emissive: 0.5 })

  // ── paths ──────────────────────────────────────────────────────────────────
  const exportPath = useMemo(() => {
    const outside = PORE.clone().addScaledVector(EXPORT_PORE_DIR, 0.55)
    return new THREE.CatmullRomCurve3(
      [
        GENE_END.clone(),
        GENE_END.clone().lerp(PORE, 0.55).add(new THREE.Vector3(0, 0.4, 0)),
        PORE.clone(),
        outside,
        outside.clone().lerp(RIBOSOME_SITE, 0.5).add(new THREE.Vector3(0, -0.3, 0)),
        RIBOSOME_SITE.clone(),
      ],
      false,
      'centripetal',
      0.5,
    )
  }, [])

  // ── refs ───────────────────────────────────────────────────────────────────
  const nascent = useRef<THREE.Mesh>(null)
  const polymerase = useRef<THREE.Mesh>(null)
  const strand = useRef<THREE.Mesh>(null)
  const ribosome = useRef<THREE.Mesh>(null)
  const peptide = useRef<THREE.Mesh>(null)
  const protein = useRef<THREE.Mesh>(null)
  const trnas = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const nascentIndexCount = useMemo(() => nascentGeo.index?.count ?? 0, [nascentGeo])
  const peptideIndexCount = useMemo(() => peptideGeo.index?.count ?? 0, [peptideGeo])

  useFrame(() => {
    const t = cellTime()
    const p = ((t / PERIOD) % 1 + 1) % 1

    const inTranscribe = p >= TRANSCRIBE[0] && p < TRANSCRIBE[1]
    const inExport = p >= EXPORT[0] && p < EXPORT[1]
    const inTranslate = p >= TRANSLATE[0] && p < TRANSLATE[1]
    const inFold = p >= FOLD[0]

    // ── transcription ────────────────────────────────────────────────────────
    const tp = phase(p, TRANSCRIBE[0], TRANSCRIBE[1])
    bubbleRef.current = inTranscribe ? tp : null

    if (polymerase.current) {
      polymerase.current.visible = inTranscribe
      if (inTranscribe) {
        polymerase.current.position
          .copy(GENE_START)
          .addScaledVector(geneDir, tp * geneLength)
          .add(new THREE.Vector3(0, 0.1, 0))
        // A slight rock as it ratchets along, one base pair at a time.
        polymerase.current.rotation.set(t * 1.5, t * 0.9, Math.sin(t * 14) * 0.12)
      }
    }

    if (nascent.current) {
      nascent.current.visible = inTranscribe
      // Reveal the transcript from the promoter up to wherever the enzyme is.
      const rings = Math.max(1, Math.floor(130 * tp))
      nascent.current.geometry.setDrawRange(0, Math.min(nascentIndexCount, rings * 6 * 6))
    }

    // ── export, then docking at the ribosome ─────────────────────────────────
    if (strand.current) {
      strand.current.visible = inExport || inTranslate
      if (inExport) {
        const ep = smooth(phase(p, EXPORT[0], EXPORT[1]))
        const at = exportPath.getPointAt(ep)
        const tangent = exportPath.getTangentAt(ep)
        strand.current.position.copy(at)
        strand.current.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent)
        // Squeeze through the pore: transcripts are threaded, not floated, out.
        const squeeze = 1 - 0.55 * Math.exp(-Math.pow((ep - 0.5) * 6, 2))
        strand.current.scale.set(1, squeeze, squeeze)
      } else if (inTranslate) {
        strand.current.position.copy(RIBOSOME_SITE)
        strand.current.quaternion.identity()
        strand.current.scale.setScalar(1)
      }
    }

    // ── translation ──────────────────────────────────────────────────────────
    const lp = phase(p, TRANSLATE[0], TRANSLATE[1])
    if (ribosome.current) {
      ribosome.current.visible = inTranslate
      if (inTranslate) {
        // The ribosome tracks along the message from one end to the other.
        ribosome.current.position
          .copy(RIBOSOME_SITE)
          .add(new THREE.Vector3((lp - 0.5) * 1.4, -0.12, 0))
        ribosome.current.rotation.y = t * 0.4
      }
    }

    if (trnas.current) {
      trnas.current.visible = inTranslate
      if (inTranslate) {
        const site = ribosome.current?.position ?? RIBOSOME_SITE
        for (let i = 0; i < 3; i++) {
          // Each tRNA runs its own fast approach-and-leave cycle.
          const sub = ((t * 0.8 + i / 3) % 1 + 1) % 1
          const approach = sub < 0.5 ? sub / 0.5 : 1 - (sub - 0.5) / 0.5
          const angle = i * 2.1 + t * 0.3
          const far = new THREE.Vector3(Math.cos(angle) * 1.5, 0.9, Math.sin(angle) * 1.5)
          dummy.position.copy(site).addScaledVector(far, 1 - smooth(approach))
          dummy.position.y += 0.25 * smooth(approach)
          dummy.rotation.set(t + i, t * 0.7 + i, 0)
          dummy.scale.setScalar(0.9 + 0.2 * approach)
          dummy.updateMatrix()
          trnas.current.setMatrixAt(i, dummy.matrix)
        }
        trnas.current.instanceMatrix.needsUpdate = true
      }
    }

    if (peptide.current) {
      peptide.current.visible = inTranslate
      if (inTranslate) {
        peptide.current.position.copy(RIBOSOME_SITE).add(new THREE.Vector3(-0.7, 0.45, 0.15))
        const rings = Math.max(1, Math.floor(100 * lp))
        peptide.current.geometry.setDrawRange(0, Math.min(peptideIndexCount, rings * 6 * 6))
      }
    }

    // ── folding ──────────────────────────────────────────────────────────────
    if (protein.current) {
      protein.current.visible = inFold
      if (inFold) {
        const fp = smooth(phase(p, FOLD[0], FOLD[1]))
        protein.current.position
          .copy(RIBOSOME_SITE)
          .add(new THREE.Vector3(-0.7 + fp * 0.5, 0.45 + fp * 0.7, 0.15 + fp * 0.6))
        // Collapse into a compact globule, then settle.
        protein.current.scale.setScalar(0.35 + smooth(Math.min(1, fp * 1.8)) * 0.75)
        protein.current.rotation.set(t * 0.6, t * 0.9, 0)
      }
    }
  })

  // Every actor is named for the tooltip. The gene and the ribosome are labelled
  // with the structures they are, rather than with near-duplicate molecules.
  return (
    <MechanismGroup id="centralDogma">
      <Nameable id="chromatin">
        <DoubleHelix start={GENE_START} end={GENE_END} bubbleRef={bubbleRef} />
      </Nameable>
      <Nameable id="mrna">
        <mesh ref={nascent} geometry={nascentGeo} material={mrnaMat} raycast={pickWhenVisible} />
        <mesh ref={strand} geometry={strandGeo} material={mrnaMat} raycast={pickWhenVisible} />
      </Nameable>
      <Nameable id="rnaPolymerase">
        <mesh ref={polymerase} geometry={polymeraseGeo} material={polMat} raycast={pickWhenVisible} />
      </Nameable>
      <Nameable id="ribosome">
        <mesh ref={ribosome} geometry={ribosomeGeo} material={riboMat} raycast={pickWhenVisible} />
      </Nameable>
      <Nameable id="trna">
        <instancedMesh
          ref={trnas}
          args={[trnaGeo, trnaMat, 3]}
          frustumCulled={false}
          raycast={TRNA_PICK}
        />
      </Nameable>
      <Nameable id="polypeptide">
        <mesh ref={peptide} geometry={peptideGeo} material={peptideMat} raycast={pickWhenVisible} />
      </Nameable>
      <Nameable id="foldedProtein">
        <mesh ref={protein} geometry={proteinGeo} material={proteinMat} raycast={pickWhenVisible} />
      </Nameable>
    </MechanismGroup>
  )
}
