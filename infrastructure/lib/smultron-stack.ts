import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

interface SmultronStackProps extends cdk.StackProps {
  environment: string;
}

export class SmultronStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SmultronStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // Environment variables from context or process.env
    const adminUsername = this.node.tryGetContext('adminUsername') || process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = this.node.tryGetContext('adminPassword') || process.env.ADMIN_PASSWORD;
    const jwtSecret = this.node.tryGetContext('jwtSecret') || process.env.JWT_SECRET;
    const domainName = this.node.tryGetContext('domainName') || process.env.DOMAIN_NAME || 'smultron.zwc.se';
    const certificateArn = this.node.tryGetContext('certificateArn') || process.env.CERTIFICATE_ARN;

    if (!adminPassword || !jwtSecret) {
      throw new Error('ADMIN_PASSWORD and JWT_SECRET must be provided via context or environment variables');
    }

    // DynamoDB Tables
    const productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName: `smultron-products-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const categoriesTable = new dynamodb.Table(this, 'CategoriesTable', {
      tableName: `smultron-categories-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const ordersTable = new dynamodb.Table(this, 'OrdersTable', {
      tableName: `smultron-orders-${environment}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Common Lambda environment variables
    // Note: AWS_REGION is automatically set by Lambda runtime
    const commonEnv = {
      PRODUCTS_TABLE: productsTable.tableName,
      CATEGORIES_TABLE: categoriesTable.tableName,
      ORDERS_TABLE: ordersTable.tableName,
      ADMIN_USERNAME: adminUsername,
      ADMIN_PASSWORD: adminPassword,
      JWT_SECRET: jwtSecret,
      ENVIRONMENT: environment,
    };

    // Common Lambda props
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: commonEnv,
    };

    // Common bundling configuration
    const bundlingConfig = {
      image: lambda.Runtime.NODEJS_20_X.bundlingImage,
      command: [
        'bash', '-c',
        'npm install -g bun && bun install && bun build index.ts --outdir /asset-output --target node --format esm'
      ],
    };

    // Lambda Functions
    const loginFunction = new lambda.Function(this, 'LoginFunction', {
      ...commonLambdaProps,
      functionName: `smultron-login-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.login',
    });

    const listProductsFunction = new lambda.Function(this, 'ListProductsFunction', {
      ...commonLambdaProps,
      functionName: `smultron-list-products-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.listProducts',
    });
    productsTable.grantReadData(listProductsFunction);

    const getProductFunction = new lambda.Function(this, 'GetProductFunction', {
      ...commonLambdaProps,
      functionName: `smultron-get-product-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.getProduct',
    });
    productsTable.grantReadData(getProductFunction);

    const createProductFunction = new lambda.Function(this, 'CreateProductFunction', {
      ...commonLambdaProps,
      functionName: `smultron-create-product-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.createProduct',
    });
    productsTable.grantWriteData(createProductFunction);

    const updateProductFunction = new lambda.Function(this, 'UpdateProductFunction', {
      ...commonLambdaProps,
      functionName: `smultron-update-product-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.updateProduct',
    });
    productsTable.grantReadWriteData(updateProductFunction);

    const deleteProductFunction = new lambda.Function(this, 'DeleteProductFunction', {
      ...commonLambdaProps,
      functionName: `smultron-delete-product-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.deleteProduct',
    });
    productsTable.grantReadWriteData(deleteProductFunction);

    const listCategoriesFunction = new lambda.Function(this, 'ListCategoriesFunction', {
      ...commonLambdaProps,
      functionName: `smultron-list-categories-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.listCategories',
    });
    categoriesTable.grantReadData(listCategoriesFunction);

    const getCategoryFunction = new lambda.Function(this, 'GetCategoryFunction', {
      ...commonLambdaProps,
      functionName: `smultron-get-category-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.getCategory',
    });
    categoriesTable.grantReadData(getCategoryFunction);

    const createCategoryFunction = new lambda.Function(this, 'CreateCategoryFunction', {
      ...commonLambdaProps,
      functionName: `smultron-create-category-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.createCategory',
    });
    categoriesTable.grantWriteData(createCategoryFunction);

    const updateCategoryFunction = new lambda.Function(this, 'UpdateCategoryFunction', {
      ...commonLambdaProps,
      functionName: `smultron-update-category-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.updateCategory',
    });
    categoriesTable.grantReadWriteData(updateCategoryFunction);

    const deleteCategoryFunction = new lambda.Function(this, 'DeleteCategoryFunction', {
      ...commonLambdaProps,
      functionName: `smultron-delete-category-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.deleteCategory',
    });
    categoriesTable.grantReadWriteData(deleteCategoryFunction);

    const createOrderFunction = new lambda.Function(this, 'CreateOrderFunction', {
      ...commonLambdaProps,
      functionName: `smultron-create-order-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.createOrder',
    });
    ordersTable.grantWriteData(createOrderFunction);
    productsTable.grantReadData(createOrderFunction);

    const listOrdersFunction = new lambda.Function(this, 'ListOrdersFunction', {
      ...commonLambdaProps,
      functionName: `smultron-list-orders-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.listOrders',
    });
    ordersTable.grantReadData(listOrdersFunction);

    const getOrderFunction = new lambda.Function(this, 'GetOrderFunction', {
      ...commonLambdaProps,
      functionName: `smultron-get-order-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.getOrder',
    });
    ordersTable.grantReadData(getOrderFunction);

    const updateOrderStatusFunction = new lambda.Function(this, 'UpdateOrderStatusFunction', {
      ...commonLambdaProps,
      functionName: `smultron-update-order-status-${environment}`,
      code: lambda.Code.fromAsset('../', { bundling: bundlingConfig }),
      handler: 'index.updateOrderStatus',
    });
    ordersTable.grantReadWriteData(updateOrderStatusFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'SmultronApi', {
      restApiName: `smultron-api-${environment}`,
      description: `Smultron E-commerce API - ${environment}`,
      deployOptions: {
        stageName: 'v1',
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // API Routes
    const apiV1 = api.root.addResource('api').addResource('v1');

    // Auth routes
    const auth = apiV1.addResource('auth');
    auth.addResource('login').addMethod('POST', new apigateway.LambdaIntegration(loginFunction));

    // Products routes
    const products = apiV1.addResource('products');
    products.addMethod('GET', new apigateway.LambdaIntegration(listProductsFunction));
    products.addMethod('POST', new apigateway.LambdaIntegration(createProductFunction));
    
    const product = products.addResource('{id}');
    product.addMethod('GET', new apigateway.LambdaIntegration(getProductFunction));
    product.addMethod('PUT', new apigateway.LambdaIntegration(updateProductFunction));
    product.addMethod('DELETE', new apigateway.LambdaIntegration(deleteProductFunction));

    // Categories routes
    const categories = apiV1.addResource('categories');
    categories.addMethod('GET', new apigateway.LambdaIntegration(listCategoriesFunction));
    categories.addMethod('POST', new apigateway.LambdaIntegration(createCategoryFunction));
    
    const category = categories.addResource('{id}');
    category.addMethod('GET', new apigateway.LambdaIntegration(getCategoryFunction));
    category.addMethod('PUT', new apigateway.LambdaIntegration(updateCategoryFunction));
    category.addMethod('DELETE', new apigateway.LambdaIntegration(deleteCategoryFunction));

    // Orders routes
    const orders = apiV1.addResource('orders');
    orders.addMethod('GET', new apigateway.LambdaIntegration(listOrdersFunction));
    orders.addMethod('POST', new apigateway.LambdaIntegration(createOrderFunction));
    
    const order = orders.addResource('{id}');
    order.addMethod('GET', new apigateway.LambdaIntegration(getOrderFunction));
    
    const orderStatus = order.addResource('status');
    orderStatus.addMethod('PUT', new apigateway.LambdaIntegration(updateOrderStatusFunction));

    // CloudFront Distribution
    const cachePolicy = new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      cachePolicyName: `smultron-api-cache-${environment}`,
      comment: 'Cache policy for public API endpoints',
      defaultTtl: cdk.Duration.minutes(5),
      minTtl: cdk.Duration.seconds(1),
      maxTtl: cdk.Duration.hours(24),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
    });

    const noCachePolicy = new cloudfront.CachePolicy(this, 'ApiNoCachePolicy', {
      cachePolicyName: `smultron-api-no-cache-${environment}`,
      comment: 'No cache policy for private API endpoints',
      defaultTtl: cdk.Duration.seconds(0),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(1),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
    });

    const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ApiOriginRequestPolicy', {
      originRequestPolicyName: `smultron-api-origin-${environment}`,
      comment: 'Origin request policy for API',
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.all(),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
    });

    // Certificate (if provided and in us-east-1)
    // CloudFront requires certificates to be in us-east-1 region
    let certificate: acm.ICertificate | undefined;
    let distributionDomainNames: string[] | undefined;
    
    if (certificateArn) {
      // Check if certificate is in us-east-1 (required for CloudFront)
      if (certificateArn.includes(':us-east-1:')) {
        certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn);
        distributionDomainNames = [domainName];
      } else {
        console.warn(`Warning: Certificate ${certificateArn} is not in us-east-1. CloudFront will use default domain.`);
        console.warn(`To use custom domain ${domainName}, create a certificate in us-east-1 and provide that ARN.`);
      }
    }

    const distribution = new cloudfront.Distribution(this, 'SmultronDistribution', {
      comment: `Smultron API CloudFront Distribution - ${environment}`,
      defaultBehavior: {
        origin: new origins.RestApiOrigin(api, {
          originPath: '/v1',
        }),
        cachePolicy: noCachePolicy,
        originRequestPolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      additionalBehaviors: {
        // Cache public GET endpoints
        '/api/v1/products': {
          origin: new origins.RestApiOrigin(api, {
            originPath: '/v1',
          }),
          cachePolicy,
          originRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        '/api/v1/products/*': {
          origin: new origins.RestApiOrigin(api, {
            originPath: '/v1',
          }),
          cachePolicy,
          originRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        '/api/v1/categories': {
          origin: new origins.RestApiOrigin(api, {
            originPath: '/v1',
          }),
          cachePolicy,
          originRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        '/api/v1/categories/*': {
          origin: new origins.RestApiOrigin(api, {
            originPath: '/v1',
          }),
          cachePolicy,
          originRequestPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
      },
      ...(certificate && distributionDomainNames && {
        domainNames: distributionDomainNames,
        certificate,
      }),
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
