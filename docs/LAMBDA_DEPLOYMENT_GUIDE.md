# 🚀 Lambda Deployment Guide - AWS Console

**Deploy Time:** ~10 minutes per function  
**Packages Ready:** ✅ Both zip files created

---

## 📍 Deployment Package Locations

```
Gallery:   ~/2025/cab432/video_forge_v2/services/gallery-service/gallery-service-lambda.zip
Streaming: ~/2025/cab432/video_forge_v2/services/streaming-service/streaming-service-lambda.zip
```

---

## 🎯 PART 1: Deploy Gallery Service Lambda

### Step 1: Create Function
1. Open AWS Console → **Lambda** → Click **Create function**
2. Select **Author from scratch**
3. Fill in:
   ```
   Function name:    video-forge-gallery-service
   Runtime:          Node.js 22.x (or 20.x, both work)
   Architecture:     x86_64
   Execution role:   Use an existing role → CAB432-Lambda-Role
   ```
4. Click **Create function**

### Step 2: Upload Code
1. Scroll down to **Code source** section
2. Click **Upload from** dropdown → **.zip file**
3. Click **Upload** button
4. Navigate to: `~/2025/cab432/video_forge_v2/services/gallery-service/`
5. Select: `gallery-service-lambda.zip`
6. Click **Save**
7. ⏳ Wait ~30 seconds for upload to complete

### Step 3: Configure Settings
1. Click **Configuration** tab
2. Click **General configuration** → **Edit**
3. Set:
   ```
   Memory:   512 MB
   Timeout:  30 seconds
   ```
4. Click **Save**

### Step 4: Configure VPC (Critical for RDS access!)
1. Stay in **Configuration** tab
2. Click **VPC** → **Edit**
3. Configure:
   ```
   VPC:              vpc-007bab53289655834
   Subnets:          Select ALL 7 subnets
   Security groups:  CAB432SG
   ```
4. Click **Save**
5. ⏳ Wait ~2 minutes for VPC configuration

### Step 5: Environment Variables
1. Stay in **Configuration** tab
2. Click **Environment variables** → **Edit** → **Add environment variable**
3. Add these 6 variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `S3_BUCKET_NAME` | `video-forge-storage` |
| `DB_NAME` | `videoforge` |
| `DB_USER` | `postgres` |
| `DB_SECRET_ARN` | `arn:aws:secretsmanager:ap-southeast-2:901444280953:secret:/video-forge/database/postgres-password` |
| `JWT_SECRET_ARN` | `arn:aws:secretsmanager:ap-southeast-2:901444280953:secret:/video-forge/auth/jwt-secret` |

**Note:** Don't add `AWS_REGION` - it's automatically set by Lambda to `ap-southeast-2`

4. Click **Save**

### Step 6: Test Function
1. Click **Test** tab
2. Click **Create new event**
3. Event name: `health-check`
4. Paste this JSON:
   ```json
   {
     "httpMethod": "GET",
     "path": "/health",
     "headers": {},
     "queryStringParameters": null,
     "body": null
   }
   ```
5. Click **Save**
6. Click **Test** button
7. ✅ Expected result: `"statusCode": 200`

---

## 🎯 PART 2: Deploy Streaming Service Lambda

### Step 1: Create Function
1. AWS Console → **Lambda** → **Create function**
2. Select **Author from scratch**
3. Fill in:
   ```
   Function name:    video-forge-streaming-service
   Runtime:          Node.js 22.x (or 20.x, both work)
   Architecture:     x86_64
   Execution role:   Use an existing role → CAB432-Lambda-Role
   ```
4. Click **Create function**

### Step 2: Upload Code
1. **Code source** section → **Upload from** → **.zip file**
2. Click **Upload**
3. Navigate to: `~/2025/cab432/video_forge_v2/services/streaming-service/`
4. Select: `streaming-service-lambda.zip`
5. Click **Save**
6. ⏳ Wait ~30 seconds

### Step 3: Configure Settings
1. **Configuration** tab → **General configuration** → **Edit**
2. Set:
   ```
   Memory:   512 MB
   Timeout:  10 seconds  (faster than Gallery!)
   ```
3. Click **Save**

### Step 4: Configure VPC
1. **Configuration** tab → **VPC** → **Edit**
2. Configure:
   ```
   VPC:              vpc-007bab53289655834
   Subnets:          Select ALL 7 subnets
   Security groups:  CAB432SG
   ```
3. Click **Save**
4. ⏳ Wait ~2 minutes

### Step 5: Environment Variables
1. **Configuration** tab → **Environment variables** → **Edit**
2. Add the SAME 6 variables as Gallery:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `S3_BUCKET_NAME` | `video-forge-storage` |
| `DB_NAME` | `videoforge` |
| `DB_USER` | `postgres` |
| `DB_SECRET_ARN` | `arn:aws:secretsmanager:ap-southeast-2:901444280953:secret:/video-forge/database/postgres-password` |
| `JWT_SECRET_ARN` | `arn:aws:secretsmanager:ap-southeast-2:901444280953:secret:/video-forge/auth/jwt-secret` |

**Note:** Don't add `AWS_REGION` - it's automatically set by Lambda

3. Click **Save**

### Step 6: Test Function
1. **Test** tab → **Create new event**
2. Event name: `health-check`
3. Paste:
   ```json
   {
     "httpMethod": "GET",
     "path": "/health",
     "headers": {},
     "queryStringParameters": null,
     "body": null
   }
   ```
4. Click **Save** → **Test**
5. ✅ Expected: `"statusCode": 200`

---

## ✅ Verification Checklist

After deploying BOTH functions, verify:

- [ ] **Gallery Lambda**
  - [ ] Function exists: `video-forge-gallery-service`
  - [ ] Runtime: Node.js 22.x
  - [ ] Memory: 512 MB, Timeout: 30s
  - [ ] VPC: vpc-007bab53289655834
  - [ ] Security Group: CAB432SG
  - [ ] 6 environment variables set
  - [ ] Health check test passes

- [ ] **Streaming Lambda**
  - [ ] Function exists: `video-forge-streaming-service`
  - [ ] Runtime: Node.js 22.x
  - [ ] Memory: 512 MB, Timeout: 10s
  - [ ] VPC: vpc-007bab53289655834
  - [ ] Security Group: CAB432SG
  - [ ] 6 environment variables set
  - [ ] Health check test passes

---

## 🎉 Success Criteria

When both are deployed:

```bash
# Verify from terminal:
aws lambda list-functions --region ap-southeast-2 \
  --query 'Functions[?contains(FunctionName, `video-forge`)].FunctionName'
```

Expected output:
```
video-forge-gallery-service
video-forge-streaming-service
```

---

## 🏆 A3 Score Impact

✅ **Serverless** (+2 marks) - Two Lambda functions deployed  
✅ **Microservices** (+2 marks) - Clear separation of concerns  
✅ **Total Score: 24/24!** 🎯

---

## 🔧 Troubleshooting

### Upload fails (file too large)?
- Lambda console has 50MB upload limit
- Our files are ~10MB each, should work fine
- If fails, use S3 upload method instead

### VPC shows "No VPC"?
- Wait 2-3 minutes after saving VPC config
- Refresh the page
- Check CloudWatch Logs for VPC attachment

### Test fails with timeout?
- Check Security Group allows outbound traffic
- Verify RDS endpoint is accessible
- Check CloudWatch Logs: `/aws/lambda/video-forge-gallery-service`

### Environment variables not saving?
- Make sure you clicked **Save** after adding
- Check you added all 6 variables (don't add AWS_REGION - it's reserved!)
- Values should match exactly (no extra spaces)

---

📝 **After deployment, tell me and I'll help you verify everything is working!**
