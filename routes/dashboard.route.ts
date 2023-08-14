import {
  getDashboardStats,
  jwtToken,
  login
} from 'controllers/dashboard.controller'
import express from 'express'

const router = express.Router()

router.route('/dashboard/stats').get(getDashboardStats)
router.route('/dashboard/jwt').get(jwtToken)
router.route('/dashboard/login').post(login)

export default router