import { Notification, User } from 'models'
import { socketIoObject } from '../index'

export const sendNotification = async (
  room: string | any
): Promise<any> => {
  try {
    const notifications = await Notification.countDocuments({
      user: room,
      status: 'unread'
    })
    const user = await User.findByIdAndUpdate(
      room,
      {
        hasNewNotifications: true
      },
      { new: true }
    ).select('-password')
    socketIoObject.sockets
      .in(room)
      .emit('notification', { notifications, user })
  } catch (err) {
    console.log('Error => ', err)
  }
}
