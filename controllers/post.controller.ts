import { Request } from 'express'
import mongoose from 'mongoose'
import { Storage } from '@google-cloud/storage'
import dotenv from 'dotenv'
import { statusCodes } from 'constants/statusCodes'
import { NotificationGroup, Post, PostInterface, User } from 'models'
import { DecodedRequest, IResponse } from 'Types'
import axios from 'axios'
import { decode } from 'html-entities'
import { Preview } from 'models/preview.model'
import { socketIoObject } from 'index'
import { translateText } from '../lib/openAiConfig'
import parse from 'node-html-parser'
import { v4 as uuid } from 'uuid'
import { htmlToText } from 'html-to-text'

dotenv.config()

const storage = new Storage({
  projectId: process.env.GCOULD_PROJECT_ID,
  keyFilename: `authKey/service_account_key.json`
})

const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET || '')

const options = {
  wordwrap: 130,
  selectors: [
    { selector: 'a', format: 'skip' },
    { selector: 'img', format: 'skip' }
  ]
}

export const uploadToBucket = async (
  req: Request,
  res: IResponse
) => {
  try {
    return res.status(200).json({
      url:
        `https://storage.googleapis.com/${process.env.GCLOUD_STORAGE_BUCKET}/${req?.file?.filename}` ||
        ''
    })
  } catch (err: any) {
    console.log(err)
  }
}

export const removeFromBucket = async (
  req: Request,
  res: IResponse
) => {
  try {
    const { filename } = req.body
    const filen: string = filename.split('/').pop()! // get the filename from the URL
    const path = `medias/${filen}`

    const file = bucket.file(`${path}`)

    await file
      .delete()
      .then()
      .catch(error => {
        console.log(error)
      })

    return res.status(200).json({
      message: 'success'
    })
  } catch (err: any) {
    console.log(err)
  }
}

export const createPost = async (req: Request, res: IResponse) => {
  const { userId, text, title, previewId } = req.body

  const data: Partial<PostInterface> = {
    userId,
    title: decode(title),
    createdAt: new Date(),
    preview: previewId,
    text,
  }

  const post = new Post(data)
  try {
    const userData = await User.findById(userId).select(
      'username displayName balance reputation avatar createdAt'
    )

    if (!userData)
      return res.sendResponse(
        null,
        { message: 'No user found' },
        statusCodes.BAD_REQUEST,
      )

    if (userData.balance <= 0)
      return res.sendResponse(
        null,
        { message: 'Insufficient balance' },
        statusCodes.BAD_REQUEST,
      )

    let permalinkText = data.title;

    if (previewId) {
      let savedPreview = await Preview.findOne({
        _id: new mongoose.Types.ObjectId(previewId)
      })

      if (savedPreview && !savedPreview.sourcePost) {
        savedPreview.sourcePost = post._id
        await savedPreview.save()
      }

      if (!permalinkText || permalinkText.trim().length === 0) {
        permalinkText = savedPreview?.title || savedPreview?.description;
      }
    }

    if (!permalinkText || permalinkText.trim().length === 0) {
      const postText = htmlToText(post.text || '')
      const sanitizedText = removeLinks(postText)
      permalinkText = sanitizedText.trim().length > 15 ? sanitizedText : postText
    }

    post.postId = uuid()
    const regexMatch = getBoundedText(permalinkText);
    post.permalink = regexMatch && regexMatch.length > 15 ? cleanPermalink(regexMatch) : cleanPermalink(permalinkText);

    // post.reputation = userData?.reputation || 0 // initial post reputation
    post.reputation = 1 // initial post reputation
    await post.save()

    if (userData) {
      userData.balance = Number(userData.balance - 1)
      await userData.save()
    }

    socketIoObject?.sockets.emit('newPost', {
      user: userData,
      postId: post._id,
      title: post.title
    })

    res.sendResponse(post, null, statusCodes.OK)
  } catch (error: any) {
    res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

export const createPostReply = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  const { userId, text, previewId, title } = req.body
  const { postId } = req.params

  if (!postId)
    return res.sendResponse(
      null,
      { message: 'Wrong post id!' },
      statusCodes.BAD_REQUEST
    )

  const findUser = await User.findById(userId).select('reputation')

  if (!findUser)
    return res.sendResponse(
      null,
      { message: 'User not found!' },
      statusCodes.NOT_FOUND
    )

  if (findUser.balance <= 0)
    return res.sendResponse(
      null,
      { message: 'Insufficient balance' },
      statusCodes.BAD_REQUEST,
    )

  const foundPost = await Post.findOne({ postId }).select('_id userId');

  if (!foundPost)
    return res.sendResponse(null, { message: 'Post not found' }, statusCodes.BAD_REQUEST);

  const data: Partial<PostInterface> = {
    userId,
    repliedTo: foundPost._id as any,
    createdAt: new Date(),
    reputation: 1,
    lastUpvotesWeight: 0,
    lastDownvotesWeight: 0,
    preview: previewId,
    title: decode(title),
    text,
  }

  const post = new Post(data)
  try {
    let permalinkText = data.title;

    if (previewId) {
      let savedPreview = await Preview.findOne({
        _id: new mongoose.Types.ObjectId(previewId)
      })

      if (savedPreview && !savedPreview.sourcePost) {
        savedPreview.sourcePost = post._id
        await savedPreview.save()
      }

      if (!permalinkText || permalinkText.trim().length === 0) {
        permalinkText = savedPreview?.title || savedPreview?.description;
      }
    }

    if (!permalinkText || permalinkText.trim().length === 0) {
      const postText = htmlToText(post.text || '')
      const sanitizedText = removeLinks(postText)
      permalinkText = sanitizedText.trim().length > 15 ? sanitizedText : postText
    }

    post.postId = uuid()
    const regexMatch = getBoundedText(permalinkText);
    post.permalink = regexMatch && regexMatch.length > 15 ? cleanPermalink(regexMatch) : cleanPermalink(permalinkText);

    await post.save()

    await foundPost.update({
      $addToSet: { replies: post._id }
    })

    const userData = await User.findById(userId).select(
      'username displayName balance reputation avatar createdAt'
    )

    if (foundPost?.userId.toString() !== req?.auth?.id.toString()) {
      const groupNotification: any = await NotificationGroup.findOne({
        post: foundPost._id,
        type: 'comment'
      })

      if (groupNotification) {
        groupNotification.count = groupNotification?.count + 1
        await groupNotification.save()
      } else {
        const newGroup = {
          post: foundPost._id,
          user: foundPost?.userId,
          type: 'comment',
          count: 1
        }
        const group = new NotificationGroup(newGroup)
        await group.save()
      }
    }

    if (userData) {
      userData.balance = Number(userData.balance - 1)
      await userData.save()
    }

    socketIoObject?.sockets.emit('newPost', {
      user: userData,
      postId: post._id,
      title: post.title
    })

    res.sendResponse(post, null, statusCodes.OK)
  } catch (error: any) {
    res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

export const editPost = async (req: Request, res: IResponse) => {
  const { id } = req.params
  const { text, title, previewId } = req.body

  if (!id)
    return res.sendResponse(null, { message: 'No post id was provided' }, statusCodes.BAD_REQUEST);

  const foundPost = await Post.findOne({ postId: id })

  if (!foundPost)
    return res.sendResponse(
      null,
      {
        message: 'Post not found!'
      },
      statusCodes.NOT_FOUND
    )

  foundPost.title = title
  foundPost.updatedAt = new Date()

  const initialPreview = foundPost.preview
  foundPost.preview = previewId

  const newFiles: string[] = getImageFiles(text);
  const prevFiles: string[] = getImageFiles(foundPost.text);

  if (text) {
    foundPost.text = text
  }


  const filesToDelete = prevFiles.filter(file => !newFiles.includes(file));
  filesToDelete
    .forEach((imageToDelete: string) => {
      const filename: string = imageToDelete.split('/').pop()! // get the filename from the URL
      const path = `medias/${filename}` // build the path to the file
      try {
        const file = bucket.file(`${path}`)
        file
          .delete()
          .then()
          .catch(error => {
            console.log(error)
          })
      } catch (error) { }
    })

  try {
    // This block will run irrespective of whether the post had a preview and/or a new preview was introduced
    if (previewId !== initialPreview) {
      // If there was a preview previously, and the preview has been changed or removed, then update the preview's source post with the oldest available post
      if (initialPreview) {
        await removeOrUpdateSourcePost(initialPreview, foundPost._id)
      }

      // If a new preview has been introduced
      if (previewId) {
        await removeOrUpdateSourcePost(previewId, foundPost._id, true)
      }
    }

    await foundPost.save()
    res.sendResponse(foundPost, null, statusCodes.OK)
  } catch (error: any) {
    res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

export const deletePost = async (req: Request, res: IResponse) => {
  const { id } = req.params

  if (!id)
    return res.sendResponse(null, { message: 'Post id was not provided' }, statusCodes.BAD_REQUEST);

  const foundPost = await Post.findOne({ postId: id }).select('_id')

  if (!foundPost)
    return res.sendResponse(null, { message: 'Post not found' }, statusCodes.BAD_REQUEST);

  if (foundPost) {
    const nestedReplies = await Post.aggregate([
      {
        $match: {
          _id: foundPost._id
        }
      },
      {
        $graphLookup: {
          from: 'posts',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'repliedTo',
          as: 'replies',
          depthField: 'depth'
        }
      }
    ])

    // Remove the source post from the corresponding preview and use the oldest post with preview as the source post
    if (foundPost.preview) {
      await removeOrUpdateSourcePost(foundPost.preview, foundPost._id)
    }

    const replies =
      nestedReplies && nestedReplies[0] && nestedReplies[0].replies
        ? nestedReplies[0].replies
        : []

    Post.findOneAndDelete(foundPost._id)
      .then(async data => {
        if (!data) throw Error('Post not found!')

        const { repliedTo } = data

        if (repliedTo) {
          await Post.findByIdAndUpdate(repliedTo, {
            $pull: { replies: data._id }
          })
        }

        // delete all parent and nested images
        let imagesToDelete: string[] = getImageFiles(data.text);

        for (const reply of replies) {
          const replyImages = getImageFiles(reply.text);
          imagesToDelete = [...imagesToDelete, ...replyImages];
        }

        imagesToDelete.forEach((imageToDelete: string) => {
          const filename: string = imageToDelete.split('/').pop()!
          const path = `medias/${filename}`
          try {
            const file = bucket.file(`${path}`)
            file
              .delete()
              .then()
              .catch(error => {
                console.log(error)
              })
          } catch (error) { }
        })

        // deleting all replies
        for (const reply of replies) {
          await Post.findByIdAndDelete(reply._id)
        }

        res.sendResponse(null, null, statusCodes.NO_CONTENT)
      })
      .catch(e =>
        res.sendResponse(
          null,
          {
            message: e.message
          },
          statusCodes.NOT_FOUND
        )
      )
  } else {
    res.sendResponse(
      null,
      {
        message: 'Post not found!'
      },
      statusCodes.NOT_FOUND
    )
  }
}

export const getExplorePosts = async (
  req: Request,
  res: IResponse
) => {
  const { per_page, page } = req.query

  let pipeline: mongoose.PipelineStage[] = [
    {
      $sort: {
        createdAt: -1
      }
    }
  ]

  if (per_page && page) {
    pipeline.push({
      $skip: (Number(page) - 1) * Number(per_page)
    })
    pipeline.push({
      $limit: Number(per_page)
    })
  }

  pipeline = [
    ...pipeline,
    ...[
      // Preview lookup
      {
        $lookup: {
          from: 'previews',
          let: { previewId: '$preview' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$previewId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                url: 1,
                favicon: 1,
                siteName: 1,
                image: 1,
                title: 1,
                description: 1,
                youtubeId: 1
              }
            }
          ],
          as: 'preview'
        }
      },
      // Preview unwind
      {
        $unwind: {
          path: '$preview',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { userId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$userId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                username: 1,
                displayName: 1,
                reputation: 1,
                avatar: 1,
                userIdHash: 1,
                verified: 1
              }
            }
          ],
          as: 'userId'
        }
      },
      {
        $unwind: {
          path: '$userId'
        }
      },
      {
        $project: {
          userId: 1,
          title: 1,
          text: 1,
          images: 1,
          createdAt: 1,
          upvotes: 1,
          downvotes: 1,
          totalVotes: 1,
          preview: 1,
          replies: 1,
          postId: 1,
          permalink: 1,
          repliedTo: 1,
          tips: 1
        }
      }
    ]
  ]

  const posts = await Post.aggregate(pipeline)
  res.sendResponse(posts, null, statusCodes.OK)
}

export const getUserPosts = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  const { limit, page, postType } = req.query

  let pipeline: mongoose.PipelineStage[] = [
    {
      $sort: {
        createdAt: -1
      }
    }
  ]

  pipeline = [
    ...pipeline,
    ...[
      {
        $addFields: {
          postType: {
            $cond: {
              if: { $ifNull: ['$repliedTo', false] },
              then: 'Replies',
              else: 'Posts'
            }
          }
        }
      },
      {
        $match: {
          postType: postType === 'Replies' ? 'Replies' : 'Posts'
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { userId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$userId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                username: 1,
                displayName: 1,
                reputation: 1,
                avatar: 1,
                userIdHash: 1,
                verified: 1
              }
            }
          ],
          as: 'userId'
        }
      },
      {
        $unwind: {
          path: '$userId'
        }
      },
      {
        $match: {
          'userId._id': new mongoose.Types.ObjectId(req?.auth?.id)
        }
      },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'posts',
          let: { repliedTo: '$repliedTo' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', { $toObjectId: '$$repliedTo' }]
                }
              }
            },
            {
              $lookup: {
                from: 'users',
                let: { userId: '$userId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$_id', { $toObjectId: '$$userId' }]
                      }
                    }
                  },
                  {
                    $project: {
                      username: 1,
                      displayName: 1,
                      reputation: 1,
                      balance: 1,
                      avatar: 1
                    }
                  }
                ],

                as: 'userId'
              }
            },
            {
              $unwind: {
                path: '$userId'
              }
            },
            {
              $project: {
                _id: 1,
                text: 1,
                title: 1,
                images: 1,
                repliedTo: 1,
                replies: 1,
                userId: 1,
                createdAt: 1,
                upvotes: 1,
                downvotes: 1,
                totalVotes: 1,
                preview: 1
              }
            }
          ],
          as: 'repliedTo'
        }
      },
      {
        $unwind: {
          path: '$repliedTo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'previews',
          localField: 'preview',
          foreignField: '_id',
          as: 'preview'
        }
      },
      {
        $unwind: {
          path: '$preview',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          title: 1,
          text: 1,
          images: 1,
          createdAt: 1,
          upvotes: 1,
          downvotes: 1,
          totalVotes: 1,
          replies: 1,
          repliedTo: 1,
          postId: 1,
          permalink: 1,
          preview: {
            url: 1,
            favicon: 1,
            siteName: 1,
            image: 1,
            title: 1,
            description: 1,
            youtubeId: 1,
            primary: 1
          }
        }
      }
    ]
  ]

  const posts = await Post.aggregate(pipeline)
  res.sendResponse(posts, null, statusCodes.OK)
}

export const getSearchPosts = async (
  req: Request,
  res: IResponse
) => {
  const { per_page, page, search } = req.query

  if (search?.length == 0) {
    res.sendResponse([], null, statusCodes.OK)
    return
  }
  let pipeline: mongoose.PipelineStage[] = [
    {
      $match: {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { text: { $regex: search, $options: 'i' } }
        ]
      }
    },
    {
      $sort: {
        createdAt: -1
      }
    }
  ]

  if (per_page && page) {
    pipeline.push({
      $skip: (Number(page) - 1) * Number(per_page)
    })
    pipeline.push({
      $limit: Number(per_page)
    })
  }

  pipeline = [
    ...pipeline,
    ...[
      {
        $lookup: {
          from: 'users',
          let: { userId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$userId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                username: 1,
                displayName: 1,
                reputation: 1,
                avatar: 1,
                userIdHash: 1,
                verified: 1
              }
            }
          ],
          as: 'userId'
        }
      },
      {
        $unwind: {
          path: '$userId'
        }
      },
      {
        $lookup: {
          from: 'posts',
          let: { repliedTo: '$repliedTo' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', { $toObjectId: '$$repliedTo' }]
                }
              }
            },
            {
              $lookup: {
                from: 'users',
                let: { userId: '$userId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$_id', { $toObjectId: '$$userId' }]
                      }
                    }
                  },
                  {
                    $project: {
                      username: 1,
                      displayName: 1,
                      reputation: 1,
                      balance: 1,
                      avatar: 1
                    }
                  }
                ],

                as: 'userId'
              }
            },
            {
              $unwind: {
                path: '$userId'
              }
            },
            {
              $project: {
                _id: 1,
                text: 1,
                title: 1,
                images: 1,
                repliedTo: 1,
                replies: 1,
                userId: 1,
                createdAt: 1,
                upvotes: 1,
                downvotes: 1,
                totalVotes: 1,
                preview: 1
              }
            }
          ],
          as: 'repliedTo'
        }
      },
      {
        $unwind: {
          path: '$repliedTo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          title: 1,
          text: 1,
          images: 1,
          createdAt: 1,
          upvotes: 1,
          downvotes: 1,
          totalVotes: 1,
          preview: 1,
          replies: 1,
          repliedTo: 1
        }
      }
    ]
  ]

  const posts = await Post.aggregate(pipeline)
  res.sendResponse(posts, null, statusCodes.OK)
}

export const getExploreTopics = async (
  req: Request,
  res: IResponse
) => {
  const { per_page, page } = req.query

  let pipeline: mongoose.PipelineStage[] = [
    {
      $sort: {
        createdAt: -1
      }
    }
  ]

  if (per_page && page) {
    pipeline.push({
      $skip: (Number(page) - 1) * Number(per_page)
    })
    pipeline.push({
      $limit: Number(per_page)
    })
  }

  pipeline = [
    ...pipeline,
    ...[
      {
        $project: {
          _id: 1,
          userId: 1,
          title: 1,
          text: 1,
          meta: 1,
          images: 1,
          createdAt: 1,
          upvotes: 1,
          downvotes: 1,
          totalVotes: 1,
          preview: 1,
          replies: 1,
          repliedTo: 1
        }
      }
    ]
  ]

  const posts = await Post.aggregate(pipeline)
  res.sendResponse(posts, null, statusCodes.OK)
}

export const getPopularTopics = async (
  req: Request,
  res: IResponse
) => {
  const pipeline: mongoose.PipelineStage[] = [
    { $unwind: '$meta.tags' },
    {
      $group: { _id: { $toLower: '$meta.tags' }, count: { $sum: 1 } }
    },
    { $sort: { count: -1 } },
    { $limit: 4 },
    { $project: { _id: 0, data: { $toLower: '$_id' }, count: 1 } }
  ]
  const topics = await Post.aggregate(pipeline)
  const result = topics.map(data => data.data)
  res.sendResponse(result, null, statusCodes.OK)
}

export const getAllTopics = async (req: Request, res: IResponse) => {
  const pipeline: mongoose.PipelineStage[] = [
    { $unwind: '$meta.tags' },
    { $match: { 'meta.tags': { $ne: '' } } },
    { $group: { _id: { $toLower: '$meta.tags' } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, data: '$_id' } }
  ]
  const topics = await Post.aggregate(pipeline)
  const result = topics.map(data => data.data)
  res.sendResponse(result, null, statusCodes.OK)
}
export const getAllPostsByTopic = async (
  req: Request,
  res: IResponse
) => {
  const { per_page, page, search, period } = req.query

  const sortMap = new Map()
  sortMap.set('reputation', -1)
  sortMap.set('totalVotes', -1)
  let pipeline: mongoose.PipelineStage[] = [
    {
      $sort: sortMap as any
    },
    {
      $match: {
        'meta.tags': {
          $regex: new RegExp('^' + String(search) + '$', 'i')
        }
      }
    }
  ]

  if (per_page && page) {
    pipeline.push({
      $skip: (Number(page) - 1) * Number(per_page)
    })
    pipeline.push({
      $limit: Number(per_page)
    })
  }

  const now = new Date()
  const pastHour = new Date(now.getTime() - 60 * 60 * 1000) // one hour ago
  const pastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000) // one day ago
  const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // one week ago
  const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // one month ago
  const pastYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) // one year ago

  if (Number(period) > 0) {
    let timeFrame
    switch (Number(period)) {
      case 1:
        timeFrame = pastHour
        break
      case 2:
        timeFrame = pastDay
        break
      case 3:
        timeFrame = pastWeek
        break
      case 4:
        timeFrame = pastMonth
        break
      case 5:
        timeFrame = pastYear
        break
      default:
        timeFrame = pastHour
    }
    pipeline.push({
      $match: {
        createdAt: { $gte: timeFrame }
      }
    })
  }

  pipeline = [
    ...pipeline,
    ...[
      {
        $lookup: {
          from: 'users',
          let: { userId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$userId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                username: 1,
                displayName: 1,
                reputation: 1,
                avatar: 1
              }
            }
          ],
          as: 'userId'
        }
      },
      {
        $unwind: {
          path: '$userId',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'posts',
          let: { repliedTo: '$repliedTo' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', { $toObjectId: '$$repliedTo' }]
                }
              }
            },
            {
              $lookup: {
                from: 'users',
                let: { userId: '$userId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$_id', { $toObjectId: '$$userId' }]
                      }
                    }
                  },
                  {
                    $project: {
                      username: 1,
                      displayName: 1,
                      reputation: 1,
                      balance: 1,
                      avatar: 1
                    }
                  }
                ],

                as: 'userId'
              }
            },
            {
              $unwind: {
                path: '$userId'
              }
            },
            {
              $project: {
                _id: 1,
                text: 1,
                title: 1,
                images: 1,
                repliedTo: 1,
                replies: 1,
                userId: 1,
                createdAt: 1,
                upvotes: 1,
                downvotes: 1,
                totalVotes: 1,
                preview: 1
              }
            }
          ],
          as: 'repliedTo'
        }
      },
      {
        $unwind: {
          path: '$repliedTo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          title: 1,
          text: 1,
          images: 1,
          createdAt: 1,
          upvotes: 1,
          downvotes: 1,
          meta: 1,
          bookMarks: 1,
          totalVotes: 1,
          preview: 1,
          replies: 1,
          repliedTo: 1,
          reputation: 1
        }
      }
    ]
  ]
  const posts = await Post.aggregate(pipeline)
  res.sendResponse(posts, null, statusCodes.OK)
}

export const getTrendingPosts = async (
  req: Request,
  res: IResponse
): Promise<void> => {
  const { per_page, page } = req.query

  const sortMap = new Map()
  sortMap.set('reputation', -1)
  sortMap.set('totalVotes', -1)
  let pipeline: mongoose.PipelineStage[] = [
    {
      $sort: sortMap as any
    }
  ]

  if (per_page && page) {
    pipeline.push({
      $skip:
        page !== 'null' ? (Number(page) - 1) * Number(per_page) : 0
    })
    pipeline.push({
      $limit: Number(per_page)
    })
  }

  pipeline = [
    {
      $match: {
        reputation: {
          $gte: 1
        }
      }
    },
    ...pipeline,
    ...[
      // Preview lookup
      {
        $lookup: {
          from: 'previews',
          let: { previewId: '$preview' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$previewId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                url: 1,
                favicon: 1,
                siteName: 1,
                image: 1,
                title: 1,
                description: 1,
                youtubeId: 1
              }
            }
          ],
          as: 'preview'
        }
      },
      // Preview unwind
      {
        $unwind: {
          path: '$preview',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { userId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$userId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                username: 1,
                displayName: 1,
                reputation: 1,
                avatar: 1,
                userIdHash: 1,
                verified: 1
              }
            }
          ],
          as: 'userId'
        }
      },
      {
        $unwind: {
          path: '$userId',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          userId: 1,
          title: 1,
          text: 1,
          images: 1,
          createdAt: 1,
          upvotes: 1,
          downvotes: 1,
          totalVotes: 1,
          bookMarks: 1,
          meta: 1,
          preview: 1,
          replies: 1,
          repliedTo: 1,
          reputation: 1,
          postId: 1,
          permalink: 1
        }
      }
    ]
  ]
  const posts = await Post.aggregate(pipeline)
  res.sendResponse(posts, null, statusCodes.OK)
}

export const getLinkDetails = async (
  req: Request,
  res: IResponse
) => {
  const { url } = req.params

  if (!url) {
    return res.sendResponse(
      null,
      { message: 'Url required!' },
      statusCodes.BAD_REQUEST
    )
  } else if (!isValidURL(url)) {
    return res.sendResponse(
      null,
      { message: 'Invalid url provided' },
      statusCodes.BAD_REQUEST
    )
  }

  try {
    const foundPreview = await findPreview(url)

    if (foundPreview) {
      return res.sendResponse(foundPreview, null, statusCodes.OK)
    }

    const iframelyURL = `https://cdn.iframe.ly/api/iframely?key=${process.env.IFRAMELY_KEY}&iframe=1&omit_script=1&url=${url}`
    const response = await axios.get(iframelyURL)

    // This check is needed as iframely might respond from their side, but they couldn't find the actual data
    if (response.data.status) {
      return res.sendResponse(
        null,
        { message: response.data.error || 'Failed to get preview' },
        response.data.status
      )
    }

    const rawPreview = response.data
    const canonical = rawPreview.meta.canonical
    const isCanonicalValidURL = isValidURL(canonical)

    if (canonical && isCanonicalValidURL) {
      const foundCanonical = await findPreview(canonical)

      if (foundCanonical) {
        foundCanonical.canonicals = [
          ...(foundCanonical.canonicals ?? []),
          url
        ]
        await foundCanonical.save()
        return res.sendResponse(foundCanonical, null, statusCodes.OK)
      }
    }

    const regExp =
      /^(?:https?:\/\/(?:www\.)?youtube\.com\/watch\?v=|https?:\/\/youtu\.be\/|(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/)([\w-]{11}).*$/
    const match = url.match(regExp)
    const youtubeId =
      match && match[1].length == 11 ? match[1] : undefined

    const linkPreview = new Preview({
      title: decode(rawPreview.meta.title),
      description: decode(rawPreview.meta.description),
      siteName: rawPreview.meta.site,
      url: isCanonicalValidURL ? canonical : url,
      canonicals: [],
      favicon: rawPreview.links.icon?.[0]?.href,
      image: rawPreview.links.thumbnail?.[0]?.href,
      youtubeId
    })

    await linkPreview.save()
    return res.sendResponse(linkPreview, null, statusCodes.OK)
  } catch (e: any) {
    console.log(e)
    return res.sendResponse(
      null,
      { message: e.message },
      statusCodes.BAD_REQUEST
    )
  }
}

export const upvotePost = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  const { id } = req.params
  const { userId } = req.body

  const findPost = await Post.findOne({
    postId: id
  })

  if (!findPost)
    return res.sendResponse(
      null,
      { message: 'Post not found!' },
      statusCodes.NOT_FOUND
    )

  const postAuthor = await User.findById(findPost.userId)
  if (!postAuthor)
    return res.sendResponse(
      null,
      { message: 'Post author not found!' },
      statusCodes.NOT_FOUND
    )

  const findUser = await User.findById(userId)

  if (!findUser)
    return res.sendResponse(
      null,
      { message: 'User not found!' },
      statusCodes.NOT_FOUND
    )

  if (postAuthor._id.equals(findUser._id))
    return res.sendResponse(
      null,
      { message: 'Cannot upvote your own post!' },
      statusCodes.NOT_FOUND
    )

  if (findUser.balance <= 0)
    return res.sendResponse(
      null,
      { message: 'Insufficient balance' },
      statusCodes.UNAUTHORIZED
    )

  const tempUpvotes =
    findPost && findPost.upvotes
      ? findPost.upvotes.map(item => `${item}`)
      : []

  const tempDownvotes =
    findPost && findPost.downvotes
      ? findPost.downvotes.map(item => `${item}`)
      : []

  let hasDownvote = false
  const downvotes = [...tempDownvotes]
  if (downvotes && downvotes.includes(userId)) {
    hasDownvote = true
    downvotes.splice(
      downvotes.findIndex(value => `${value}` === `${userId}`),
      1
    )
  }

  const upvotes = [...tempUpvotes]
  upvotes.push(userId)

  const updateQuery = {
    upvotes: [...upvotes],
    downvotes: [...downvotes],
    totalVotes: findPost.totalVotes
      ? hasDownvote
        ? findPost.totalVotes + 2
        : findPost.totalVotes + 1
      : 1,
    lastUpvotesWeight:
      (findPost.lastUpvotesWeight || 0) + findUser.reputation,
    lastDownvotesWeight: hasDownvote
      ? (findPost.lastDownvotesWeight || 0) - findUser.reputation
      : findPost.lastDownvotesWeight || 0
  }

  const updatedPost = await Post.findByIdAndUpdate(findPost._id, updateQuery, {
    new: true
  })

  findUser.balance = Number(findUser.balance - 1)
  await findUser.save()

  postAuthor.balance = Number(postAuthor.balance + 1)
  await postAuthor?.save()

  // Check if the user has already tipped the post
  // const userTip = findPost?.tips?.find(
  //   tip => tip.userId.toString() === userId
  // )

  // if (userTip && userTip.count) {
  //   userTip.count += 1
  // } else {
  //   const tipObj: any = { userId, count: 1 }
  //   if (!findPost.tips) {
  //     findPost.tips = [tipObj]
  //   } else {
  //     findPost?.tips.push(tipObj)
  //   }
  // }
  // await findPost.save()

  const groupNotification: any = await NotificationGroup.findOne({
    post: findPost?._id,
    type: 'upvote'
  })

  if (groupNotification) {
    groupNotification.count = groupNotification?.count + 1
    await groupNotification.save()
  } else {
    const newGroup = {
      post: findPost?._id,
      user: postAuthor._id,
      type: 'upvote',
      count: 1
    }
    const group = new NotificationGroup(newGroup)
    await group.save()
  }
  res.sendResponse(updatedPost, null, statusCodes.OK)
}

export const downvotePost = async (
  req: Request,
  res: IResponse
): Promise<void> => {
  const { id } = req.params
  const { userId } = req.body

  const findPost = await Post.findOne({
    postId: id
  }).lean()

  if (!findPost)
    return res.sendResponse(
      null,
      { message: 'Post not found!' },
      statusCodes.NOT_FOUND
    )
  const postAuthor = await User.findById(findPost.userId)
  if (!postAuthor)
    return res.sendResponse(
      null,
      { message: 'Post author not found!' },
      statusCodes.NOT_FOUND
    )

  const findUser = await User.findById(userId)
  if (!findUser)
    return res.sendResponse(
      null,
      { message: 'User not found!' },
      statusCodes.NOT_FOUND
    )

  if (postAuthor._id.equals(findUser._id))
    return res.sendResponse(
      null,
      { message: 'Cannot downvote your own post!' },
      statusCodes.NOT_FOUND
    )

  if (findUser.balance <= 0)
    return res.sendResponse(
      null,
      { message: 'Insufficient balance' },
      statusCodes.UNAUTHORIZED
    )

  const admin = await User.findById(process.env.ADMIN_ACCOUNT_ID)
  if (!admin)
    return res.sendResponse(
      null,
      { message: 'Systems account not found!' },
      statusCodes.NOT_FOUND
    )

  const tempUpvotes =
    findPost && findPost.upvotes
      ? findPost.upvotes.map(item => `${item}`)
      : []

  const tempDownvotes =
    findPost && findPost.downvotes
      ? findPost.downvotes.map(item => `${item}`)
      : []

  let hasUpvote = false

  const upvotes = [...tempUpvotes]
  if (upvotes && upvotes.includes(userId)) {
    hasUpvote = true
    upvotes.splice(
      upvotes.findIndex(value => `${value}` === `${userId}`),
      1
    )
  }

  const downvotes = [...tempDownvotes]
  downvotes.push(userId)

  const updateQuery = {
    upvotes: [...upvotes],
    downvotes: [...downvotes],
    totalVotes: findPost.totalVotes
      ? hasUpvote
        ? findPost.totalVotes - 2
        : findPost.totalVotes - 1
      : -1,

    lastUpvotesWeight: hasUpvote
      ? (findPost.lastUpvotesWeight || 0) - findUser.reputation
      : findPost.lastUpvotesWeight || 0,
    lastDownvotesWeight:
      (findPost.lastDownvotesWeight || 0) + findUser.reputation
  }

  const updatedPost = await Post.findByIdAndUpdate(findPost._id, updateQuery, {
    new: true
  })

  findUser.balance = Number(findUser.balance - 1)
  await findUser.save()

  admin.balance = Number(admin.balance + 1)
  await admin?.save()

  const groupNotification: any = await NotificationGroup.findOne({
    post: findPost?._id,
    type: 'downvote'
  })

  if (groupNotification) {
    groupNotification.count = groupNotification?.count + 1
    await groupNotification.save()
  } else {
    const newGroup = {
      post: findPost?._id,
      user: postAuthor._id,
      type: 'downvote',
      count: 1
    }
    const group = new NotificationGroup(newGroup)
    await group.save()
  }

  res.sendResponse(updatedPost, null, statusCodes.OK)
}

export const tipPostAuthor = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  const { id } = req.params
  const findPost = await Post.findOne({
    postId: id,
  })

  if (!findPost)
    return res.sendResponse(
      null,
      { message: 'Post not found!' },
      statusCodes.NOT_FOUND
    )

  const findUser = await User.findById(req?.auth?.id)
  if (!findUser)
    return res.sendResponse(
      null,
      { message: 'User not found!' },
      statusCodes.NOT_FOUND
    )

  const postAuthor = await User.findById(findPost.userId)
  if (!postAuthor)
    return res.sendResponse(
      null,
      { message: 'Post author not found!' },
      statusCodes.NOT_FOUND
    )

  if (postAuthor._id.equals(findUser._id))
    return res.sendResponse(
      null,
      { message: 'Cannot tip yourself!' },
      statusCodes.NOT_FOUND
    )

  findUser.balance = Number(findUser.balance - 1)
  await findUser.save()

  postAuthor.balance = Number(postAuthor.balance + 1)
  await postAuthor?.save()

  // Check if the user has already tipped the post
  const userTip = findPost?.tips?.find(
    tip => tip.userId.toString() === req?.auth?.id.toString()
  )

  if (userTip && userTip.count) {
    userTip.count += 1
  } else {
    const tipObj: any = { userId: req?.auth?.id, count: 1 }
    if (!findPost.tips) {
      findPost.tips = [tipObj]
    } else {
      findPost?.tips.push(tipObj)
    }
  }
  await findPost.save()

  const groupNotification: any = await NotificationGroup.findOne({
    post: findPost?._id,
    type: 'tip'
  })

  if (groupNotification) {
    groupNotification.count = groupNotification?.count + 1
    await groupNotification.save()
  } else {
    const newGroup = {
      post: findPost?._id,
      user: postAuthor._id,
      type: 'tip',
      count: 1
    }
    const group = new NotificationGroup(newGroup)
    await group.save()
  }

  res.sendResponse(
    'Post author tipped successfully!',
    null,
    statusCodes.OK
  )
}

export const getPostID = async (req: Request, res: IResponse): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    return res.sendResponse(null, { message: 'Post id is required' }, statusCodes.NOT_FOUND);
  } else if (id.length !== 24) {
    return res.sendResponse(null, { message: 'Invalid id provided' }, statusCodes.BAD_REQUEST);
  }

  try {
    const postId = new mongoose.Types.ObjectId(id);
    const foundPost = await Post.findById(postId).select('postId permalink');

    if (!foundPost) {
      return res.sendResponse(null, { message: 'Post not found' }, statusCodes.NOT_FOUND);
    }

    res.sendResponse(foundPost, null, statusCodes.OK);
  } catch (e) {
    res.sendResponse(null, { message: 'Something went wrong' }, statusCodes.INTERNAL_SERVER_ERROR);
  }
}

export const getSinglePost = async (
  req: Request,
  res: IResponse
): Promise<void> => {
  const { id } = req.params

  const foundPost = await Post.findOne({ postId: id })

  if (foundPost) {
    const pipeline: mongoose.PipelineStage[] = [
      {
        $match: {
          postId: id
        }
      },
      {
        $sort: {
          createdAt: -1
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { userId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$userId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                username: 1,
                displayName: 1,
                reputation: 1,
                avatar: 1,
                userIdHash: 1,
                verified: 1
              }
            }
          ],
          as: 'userId'
        }
      },
      {
        $unwind: {
          path: '$userId',
          preserveNullAndEmptyArrays: true
        }
      }
    ]

    if (foundPost.repliedTo) {
      pipeline.push({
        $lookup: {
          from: 'posts',
          let: { repliedTo: '$repliedTo' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', { $toObjectId: '$$repliedTo' }]
                }
              }
            },
            {
              $lookup: {
                from: 'previews',
                let: { previewId: '$preview' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$_id', '$$previewId']
                      }
                    }
                  },
                  {
                    $project: {
                      _id: 1,
                      url: 1,
                      favicon: 1,
                      siteName: 1,
                      image: 1,
                      title: 1,
                      description: 1,
                      youtubeId: 1
                    }
                  }
                ],
                as: 'preview'
              }
            },
            {
              $unwind: {
                path: '$preview',
                preserveNullAndEmptyArrays: true
              }
            },
            {
              $lookup: {
                from: 'users',
                let: { userId: '$userId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ['$_id', { $toObjectId: '$$userId' }]
                      }
                    }
                  },
                  {
                    $project: {
                      username: 1,
                      displayName: 1,
                      reputation: 1,
                      avatar: 1,
                      userIdHash: 1,
                      verified: 1
                    }
                  }
                ],

                as: 'userId'
              }
            },
            {
              $unwind: {
                path: '$userId',
                preserveNullAndEmptyArrays: true
              }
            },
            {
              $project: {
                _id: 1,
                text: 1,
                title: 1,
                images: 1,
                repliedTo: 1,
                replies: 1,
                userId: 1,
                createdAt: 1,
                upvotes: 1,
                downvotes: 1,
                totalVotes: 1,
                postId: 1,
                permalink: 1,
                preview: 1
              }
            }
          ],
          as: 'repliedTo'
        }
      })
      pipeline.push({
        $unwind: {
          path: '$repliedTo'
        }
      })
    }

    if (foundPost.preview) {
      pipeline.push({
        $lookup: {
          from: 'previews',
          let: { previewId: '$preview' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$previewId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                url: 1,
                favicon: 1,
                siteName: 1,
                image: 1,
                title: 1,
                description: 1,
                youtubeId: 1
              }
            }
          ],
          as: 'preview'
        }
      })

      pipeline.push({
        $unwind: {
          path: '$preview',
          preserveNullAndEmptyArrays: true
        }
      })
    }

    pipeline.push({
      $project: {
        userId: 1,
        title: 1,
        text: 1,
        meta: 1,
        images: 1,
        createdAt: 1,
        upvotes: 1,
        downvotes: 1,
        totalVotes: 1,
        bookMarks: 1,
        replies: 1,
        repliedTo: 1,
        preview: 1,
        postId: 1,
        permalink: 1,
        tips: 1
      }
    })

    const singlePost = await Post.aggregate(pipeline)

    if (!singlePost || (singlePost && singlePost.length <= 0))
      return res.sendResponse(
        null,
        { message: 'Post not found!' },
        statusCodes.NOT_FOUND
      )

    res.sendResponse(singlePost[0], null, statusCodes.OK)
  } else {
    return res.sendResponse(
      null,
      { message: 'Post not found!' },
      statusCodes.NOT_FOUND
    )
  }
}

export const getPostReplies = async (
  req: Request,
  res: IResponse
) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.sendResponse(
        null,
        { message: 'Invalid post id was provided' },
        statusCodes.BAD_REQUEST
      )
    }

    const foundPost = await Post.findOne({ postId: id }).select('_id');

    if (!foundPost) {
      return res.sendResponse(null, { message: 'Post not found' }, statusCodes.BAD_REQUEST);
    }

    const replies = await Post.find({
      repliedTo: foundPost?._id,
    })
      .select(
        '_id userId title text preview createdAt upvotes downvotes postId permalink'
      )
      .populate([
        {
          path: 'preview'
        },
        {
          path: 'userId',
          select: '_id verified displayName userIdHash avatar'
        }
      ])

    res.sendResponse(replies, null, statusCodes.OK)
  } catch (e) {
    res.sendResponse(
      null,
      { message: (e as any).message || 'Something went wrong' },
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const bookMarkPost = async (req: Request, res: IResponse) => {
  const { id } = req.params

  const { userId } = req.body

  const findPost = await Post.findOne({
    postId: id
  }).lean()

  if (!findPost)
    return res.sendResponse(
      null,
      { message: 'Post not found!' },
      statusCodes.NOT_FOUND
    )

  const findUser = await User.findById(userId)
  if (!findUser)
    return res.sendResponse(
      null,
      { message: 'User not found!' },
      statusCodes.NOT_FOUND
    )

  const tempMarks =
    findPost && findPost.bookMarks
      ? findPost.bookMarks.map(item => `${item}`)
      : []

  const bookmarks = [...tempMarks]
  if (bookmarks && bookmarks.includes(userId)) {
    bookmarks.splice(
      bookmarks.findIndex(value => `${value}` === `${userId}`),
      1
    )
  } else {
    bookmarks.push(userId)
  }

  const updateQuery = {
    bookMarks: [...bookmarks]
  }

  const updatedPost = await Post.findByIdAndUpdate(findPost._id, updateQuery, {
    new: true
  })

  res.sendResponse(updatedPost, null, statusCodes.OK)
}

export const translatePost = async (req: Request, res: IResponse) => {
  const { id } = req.params

  const { langCode } = req.body

  const findPost = await Post.findOne({
    _id: id
  }).lean()

  if (!findPost)
    return res.sendResponse(
      null,
      { message: 'Post not found!' },
      statusCodes.NOT_FOUND
    )

  const result = {
    title: findPost.title
      ? await translateText(findPost.title, langCode, false)
      : '',
    text: findPost.text
      ? await translateText(findPost.text, langCode, true)
      : '',
    preTitle: (findPost.preview as any)?.title
      ? await translateText(
        (findPost.preview as any)?.title,
        langCode,
        false
      )
      : '',
    preDescription: (findPost.preview as any)?.description
      ? await translateText(
        (findPost.preview as any)?.description,
        langCode,
        true
      )
      : ''
  }
  res.sendResponse(result, null, statusCodes.OK)
}

async function removeOrUpdateSourcePost(
  previewId: mongoose.Types.ObjectId,
  postId: mongoose.Types.ObjectId,
  setOnly: boolean = false
) {
  try {
    const foundPreview = await Preview.findOne({
      _id: previewId
    }).select('sourcePost')

    if (!foundPreview) {
      return
    }

    if (!setOnly) {
      const oldestPostWithSamePreview = await Post.findOne({
        preview: new mongoose.Types.ObjectId(previewId),
        _id: {
          $ne: postId
        }
      })
        .limit(1)
        .sort({ createdAt: 1 })
        .select('_id')

      console.log('Oldest post: ', oldestPostWithSamePreview)

      if (!oldestPostWithSamePreview) {
        // if no post found, then remove the sourcepost
        console.log('Called unset')
        foundPreview.sourcePost = undefined
      } else if (
        oldestPostWithSamePreview._id.toString() !==
        foundPreview.sourcePost?.toString()
      ) {
        console.log('called update')
        foundPreview.sourcePost = oldestPostWithSamePreview._id
      }
    } else if (setOnly && !foundPreview.sourcePost) {
      foundPreview.sourcePost = postId
    }

    await foundPreview.save()
  } catch (e) {
    throw e
  }
}

export const isValidURL = (str: string) => {
  const regex = /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(?:\/.*)?$/
  return regex.test(str);
}

function getImageFiles(text?: string) {
  if (!text) {
    return [];
  }

  const parsedText = parse(text);
  const files = parsedText.querySelectorAll('div[data-file]').map((item) => item.getAttribute('data-url') || '');
  return files;
}

async function findPreview(url: string) {
  // console.log('Finding url: ', url)
  const foundPreview = await Preview.findOne({
    $or: [
      { url },
      {
        canonicals: {
          $in: [url]
        }
      }
    ]
  })
    .select('-__v')
    .populate({
      path: 'sourcePost',
      populate: [
        {
          path: 'userId',
          select: 'avatar displayName verified userIdHash'
        }
      ],
      select: 'userId createdAt -preview permalink postId'
    })

  return foundPreview;
}

function removeLinks(text: string) {
  return text.replaceAll(/(https?:\/\/[^\s]+)/g, '');
}

/**
 * This function uses regex to get first 50 or less characters and will try to get 
 * the full word if possible
 * @param text 
 * @returns 
 */
function getBoundedText(text: string) {
  const permalinkRegex = /^([\s\S]{1,50})(?:\X)?(?=\s|$)/;
  const regexMatch = text.match(permalinkRegex)?.[0];

  return regexMatch;
}

function cleanPermalink(text: string) {
  return text.toLowerCase().trim().replace(/[-`_~!@#$%^&*()\[\]{}\\|;:'",<.>\/?\n\r]/g, " ").trim().slice(0, 40).replace(/\s+/g, '-');
}