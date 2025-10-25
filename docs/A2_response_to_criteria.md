Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed


Overview
------------------------------------------------

- **Name:** Alex Yoo
- **Student number:** n12159069
- **Partner name (if applicable):**
- **Application name:** VideoForge
- **Two line description:** A cloud-native video processing application that transcodes videos into multiple formats with real-time progress tracking. Users can upload videos, monitor processing status, and download transcoded outputs with thumbnail and GIF generation.
- **EC2 instance name or ID:** video-forge-v2

------------------------------------------------

### Core - First data persistence service

- **AWS service name:** RDS PostgreSQL
- **What data is being stored?:** User profiles, video processing job records, job status/progress, video metadata (duration, resolution, codecs), and media asset references with S3 keys
- **Why is this service suited to this data?:** Structured relational data with complex relationships between users, jobs, and assets. Requires ACID compliance for data consistency, complex queries with joins, and transaction support for atomic operations
- **Why is are the other services used not suitable for this data?:** S3 doesn't support complex queries or relationships. ElastiCache is temporary memory storage not suitable for persistent structured data with consistency requirements
- **Bucket/instance/table name:** PostgreSQL instance configured via Parameter Store, tables: Users, Jobs, MediaAssets
- **Video timestamp:** 00:00:12
- **Relevant files:**
    - server/src/models/User.js
    - server/src/models/Job.js
    - server/src/models/MediaAsset.js
    - server/src/config/sequelize.js

### Core - Second data persistence service

- **AWS service name:** S3
- **What data is being stored?:** Video files (original uploads, transcoded outputs), thumbnails, GIF previews, and video metadata JSON files
- **Why is this service suited to this data?:** Large video files require blob storage with scalability. S3 provides high durability, automatic scaling, and optimized for media content with features like multipart uploads and pre-signed URLs for secure access
- **Why is are the other services used not suitable for this data?:** RDS has file size limitations and is optimized for structured data, not binary files. ElastiCache is memory-based and temporary, unsuitable for permanent video storage
- **Bucket/instance/table name:** Configured via AWS Parameter Store (production bucket name)
- **Video timestamp:** 00:01:09
- **Relevant files:**
    - server/src/services/s3Service.js
    - server/src/services/videoProcessingOrchestrator.js

### Third data service

- **AWS service name:**
- **What data is being stored?:** 
- **Why is this service suited to this data?:**
- **Why is are the other services used not suitable for this data?:**
- **Bucket/instance/table name:**
- **Video timestamp:** 
- **Relevant files:**

### S3 Pre-signed URLs

- **S3 Bucket names:** video-forge-storage
- **Video timestamp:** 00:01:39
- **Relevant files:**
    - server/src/services/s3Service.js (getPresignedUrl method, lines 163-203)
    - server/src/controllers/storageController.js

### In-memory cache

- **ElastiCache instance name:** Redis cluster endpoint configured via AWS Parameter Store
- **What data is being cached?:** Job status, assets and progress updates, user statistics aggregations, admin dashboard metrics, and processing queue status
- **Why is this data likely to be accessed frequently?:** Real-time job progress is continuously polled by frontend clients. User dashboards show statistics that aggregate data from multiple database tables. Admin panels require frequent status checks across all system components
- **Video timestamp:** 00:02:18
- **Relevant files:**
    - server/src/services/cacheService.js
    - server/src/services/jobService.js (caching integration)

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** Temporary video files during processing (input downloads, intermediate transcode files), local file system cache, and processing queue state in memory
- **Why is this data not considered persistent state?:** Temporary files can be regenerated from original sources. Processing queue can be reconstructed from database job status. Local caches are performance optimizations that can be rebuilt
- **How does your application ensure data consistency if the app suddenly stops?:** Job status tracking in database with stuck job detection on startup. Automatic cleanup of temporary files. Processing orchestrator resumes incomplete jobs by checking database status and restarting from last checkpoint
- **Relevant files:**
    - server/src/services/jobService.js (resumeStuckJobs method)
    - server/src/services/videoProcessingOrchestrator.js

### Graceful handling of persistent connections

- **Type of persistent connection and use:** Server-Sent Events (SSE) for real-time job progress updates to frontend clients
- **Method for handling lost connections:** Client automatically reconnects on connection loss with exponential backoff. Server maintains connection state and resends current job status on reconnection. UI indicates connection status and shows reconnection attempts
- **Relevant files:**
    - server/src/routes/jobsRouter.js (SSE endpoint)
    - client/src/hooks/useJobProgress.js

### Core - Authentication with Cognito

- **User pool name:** 12159069-video-forge
- **How are authentication tokens handled by the client?:** JWT tokens stored in localStorage, automatically included in API requests via Authorization headers. Token refresh handled automatically with error handling for expired tokens redirecting to login
- **Video timestamp:** 00:03:08
- **Relevant files:**
    - server/src/services/cognitoService.js
    - server/src/controllers/authController.js
    - client/src/services/auth.js
    - client/src/hooks/useAuth.js

### Cognito multi-factor authentication

- **What factors are used for authentication:** Password (primary factor) and Email OTP (second factor via AWS SES integration)
- **Video timestamp:** 00:04:10
- **Relevant files:**
    - server/src/services/cognitoService.js (completeMFAChallenge method)
    - client/src/components/auth/MFALogin.jsx
    - server/src/controllers/authController.js

### Cognito federated identities

- **Identity providers used:** Google OAuth 2.0 for federated authentication allowing users to sign in with Google accounts
- **Video timestamp:** 00:04:48
- **Relevant files:**
    - client/src/components/auth/OAuthCallback.jsx
    - server/src/services/cognitoService.js (OAuth integration)

### Cognito groups

- **How are groups used to set permissions?:** 'Admin' group users can access admin dashboard, view all user jobs, delete any job, and access system health metrics. Regular users can only access their own jobs and basic functionality
- **Video timestamp:** 00:05:18
- **Relevant files:**
    - server/src/middleware/auth.js (role checking)
    - server/src/controllers/authController.js

### Core - DNS with Route53

- **Subdomain:** video-forge.cab432.com
- **Video timestamp:** 00:06:30

### Parameter store

- **Parameter names:** 
/video-forge/auth/cognito-client-id, 
/video-forge/production/cognito/user-pool-id, 
/video-forge/cache/enabled, 
/video-forge/cache/redis-host, 
/video-forge/cache/redis-port, 
/video-forge/config/app-base-url, 
/video-forge/config/log-level, 
/video-forge/config/s3-bucket-name, 
/video-forge/config/sample-video-url, 
/video-forge/database/postgres-database, 
/video-forge/processing/ffmpeg-threads, 
/video-forge/processing/max-concurrent-jobs, 
/video-forge/database/postgres-host, 
/video-forge/database/postgres-port, 
/video-forge/database/postgres-username

- **Video timestamp:** 00:06:43
- **Relevant files:**
    - server/src/config/awsConfig.js
    - server/src/utils/getParemeterFromStore.js

### Secrets manager

- **Secrets names:** 
/video-forge/auth/cognito-client-secret,
/video-forge/external-apis/pixabay-key,
/video-forge/auth/jwt-secret,
/video-forge/database/postgres-password

- **Video timestamp:** 00:07:12
- **Relevant files:**
    - server/src/utils/getSecret.js
    - server/src/config/awsConfig.js

### Infrastructure as code

- **Technology used:**
- **Services deployed:**
- **Video timestamp:**
- **Relevant files:**
    -

### Other (with prior approval only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -

### Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -