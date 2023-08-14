import express from 'express'
import {
  SendInvite,
  CheckInvite
} from 'controllers/invite.controller'

const router = express.Router()
router.route('/send-invites').post(SendInvite)
router.route('/invite-check').post(CheckInvite)

export default router
