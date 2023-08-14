import { User, Post } from 'models'
import { DecodedRequest, IResponse } from 'Types'
import { statusCodes } from 'constants/statusCodes'
import jwt from 'jsonwebtoken'
import { Request } from 'express'

// GET: dashboard statistics like users, posts, tips etc
export const getDashboardStats = async (
  req: Request,
  res: IResponse
): Promise<void> => {
  try {
    const days = Number(req.query.days)
    const interval = days * 24 * 60 * 60 * 1000 // Time interval for which the stats will be calculated

    let filter = {}
    const match: any = {}

    if (days > 0) {
      filter = {
        createdAt: {
          $gt: new Date(Date.now() - interval)
        }
      }
      match.createdAt = {
        $gt: new Date(Date.now() - interval)
      }
    }

    const users = await User.countDocuments(filter)
    const verifiedUsers = await User.countDocuments({
      ...filter,
      verified: true
    })
    const posts = await Post.countDocuments(filter)
    const postStats = await Post.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          upvotes: { $sum: { $size: '$upvotes' } },
          downvotes: { $sum: { $size: '$downvotes' } },
          tips: { $sum: { $size: '$tips' } }
        }
      }
    ])

    const {
      upvotes = 0,
      downvotes = 0,
      tips = 0
    } = postStats[0] || {}

    const data = {
      users,
      verifiedUsers,
      posts,
      upvotes,
      downvotes,
      tips
    }

    return res.sendResponse(data, null, statusCodes.OK)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

// POST: Login as admin
export const login = async (
  req: Request,
  res: IResponse
): Promise<void> => {
  const { password } = req.body
  const useremail = req.body.useremail.toLowerCase()

  try {
    // Hard coded admin account for now, we will add role base auth in next phase
    if (useremail !== 'admin@here.com') {
      return res.sendResponse(
        null,
        { message: 'Invalid credentials!' },
        statusCodes.UNAUTHORIZED
      )
    }
    const user = await User.findOne({ useremail })
    if (!user) {
      return res.sendResponse(
        null,
        { message: 'User not found!' },
        statusCodes.NOT_FOUND
      )
    }
    user.comparePassword(password, async function (err, isMatch) {
      if (err) {
        return res.sendResponse(
          null,
          {
            message: 'Invalid credentials'
          },
          statusCodes.BAD_REQUEST
        )
      }
      if (isMatch) {
        const userId = user.parent ? user.parent : user._id
        // create a token
        const tokenData = { id: userId }
        const token = jwt.sign(
          tokenData,
          process.env.JWT_SECRET || '',
          {
            expiresIn: '30d'
          }
        )
        return res.sendResponse({ token }, null, statusCodes.OK)
      }
      return res.sendResponse(
        null,
        {
          message: 'Invalid credentials!'
        },
        statusCodes.BAD_REQUEST
      )
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

// GET: JWT token for mongodb charts/dashboard
export const jwtToken = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const tokenData = { id: req?.auth?.id }
    const token = jwt.sign(tokenData, process.env.JWT_SECRET || '', {
      expiresIn: '20h'
    })
    return res.sendResponse({ token }, null, statusCodes.OK)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
