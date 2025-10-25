Assignment 1 - REST API Project - Response to Criteria
================================================

Instructions:

- Don't use this file.  Use the clean template from Canvas
- This file is a sample showing the kinds and amount of detail that we
    would like to see
- Video timestamp refers to the time in your video where the functionality 
    is demonstrated.  Note that the user login and user dependent functionality
    will likely contribute to demonstrating the web client.
- Relevant files are filename and line number(s) where the functionality is implemented.
    You can also refer to an entire directory or leave off the line number if 
    the whole directory/file is relevant.

Overview
------------------------------------------------

- **Name:** Alex Yoo
- **Student number:** n12159069
- **Application name:** Video Forge
- **Two line description:** This app runs a stabilisation algorithm on videos that users have uploaded.  
Users can then view or download their original videos and the stabilised videos.

Core criteria
------------------------------------------------

### Containerise the app

- **ECR Repository name**: 12159069-video-forge
- **Video timestamp:** 0:15
- **Relevant files:**
    - /Dockerfile
    - /docker-compose.yml

### Deploy the container

- **EC2 instance ID**: i-0096beaf892dee228
- **Video timestamp:** 0:30

### User login

- **One line description:** Hard-coded username/password list.  Using JWTs for sessions.
- **Video timestamp:** 0:45
- **Relevant files:**
    - /server/src/routes/authRouter.js : 6
    - /server/src/services/authSevice.js : 6
    - /server/src/controllers/authController.js : 20
    - /server/src/middleware/auth.js : 4

### REST API

- **One line description:** REST API with endpoints (as nouns) and HTTP methods (GET, POST, PUT, DELETE), and appropriate status codes
- **Video timestamp:** 00:30
- **Relevant files:**
    - /server/src/routes/jobsRouter.js : 7-22
    - /server/src/routes/authRouter.js : 6-7
    - /server/src/controllers/jobController.js : entire file
    - /server/src/controllers/authController.js : entire file

### Two kinds of data

#### First kind

- **One line description:** Video files
- **Type:** Unstructured
- **Rationale:** Video files are too large and consists of streams.  No need for additional functionality such as relationships or querying.
- **Video timestamp:** 1:30
- **Relevant files:**
    - /server/src/services/videoProcessServices.js : 212
    - /server/src/data/{inputs, outputs} : both directories as a file storage

#### Second kind

- **One line description:** Video metadata
- **Type:** Structured, no ACID requirements
- **Rationale:** Need to be able to query for user and video data. There is a low chance of multiple writes to single file or user data.
- **Video timestamp:** 1:45
- **Relevant files:**
    - /server/src/data/{inputs, outputs} : both directories as a file storage
    - /server/src/services/videoProcessServices.js : 324, 423

### CPU intensive task

- **One line description**: Uses ffmpeg to stabilise shaky video files.
- **Video timestamp:** 2:00
- **Relevant files:**
    - /server/src/scripts/cpu-monitor.js : entire file
    - /server/src/scripts/simple-cpu-load.js : entire file

### CPU load testing

- **One line description**: Node script to generate requests to stabilise endpoint
- **Video timestamp:** 2:30
- **Relevant files:**
    - /server/src/scripts/load-test.js : entire file
    - /server/src/scripts/create-test-videos.js : entire file

Additional criteria
------------------------------------------------

### Extensive REST API features

- **One line description**: Use of middleware for advanced HTTP headers, especially on authentication
- **Video timestamp:** 01:00
- **Relevant files:**
    - /server/src/routes/authRouter.js
    - /server/src/middleware/auth.js entire file
    - /server/src/controllers/authController.js
    - /server/src/controllers/jobController.js


### External API(s)

- **One line description**: Pixabay public api for search functionality for public license videos
- **Video timestamp:** 1:00
- **Relevant files:**
    - /client/src/components/SearchVideo.js : 20

### Additional kinds of data

- **One line description**: Not attempted

### Custom processing

- **One line description**: Custom test scripts are provided to automate simulation CPU intensive tasks in 
- **Video timestamp:** mm:ss
- **Relevant files:**
    - /server/src/scripts/load-test.js : entire file
    - /server/src/scripts/create-test-videos.js : entire file
    - /server/src/scripts/cpu-monitor.js : entire file
    - /server/src/scripts/simple-cpu-load.js : entire file

### Infrastructure as code

- **One line description**: Using Docker compose for application and Mongo containers.
- **Video timestamp:** 0:25
- **Relevant files:**
    - /docker-compose.yml : entire file

### Web client

- **One line description**:  Web client developed with React accessible via web browser
- **Video timestamp:** mm:ss
- **Relevant files:**
    - /client/srt/index.js
