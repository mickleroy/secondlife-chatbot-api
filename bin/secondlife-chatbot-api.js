#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { SecondlifeChatbotApiStack } = require('../lib/secondlife-chatbot-api-stack');

const app = new cdk.App();
new SecondlifeChatbotApiStack(app, 'SecondlifeChatbotApiStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});
