# Lambda Update Guide - Secrets Manager Integration

## Overview

Both Lambda functions have been updated to securely fetch database credentials from AWS Secrets Manager instead of using plain-text environment variables.

## Changes Made

### Security Improvements
- ✅ Database password fetched from Secrets Manager (`DB_SECRET_ARN`)
- ✅ JWT secret fetched from Secrets Manager (`JWT_SECRET_ARN`)
- ✅ Secrets cached in memory to reduce API calls
- ✅ Fallback to environment variables if Secrets Manager unavailable

### Code Updates
1. **New files:**
   - `services/gallery-service/src/config/secrets.js`
   - `services/streaming-service/src/config/secrets.js`

2. **Updated files:**
   - `services/gallery-service/src/models/index.js` - Async database initialization
   - `services/gallery-service/lambda-handler.js` - Initialize DB on cold start
   - `services/streaming-service/src/models/index.js` - Async database initialization
   - `services/streaming-service/lambda-handler.js` - Initialize DB on cold start

3. **New dependencies:**
   - `@aws-sdk/client-secrets-manager` - AWS SDK for Secrets Manager

### New Lambda Packages
- ✅ `gallery-service-lambda.zip` (11 MB)
- ✅ `streaming-service-lambda.zip` (10 MB)

---

## Deployment Steps

### Step 1: Update Gallery Service Lambda

1. Navigate to AWS Lambda Console → `video-forge-gallery-service`

2. **Upload new code:**
   - Go to "Code" tab
   - Click "Upload from" → ".zip file"
   - Select: `services/gallery-service/gallery-service-lambda.zip`
   - Click "Save"

3. **Add environment variable:**
   - Go to "Configuration" → "Environment variables"
   - Click "Edit"
   - Add new variable:
     - Key: `DB_HOST`
     - Value: `database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com`
   - Click "Save"

4. **Verify IAM permissions:**
   - Go to "Configuration" → "Permissions"
   - Click on the execution role (`CAB432-Lambda-Role`)
   - Verify it has `secretsmanager:GetSecretValue` permission for:
     - `/video-forge/database/postgres-password`
     - `/video-forge/auth/jwt-secret`

### Step 2: Update Streaming Service Lambda

1. Navigate to AWS Lambda Console → `video-forge-streaming-service`

2. **Upload new code:**
   - Go to "Code" tab
   - Click "Upload from" → ".zip file"
   - Select: `services/streaming-service/streaming-service-lambda.zip`
   - Click "Save"

3. **Add environment variable:**
   - Go to "Configuration" → "Environment variables"
   - Click "Edit"
   - Add new variable:
     - Key: `DB_HOST`
     - Value: `database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com`
   - Click "Save"

4. **Verify IAM permissions:**
   - Go to "Configuration" → "Permissions"
   - Click on the execution role (`CAB432-Lambda-Role`)
   - Verify `secretsmanager:GetSecretValue` permission

---

## Environment Variables Summary

### Required Environment Variables (Both Lambdas)

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Already set |
| `DB_NAME` | `videoforge` | Already set |
| `DB_USER` | `postgres` | Already set |
| `DB_HOST` | `database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com` | **ADD THIS** |
| `DB_PORT` | `5432` | Optional (defaults to 5432) |
| `S3_BUCKET_NAME` | `video-forge-storage` | Already set |
| `DB_SECRET_ARN` | `arn:aws:secretsmanager:ap-southeast-2:901444280953:secret:/video-forge/database/postgres-password` | Already set |
| `JWT_SECRET_ARN` | `arn:aws:secretsmanager:ap-southeast-2:901444280953:secret:/video-forge/auth/jwt-secret` | Already set |
| `COGNITO_USER_POOL_ID` | `ap-southeast-2_jft50FBre` | Already set |
| `COGNITO_CLIENT_ID` | `59ff9f0j33qp7al3vje4j4isc0` | Already set |

**Note:** `AWS_REGION` is automatically set by Lambda - DO NOT add it as an environment variable.

### Removed Variables (Security Improvement)
- ❌ `DB_PASSWORD` - Now fetched from Secrets Manager
- ❌ `JWT_SECRET` - Now fetched from Secrets Manager

---

## Testing After Deployment

### Test 1: Gallery Service Health Check
```bash
aws lambda invoke \
  --function-name video-forge-gallery-service \
  --cli-binary-format raw-in-base64-out \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  --region ap-southeast-2 \
  /tmp/gallery-health.json && cat /tmp/gallery-health.json
```

**Expected:** `{"statusCode":200,"body":"{\"status\":\"ok\",\"service\":\"gallery-service\",\"runtime\":\"lambda\"}"}`

### Test 2: Gallery Videos List
```bash
aws lambda invoke \
  --function-name video-forge-gallery-service \
  --cli-binary-format raw-in-base64-out \
  --payload '{"httpMethod":"GET","path":"/api/gallery/videos","headers":{}}' \
  --region ap-southeast-2 \
  /tmp/gallery-videos.json && cat /tmp/gallery-videos.json
```

**Expected:** `{"statusCode":200,"body":"{\"videos\":[...],\"pagination\":{...}}"}`

### Test 3: Streaming Service Health Check
```bash
aws lambda invoke \
  --function-name video-forge-streaming-service \
  --cli-binary-format raw-in-base64-out \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  --region ap-southeast-2 \
  /tmp/streaming-health.json && cat /tmp/streaming-health.json
```

**Expected:** `{"statusCode":200,"body":"{\"status\":\"ok\",\"service\":\"streaming-service\",\"runtime\":\"lambda\"}"}`

---

## IAM Policy Requirements

The Lambda execution role (`CAB432-Lambda-Role`) needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:ap-southeast-2:901444280953:secret:/video-forge/database/postgres-password-*",
        "arn:aws:secretsmanager:ap-southeast-2:901444280953:secret:/video-forge/auth/jwt-secret-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::video-forge-storage/*"
    }
  ]
}
```

---

## Troubleshooting

### Error: "Unable to connect to database"
- Check `DB_HOST` environment variable is set correctly
- Verify Lambda is in the correct VPC and security group
- Check RDS security group allows inbound from Lambda security group

### Error: "Failed to fetch secret"
- Verify `DB_SECRET_ARN` and `JWT_SECRET_ARN` are correct
- Check Lambda execution role has `secretsmanager:GetSecretValue` permission
- Verify secrets exist in Secrets Manager

### Error: "Database not initialized"
- This should auto-resolve on cold start
- Check Lambda logs for initialization errors
- Verify handler is set to `lambda-handler.handler`

---

## Benefits of This Update

1. **Security:** No plain-text credentials in environment variables
2. **Compliance:** Follows AWS security best practices
3. **Rotation:** Secrets can be rotated without updating Lambda
4. **Auditing:** Secret access is logged in CloudTrail
5. **Caching:** Reduces Secrets Manager API calls and costs

---

## Next Steps

After deploying:
1. ✅ Upload both Lambda packages via AWS Console
2. ✅ Add `DB_HOST` environment variable to both functions
3. ✅ Test health checks and database connectivity
4. ✅ Verify secrets are fetched correctly (check CloudWatch logs)
5. ✅ Test video gallery loading in frontend

**Once deployment is complete, the "Failed to load videos" error should be resolved!**
