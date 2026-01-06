#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if environment is provided
ENVIRONMENT=${1:-stage}

if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "stage" && "$ENVIRONMENT" != "prod" ]]; then
  echo -e "${RED}Error: Environment must be 'dev', 'stage' or 'prod'${NC}"
  echo "Usage: ./deploy-cdk.sh [dev|stage|prod]"
  exit 1
fi

echo -e "${GREEN}🚀 Deploying Smultron API to ${ENVIRONMENT} environment${NC}"

# Prefer environment variables provided by CI (GitHub Actions) or caller.
# If required secrets are already present in the environment, skip loading .env files.
if [ -n "$ADMIN_PASSWORD" ] && [ -n "$JWT_SECRET" ]; then
  echo -e "${YELLOW}🔐 Using ADMIN_PASSWORD and JWT_SECRET from environment variables${NC}"
else
  # Load environment variables from .env or .env.{environment}
  # Check parent directory first (when running from infrastructure/)
  if [ -f ../.env.dev ] && [ "$ENVIRONMENT" == "dev" ]; then
    ENV_FILE="../.env.dev"
    echo -e "${YELLOW}📦 Loading environment variables from .env.dev${NC}"
  elif [ -f ../.env ]; then
    ENV_FILE="../.env"
    echo -e "${YELLOW}📦 Loading environment variables from .env${NC}"
  elif [ -f .env.dev ] && [ "$ENVIRONMENT" == "dev" ]; then
    ENV_FILE=".env.dev"
    echo -e "${YELLOW}📦 Loading environment variables from .env.dev${NC}"
  elif [ -f .env ]; then
    ENV_FILE=".env"
    echo -e "${YELLOW}📦 Loading environment variables from .env${NC}"
  else
    echo -e "${RED}Error: ADMIN_PASSWORD and JWT_SECRET not provided and .env file not found in current or parent directory${NC}"
    exit 1
  fi

  # Export variables from the env file; ignore comments and empty lines
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Validate required environment variables are set now
if [ -z "$ADMIN_PASSWORD" ] || [ -z "$JWT_SECRET" ]; then
  echo -e "${RED}Error: ADMIN_PASSWORD and JWT_SECRET must be set either as environment variables or in a .env file${NC}"
  exit 1
fi

# Run tests only for stage and prod deployments
if [[ "$ENVIRONMENT" != "dev" ]]; then
  echo -e "${YELLOW}🧪 Running tests${NC}"
  cd ..
  cd infrastructure
else
  echo -e "${YELLOW}⏭️  Skipping tests for dev environment${NC}"
fi

# Build the application
echo -e "${YELLOW}🔨 Building application${NC}"
(cd .. && bun run build)

# Change to root directory for CDK commands (cdk.json is there)
cd ..

# CDK Bootstrap (only needed once per account/region)
echo -e "${YELLOW}🔧 Checking CDK bootstrap${NC}"
npx cdk bootstrap

# Synthesize CDK template
echo -e "${YELLOW}📝 Synthesizing CDK template${NC}"
npx cdk synth --context environment=$ENVIRONMENT

# Deploy to AWS
echo -e "${YELLOW}☁️  Deploying to AWS${NC}"
npx cdk deploy \
  --context environment=$ENVIRONMENT \
  --context adminUsername=$ADMIN_USERNAME \
  --context adminPassword=$ADMIN_PASSWORD \
  --context jwtSecret=$JWT_SECRET \
  --context domainName=${DOMAIN_NAME:-smultron.zwc.se} \
  --context hostedZoneId=$HOSTED_ZONE_ID \
  --require-approval never \
  --all

echo -e "${GREEN}✅ Deployment to ${ENVIRONMENT} completed successfully!${NC}"

# Get stack outputs
echo -e "${YELLOW}📋 Stack Outputs:${NC}"
aws cloudformation describe-stacks \
  --stack-name smultron-$ENVIRONMENT \
  --query 'Stacks[0].Outputs' \
  --output table

# Invalidate CloudFront cache
echo -e "${YELLOW}🔄 Invalidating CloudFront cache${NC}"
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name smultron-$ENVIRONMENT \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
  aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --output table
  echo -e "${GREEN}✅ CloudFront cache invalidation created for distribution ${DISTRIBUTION_ID}${NC}"
else
  echo -e "${RED}⚠️  Could not find CloudFront Distribution ID, skipping cache invalidation${NC}"
fi
