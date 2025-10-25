# Lambda Function Testing Plan

## Issue Clarification

There are TWO ways to call Lambda functions:

### 1. Lambda Function URLs (HTTP) - **RECOMMENDED**
- URL: `https://[function-url].lambda-url.ap-southeast-2.on.aws/`
- Protocol: HTTP/HTTPS (like any REST API)
- Authentication: None required (if configured as `AuthType: NONE`)
- Works from: Anywhere (EC2, browser, curl, etc.)
- **Currently returns**: 403 Forbidden

### 2. AWS SDK Lambda Invoke - **NOT RECOMMENDED**
- Method: `lambda.invoke()` in AWS SDK
- Protocol: AWS API
- Authentication: Requires IAM role with `lambda:InvokeFunction` permission
- Works from: EC2 with proper IAM role only
- **Known issue**: EC2 doesn't have `lambda:InvokeFunction` permission

## Current Status

### Lambda Function URLs Exist
```
Gallery Service:   https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/
Streaming Service: https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws/
```

Both configured with `AuthType: NONE` (no authentication required)

### Why They Return 403

The 403 error is likely NOT a permission issue, but rather:
1. **Lambda function is crashing** due to missing environment variables
2. When a Lambda crashes, Function URLs return 403 instead of 500
3. Cannot verify because CloudWatch Logs access is also blocked

## Testing Steps

### Step 1: Update Lambda Environment Variables (AWS Console)

**For `video-forge-gallery-service`:**
```
NODE_ENV=production
PORT=5000
DB_HOST=database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com
DB_NAME=cohort_2025
DB_USER=s458
DB_PASSWORD=4T5gnYmROThF
S3_BUCKET_NAME=video-forge-storage
COGNITO_USER_POOL_ID=ap-southeast-2_jft50FBre
COGNITO_CLIENT_ID=59ff9f0j33qp7al3vje4j4isc0
AWS_REGION=ap-southeast-2
```

**For `video-forge-streaming-service`:**
```
NODE_ENV=production
PORT=5001
DB_HOST=database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com
DB_NAME=cohort_2025
DB_USER=s458
DB_PASSWORD=4T5gnYmROThF
S3_BUCKET_NAME=video-forge-storage
AWS_REGION=ap-southeast-2
```

### Step 2: Test Lambda Function URLs

After updating environment variables, test from your local machine:

```bash
# Test Gallery Service Health
curl https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/health

# Expected: {"status":"healthy"} or similar
# If still 403: Check CloudWatch Logs in AWS Console

# Test Streaming Service Health
curl https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws/health

# Expected: {"status":"healthy"} or similar
```

### Step 3: If Function URLs Work

If the Function URLs return 200 OK after adding environment variables:

**✅ You can proceed with Option 1:**

1. Deploy API Gateway to EC2 (or keep it wherever it currently runs)
2. Configure API Gateway to proxy requests to Lambda Function URLs via HTTP
3. API Gateway code example:

```javascript
// In API Gateway's galleryRouter.js
const axios = require('axios');

const GALLERY_SERVICE_URL = 'https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws';

router.get('/videos', async (req, res) => {
  try {
    const response = await axios.get(`${GALLERY_SERVICE_URL}/videos`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || {error: 'Service unavailable'});
  }
});
```

4. Set up Application Load Balancer → EC2 (API Gateway)
5. Configure HTTPS with ACM certificate

### Step 4: If Function URLs Still Don't Work

If Lambda Function URLs still return 403 after adding environment variables:

**Check in AWS Console:**
1. Lambda → Functions → video-forge-gallery-service → Monitor → View CloudWatch Logs
2. Look for error messages
3. Possible issues:
   - Lambda execution role doesn't have permissions to access RDS/S3
   - Function is timing out
   - Code has bugs when running in Lambda environment

**Alternative: Check Resource Policy**
1. Lambda → Configuration → Permissions → Resource-based policy
2. If there's a restrictive policy, you may need to add:
```json
{
  "Effect": "Allow",
  "Principal": "*",
  "Action": "lambda:InvokeFunctionUrl",
  "Resource": "arn:aws:lambda:ap-southeast-2:901444280953:function:video-forge-gallery-service",
  "Condition": {
    "StringEquals": {
      "lambda:FunctionUrlAuthType": "NONE"
    }
  }
}
```

## Architecture Diagram (If Function URLs Work)

```
Internet
    ↓
Application Load Balancer (HTTPS)
    ↓
EC2 Instance (API Gateway - port 8000)
    ↓ (HTTP calls via axios/fetch)
    ├→ Lambda: video-forge-gallery-service (Function URL)
    └→ Lambda: video-forge-streaming-service (Function URL)
```

**Benefits:**
- No IAM permissions needed for EC2 → Lambda communication
- Simple HTTP calls (no AWS SDK complexity)
- Lambda scales automatically
- Still counts as serverless + microservices for A3

## What About the Previous EC2 → Lambda Issue?

The previous issue was trying to use AWS SDK's `lambda.invoke()` which requires:
- EC2 instance role with `lambda:InvokeFunction` permission
- This permission is denied

**Function URLs bypass this entirely** because they use HTTP, not AWS SDK.

## Recommendation

1. **First**: Update Lambda environment variables in AWS Console
2. **Test**: Try Function URLs again
3. **If working**: Configure API Gateway to call Function URLs via HTTP
4. **If not working**: Check CloudWatch Logs in Console for actual error
5. **If still blocked**: We may need to use EC2-only deployment (Option 3)

---

**Key Point**: Function URLs are just HTTP endpoints. If they return 403, it's likely the Lambda function crashing, not a permission issue. Once env vars are added, they should work from anywhere (EC2, your laptop, browser, etc.).
