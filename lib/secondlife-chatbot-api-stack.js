const { Stack, Duration, RemovalPolicy } = require('aws-cdk-lib');
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const Lambda = require('aws-cdk-lib/aws-lambda');
const ssm = require('aws-cdk-lib/aws-ssm');
const s3 = require('aws-cdk-lib/aws-s3');
const path = require('path');

class SecondlifeChatbotApiStack extends Stack {

  constructor(scope, id, props) {
    super(scope, id, props);

    // Create an S3 bucket to store chat history
    const chatHistoryBucket = new s3.Bucket(this, 'ChatHistoryBucket', {
      bucketName: `secondlife-chat-history-${this.account}`, // Ensure uniqueness
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: Duration.days(10), // Optional: expire chats after 10 days
        }
      ],
      encryption: s3.BucketEncryption.S3_MANAGED, // Encrypt the contents
    });

    // Create a Parameter Store parameter for the Mistral API Key
    const mistralApiKey = new ssm.StringParameter(this, 'MistralApiKey', {
      parameterName: '/secondlife-chatbot/mistral-api-key',
      description: 'API Key for Mistral AI',
      tier: ssm.ParameterTier.STANDARD,
      stringValue: 'placeholder-replace-this-value', // Replace this in the AWS Console
    });

    // Create a Parameter Store parameter for preprompt
    const preprompt = new ssm.StringParameter(this, 'Preprompt', {
      parameterName: '/secondlife-chatbot/preprompt',
      description: 'Preprompt for the chatbot',
      tier: ssm.ParameterTier.STANDARD,
      stringValue: 'placeholder-replace-this-value', // Replace this in the AWS Console
    });

    // Create a REST API
    const apiGateway = new apigateway.RestApi(this, 'SecondLifeChatApi', {
      restApiName: 'Second Life Chat API',
    });

    // Create a Lambda function
    const lambdaFunction = new NodejsFunction(this, 'ChatbotFunction', {
      functionName: 'ChatbotFunction',
      runtime: Lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'functions', 'chatbot.js'),
      environment: {
        MISTRAL_API_KEY_PARAMETER: mistralApiKey.parameterName,
        CHAT_HISTORY_BUCKET: chatHistoryBucket.bucketName,
        PREPROMPT_PARAMETER: preprompt.parameterName
      },
      timeout: Duration.seconds(10)
    });

    // Grant the Lambda function permission to read the parameter and access the S3 bucket
    mistralApiKey.grantRead(lambdaFunction);
    preprompt.grantRead(lambdaFunction);
    chatHistoryBucket.grantReadWrite(lambdaFunction);

    const apiGatewayIntegration = new apigateway.LambdaIntegration(lambdaFunction);

    // Create an API key
    const apiKey = new apigateway.ApiKey(this, 'ChatbotApiKey', {
      apiKeyName: 'SecondlifeChatbotApiKey',
      description: 'API Key for the Secondlife Chatbot API',
      enabled: true,
    });

    // Create a usage plan
    const plan = new apigateway.UsagePlan(this, 'ChatbotUsagePlan', {
      name: 'ChatbotUsagePlan',
      description: 'Usage plan for the Secondlife Chatbot API',
      apiStages: [
        {
          api: apiGateway,
          stage: apiGateway.deploymentStage,
        },
      ],
      // Optional: Add throttling limits
      // throttle: {
      //   rateLimit: 10,
      //   burstLimit: 2
      // }
    });

    // Add the API key to the usage plan
    plan.addApiKey(apiKey);

    const method = apiGateway.root.addMethod('POST', apiGatewayIntegration, {
      apiKeyRequired: true
    });
  }
}

module.exports = { SecondlifeChatbotApiStack }
