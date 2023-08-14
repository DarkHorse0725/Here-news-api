import express from 'express'
import {
  createNotification,
  getUnreadNotificationsCount,
  getUserNotifications,
  getUserNotificationsByStatus,
  markAllAsRead,
  markNotificationAsRead
} from 'controllers/notification.controller'

const router = express.Router()
router.route('/notifications').get(getUserNotifications)
router.route('/notifications').post(createNotification)
router
  .route('/notifications/getUnreadCount')
  .get(getUnreadNotificationsCount)
router.route('/notification/markAllAsRead').put(markAllAsRead)
router
  .route('/notifications/status/:status')
  .get(getUserNotificationsByStatus)
router
  .route('/notification/markAsRead/:id')
  .patch(markNotificationAsRead)

export default router
