import { Activity, Setting, User } from 'models'
import { DecodedRequest, IResponse } from 'Types'
import { statusCodes } from 'constants/statusCodes'
import mongoose from 'mongoose'

// GET: get latest settings
export const getSetting = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const setting = await Setting.findOne({})
    if (!setting) {
      return res.sendResponse(
        null,
        'Settings not found!',
        statusCodes.NOT_FOUND
      )
    }

    return res.sendResponse(setting, null, statusCodes.OK)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return res.sendResponse(
      null,
      { message: err.message || 'Something went wrong!' },
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

// POST: create setting
export const createSetting = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const data = { ...req.body, createdAt: new Date() }
    const setting = new Setting(data)
    await setting.save()

    return res.sendResponse(setting, null, statusCodes.OK)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return res.sendResponse(
      null,
      { message: err.message || 'Something went wrong!' },
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

// PUT: update setting
export const updateSetting = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const id = new mongoose.Types.ObjectId(req?.params?.id)
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)

    const user = await User.findById(userId).select('_id useremail')
    if (!user) {
      return res.sendResponse(
        null,
        'User not found!',
        statusCodes.NOT_FOUND
      )
    }

    const setting: any = await Setting.findById(id)
    if (!setting) {
      return res.sendResponse(
        null,
        'Settings not found!',
        statusCodes.NOT_FOUND
      )
    }
    const updatedSetting: any = await Setting.findByIdAndUpdate(
      id,
      { ...req.body },
      { new: true }
    )

    // Compare to check the updated fields, required for activity metadata
    const oldSettings: any = {}
    const newSettings: any = {}

    Object.keys(updatedSetting?._doc).forEach(key => {
      if (
        setting[key] !== updatedSetting[key] &&
        !['createdAt', '_id'].includes(key)
      ) {
        newSettings[key] = updatedSetting[key]
        oldSettings[key] = setting[key]
      }
    })

    const activityData = {
      user: userId,
      type: 'config',
      description: `${user?.useremail} with IP ${req.ip} updated configurations.`,
      ip: req.ip,
      metadata: {
        oldSettings,
        newSettings
      },
      createdAt: new Date()
    }

    const activity = new Activity(activityData)
    await activity.save()

    return res.sendResponse(updatedSetting, null, statusCodes.OK)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return res.sendResponse(
      null,
      { message: err.message || 'Something went wrong!' },
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}