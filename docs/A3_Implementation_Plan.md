# Assessment 3 - Cloud Application Implementation Plan
# VideoForge Stream Platform

## Overview
Transform VideoForge into a comprehensive video streaming platform with social features, targeting full marks (34/34) for Assessment 3.

## Assessment Criteria Coverage

### Core Criteria (10 marks - MUST achieve all)

#### Microservices (3 marks)
- **Service 1: API Gateway Service** (ECS) - Authentication, routing, uploads, client serving
- **Service 2: Video Processing Service** (EC2 ASG) - CPU-intensive transcoding to multiple formats
- Separation: API handles I/O intensive tasks, Processing handles CPU intensive tasks
- Deployment: API on ECS for easy scaling, Processing on EC2 for auto-scaling groups

#### Load Distribution (2 marks)
- **SQS Queue** approach for video processing distribution
- API service puts jobs in SQS queue, Processing instances poll for work
- Better than ALB for time-intensive, single-task-per-instance workloads
- Natural load balancing as busy instances don't pick up new jobs

#### Auto Scaling (3 marks)
- **EC2 Auto Scaling Group** for video processing service
- Target: 80% average CPU utilization
- Scale 1→3 instances under load
- Instance type: t3.medium (2 vCPU, 4 GB RAM) with unlimited credit mode
- CloudWatch alarms for scale-out/scale-in decisions

#### HTTPS (2 marks)
- **Application Load Balancer** with ACM certificate
- Routes to API service (ECS) for web client and API endpoints
- Use existing Route53 subdomain: video-forge.cab432.com
- Request new ACM certificate for HTTPS termination

### Additional Criteria (14 marks - Strategic selection)

#### Additional Microservices (2 marks)
**6 Total Services:**
1. **API Gateway Service** (ECS) - Authentication, routing, uploads
2. **Video Processing Service** (EC2 ASG) - Transcoding to multiple formats
3. **Streaming Service** (ECS) - Video delivery, adaptive streaming
4. **Social Service** (ECS) - Comments, likes, saves, follows
5. **Search & Discovery Service** (ECS) - Video search, recommendations
6. **Analytics Service** (ECS) - View tracking, engagement metrics

#### Serverless Functions (2 marks)
- **Upload triggers** - S3 event → Lambda → Processing queue
- **Engagement events** - Like/comment → Lambda → Real-time updates
- **Analytics processing** - Scheduled Lambda → Generate reports
- **Recommendation engine** - Lambda → ML-based suggestions

#### Container Orchestration with ECS (2 marks)
- Deploy API Gateway, Streaming, Social, Search, and Analytics services on ECS
- Use ECS for services that need easy deployment and management
- EC2 reserved for CPU-intensive video processing

#### Advanced Container Orchestration with ECS (2 marks)
- **Service Discovery** - Services automatically find each other using ECS service discovery
- **Rolling Deployments** - Zero-downtime updates with health checks
- **Scheduled Tasks** - ECS scheduled tasks for analytics reports, cleanup jobs

#### Communication Mechanisms (2 marks)
- **SQS queues** - Video processing, notification delivery
- **ALB routing** - Path-based routing to different services (/api/videos, /api/social, etc.)
- **EventBridge** - Cross-service event handling for engagement events
- **WebSocket API** - Real-time comments and engagement updates

#### Custom Scaling Metric (2 marks)
- **Concurrent video streams** - Scale streaming service based on active viewers
- **Processing queue depth** - Scale transcoding workers based on SQS queue size
- **Comment activity rate** - Scale social service based on engagement volume
- Improvement over CPU: More responsive to actual user demand

#### Edge Caching (2 marks)
- **CloudFront CDN** for global video delivery
- **Multiple quality streams** cached globally (4K, 1080p, 720p, 480p, mobile)
- **Thumbnail galleries** for fast browsing experience
- **Metadata caching** for quick search results and video info

## Platform Features

### Core Streaming Features
- **Video Upload Pipeline** - Pre-signed S3 URLs → processing queue
- **Multi-quality Transcoding** - 4K, 1080p, 720p, 480p, mobile optimized
- **Adaptive Streaming** - Player automatically adjusts quality based on bandwidth
- **CDN Distribution** - CloudFront for global content delivery
- **Video Management** - Upload progress, processing status, metadata

### Social Features
- **Comments System** - Real-time comments with WebSocket updates
- **Engagement** - Like/dislike with real-time counters
- **Personal Collections** - Save videos to personal playlists
- **Sharing** - Custom share links with analytics tracking
- **User Profiles** - Creator profiles with video collections

### Discovery & Analytics
- **Search** - Video search with filters (duration, upload date, creator)
- **Recommendations** - Personalized suggestions based on viewing history
- **Analytics** - View counts, engagement metrics, creator dashboards
- **Trending** - Popular videos based on recent engagement

## Technical Architecture

### Video Processing Flow
```
1. User uploads video → Pre-signed S3 URL
2. S3 upload complete → Lambda trigger → SQS message
3. Processing service picks up job → Transcodes to multiple qualities
4. Completed videos → S3 → CloudFront → Available for streaming
5. Metadata extracted → Search index updated → Recommendations updated
```

### Social Interaction Flow
```
User interaction → Social Service → EventBridge → Real-time updates
Comment posted → WebSocket broadcast → Live UI updates
Engagement event → Analytics Service → Metrics tracking
```

### Scaling Strategy
```
High upload volume → SQS queue depth increases → Auto-scaling triggers
More viewers → Stream count increases → Streaming service scales
High engagement → Comment rate increases → Social service scales
```

## Implementation Timeline (4 weeks)

### Phase 1: Core Streaming Infrastructure (Week 1)
**Priority: Core marks guarantee**
- [ ] Split current app into API Gateway and Video Processing services
- [ ] Create SQS queue for job distribution
- [ ] Deploy API service on ECS, Processing service on EC2
- [ ] Implement multi-quality video transcoding
- [ ] Basic video upload and streaming functionality
- [ ] Test end-to-end video processing pipeline

### Phase 2: Auto-scaling & HTTPS (Week 2)
**Priority: Complete core requirements**
- [ ] Set up Auto Scaling Group for processing service
- [ ] Configure CloudWatch metrics and alarms
- [ ] Implement ALB with ACM certificate
- [ ] Set up CloudFront CDN for video delivery
- [ ] Load testing and scaling validation
- [ ] Performance optimization for video streaming

### Phase 3: Additional Services & Features (Week 3)
**Priority: Additional marks accumulation**
- [ ] Deploy Streaming, Social, Search, Analytics services on ECS
- [ ] Implement Lambda functions for event handling
- [ ] Add ECS service discovery and rolling deployments
- [ ] Build comments and engagement features
- [ ] Implement basic search and discovery
- [ ] Set up custom scaling metrics

### Phase 4: Advanced Features & Polish (Week 4)
**Priority: Maximum marks and demo preparation**
- [ ] Complete social features (likes, saves, shares)
- [ ] Add recommendation system
- [ ] Implement analytics dashboard
- [ ] Create Terraform IaC scripts
- [ ] End-to-end testing and optimization
- [ ] Prepare demo video and documentation

## Risk Mitigation

### High Priority (Must Complete)
1. **Core video streaming** - Upload, process, stream basic functionality
2. **Auto-scaling demonstration** - 1→3 instances with load testing
3. **HTTPS setup** - ALB + ACM certificate working
4. **Basic microservices** - At least API + Processing services separated

### Medium Priority (Additional Marks)
1. **Social features** - Comments and engagement (can be simplified)
2. **CDN optimization** - Video caching and performance
3. **Advanced ECS features** - Service discovery, rolling updates
4. **Custom metrics** - Queue depth and stream count scaling

### Lower Priority (Polish)
1. **Advanced recommendations** - ML-based suggestions
2. **Complex analytics** - Detailed reporting dashboards
3. **Advanced social** - Real-time collaboration features

## Success Criteria

### Minimum Viable Product (32+ marks)
- Working video upload and streaming
- Basic auto-scaling demonstration
- HTTPS with valid certificate
- At least 4 microservices deployed
- Basic social features (comments/likes)

### Target Implementation (34 marks)
- Full streaming platform with all planned features
- Comprehensive auto-scaling with custom metrics
- Advanced ECS features demonstrated
- Complete social interaction system
- Professional-grade CDN and caching

## Report Strategy

### Architecture Justification
- **Microservices boundaries** based on scaling characteristics
- **SQS vs ALB** choice for video processing workloads
- **ECS vs EC2** decisions for different service types
- **Custom scaling metrics** rationale and benefits

### Scalability Discussion
- **Horizontal scaling patterns** for different workload types
- **Performance optimization** through caching and CDN
- **Cost optimization** strategies for video storage and delivery
- **Security considerations** for video content and user data

### Business Case
- **Market opportunity** - Video streaming platform demand
- **Monetization strategies** - Subscriptions, ads, creator tools
- **Competitive analysis** - How architecture enables competitive advantages
- **Growth planning** - How system scales to enterprise levels

---

**Document Status:** Initial Plan v1.0
**Last Updated:** 2025-10-02
**Next Review:** After Phase 1 completion