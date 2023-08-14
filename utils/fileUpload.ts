import { v4 as uuidv4 } from 'uuid'
import { Storage } from '@google-cloud/storage'
import { base64MimeType } from './base64MimeType'

export const storage = new Storage({
  keyFilename: `authKey/service_account_key.json`,
  projectId: process.env.GCOULD_PROJECT_ID
})

const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET || '')

export const fileUpload = async (
  data: Blob | string,
  defaultMimeType?: string
): Promise<any> => {
  try {
    const uniqueId = uuidv4()
    const fileName = `images/${uniqueId}`
    const file = bucket.file(fileName)

    const fileOptions = {
      resumable: false,
      metadata: {
        contentType: base64MimeType(data) || defaultMimeType
      }
    }
    if (typeof data === 'string') {
      const base64EncodedString = data.replace(
        /^data:\w+\/\w+;base64,/,
        ''
      )
      const fileBuffer = Buffer.from(base64EncodedString, 'base64')
      await file.save(fileBuffer, fileOptions)
    }
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`
    return publicUrl
  } catch (err) {
    console.log('Error file upload >>> ', err)
  }
}

export const fileDelete = async (name: string): Promise<any> => {
  const file = bucket.file(name)

  return new Promise((resolve, reject) => {
    file.delete((error): any => {
      if (error) {
        reject(error)
      } else {
        resolve(`File ${name} deleted successfully.`)
      }
    })
  })
}

export const isFileExists = async (
  name: string
): Promise<boolean> => {
  const file = bucket.file(name)
  const fileExists = await file.exists()
  return fileExists[0]
}
