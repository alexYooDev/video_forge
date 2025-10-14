const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, GetQueueUrlCommand } = require('@aws-sdk/client-sqs');

class SQSPollingService {
    constructor() {
        this.sqsClient = null;
        this.queueUrl = null;
        this.queueName = process.env.SQS_QUEUE_NAME || 'video-forge-video-processing-queue';
        this.region = process.env.AWS_REGION || 'ap-southeast-2';
        this.isPolling = false;
        this.pollingInterval = parseInt(process.env.SQS_POLLING_INTERVAL) || 5000; // 5 seconds
        this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS) || 2;
        this.currentJobs = 0;
        this.processingFunction = null;
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

            console.log(`SQS Polling Service initialized with queue: ${this.queueUrl}`);
            console.log(`Polling interval: ${this.pollingInterval}ms, Max concurrent jobs: ${this.maxConcurrentJobs}`);
        } catch (error) {
            console.error('Failed to initialize SQS polling service:', error.message);
            throw error;
        }
    }

    setProcessingFunction(processingFunction) {
        this.processingFunction = processingFunction;
    }

    async startPolling() {
        if (this.isPolling) {
            console.log('SQS polling is already running');
            return;
        }

        if (!this.processingFunction) {
            throw new Error('Processing function must be set before starting polling');
        }

        await this.initialize();
        this.isPolling = true;
        console.log('Starting SQS polling...');

        this._pollLoop();
    }

    async stopPolling() {
        console.log('Stopping SQS polling...');
        this.isPolling = false;
    }

    async _pollLoop() {
        while (this.isPolling) {
            try {
                if (this.currentJobs < this.maxConcurrentJobs) {
                    await this._receiveAndProcessMessages();
                }

                // Wait before next poll
                await this._sleep(this.pollingInterval);
            } catch (error) {
                console.error('Error in polling loop:', error.message);
                await this._sleep(this.pollingInterval * 2); // Wait longer on error
            }
        }
        console.log('SQS polling stopped');
    }

    async _receiveAndProcessMessages() {
        try {
            const availableSlots = this.maxConcurrentJobs - this.currentJobs;
            const maxMessages = Math.min(availableSlots, 10); // SQS max is 10

            const receiveCommand = new ReceiveMessageCommand({
                QueueUrl: this.queueUrl,
                MaxNumberOfMessages: maxMessages,
                WaitTimeSeconds: 20, // Long polling
                MessageAttributeNames: ['All'],
                VisibilityTimeout: 300 // 5 minutes to process
            });

            const response = await this.sqsClient.send(receiveCommand);

            if (response.Messages && response.Messages.length > 0) {
                console.log(`Received ${response.Messages.length} messages from SQS`);

                for (const message of response.Messages) {
                    this._processMessage(message);
                }
            }
        } catch (error) {
            console.error('Failed to receive messages from SQS:', error.message);
        }
    }

    async _processMessage(message) {
        this.currentJobs++;
        console.log(`Processing message. Active jobs: ${this.currentJobs}/${this.maxConcurrentJobs}`);

        try {
            // Parse message body
            const jobData = JSON.parse(message.Body);
            console.log(`Processing job ${jobData.jobId} from SQS`);

            // Call the processing function
            await this.processingFunction(jobData);

            // Delete message from queue on success
            await this._deleteMessage(message);
            console.log(`Job ${jobData.jobId} completed and message deleted from queue`);

        } catch (error) {
            console.error(`Failed to process message:`, error.message);

            // Note: Message will become visible again after visibility timeout
            // You might want to implement a dead letter queue for failed messages
        } finally {
            this.currentJobs--;
            console.log(`Job finished. Active jobs: ${this.currentJobs}/${this.maxConcurrentJobs}`);
        }
    }

    async _deleteMessage(message) {
        try {
            const deleteCommand = new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle
            });

            await this.sqsClient.send(deleteCommand);
        } catch (error) {
            console.error('Failed to delete message from queue:', error.message);
        }
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            isPolling: this.isPolling,
            currentJobs: this.currentJobs,
            maxConcurrentJobs: this.maxConcurrentJobs,
            pollingInterval: this.pollingInterval,
            queueUrl: this.queueUrl
        };
    }
}

module.exports = new SQSPollingService();