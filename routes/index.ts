import { Router } from 'express'
import authRoutes from './auth.route'
import commentRoutes from './comment.route'
import postRoutes from './post.route'
import suggestionRoutes from './suggestion.route'
import waitlistRoutes from './waitlist.route'
import inviteRoutes from './invite.route'
import notificationRoutes from './notification.route'
import userRoutes from './user.route'
import invoiceRoutes from './invoice.route'
import settingRoutes from './setting.route'
import dashbaordRoutes from './dashboard.route'

export default ([] as Router[]).concat(
  authRoutes,
  postRoutes,
  commentRoutes,
  suggestionRoutes,
  waitlistRoutes,
  inviteRoutes,
  notificationRoutes,
  userRoutes,
  invoiceRoutes,
  settingRoutes,
  dashbaordRoutes
)
