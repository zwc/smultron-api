#!/bin/bash

# Script to deploy secrets from .env to GitHub Actions
# Repository: https://github.com/zwc/smultron-api

set -e

REPO="zwc/smultron-api"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GitHub Actions Secrets Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}GitHub CLI (gh) is not installed.${NC}"
    echo "Install it with: brew install gh"
    echo "Then authenticate with: gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with GitHub CLI.${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

# Source the .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Error: .env file not found${NC}"
    exit 1
fi

source .env

echo -e "${GREEN}Deploying secrets to ${REPO}...${NC}"
echo ""

# Deploy AWS credentials
echo -e "${BLUE}→${NC} Setting AWS_ACCESS_KEY_ID..."
echo "$AWS_ACCESS_KEY_ID" | gh secret set AWS_ACCESS_KEY_ID --repo "$REPO"

echo -e "${BLUE}→${NC} Setting AWS_SECRET_ACCESS_KEY..."
echo "$AWS_SECRET_ACCESS_KEY" | gh secret set AWS_SECRET_ACCESS_KEY --repo "$REPO"

echo -e "${BLUE}→${NC} Setting AWS_REGION..."
echo "$AWS_REGION" | gh secret set AWS_REGION --repo "$REPO"

echo -e "${BLUE}→${NC} Setting HOSTED_ZONE_ID..."
echo "$HOSTED_ZONE_ID" | gh secret set HOSTED_ZONE_ID --repo "$REPO"

# Deploy admin credentials
echo -e "${BLUE}→${NC} Setting ADMIN_USERNAME..."
echo "$ADMIN_USERNAME" | gh secret set ADMIN_USERNAME --repo "$REPO"

echo -e "${BLUE}→${NC} Setting ADMIN_PASSWORD..."
echo "$ADMIN_PASSWORD" | gh secret set ADMIN_PASSWORD --repo "$REPO"

echo -e "${BLUE}→${NC} Setting JWT_SECRET..."
echo "$JWT_SECRET" | gh secret set JWT_SECRET --repo "$REPO"

# Optional: Deploy table names (these can also be derived from environment)
# Uncomment if you want to set them as secrets
# echo -e "${BLUE}→${NC} Setting PRODUCTS_TABLE..."
# echo "$PRODUCTS_TABLE" | gh secret set PRODUCTS_TABLE --repo "$REPO"

# echo -e "${BLUE}→${NC} Setting CATEGORIES_TABLE..."
# echo "$CATEGORIES_TABLE" | gh secret set CATEGORIES_TABLE --repo "$REPO"

# echo -e "${BLUE}→${NC} Setting ORDERS_TABLE..."
# echo "$ORDERS_TABLE" | gh secret set ORDERS_TABLE --repo "$REPO"

echo ""
echo -e "${GREEN}✅ All secrets deployed successfully!${NC}"
echo ""
echo -e "${BLUE}Verify secrets at:${NC}"
echo "https://github.com/${REPO}/settings/secrets/actions"
echo ""

# List all secrets
echo -e "${BLUE}Current secrets in repository:${NC}"
gh secret list --repo "$REPO"
