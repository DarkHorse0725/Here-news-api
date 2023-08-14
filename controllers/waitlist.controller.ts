import { Request } from 'express'
import { Waitlist } from 'models'
import { IResponse } from 'Types'
import { statusCodes } from 'constants/statusCodes'

export const addToWaitlist: (
  req: Request,
  res: IResponse
) => void = async (req: Request, res: IResponse) => {
  const { email } = req.body

  const findEmail = await Waitlist.findOne({
    email
  })
  if (findEmail)
    return res.sendResponse(
      null,
      { message: 'Email already exists!' },
      statusCodes.CONFLICT
    )

  const newWaitlist = new Waitlist({
    email,
    createdAt: new Date()
  })
  await newWaitlist.save()
  return res.sendResponse(
    {
      message: 'Successfully added to waitlist'
    },
    null,
    statusCodes.OK
  )
}
