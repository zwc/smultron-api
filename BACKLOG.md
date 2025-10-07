The infrastructure should be done with CDK. I want a cloudfront for the public API. I want a ApiGateway, and I want lambdas. Of course, it should setup the DynamoDB, and the permission for it via the CRUD API handlers. I want to be able to specifify environment, so that I can deploy to either stage or prod.

Create integration tests, so that I can validate that the deployed environment is working as expected.

I've provided .env with secrets to github. First I want to publish all .env as secrets on github for my repo. Then I would like to be able to deploy when pushing to main, first it should do unit test, then it should deploy to stage, run the integration tests, then deploy to prod, then run the integration tests again. The repo is at https://github.com/zwc/smultron-api

