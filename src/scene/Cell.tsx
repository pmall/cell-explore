import { Nucleus } from './organelles/Nucleus'
import { Chromatin } from './organelles/Chromatin'
import { PlasmaMembrane } from './organelles/PlasmaMembrane'
import { MembraneProteins } from './organelles/MembraneProteins'
import { EndoplasmicReticulum } from './organelles/ER'
import { Golgi } from './organelles/Golgi'
import { Mitochondria } from './organelles/Mitochondria'
import { SmallOrganelles } from './organelles/SmallOrganelles'
import { Cytoskeleton } from './organelles/Cytoskeleton'
import { Mechanisms } from './mechanisms/Mechanisms'

/** The whole cell. Anatomy first, then the animated processes on top of it. */
export function Cell() {
  return (
    <group>
      <PlasmaMembrane />
      <MembraneProteins />
      <Cytoskeleton />
      <Nucleus>
        <Chromatin />
      </Nucleus>
      <EndoplasmicReticulum />
      <Golgi />
      <Mitochondria />
      <SmallOrganelles />
      <Mechanisms />
    </group>
  )
}
