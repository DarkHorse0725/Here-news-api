import { Schema, model } from 'mongoose'

export interface WaitlistInterface {
  email: string
  createdAt?: Date
}

const WaitlistSchema = new Schema<WaitlistInterface>({
  email: String,
  createdAt: Date
})

const Waitlist = model<WaitlistInterface>('Waitlist', WaitlistSchema)

export { Waitlist }
