import pika
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

RABBITMQ_URL = os.getenv('RABBITMQ_URL')
RABBITMQ_QUEUE = os.getenv('RABBITMQ_QUEUE')

def process_message(ch, method, properties, body):
    """
    This function is triggered every time a new message arrives in the queue.
    """
    try:
        message = json.loads(body.decode('utf-8'))

        print(f"📥 Received new task: {message}")
        print(f"   - Media ID: {message.get('mediaId')}")
        print(f"   - File Key: {message.get('fileKey')}")
        print(f"   - User ID: {message.get('userId')}")

        # TODO: 1. Connect to MinIO and download the video
        # TODO: 2. Run the AI transcription model (Whisper)
        # TODO: 3. Save the text to MongoDB

        # Acknowledge the message after processing so it can be removed from the queue
        ch.basic_ack(delivery_tag=method.delivery_tag)  

    except Exception as e:
        print(f"❌ Error processing message: {e}")
        
        # If it fails, negative-acknowledge (nack) so it doesn't get stuck in an infinite loop
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def start_worker():
    print(f"⏳ Connecting to RabbitMQ at {RABBITMQ_URL}...")

    try:
        # Establish connection to RabbitMQ
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()

        # Ensure the queue exists
        channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)

        # Tell RabbitMQ to only give this worker 1 message at a time (prevents crashing if we get 100 videos at once)
        channel.basic_qos(prefetch_count=1)

        # Subscribe to the queue and specify the callback function to process messages
        channel.basic_consume(
            queue=RABBITMQ_QUEUE, 
            on_message_callback=process_message
        )

        print(f"🚀 Worker is running! Waiting for messages in '{RABBITMQ_QUEUE}'. To exit press CTRL+C")

        # Start the infinite listening loop
        channel.start_consuming()
    
    except pika.exceptions.AMQPConnectionError as e:
        print(f"❌ Failed to connect to RabbitMQ: {e}")
    except KeyboardInterrupt:
        print("👋 Worker is shutting down...")

        if 'connection' in locals() and connection.is_open:
            connection.close()
            print("✅ Connection closed gracefully.")
        else:
            print("⚠️ No open connection to close.")

if __name__ == "__main__":
    start_worker()