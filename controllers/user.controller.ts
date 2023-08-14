import { DecodedRequest, IResponse } from 'Types'
import { statusCodes } from 'constants/statusCodes'
import { Invite, Post, User } from 'models'
import mongoose, { Types } from 'mongoose'
import {
  fileDelete,
  fileUpload,
  isFileExists
} from 'utils/fileUpload'

// Update user profile data
export const updateProfile = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const { avatar, useremail, displayName } = req.body
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)

    const user = await User.findById(userId)
    if (!user) {
      return res.sendResponse(
        null,
        'User not found!',
        statusCodes.NOT_FOUND
      )
    }

    let imageUploaded
    if (avatar?.startsWith('data:')) {
      imageUploaded = await fileUpload(avatar)
      const existingFile = user.avatar

      if (
        existingFile &&
        !existingFile.includes('/static/') &&
        !existingFile.includes('/avatars/')
      ) {
        const fileUrl = existingFile.split('/')
        const fileName = `images/${fileUrl.pop()}`
        const isPreviousAvatarExists = await isFileExists(fileName)
        if (isPreviousAvatarExists) {
          await fileDelete(fileName)
        }
      }
    } else {
      imageUploaded = user.avatar
    }

    const data = {
      avatar: imageUploaded,
      displayName,
      useremail
    }
    const updatedUser = await User.findByIdAndUpdate(userId, data, {
      new: true
    })

    return res.sendResponse(
      { user: updatedUser, message: 'Profile Updated Successfully!' },
      null,
      statusCodes.OK
    )
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

// Get current logged in user
export const getCurrentUser = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)

    const user = await User.findById(userId).select('-password')
    if (!user) {
      return res.sendResponse(
        null,
        'User not found!',
        statusCodes.NOT_FOUND
      )
    }
    return res.sendResponse(user, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

// To verify other users, which current user have invited

export const verifyUser = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)
    const id = new mongoose.Types.ObjectId(req.body.id)

    const user = await User.findById(id).select('-password')
    if (!user) {
      return res.sendResponse(
        null,
        'User not found!',
        statusCodes.NOT_FOUND
      )
    }

    const loggedInUser = await User.findById(userId).select(
      '_id reputation'
    )
    if (!loggedInUser) {
      return res.sendResponse(
        null,
        'User not found!',
        statusCodes.NOT_FOUND
      )
    }

    const tempVerifiedByUsers =
      user && user.verifiedBy
        ? user.verifiedBy.map(item => `${item}`)
        : []

    const verifiedBy = [...tempVerifiedByUsers]
    let verificationReputation = user?.verificationReputation
      ? user?.verificationReputation
      : 0

    const userIdString: string = req?.auth?.id as string

    // If user has already verified this user and wants to unverify
    if (verifiedBy && verifiedBy.includes(userIdString)) {
      verifiedBy.splice(
        verifiedBy.findIndex(value => `${value}` === `${userId}`),
        1
      )
      verificationReputation -= loggedInUser.reputation

      // If user wants to verify this user
    } else {
      verificationReputation += loggedInUser.reputation

      verifiedBy.push(userIdString)
    }
    const updateQuery = {
      verifiedBy: [...verifiedBy],
      verificationReputation,
      verified: verificationReputation && verificationReputation >= 6
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      updateQuery,
      { new: true }
    )
    return res.sendResponse(updatedUser, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

// Get user stats i.e his upvotes, downvotes, tips etc
export const getUserStats = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)

    // given tips, upvotes, downvotes to other users posts + totalPosts of user
    const userStats = await Post.aggregate([
      {
        $match: {
          $or: [
            { userId },
            { bookMarks: userId },
            { upvotes: userId },
            { downvotes: userId }
          ]
        }
      },
      {
        $group: {
          _id: null,
          bookmarksCount: {
            $sum: {
              $cond: [{ $in: [userId, '$bookMarks'] }, 1, 0]
            }
          },
          givenUpvotesCount: {
            $sum: {
              $cond: [{ $in: [userId, '$upvotes'] }, 1, 0]
            }
          },
          givenDownvotesCount: {
            $sum: {
              $cond: [{ $in: [userId, '$downvotes'] }, 1, 0]
            }
          },
          totalPosts: {
            $sum: {
              $cond: [{ $eq: [userId, '$userId'] }, 1, 0]
            }
          }
        }
      }
    ])

    // Tips given to other users posts
    const tipsSpendings = await Post.aggregate([
      {
        $match: {
          'tips.userId': userId
        }
      },
      {
        $project: {
          tipsCount: {
            $reduce: {
              input: {
                $map: {
                  input: '$tips',
                  as: 'tip',
                  in: {
                    $cond: [
                      { $eq: ['$$tip.userId', userId] },
                      '$$tip.count',
                      0
                    ]
                  }
                }
              },
              initialValue: 0,
              in: { $add: ['$$value', '$$this'] }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          givenTipsCount: { $sum: '$tipsCount' }
        }
      }
    ])

    // upvotes, downvotes, tips on user's own post
    const votesOnOwnPosts: any = await Post.aggregate([
      {
        $match: {
          userId
        }
      },
      {
        $group: {
          _id: null,
          totalUpvotes: {
            $sum: { $size: '$upvotes' }
          },
          totalDownvotes: {
            $sum: { $size: '$downvotes' }
          },
          totalTips: {
            $sum: { $size: '$tips' }
          }
        }
      }
    ])

    const pendingInvitesCount = await Invite.countDocuments({
      inviteBy: userId,
      status: 'pending'
    })
    const registeredInvitesCount = await Invite.countDocuments({
      inviteBy: userId,
      status: 'registered'
    })

    return res.sendResponse(
      {
        ...userStats[0],
        ...tipsSpendings[0],
        ...votesOnOwnPosts[0],
        pendingInvitesCount,
        registeredInvitesCount
      },
      null,
      statusCodes.OK
    )
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

// Get user's upvoted, downvoted and bookmarked posts
export const getUserVotedPosts = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)
    const { postType, limit, page } = req.query

    let pipeline: mongoose.PipelineStage[] = [
      {
        $sort: {
          createdAt: -1
        }
      }
    ]

    let matchStage
    if (postType === 'Downvoted') {
      matchStage = {
        downvotes: userId
      }
    } else if (postType === 'Upvoted') {
      matchStage = {
        upvotes: userId
      }
    } else {
      matchStage = {
        bookMarks: userId
      }
    }
    pipeline = [
      {
        $match: matchStage
      },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
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
          createdAt: 1,
          downvotes: 1,
          upvotes: 1,
          images: 1,
          replies: 1,
          text: 1,
          title: 1,
          tips: 1,
          totalVotes: 1,
          postId: 1,
          permalink: 1,
          userId: {
            avatar: 1,
            displayName: 1,
            email: 1,
            reputation: 1,
            userIdHash: 1,
            username: 1,
            verified: 1,
            _id: 1
          },
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
    const posts = await Post.aggregate(pipeline)
    return res.sendResponse(posts, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

// Get user's spending and income
export const getUserSpendingsAndIncome = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)

    // get total income on your posts
    const incomePipeline: mongoose.PipelineStage[] = [
      {
        $match: {
          userId
        }
      },
      {
        $unwind: '$tips'
      },
      {
        $group: {
          _id: null,
          totalTips: {
            $sum: '$tips.count'
          }
        }
      }
    ]
    // Get total spendings on upvotes / downvotes / tips
    const spendingsPipeline: mongoose.PipelineStage[] = [
      {
        $facet: {
          tipsCount: [
            {
              $match: {
                'tips.userId': userId
              }
            },
            {
              $project: {
                tipsCount: {
                  $reduce: {
                    input: {
                      $map: {
                        input: '$tips',
                        as: 'tip',
                        in: {
                          $cond: [
                            { $eq: ['$$tip.userId', userId] },
                            '$$tip.count',
                            0
                          ]
                        }
                      }
                    },
                    initialValue: 0,
                    in: { $add: ['$$value', '$$this'] }
                  }
                }
              }
            },
            {
              $group: {
                _id: null,
                tipsCount: { $sum: '$tipsCount' }
              }
            }
          ],
          downvotesCount: [
            {
              $match: {
                downvotes: userId
              }
            },
            {
              $group: {
                _id: null,
                downvotesCount: {
                  $sum: {
                    $cond: [{ $in: [userId, '$downvotes'] }, 1, 0]
                  }
                }
              }
            }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalTipsCount: {
            $sum: { $arrayElemAt: ['$tipsCount.tipsCount', 0] }
          },
          totalDownvotesCount: {
            $sum: {
              $arrayElemAt: ['$downvotesCount.downvotesCount', 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalTipsCount: 1,
          totalDownvotesCount: 1
        }
      }
    ]

    const income = await Post.aggregate(incomePipeline)
    let totalIncome = 0
    if (income.length > 0) {
      totalIncome = income[0].totalTips
    }

    const spendings = await Post.aggregate(spendingsPipeline)
    const { totalTipsCount, totalDownvotesCount } = spendings[0]
    const totalSpendings =
      Number(totalTipsCount) + Number(totalDownvotesCount)

    return res.sendResponse(
      { totalIncome, totalSpendings },
      null,
      statusCodes.OK
    )
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

// Get users invited by current user
export const getInvitedUsers = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)

    const invites = await Invite.find({ inviteBy: userId })
      .sort({
        createdAt: -1
      })
      .lean()

    const updatedInvites = await Promise.all(
      invites.map(async invite => {
        if (invite.status === 'registered') {
          const user = await User.findOne({
            useremail: invite.useremail
          })
            .select('_id displayName userIdHash verified')
            .lean()
          return { ...invite, user }
        }
        return invite
      })
    )

    if (!updatedInvites) {
      return res.sendResponse(
        null,
        'No user found!',
        statusCodes.NOT_FOUND
      )
    }
    return res.sendResponse(updatedInvites, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

// Mark you post as introductory post
export const markPostAsIntroductoryPost = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)
    const { postId } = req.body

    if (!postId)
      return res.sendResponse(null, { message: 'Invalid post id was provided' }, statusCodes.BAD_REQUEST);

    const foundPost = await Post.findOne({ postId }).select('_id');

    if (!foundPost)
      return res.sendResponse(null, { message: 'Post not fount' }, statusCodes.BAD_REQUEST);

    const user = await User.findById(userId).select('_id')
    if (!user) {
      return res.sendResponse(
        null,
        'User not found!',
        statusCodes.NOT_FOUND
      )
    }
    await User.findByIdAndUpdate(
      userId,
      { introductoryPost: foundPost._id },
      { new: true }
    )
    return res.sendResponse(
      'Introductory post added!',
      null,
      statusCodes.OK
    )
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

// Update language preferences
export const setLanguagesPreference = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)
    const { language, preferedLanguages } = req.body

    const user = await User.findById(userId).select('_id')
    if (!user) {
      return res.sendResponse(
        null,
        'User not found!',
        statusCodes.NOT_FOUND
      )
    }
    await User.findByIdAndUpdate(
      userId,
      { language, preferedLanguages },
      { new: true }
    )
    res.sendResponse('Langauges Updated!', null, statusCodes.OK)
  } catch (error: any) {
    res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

// PATCH: Update hasNewNotifications
export const notificationUpdate = async (
  req: DecodedRequest,
  res: IResponse
): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req?.auth?.id)

    const user = await User.findById(userId).select('_id')
    if (!user) {
      return res.sendResponse(
        null,
        'User not found!',
        statusCodes.NOT_FOUND
      )
    }
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { hasNewNotifications: false },
      { new: true }
    ).select('-password')
    return res.sendResponse(updatedUser, null, statusCodes.OK)
  } catch (error: any) {
    return res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}

export const getPublicProfile = async (
  req: any,
  res: IResponse
): Promise<void> => {
  const { id } = req.params

  if (!id || typeof id !== 'string') {
    return res.sendResponse(
      null,
      { message: 'User id not provided' },
      statusCodes.BAD_REQUEST
    )
  }

  try {
    const foundUser = await User.findOne(
      { _id: new Types.ObjectId(id) },
      {
        _id: 1,
        avatar: 1,
        displayName: 1,
        userIdHash: 1,
        verified: 1,
        reputation: 1,
        introductoryPost: 1,
        verifiedBy: 1,
        verificationReputation: 1
      }
    ).populate('introductoryPost')

    if (!foundUser) {
      return res.sendResponse(
        null,
        { message: 'User not found' },
        statusCodes.BAD_REQUEST
      )
    }

    const data = await Post.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(id)
        }
      },
      {
        $group: {
          _id: null,
          totalPosts: {
            $sum: 1
          },
          totalUpvotes: {
            $sum: {
              $size: '$upvotes'
            }
          },
          totalDownvotes: {
            $sum: {
              $size: '$downvotes'
            }
          }
        }
      },
      {
        $project: {
          _id: 0
        }
      }
    ])

    return res.sendResponse(
      {
        user: foundUser,
        ...data[0]
      },
      null,
      statusCodes.OK
    )
  } catch (e) {
    return res.sendResponse(
      null,
      e,
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getUserPosts = async (
  req: any,
  res: IResponse
): Promise<void> => {
  const { id } = req.params

  if (!id || typeof id !== 'string') {
    return res.sendResponse(
      null,
      { message: 'User id not provided' },
      statusCodes.BAD_REQUEST
    )
  }

  const userId: string = id as string

  try {
    const { perPage, page } = req.query
    const paginate =
      perPage && page
        ? [
          {
            $skip: (Number(page) - 1) * Number(perPage)
          },
          {
            $limit: Number(perPage)
          }
        ]
        : []

    const posts = await Post.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId)
        }
      },
      {
        $sort: {
          createdAt: -1
        }
      },
      ...paginate,

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
      {
        $unwind: {
          path: '$preview',
          preserveNullAndEmptyArrays: true
        }
      },

      // User lookup
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
          _id: 1,
          userId: 1,
          text: 1,
          images: 1,
          replies: 1,
          upvotes: 1,
          downvotes: 1,
          tips: 1,
          totalVotes: 1,
          createdAt: 1,
          postId: 1,
          permalink: 1,
          preview: 1
        }
      }
    ])

    return res.sendResponse(posts, null, statusCodes.OK)
  } catch (e) {
    return res.sendResponse(
      null,
      e,
      statusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
