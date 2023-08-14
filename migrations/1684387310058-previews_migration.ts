import mongoose from 'mongoose'
import { Preview } from '../models/preview.model';
import axios from 'axios';
import { decode } from 'html-entities';

export async function up (): Promise<void> {
  mongoose.set('strictQuery', false)

  const dbURL = 'mongodb://localhost:27017/News'
  console.log("Using database: ", dbURL)
  await mongoose.connect(dbURL)

  const previews = await Preview.find({ $or: [{ title: undefined}, { image: undefined }, { favicon: undefined }, { description: undefined }]});

  for (let i = 0; i < previews.length; i++) {
    const preview = previews[i];

    const data = await getPreview(preview.url)
    if (data) {
      console.log("Updating preview for url: ", preview.url, ' and index: ', preview._id);
      preview.title = data.title;
      preview.description = data.description;
      preview.image = data.image;
      preview.favicon = data.favicon;

      await preview.save();
    }
  }
}

export async function down (): Promise<void> {
  // Write migration here
}

function youtubeParser(url: string) {
  const regExp =
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11}).*/
  const match = url.match(regExp)
  return match && match[1].length == 11 ? match[1] : false
}

async function getPreview(url: string): Promise<any> {
  try {
    console.log('Getting preview for: ', url);
    const youtubeId = youtubeParser(url);

    const iframelyURL = `https://cdn.iframe.ly/api/iframely?key=1598c28f05b975d924afdf1e6fd61343&iframe=1&omit_script=1&url=${url}`
    const response = await axios.get(iframelyURL)
    console.log('Trying to get preview');

    if (!response.data.status) {
      const rawPreview = response.data;
      const linkPreview = new Preview({
        title: decode(rawPreview.meta.title),
        description: decode(rawPreview.meta.description),
        siteName: rawPreview.meta.site,
        url,
        youtubeId: !!youtubeId ? youtubeId : undefined,
        favicon: rawPreview.links.icon?.[0]?.href,
        image: rawPreview.links.thumbnail?.[0]?.href,
      });

      return linkPreview;
    } else {
      console.error('Couldn\'t get preview for: ', url);
    }
  } catch(e) {
    console.error('Couldn\'t get preview for: ', url);
  }
}