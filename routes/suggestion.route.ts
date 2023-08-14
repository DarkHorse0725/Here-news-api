import { getSuggestion } from 'controllers/suggestion.controller'
import express from 'express'

const router = express.Router()

router.route('/suggestion').post(getSuggestion)

export default router
