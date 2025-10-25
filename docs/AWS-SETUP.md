# AWS Parameter Store and Secrets Manager Setup

This guide helps you configure AWS Parameter Store and Secrets Manager for the Video Forge application.

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. IAM permissions for Parameter Store and Secrets Manager
3. Node.js dependencies installed (`npm install`)

## Required IAM Permissions

Your AWS credentials need the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameter",
                "ssm:GetParameters",
                "ssm:PutParameter",
                "secretsmanager:GetSecretValue",
                "secretsmanager:CreateSecret"
            ],
            "Resource": [
                "arn:aws:ssm:*:*:parameter/video-forge/*",
                "arn:aws:secretsmanager:*:*:secret:video-forge/*"
            ]
        }
    ]
}
```

## Quick Setup

### 1. Configure AWS Credentials

```bash
aws configure
# OR set environment variables:
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=ap-southeast-2
```

### 2. Setup AWS Parameters and Secrets

Run the automated setup script:

```bash
npm run setup-aws
```

This will create all required parameters and secrets based on your current `.env.development` file.

### 3. Verify Configuration

The application will automatically use AWS configuration in production or when AWS credentials are detected.

## Manual Configuration

If you prefer to set up parameters manually:

### Parameters (Configuration Data)
```bash
aws ssm put-parameter --name "/video-forge/config/app-base-url" --value "http://your-domain.com:8000" --type "String"
aws ssm put-parameter --name "/video-forge/database/postgres-host" --value "your-rds-host" --type "String"
aws ssm put-parameter --name "/video-forge/database/postgres-port" --value "5432" --type "String"
aws ssm put-parameter --name "/video-forge/database/postgres-database" --value "your-db-name" --type "String"
aws ssm put-parameter --name "/video-forge/database/postgres-username" --value "your-username" --type "String"
aws ssm put-parameter --name "/video-forge/processing/max-concurrent-jobs" --value "2" --type "String"
aws ssm put-parameter --name "/video-forge/config/sample-video-url" --value "your-sample-video-url" --type "String"
aws ssm put-parameter --name "/video-forge/processing/ffmpeg-threads" --value "4" --type "String"
aws ssm put-parameter --name "/video-forge/config/log-level" --value "info" --type "String"
```

### Secrets (Sensitive Data)
```bash
aws secretsmanager create-secret --name "/video-forge/database/postgres-password" --secret-string "your-db-password"
aws secretsmanager create-secret --name "/video-forge/auth/jwt-secret" --secret-string "your-jwt-secret"
aws secretsmanager create-secret --name "/video-forge/external-apis/pixabay-key" --secret-string "your-pixabay-api-key"
```

## How It Works

1. **Local Development**: Uses `.env.development` file
2. **Production**: Automatically loads from AWS Parameter Store and Secrets Manager
3. **Fallback**: If AWS fails, falls back to local environment variables
4. **Caching**: Values are cached for 5 minutes to reduce API calls
5. **Batch Loading**: Parameters are loaded in batches for efficiency

## Configuration Mapping

The application maps AWS parameters to environment variables:

| Environment Variable | AWS Parameter/Secret Path |
|---------------------|---------------------------|
| `PG_PASSWORD` | `/video-forge/database/postgres-password` (Secret) |
| `JWT_SECRET` | `/video-forge/auth/jwt-secret` (Secret) |
| `PIXABAY_API_KEY` | `/video-forge/external-apis/pixabay-key` (Secret) |
| `APP_BASE_URL` | `/video-forge/config/app-base-url` (Parameter) |
| `PG_HOST` | `/video-forge/database/postgres-host` (Parameter) |
| `PG_PORT` | `/video-forge/database/postgres-port` (Parameter) |
| `PG_DATABASE` | `/video-forge/database/postgres-database` (Parameter) |
| `PG_USERNAME` | `/video-forge/database/postgres-username` (Parameter) |
| `MAX_CONCURRENT_JOBS` | `/video-forge/processing/max-concurrent-jobs` (Parameter) |
| `SAMPLE_VIDEO_URL` | `/video-forge/config/sample-video-url` (Parameter) |
| `FFMPEG_THREADS` | `/video-forge/processing/ffmpeg-threads` (Parameter) |
| `LOG_LEVEL` | `/video-forge/config/log-level` (Parameter) |

## Cost Optimization

- **Parameters**: Free for standard parameters
- **Secrets**: ~$0.40/secret/month
- **API Calls**: $0.05 per 10,000 calls
- **Caching**: Reduces API calls by storing values for 5 minutes

## Troubleshooting

### Common Issues

1. **AWS credentials not configured**
   ```
   AWS configuration failed, using local environment: Unable to locate credentials
   ```
   Solution: Run `aws configure` or set environment variables

2. **Insufficient permissions**
   ```
   Access denied to parameter/secret
   ```
   Solution: Add required IAM permissions (see above)

3. **Parameters not found**
   ```
   Failed to get parameter: ParameterNotFound
   ```
   Solution: Run `npm run setup-aws` or create parameters manually

### Debug Mode

Set `LOG_LEVEL=debug` to see detailed AWS configuration loading logs.