import express from 'express'
import {
  createSetting,
  getSetting,
  updateSetting
} from 'controllers/setting.controller'

const router = express.Router()

router.route('/setting').get(getSetting)
router.route('/setting').post(createSetting)
router.route('/setting/:id').put(updateSetting)

export default router