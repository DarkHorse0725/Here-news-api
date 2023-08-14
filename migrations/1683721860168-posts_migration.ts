// Import your models here
import mongoose from 'mongoose'
import parser from 'node-html-parser'
import { Post } from '../models/post.model'
import axios from 'axios';
import { decode } from 'html-entities';
import { Preview } from '../models/preview.model';

mongoose.set('strictQuery', false)

export async function up(): Promise<void> {
  mongoose.set('strictQuery', false)

  const dbURL = 'mongodb://localhost:27017/News'
  console.log("Using database: ", dbURL)
  await mongoose.connect(dbURL)

  // 1. Remove the titles and previews
  await Post.updateMany({}, {$unset: {preview: 1, title: 1} });

  const posts = await Post.find().setOptions({
    autoPopulateReplies: false
  });

  const previews = await Preview.find();

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];

    try {
      const { text } = post;

      // 2. Delete posts with empty texts
      if (!text || text?.trim().length === 0 || text === '<p></p>') { 
        console.log('Deleting post: ', post._id);
        await post.delete();
        continue;
      }

      const doc = parser(text!);

      if((doc.childNodes.length === 1 && doc.firstChild.innerText.trim().length === 0)) {
        console.log('Deleting post: ', post._id);
        await post.delete();
        continue;
      }

      const firstChild = doc.firstChild.innerText.trim();

      if (isValidURL(firstChild) && !firstChild.startsWith('data:')) {
        const updatedLink = `<p><a href=${firstChild} id="addedVialinkEditor">${firstChild}</a></p>`

        console.log('Updated post: ', post._id);
        // @ts-ignore
        doc.firstChild.innerHTML = updatedLink;
        post.text = doc.toString();
      }
      
      // 3. Get the preview of the last shared url and add id = "addedViaLinkEditor"
      const linkTags = doc.querySelectorAll('a');
  
      if (linkTags.length > 0) {
        let url: string | undefined;

        for (let tag = 0; tag < linkTags.length; tag++) {
          url = linkTags[tag].getAttribute('href');
          
          if (url) {
            linkTags[tag].setAttribute('id', 'addedViaLinkEditor');
            break;
          }
        }

        console.log('Handling post id: ', post.id, ' and index: ', i);

        if (url && isValidURL(url)) {
          const savedPreview = await getPreview(url, previews);

          await savedPreview?.save();
          post.preview = savedPreview?._id;
        }
      }
            
      await post.save({
        validateBeforeSave: false,
      });
    } catch(e) {
      console.error('Failed to handle post with id: ', post.id, ' due to: ', ((e as any)?.response?.data || e));
      throw e;
    }
  }
}

export async function down (): Promise<void> {
  const dbURL = 'mongodb://localhost:27017/News'
  console.log("Using database: ", dbURL)
  await mongoose.connect(dbURL)

  await Post.updateMany({}, {$unset: {preview: 1, title: 1} });
}

function isValidURL(str: string) {
  let _temp = str.trim()

  try {
    // if it only has a url it will have no other characters (and no spaces)
    if (_temp.split(' ').length > 1) return false

    new URL(_temp)
    return true
  } catch {
    return false
  }
}

function youtubeParser(url: string) {
  const regExp =
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11}).*/
  const match = url.match(regExp)
  return match && match[1].length == 11 ? match[1] : false
}

async function getPreview(url: string, previews: any[], tryForDomainAsWell: boolean = true): Promise<any> {
  try {
    console.log('Getting preview for: ', url);
    const foundPreview = previews.find((item) => item.url === url);

    if (foundPreview) {
      console.log('Using saved preview');
      return foundPreview;
    }

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

      previews.push(linkPreview);
      return linkPreview;
    } else {
      console.error('Couldn\'t get preview for: ', url);
    }
  } catch(e) {
    console.error('Couldn\'t get preview for: ', url);
  }

  if (tryForDomainAsWell) {
    const domain = getDomain(url);
    if (domain) {
      return getPreview(domain, previews, false);
    }
  }
}

const getDomain = (link: string) => {
  if (isValidURL(link)) {
    const url = new URL(link);
    return `${url.protocol}//${url.host}`
  }
}