# Step-by-Step: Add Lambda Function URL Permission

## Method 1: Via AWS Console (Easiest)

### Step 1: Open Lambda Console

1. Go to AWS Console: https://console.aws.amazon.com/
2. Make sure region is set to **ap-southeast-2 (Sydney)**
3. Search for "Lambda" in the services search box
4. Click **Lambda**

### Step 2: Open Gallery Service Function

1. In the Lambda console, you'll see a list of functions
2. Click on **video-forge-gallery-service**

### Step 3: Navigate to Permissions

1. You'll see tabs at the top: Code, Test, Monitor, **Configuration**, etc.
2. Click the **Configuration** tab
3. In the left sidebar, click **Permissions**

### Step 4: Add Resource-Based Policy

1. Scroll down to the section called **Resource-based policy statements**
2. You should see a button **Add permissions**
3. Click **Add permissions**

### Step 5: Configure Permission

A dialog will appear. Fill in:

**Policy statement:**
- **Statement ID**: `FunctionURLAllowPublicAccess` (or any unique name)
- **Principal**: Choose **Other** from dropdown
  - In the text box, enter: `*` (asterisk means everyone)
- **Source ARN** (optional): Leave blank
- **Source Account** (optional): Leave blank
- **Action**: Choose **Lambda:InvokeFunctionUrl** from dropdown
- **Auth Type**: Select **NONE**

Click **Save**

### Step 6: Verify Permission Added

After saving, you should see a new policy statement appear under "Resource-based policy statements"

It should show:
```
Statement ID: FunctionURLAllowPublicAccess
Principal: *
Action: lambda:InvokeFunctionUrl
Condition: lambda:FunctionUrlAuthType = NONE
```

### Step 7: Repeat for Streaming Service

1. Go back to Lambda functions list
2. Click on **video-forge-streaming-service**
3. Repeat Steps 3-6 for this function

### Step 8: Test

Open terminal and test:

```bash
curl https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/health
```

**Expected Results:**
- ✅ **200 OK** with JSON response = Success! Function works!
- ⚠️ **500 Internal Server Error** = Function is crashing (need to add env vars, but permission is fixed!)
- ❌ **403 Forbidden** = Permission still not right, or you don't have permission to add it

---

## Method 2: Via AWS CLI (If Console Doesn't Work)

First, re-authenticate your AWS session:

```bash
aws sso login --profile default
```

Then run these commands:

### For Gallery Service:
```bash
aws lambda add-permission \
  --function-name video-forge-gallery-service \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region ap-southeast-2
```

### For Streaming Service:
```bash
aws lambda add-permission \
  --function-name video-forge-streaming-service \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region ap-southeast-2
```

### Test:
```bash
curl https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/health
curl https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws/health
```

---

## Method 3: Via AWS CloudShell (If CLI Doesn't Work)

1. In AWS Console (top right), click the **CloudShell** icon (looks like `>_`)
2. Wait for CloudShell to start
3. Copy and paste the CLI commands from Method 2
4. Run them in CloudShell

---

## Troubleshooting

### Error: "User is not authorized to perform: lambda:AddPermission"

This means you don't have permission to add resource-based policies to Lambda functions.

**Solutions:**
1. **Ask your instructor** to add the permission for you
2. **Request IAM permission** for `lambda:AddPermission`
3. **Use Option 3**: Deploy to EC2 with docker-compose instead

### Error: "Statement already exists"

The permission was already added! Test the Function URL to see if it works now.

### Still Getting 403 After Adding Permission

1. **Check the resource-based policy** in Lambda Console:
   - Configuration → Permissions → Resource-based policy statements
   - Make sure it shows `Principal: *` and `Action: lambda:InvokeFunctionUrl`

2. **Try recreating the Function URL**:
   - Configuration → Function URL → Delete
   - Create function URL → Auth type: NONE → Save
   - This will auto-generate the correct resource policy

3. **Check if there's a VPC restriction**:
   - Configuration → VPC
   - If function is in a VPC, make sure it has internet access via NAT Gateway

---

## Quick Checklist

- [ ] Logged into AWS Console (ap-southeast-2 region)
- [ ] Opened Lambda service
- [ ] Clicked on video-forge-gallery-service
- [ ] Configuration → Permissions → Add permissions
- [ ] Added permission with Principal: * and Action: InvokeFunctionUrl
- [ ] Saved permission
- [ ] Repeated for video-forge-streaming-service
- [ ] Tested with curl command
- [ ] Got 200 or 500 (not 403)

---

## What Happens After Permission is Added

Once the resource-based policy is correct:

### If you get 200 OK:
✅ Function works! Move to adding environment variables

### If you get 500 Error:
⚠️ Permission is fixed, but function is crashing
- Need to add environment variables (DB_HOST, S3_BUCKET_NAME, etc.)
- Can add via Lambda → Configuration → Environment variables

### If you still get 403:
❌ Either:
- Permission wasn't added correctly
- You don't have permission to add it
- There's another restriction (VPC, resource policy, etc.)

**Next step**: Fall back to EC2 deployment option
