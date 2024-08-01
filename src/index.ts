import 'dotenv/config'
import { log } from './util/string'

log('INIT', '-- start --')

import { initMaintenance, checkMaintenance } from './maintenance'
import { performUpload } from './upload'
import { watchForUploads } from './watchForUploads'
import { SUPPORTED_WALLET_TYPES } from './wallets/index'
import fs from 'fs'

// id precisions for logging
const FILE_PREC = +(process.env.FILE_PREC || 8)

if (!process.env.DVM_NSEC_HEX) {
  log('INIT', `configuration error: no DVM_NSEC_HEX private key specified in .env or environment variable`)
} else if (!process.env.WALLET_TYPE || !SUPPORTED_WALLET_TYPES.includes(process.env.WALLET_TYPE)) {
  log('INIT', `configuration error: invalid or missing WALLET_API in .env or environment variable`)
} else if (!process.env.STORAGE_URL) {
  log('INIT', `configuration error: no STORAGE_URL exists in .env or environment variable`)
} else {
  if (!process.env.STORAGE_NPUB_HEX) {
    log('INIT', `warning: no STORAGE_NPUB_HEX exists in .env or environment variable`)
  }

  fs.mkdir(`${process.env.DB_DIR||'db'}`, { recursive: true }, (err) => { if (err) log('INIT', 'error on DB_DIR: ' + err) })
  fs.mkdir(`${process.env.INCOMING_DIR||'incoming'}`, { recursive: true }, (err) => { if (err) log('INIT', 'error on INCOMING_DIR: ' + err) })

  initMaintenance().then(() => {
    watchForUploads((filename, hash, size) => {
      return new Promise((resolve, reject) => {
        log('UPLD', `${hash.substring(0, FILE_PREC)} ${filename} (${size} bytes)`)
        checkMaintenance(size).finally(() => {
          performUpload(filename, size, hash).then(() => {
            resolve()
          }).catch(e => {
            reject(`upload error: ${e}`)
          })
        })

      })
    })
  }).catch(reason => log('INIT', `failed to start: ${reason}`))
}

log('INIT', 'main thread exit')
