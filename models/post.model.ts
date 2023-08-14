import {
  Schema,
  model,
  Query,
  Document,
  QueryOptions,
  Types
} from 'mongoose'

interface IPostQueryOptions extends QueryOptions {
  autoPopulateReplies?: boolean
}

interface TipInterface {
  userId: Schema.Types.ObjectId
  count?: number
}
export interface PostInterface {
  userId: {
    type: Schema.Types.ObjectId
    ref: 'User'
  }
  title?: string
  text?: string
  meta?: {
    tags: string[]
    topics: string[]
    languages: string[]
    languageCodes: string[]
  }
  images?: string[]
  totalReplies?: number
  repliedTo?: {
    type: Schema.Types.ObjectId
    ref: 'Post'
  }
  replies?: {
    type: Schema.Types.ObjectId
    ref: 'Post'
  }[]
  upvotes?: {
    type: Schema.Types.ObjectId
    ref: 'User'
  }[]
  downvotes?: {
    type: Schema.Types.ObjectId
    ref: 'User'
  }[]
  tips?: TipInterface[]
  totalVotes?: number
  bookMarks?: {
    type: Schema.Types.ObjectId
    ref: 'User'
  }[]
  preview?: Types.ObjectId
  postId: string
  permalink: string
  createdAt?: Date
  updatedAt?: Date
  // these fields are used by/for post ranking
  reputation: number
  lastUpvotesWeight: number
  lastDownvotesWeight: number
}

const PostSchema = new Schema<PostInterface>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  title: String,
  text: String,
  meta: {
    tags: [String],
    topics: [String],
    languages: [String],
    languageCodes: [String]
  },
  images: [String],
  totalReplies: Number,
  repliedTo: {
    type: Schema.Types.ObjectId,
    ref: 'Post'
  },
  replies: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Post'
    }
  ],
  upvotes: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  downvotes: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  tips: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      count: {
        type: Number,
        default: 0
      }
    }
  ],
  totalVotes: {
    type: Number,
    default: 0
  },
  bookMarks: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  preview: {
    type: Schema.Types.ObjectId,
    ref: 'Preview'
  },
  postId: String,
  permalink: String,
  createdAt: Date,
  updatedAt: Date,
  // these fields are used by/for post ranking
  reputation: { type: Schema.Types.Number, default: 0 },
  lastUpvotesWeight: { type: Schema.Types.Number, default: 0 },
  lastDownvotesWeight: { type: Schema.Types.Number, default: 0 }
})

function autoPopulateReplies(
  this: Query<any, Document>,
  next: () => void
) {
  const options = this.getOptions()
  this.populate([
    {
      path: 'replies',
      options
    },
    {
      path: 'userId',
      select:
        '_id username displayName reputation avatar userIdHash verified',
      options
    }
  ])
  next()
}

function autoPopulatePreviews(
  this: Query<any, Document>,
  next: () => void
) {
  const options = this.getOptions()
  this.populate([
    {
      path: 'preview',
      options
    }
  ])
  next()
}

PostSchema.pre<Query<any, Document, {}, IPostQueryOptions>>(
  'find',
  function (
    this: Query<any, Document, {}, IPostQueryOptions>,
    next: () => void
  ) {
    // Populating previews by default
    autoPopulatePreviews.call(this, next)

    if (this.getOptions().autoPopulateReplies) {
      autoPopulateReplies.call(this, next)
    } else {
      next()
    }
  }
)

const Post = model<PostInterface>('Post', PostSchema)

export { Post }
