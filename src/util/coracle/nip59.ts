import type {UnsignedEvent} from "nostr-tools"
import {WRAP} from '@welshman/util'
import {getPublicKey, tryJson} from "./misc"
import logger from "./logger"
import type {Session} from "./misc"
import type {Signer} from "./signer"
import type {Nip44} from "./nip44"

export const now = (drift = 0) =>
  Math.round(Date.now() / 1000 - Math.random() * Math.pow(10, drift))

export const seal = (content, pubkey) => ({
  kind: 13,
  created_at: now(5),
  tags: [],
  content,
  pubkey,
})

export const wrap = (content, pubkey, recipient, kind = WRAP, tags: string[][] = []) => ({
  kind,
  created_at: now(5),
  tags: tags.concat([["p", recipient]]),
  content,
  pubkey,
})

export type WrapperParams = {
  author?: string
  wrap?: {
    author: string
    recipient: string
    kind?: 1059 | 1060
    algo?: "nip04" | "nip44"
    tags?: string[][]
  }
}

const seen = new Map()

export class Nip59 {
  constructor(
    readonly session: Session,
    readonly nip44: Nip44,
    readonly signer: Signer,
  ) {}

  getAuthorPubkey(sk?: string) {
    return sk ? getPublicKey(sk) : this.session.pubkey
  }

  prep(event: UnsignedEvent, sk?: string) {
    return sk ? this.signer.prepWithKey(event, sk) : this.signer.prepAsUser(event)
  }

  sign(event: UnsignedEvent, sk?: string) {
    return sk ? this.signer.signWithKey(event, sk) : this.signer.signAsUser(event)
  }

  async encrypt(event, pk: string, sk?: string, algo = "nip44") {
    const message = JSON.stringify(event)

    let payload

    if (sk) {
      payload = this.nip44.encrypt(message, pk, sk)
    } else {
      payload = this.nip44.encryptAsUser(message, pk)
    }

    return payload
  }

  async decrypt(event, sk?: string) {
    const {pubkey, content} = event

    let message

    if (sk) {
      if (!message && this.nip44.isEnabled()) {
        message = await this.nip44.decrypt(content, pubkey, sk)
      }
    } else {
      if (!message && this.nip44.isEnabled()) {
        message = await this.nip44.decryptAsUser(content, pubkey)
      }
    }

    return tryJson(() => JSON.parse(message))
  }

  async getSeal(rumor, {author, wrap: data}: WrapperParams) {
    if (!data) { logger.error('unexpected: undefined wrap'); return }
    const {recipient, algo} = data
    const content = await this.encrypt(rumor, recipient, author, algo)
    const rawEvent = seal(content, rumor.pubkey)
    const signedEvent = this.sign(rawEvent, author)

    return signedEvent
  }

  async getWrap(seal, {wrap: data}: WrapperParams) {
    if (!data) { logger.error('unexpected: undefined wrap'); return }
    const {author, recipient, algo, kind, tags = []} = data
    const content = await this.encrypt(seal, recipient, author, algo)
    const rawEvent = wrap(content, this.getAuthorPubkey(author), recipient, kind, tags)
    const signedEvent = this.sign(rawEvent, author)

    return signedEvent
  }

  async wrap(event, params: WrapperParams) {
    const rumor = this.prep(event, params.author)
    const seal = await this.getSeal(rumor, params)
    const wrap = await this.getWrap(seal, params)

    if (!rumor) { logger.error('unexpected: undefined rumor'); return }
    return Object.assign(rumor, {wrap})
  }

  async unwrap(wrap, sk) {
    // Avoid decrypting the same event multiple times
    if (seen.has(wrap.id)) {
      return seen.get(wrap.id)
    }

    try {
      const seal = await this.decrypt(wrap, sk)
      console.log('DBUG', 'seal ' + JSON.stringify(seal))

      if (!seal) throw new Error("Failed to decrypt wrapper")

      const rumor = await this.decrypt(seal, sk)

      if (!rumor) throw new Error("Failed to decrypt seal")

      if (seal.pubkey === rumor.pubkey) {
        Object.assign(rumor, {wrap})
        seen.set(wrap.id, rumor)

        return rumor
      }
    } catch (e) {
      if (!e.toString().match(/version 1|Invalid nip44|Malformed/)) {
        logger.warn(e)
      }
    }
  }
}
