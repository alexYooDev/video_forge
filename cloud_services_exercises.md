# CAB432 Cloud Services Exercises - Assessment 2

## Assessment Overview

**Unit Learning Outcomes assessed:**
- ULO1: Discuss the elastic nature of cloud technologies and business models and their application in technical, commercial and sustainability contexts.
- ULO2: Analyse application design and implementation requirements to select suitable cloud infrastructure and software services from a range of XaaS offerings.
- ULO4: Design and implement scalable cloud applications using industry standard languages and APIs, deployed on a public cloud infrastructure and leveraging a range of cloud services.

**Weighting:** Individual assignment worth a grade out of 30  
**Extension:** Eligible for the 48 hour extension (see HiQ website)

## What You Need to Do

This assessment item builds on your REST API application project from Assessment 1. You will move data handling into cloud persistence services and integrate cloud identity services for user authentication and authorization.

You are free to add additional functionality to your application or replace it entirely. If your Assessment 1 project didn't meet core requirements, changes may be required to accommodate this assessment's requirements.

### Preparation Requirements

**Make your application stateless** with no exclusive data storage other than in cloud persistence services:

- All persistent data must be held in cloud persistence services you have set up
- Your application must tolerate the loss of any persistent connections (e.g., websocket connections)
- Application state (data in persistence services) must remain consistent if your application is stopped at any moment
- Your application must function correctly if restarted with a fresh container/EC2 instance
- If state is used (e.g., persistent connection for progress reporting), the application must gracefully handle state loss, or you must have a convincing argument that stateful design is required (e.g., strict low latency or real-time requirements)

## Core Criteria (14 marks)

These criteria relate to functionality that you will extend in assessment 3. You should consider these your top priorities.

### Data Persistence Services (6 marks)

Your application makes relevant use of **two distinct** cloud data persistence services from separate categories:

**Categories (3 marks each):**
- **Object storage** (S3)
- **NoSQL databases** (DynamoDB)
- **SQL databases** (RDS)
- **Block and file storage** (EBS, EFS)

**Important Notes:**
- With S3, do not use public buckets for client access. Instead, use pre-signed URLs or handle requests for objects through your server
- For RDS instances: Tag with key `purpose` set to `assessment-2` and `qut-username` set to your full QUT username (e.g., `n1234567@qut.edu.au`). Teaching staff may delete old or improperly tagged RDS instances to make room for students

### Authentication with Cognito (3 marks)

Make relevant use of AWS Cognito for user identity management and authentication, integrating with user functionality from assessment 1.

**Required Features:**
- User registration (username, email, password submission)
- Email-based confirmation of registration
- User login using username and password, returning JWT upon successful authentication

### Statelessness (3 marks)

Prepare for horizontal scaling in the next assessment by implementing statelessness:

- All persistent data held in cloud persistence services
- Application tolerates loss of persistent connections
- Application state remains consistent if stopped at any moment
- Application functions correctly when restarted with fresh container/EC2 instance

### DNS with Route53 (2 marks)

Configure a DNS record for a subdomain of cab432.com using a CNAME that points to the EC2 instance hosting your application. This prepares for Assessment 3 where you'll add TLS to your public-facing server (HTTPS implementation). Later, you'll update the DNS record to point to a service that provides TLS.

## Additional Criteria (16 marks)

Choose the most appropriate criteria for your application. We will stop marking once we have considered enough additional criteria to account for 16 marks. Not all additional criteria are weighted the same.

### Parameter Store (2 marks)
Appropriately use Parameter Store for storing relevant application data:
- Application URL (often required by frontend for accessing your app's API)
- External API URL or other information

### Secrets Manager (2 marks)
Appropriately use Secrets Manager for storing sensitive data:
- External API access keys
- Database credentials

### In-memory Caching (3 marks)
Appropriate use of in-memory caching for database queries or external APIs:
- Caches could be ElastiCache, memcached, or Redis
- You should have a convincing reason that cached data will be accessed frequently
- This doesn't have to be true now but should be true in an imagined wide-scale deployment

### Infrastructure as Code (3 marks)
Deploy all AWS services via IaC mechanisms:
- Infrastructure as code technologies for deployment of cloud services supporting core and additional criteria
- We will not assess IaC use for deploying services related to assessment 1
- You can use Terraform, AWS CDK, or CloudFormation
- For other technologies, ask the teaching team

### Identity Management: MFA (2 marks)
Make appropriate and non-trivial use of additional Cognito functionality: multi-factor authentication.

### Identity Management: Federated Identities (2 marks)
Make appropriate and non-trivial use of additional Cognito functionality: federated identities (e.g., Google, Facebook).

### Identity Management: User Groups (2 marks)
Make appropriate and non-trivial use of additional Cognito functionality: user groups for organizing permissions (e.g., an "Admin" group with additional permissions).

### Additional Persistence Service (3 marks)
Incorporate a third distinct type of data persistence service from the categories listed in the Persistence Services section. There must be a compelling reason why this additional service is required/beneficial for your application.

### S3 Pre-signed URLs (2 marks)
Use S3 pre-signed URLs for direct client upload and download. Where a client needs to send or receive an object stored in S3, this is done by passing a pre-signed URL to the client which then up/downloads the object directly from S3.

### Graceful Handling of Persistent Connections (2 marks)
If your application uses persistent connections (server-side-events or websockets) appropriately:

- Your application should gracefully handle the loss of persistent connections
- Such loss may be due to an instance of your server being shut down as the application scales in
- **For full marks:** Application shows minimal to no degradation in functionality (e.g., client detects lost connection and re-establishes it)
- **Part marks:** Graceful degradation that has some effect but doesn't impact basic functionality (e.g., progress reporting stops and an error is reported, but application otherwise functions correctly)

### Upon Request (3-6 marks)
This additional criteria exists twice in the rubric. You may attempt it once or twice, each worth three marks. Each attempt requires approval from a coordinator.

Gain marks for other functionality or aspects that demonstrate high achievement in the project. This excludes things assessed in later assessment items. Speak to a coordinator first about specific functionality you'd like to pursue for additional credit.

## Anti-criteria

These are things you will need to do later. You might not want to do these now as we will have particular criteria for how they will be implemented in later assessment items:

- Multiple server components (e.g., microservices)
- Lambdas, container orchestration
- Autoscaling, load balancers
- Cloud services for asynchronous communication
- Edge caching

## Technologies and Special Permission

Follow the same guidelines as Assessment 1. The following technologies do not require special permission:

- Technologies you already have permission for from assessment 1
- All AWS services listed in AWS services available (some may not be available until enabled by DBS)
- Docker compose, Terraform

## Submission

Details can be found at 2.1 Submission Process

## Feedback

Under normal circumstances, you will receive marks for each criterion via a Canvas rubric within 10-15 working days of submission. Click on Marks to see your results. Usually the reason for each choice of mark is self-evident; the marker will include written feedback about your performance. Use this feedback to strengthen your performance in the next assessment item.

## Moderation

All staff assessing your work meet to discuss and compare their judgements before marks or grades are finalized.

---

## Technical Implementation Notes

### Application Statelessness Best Practices

**Clean Code Principles for Stateless Design:**

1. **Dependency Injection Pattern**
   ```javascript
   // Good: Dependencies injected, no global state
   class UserService {
     constructor(dynamoClient, s3Client) {
       this.dynamoClient = dynamoClient;
       this.s3Client = s3Client;
     }
   }
   
   // Bad: Global state dependencies
   const globalDbConnection = new DatabaseConnection();
   ```

2. **Immutable Configuration**
   ```javascript
   // Good: Configuration from environment/parameter store
   const config = {
     dbConnectionString: process.env.DB_CONNECTION_STRING,
     s3BucketName: await getParameter('/myapp/s3-bucket-name')
   };
   
   // Bad: Hardcoded or mutable configuration
   let dbHost = 'localhost'; // Don't do this
   ```

3. **Pure Functions for Business Logic**
   ```javascript
   // Good: Pure function, no side effects
   function calculateUserScore(userData, preferences) {
     return userData.points * preferences.multiplier;
   }
   
   // Bad: Function with side effects
   function calculateUserScore(userId) {
     const user = globalUserCache[userId]; // Global state dependency
     user.lastCalculated = new Date(); // Side effect
     return user.points * 1.5;
   }
   ```

### AWS Service Integration Patterns

**DynamoDB Best Practices:**
- Use single-table design when appropriate
- Implement proper GSI (Global Secondary Index) for query patterns
- Use batch operations for better performance
- Implement exponential backoff for retries

**S3 Integration:**
- Always use pre-signed URLs for client access
- Implement proper error handling for upload/download operations
- Use multipart uploads for large files
- Set appropriate lifecycle policies

**Cognito Integration:**
- Store JWT tokens securely on client side
- Implement token refresh logic
- Use Cognito groups for role-based access control
- Handle authentication errors gracefully

### Error Handling and Resilience

```javascript
// Example: Resilient database operation
async function saveUserData(userData) {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      await dynamoClient.putItem(userData);
      return { success: true };
    } catch (error) {
      retryCount++;
      if (retryCount === maxRetries) {
        logger.error('Failed to save user data after retries', error);
        throw new Error('Database operation failed');
      }
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, retryCount) * 1000)
      );
    }
  }
}
```

This approach ensures your application can handle cloud service failures gracefully and maintains statelessness for horizontal scaling in Assessment 3.