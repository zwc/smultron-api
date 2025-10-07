#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SmultronStack } from '../lib/smultron-stack';

const app = new cdk.App();

// Get environment from context or default to 'stage'
const environment = app.node.tryGetContext('environment') || 'stage';

new SmultronStack(app, `SmultronStack-${environment}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  environment,
  stackName: `smultron-${environment}`,
  description: `Smultron E-commerce API - ${environment} environment`,
});

app.synth();
