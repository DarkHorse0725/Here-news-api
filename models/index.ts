import mongoose from 'mongoose'

export * from './user.model'
export * from './post.model'
export * from './comment.model'
export * from './waitlist.model'
export * from './invites.model'
export * from './notification.model'
export * from './notificationGroup.model'
export * from './invoice.model'
export * from './setting.model'
export * from './preview.model'
export * from './activity.model'

export const connectDatabase = () => {
  const URL = process.env.MONGO_DB_URL || ''
  mongoose
    .connect(URL)
    .then(() => {
      return console.log(`DATABASE CONNECTION SUCCESSFUL !`)
    })
    .catch((error: Error) => {
      console.log('Error connecting to database: ', error.message)
      return process.exit(1)
    })
}
