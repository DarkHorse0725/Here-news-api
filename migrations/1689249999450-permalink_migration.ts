import { htmlToText } from 'html-to-text'
import { Post } from '../models/post.model'
import { Preview } from '../models/preview.model'
import mongoose from 'mongoose'
import { v4 as uuid } from 'uuid'

export async function up(): Promise<void> {
  mongoose.set('strictQuery', false)

  const dbURL = 'mongodb://localhost:27017/News'
  console.log("Using database: ", dbURL)
  await mongoose.connect(dbURL)

  await Post.updateMany({}, {
    $unset: {
      postId: 1,
      permalink: 1,
    }
  })

  const posts = await Post.find().populate('preview');

  for (let post of posts) {
    let permalinkText = post.title;

    if (post.preview && (!permalinkText || permalinkText.trim().length === 0)) {
      let savedPreview = await Preview.findOne({
        _id: new mongoose.Types.ObjectId(post.preview)
      })

      permalinkText = savedPreview?.title || savedPreview?.description || undefined;
    }

    if (!permalinkText || permalinkText.trim().length === 0) {
      const postText = htmlToText(post.text || '')
      const sanitizedText = postText.replaceAll(/(https?:\/\/[^\s]+)/g, '')
      permalinkText = sanitizedText.trim().length > 0 ? sanitizedText : postText
    }

    post.postId = uuid()
    const permalinkRegex = /^([\s\S]{1,50})(?:\X)?(?=\s|$)/;
    const regexMatch = permalinkText.match(permalinkRegex)?.[0];
    post.permalink = (regexMatch && regexMatch.length > 15 ? regexMatch : permalinkText.trim().slice(0,40)).toLowerCase().replace(/[-`_~!@#$%^&*()\[\]{}\\|;:'",<.>\/?]/g, ' ').trim().replace(/[\n\r\s]+/g, "-");

    try {
      if (post.permalink.length === 0) {
        console.log("Deleting post: ", post._id);
        await post.delete();
      } else {
        await post.save();
      }
    } catch (e) {
      console.log('Unsetting the preview for the post: ', post._id);
      const updatedPost = await post.updateOne({ $unset: { preview: 1 } });
      await updatedPost.save();
    }
  }
}

export async function down(): Promise<void> { }
