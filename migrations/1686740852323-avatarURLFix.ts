import mongoose, { Types } from 'mongoose'
import { User } from '../models/user.model'
import { Storage } from '@google-cloud/storage'
import { v4 as uuidv4 } from 'uuid';

export async function up (): Promise<void> {
  // TODO: If you want to run this migration, please add the project creds here as it won't pick from env directly or you can provide it directly from the terminal
  const storage = new Storage({
    projectId: 'PROJECT_ID_HERE',
    keyFilename: `authKey/service_account_key.json`
  })

  mongoose.set('strictQuery', false)

  const dbURL = 'mongodb://localhost:27017/News'
  console.log("Using database: ", dbURL)
  await mongoose.connect(dbURL)

  const users = await User.find({
    $and: [{
      useremail: {
        $ne: ''
      }
    }, {
      $expr: {
        $regexMatch: {
          input: "$avatar",
          regex: { $concat: [".*", "$useremail"] },
          options: "i"
        }
      },
    }]
  }).select('_id avatar useremail');

  for(let user of users) {
    const existingURL = user.avatar;

    if (!existingURL) {
      continue;
    }

    const bucketName = existingURL.replace('https://storage.googleapis.com/', '').split('/')[0];
    const bucket = storage.bucket(bucketName);

    const uuid = uuidv4()
    const name = existingURL.split(`${bucket.name}/`)[1];
    const newName = `images/${uuid}`

    await bucket.file(name).move(newName);

    console.log("Moving file: ", name, " to: ", newName)
    user.avatar = `https://storage.googleapis.com/${bucket.name}/${newName}`
    await user.save()
  }
}

export async function down (): Promise<void> {}
