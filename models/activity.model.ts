import { Schema, model } from 'mongoose'

export interface ActivityInterface {
  user: {
    type: Schema.Types.ObjectId
    ref: 'Users'
  }
  type: 'config' | 'settings' | 'other'
  description: string
  ip?: string
  metadata?: any
  createdAt?: Date
}

const ActivitySchema = new Schema<ActivityInterface>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Users'
  },
  type: String,
  description: String,
  ip: String,
  createdAt: { type: Date, default: new Date() },
  metadata: {
    type: Schema.Types.Mixed
  }
})

const Activity = model<ActivityInterface>('Activity', ActivitySchema)

export { Activity }