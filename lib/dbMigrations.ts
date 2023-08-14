import { User } from 'models'
import CryptoJS from 'crypto-js'
import { v4 as uuidv4 } from 'uuid'

export const convertDollarTOMacro = async (): Promise<void> => {
  try {
    const users = await User.updateMany({}, { balance: 100000 })
    console.log('Users => ', users.modifiedCount)
  } catch (err) {
    console.log('Error => ', err)
  }
}
export const updateUsernames = async (): Promise<void> => {
  try {
    const emailPattern =
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    const users = await User.updateMany(
      { displayName: { $regex: emailPattern } },
      [
        {
          $set: {
            displayName: {
              $arrayElemAt: [{ $split: ['$displayName', '@'] }, 0]
            }
          }
        }
      ]
    )
    console.log('User => ', users.modifiedCount)
  } catch (err) {
    console.log('Error => ', err)
  }
}

export const hashUUIDTo8Chars = (uuidString: string): string => {
  const sha256Hash = CryptoJS.SHA256(uuidString)
  const hexHash = sha256Hash.toString(CryptoJS.enc.Hex)
  const hashedCode = hexHash.substring(0, 8)
  return hashedCode
}

export const addUserIdAndHashToUser = async (): Promise<any> => {
  try {
    console.log('MIGRATION STARTED')
    const users = await User.find({})
    for (const user of users) {
      const userId = uuidv4()
      const userIdHash = hashUUIDTo8Chars(userId)

      // Update the user document with the new variables
      await User.updateOne(
        { _id: user._id },
        {
          $set: { userId, userIdHash, verified: false }
        }
      )
    }
    console.log('MIGRATION ENDED')
  } catch (err) {
    console.log('Error => ', err)
  }
}

export const disableUser = async (): Promise<any> => {
  try {
    console.log('MIGRATION STARTED')
    // const users = await User.updateMany(
    //   {
    //     useremail: {
    //       $in: [
    //         'isaac.mao@gmail.com',
    //         'saeed.neslit@gmail.com',
    //         'sallymolly518@gmail.com'
    //       ]
    //     }
    //   },
    //   { disabled: false, balance: 1000 },
    //   { new: true }
    // )
    const disableUsers = await User.updateMany(
      {
        balance: {
          $gt: 5000
        }
      },
      { disabled: true, balance: 1000 }
    )
    console.log('disableUsers => ', disableUsers.modifiedCount)
    console.log('MIGRATION ENDED')
  } catch (err) {
    console.log('Error => ', err)
  }
}
