import { Request, Response } from 'express'
import { IUser } from 'models'

export interface DecodedToken {
  id: string
  iat: number
  exp: number
}

export interface DecodedRequest extends Request {
  auth?: DecodedToken
}
export interface IVerifyRequest extends Request {
  user?: IUser
}
export interface IResponse extends Response {
  sendResponse(data: any, error: any, status: number): void
}
