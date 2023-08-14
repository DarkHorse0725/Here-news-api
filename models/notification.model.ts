import { Schema, model } from 'mongoose'

export interface INotification {
  status: 'read' | 'unread'
  text: string
  type?:
    | 'invite'
    | 'comment'
    | 'upvote'
    | 'downvote'
    | 'wallet'
    | 'reputation'
    | 'tip'
  post?: string
  user?: string
  metadata?: any
  createdAt?: Date
}

const NotificationSchema = new Schema<INotification>({
  status: { type: String, required: true, default: 'unread' },
  text: { type: String, required: true },
  type: { type: String },
  post: { type: Schema.Types.ObjectId },
  user: { type: Schema.Types.ObjectId },
  metadata: {
    type: Schema.Types.Mixed
  },
  createdAt: { type: Date, default: new Date() }
})

const Notification = model<INotification>(
  'Notification',
  NotificationSchema
)

export { Notification }
