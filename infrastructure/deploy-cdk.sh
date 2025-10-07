#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if environment is provided
ENVIRONMENT=${1:-stage}

if [[ "$ENVIRONMENT" != "stage" && "$ENVIRONMENT" != "prod" ]]; then
  echo -e "${RED}Error: Environment must be 'stage' or 'prod'${NC}"
  echo "Usage: ./deploy-cdk.sh [stage|prod]"
  exit 1
fi

echo -e "${GREEN}🚀 Deploying Smultron API to ${ENVIRONMENT} environment${NC}"

# Load environment variables from .env
if [ -f .env ]; then
  echo -e "${YELLOW}📦 Loading environment variables from .env${NC}"
  export $(cat .env | grep -v '^#' | xargs)
else
  echo -e "${RED}Error: .env file not found${NC}"
  exit 1
fi

# Validate required environment variables
if [ -z "$ADMIN_PASSWORD" ] || [ -z "$JWT_SECRET" ]; then
  echo -e "${RED}Error: ADMIN_PASSWORD and JWT_SECRET must be set in .env${NC}"
  exit 1
fi

# Run tests
echo -e "${YELLOW}🧪 Running tests${NC}"
bun test

# Build the application
echo -e "${YELLOW}🔨 Building application${NC}"
bun run build

# CDK Bootstrap (only needed once per account/region)
echo -e "${YELLOW}🔧 Checking CDK bootstrap${NC}"
cdk bootstrap

# Synthesize CDK template
echo -e "${YELLOW}📝 Synthesizing CDK template${NC}"
cdk synth --context environment=$ENVIRONMENT

# Deploy to AWS
echo -e "${YELLOW}☁️  Deploying to AWS${NC}"
cdk deploy \
  --context environment=$ENVIRONMENT \
  --context adminUsername=$ADMIN_USERNAME \
  --context adminPassword=$ADMIN_PASSWORD \
  --context jwtSecret=$JWT_SECRET \
  --context domainName=${DOMAIN_NAME:-smultron.zwc.se} \
  --context certificateArn=$CERTIFICATE_ARN \
  --require-approval never

echo -e "${GREEN}✅ Deployment to ${ENVIRONMENT} completed successfully!${NC}"

# Get stack outputs
echo -e "${YELLOW}📋 Stack Outputs:${NC}"
aws cloudformation describe-stacks \
  --stack-name smultron-$ENVIRONMENT \
  --query 'Stacks[0].Outputs' \
  --output table
