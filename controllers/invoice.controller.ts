import { DecodedRequest, IResponse } from 'Types'
import { statusCodes } from 'constants/statusCodes'
import { Invoice, User } from 'models'
import mongoose from 'mongoose'
import moment from 'moment'
import alby from 'alby-tools'

// GET: get invoices by user id
export const getInvoices = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const user = new mongoose.Types.ObjectId(req?.auth?.id)
    const invoice = await Invoice.find({ user })
    return res.sendResponse(invoice, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      error.message,
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
// GET: get paid invoices of user
export const getPaidInvoices = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const user = new mongoose.Types.ObjectId(req?.auth?.id)
    const invoice = await Invoice.find({ user, status: 'paid' }).sort(
      { createdAt: -1 }
    )
    return res.sendResponse(invoice, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      error.message,
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

// GET: get invoice by id
export const getInvoiceById = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const invoiceId = new mongoose.Types.ObjectId(req.params.id)
    const invoice = await Invoice.findById(invoiceId)

    if (!invoice) {
      return res.sendResponse(
        null,
        'Invoice not found!',
        statusCodes.NOT_FOUND
      )
    }

    return res.sendResponse(invoice, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      error.message,
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

// GET: check invoice status (paid or unpaid)
export const checkInvoiceStatus = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const invoiceId = new mongoose.Types.ObjectId(req.params.id)
    const existingInvoice = await Invoice.findById(invoiceId)

    if (!existingInvoice) {
      return res.sendResponse(
        null,
        'Invoice not found!',
        statusCodes.NOT_FOUND
      )
    }

    const invoice = new alby.Invoice({
      pr: existingInvoice.paymentRequest,
      verify: existingInvoice.verify
    })
    const invoiceIsPaid = await invoice.isPaid()

    return res.sendResponse({ invoiceIsPaid }, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      error.message,
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

// GET: check if invoice is expired or not
export const checkInvoiceExpiration = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const invoiceId = new mongoose.Types.ObjectId(req.params.id)
    const existingInvoice = await Invoice.findById(invoiceId).select(
      'expiredAt'
    )

    if (!existingInvoice) {
      return res.sendResponse(
        null,
        'Invoice not found!',
        statusCodes.NOT_FOUND
      )
    }

    const status = moment().isSameOrAfter(existingInvoice.expiredAt)
    return res.sendResponse(status, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      error.message,
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

// POST: create an invoice
export const createInvoice = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const { amount } = req.body
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)

    const ln = new alby.LightningAddress(
      process.env.LIGHTENING_ADDRESS as string
    )
    await ln.fetch()

    if (!ln) {
      return res.sendResponse(
        null,
        'Invalid lightening address!',
        statusCodes.BAD_REQUEST
      )
    }

    const satoshi = await alby.fiat.getSatoshiValue({
      amount,
      currency: 'usd'
    })

    const invoice = await ln.requestInvoice({ satoshi })

    if (!invoice || !invoice?.paymentRequest) {
      return res.sendResponse(
        null,
        'There was some error while creating invoice. Please try again later!',
        statusCodes.BAD_REQUEST
      )
    }

    const invoiceData = {
      ...invoice,
      user: userId,
      amount,
      createdAt: moment(),
      expiredAt: moment().add(40, 'm')
    }
    const invoiceInDb = new Invoice(invoiceData)
    await invoiceInDb.save()

    return res.sendResponse(invoiceInDb, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

// PATCH: update invoice status
export const updateInvoiceStatus = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const invoiceId = new mongoose.Types.ObjectId(req.params.id)
    const invoice = await Invoice.findById(invoiceId).select(
      '_id user amount'
    )

    if (!invoice) {
      return res.sendResponse(
        null,
        'Invoice not found!',
        statusCodes.NOT_FOUND
      )
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { status: 'paid' },
      { new: true }
    )

    await User.findByIdAndUpdate(invoice.user, {
      $inc: {
        balance: invoice.amount * 100
      }
    })
    return res.sendResponse(updatedInvoice, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      error.message,
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
