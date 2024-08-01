import { log } from './util/string'
import { needStorage, requestStorage, getStorageInvoice } from './storage'
import { approveStorageOffer } from './policy'
import { checkInvoice, payInvoice } from './wallets/index'

export function initMaintenance(): Promise<void> {
  return checkMaintenance(0)
}

export function checkMaintenance(outstandingBytes: number): Promise<void> {
  return new Promise((resolve, reject) => {
    needStorage().then(reason => {
      log('MANT', `${reason}: storage needed`)
      requestStorage().then(offerDetails => {
        // log('DBUG', `storage offer: ${JSON.stringify(offerDetails)}`)
        approveStorageOffer(offerDetails.satCost).then(reason => {
          // log('DBUG', `policy applied: ${reason}`)
          return getStorageInvoice(offerDetails.satCost, offerDetails.relays, offerDetails.description, offerDetails.offerId, offerDetails.payUrl)
        }).then(({ invoice, check }) => {
          checkInvoice(invoice, offerDetails.satCost).then(() => {
            return payInvoice(invoice)
          }).catch(reason => reject(reason))
        }).catch(reason => reject(reason))
      }).catch(reason => reject(reason))
    }).catch(reason => resolve(reason))
  })
}
