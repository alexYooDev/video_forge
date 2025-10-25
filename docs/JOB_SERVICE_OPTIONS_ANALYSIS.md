# Job Service Architecture Options - A3 Requirements Analysis

## Option A: Job Service as Lambda Function

### Architecture
```
Client → AWS API Gateway → Job Service Lambda → SQS → Video Processor ASG
                          ↓
                     Gallery Lambda
                          ↓
                    Streaming Lambda
```

### Pros
✅ **Serverless Functions (2 marks)** - Job creation is lightweight, perfect for Lambda
✅ **Communication Mechanisms (2 marks)** - AWS API Gateway routes to Lambdas
✅ **Consistent architecture** - All business logic in Lambda (Gallery, Streaming, Jobs)
✅ **Auto-scales** - Lambda handles scaling automatically
✅ **Cost-effective** - Pay per request, no idle costs

### Cons
❌ **CRITICAL RISK: Microservices criterion (3 marks)**
- Requirements say: "Must run on separate compute (**separate EC2 instances, separate ECS containers**, or mix)"
- Lambda is NOT mentioned in microservices criterion - only in serverless criterion
- Only have Video Processor ASG as "separate compute" = might only count as 1 microservice ❌
- **Could lose 3 core marks**

❌ **Additional Microservices criterion (2 marks)**
- Requires 4 microservices on separate compute
- If Lambdas don't count, only have 1 service (Video Processor) ❌

### Estimated Marks
**Core Criteria:**
- Microservices: **0-3 marks** ⚠️ (HIGH RISK - only ASG might count)
- Load Distribution: 2 marks ✓ (SQS)
- Auto Scaling: 3 marks ✓ (ASG)
- HTTPS: 2 marks ✓ (ALB + ACM)
- **Core Total: 7-10 marks**

**Additional Criteria:**
- Serverless Functions: 2 marks ✓
- Communication Mechanisms: 2 marks ✓
- Edge Caching: 2 marks ✓
- Additional Microservices: **0 marks** ❌ (Lambdas might not count)
- **Additional Total: 6 marks**

**Grand Total: 13-16 / 24 marks** ⚠️

---

## Option B: Job Service on EC2 Container (Rename api-gateway → job-service)

### Architecture
```
Client → ALB → Job Service (EC2) → SQS → Video Processor ASG
         ↓
    AWS API Gateway → Gallery Lambda
                   → Streaming Lambda
```

### Pros
✅ **Microservices (3 marks GUARANTEED)** - Job Service EC2 + Video Processor ASG = 2+ separate compute instances
✅ **Additional Microservices (2 marks GUARANTEED)** - 4 total:
  1. Job Service (EC2)
  2. Video Processor (ASG)
  3. Gallery Service (Lambda)
  4. Streaming Service (Lambda)

✅ **Serverless Functions (2 marks)** - Gallery and Streaming Lambdas are appropriate lightweight services
✅ **Communication Mechanisms (2 marks)** - ALB routing + SQS + AWS API Gateway
✅ **Demonstrates architectural variety** - Mix of EC2, Lambda, ASG, ALB, API Gateway
✅ **Clear separation of concerns** - Each service has distinct responsibility
✅ **Can add DLQ (2 marks)** - Easy to implement for SQS

### Cons
❌ **Higher cost** - EC2 instance runs 24/7 (~$30/month vs Lambda pay-per-use)
❌ **More to manage** - Need to maintain EC2 instance + Docker container
❌ **Less "cloud-native"** - Not fully serverless

### Estimated Marks
**Core Criteria:**
- Microservices: **3 marks** ✓ (Job EC2 + Video ASG clearly separate)
- Load Distribution: 2 marks ✓ (ALB for Job Service, SQS for Video Processor)
- Auto Scaling: 3 marks ✓ (ASG for Video Processor)
- HTTPS: 2 marks ✓ (ALB + ACM)
- **Core Total: 10/10 marks** ✓

**Additional Criteria:**
- Serverless Functions: 2 marks ✓ (Gallery, Streaming Lambdas)
- Additional Microservices: 2 marks ✓ (4 services total)
- Communication Mechanisms: 2 marks ✓ (ALB, SQS, API Gateway)
- Edge Caching: 2 marks ✓ (CloudFront for videos)
- Dead Letter Queue: 2 marks ✓ (Easy to add for SQS)
- **Additional Total: 10-12 / 14 marks** ✓

**Grand Total: 20-22 / 24 marks** ✓✓✓

---

## Critical Risk Analysis

### The Microservices Requirement
> "At least two separate services on **separate compute instances**"
> "Must run on separate compute (**separate EC2 instances, separate ECS containers**, or mix)"

**Lambda is NOT listed here** - it's only mentioned in the "Serverless Functions" criterion.

**Risk with Option A:**
If markers interpret "separate compute" strictly as EC2/ECS:
- Only Video Processor ASG counts as separate compute
- Lambdas count for serverless criterion, NOT microservices
- **Lose 3 core marks + 2 additional marks = 5 marks**

### The Additional Microservices Requirement
> "Total of at least four microservices. Each service **on its own compute**."

**Risk with Option A:**
- If Lambdas don't count as "own compute", only have 1 service (Video Processor)
- **Lose 2 additional marks**

---

## Recommendation: **Option B (Job Service on EC2)**

### Why Option B is Safer:
1. **Zero risk for Microservices** - EC2 and ASG clearly count as "separate compute instances"
2. **Guaranteed 4 microservices** - Mix of EC2, Lambda, ASG satisfies "or mix"
3. **Higher marks ceiling** - Can achieve 20-22 / 24 marks
4. **Demonstrates architectural variety** - Shows competency with multiple AWS services
5. **Easier to explain in report** - Clear separation of I/O-bound (EC2) vs CPU-bound (ASG) services

### Architecture Details:
```
┌─────────────────────────────────────────────────────────┐
│                    USER (HTTPS)                          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│              APPLICATION LOAD BALANCER                   │
│         (HTTPS Termination + Path Routing)              │
└─────────────────────────────────────────────────────────┘
         ↓                              ↓
    /api/jobs/*                    /api/upload/*, /api/stream/*
         ↓                              ↓
┌──────────────────┐          ┌──────────────────────────┐
│  Job Service     │          │  AWS API Gateway         │
│  (EC2 Container) │          │  (Managed Service)       │
│                  │          └──────────────────────────┘
│  - Create jobs   │                   ↓           ↓
│  - List jobs     │          ┌──────────┐  ┌────────────┐
│  - Update status │          │ Gallery  │  │ Streaming  │
│  - Send to SQS   │          │ Lambda   │  │ Lambda     │
└──────────────────┘          └──────────┘  └────────────┘
         ↓                         ↓
┌──────────────────┐          (S3, RDS)
│   SQS Queue      │
│  (Load Dist)     │
└──────────────────┘
         ↓
┌──────────────────────────────────────────┐
│     AUTO SCALING GROUP (EC2)             │
│     Video Processor Service              │
│                                          │
│  - Poll SQS                              │
│  - Transcode videos (FFmpeg)             │
│  - Update job status                     │
│  - Scale 0-10 based on queue depth       │
└──────────────────────────────────────────┘
```

### Service Breakdown:
1. **Job Service (EC2)** - I/O-bound, manages job lifecycle
2. **Video Processor (ASG)** - CPU-bound, transcodes videos
3. **Gallery Service (Lambda)** - Lightweight, uploads/metadata
4. **Streaming Service (Lambda)** - Lightweight, streaming URLs

---

## Implementation Steps (If choosing Option B):

1. ✅ Keep existing EC2 "api-gateway" container (already running)
2. ✅ Already has job creation + SQS logic (in jobService.js)
3. ✅ Already routing `/api/jobs/*` via ALB
4. ✅ Video Processor ASG already configured
5. ✅ Gallery/Streaming Lambdas already deployed
6. 🔧 **Just need to:** Fix video processor to poll SQS correctly

**Status:** Almost complete, just debugging the SQS polling issue!

---

## Final Verdict

**Choose Option B** because:
- ✅ Low risk - guaranteed to meet all core criteria
- ✅ High marks potential (20-22 / 24)
- ✅ Already mostly implemented
- ✅ Clear architectural justification for report
- ✅ Demonstrates competency with diverse AWS services

The only downside is slightly higher cost (~$30/month for Job Service EC2), but that's negligible compared to potentially losing 5+ marks with Option A.
