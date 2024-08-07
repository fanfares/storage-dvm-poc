import {memoize} from "./misc"
import {Nip44} from "./nip44"
import {Nip59} from "./nip59"
import {Signer} from "./signer"
import {Connect} from "./connect"

export * from "./nip44"
export * from "./nip59"
export * from "./signer"
export * from "./connect"
//export * from "./events"

export const getConnect = memoize(session => new Connect(session))

export const getSigner = memoize(session => new Signer(session, getConnect(session)))

export const getNip44 = memoize(session => new Nip44(session, getConnect(session)))

export const getNip59 = memoize(
  session => new Nip59(session, getNip44(session), getSigner(session)),
)
