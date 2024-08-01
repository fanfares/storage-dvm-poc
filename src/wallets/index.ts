import { checkInvoice as lnbits_checkInvoice, payInvoice as lnbits_payInvoice } from './lnbits'

export const SUPPORTED_WALLET_TYPES = ['lnbits-compatible']

export function checkInvoice(invoice: string, satAmount: number): Promise<void> {
  switch (process.env.WALLET_TYPE) {
    case 'lnbits-compatible': return lnbits_checkInvoice(invoice, satAmount)
    default: return new Promise((resolve, reject) => {
      reject(`wallet type not supported: '${process.env.WALLET_TYPE}'`)
    })
  }
}

export function payInvoice(invoice: string): Promise<void> {
  switch (process.env.WALLET_TYPE) {
    case 'lnbits-compatible': return lnbits_payInvoice(invoice)
    default: return new Promise((resolve, reject) => {
      reject(`wallet type not supported: '${process.env.WALLET_TYPE}'`)
    })
  }
}
