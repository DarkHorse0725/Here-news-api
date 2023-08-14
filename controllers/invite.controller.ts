import { Request } from 'express'
import { Invite, Notification, User } from 'models'
import { DecodedRequest, IResponse } from 'Types'
import { statusCodes } from 'constants/statusCodes'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { sendNotification } from 'lib/notifications'
import { v4 as uuidv4 } from 'uuid'
import { hashUUIDTo8Chars } from 'lib/dbMigrations'
import { SendEmail } from '../sendEmail'

dotenv.config()

export const SendInvite = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  const { balance } = req.body
  const useremail = req.body.useremail.toLowerCase()
  try {
    const inviter = await User.findOne({ _id: req?.auth?.id })
    if (!inviter) {
      return res.sendResponse(
        null,
        { message: 'Inviter not found!' },
        statusCodes.NOT_FOUND
      )
    }

    // If the user has no invites quota, add the quota according to his reputation.
    if (
      !inviter.invites ||
      inviter.invites.allowedLimit === undefined
    ) {
      inviter.invites = {
        // eslint-disable-next-line no-restricted-properties
        allowedLimit: Math.pow(10, inviter.reputation - 1),
        invited: 0
      }
      await inviter.save()
    }

    // If the user already has invites quota, uupdate the quota according to his reputation and invited users.
    if (
      inviter.invites.allowedLimit ||
      inviter.invites.allowedLimit !== undefined
    ) {
      inviter.invites = {
        allowedLimit:
          // eslint-disable-next-line no-restricted-properties
          Math.pow(10, inviter.reputation - 1) -
          inviter.invites.invited,
        invited: inviter.invites.invited
      }
      await inviter.save()
    }

    if (inviter.invites.allowedLimit === 0) {
      return res.sendResponse(
        null,
        { message: 'Invite limit exceeds!' },
        statusCodes.BAD_REQUEST
      )
    }

    const findUser = await User.findOne({ username: useremail })
    if (findUser) {
      return res.sendResponse(
        null,
        { message: 'User already exists!' },
        statusCodes.BAD_REQUEST
      )
    }

    const findInviter = await Invite.findOne({ useremail })
    if (findInviter) {
      return res.sendResponse(
        null,
        { message: 'This person is already invited!' },
        statusCodes.BAD_REQUEST
      )
    }

    if (inviter.balance < balance) {
      return res.sendResponse(
        null,
        { message: 'Not enough balance to gift!' },
        statusCodes.BAD_REQUEST
      )
    }

    const tokenData = { email: useremail }
    const token = jwt.sign(tokenData, process.env.JWT_SECRET || '', {
      expiresIn: '30d'
    })
    const userId = uuidv4()
    const userIdHash = hashUUIDTo8Chars(userId)

    const emailSend = await SendEmail(
      useremail,
      inviter.displayName ? inviter.displayName : inviter.username,
      '',
      token,
      'registerInvitation',
      balance,
      userId,
      userIdHash
    )

    const usersArray = []
    const invites = new Invite({
      useremail,
      status: 'pending',
      accepted: false,
      verified: false,
      inviteBy: req?.auth?.id,
      token,
      acceptedAt: null,
      createdAt: new Date()
    })

    await invites.save()
    usersArray.push(invites)

    inviter.invites.invited = inviter.invites.invited + 1
    inviter.invites.allowedLimit = inviter.invites.allowedLimit - 1
    inviter.balance = inviter.balance - balance
    await inviter.save()

    if (!emailSend) {
      await invites.remove()
    }
    const notificationData = {
      status: 'unread',
      text: 'Great! You have invited a new person',
      user: req?.auth?.id,
      type: 'invite',
      createdAt: new Date()
    }
    await Notification.create(notificationData)

    // Send the notification to the user
    await sendNotification(req?.auth?.id.toString())

    res.sendResponse(usersArray, null, statusCodes.OK)
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

export const CheckInvite = async (
  req: Request,
  res: IResponse
): Promise<void> => {
  try {
    const { useremail, inviteToken } = req.body
    const findUser = await Invite.find({ useremail })
    if (findUser && findUser.length > 0) {
      if (findUser[0].token !== inviteToken) {
        return res.sendResponse(
          null,
          { message: 'Un authorized or token not found' },
          statusCodes.BAD_REQUEST
        )
      }
    } else {
      return res.sendResponse(
        null,
        { message: 'Invite not found' },
        statusCodes.BAD_REQUEST
      )
    }
    const secret: any = process.env.JWT_SECRET
    const decoded: any = jwt.verify(inviteToken, secret)
    if (!decoded) {
      return res.sendResponse(
        null,
        { message: 'Token expired' },
        statusCodes.BAD_REQUEST
      )
    }
    res.sendResponse(
      { message: 'Successfully accepted' },
      null,
      statusCodes.OK
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}
