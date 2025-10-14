# CAB432 Assessment 3 - Cloud Application

## Overview

This assessment focuses on horizontal scalability, cloud architecture, and communication patterns. You'll submit code, a demonstration video, and a report discussing implementation choices, security, and sustainability.

**Due Date:** Friday, October 24, 2025 -> With auto-extension October 26, 2025

## Working in Pairs

- **Optional:** You can work individually or in pairs
- Same marking criteria apply to both individuals and pairs
- Can continue with Assessment 2 partner, change partners, or work alone
- Sign up your pair on Canvas under the People tab (find group A3-Pairs N)
- If one partner gets an extension, it automatically applies to both

### Finding a Partner

Use the "Find partners for assessments 2 and 3" Teams channel. Ensure you discuss:
- Target grade
- Meeting schedule and availability
- Complementary skills

## Approved AWS Services

**General Purpose Services (approved across all criteria):**
- EC2 instances
- Route53
- S3
- EFS
- RDS
- DynamoDB
- CDK
- SDK
- CloudFormation
- Parameter Store
- Secrets Manager
- Cognito

**Note:** Services with substantially the same functionality won't count separately (e.g., MySQL on EC2 + RDS).

---

## Core Criteria (10 marks)

### 1. Microservices (3 marks)

**Requirements:**
- At least two separate services on separate compute instances
- Separation must be appropriate, not arbitrary
- Example: One service provides REST API/web client, another handles CPU-intensive processing
- Must run on separate compute (separate EC2 instances, separate ECS containers, or mix)

**Approved Services:** EC2, ECS

### 2. Load Distribution (2 marks)

**Requirements:**
- Appropriate mechanism for distributing load to multiple instances
- Options:
  - Application Load Balancer (for services handling multiple simultaneous requests)
  - Message Queue like SQS (for time-intensive or single-task processes)

**Approved Services:** Any load balancer type, SQS

### 3. Auto Scaling (3 marks)

**Requirements:**
- CPU-intensive service must automatically scale horizontally
- No service interruptions during scaling (graceful degradation acceptable)
- Deploy on ECS or EC2 (**NOT Lambda**)
- Demonstrate scaling: 1 → 3 instances under load → back to 1 when load reduces
- Default metric: Average CPU utilization at 70% target
- For EC2 single-threaded apps: Use single-CPU instance (e.g., t2.micro) with unlimited credit

**Approved Services:** Auto-scaling groups (EC2), Target groups, Application Auto Scaling (ECS), CloudWatch, Lambda (for custom metrics only)

### 4. HTTPS (2 marks)

**Requirements:**
- Public internet access over HTTPS with valid certificate
- Set up subdomain of cab432.com in Route 53 with CNAME
- Request and obtain certificate using ACM
- Use API Gateway or ALB configured with certificate

**Approved Services:** Route53, ALB, API Gateway, CloudFront, Certificate Manager

---

## Additional Criteria (14 marks maximum)

**Important Notes:**
- You do NOT need to attempt all additional criteria
- Marking stops once 14 marks are considered
- Choose the most appropriate for your application
- Must explicitly indicate which criteria to mark

### 1. Additional Microservices (2 marks)

- Total of at least four microservices
- Each service on its own compute
- Division must be appropriate, not arbitrary

**Approved Services:** Same as core microservices criterion

### 2. Serverless Functions (2 marks)

**Appropriate Uses:**
- Custom autoscaling mechanisms
- Event-driven responses (e.g., S3 upload triggers)
- Lightweight public-facing services

**NOT acceptable:** Lambda for CPU-intensive tasks

**Approved Services:** Lambda, EventBridge

### 3. Container Orchestration with ECS (2 marks)

- Deploy at least one microservice using ECS

**Approved Services:** ECS

### 4. Advanced Container Orchestration with ECS (2 marks)

**Requirements:** At least two of the following:
- Service discovery
- Rolling updates with failure detection
- Tasks launched in response to events or on schedule

**Approved Services:** ECS

### 5. Communication Mechanisms (2 marks)

- Additional communication services beyond load distribution
- Examples: Queues, API gateways, ALB routing, pub/sub mechanisms
- API Gateway functionality in ALB counts separately from load balancing
- ALB/API Gateway used solely for TLS does NOT count

**Approved Services:** SQS, API Gateway, load balancers, EventBridge

### 6. Custom Scaling Metric (2 marks)

**Requirements:**
- Use metric other than average CPU utilization
- Must demonstrate:
  - Appropriate scaling and load distribution
  - Improvement over CPU utilization
  - Scalability across different instance counts

**Approved Services:** CloudWatch, Lambda

### 7. Infrastructure as Code (2 marks)

- Deploy AWS services using IaC for this assessment
- Don't need to include services from Assessments 1 or 2
- Focus on services from Block 3 on AWS Services Available page

**Approved Services:** Terraform, CDK, CloudFormation

### 8. Dead Letter Queue (2 marks)

**Requirements:**
- Only applicable if using SQS
- Use DLQ feature to handle messages that fail processing
- Implement appropriate handling of DLQ messages

**Approved Services:** SQS and associated workers

### 9. Edge Caching (2 marks)

**Requirements:**
- Make appropriate use of CloudFront
- Data should be accessed frequently (in imagined large-scale deployment)
- Cache infrequently changed/static data
- Good candidates: Static HTML/CSS/JS/images, React builds

**Approved Services:** CloudFront, ElastiCache

### 10. Upon Request (2 marks)

- Must seek coordinator approval
- For other functionality demonstrating high achievement
- Speak to coordinator before attempting

---

## Report (21 marks)

Your report must cover:

1. **Architecture Description and Diagram**
   - Clear visualization of your application architecture

2. **Justification for Architecture Choices**
   - Explain design decisions

3. **Scalability and Security Discussion**
   - Further development needed for large-scale deployment

4. **Sustainability Implications**
   - How architecture choices affect sustainability

5. **Cost Estimate**
   - Calculated using AWS Pricing Calculator

See "3.1 Submission specification" for further details.

---

## Submission Components

Your submission includes three parts:

1. **Code**
2. **Demonstration Video**
   - Similar format to Assessments 1 and 2
3. **Report**

See "3.1 Submission specification" for detailed requirements.

---

## Technologies

**No special permission required for:**
- Technologies approved in Assessments 1 or 2
- All AWS services listed in "AWS services available" page

---

## Feedback

- Marks via Canvas rubric within 10-15 working days
- Written feedback on each criterion
- Use feedback to improve next assessment

---

## Key Reminders

- Deploy application to AWS account (expected but not explicitly graded)
- Core criteria = smaller portion of grade than Assessment 2
- Choose additional criteria appropriate to your project
- Sign up pairs on Canvas (if applicable)
- Contact cab432@qut.edu.au for group removal requests