import { Configuration, OpenAIApi } from 'openai'
import { MetaData } from 'Types/interfaces'
import dotenv from 'dotenv'

dotenv.config()

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(configuration)

// generate topic from openai

export const generateTopic = async (
  description: string
): Promise<MetaData> => {
  const metadescription = `what are some relevant main unique one word tags and topics less than 10 related with this story, in multi English and innate languages(if it's different from English)? And what language codes of this story? This is the story.  \n${description.replace(
    /(\r\n|\n|\r)/gm,
    ''
  )}`
  let tempjson: MetaData = {
    tags: [],
    topics: [],
    languages: [],
    language_codes: []
  }
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: metadescription },
        {
          role: 'system',
          content: `Let's get response with only this json format. {"tags":[], "topics":[], "languages":[], "language_codes":[]}`
        }
      ]
    })
    tempjson = JSON.parse(
      response.data.choices[0].message!.content!.toString()
    )
  } catch (error) {
    console.log(error)
  }
  return tempjson
}

// translate post from openai

export const translateText = async (
  text?: string,
  langCode?: string,
  flag?: boolean
): Promise<string> => {
  let result = ''
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `Translate the following ${
            flag ? 'HTML' : ''
          } string into ${langCode}:\n\n${text}\n\nTranslation:`
        }
      ]
    })
    result = response.data.choices[0].message!.content as string
  } catch (error) {
    console.log(error)
  }
  return result
}
