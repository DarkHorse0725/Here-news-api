import cron from 'node-cron'
import { Post } from 'models'

// run every 6 mins
cron.schedule('*/6 * * * *', async () => {
  // eslint-disable-next-line no-console
  console.log('[CRON]: Calculating post reputation')

  await Post.updateMany(
    {
      $or: [
        { reputation: { $ne: 0 } },
        { lastUpvotesWeight: { $ne: 0 } },
        { lastDownvotesWeight: { $ne: 0 } }
      ]
    },
    [
      {
        $set: {
          // calculate reputation
          // [Formula] new reputation =
          //        (0.98 * old reputation) +
          //        (0.9 *
          //            (total weighted upvotes after last cron run - total weighted downvotes after last cron run)
          //        )
          reputation: {
            $cond: {
              if: {
                $or: [
                  {
                    $gt: ['$reputation', 0.01]
                  },
                  {
                    $ne: ['$lastUpvotesWeight', 0]
                  },
                  {
                    $ne: ['$lastDownvotesWeight', 0]
                  }
                ]
              },
              then: {
                $add: [
                  { $multiply: [0.998, '$reputation'] },
                  {
                    $multiply: [
                      0.9,
                      {
                        $subtract: [
                          '$lastUpvotesWeight',
                          '$lastDownvotesWeight'
                        ]
                      }
                    ]
                  }
                ]
              },
              else: 0
            }
          },
          // set the votes weight back to 0
          lastUpvotesWeight: 0,
          lastDownvotesWeight: 0
        }
      }
    ]
  )
})
