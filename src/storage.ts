import { log, humanReadableAge } from './util/string'
import { createEvent } from '@welshman/util'
import { getSigner } from './util/signer'

export function needStorage(): Promise<string> {
  return new Promise((resolve, reject) => {
    log('STOR', 'checking storage')
    const signer = getSigner()
    const requestAccount = signer.signAsUser(signer.prepAsUser(createEvent(
      22242,
      {
        content: 'Authenticate User',
        tags: []
      }
    )))
    fetch(`${process.env.STORAGE_URL}/v1/media/account?auth=${encodeURIComponent(JSON.stringify(requestAccount))}`).then(response => {
      if (response.ok) {
        const contentType = response.headers.get("content-type").split(';')[0]
        if (contentType != 'application/json') log('WARN', `content type is: ${contentType}`)
        response.json().then(json => {
          // log('DBUG', JSON.stringify(json))
          if (json.paidThrough && json.timeRemaining) log('INFO', `paid time remaining: ${humanReadableAge(Math.floor(Date.now()/1000), json.paidThrough)} (${humanReadableAge(Math.floor(Date.now()/1000), json.timeRemaining)})`)
          if (json.storageTotal && json.usageTotal) log('INFO', `usage: ${json.storageTotal} bytes, ${Math.floor(100 * json.usageTotal)}%`)
          if (json.creditTotal <= 0) { // we are informed that we need to make a payment
            resolve('insufficient credit') 
          } else {
            reject('credit is sufficient')
          }
        }).catch(e => {
          reject(`authentication failed: ${JSON.stringify(e)}`)
        })
      } else {
        reject(`unable to get account details: ${JSON.stringify(response.status)} ${process.env.STORAGE_URL}`)
      }
    }).catch(e => {
      reject(`authentication failed: ${JSON.stringify(e)}`)
    })
  })
}

export function requestStorage(): Promise<{ satCost: number, relays: string[], description: string, offerId: string, payUrl: string }> {
  return new Promise((resolve, reject) => {
    log('STOR', `requesting more storage`)
    const signer = getSigner()
    const requestCredit = signer.signAsUser(signer.prepAsUser(createEvent(
      22242,
      {
        content: 'Request Storage',
        tags: [
          ['gb_months', '1'],
        ]
      }
    )))
    fetch(`${process.env.STORAGE_URL}/v1/media/account/credit?auth=${encodeURIComponent(JSON.stringify(requestCredit))}`).then(response => {
      if (response.ok) {
        const contentType = response.headers.get("content-type").split(';')[0]
        if (contentType != 'application/json') log('WARN', `content type is: ${contentType}`)
        response.json().then(json => {
          if (!process.env.STORAGE_NPUB_HEX) {
            log('INIT', `warning: STORAGE_NPUB_HEX should probably be set to ${json.offer.pubkey}`)
          } else if (json.offer.pubkey !== process.env.STORAGE_NPUB_HEX) {
            reject(`payment recipient pubkey ${json.offer.pubkey} does not match STORAGE_NPUB_HEX ${process.env.STORAGE_NPUB_HEX}`)
            return
          }
          const [[ _0, ...relays ]] = json.payment.tags.filter(e => e[0] == 'relays')
          const [[ _1, msatStr ]] = json.payment.tags.filter(e => e[0] == 'amount')
          const satNum = Math.ceil((+msatStr)/1000)
          resolve({
            satCost: satNum,
            relays,
            description: `PURCHASE OF CDN STORAGE (${requestCredit.tags[0][1]} ${requestCredit.tags[0][0]})`,
            offerId: json.offer.id,
            payUrl: json.callback,
          })
        }).catch(e => {
          reject(`credit request failed: ${JSON.stringify(e)}`)
        })
      } else {
        reject(`unable to make credit request: ${JSON.stringify(response.status)} ${process.env.STORAGE_URL}`)
      }
    }).catch(e => {
      reject(`credit request failed: ${JSON.stringify(e)}`)
    })
  })
}

export function getStorageInvoice(sats: number, relays: string[], desc: string, offerId: string, payUrl: string): Promise<{ invoice, check }> {
  return new Promise((resolve, reject) => {
    log('STOR', 'retrieving storage invoice')
    const msatStr = ''+Math.ceil(sats*1000)
    const signer = getSigner()
    const payment = signer.signAsUser(signer.prepAsUser(createEvent(
      9734,
      {
        content: desc,
        tags: [
          ['relays', ...new Set(relays.concat('wss://relay.fanfares.io'))],
          ['amount', msatStr],
          ['p', process.env.STORAGE_NPUB_HEX],
          ['e', offerId],
        ]
      }
    )))
    fetch(`${payUrl}?amount=${msatStr}&nostr=${encodeURIComponent(JSON.stringify(payment))}`).then(response => {
      if (response.ok) {
        const contentType = response.headers.get("content-type").split(';')[0]
        if (contentType != 'application/json') log('WARN', `content type is: ${contentType}`)
        response.json().then(json => {
          // log('DBUG', JSON.stringify(json))
          const invoice = json.pr
          const verificationUrl = json.verify
          resolve({ invoice, check: verificationUrl })
        }).catch(e => {
          reject(`invoice request failed: ${JSON.stringify(e)}`)
        })
      } else {
        reject(`unable to request invoice: ${JSON.stringify(response.status)} ${process.env.STORAGE_URL}`)
      }
    }).catch(e => {
      reject(`invoice request failed: ${JSON.stringify(e)}`)
    })
  })
}

