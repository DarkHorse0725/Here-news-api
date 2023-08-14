import { Express } from 'express'
import { Server } from 'socket.io'

export interface ExpressExtends extends Express {
  io?: Server
}

// generate Topic interface
export interface MetaData {
  tags: string[]
  topics: string[]
  languages: string[]
  language_codes: string[]
}
