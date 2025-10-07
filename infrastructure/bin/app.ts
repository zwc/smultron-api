#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SmultronStack } from '../lib/smultron-stack';
import { CertificateStack } from '../lib/certificate-stack';

const app = new cdk.App();

// Get configuration from context or environment variables
const environment = app.node.tryGetContext('environment') || 'stage';
const domainName = app.node.tryGetContext('domainName') || process.env.DOMAIN_NAME || 'smultron.zwc.se';
const hostedZoneId = app.node.tryGetContext('hostedZoneId') || process.env.HOSTED_ZONE_ID;
const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'eu-north-1';

// Create certificate stack in us-east-1 (required for CloudFront)
const certStack = new CertificateStack(app, `SmultronCertificate`, {
  env: {
    account: awsAccount,
    region: 'us-east-1', // CloudFront requires us-east-1
  },
  stackName: `smultron-certificate`,
  description: 'ACM Certificate for CloudFront (must be in us-east-1)',
  domainName,
  hostedZoneId,
  crossRegionReferences: true,
});

// Create main stack in the configured region
const mainStack = new SmultronStack(app, `SmultronStack-${environment}`, {
  env: {
    account: awsAccount,
    region: awsRegion,
  },
  environment,
  stackName: `smultron-${environment}`,
  description: `Smultron E-commerce API - ${environment} environment`,
  certificateArn: certStack.certificate.certificateArn,
  domainName,
  crossRegionReferences: true,
});

// Main stack depends on certificate stack
mainStack.addDependency(certStack);

app.synth();
