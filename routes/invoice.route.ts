import {
  checkInvoiceExpiration,
  checkInvoiceStatus,
  createInvoice,
  getInvoiceById,
  getInvoices,
  getPaidInvoices,
  updateInvoiceStatus
} from 'controllers/invoice.controller'
import express from 'express'

const router = express.Router()

router.route('/invoices').get(getInvoices)
router.route('/invoice/paid').get(getPaidInvoices)
router.route('/invoice/:id').get(getInvoiceById)
router.route('/invoice/:id/status').get(checkInvoiceStatus)
router.route('/invoice/:id/expire').get(checkInvoiceExpiration)
router.route('/invoice').post(createInvoice)
router.route('/invoice/:id/status').patch(updateInvoiceStatus)

export default router
