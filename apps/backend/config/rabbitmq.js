const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME = process.env.RABBITMQ_QUEUE;

const sendToQueue = async (messageData) => {
    try {
        // Connect to RabbitMQ
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        // Create the Queue if it doesn't exist
        await channel.assertQueue(QUEUE_NAME, {
            durable: true // Keeps the Queue safe even if RabbitMQ restarts
        });

        // Send the message to the Queue
        channel.sendToQueue(
            QUEUE_NAME,
            Buffer.from(JSON.stringify(messageData)),
            { persistent: true } // Ensures the message is persisted even if RabbitMQ restarts
        );

        console.log(`✅ Message sent to Queue: ${QUEUE_NAME}`, messageData);

        // Close the connection
        setTimeout(async () => {
            await channel.close();
            await connection.close();
        }, 1000);
    } catch (error) {
        console.log("❌ RabbitMQ Error:", error);
    }
};

module.exports = { sendToQueue };