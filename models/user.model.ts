import { Schema, model, Types } from 'mongoose'
import bcrypt from 'bcrypt'

export interface IUser {
  useremail: string
  username: string
  password: string
  displayName: string
  resetToken: string
  balance: number
  reputation: number
  parent: typeof Types.ObjectId
  avatar?: string
  invites: { allowedLimit: number; invited: number }
  verified?: boolean
  userId?: string
  userIdHash?: string
  createdAt?: Date
  introductoryPost?: typeof Types.ObjectId
  language?: string
  preferedLanguages?: string[]
  hasNewNotifications?: boolean
  verifiedBy?: {
    type: Schema.Types.ObjectId
    ref: 'User'
  }[]
  verificationReputation?: number // Sum of reputation of verifiedBy users (must be >= 6 for now)
  disabled?: boolean
}

export interface UserInterface extends IUser {
  comparePassword: (
    plaintextPassword: string,
    callback: (err: any, isMatch: boolean) => void
  ) => void
}

const UserSchema = new Schema<UserInterface>({
  useremail: { type: String, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String },
  displayName: { type: String },
  resetToken: { type: String },
  avatar: { type: String },
  reputation: { type: Number },
  balance: { type: Number },
  parent: { type: Types.ObjectId, ref: 'User' },
  invites: {
    allowedLimit: { type: Number },
    invited: { type: Number }
  },
  createdAt: Date,
  userId: { type: String },
  userIdHash: { type: String },
  verified: { type: Boolean },
  introductoryPost: { type: Types.ObjectId, ref: 'Post' },
  language: { type: String },
  preferedLanguages: { type: [String] },
  hasNewNotifications: { type: Boolean, default: false },
  verifiedBy: [{ type: Types.ObjectId, ref: 'User' }],
  verificationReputation: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false }
})

UserSchema.pre<UserInterface>('save', function (next) {
  const user: UserInterface = this
  const saltRounds = 8

  // ignore for isNew property of mongoose
  // @ts-ignore
  if (!user.password || !this.isNew) return next()

  bcrypt.hash(user.password, saltRounds, function (err, hash) {
    if (err) {
      return next(err)
    }
    user.password = hash
    next()
  })
})

// @ts-ignore
UserSchema.methods.comparePassword = function (
  plaintextPassword: string,
  callback: (err: any, isMatch: boolean) => void
) {
  bcrypt.compare(
    plaintextPassword,
    this.password,
    function (err, isMatch) {
      if (err) {
        return callback(err, isMatch)
      }
      callback(null, isMatch)
    }
  )
}

const User = model<UserInterface>('User', UserSchema)

export { User }
