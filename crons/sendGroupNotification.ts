import cron from 'node-cron'
import { sendNotification } from 'lib/notifications'
import { NotificationGroup, Notification, Post } from 'models'

cron.schedule('*/10 * * * *', async () => {
  try {
    // eslint-disable-next-line no-console
    console.log('[CRON]: Calculating post notifications')

    const notificationGroups = await NotificationGroup.find({
      count: { $gt: 0 }
    })

    // Process each notification group
    await Promise.all(
      notificationGroups.map(async group => {
        const { user, post, count, type } = group
        const postExists = await Post.findById(post).select(
          '_id title text preview'
        )
        if (postExists) {
          // Generate the notification message with the count
          const message = `${count} ${type} on your post.`

          // Save the notification to the database
          const notificationData = {
            status: 'unread',
            text: message,
            post,
            user,
            type,
            metadata: {
              count,
              title: postExists.title,
              text: postExists.text,
              preview: postExists.preview
            },
            createdAt: new Date()
          }
          await Notification.create(notificationData)

          // Send the notification to the user
          await sendNotification(user?.toString())

          // Reset the count to zero
          await NotificationGroup.findByIdAndUpdate(group._id, {
            count: 0
          })
        }
      })
    )
  } catch (error) {
    console.error('Error sending notifications:', error)
  }
})
