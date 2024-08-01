import { log } from './util/string'
import fs from 'fs'
import { getHash } from './util/file'

const incomingDir = process.env.INCOMING_DIR||'incoming'
const seen = []

export function watchForUploads(handler: (filename: string, hash: string, size: number) => Promise<void>) {
  let readyForNext = true
  setInterval(() => {
    try {
      fs.readdirSync(incomingDir).forEach(file => {
        const pathToFile = `${incomingDir}/${file}`
        if (readyForNext && !seen.includes(pathToFile)) {
          seen.push(pathToFile)
          var stats = fs.statSync(pathToFile)
          var fileSizeInBytes = stats.size
          if (fileSizeInBytes > 0) {
            readyForNext = false // relax while awaiting completion of async logic, to serialize uploads
            getHash(pathToFile).then(hash => {
              handler(pathToFile, hash, fileSizeInBytes).then(() => {
                readyForNext = true
              }).catch(e => {
                readyForNext = true
                log('WATC', `handler failed: ${JSON.stringify(e)}`)
              })
            })
          }
        }
      })
    } catch(e) {
      log('EROR', `${e}`)
    }
  }, 1000)
}

