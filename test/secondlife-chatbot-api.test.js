const cdk = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
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
    // Test that the S3 bucket exists and has the correct properties
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
      Type: 'String', // Default is String, SecureString would require additional configuration
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
            'Ref': expect.stringMatching(/MistralApiKey/)
          },
          CHAT_HISTORY_BUCKET: {
            'Ref': expect.stringMatching(/ChatHistoryBucket/)
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
      Name: 'ChatbotUsagePlan',
      Description: 'Usage plan for the Secondlife Chatbot API',
      ApiStages: [
        {
          ApiId: {
            'Ref': expect.stringMatching(/SecondLifeChatApi/)
          },
          Stage: {
            'Ref': expect.stringMatching(/.*Stage/)
          }
        }
      ]
    });
  });

  test('API Gateway Usage Plan Key is Created', () => {
    template.hasResourceProperties('AWS::ApiGateway::UsagePlanKey', {
      KeyType: 'API_KEY',
      UsagePlanId: {
        'Ref': expect.stringMatching(/ChatbotUsagePlan/)
      },
      KeyId: {
        'Ref': expect.stringMatching(/ChatbotApiKey/)
      }
    });
  });

  test('Lambda Function has Permissions to Access S3 Bucket', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: expect.arrayContaining([
          expect.objectContaining({
            Action: expect.arrayContaining([
              's3:GetObject*',
              's3:PutObject*'
            ]),
            Effect: 'Allow',
            Resource: {
              'Fn::Join': expect.arrayContaining([
                '',
                expect.arrayContaining([
                  expect.objectContaining({
                    'Ref': expect.stringMatching(/ChatHistoryBucket/)
                  })
                ])
              ])
            }
          })
        ])
      }
    });
  });

  test('Lambda Function has Permissions to Access SSM Parameter', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: expect.arrayContaining([
          expect.objectContaining({
            Action: expect.arrayContaining([
              'ssm:GetParameter*'
            ]),
            Effect: 'Allow',
            Resource: expect.stringMatching(/.*MistralApiKey.*/)
          })
        ])
      }
    });
  });

  test('Resource Count Verification', () => {
    // Verify that we have the expected number of resources of each type
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::SSM::Parameter', 1);
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.resourceCountIs('AWS::Lambda::Function', 1);
    template.resourceCountIs('AWS::ApiGateway::ApiKey', 1);
    template.resourceCountIs('AWS::ApiGateway::UsagePlan', 1);
  });
});
