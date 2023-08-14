import express from 'express'
import {
  LoginUser,
  RegisterUser,
  LoginWithToken,
  sendForgotPasswordLink,
  changeUserPassword
} from 'controllers/auth.controller'

const router = express.Router()

router.route('/loginWithToken').get(LoginWithToken)
router.route('/register').post(RegisterUser)
router.route('/login').post(LoginUser)
router.route('/send-resetpassword-link').post(sendForgotPasswordLink)
router.route('/change-user-password').put(changeUserPassword)

export default router
