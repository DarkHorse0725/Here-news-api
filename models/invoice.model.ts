import { Schema, model } from 'mongoose'

export interface InvoiceI {
  user: {
    type: Schema.Types.ObjectId
    ref: 'Users'
  }
  paymentRequest: string
  paymentHash: string
  verify: string // Invoice Verification link provided by alby-tools
  amount: number
  status?: 'paid' | 'unpaid'
  expiredAt?: Date
  createdAt?: Date
}

const InvoiceSchema = new Schema<InvoiceI>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Users'
  },
  paymentRequest: String,
  paymentHash: String,
  verify: String, // Invoice Verification link provided by alby-tools
  status: { type: String, default: 'unpaid' },
  amount: Number,
  expiredAt: Date,
  createdAt: { type: Date, default: new Date() }
})

const Invoice = model<InvoiceI>('Invoice', InvoiceSchema)

export { Invoice }
