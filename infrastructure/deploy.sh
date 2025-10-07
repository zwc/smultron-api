#!/bin/bash

if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

source .env

STACK_NAME="smultron-api"
CERTIFICATE_ARN="${CERTIFICATE_ARN:-}"

if [ -z "$CERTIFICATE_ARN" ]; then
    echo "Error: CERTIFICATE_ARN not set in .env"
    exit 1
fi

echo "Building application..."
bun run build

echo "Packaging SAM template..."
sam package \
    --template-file infrastructure/template.yaml \
    --output-template-file infrastructure/packaged.yaml \
    --s3-bucket ${S3_DEPLOYMENT_BUCKET:-smultron-deployment}

echo "Deploying stack..."
sam deploy \
    --template-file infrastructure/packaged.yaml \
    --stack-name $STACK_NAME \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        AdminUsername=$ADMIN_USERNAME \
        AdminPassword=$ADMIN_PASSWORD \
        JWTSecret=$JWT_SECRET \
        CertificateArn=$CERTIFICATE_ARN \
        DomainName=smultron.zwc.se

echo "Deployment complete!"
echo "Getting outputs..."
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs' \
    --output table
