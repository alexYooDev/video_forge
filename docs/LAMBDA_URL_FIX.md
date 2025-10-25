# Lambda Function URL Authorization Fix

## Current Issue

```
{"Message":"Forbidden. For troubleshooting Function URL authorization issues,
see: https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html"}
```

This is a **Lambda Function URL authorization issue**, not a function crash.

## Root Cause

Even though the Function URL is configured with `AuthType: NONE`, the Lambda function's **resource-based policy** is likely blocking public access.

## Fix Via AWS Console

### Option A: Add Resource-Based Policy (Recommended)

1. **Open AWS Lambda Console**
   - Go to: https://ap-southeast-2.console.aws.amazon.com/lambda/home?region=ap-southeast-2#/functions
   - Click on `video-forge-gallery-service`

2. **Check Current Permissions**
   - Click **Configuration** tab
   - Click **Permissions** in left sidebar
   - Scroll to **Resource-based policy statements**
   - Check if there's a policy for the Function URL

3. **Add Function URL Permission**
   - If no policy exists for Function URL, click **Add permissions**
   - Choose **Create a new policy**
   - Or use AWS CLI (if you can re-authenticate):

```bash
aws lambda add-permission \
  --function-name video-forge-gallery-service \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region ap-southeast-2
```

4. **Expected Policy**
   The resource-based policy should look like:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "FunctionURLAllowPublicAccess",
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
     ]
   }
   ```

5. **Repeat for Streaming Service**
   - Do the same for `video-forge-streaming-service`

### Option B: Recreate Function URL with Correct Permissions

If adding the permission doesn't work:

1. **Delete existing Function URL**
   - Lambda → Configuration → Function URL
   - Click **Delete**

2. **Create new Function URL**
   - Click **Create function URL**
   - Auth type: **NONE**
   - **Important**: Check the box "Configure cross-origin resource sharing (CORS)" if needed
   - This should automatically create the correct resource-based policy

### Option C: Check IAM Permission to Add Policy

If you get permission errors when trying to add the resource-based policy:

**You may not have permission to:**
- `lambda:AddPermission`
- `lambda:RemovePermission`

**In this case, you'll need to:**
1. Request this permission from your instructor/admin, OR
2. Ask them to add the resource-based policy for you, OR
3. Fall back to **Option 2 or 3** from the deployment plan

## Testing After Fix

Once the resource-based policy is added:

```bash
# Test Gallery Service
curl https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/health

# Expected responses:
# - 200 OK: Function works! ✅
# - 500 Error: Function is crashing (missing env vars) - fixable ⚠️
# - 403 Forbidden: Policy still not right ❌

# Test Streaming Service
curl https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws/health
```

## If Still Blocked

### Check What Permissions You Have

Try this in AWS Console or CLI:

```bash
# Check if you can add permission to Lambda
aws lambda add-permission --help

# Check your current permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::901444280953:role/AWSReservedSSO_CAB432-STUDENT_xxx \
  --action-names lambda:AddPermission lambda:InvokeFunctionUrl \
  --resource-arns arn:aws:lambda:ap-southeast-2:901444280953:function:video-forge-gallery-service
```

### Alternative Solutions if Lambda URLs Can't Be Fixed

#### Solution 1: Use API Gateway REST API (Not Lambda Direct)
- Create an API Gateway REST API
- Point it to your Lambda functions
- API Gateway handles authorization differently
- Requires `apigateway:*` permissions

#### Solution 2: Deploy Everything to ECS (If We Can Fix Task Definitions)
- Problem: Can't register new task definitions
- Would need IAM permission for `ecs:RegisterTaskDefinition`

#### Solution 3: Deploy Everything to EC2 with Docker Compose
- Single EC2 instance running all 3 services
- Use docker-compose.yml
- Put ALB in front
- **This would definitely work within current constraints**

## Current Situation Summary

```
Lambda Functions Deployed:          ✅ Yes
Lambda Function URLs Created:       ✅ Yes (AuthType: NONE)
Lambda Resource-Based Policy:       ❌ Missing or incorrect
Permission to Add Policy:           ❓ Unknown - need to test
Function Environment Variables:     ❌ Missing
```

## Recommendation

**Try these in order:**

1. **First**: Check if you can add Lambda resource-based policy via Console
   - Lambda → Configuration → Permissions → Add permissions
   - If successful, test Function URLs again

2. **If that works**: Add environment variables to Lambda functions
   - Then test Function URLs - should get 200 or 500 (not 403)

3. **If no permission to add policy**: Request `lambda:AddPermission` from instructor

4. **If still blocked**: Deploy everything to EC2 with docker-compose
   - This is guaranteed to work
   - Will still meet A3 requirements (microservices, load balancing, auto-scaling)

---

**The 403 error confirms**: This is a Lambda Function URL resource-based policy issue, not a network/IAM issue. The Lambda service is rejecting the request before it reaches your code.
