import { DecodedRequest, IResponse } from 'Types'
import { statusCodes } from 'constants/statusCodes'
import { Notification } from 'models'
import mongoose from 'mongoose'

export const createNotification = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const { post, text, type } = req.body
    const notificationData = {
      post,
      text,
      type,
      status: 'unread',
      user: req?.auth?.id
    }

    const notification = new Notification(notificationData)
    await notification.save()

    res.sendResponse(
      'Notification created successfully!',
      null,
      statusCodes.CREATED
    )
  } catch (err: any) {
    return res.sendResponse(
      null,
      { message: err?.message || 'Something went wrong!' },
      statusCodes.BAD_REQUEST
    )
  }
}

export const markNotificationAsRead = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const { id } = req.params
    const notification = await Notification.findByIdAndUpdate(
      id,
      { status: 'read' },
      { new: true }
    )

    res.sendResponse(notification, null, statusCodes.OK)
  } catch (err: any) {
    return res.sendResponse(
      null,
      { message: err?.message || 'Something went wrong!' },
      statusCodes.BAD_REQUEST
    )
  }
}

export const markAllAsRead = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const notifications = await Notification.updateMany(
      {
        user: new mongoose.Types.ObjectId(req?.auth?.id),
        status: 'unread'
      },
      { status: 'read' },
      { new: true }
    )

    res.sendResponse(notifications, null, statusCodes.OK)
  } catch (err: any) {
    return res.sendResponse(
      null,
      { message: err?.message || 'Something went wrong!' },
      statusCodes.BAD_REQUEST
    )
  }
}

export const getUserNotifications = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const page = req?.query?.page ? Number(req?.query?.page) : 1
    const limit = req?.query?.limit ? Number(req?.query?.limit) : 30

    const notifications = await Notification.find({
      user: req?.auth?.id
    })
      .sort({ createdAt: -1, status: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'metadata.preview', model: 'Preview' })
    res.sendResponse(notifications, null, statusCodes.OK)
  } catch (err: any) {
    return res.sendResponse(
      null,
      { message: err?.message || 'Something went wrong!' },
      statusCodes.BAD_REQUEST
    )
  }
}

export const getUnreadNotificationsCount = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const notificationCount = await Notification.countDocuments({
      user: req?.auth?.id,
      status: 'unread'
    })
    res.sendResponse(notificationCount, null, statusCodes.OK)
  } catch (err: any) {
    return res.sendResponse(
      null,
      { message: err?.message || 'Something went wrong!' },
      statusCodes.BAD_REQUEST
    )
  }
}

export const getUserNotificationsByStatus = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const { status } = req.params
    const page = req?.query?.page ? Number(req?.query?.page) : 1
    const limit = req?.query?.limit ? Number(req?.query?.limit) : 30

    const notifications = await Notification.find({
      user: req?.auth?.id,
      status
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'metadata.preview', model: 'Preview' })

    res.sendResponse(notifications, null, statusCodes.OK)
  } catch (err: any) {
    return res.sendResponse(
      null,
      { message: err?.message || 'Something went wrong!' },
      statusCodes.BAD_REQUEST
    )
  }
}
