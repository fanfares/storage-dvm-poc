import { log } from './util/string'
log('INIT', 'A')
import { needStorage, requestStorage, getStorageInvoice } from './storage'
log('INIT', 'B')
import { approveStorageOffer } from './policy'
log('INIT', 'C')
import { checkInvoice, payInvoice } from './wallets/index'
log('INIT', 'D')

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
