#!/bin/bash

BUCKET_NAME="${DOCS_BUCKET:-smultron-docs}"
REGION="${AWS_REGION:-us-east-1}"

echo "Creating S3 bucket for documentation..."
aws s3 mb s3://$BUCKET_NAME --region $REGION 2>/dev/null || echo "Bucket already exists"

echo "Configuring bucket for static website hosting..."
aws s3 website s3://$BUCKET_NAME --index-document docs.html

echo "Setting bucket policy for public read..."
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///tmp/bucket-policy.json

echo "Uploading documentation files..."
# Generate OpenAPI from code (requires bun available in PATH)
if command -v bun >/dev/null 2>&1; then
  echo "Generating OpenAPI (bun run generate:openapi)..."
  (cd "$(dirname "$(dirname "$0")")" && bun run generate:openapi) || echo "Warning: generator failed"
fi

aws s3 cp infrastructure/docs.html s3://$BUCKET_NAME/docs.html --content-type "text/html"
aws s3 cp infrastructure/swagger.yaml s3://$BUCKET_NAME/swagger.yaml --content-type "text/yaml"

echo "Documentation deployed!"
echo "URL: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
