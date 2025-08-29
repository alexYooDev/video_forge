## Introduction to VideoForge

Public-Domain Video Transcoder Web App is a cloud-deployed REST API service that enables users to search legally available public-domain or royalty-free videos, and transform them into ready-to-use media assets. Unlike existing stock repositories such as Pexels or Pixabay, which only provide video downloads, this application focuses on media transformation: transcoding into multiple resolutions, generating GIF snippets, building thumbnail strips, and applying creative filters. By combining content discovery with CPU-intensive processing, the system demonstrates scalable media workflows and offers unique value beyond simple content hosting.

## Requirements Analysis

### Functional Requirements

***  Authentication *** 
- Users can sign up, log in, and manage only their own jobs (JWT-based authentication).

*** Video Search & Selection ***

- Users can search public video sources (e.g., Pexels, Pixabay, Internet Archive).

- Results show metadata: title, preview image, duration, license info.

- Users select a clip to process.

*** Video Processing (CPU-intensive) ***

- Users can request transcoding into multiple resolutions (1080p, 720p, 480p).

- Users can request GIF snippet generation (with start time & duration).

- Users can request extra transformations:

*** Thumbnail strip ***

- Black-and-white or sepia filter

- Montage (combine multiple selected clips)

*** Job Management ***

- Users can create jobs (processing tasks).

- The system tracks job status (PENDING, PROCESSING, COMPLETED, FAILED).

- Users can cancel their own jobs.

- Users can view their job history and outputs.

*** Media Delivery ***

- Processed outputs stored in /data/outputs (container-local).

- Users download results through REST API endpoints.

- Metadata (size, duration, license) stored in database.

### Non-Functional Requirements

- Performance: CPU usage ≥80% for ≥5 minutes under load (via FFmpeg heavy transcodes).

- Statelessness: API does not store session in memory — only DB & file storage.

- Usability: Simple REST API + optional React UI for searching, job submission, and result downloads.

- Security: JWT auth; users can only see their own jobs.

- Compliance: Only legally downloadable media from public/royalty-free APIs; license info must be stored and displayed.

- Deployment: Docker container, deployed on EC2 via ECR.

- Testing: Load testing script to demonstrate CPU utilization.


### Reference

Sample video source :
- https://gist.github.com/jsturgis/3b19447b304616f18657