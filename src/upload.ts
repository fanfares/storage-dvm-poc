import { log, humanReadableAge } from './util/string'
import { getPublicKey } from './util/coracle/misc'
import { createEvent } from '@welshman/util'
import { signer } from './util/signer'
import fs from 'fs'
import path from 'path'
import { createReadableStreamFromReadable } from '@remix-run/node'

// id precisions for logging
const WAL_PREC = +(process.env.WAL_PREC || 2)
const USER_PREC = +(process.env.USER_PREC || 3)
const EVENT_PREC = +(process.env.EVENT_PREC || 4)

export function performUpload(filename: string, size: number, hash: string) {
  return new Promise((resolve, reject) => {
    log('UPLD', `uploading ${filename}`)
    const uploadAuth = signer.signAsUser(signer.prepAsUser(createEvent(
      22242,
      {
        content: 'Authorize Upload',
        tags: [
          [ 'name', path.basename(filename) ],
          [ 'size', ''+size ],
          [ 'label', '' ],
        ]
      }
    )))
    fs.open(filename, (err, fd) => {
      if (err) {
        reject(`upload failed: ${err}`)
      } else {
        const s = fs.createReadStream('', {fd: fd})
        const startTime = Math.floor(new Date().valueOf() / 1000)
        fetch(`${process.env.STORAGE_URL}/v1/media/item?auth=${encodeURIComponent(JSON.stringify(uploadAuth))}`, {
          method: 'PUT',
          body: createReadableStreamFromReadable(s),
          duplex: 'half',
        }).then(response => {
          if (response.ok) {
            const contentType = response.headers.get("content-type").split(';')[0]
            if (contentType != 'application/json') log('WARN', `content type is: ${contentType}`)
            response.json().then(json => {
              if (json.sha256 == hash && json.size == size) {
                log('UPLD', `${hash} (${size} bytes) uploaded in ${humanReadableAge(startTime)}`)
                resolve(hash)
              } else {
                log('DBUG', JSON.stringify(json))
                reject('upload attempted, but the response was different than expected')
              }
            }).catch(e => {
              reject(`bad upload response: ${JSON.stringify(e)}`)
            })
          } else {
            reject(`upload failed: ${JSON.stringify(response.status)} ${process.env.STORAGE_URL}`)
          }
        }).catch(e => {
          reject(`upload fetch failed: ${e}`)
        })
      }
    })
  })
}
