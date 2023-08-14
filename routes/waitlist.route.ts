import express from 'express'
import { addToWaitlist } from 'controllers/waitlist.controller'

const router = express.Router()

router.route('/addToWaitlist').post(addToWaitlist)

export default router
