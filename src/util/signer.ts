import { log } from './string'
import { getPublicKey } from './coracle/misc'
import { Connect } from './coracle/connect'
import { Signer } from './coracle/signer'

const signer = createSigner()
export function getSigner(): Signer {
  return signer
}

function createSigner(): Signer {
  // The following section initializes the code borrowed from Coracle

  let session: any
  const loginWithPrivateKey = (privkey: string, extra = {}) =>
    session = {method: "privkey", pubkey: getPublicKey(privkey), privkey, ...extra}
  loginWithPrivateKey(process.env.DVM_NSEC_HEX)
  if (!session) { log('SEND', `error: no session`); return }
  if (session.pubkey != getPublicKey(process.env.DVM_NSEC_HEX)) log('DBUG', `DVM pubkey: ${getPublicKey(process.env.DVM_NSEC_HEX)}`)
  // log('DBUG', `sender pubkey: ${session.pubkey}`)

  let connect = new Connect(session)
  // if (!connect.isEnabled()) log('DBUG', `connect enabled ${connect.isEnabled()}`)

  const signer = new Signer(session, connect)
  if (!signer.isEnabled()) log('DBUG', `signer enabled ${signer.isEnabled()}`)

  return signer
}

