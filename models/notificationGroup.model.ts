import { Schema, model } from 'mongoose'

export interface INotificationGroup {
  type?: 'comment' | 'upvote' | 'downvote' | 'tip'
  post?: string
  user?: string
  count?: number
  createdAt?: Date
}

const NotificationGroupSchema = new Schema<INotificationGroup>({
  type: { type: String },
  post: { type: Schema.Types.ObjectId },
  user: { type: Schema.Types.ObjectId },
  count: { type: Number, default: 0 },
  createdAt: { type: Date, default: new Date() }
})

const NotificationGroup = model<INotificationGroup>(
  'NotificationGroup',
  NotificationGroupSchema
)

export { NotificationGroup }
