# 🌐 CloudFront CDN Setup Guide

**Goal:** Add CloudFront distribution for video delivery  
**Time:** ~15 minutes  
**Result:** +2 marks → 24/24 total! 🏆

---

## 📋 What is CloudFront?

CloudFront is AWS's Content Delivery Network (CDN):
- Caches video content at edge locations worldwide
- Reduces latency for users (faster video loading)
- Reduces load on S3 (cost savings)
- Improves user experience globally

---

## 🚀 Setup Steps

### Step 1: Create CloudFront Distribution

1. Open **AWS Console** → **CloudFront** → Click **Create distribution**

2. **Origin Settings:**
   ```
   Origin domain: video-forge-storage.s3.ap-southeast-2.amazonaws.com
   Name: video-forge-s3-origin
   Origin access: Origin access control settings (recommended)
   ```

3. Click **Create control setting** (if needed):
   ```
   Name: video-forge-oac
   Description: OAC for video-forge-storage
   Sign requests: Yes
   ```
   Click **Create**

4. **Default Cache Behavior:**
   ```
   Viewer protocol policy: Redirect HTTP to HTTPS
   Allowed HTTP methods: GET, HEAD, OPTIONS
   Cache policy: CachingOptimized (recommended)
   ```

5. **Settings:**
   ```
   Price class: Use all edge locations (best performance)
   Alternate domain name (CNAME): (leave empty for now)
   SSL Certificate: Default CloudFront certificate
   Default root object: (leave empty)
   Description: VideoForge CDN for video streaming
   ```

6. Click **Create distribution**

7. ⏳ Wait ~10 minutes for deployment (Status: "Enabled")

### Step 2: Update S3 Bucket Policy

After creating the distribution, CloudFront will show a banner:
**"The S3 bucket policy needs to be updated"**

1. Click **Copy policy**
2. Go to **S3** → **video-forge-storage** → **Permissions** → **Bucket policy**
3. Click **Edit**
4. **Paste** the CloudFront policy
5. Click **Save changes**

The policy will look like:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::video-forge-storage/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::901444280953:distribution/YOUR-DIST-ID"
        }
      }
    }
  ]
}
```

### Step 3: Get CloudFront Domain Name

1. Go back to **CloudFront** → **Distributions**
2. Find your distribution (e.g., `d111111abcdef8.cloudfront.net`)
3. Copy the **Distribution domain name**
4. Save it - you'll need this!

---

## 🔧 Option A: Quick Test (No Code Changes)

**Test CloudFront immediately:**

```bash
# Get your CloudFront domain from console
CLOUDFRONT_DOMAIN="d111111abcdef8.cloudfront.net"

# Test video access through CloudFront
curl -I https://${CLOUDFRONT_DOMAIN}/videos/processed/sample-video-720p.mp4

# Expected: HTTP/2 200 with x-cache: Hit from cloudfront or Miss from cloudfront
```

---

## 🔧 Option B: Update Streaming Service (Recommended)

Update your Streaming Lambda to use CloudFront URLs:

### Method 1: Environment Variable (Easiest)

1. Go to Lambda → `video-forge-streaming-service`
2. **Configuration** → **Environment variables** → **Edit**
3. Add new variable:
   ```
   CLOUDFRONT_DOMAIN = d111111abcdef8.cloudfront.net
   ```
4. Click **Save**

Then update `src/services/s3Service.js` to use CloudFront:

```javascript
async generateStreamUrl(s3Key, expiresIn = 3600) {
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
  
  if (cloudfrontDomain) {
    // Use CloudFront URL (CDN)
    const url = `https://${cloudfrontDomain}/${s3Key}`;
    return url;
  } else {
    // Fallback to S3 presigned URL
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
```

### Method 2: Keep It Simple (No Code Changes)

Just document that CloudFront is available and can be used by:
- Replacing S3 URLs with CloudFront domain
- CloudFront automatically caches responses

---

## ✅ Verification Checklist

After CloudFront is deployed:

- [ ] Distribution status shows "Enabled"
- [ ] S3 bucket policy updated
- [ ] CloudFront domain name copied
- [ ] Test video URL works through CloudFront
- [ ] Cache headers present (`x-cache: Hit from cloudfront`)

---

## 📊 Benefits for A3

**CloudFront adds (+2 marks):**
- ✅ Global CDN requirement met
- ✅ Edge caching for video content
- ✅ Reduced S3 costs (fewer GetObject requests)
- ✅ Better user experience worldwide
- ✅ **Total score: 24/24!** 🏆

---

## 🎯 What to Document for Submission

Include in your A3 report:

1. **CloudFront Distribution ID:** (e.g., E1A2B3C4D5E6F7)
2. **CloudFront Domain:** (e.g., d111111abcdef8.cloudfront.net)
3. **Purpose:** Global CDN for video delivery
4. **Benefits:** 
   - Reduced latency for global users
   - Edge caching reduces S3 costs
   - Improves video streaming performance

---

## 🔧 Troubleshooting

### "Access Denied" when accessing CloudFront URL
- Check S3 bucket policy is updated with CloudFront permission
- Wait 5-10 minutes for policy to propagate

### "Distribution still deploying"
- Wait 10-15 minutes for global deployment
- Status must show "Enabled" before testing

### Videos not caching
- Check cache policy is "CachingOptimized"
- First request is always "Miss from cloudfront"
- Second request should be "Hit from cloudfront"

---

**Ready to start?** Go to AWS Console → CloudFront → Create distribution!

Let me know when your distribution is created and I'll help verify it! 🚀
