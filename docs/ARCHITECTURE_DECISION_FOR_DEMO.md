# VideoForge Architecture Decision for Demo

**Date:** October 24, 2025
**Goal:** Choose ONE working architecture for A3 video demonstration

---

## Recommended Architecture: EC2 + Lambda Hybrid

### Why This Architecture?

1. **Best User Experience** - Client UI at custom domain
2. **Serverless Benefits** - Lambda for API
3. **All A3 Requirements** - 22-24/24 marks
4. **Easy to Demo** - One URL for everything

### Architecture Flow

```
User Opens Browser
    ↓
https://video-forge-v2.cab432.com (Custom Domain)
    ↓
Application Load Balancer (HTTPS)
    ↓
EC2 Instance (t3.medium) - Docker Compose
├─→ React Client (Nginx) :3000
└─→ API Gateway Proxy :8080
       ↓
    AWS Lambda Functions
    ├─→ Gallery Service
    └─→ Streaming Service
          ↓
       RDS PostgreSQL
          ↓
    Video Upload → S3
          ↓
    SQS Queue (video-processing-queue)
          ↓
    Auto Scaling Group (Video Processors)
          ↓
    Processed Videos → S3 → CloudFront
```

### End-to-End Demo Flow

1. **User visits** https://video-forge-v2.cab432.com
2. **User logs in** with Cognito MFA
3. **User uploads video** → S3
4. **Upload triggers** SQS message
5. **ASG scales up** → EC2 video processor starts
6. **Video processed** → Multiple qualities created
7. **User sees video** in gallery
8. **User plays video** → Streamed from CloudFront

---

## What Needs to Work

### ✅ Already Working
- [x] Client UI accessible
- [x] Lambda functions responding
- [x] Database connected
- [x] HTTPS configured
- [x] Custom domain

### ⚠️ Need to Fix
- [ ] EC2 API Gateway → Lambda proxy integration
- [ ] Upload flow to S3
- [ ] SQS message triggering
- [ ] ASG scaling policy
- [ ] CloudFront streaming

### ❌ Can Remove
- [ ] ECS services (not needed)
- [ ] Old A2 EC2 instance (i-0d054318bd6b72a10)

---

## Next Steps

1. Test upload flow from client
2. Fix any broken integrations
3. Verify ASG scales on upload
4. Test video playback
5. Clean up unused resources
6. Practice demo walkthrough

