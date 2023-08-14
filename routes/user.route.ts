import {
  getCurrentUser,
  getInvitedUsers,
  getPublicProfile,
  getUserPosts,
  getUserSpendingsAndIncome,
  getUserStats,
  getUserVotedPosts,
  markPostAsIntroductoryPost,
  notificationUpdate,
  setLanguagesPreference,
  updateProfile,
  verifyUser
} from 'controllers/user.controller'
import express from 'express'

const router = express.Router()

router.route('/getCurrentUser').get(getCurrentUser)
router.route('/getProfileStats').get(getUserStats)
router.route('/getUserVotedPosts').get(getUserVotedPosts)
router.route('/getInvitedUsers').get(getInvitedUsers)
router
  .route('/getUserSpendingsAndIncome')
  .get(getUserSpendingsAndIncome)
router.route('/getPublicProfile/:id').get(getPublicProfile)
router.route('/getPublicPosts/:id').get(getUserPosts)
router.route('/updateProfile').put(updateProfile)
router.route('/verifyUser').put(verifyUser)
router.route('/introductoryPost').put(markPostAsIntroductoryPost)
router.route('/languages').put(setLanguagesPreference)
router.route('/hasNewNotifications').patch(notificationUpdate)

export default router
