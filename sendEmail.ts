import nodemailer, { SentMessageInfo } from 'nodemailer'
import hbs from 'nodemailer-express-handlebars'

export const SendEmail = async (
  useremail: string,
  inviterEmail: string,
  username: string,
  token: string,
  file: string,
  balance?: number,
  userId?: string,
  userIdHash?: string
): Promise<SentMessageInfo> => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.NODEMAILER_CRED_EMAIL,
      pass: process.env.NODEMAILER_CRED_KEY
    }
  })

  const handlebarOptions = {
    viewEngine: {
      extname: '.hbs',
      layoutsDir: 'views/',
      defaultLayout: `${file}.hbs`
      // partialsDir: 'views/'
    },
    viewPath: 'views/',
    extName: '.hbs'
  }

  const baseUrl = process.env.FRONTEND_BASE_URL

  transporter.use('compile', hbs(handlebarOptions))
  const mailOptions = {
    from: process.env.NODEMAILER_CRED_EMAIL,
    to: useremail,
    subject: `${
      file === 'registerInvitation'
        ? "You're invited to join here.news"
        : 'Reset Password'
    }`,
    template: `${file}`,

    context: {
      ...(file === 'registerInvitation' && {
        token,
        email: useremail,
        inviterEmail,
        balance,
        userId,
        userIdHash
      }),
      ...(file === 'forgotPassword' && {
        token,
        username
      }),
      baseUrl
    }
  }

  const info = await transporter.sendMail(mailOptions)
  return info
}
