const { SQSClient, SendMessageCommand, GetQueueUrlCommand } = require('@aws-sdk/client-sqs');
const { apiLogger } = require('../utils/logger');

class SQSService {
    constructor() {
        this.sqsClient = null;
        this.queueUrl = null;
        this.queueName = process.env.SQS_QUEUE_NAME || 'video-forge-video-processing-queue';
        this.region = process.env.AWS_REGION || 'ap-southeast-2';
    }

    async initialize() {
        if (this.sqsClient) return;

        try {
            this.sqsClient = new SQSClient({ region: this.region });

            // Get queue URL
            const getQueueUrlCommand = new GetQueueUrlCommand({
                QueueName: this.queueName
            });

            const response = await this.sqsClient.send(getQueueUrlCommand);
            this.queueUrl = response.QueueUrl;

            apiLogger.sqs('SQS Service initialized', { queueUrl: this.queueUrl, queueName: this.queueName });
        } catch (error) {
            apiLogger.sqsError('Failed to initialize SQS service', error, { queueName: this.queueName });
            throw error;
        }
    }

    async sendProcessingJob(jobData) {
        if (!this.sqsClient || !this.queueUrl) {
            await this.initialize();
        }

        try {
            const messageBody = JSON.stringify({
                jobId: jobData.jobId,
                inputSource: jobData.inputSource,
                outputFormats: jobData.outputFormats,
                userId: jobData.userId,
                timestamp: new Date().toISOString()
            });

            const sendMessageCommand = new SendMessageCommand({
                QueueUrl: this.queueUrl,
                MessageBody: messageBody,
                MessageAttributes: {
                    JobId: {
                        DataType: 'String',
                        StringValue: jobData.jobId.toString()
                    },
                    JobType: {
                        DataType: 'String',
                        StringValue: 'video-processing'
                    }
                }
            });

            const result = await this.sqsClient.send(sendMessageCommand);
            apiLogger.sqs('Job sent to SQS queue', { jobId: jobData.jobId, messageId: result.MessageId });

            return result;
        } catch (error) {
            apiLogger.sqsError('Failed to send job to SQS', error, { jobId: jobData.jobId });
            throw error;
        }
    }

    async getQueueAttributes() {
        if (!this.sqsClient || !this.queueUrl) {
            await this.initialize();
        }

        try {
            const { GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');
            const command = new GetQueueAttributesCommand({
                QueueUrl: this.queueUrl,
                AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
            });

            const response = await this.sqsClient.send(command);
            return {
                messagesAvailable: parseInt(response.Attributes.ApproximateNumberOfMessages || 0),
                messagesInFlight: parseInt(response.Attributes.ApproximateNumberOfMessagesNotVisible || 0)
            };
        } catch (error) {
            apiLogger.sqsError('Failed to get queue attributes', error, { queueUrl: this.queueUrl });
            return { messagesAvailable: 0, messagesInFlight: 0 };
        }
    }
}

module.exports = new SQSService();