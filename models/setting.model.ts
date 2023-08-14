import { Schema, model } from 'mongoose'

export interface SettingInterface {
  hiddenPostThreshold?: number
  tipsThreshold?: number // maximum tips a user can give to a post
  newsCardReputationThreshold?: number
  defaultReputation?: number // reputation of newly registered users
  indexablePostMinReputation?: number
  indexablePostMinNetVotes?: number
  verifyUserReputationThreshold?: number // Verify users total reputation of users who did verification
  postReputationTime?: number // minutes after post reputation is calculated
  sendNotificationTime?: number // minutes after notifcations are sent
  giftTokensForNewUser?: number // number of tokens given as a gift when inviting new users
  createdAt?: Date
}

const SettingSchema = new Schema<SettingInterface>({
  hiddenPostThreshold: {
    type: Number,
    default: -3
  },
  tipsThreshold: {
    type: Number,
    default: 5
  },
  newsCardReputationThreshold: {
    type: Number,
    default: 1
  },
  defaultReputation: {
    type: Number,
    default: 1
  },
  indexablePostMinReputation: Number,
  indexablePostMinNetVotes: Number,
  verifyUserReputationThreshold: {
    type: Number,
    default: 6
  },
  postReputationTime: {
    type: Number,
    default: 10
  },
  sendNotificationTime: {
    type: Number,
    default: 10
  },
  giftTokensForNewUser: {
    type: Number,
    default: 100
  },
  createdAt: { type: Date, default: new Date() }
})

const Setting = model<SettingInterface>('Setting', SettingSchema)

export { Setting }