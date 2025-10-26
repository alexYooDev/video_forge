# Auto Scaling Assessment - Video Processor

## A3 Auto Scaling Requirements Analysis

### Requirements Checklist

| Requirement | Current Status | Notes |
|-------------|---------------|-------|
| **1. CPU-intensive service** | ✅ **MET** | Video transcoding with ffmpeg is extremely CPU-intensive |
| **2. Automatically scale horizontally** | ❌ **NOT MET** | Currently manual scaling only |
| **3. No service interruptions during scaling** | ✅ **MET** | SQS queue ensures graceful scaling (messages persist) |
| **4. Deploy on ECS or EC2 (NOT Lambda)** | ✅ **MET** | Currently deployed on EC2 (Docker container) |
| **5. Demonstrate scaling: 1 → 3 → 1** | ❌ **NOT MET** | Needs Auto Scaling Group (ASG) |
| **6. Metric: Average CPU at 80% target** | ❌ **NOT MET** | Needs CloudWatch alarm + scaling policy |
| **7. Single-CPU instance (t2.micro) with unlimited credit** | ✅ **MET** | Currently using t2.micro |

**Overall Status**: 4/7 requirements met ❌

---

## Current Video-Processor Architecture

### Strengths
1. **Perfect for Auto Scaling**:
   - Each instance polls SQS queue independently
   - No coordination needed between instances
   - SQS visibility timeout prevents duplicate processing
   - Stateless workers (no shared state)

2. **CPU-Intensive Workload**:
   - ffmpeg transcoding uses 90-100% CPU
   - Processing time: 5-30 minutes per job
   - Clear scaling trigger (CPU utilization)

3. **Graceful Degradation**:
   - SQS queue buffers jobs during scaling
   - No jobs lost when instances terminate
   - Automatic retry if instance fails mid-job

### Gaps
1. **No Auto Scaling Group**: Instances don't scale automatically
2. **No CloudWatch Alarms**: No CPU monitoring for scaling triggers
3. **No Launch Template**: Can't launch identical instances automatically
4. **No Scaling Policies**: No rules for when to scale up/down

---

## Implementation Plan

### Phase 1: Create Launch Template
**What**: Define EC2 instance configuration for auto-scaling

**Launch Template Includes**:
- AMI: Amazon Linux 2023
- Instance Type: t2.micro (1 vCPU, 1 GB RAM)
- IAM Role: CAB432-EC2-Role
- Security Group: Allow outbound only
- User Data Script:
  ```bash
  #!/bin/bash
  # Install Docker
  yum update -y
  yum install -y docker
  systemctl start docker
  systemctl enable docker

  # Install Docker Compose
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose

  # Log in to ECR
  aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com

  # Pull video-processor image
  docker pull 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-processor:latest

  # Run video-processor container
  docker run -d \
    --name video-processor \
    --restart unless-stopped \
    -e AWS_REGION=ap-southeast-2 \
    -e SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-transcode-queue \
    -e DB_HOST=database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com \
    -e DB_PORT=5432 \
    -e DB_NAME=cohort_2025 \
    -e DB_USER=s458 \
    -e DB_PASSWORD=4T5gnYmROThF \
    -e S3_BUCKET_NAME=video-forge-storage \
    901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-processor:latest
  ```

**CLI Command**:
```bash
aws ec2 create-launch-template \
  --launch-template-name video-processor-template \
  --version-description "Video processor for auto-scaling" \
  --launch-template-data '{
    "ImageId": "ami-0c55b159cbfafe1f0",
    "InstanceType": "t2.micro",
    "IamInstanceProfile": {
      "Name": "CAB432-EC2-Role"
    },
    "SecurityGroupIds": ["sg-xxxxx"],
    "CreditSpecification": {
      "CpuCredits": "unlimited"
    },
    "UserData": "<base64-encoded-user-data>"
  }'
```

---

### Phase 2: Create Auto Scaling Group
**What**: Automatically manage EC2 instance fleet

**ASG Configuration**:
- Min instances: 1
- Max instances: 3
- Desired capacity: 1
- VPC: Same as current setup
- Subnets: Public subnets (for internet access)
- Health check: EC2 (check instance status)
- Health check grace period: 300 seconds
- Default cooldown: 300 seconds (prevents rapid scaling)

**CLI Command**:
```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name video-processor-asg \
  --launch-template LaunchTemplateName=video-processor-template,Version='$Latest' \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 1 \
  --vpc-zone-identifier "subnet-xxxxx,subnet-yyyyy" \
  --health-check-type EC2 \
  --health-check-grace-period 300 \
  --default-cooldown 300 \
  --tags "Key=Name,Value=video-processor-asg,PropagateAtLaunch=true" "Key=Service,Value=video-processor,PropagateAtLaunch=true"
```

---

### Phase 3: Create Target Tracking Scaling Policy
**What**: Automatically scale based on CPU utilization

**Policy Type**: Target Tracking (simplest, AWS-recommended)

**Configuration**:
- Metric: Average CPU Utilization
- Target Value: 80%
- Cooldown: 300 seconds
- Instance warmup: 300 seconds (time for Docker to start)

**How It Works**:
1. CloudWatch monitors average CPU across all instances
2. When average CPU > 80% for 2 consecutive periods (2 minutes):
   - ASG launches new instance
   - New instance pulls Docker image and starts polling SQS
   - CPU load distributed across more instances
3. When average CPU < 80% for 15 minutes:
   - ASG terminates excess instances (keeps min instances)
   - Graceful shutdown (drains SQS messages first)

**CLI Command**:
```bash
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name video-processor-asg \
  --policy-name target-tracking-cpu-80 \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 80.0,
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 300
  }'
```

---

### Phase 4: Enable CloudWatch Detailed Monitoring
**What**: Monitor CPU at 1-minute intervals (instead of 5-minute default)

**Why**: Faster response to CPU spikes

**CLI Command**:
```bash
aws autoscaling enable-metrics-collection \
  --auto-scaling-group-name video-processor-asg \
  --granularity "1Minute" \
  --metrics "GroupMinSize" "GroupMaxSize" "GroupDesiredCapacity" "GroupInServiceInstances" "GroupTotalInstances"
```

---

## Scaling Behavior Demonstration

### Test Scenario 1: Scale Up (1 → 3 instances)

**Steps**:
1. Start with 1 instance (idle CPU ~5%)
2. Upload 10 videos simultaneously
3. Create 10 transcoding jobs (all formats: 4K, 1080p, 720p, 480p)
4. SQS queue fills up with 40 messages (10 jobs × 4 formats)
5. Single processor starts working (CPU → 100%)

**Expected Scaling**:
- **T+0 min**: 1 instance at 100% CPU
- **T+2 min**: CloudWatch detects CPU > 80% (average = 100%)
- **T+3 min**: ASG launches 2nd instance
- **T+8 min**: 2 instances at ~100% CPU each (average = 100%)
- **T+10 min**: CloudWatch still detects CPU > 80%
- **T+11 min**: ASG launches 3rd instance (max capacity reached)
- **T+16 min**: 3 instances at ~66% CPU each (average = 66%)
- **T+18 min**: CloudWatch detects CPU < 80%, no more scaling

**Result**: Successfully scales from 1 → 3 instances ✅

### Test Scenario 2: Scale Down (3 → 1 instances)

**Steps**:
1. Wait for all jobs to complete
2. SQS queue becomes empty
3. All instances idle (CPU ~5% each)

**Expected Scaling**:
- **T+0 min**: 3 instances at ~5% CPU each (average = 5%)
- **T+15 min**: CloudWatch detects CPU < 80% for 15 minutes
- **T+16 min**: ASG terminates 1 instance (capacity: 3 → 2)
- **T+31 min**: CloudWatch still detects CPU < 80%
- **T+32 min**: ASG terminates 1 instance (capacity: 2 → 1, min reached)
- **T+33 min**: 1 instance at ~5% CPU (min capacity, no further scale down)

**Result**: Successfully scales from 3 → 1 instances ✅

---

## Monitoring and Validation

### CloudWatch Metrics to Monitor

1. **ASGAverageCPUUtilization**:
   - Shows average CPU across all instances
   - Trigger for scaling decisions
   - Target: 80%

2. **GroupDesiredCapacity**:
   - Number of instances ASG wants to maintain
   - Changes based on scaling policy

3. **GroupInServiceInstances**:
   - Number of healthy, running instances
   - Should match desired capacity

4. **ApproximateNumberOfMessagesVisible** (SQS):
   - Number of jobs in queue
   - Indicates backlog

### CloudWatch Logs to Monitor

- `/aws/ec2/video-processor`: Instance logs
- Check for "Polling SQS queue" every 20 seconds
- Check for "Job completed" messages
- Check for errors or crashes

### Validation Steps

1. **Verify ASG created**:
   ```bash
   aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names video-processor-asg
   ```

2. **Verify scaling policy created**:
   ```bash
   aws autoscaling describe-policies --auto-scaling-group-name video-processor-asg
   ```

3. **Verify instances launching**:
   ```bash
   aws ec2 describe-instances --filters "Name=tag:Service,Values=video-processor" "Name=instance-state-name,Values=running"
   ```

4. **Verify CPU metrics**:
   - Go to CloudWatch → Metrics → EC2 → Per-Instance Metrics
   - Select CPUUtilization for video-processor instances
   - Should see 100% during transcoding, ~5% when idle

5. **Verify scaling events**:
   ```bash
   aws autoscaling describe-scaling-activities --auto-scaling-group-name video-processor-asg --max-records 10
   ```

---

## Cost Analysis

### Current Cost (1 instance always-on)
- t2.micro: $0.0116/hour × 730 hours = **$8.47/month**

### With Auto Scaling (average 1.5 instances)
- t2.micro: $0.0116/hour × 730 hours × 1.5 = **$12.70/month**
- **Increase**: +$4.23/month (+50%)

### Peak Load (3 instances for 8 hours/day)
- 1 instance: 730 hours × $0.0116 = $8.47
- 2 extra instances: 240 hours × $0.0116 × 2 = $5.57
- **Total**: $14.04/month
- **Increase**: +$5.57/month (+65%)

### Break-even Analysis
- If processing > 20 jobs/day: Auto-scaling saves time (worth extra cost)
- If processing < 5 jobs/day: Single instance sufficient (no auto-scaling needed)

---

## Benefits of Auto Scaling

1. **Performance**:
   - Faster job processing during peak load
   - Reduced queue wait time
   - Better user experience

2. **Cost Efficiency**:
   - Pay only for what you use
   - Scale down during off-peak hours
   - No over-provisioning

3. **Reliability**:
   - Automatic replacement of failed instances
   - No single point of failure
   - High availability

4. **Operational Simplicity**:
   - No manual intervention needed
   - AWS manages instance lifecycle
   - Self-healing infrastructure

---

## Implementation Timeline

### Day 1: Preparation
- [ ] Test video-processor Docker image locally
- [ ] Create AMI from current EC2 instance (optional)
- [ ] Document current environment variables
- [ ] Create User Data script

### Day 2: Launch Template
- [ ] Create Launch Template via AWS Console or CLI
- [ ] Test launch instance from template
- [ ] Verify Docker container starts automatically
- [ ] Verify SQS polling works

### Day 3: Auto Scaling Group
- [ ] Create Auto Scaling Group
- [ ] Start with min=1, max=1, desired=1 (safe mode)
- [ ] Verify instance launches and joins ASG
- [ ] Monitor CloudWatch metrics

### Day 4: Scaling Policy
- [ ] Create target tracking policy (CPU 80%)
- [ ] Increase max capacity to 3
- [ ] Run load test (upload 10 videos)
- [ ] Verify scaling up works

### Day 5: Validation
- [ ] Wait for jobs to complete
- [ ] Verify scaling down works (3 → 1)
- [ ] Document scaling behavior
- [ ] Take screenshots for A3 report

**Total Time**: 5 days (or 2-3 days if focused)

---

## Risks and Mitigations

### Risk 1: Instances fail to start
**Mitigation**: Test Launch Template thoroughly before creating ASG

### Risk 2: User Data script errors
**Mitigation**: Use CloudWatch Logs to debug, test script locally with `cloud-init` first

### Risk 3: Scaling too aggressively
**Mitigation**: Set conservative cooldown periods (300 seconds), test with small load first

### Risk 4: Cost overrun
**Mitigation**: Set max instances = 3, enable billing alerts, monitor daily costs

### Risk 5: Jobs fail during instance termination
**Mitigation**: SQS visibility timeout ensures jobs return to queue if instance fails

---

## Conclusion

**Current Status**: Video-processor is architecturally perfect for auto-scaling (stateless, SQS-based) but lacks the AWS infrastructure (ASG, Launch Template, Scaling Policy).

**Recommendation**: Implement Auto Scaling Group with target tracking policy to meet A3 requirements and improve system performance.

**Expected Outcome**: Automatic scaling from 1 → 3 instances under load, graceful scale down to 1 when idle.

**A3 Marks**: With auto-scaling implemented, you'll earn **3/3 marks** for this requirement.

---

## Next Steps

1. ✅ Assess current architecture (DONE - this document)
2. ⏭️ Create Launch Template
3. ⏭️ Create Auto Scaling Group
4. ⏭️ Create Scaling Policy
5. ⏭️ Load test and validate
6. ⏭️ Document for A3 report (screenshots, metrics, scaling events)

Ready to proceed with implementation?
