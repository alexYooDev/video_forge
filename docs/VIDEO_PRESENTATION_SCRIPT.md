# VideoForge - A3 Video Presentation Script

**Total Duration:** ~10 minutes
**Student:** Alex Yoo - N12159069
**Project:** VideoForge - Video Transcoding and Streaming Platform

---

## Introduction (30 seconds)

**[Screen: Browser showing VideoForge application]**

> "Hello, I'm Alex Yoo, and this is VideoForge - a cloud-native video transcoding and streaming platform built on AWS. This demonstration will show how VideoForge uses multiple AWS services including EC2, ECS Fargate, Lambda, SQS, and CloudFront to create a scalable microservices architecture."

---

## 1. Microservices Architecture (2 minutes)

### 1.1 Job-Service (EC2)

**[Screen: AWS Console → EC2 → Instances]**

> "First, let me show you the seven microservices in VideoForge. Here's the Job-Service running on EC2 instance [instance-id]. This is the main REST API that handles video upload requests, job management, and publishes messages to SQS for processing."

**[Click on instance to show details, port 8080]**

### 1.2 Client (EC2)

**[Screen: AWS Console → EC2 → Instances]**

> "The Client frontend is a separate EC2 instance [instance-id] running a Dockerized React application with nginx. This demonstrates separation of frontend and backend concerns."

**[Show instance running on port 3000]**

### 1.3 Video-Processor (EC2 Auto Scaling Group)

**[Screen: AWS Console → EC2 → Auto Scaling Groups]**

> "The Video-Processor service runs on an Auto Scaling Group called 'video-forge-video-processor-asg'. This service polls SQS for jobs and performs CPU-intensive video transcoding using FFmpeg. It currently has [X] instances running and can scale from 1 to 3 instances based on queue depth."

**[Click on ASG to show configuration: min=1, max=3, desired=1]**

### 1.4 Auth-Service (ECS Fargate)

**[Screen: AWS Console → ECS → Clusters → n12159069-video-forge-cluster]**

> "The Auth-Service runs on ECS Fargate as a serverless container. This service handles user authentication via AWS Cognito, JWT token generation, and token verification."

**[Click on auth-service → Show tasks running]**
**[Click on task to show 0.25 vCPU, 512MB memory]**

### 1.5 Admin-Dashboard (ECS Fargate)

**[Screen: Still in ECS cluster]**

> "The Admin-Dashboard service also runs on ECS Fargate. This service provides admin APIs for user management, job statistics, and system monitoring."

**[Click on admin-dashboard service → Show task definition: 0.25 vCPU, 512MB, port 11434]**

### 1.6 Gallery-Service (Lambda)

**[Screen: AWS Console → Lambda → Functions]**

> "The Gallery-Service is deployed as a Lambda function. It handles video gallery CRUD operations, upload URL generation, and video confirmation. This service uses Node.js 22.x runtime with 512MB memory."

**[Click on video-forge-gallery-service → Show configuration]**
**[Show Function URL enabled]**

### 1.7 Streaming-Service (Lambda)

**[Screen: Still in Lambda functions]**

> "The Streaming-Service is also a Lambda function that generates CloudFront signed URLs for secure video streaming with 1-hour expiration."

**[Click on video-forge-streaming-service → Show configuration]**

---

## 2. Load Distribution (1 minute)

**[Screen: AWS Console → SQS → Queues]**

> "VideoForge uses Amazon SQS for load distribution. Here's the 'video-forge-video-processing-queue' that decouples the Job-Service from the Video-Processor. When users upload videos, jobs are published here and consumed by multiple processor instances."

**[Click on queue to show details]**
**[Show Messages Available, Messages In Flight]**

> "The queue has a visibility timeout of 300 seconds and is configured with a dead-letter queue for failed messages."

**[Screen: AWS Console → EC2 → Target Groups]**

> "For HTTP traffic, we use an Application Load Balancer with target groups. Here's the Job-Service target group routing traffic to the main API."

**[Show target group with health checks]**

---

## 3. Dead Letter Queue (1 minute)

**[Screen: AWS Console → SQS → video-forge-video-processing-queue-dlq]**

> "Here's the dead-letter queue configured to capture messages that fail processing after 3 retry attempts. This prevents problematic messages like corrupted videos from blocking the main queue."

**[Show DLQ with message count]**
**[Click on queue → Send and receive messages → Poll for messages]**

> "If a video processing job fails three times - for example, due to an unsupported codec or corrupted file - it appears here. These messages are retained for 14 days, allowing us to debug issues without losing data."

**[If messages exist, show message body with job details]**

> "In production, these messages would trigger CloudWatch alarms to alert the operations team."

---

## 4. Communication Mechanisms (1 minute)

**[Screen: AWS Console → EC2 → Load Balancers]**

> "VideoForge uses three communication mechanisms. First, the Application Load Balancer provides HTTPS routing with path-based rules."

**[Click on ALB → Listeners → View rules]**

> "You can see rules routing /api/jobs to Job-Service, /api/auth to Auth-Service ECS tasks, and /api/admin to the Admin-Dashboard service."

**[Screen: AWS Console → Lambda → video-forge-gallery-service → Configuration → Function URL]**

> "Second, Lambda Function URLs provide direct HTTPS endpoints for the Gallery and Streaming services without needing the ALB."

**[Show Function URL]**

**[Screen: AWS Console → SQS dashboard]**

> "And third, SQS provides asynchronous communication between Job-Service and Video-Processor, enabling horizontal scaling and fault tolerance."

---

## 5. Auto-Scaling with Custom Metric (2.5 minutes)

### 5.1 Configuration

**[Screen: AWS Console → EC2 → Auto Scaling Groups → video-forge-video-processor-asg]**

> "Now let me demonstrate auto-scaling. The Video-Processor ASG uses a custom scaling metric - SQS queue depth - instead of CPU utilization."

**[Click on Automatic Scaling tab → Show Target Tracking Policy]**

> "The Target Tracking policy monitors 'ApproximateNumberOfMessagesVisible' with a target value of 5 messages per instance. This means when the queue has more than 5 messages, the ASG scales out."

**[Show policy details: metric=SQS ApproximateNumberOfMessagesVisible, target=5]**

**[Click on Monitoring tab]**

> "Here's the initial state with 1 instance in service and an empty queue."

**[Show graph: In Service Instances = 1, SQS queue depth ≈ 0]**

### 5.2 Scale-Out Demonstration

**[Screen: Terminal or Script]**

> "I'm now submitting 15 video processing jobs to trigger scaling."

**[Run script to publish 15 messages to SQS]**

```bash
# Example command shown on screen
for i in {1..15}; do
  aws sqs send-message --queue-url [queue-url] \
    --message-body "{\"jobId\": \"test-$i\", \"videoKey\": \"test.mp4\"}"
done
```

**[Screen: AWS Console → SQS queue]**

> "The queue now has 15 messages available."

**[Show Messages Available: ~15]**

**[EDIT: Jump ahead ~2 minutes]**

**[Screen: AWS Console → EC2 → Auto Scaling Groups → Monitoring tab]**

> "After about 2 minutes, the ASG has scaled to 3 instances. You can see the queue depth triggered the scale-out when it exceeded the target of 5 messages per instance."

**[Show graphs:]**
- **In Service Instances: 3**
- **SQS Approximate Number of Messages Visible: declining from 15 → ~5**

**[Click on Activity tab]**

> "The Activity history shows the launch of instances at [timestamps]."

**[Show instance launch events]**

### 5.3 Scale-In Demonstration

**[EDIT: Jump ahead ~5 minutes]**

**[Screen: AWS Console → Auto Scaling Groups → Monitoring tab]**

> "Now that all jobs are processed and the queue is empty, the ASG is scaling back down to 1 instance. The scale-in cooldown period is 300 seconds to prevent thrashing."

**[Show graphs:]**
- **In Service Instances: 1**
- **SQS Approximate Number of Messages Visible: 0**

**[Click on Activity tab]**

> "The Activity history confirms instances were terminated as the queue emptied."

**[Show instance termination events]**

---

## 6. HTTPS with Custom Domain (30 seconds)

**[Screen: Browser → https://video-forge-v2.cab432.com]**

> "VideoForge is accessible via HTTPS at video-forge-v2.cab432.com. Notice the lock icon and https:// in the address bar, confirming the secure connection."

**[Click lock icon to show certificate details]**

**[Screen: AWS Console → Certificate Manager]**

> "Here's the ACM certificate for video-forge-v2.cab432.com with status 'Issued'."

**[Show certificate ARN, domain name, validation status]**

**[Screen: AWS Console → EC2 → Load Balancers → Listeners]**

> "The Application Load Balancer's HTTPS listener on port 443 uses this certificate, and HTTP traffic on port 80 is redirected to HTTPS."

**[Show listener rules: Port 443 with ACM certificate, Port 80 redirect to 443]**

---

## 7. Container Orchestration Features (1 minute)

**[Screen: AWS Console → ECS → Task Definitions → n12159069-auth-service]**

> "The ECS services demonstrate four container orchestration features. First, health checks."

**[Click on latest revision → JSON tab → Scroll to healthCheck section]**

> "The Auth-Service container has HTTP health checks on /health endpoint every 30 seconds with automatic restart on failure."

**[Screen: CloudWatch → Log Groups → /ecs/video-forge-auth-service]**

> "Second, CloudWatch Logs integration. All container logs are centralized here for debugging and monitoring."

**[Show recent log streams]**

**[Screen: ECS Task Definition JSON → secrets section]**

> "Third, AWS Secrets Manager integration. The JWT secret is retrieved securely at container startup without hardcoding credentials."

**[Show secrets array with Secrets Manager ARN]**

**[Screen: ECS Cluster → auth-service → Configuration]**

> "Fourth, IAM task and execution roles implement least-privilege access. The task role grants runtime permissions like Cognito access, while the execution role pulls Docker images and retrieves secrets."

**[Show IAM roles]**

---

## 8. Infrastructure as Code (30 seconds)

**[Screen: AWS Console → CloudFormation → Stacks]**

> "VideoForge infrastructure is deployed using CloudFormation. Here are the four nested stacks: SQS queues, Lambda functions, Video-Processor ASG, and CloudFront CDN."

**[Show stacks:]**
- **video-forge-sqs-stack** (CREATE_COMPLETE)
- **video-forge-lambda-stack** (CREATE_COMPLETE)
- **video-forge-asg-stack** (CREATE_COMPLETE)
- **video-forge-cloudfront-stack** (CREATE_COMPLETE)

**[Click on one stack → Resources tab]**

> "Each stack manages multiple resources. For example, the SQS stack created both the main processing queue and the dead-letter queue, totaling over 1,127 lines of YAML templates."

**[Show resources managed by stack]**

---

## 9. Edge Caching (30 seconds)

**[Screen: AWS Console → CloudFront → Distributions]**

> "Finally, CloudFront distribution E2RUBI217JZAKW provides edge caching for video content."

**[Click on distribution → Origins tab]**

> "The origin is the S3 bucket 'video-forge-storage' containing transcoded videos and thumbnails."

**[Show origin domain: video-forge-storage.s3.ap-southeast-2.amazonaws.com]**

**[Click on Behaviors tab]**

> "The cache behavior uses a 24-hour TTL to reduce S3 data transfer costs by serving frequently accessed videos from CloudFront's 200+ edge locations worldwide."

**[Show default cache behavior settings: TTL=86400 seconds, HTTPS only]**

> "This caching reduces latency for end users and offloads S3 during traffic spikes, while signed URLs ensure only authenticated users can access videos."

---

## Conclusion (15 seconds)

**[Screen: Architecture diagram or VideoForge dashboard]**

> "This concludes the demonstration of VideoForge - a scalable, cloud-native video platform using EC2, ECS, Lambda, SQS auto-scaling, HTTPS, CloudFormation, and CloudFront. The architecture demonstrates effective use of AWS services matched to workload characteristics. Thank you."

---

## Video Recording Tips

### Preparation Checklist:
- [ ] Clear browser cache/cookies
- [ ] Close unnecessary browser tabs
- [ ] Set browser zoom to 100% for readability
- [ ] Have all AWS Console tabs pre-opened
- [ ] Test screen recording software (OBS/QuickTime/Zoom)
- [ ] Run test transcoding jobs to populate metrics
- [ ] Prepare script for submitting 15 SQS messages
- [ ] Rehearse transitions between sections
- [ ] Verify all services are running
- [ ] Check that DLQ has some messages (or create failed job)

### Recording Recommendations:
1. **Record in segments**: Record each section separately and edit together
2. **Edit out waiting**: For auto-scaling, record initial state, trigger scaling, then jump to scaled state
3. **Screen resolution**: Use 1920x1080 or 1280x720 for readability
4. **Mouse visibility**: Enable mouse highlight in OBS or use presentation mode
5. **Audio clarity**: Use headset microphone, minimize background noise
6. **Pace**: Speak clearly and at moderate pace (not too fast)

### Time-Saving Edits:
- **Auto-scaling**: Show 1 instance → submit jobs → [cut] → show 3 instances → [cut] → show 1 instance (saves 5-7 minutes)
- **CloudFormation deployment**: Just show existing stacks, don't deploy from scratch
- **Container health checks**: Show configuration, don't wait for actual failure/restart
- **DLQ demonstration**: Prepare failed messages beforehand, just show polling

### AWS Console Navigation Order:
1. Browser (VideoForge app)
2. EC2 Instances (Job-Service, Client, Video-Processor ASG)
3. ECS Cluster (Auth-Service, Admin-Dashboard)
4. Lambda (Gallery, Streaming)
5. SQS (Main queue, DLQ)
6. EC2 Load Balancers (ALB listeners, target groups)
7. EC2 Auto Scaling Groups (Scaling policy, monitoring, activity)
8. Certificate Manager (ACM certificate)
9. ECS Task Definitions (Health checks, secrets, IAM roles)
10. CloudFormation (Stacks)
11. CloudFront (Distribution, origins, behaviors)

---

## Timestamps for Video Markers

Record these timestamps while editing for the submission notes:

- **Microservices (all 7)**: [00:00 - 02:00]
- **Load Distribution (SQS)**: [02:00 - 03:00]
- **Dead Letter Queue**: [03:00 - 04:00]
- **Communication Mechanisms**: [04:00 - 05:00]
- **Auto-Scaling + Custom Metric**: [05:00 - 07:30]
- **HTTPS**: [07:30 - 08:00]
- **Container Orchestration**: [08:00 - 09:00]
- **Infrastructure as Code**: [09:00 - 09:30]
- **Edge Caching**: [09:30 - 10:00]

---

**Good luck with your recording!** 🎥
