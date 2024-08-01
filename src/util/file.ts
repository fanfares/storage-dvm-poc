import crypto from 'crypto'
import fs from 'fs'

export function getHash(path: string) {
  return new Promise((resolve: (hash: string) => void, reject) => {
    const hash = crypto.createHash('sha256')
    const rs = fs.createReadStream(path)
    rs.on('error', reject)
    rs.on('data', chunk => hash.update(chunk))
    rs.on('end', () => resolve(hash.digest('hex')))
  })
}
