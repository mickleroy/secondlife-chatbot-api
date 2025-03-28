const cdk = require('aws-cdk-lib');
const { Template, Match } = require('aws-cdk-lib/assertions');
const { SecondlifeChatbotApiStack } = require('../lib/secondlife-chatbot-api-stack');

describe('SecondlifeChatbotApiStack', () => {
  let template;
  
  beforeEach(() => {
    const app = new cdk.App();
    const stack = new SecondlifeChatbotApiStack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });
    template = Template.fromStack(stack);
  });

  test('S3 Bucket Created with Correct Properties', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: [
          {
            ExpirationInDays: 10
          }
        ]
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            }
          }
        ]
      }
    });
  });

  test('SSM Parameter for Mistral API Key is Created', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/secondlife-chatbot/mistral-api-key',
      Description: 'API Key for Mistral AI',
      Type: 'String',
      Value: 'placeholder-replace-this-value'
    });
  });

  test('SSM Parameter for Preprompt is Created', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/secondlife-chatbot/preprompt',
      Description: 'Preprompt for the chatbot',
      Type: 'String',
      Value: 'placeholder-replace-this-value'
    });
  });

  test('API Gateway REST API is Created', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'Second Life Chat API'
    });
  });

  test('POST Method is Added to API Gateway with API Key Required', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      ApiKeyRequired: true,
      AuthorizationType: 'NONE'
    });
  });

  test('Lambda Function is Created with Correct Environment Variables and Runtime', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs20.x',
      Environment: {
        Variables: {
          MISTRAL_API_KEY_PARAMETER: {
            'Ref': Match.anyValue()
          },
          CHAT_HISTORY_BUCKET: {
            'Ref': Match.anyValue()
          },
          PREPROMPT_PARAMETER: {
            'Ref': Match.anyValue()
          }
        }
      },
      Timeout: 10
    });
  });

  test('API Gateway API Key is Created', () => {
    template.hasResourceProperties('AWS::ApiGateway::ApiKey', {
      Name: 'SecondlifeChatbotApiKey',
      Description: 'API Key for the Secondlife Chatbot API',
      Enabled: true
    });
  });

  test('API Gateway Usage Plan is Created', () => {
    template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
      Description: 'Usage plan for the Secondlife Chatbot API',
      ApiStages: [
        {
          ApiId: {
            'Ref': Match.anyValue()
          },
          Stage: {
            'Ref': Match.anyValue()
          }
        }
      ]
    });
  });

  test('API Gateway Usage Plan Key is Created', () => {
    template.hasResourceProperties('AWS::ApiGateway::UsagePlanKey', {
      KeyType: 'API_KEY',
      UsagePlanId: {
        'Ref': Match.anyValue()
      },
      KeyId: {
        'Ref': Match.anyValue()
      }
    });
  });

  test('Resource Count Verification', () => {
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::SSM::Parameter', 2);
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.resourceCountIs('AWS::Lambda::Function', 1);
    template.resourceCountIs('AWS::ApiGateway::ApiKey', 1);
    template.resourceCountIs('AWS::ApiGateway::UsagePlan', 1);
  });
});
