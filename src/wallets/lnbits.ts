import { log } from '../util/string'

const MINUTE_IN_SECONDS = 60

export function checkInvoice(invoice: string, satAmount: number): Promise<void> {
  return new Promise((resolve, reject) => {
    log('WALT', 'checking invoice')
    fetch(`${process.env.WALLET_URL}/api/v1/payments/decode`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: invoice,
      }),
    }).then(response => {
      if (response.ok) {
        response.json().then(json => {
          if (json.currency != 'bc') {
            reject(`invoice failed sanity check: currency '${json.currency}' is not 'bc'`)
          } else if (Math.floor(json.amount_msat / 1000) < satAmount || Math.ceil(json.amount_msat / 1000) > satAmount) {
            reject(`invoice failed sanity check: amount_msat '${json.amount_msat}' does not match expectation of '${satAmount} sats'`)
          } else if (Math.abs(Date.now() / 1000 - json.date) > 1 * MINUTE_IN_SECONDS) {
            reject(`invoice failed sanity check: age of '${Math.round(Date.now() / 1000 - json.date)}' (s) is not acceptable`)
          } else if (Math.abs(Date.now() / 1000 - json.date) > json.expiry) {
            reject(`invoice failed sanity check: age of '${Math.round(Date.now() / 1000 - json.date)}' (s) is beyond expiry of '${json.expiry}' (s)`)
          } else {
            resolve()
            return
          }
          log('DBUG', `response: ${JSON.stringify(json)}`)
        }).catch(e => {
          reject(`error decoding invoice: ${JSON.stringify(e)}`)
        })
      } else {
        response.json().then(json => {
          log('WALT', `response: ${JSON.stringify(json)}`)
        })
        reject(`error decoding invoice: ${response.status}`)
      }
    }).catch(e => {
      reject(`error decoding invoice: ${JSON.stringify(e)}`)
    })
  })
}

export function payInvoice(invoice: string): Promise<void> {
  return new Promise((resolve, reject) => {
    log('WALT', 'paying invoice')
    fetch(`${process.env.WALLET_URL}/api/v1/payments?api-key=${process.env.WALLET_SECRET_KEY}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        out: true,
        bolt11: invoice,
      }),
    }).then(response => {
      if (response.ok) {
        response.json().then(json => {
          log('DBUG', `response: ${JSON.stringify(json)}`)
          resolve()
        }).catch(e => {
          reject(`error paying invoice: ${JSON.stringify(e)}`)
        })
      } else {
        response.json().then(json => {
          log('WALT', `response: ${JSON.stringify(json)}`)
        })
        reject(`error paying invoice: ${response.status}`)
      }
    }).catch(e => {
      reject(`error paying invoice: ${JSON.stringify(e)}`)
    })
  })
}
