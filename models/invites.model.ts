import { Schema, model } from 'mongoose'

export interface IInvites {
  useremail: string
  status: string
  accepted: boolean
  inviteBy?: string
  token?: string
  createdAt?: Date
  acceptedAt?: Date
  verified?: boolean
}

const InviteSchema = new Schema<IInvites>({
  useremail: { type: String, required: true, unique: true },
  status: { type: String },
  accepted: { type: Boolean },
  verified: { type: Boolean, default: false },
  inviteBy: { type: Schema.Types.ObjectId },
  token: { type: String },
  acceptedAt: { type: Date },
  createdAt: Date
})

const Invite = model<IInvites>('Invite', InviteSchema)

export { Invite }
