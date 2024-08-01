import { Nip44 } from './util/coracle/nip44'
import { Nip59 } from './util/coracle/nip59'
import { Connect } from './util/coracle/connect'
import { Signer } from './util/coracle/signer'
import { getPublicKey } from './util/coracle/misc'
import { log } from './util/string'
import { createEvent } from '@welshman/util'
import { publish, subscribe } from '@welshman/net'
import crypto from "crypto"


/* Aim: state-of-the-art NIP-17-compliant direct messages sent using NIP 44 encryption and NIP 59 gift wrapping. */

export function sendDM(buyer: string, message: string, relays) {
  log('DBUG', `buyer pubkey: ${buyer}`)

  if (!process.env.DVM_NSEC_HEX) return // error is already reported once during INIT

  const randomSK = crypto.randomBytes(32).toString('hex')
  const randomPK = getPublicKey(randomSK)
  log('DBUG', `delivery-boy pubkey: ${randomPK}`)


  // The following section initializes the code borrowed from Coracle

  let session: any
  const loginWithPrivateKey = (privkey: string, extra = {}) =>
    session = {method: "privkey", pubkey: getPublicKey(privkey), privkey, ...extra}
  loginWithPrivateKey(process.env.DVM_NSEC_HEX)
  if (!session) { log('SEND', `error: no session`); return }
  if (session.pubkey != getPublicKey(process.env.DVM_NSEC_HEX)) log('DBUG', `DVM pubkey: ${getPublicKey(process.env.DVM_NSEC_HEX)}`)
  log('DBUG', `sender pubkey: ${session.pubkey}`)

  let connect = new Connect(session)
  // if (!connect.isEnabled()) log('DBUG', `connect enabled ${connect.isEnabled()}`)

  const nip44 = new Nip44(session, connect)
  if (!nip44.isEnabled()) log('DBUG', `nip44 enabled ${nip44.isEnabled()}`)

  const signer = new Signer(session, connect)
  if (!signer.isEnabled()) log('DBUG', `signer enabled ${signer.isEnabled()}`)

  const nip59 = new Nip59(session, nip44, signer)


  // Create the gift-wrapped, encrypted message

  nip59.wrap(
    createEvent(
      14,
      {
        content: message,
        tags: [
          ['p', buyer], // TODO: is the relay (third element) required?
          ['subject', 'content delivery'],
        ]
      }
    ), {
      author: null, // kind 14 sender, defaults to DVM secret key if null
      wrap: {
        author: randomSK, // kind 1059 sender, secret key, should be random
        recipient: buyer
      }
    }
  ).then(value => {
    const { wrap, ...templ } = value

    // this can be unwrapped again as follows:
    // 
    // log('DBUG', `wrap result ${JSON.stringify(wrap)}`)
    // nip59.unwrap(wrap, buyerSK).then(value => {
    //   const { wrap, ...unwrap } = value
    //   log('DBUG', `unwrap result ${JSON.stringify(unwrap)}`)
    // }, reason => {
    //   log('DBUG', `unwrap failed ${JSON.stringify(reason)}`)
    // })


    // Determine which relays to send DM over, per NIP 17
    const sub = subscribe({
      relays,
      filters: [{
        kinds: [10050 /* inbox relay list */],
        authors: [buyer]
      }],
      timeout: 5/*seconds*/ * 1000/*milliseconds*/,
    })

    // log cumulative status after query timeout expires
    let sent = [], ackd = []
    setTimeout(() => log('SEND', `outgoing DM results ${JSON.stringify(sent.map(e => e + (ackd[e]?` (${ackd[e]})`:'')))}`), 6/*seconds*/ * 1000/*milliseconds*/)


    // send direct message to select relays as the query results come in

    sub.emitter.on('eose', (url: string) => {
      // log('QURY', `eose: ${url}`)
    })
    sub.emitter.on('close', (url: string) => {
      log('QURY', `close: ${url}`)
    })
    sub.emitter.on('complete', () => {
      // log('QURY', `complete`)
    })
    sub.emitter.on('duplicate', (url: string, e: any) => {
      log('QURY', `duplicate: ${url}, ${JSON.stringify(e)}`)
    })
    sub.emitter.on('deleted-event', (url: string, e: any) => {
      log('QURY', `deleted-event: ${url}, ${JSON.stringify(e)}`)
    })
    sub.emitter.on('failed-filter', (url: string, e: any) => {
      log('QURY', `failed-filter: ${url}, ${JSON.stringify(e)}`)
    })
    sub.emitter.on('invalid-signature', (url: string, e: any) => {
      log('QURY', `invalid-signature: ${url}, ${JSON.stringify(e)}`)
    })
    sub.emitter.on('event', (url: string, relayList: any) => {
      relays = relayList.tags.filter(e => e[0] == 'relay').map(e => e[1])
      // log('QURY', `relays ${JSON.stringify(relays)}`)
      for (const r of relays) if (!sent.includes(r)) {
        const pub = publish({ event: wrap, relays: [r] })
        sent.push(r)
        pub.emitter.on("*", status => {
          ackd[r] = status
        })
      }
    })
  })
}
