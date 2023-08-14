import express from 'express'
import multer from 'multer'
import {
  createPost,
  createPostReply,
  downvotePost,
  getLinkDetails,
  getExplorePosts,
  getTrendingPosts,
  getPostID,
  getSinglePost,
  upvotePost,
  deletePost,
  editPost,
  getPostReplies,
  uploadToBucket,
  removeFromBucket,
  getSearchPosts,
  getExploreTopics,
  getPopularTopics,
  getAllTopics,
  getAllPostsByTopic,
  bookMarkPost,
  translatePost,
  getUserPosts,
  tipPostAuthor
} from 'controllers/post.controller'
import uploadGCP from 'middlewares/uploadPromisify'

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, `./public/images`)
  },
  filename: (req, file, cb) => {
    const regexMatch = file.originalname.match(/\..*$/)
    cb(
      null,
      `${file.fieldname}-${Date.now()}${regexMatch && regexMatch.length > 0 ? regexMatch[0] : '.jpg'
      }`
    )
  }
})

const upload = multer({
  storage,
  limits: { fieldSize: 25 * 1024 * 1024 }
})

const router = express.Router()

// router.route('/createPost').post(upload.any(), createPost)
router.route('/uploadFile').post(uploadGCP, uploadToBucket)
router.route('/removeFile').post(removeFromBucket)
router.route('/createPost').post(upload.any(), createPost)

router
  .route('/createPostReply/:postId')
  .post(upload.any(), createPostReply)

router.route('/editPost/:id').post(upload.any(), editPost)

router.route('/deletePost/:id').delete(deletePost)

router.route('/getExplorePosts').get(getExplorePosts)

router.route('/getUserPosts').get(getUserPosts)

router.route('/getSearchPosts').get(getSearchPosts)

router.route('/getTrendingPosts').get(getTrendingPosts)

router.route('/upvotePost/:id').post(upvotePost)

router.route('/downvotePost/:id').post(downvotePost)

router.route('/tipPostAuthor/:id').post(tipPostAuthor)

router.route('/getSinglePost/:id').get(getSinglePost)

router.route('/getPostID/:id').get(getPostID)

router.route('/getLinkDetails/:url').get(getLinkDetails)

router.route('/getPostReplies/:id').get(getPostReplies)

router.route('/getExploreTopics').get(getExploreTopics)

router.route('/getPopularTopics').get(getPopularTopics)

router.route('/getAllTopics').get(getAllTopics)

router.route('/getAllPostsByTopic').get(getAllPostsByTopic)

router.route('/bookMarkPost/:id').post(bookMarkPost)

router.route('/translatePost/:id').post(translatePost)

export default router
