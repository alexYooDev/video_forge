# Lambda Deployment - Final Instructions

## What We've Fixed

✅ Lambda Function URL permissions added (403 fixed!)
✅ Updated Lambda handlers to use `@vendia/serverless-express` (fixes routing issue)
✅ Created deployment packages for both services

## Files Ready for Upload

### Gallery Service
**Location**: `/Users/alexyoodev/2025/cab432/video_forge_v2/services/gallery-service/gallery-service-lambda.zip`
**Size**: 8.1MB
**Function Name**: `video-forge-gallery-service`
**Handler**: `lambda-handler.handler`

### Streaming Service
**Location**: `/Users/alexyoodev/2025/cab432/video_forge_v2/services/streaming-service/streaming-service-lambda.zip`
**Size**: 29MB
**Function Name**: `video-forge-streaming-service`
**Handler**: `lambda-handler.handler`

---

## Step-by-Step Upload Instructions

### 1. Upload Gallery Service

1. Open Lambda Console: https://ap-southeast-2.console.aws.amazon.com/lambda
2. Click **video-forge-gallery-service**
3. Scroll to **Code source** section
4. Click **Upload from** → **.zip file**
5. Click **Upload** button
6. Navigate to: `/Users/alexyoodev/2025/cab432/video_forge_v2/services/gallery-service/`
7. Select `gallery-service-lambda.zip`
8. Click **Open**
9. Click **Save**
10. Wait for "Successfully updated the function..." message

### 2. Add Gallery Service Environment Variables

1. Still in `video-forge-gallery-service`, click **Configuration** tab
2. Click **Environment variables** in left sidebar
3. Click **Edit**
4. Click **Add environment variable** for each:

```
NODE_ENV = production
PORT = 5000
DB_HOST = database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com
DB_NAME = cohort_2025
DB_USER = s458
DB_PASSWORD = 4T5gnYmROThF
S3_BUCKET_NAME = video-forge-storage
COGNITO_USER_POOL_ID = ap-southeast-2_jft50FBre
COGNITO_CLIENT_ID = 59ff9f0j33qp7al3vje4j4isc0
AWS_REGION = ap-southeast-2
```

5. Click **Save**

### 3. Test Gallery Service

Wait 20 seconds for Lambda to deploy, then run:

```bash
curl https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/health
```

**Expected Response:**
```json
{"status":"ok","service":"gallery-service","runtime":"lambda"}
```

If you get a 404 or different error, check CloudWatch Logs in the Lambda console.

### 4. Upload Streaming Service

1. Go back to Lambda functions list
2. Click **video-forge-streaming-service**
3. Scroll to **Code source** section
4. Click **Upload from** → **.zip file**
5. Click **Upload** button
6. Navigate to: `/Users/alexyoodev/2025/cab432/video_forge_v2/services/streaming-service/`
7. Select `streaming-service-lambda.zip`
8. Click **Open**
9. Click **Save**
10. Wait for upload (29MB - may take 2-3 minutes)

### 5. Add Streaming Service Environment Variables

1. Still in `video-forge-streaming-service`, click **Configuration** tab
2. Click **Environment variables**
3. Click **Edit**
4. Add these variables:

```
NODE_ENV = production
PORT = 5001
DB_HOST = database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com
DB_NAME = cohort_2025
DB_USER = s458
DB_PASSWORD = 4T5gnYmROThF
S3_BUCKET_NAME = video-forge-storage
AWS_REGION = ap-southeast-2
```

5. Click **Save**

### 6. Test Streaming Service

```bash
curl https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws/health
```

**Expected Response:**
```json
{"status":"ok","service":"streaming-service","runtime":"lambda"}
```

---

## Troubleshooting

### Still Getting 404 After Upload

1. **Check Handler Configuration**:
   - Configuration → General configuration → Edit
   - Handler should be: `lambda-handler.handler`
   - If it's different, update it and save

2. **Check CloudWatch Logs**:
   - Monitor tab → View CloudWatch logs
   - Look for errors in the latest log stream
   - Common issues:
     - Missing dependencies
     - Database connection errors (expected if env vars not added yet)
     - Module not found errors

### Upload Fails - File Too Large

Streaming service (29MB) is under the 50MB console limit, but if it fails:

1. **Upload via S3**:
   - Upload the zip to your S3 bucket
   - In Lambda console: Upload from → Amazon S3 location
   - Enter S3 URL: `s3://video-forge-storage/streaming-service-lambda.zip`

### Permission Errors

If you can't upload or modify Lambda:
- Ask instructor to grant `lambda:UpdateFunctionCode` and `lambda:UpdateFunctionConfiguration` permissions
- Or ask instructor to upload the files for you

---

## What Changed in the Code

### Before (aws-serverless-express)
```javascript
const awsServerlessExpress = require('aws-serverless-express');
const server = awsServerlessExpress.createServer(app);

exports.handler = async (event, context) => {
  return awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise;
};
```

**Problem**: Doesn't handle Lambda Function URL v2.0 event format properly. Paths were being lost (`/health` became `/`).

### After (@vendia/serverless-express)
```javascript
const serverlessExpress = require('@vendia/serverless-express');

exports.handler = serverlessExpress({
  app,
  eventSource: {
    getRequest: (event) => {
      console.log('Event:', JSON.stringify(event, null, 2));
      // DB initialization logic...
      return event;
    }
  }
});
```

**Solution**: Properly handles Lambda Function URL events and preserves the request path.

---

## After Both Functions Work

Once both Lambda Function URLs return 200 OK with proper JSON responses:

### ✅ What You'll Have Achieved

1. **Serverless Microservices** (2 marks) - Gallery and Streaming running on Lambda
2. **Function URLs configured** - Public HTTP endpoints
3. **Proper error handling and logging**
4. **Environment-based configuration**

### 🎯 Next Steps

1. **Deploy API Gateway** (can use EC2, ECS, or another Lambda)
2. **Configure API Gateway** to proxy requests to Lambda Function URLs
3. **Set up Application Load Balancer**
   - Route traffic to API Gateway
   - Enable HTTPS with ACM certificate
4. **Configure Auto Scaling** for video processor
5. **Test end-to-end** video upload → processing → streaming workflow

### 📊 Estimated A3 Score

If both Lambdas work + ALB + HTTPS:
- Core requirements: 8-10/10
- Additional criteria: 12-14/14
- **Total: 20-24/24** ⭐

---

## Quick Reference

### Lambda Function URLs
```
Gallery:   https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws
Streaming: https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws
```

### Test Commands
```bash
# Gallery health
curl https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/health

# Streaming health
curl https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws/health

# Gallery videos (will need authentication)
curl https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/api/gallery/videos
```

---

**Important**: The Lambda packages are ready at the paths listed above. Just upload them via the AWS Console and add the environment variables!
