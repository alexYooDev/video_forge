# Update Lambda Function Code via AWS Console

## Current Situation

✅ Lambda permissions are fixed (403 is gone!)
⚠️ Lambda is running old code (doesn't have proper routes)
📦 New deployment package created: `gallery-service-lambda.zip` (30MB)

## Step-by-Step: Update Lambda Function Code

### Step 1: Upload the Deployment Package

1. **Open Lambda Console**
   - Go to: https://ap-southeast-2.console.aws.amazon.com/lambda/home?region=ap-southeast-2#/functions
   - Click on **video-forge-gallery-service**

2. **Upload New Code**
   - Scroll to the **Code** section
   - Click the **Upload from** dropdown button
   - Select **.zip file**

3. **Upload the ZIP**
   - Click **Upload**
   - Navigate to: `/Users/alexyoodev/2025/cab432/video_forge_v2/services/gallery-service/gallery-service-lambda.zip`
   - Select the file and click **Open**
   - Click **Save**

4. **Wait for Upload**
   - You'll see "Uploading..." message
   - Wait for it to complete (30MB file, may take 1-2 minutes)
   - You should see "The deployment package of your Lambda function 'video-forge-gallery-service' has been updated"

### Step 2: Verify Handler is Correct

After upload:
1. Scroll down to **Runtime settings**
2. Check that **Handler** is set to: `lambda-handler.handler`
3. If not, click **Edit** and set it to `lambda-handler.handler`

### Step 3: Add Environment Variables

While you're in the Lambda console:

1. Click the **Configuration** tab
2. Click **Environment variables** in the left sidebar
3. Click **Edit**
4. Click **Add environment variable** for each of these:

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

### Step 4: Test the Function

Wait 10-20 seconds for Lambda to deploy the new code, then test:

```bash
curl https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/health
```

**Expected Result:**
```json
{"status":"ok","service":"gallery-service","runtime":"lambda"}
```

### Step 5: Repeat for Streaming Service

Now create the streaming service package:

```bash
cd /Users/alexyoodev/2025/cab432/video_forge_v2/services/streaming-service
npm install --production
zip -r streaming-service-lambda.zip . -x "*.git*" "*.log" "node_modules/@aws-sdk/*" "test/*" "*.md" ".env*"
```

Then in AWS Console:
1. Open **video-forge-streaming-service**
2. Upload `streaming-service-lambda.zip`
3. Verify handler: `lambda-handler.handler`
4. Add environment variables:

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

5. Test:
```bash
curl https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws/health
```

---

## Alternative: Use AWS CLI (If You Re-authenticate)

```bash
# Re-authenticate
aws sso login

# Update gallery service
cd /Users/alexyoodev/2025/cab432/video_forge_v2/services/gallery-service
aws lambda update-function-code \
  --function-name video-forge-gallery-service \
  --zip-file fileb://gallery-service-lambda.zip \
  --region ap-southeast-2

# Add environment variables
aws lambda update-function-configuration \
  --function-name video-forge-gallery-service \
  --environment "Variables={NODE_ENV=production,PORT=5000,DB_HOST=database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com,DB_NAME=cohort_2025,DB_USER=s458,DB_PASSWORD=4T5gnYmROThF,S3_BUCKET_NAME=video-forge-storage,COGNITO_USER_POOL_ID=ap-southeast-2_jft50FBre,COGNITO_CLIENT_ID=59ff9f0j33qp7al3vje4j4isc0,AWS_REGION=ap-southeast-2}" \
  --region ap-southeast-2

# Update streaming service
cd /Users/alexyoodev/2025/cab432/video_forge_v2/services/streaming-service
npm install --production
zip -r streaming-service-lambda.zip . -x "*.git*" "*.log" "node_modules/@aws-sdk/*" "test/*" "*.md" ".env*"

aws lambda update-function-code \
  --function-name video-forge-streaming-service \
  --zip-file fileb://streaming-service-lambda.zip \
  --region ap-southeast-2

aws lambda update-function-configuration \
  --function-name video-forge-streaming-service \
  --environment "Variables={NODE_ENV=production,PORT=5001,DB_HOST=database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com,DB_NAME=cohort_2025,DB_USER=s458,DB_PASSWORD=4T5gnYmROThF,S3_BUCKET_NAME=video-forge-storage,AWS_REGION=ap-southeast-2}" \
  --region ap-southeast-2
```

---

## Troubleshooting

### "Request entity too large" when uploading

The zip file is 30MB. Lambda console upload limit is 50MB, so it should work. If not:
1. Try uploading via S3:
   - Upload zip to S3 bucket
   - Use "Upload from → Amazon S3 location" instead
   - Enter S3 URL

### Function still returns 404 after upload

1. Check the handler is correct: `lambda-handler.handler`
2. Wait 20-30 seconds after upload for Lambda to deploy
3. Check CloudWatch Logs for errors (if you have permission)
4. Verify the zip file contains `lambda-handler.js` in the root

### Permission denied when updating

You may not have `lambda:UpdateFunctionCode` permission.
- Ask instructor to grant permission, OR
- Ask instructor to upload the zip file for you

---

## After Both Functions Work

Once both Lambda Function URLs return 200 OK:

1. ✅ You have working serverless microservices
2. Next: Deploy API Gateway (can use EC2 or ECS)
3. Configure API Gateway to proxy to Lambda Function URLs
4. Set up ALB → API Gateway → Lambda Functions
5. Configure HTTPS for full marks

**File location:**
`/Users/alexyoodev/2025/cab432/video_forge_v2/services/gallery-service/gallery-service-lambda.zip`
