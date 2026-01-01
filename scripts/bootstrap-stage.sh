#!/bin/bash
# Bootstrap AWS CDK for smultron-stage environment
# Usage: ./scripts/bootstrap-stage.sh

set -e

# Load AWS credentials and region from .env.dev
if [ -f .env.dev ]; then
  source .env.dev
fi

if [ -z "$AWS_REGION" ]; then
  AWS_REGION="eu-north-1"
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "Could not determine AWS account ID. Check your credentials."
  exit 1
fi

# Bootstrap CDK for smultron-stage
cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION

echo "CDK bootstrap complete for smultron-stage ($AWS_ACCOUNT_ID, $AWS_REGION)"
