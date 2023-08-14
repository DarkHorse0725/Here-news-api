import helmet from 'helmet'
import express, { NextFunction, Request, Response } from 'express'
import { expressjwt, UnauthorizedError } from 'express-jwt'
import cors from 'cors'
import morgan from 'morgan'
import { customResponse } from 'middlewares/customResponse'
import { statusCodes } from 'constants/statusCodes'
import { ExpressExtends } from 'Types/interfaces'

interface CustomError extends UnauthorizedError {
  code: string
}

const unprotectedPaths = [
  /^\/_ah\/.*$/,
  '/',
  '/favicon.ico',
  /^\/api\/login\/?$/,
  /^\/api\/dashboard\/login\/?$/,
  /^\/api\/register\/?$/,
  /^\/api\/getExplorePosts\/?$/,
  /^\/api\/getSearchPosts\/?$/,
  /^\/api\/getTrendingPosts\/?$/,
  /^\/api\/getPostID\/.*\/?$/,
  /^\/api\/getSinglePost\/.*\/?$/,
  /^\/api\/getLinkDetails\/.*\/?$/,
  /^\/api\/getPostReplies\/.*\/?$/,
  /^\/api\/getExploreTopics\/?$/,
  /^\/api\/getPopularTopics\/?$/,
  /^\/api\/getAllTopics\/?$/,
  /^\/api\/getAllPostsByTopic\/?$/,
  /^\/api\/translatePost\/.*\/?$/,
  /^\/api\/addToWaitlist\/?$/,
  /^\/api\/invite-check\/?$/,
  /^\/api\/send-resetpassword-link\/?$/,
  /^\/api\/change-user-password\/?$/,
  /^\/api\/getPublicProfile\/.*\/?$/,
  /^\/api\/getPublicPosts\/.*\/?$/
]

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://here.news',
  'https://staging-dot-phonic-jetty-356702.uc.r.appspot.com',
  'https://admin-staging-dot-phonic-jetty-356702.uc.r.appspot.com',
  'http://localhost:4000',
  'https://api.here.news',
  'https://staging-server-dot-phonic-jetty-356702.uc.r.appspot.com'
]

export default (app: ExpressExtends): void | Response => {
  try {
    app.use(
      expressjwt({
        secret: process.env.JWT_SECRET || '',
        algorithms: ['HS256']
      }).unless({
        // we have no JWT in login/signup etc. routes
        // so we tell app not to try auth with JWT
        path: unprotectedPaths
      })
    )
    app.use(function (
      err: CustomError,
      req: Request,
      res: Response,
      next: NextFunction
    ) {
      if (err && err.name === 'UnauthorizedError') {
        res
          .status(statusCodes.FORBIDDEN)
          .json({ error: 'Unauthorized', status: err.code })
      } else {
        next()
      }
    })

    app.use(express.json({ limit: '50mb' }))
    app.use(express.urlencoded({ extended: true, limit: '50mb' }))
    app.use(customResponse)
    app.use(helmet()) // for some out of the box security
    app.use(morgan('dev'))
    app.use(
      cors({
        origin: ALLOWED_ORIGINS
      })
    )
  } catch (e) {
    console.log('Middleware error: ', e)
  }
}
