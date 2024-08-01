import { log } from './util/string'

const STORAGE_MAX_MONTHLY_SATSPEND = +(process.env.STORAGE_MAX_MONTHLY_SATSPEND || 0)
const spends = []

const MS_PER_DAY = 1000 * 60 * 60 * 24
const MS_PER_MONTH = 30 * MS_PER_DAY

export function approveStorageOffer(satCost: number): Promise<string> {
  return new Promise((resolve, reject) => {
    log('STOR', 'checking storage offer')
    const sats = satCost
    
    // Compute current spend rate
    const lastSpend = spends.length > 0? spends[spends.length-1]: { amount: 0, date: Date.now() }
    const satsPerMonth = lastSpend.amount / Math.max(1, (Date.now() - lastSpend.date) / MS_PER_MONTH)

    // Compute total monthly spend so far
    const NOW = Date.now()
    const monthlySpend = spends.reduce((prev, cur) => {
      return prev.amount + ((Math.abs(NOW - cur.date) < 30 * MS_PER_DAY)? cur.amount: 0)
    }, 0)

    log('DBUG',
      `satsPerMonth: ${satsPerMonth}, ` +
      `monthlySpend: ${monthlySpend}, ` +
      `satCost: ${satCost}, ` +
      `STORAGE_MAX_MONTHLY_SATSPEND: ${STORAGE_MAX_MONTHLY_SATSPEND}` +
      ``)
    
    // Make sure we don't go over the allowed monthly expenditure
    if (satsPerMonth + sats > STORAGE_MAX_MONTHLY_SATSPEND) {
      reject(`payment of ${Math.ceil(sats)} sats would exceed STORAGE_MAX_MONTHLY_SATSPEND of ${STORAGE_MAX_MONTHLY_SATSPEND} in terms of instantaneous rate of spend`)
    } else if (monthlySpend + sats > STORAGE_MAX_MONTHLY_SATSPEND) {
      reject(`payment of ${Math.ceil(sats)} sats would exceed STORAGE_MAX_MONTHLY_SATSPEND of ${STORAGE_MAX_MONTHLY_SATSPEND} in terms of total spend within one-month window`)
    } else {
      spends.push({ amount: sats, date: Date.now() })
      resolve('all criteria met for automatic payment')
    }  
  })
}

          

