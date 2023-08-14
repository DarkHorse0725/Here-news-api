import { Request } from 'express'
// import { generateUsername } from 'unique-username-generator'
import { User, Invite } from 'models'
import { DecodedRequest, IResponse } from 'Types'
import { statusCodes } from 'constants/statusCodes'
import { generateAvatar } from 'lib/generateAvatar'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { SendEmail } from '../sendEmail'
import mongoose from 'mongoose'

dotenv.config()

export const RegisterUser = async (
  req: Request,
  res: IResponse
): Promise<void> => {
  try {
    const { displayName, password, balance, userId, userIdHash } =
      req.body
    const useremail = req.body.useremail.toLowerCase()
    const username = req.body.username.toLowerCase()

    const findUser = await User.findOne({ username })
    if (findUser) {
      return res.sendResponse(
        null,
        { message: 'User already exists!' },
        statusCodes.BAD_REQUEST
      )
    }
    const findInvite = await Invite.findOneAndUpdate(
      { useremail },
      {
        status: 'registered',
        accepted: true,
        acceptedAt: new Date().toISOString(),
        token: ''
      }
    )
    if (!findInvite) {
      return res.sendResponse(
        null,
        { message: 'Invitation not available!' },
        statusCodes.NOT_FOUND
      )
    }

    const parentAvatar = await generateAvatar(username, true)
    const newUser = new User({
      userId,
      userIdHash,
      useremail: useremail.toLowerCase(),
      username: username.toLowerCase(),
      password,
      displayName,
      reputation: 2,
      balance,
      avatar: `https://storage.googleapis.com/${process.env.GCLOUD_STORAGE_BUCKET}/${parentAvatar.imagePath}`,
      verified: false,
      invites: { allowedLimit: Math.pow(10, 2 - 1), invited: 0 }, // 2 is the default reputation here
      createdAt: new Date()
    })

    await newUser.save()
    const tokenData = { id: newUser._id }
    const token = jwt.sign(tokenData, process.env.JWT_SECRET || '', {
      expiresIn: '30d'
    })

    res.sendResponse({ newUser, token }, null, statusCodes.OK)

    // error has to be set to any so ignoring
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

export const LoginUser = async (
  req: Request,
  res: IResponse
): Promise<void> => {
  const { password } = req.body
  const username = req.body.username.toLowerCase()

  try {
    const user = await User.findOne({ username }).select(
      'password _id'
    )
    if (!user) {
      return res.sendResponse(
        null,
        { message: 'Invalid Credentials' },
        statusCodes.UNAUTHORIZED
      )
    }
    if (user && user?.disabled) {
      return res.sendResponse(
        null,
        {
          message:
            'Your account has been disbaled. Please contact admin.'
        },
        statusCodes.FORBIDDEN
      )
    }
    user.comparePassword(password, async function (err, isMatch) {
      if (err) {
        return res.sendResponse(
          null,
          {
            message: 'Invalid Credentials'
          },
          statusCodes.INTERNAL_SERVER_ERROR
        )
      }
      if (isMatch) {
        // create a token
        const tokenData = { id: user._id }
        const token = jwt.sign(
          tokenData,
          process.env.JWT_SECRET || '',
          {
            expiresIn: '30d'
          }
        )
        const userData = await User.findById(user._id).select(
          '-password'
        )
        res.sendResponse(
          { user: userData, token },
          null,
          statusCodes.OK
        )
      } else {
        return res.sendResponse(
          null,
          {
            message: 'Invalid Credentials'
          },
          statusCodes.UNAUTHORIZED
        )
      }
    })
    // error has to be set to any so ignoring
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const LoginWithToken = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  const userId = new mongoose.Types.ObjectId(req?.auth?.id)

  try {
    const user = await User.findById(userId).select('-password')
    // create a token
    const tokenData = { id: userId }
    const token = jwt.sign(tokenData, process.env.JWT_SECRET || '', {
      expiresIn: '30d'
    })
    res.sendResponse({ user, token }, null, statusCodes.OK)

    // error has to be set to any so ignoring
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const sendForgotPasswordLink = async (
  req: Request,
  res: IResponse
): Promise<void> => {
  const { useremail } = req.body

  try {
    const findUser = await User.findOne({ useremail }).exec()
    if (!findUser) {
      res.sendResponse(
        null,
        {
          message:
            'There is no email associated with your account. Please contact Admin for support!'
        },
        statusCodes.NOT_FOUND
      )
    } else {
      // create a token
      const tokenData = { id: findUser?._id }
      const token = jwt.sign(
        tokenData,
        process.env.JWT_SECRET || '',
        {
          expiresIn: '30d'
        }
      )
      const emailSend = await SendEmail(
        useremail,
        '',
        findUser.username,
        token,
        'forgotPassword'
      )
      if (!emailSend) {
        res.sendResponse(
          null,
          {
            message:
              'Unable to send password reset link. Please try again later!'
          },
          statusCodes.INTERNAL_SERVER_ERROR
        )
      }
      findUser.resetToken = token
      await findUser.save()
      res.sendResponse(null, null, statusCodes.OK)
    }
  } catch (error: any) {
    res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

export const changeUserPassword = async (
  req: Request,
  res: IResponse
): Promise<void> => {
  const { username, resetToken, password } = req.body

  try {
    const findUser = await User.findOne({ username }).exec()
    if (!findUser) {
      return res.sendResponse(
        null,
        { message: 'User not found!' },
        statusCodes.NOT_FOUND
      )
    }
    const secret = process.env.JWT_SECRET!
    const decoded: any = jwt.verify(resetToken, secret)
    if (!decoded) {
      return res.sendResponse(
        null,
        { message: 'Link is malformed!' },
        statusCodes.BAD_REQUEST
      )
    }

    const { exp } = decoded
    if (Date.now() >= exp * 1000) {
      return res.sendResponse(
        null,
        { message: 'Link expired!' },
        statusCodes.BAD_REQUEST
      )
    }

    if (findUser?.resetToken !== resetToken) {
      return res.sendResponse(
        null,
        { message: 'Link is malformed!' },
        statusCodes.BAD_REQUEST
      )
    }

    const saltRounds = 8
    const hashPass = await bcrypt.hash(password, saltRounds)
    if (!hashPass) {
      return res.sendResponse(
        null,
        { message: 'Something went wrong!' },
        statusCodes.INTERNAL_SERVER_ERROR
      )
    }

    if (findUser) {
      findUser.password = hashPass
      findUser.resetToken = ''
      const updatePassword = await findUser?.save()

      if (!updatePassword) {
        return res.sendResponse(
          null,
          {
            message: 'Cannot update password. Please try agin later!'
          },
          statusCodes.INTERNAL_SERVER_ERROR
        )
      }
    }

    res.sendResponse(
      { message: 'Password Updated Successfully!' },
      null,
      statusCodes.OK
    )
  } catch (error: any) {
    res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}
