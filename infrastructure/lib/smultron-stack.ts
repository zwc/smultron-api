import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface SmultronStackProps extends cdk.StackProps {
  environment: string;
  certificateArn: string;
  domainName: string;
}

export class SmultronStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SmultronStackProps) {
    super(scope, id, props);

    const { environment, certificateArn, domainName } = props;

    // Environment variables from context or process.env
    const adminUsername = this.node.tryGetContext('adminUsername') || process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = this.node.tryGetContext('adminPassword') || process.env.ADMIN_PASSWORD;
    const jwtSecret = this.node.tryGetContext('jwtSecret') || process.env.JWT_SECRET;
    const hostedZoneId = this.node.tryGetContext('hostedZoneId') || process.env.HOSTED_ZONE_ID;

    if (!adminPassword || !jwtSecret) {
      throw new Error('ADMIN_PASSWORD and JWT_SECRET must be provided via context or environment variables');
    }

    // Determine the subdomain based on environment
    // prod uses the root domain, stage uses stage subdomain
    const subdomainName = environment === 'prod' ? domainName : `${environment}.${domainName}`;

    // DynamoDB Tables
    const productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName: `smultron-products-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for filtering products by status
    productsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const categoriesTable = new dynamodb.Table(this, 'CategoriesTable', {
      tableName: `smultron-categories-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for filtering categories by status
    categoriesTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'index', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const ordersTable = new dynamodb.Table(this, 'OrdersTable', {
      tableName: `smultron-orders-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Common Lambda environment variables
    // Note: AWS_REGION is automatically set by Lambda runtime
    const commonEnv: Record<string, string> = {
      PRODUCTS_TABLE: productsTable.tableName,
      CATEGORIES_TABLE: categoriesTable.tableName,
      ORDERS_TABLE: ordersTable.tableName,
      ADMIN_USERNAME: adminUsername,
      ADMIN_PASSWORD: adminPassword,
      JWT_SECRET: jwtSecret,
      ENVIRONMENT: environment,
      // Slack webhook for error notifications (optional)
      SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || '',
    };

    // Feature flag: Disable auth for dev environment if DISABLE_AUTH env var is set
    const disableAuth = process.env.DISABLE_AUTH || 'false';
    if (environment === 'dev' && disableAuth === 'true') {
      commonEnv.DISABLE_AUTH = 'true';
      console.warn('⚠️  DISABLE_AUTH is enabled for dev environment - Authentication will be bypassed!');
    }

    // Common Lambda props
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: commonEnv,
      architecture: lambda.Architecture.ARM_64, // Use ARM for better performance and lower cost
    };

    // Lambda code - use pre-built dist folder
    // Run 'bun run build' before deploying
    // Path is relative to where cdk command is run (project root)
    const lambdaCode = lambda.Code.fromAsset('dist');

    // Lambda Functions
    const loginFunction = new lambda.Function(this, 'LoginFunction', {
      ...commonLambdaProps,
      functionName: `smultron-login-${environment}`,
      code: lambdaCode,
      handler: 'index.login',
    });

    const listCatalogFunction = new lambda.Function(this, 'ListCatalogFunction', {
      ...commonLambdaProps,
      functionName: `smultron-list-catalog-${environment}`,
      code: lambdaCode,
      handler: 'index.listCatalog',
    });
    productsTable.grantReadData(listCatalogFunction);
    categoriesTable.grantReadData(listCatalogFunction);

    const listProductsFunction = new lambda.Function(this, 'ListProductsFunction', {
      ...commonLambdaProps,
      functionName: `smultron-list-products-${environment}`,
      code: lambdaCode,
      handler: 'index.listProducts',
    });
    productsTable.grantReadData(listProductsFunction);

    const getProductFunction = new lambda.Function(this, 'GetProductFunction', {
      ...commonLambdaProps,
      functionName: `smultron-get-product-${environment}`,
      code: lambdaCode,
      handler: 'index.getProduct',
    });
    productsTable.grantReadData(getProductFunction);
    categoriesTable.grantReadData(getProductFunction);

    const createProductFunction = new lambda.Function(this, 'CreateProductFunction', {
      ...commonLambdaProps,
      functionName: `smultron-create-product-${environment}`,
      code: lambdaCode,
      handler: 'index.createProduct',
    });
    productsTable.grantWriteData(createProductFunction);

    const updateProductFunction = new lambda.Function(this, 'UpdateProductFunction', {
      ...commonLambdaProps,
      functionName: `smultron-update-product-${environment}`,
      code: lambdaCode,
      handler: 'index.updateProduct',
    });
    productsTable.grantReadWriteData(updateProductFunction);

    const deleteProductFunction = new lambda.Function(this, 'DeleteProductFunction', {
      ...commonLambdaProps,
      functionName: `smultron-delete-product-${environment}`,
      code: lambdaCode,
      handler: 'index.deleteProduct',
    });
    productsTable.grantReadWriteData(deleteProductFunction);

    const adminListProductsFunction = new lambda.Function(this, 'AdminListProductsFunction', {
      ...commonLambdaProps,
      functionName: `smultron-admin-list-products-${environment}`,
      code: lambdaCode,
      handler: 'index.adminListProducts',
    });
    productsTable.grantReadData(adminListProductsFunction);
    categoriesTable.grantReadData(adminListProductsFunction);

    const adminUpdateProductIndexesFunction = new lambda.Function(this, 'AdminUpdateProductIndexesFunction', {
      ...commonLambdaProps,
      functionName: `smultron-admin-update-product-indexes-${environment}`,
      code: lambdaCode,
      handler: 'index.adminUpdateProductIndexes',
    });
    productsTable.grantReadWriteData(adminUpdateProductIndexesFunction);

    const listCategoriesFunction = new lambda.Function(this, 'ListCategoriesFunction', {
      ...commonLambdaProps,
      functionName: `smultron-list-categories-${environment}`,
      code: lambdaCode,
      handler: 'index.listCategories',
    });
    categoriesTable.grantReadData(listCategoriesFunction);

    const getCategoryFunction = new lambda.Function(this, 'GetCategoryFunction', {
      ...commonLambdaProps,
      functionName: `smultron-get-category-${environment}`,
      code: lambdaCode,
      handler: 'index.getCategory',
    });
    categoriesTable.grantReadData(getCategoryFunction);

    const createCategoryFunction = new lambda.Function(this, 'CreateCategoryFunction', {
      ...commonLambdaProps,
      functionName: `smultron-create-category-${environment}`,
      code: lambdaCode,
      handler: 'index.createCategory',
    });
    categoriesTable.grantWriteData(createCategoryFunction);

    const updateCategoryFunction = new lambda.Function(this, 'UpdateCategoryFunction', {
      ...commonLambdaProps,
      functionName: `smultron-update-category-${environment}`,
      code: lambdaCode,
      handler: 'index.updateCategory',
    });
    categoriesTable.grantReadWriteData(updateCategoryFunction);

    const deleteCategoryFunction = new lambda.Function(this, 'DeleteCategoryFunction', {
      ...commonLambdaProps,
      functionName: `smultron-delete-category-${environment}`,
      code: lambdaCode,
      handler: 'index.deleteCategory',
    });
    categoriesTable.grantReadWriteData(deleteCategoryFunction);

    const adminUpdateCategoryIndexesFunction = new lambda.Function(this, 'AdminUpdateCategoryIndexesFunction', {
      ...commonLambdaProps,
      functionName: `smultron-admin-update-category-indexes-${environment}`,
      code: lambdaCode,
      handler: 'index.adminUpdateCategoryIndexes',
    });
    categoriesTable.grantReadWriteData(adminUpdateCategoryIndexesFunction);

    const createOrderFunction = new lambda.Function(this, 'CreateOrderFunction', {
      ...commonLambdaProps,
      functionName: `smultron-create-order-${environment}`,
      code: lambdaCode,
      handler: 'index.createOrder',
    });
    ordersTable.grantReadWriteData(createOrderFunction); // Need read access to generate order numbers
    productsTable.grantReadWriteData(createOrderFunction); // Need write access to update stock

    const listOrdersFunction = new lambda.Function(this, 'ListOrdersFunction', {
      ...commonLambdaProps,
      functionName: `smultron-list-orders-${environment}`,
      code: lambdaCode,
      handler: 'index.listOrders',
    });
    ordersTable.grantReadData(listOrdersFunction);

    const getOrderFunction = new lambda.Function(this, 'GetOrderFunction', {
      ...commonLambdaProps,
      functionName: `smultron-get-order-${environment}`,
      code: lambdaCode,
      handler: 'index.getOrder',
    });
    ordersTable.grantReadData(getOrderFunction);

    const updateOrderStatusFunction = new lambda.Function(this, 'UpdateOrderStatusFunction', {
      ...commonLambdaProps,
      functionName: `smultron-update-order-status-${environment}`,
      code: lambdaCode,
      handler: 'index.updateOrderStatus',
    });
    
    // Ping error function - used to generate an intentional 500 for testing alerts
    const pingErrorFunction = new lambda.Function(this, 'PingErrorFunction', {
      ...commonLambdaProps,
      functionName: `smultron-ping-error-${environment}`,
      code: lambdaCode,
      handler: 'index.pingError',
    });
    ordersTable.grantReadWriteData(updateOrderStatusFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'SmultronApi', {
      restApiName: `smultron-api-${environment}`,
      description: `Smultron E-commerce API - ${environment}`,
      endpointConfiguration: { types: [apigateway.EndpointType.REGIONAL] },
      deployOptions: {
        stageName: 'api',
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // API Routes - directly under root since stage is 'api'
    const v1 = api.root.addResource('v1');

    // Auth routes
    const auth = v1.addResource('auth');
    auth.addResource('login').addMethod('POST', new apigateway.LambdaIntegration(loginFunction));

    // Admin routes
    const admin = v1.addResource('admin');
    const adminProducts = admin.addResource('products');
    adminProducts.addMethod('GET', new apigateway.LambdaIntegration(adminListProductsFunction));
    adminProducts.addMethod('POST', new apigateway.LambdaIntegration(createProductFunction));
    
    const adminProductIndexes = adminProducts.addResource('indexes');
    adminProductIndexes.addMethod('PATCH', new apigateway.LambdaIntegration(adminUpdateProductIndexesFunction));
    
    const adminProduct = adminProducts.addResource('{id}');
    adminProduct.addMethod('GET', new apigateway.LambdaIntegration(getProductFunction));
    adminProduct.addMethod('PUT', new apigateway.LambdaIntegration(updateProductFunction));
    adminProduct.addMethod('DELETE', new apigateway.LambdaIntegration(deleteProductFunction));

    const adminCategories = admin.addResource('categories');
    adminCategories.addMethod('GET', new apigateway.LambdaIntegration(listCategoriesFunction));
    adminCategories.addMethod('POST', new apigateway.LambdaIntegration(createCategoryFunction));
    
    const adminCategoryIndexes = adminCategories.addResource('indexes');
    adminCategoryIndexes.addMethod('PATCH', new apigateway.LambdaIntegration(adminUpdateCategoryIndexesFunction));
    
    const adminCategory = adminCategories.addResource('{id}');
    adminCategory.addMethod('GET', new apigateway.LambdaIntegration(getCategoryFunction));
    adminCategory.addMethod('PUT', new apigateway.LambdaIntegration(updateCategoryFunction));
    adminCategory.addMethod('DELETE', new apigateway.LambdaIntegration(deleteCategoryFunction));

    const adminOrders = admin.addResource('orders');
    adminOrders.addMethod('GET', new apigateway.LambdaIntegration(listOrdersFunction));
    
    const adminOrder = adminOrders.addResource('{id}');
    adminOrder.addMethod('GET', new apigateway.LambdaIntegration(getOrderFunction));
    
    const adminOrderStatus = adminOrder.addResource('status');
    adminOrderStatus.addMethod('PUT', new apigateway.LambdaIntegration(updateOrderStatusFunction));

    // Public Orders route (for order creation from the website)
    const orders = v1.addResource('orders');
    orders.addMethod('POST', new apigateway.LambdaIntegration(createOrderFunction));

  // Ping routes for health and error testing
  const ping = v1.addResource('ping');
  const pingError = ping.addResource('error');
  pingError.addMethod('GET', new apigateway.LambdaIntegration(pingErrorFunction));

    // Catalog route (combined categories and products)
    const catalog = v1.addResource('catalog');
    catalog.addMethod('GET', new apigateway.LambdaIntegration(listCatalogFunction));

    // CloudFront Distribution
    // Use AWS managed policies optimized for API Gateway
    // For dev environment, disable caching completely for faster iteration
    const cachePolicy = environment === 'dev' 
      ? cloudfront.CachePolicy.CACHING_DISABLED 
      : cloudfront.CachePolicy.CACHING_OPTIMIZED;
    const noCachePolicy = cloudfront.CachePolicy.CACHING_DISABLED;
    // Use ALL_VIEWER_EXCEPT_HOST_HEADER to avoid Host header conflicts with API Gateway
    const originRequestPolicy = cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER;

    // Import certificate from the CertificateStack (cross-region reference)
    // The certificate is created in us-east-1 by the CertificateStack
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'ImportedCertificate',
      certificateArn
    );

    // S3 bucket for documentation
    const docsBucket = new s3.Bucket(this, 'DocsBucket', {
      bucketName: `smultron-docs-${environment}-${this.account}`,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Create Origin Access Control for docs bucket
    const docsOac = new cloudfront.S3OriginAccessControl(this, 'DocsOAC', {
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    // API Gateway origin with /api path prefix
    const apiOrigin = new origins.RestApiOrigin(api, { originPath: '/api' });

    const distribution = new cloudfront.Distribution(this, 'SmultronDistribution', {
      comment: `Smultron API CloudFront Distribution - ${environment}`,
      defaultBehavior: {
        origin: apiOrigin,
        cachePolicy: noCachePolicy,
        originRequestPolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      additionalBehaviors: {
        // Swagger documentation from S3 - redirect /docs to /docs/
        '/docs': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(docsBucket, {
            originAccessControl: docsOac,
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          functionAssociations: [{
            function: new cloudfront.Function(this, 'DocsRedirectFunction', {
              code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  
  // Always redirect /docs to /docs/ (with trailing slash)
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      'location': { value: '/docs/' }
    }
  };
}
              `),
            }),
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
        // Swagger documentation from S3 - serve files and handle directory indexes
        '/docs/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(docsBucket, {
            originAccessControl: docsOac,
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          functionAssociations: [{
            function: new cloudfront.Function(this, 'DocsIndexFunction', {
              code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  
  // If URI ends with /, append index.html
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  }
  
  return request;
}
              `),
            }),
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
        // Admin endpoints - no caching, admin only
        '/v1/admin/*': {
          origin: apiOrigin,
          cachePolicy: noCachePolicy,
          originRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        // Auth endpoint - no caching
        '/v1/auth/*': {
          origin: apiOrigin,
          cachePolicy: noCachePolicy,
          originRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        // Catalog endpoint - public read-only, cache enabled
        '/v1/catalog': {
          origin: apiOrigin,
          cachePolicy,
          originRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        // Orders endpoint - no caching, admin only
        '/v1/orders': {
          origin: apiOrigin,
          cachePolicy: noCachePolicy,
          originRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        '/v1/orders/*': {
          origin: apiOrigin,
          cachePolicy: noCachePolicy,
          originRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      domainNames: [subdomainName],
      certificate,
    });

    // Grant CloudFront access to docs bucket
    docsBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [docsBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        },
      },
    }));

    // Route53 DNS record for CloudFront distribution
    if (hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId,
        zoneName: domainName,
      });

      new route53.ARecord(this, 'CloudFrontAliasRecord', {
        zone: hostedZone,
        recordName: subdomainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    }

    // Deploy documentation files to S3 with CloudFront cache invalidation
    new s3deploy.BucketDeployment(this, 'DeployDocs', {
      sources: [s3deploy.Source.asset('infrastructure', {
        exclude: ['bin', 'lib', 'node_modules', '*.sh', '*.ts'],
      })],
      destinationBucket: docsBucket,
      destinationKeyPrefix: 'docs',
      distribution,
      distributionPaths: ['/docs/*'],
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: `smultron-api-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
      exportName: `smultron-cloudfront-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'CustomDomainUrl', {
      value: `https://${subdomainName}`,
      description: 'Custom Domain URL',
      exportName: `smultron-custom-domain-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'DocsUrl', {
      value: `https://${subdomainName}/docs`,
      description: 'API Documentation URL (will redirect to /docs/index.html)',
      exportName: `smultron-docs-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'DocsBucketName', {
      value: docsBucket.bucketName,
      description: 'Documentation S3 Bucket Name',
      exportName: `smultron-docs-bucket-${environment}`,
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: `https://${subdomainName}/v1`,
      description: 'API v1 Endpoint (via CloudFront)',
      exportName: `smultron-api-endpoint-${environment}`,
    });

    new cdk.CfnOutput(this, 'ProductsTableName', {
      value: productsTable.tableName,
      description: 'Products DynamoDB Table Name',
      exportName: `smultron-products-table-${environment}`,
    });

    new cdk.CfnOutput(this, 'CategoriesTableName', {
      value: categoriesTable.tableName,
      description: 'Categories DynamoDB Table Name',
      exportName: `smultron-categories-table-${environment}`,
    });

    new cdk.CfnOutput(this, 'OrdersTableName', {
      value: ordersTable.tableName,
      description: 'Orders DynamoDB Table Name',
      exportName: `smultron-orders-table-${environment}`,
    });
  }
}
