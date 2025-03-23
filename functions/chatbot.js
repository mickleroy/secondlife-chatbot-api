import { Mistral } from "@mistralai/mistralai";
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require('uuid');

const ssmClient = new SSMClient();
const s3Client = new S3Client();
const MISTRAL_MODEL = "mistral-small-latest";
const mistral = new Mistral({
  apiKey: getMistralApiKey()
});

async function getMistralApiKey() {
  console.log('Getting Mistral API key from SSM');
  const command = new GetParameterCommand({
    Name: process.env.MISTRAL_API_KEY_PARAMETER,
    WithDecryption: true
  });

  const response = await ssmClient.send(command);
  return response.Parameter.Value;
}

async function getPreprompt() {
  console.log('Getting preprompt from SSM');
  const command = new GetParameterCommand({
    Name: process.env.PREPROMPT_PARAMETER,
    WithDecryption: true
  });

  const response = await ssmClient.send(command);
  return response.Parameter.Value;
}

async function getChatHistory(userId) {
  console.log('Getting chat history from S3');
  try {
    const key = `chats/${userId}/history.json`;

    const command = new GetObjectCommand({
      Bucket: process.env.CHAT_HISTORY_BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);
    const chatHistory = await streamToString(response.Body);
    return JSON.parse(chatHistory);
  } catch (error) {
    // If the file doesn't exist or any other error, start with an empty history
    console.log('No existing chat history found or error occurred:', error.message);
    return [];
  }
}

async function saveChatHistory(userId, history) {
  console.log('Saving chat history to S3');
  const key = `chats/${userId}/history.json`;

  const command = new PutObjectCommand({
    Bucket: process.env.CHAT_HISTORY_BUCKET,
    Key: key,
    Body: JSON.stringify(history),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * AWS Lambda handler function for processing chat messages.
 *
 * @param {Object} event - The event object containing the request data.
 * @param {string} event.body - The JSON stringified body containing the message and userId.
 * @returns {Promise<Object>} The response object containing the status code and response body.
 *
 * @property {string} event.body.message - The user's message to the chatbot.
 * @property {string} [event.body.userId] - The user's ID. If not provided, a new UUID will be generated.
 *
 * @throws {Error} If an error occurs during processing.
 */
export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const message = body.message;
    const userId = body.userId || uuidv4(); // Use provided ID or generate new one

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message is required' }),
      };
    }

    // Retrieve chat history from S3
    let chatHistory = await getChatHistory(userId);

    // If no chat history, add preprompt
    if (chatHistory.length === 0) {
      const preprompt = await getPreprompt();
      chatHistory.push({
        role: "system",
        content: preprompt
      });
    }

    // Add user's new message to history
    chatHistory.push({
      role: "user",
      content: message
    });

    // Keep only last 10 messages to avoid token limits
    // if (chatHistory.length > 10) {
    //   chatHistory = chatHistory.slice(-10);
    // }

    // Get response from Mistral with full chat history
    const result = await mistral.chat.complete({
      model: MISTRAL_MODEL,
      messages: chatHistory
    });

    const agentResponse = result.choices[0].message.content

    // Add assistant's response to history
    chatHistory.push({
      role: "assistant",
      content: agentResponse
    });

    // Save updated history back to S3
    await saveChatHistory(userId, chatHistory);

    return {
      statusCode: 200,
      body: JSON.stringify({
        userId,
        response: agentResponse
      })
    };
  } catch (error) {
    console.error(JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};