import { statusCodes } from 'constants/statusCodes'
import dotenv from 'dotenv'
import { Request } from 'express'
import { IResponse } from 'Types'

const { Configuration, OpenAIApi } = require('openai')

dotenv.config()

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(configuration)

export const getSuggestion = async (req: Request, res: IResponse) => {
  const { searchText } = req.body

  try {
    const completion = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `Give 5 keyword rich title suggestions for this text: ${searchText}\n`,
      temperature: 0.6,
      top_p: 1,
      max_tokens: 64,
      frequency_penalty: 0,
      presence_penalty: 0
    })

    let suggestions: string[] = []

    const openAIResponse: string =
      completion?.data?.choices?.[0]?.text

    if (openAIResponse) {
      suggestions = openAIResponse
        .split('\n') // convert text to string array
        .filter(Boolean) // remove nullish records
        .map((x: string) => x.slice(3)) // remove list numbering
    }

    res.sendResponse(suggestions, null, statusCodes.OK)
  } catch (error: any) {
    res.sendResponse(
      null,
      { message: error.message },
      statusCodes.BAD_REQUEST
    )
  }
}
