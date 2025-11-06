# Video Forge

Video Forge is a modular, microservices-based video processing application. It provides a React client, multiple backend services (auth, jobs, gallery, streaming, admin dashboard, etc.), and a video processing worker. The repository includes CloudFormation templates for AWS deployment and Dockerfiles for containerized development.

## Repository layout

- `client/` — React front-end application (CRA). Contains Dockerfile and nginx config for container builds.
- `services/` — Multiple service folders (each with its own package.json and Dockerfile when applicable):
  - `auth-service/`
  - `job-service/`
  - `gallery-service/`
  - `streaming-service/`
  - `admin-dashboard/`
  - `video-processor/` (worker)
- `cloudformation/` — CloudFormation templates for deploying infrastructure (SQS, Lambdas, ASG, CloudFront, ECS, etc.) and helper scripts (`deploy.sh`, `cleanup.sh`).
- `data/` — sample inputs/outputs and temporary files used during processing.

> Note: The repository is laid out to support local development (npm start for services/client) and containerized builds for production.

## Quick requirements

- Node.js (16+ recommended)
- npm or yarn
- Docker (for container builds)
- AWS CLI and AWS credentials (for deploying CloudFormation stacks)

## Local development

Running the client locally:

```bash
cd client
npm install
npm run start
```

Running a service locally (example: job-service):

```bash
cd services/job-service
npm install
npm run start
```

Each service typically exposes a small HTTP API on a port defined in its configuration. Check the service's `src/config` or `server.js` for the exact port and environment variables.

## Docker / Container development

Build a service Docker image (example: job-service):

```bash
cd services/job-service
docker build -t video-forge-job-service .
```

Build the client image:

```bash
cd client
docker build -t video-forge-client .
```

You can run containers individually for integration testing. There is no centralized docker-compose file in the repo root; run services as needed or add a small compose file if you want a multi-container local stack.

## Deployment (CloudFormation)

The `cloudformation/` folder contains YAML templates used to deploy the application to AWS. A simple deployment flow (example):

1. Ensure AWS CLI is configured with appropriate credentials and region.
2. Review `cloudformation/parameters.json` and adjust parameters for your environment.
3. Use the provided scripts or deploy stacks directly via the AWS CLI:

```bash
# example: deploy master stack using a script (if configured)
./cloudformation/deploy.sh

# or using AWS CLI
aws cloudformation deploy --template-file cloudformation/master-stack.yaml --stack-name video-forge-master --capabilities CAPABILITY_NAMED_IAM --parameter-overrides file://cloudformation/parameters.json
```

Read each CloudFormation template before running to understand resource creation and costs.

## Testing

- Client tests: `cd client && npm test`
- Service tests: check each service's `package.json` for test scripts (commonly `npm test`).

## Environment variables

Many services rely on environment variables (DB connection strings, S3 buckets, AWS credentials, API keys). Check each service's `src/config` or `.env.example` (if present) for required variables.

## Contributing

- Follow existing code style in the repo.
- Add unit tests for new functionality.
- When changing interfaces between services, update API docs and notify dependent services.
- For infrastructure changes, update the CloudFormation templates and parameters accordingly.

## Suggested next steps

- Add a `docker-compose.yml` for easier local end-to-end testing.
- Add an umbrella `README` per service with service-specific startup and configuration notes.
- Add CI workflows for linting, testing, and building Docker images.

## License

This repository does not contain a specific license file. Add a `LICENSE` file if you plan to open-source the project.

## Contact

For questions about the repository structure or running the project, reach out to the repository owner or maintainers (see commit history / GitHub repo contact).
