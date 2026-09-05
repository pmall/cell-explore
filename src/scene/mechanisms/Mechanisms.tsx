import { CentralDogma } from './CentralDogma'
import { SecretoryPathway } from './Secretory'
import { Bioenergetics } from './Bioenergetics'
import { Signalling } from './Signalling'
import { Trafficking } from './Trafficking'

/**
 * Every process runs all the time, whether or not anyone is looking at it.
 * A tour only changes which one is brought forward.
 */
export function Mechanisms() {
  return (
    <>
      <CentralDogma />
      <SecretoryPathway />
      <Bioenergetics />
      <Signalling />
      <Trafficking />
    </>
  )
}
