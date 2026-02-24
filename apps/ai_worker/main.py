import pika
import json
import os
import subprocess
from dotenv import load_dotenv
from minio import Minio

# Load environment variables
load_dotenv()

RABBITMQ_URL = os.getenv('RABBITMQ_URL')
RABBITMQ_QUEUE = os.getenv('RABBITMQ_QUEUE')

STORAGE_ENDPOINT = os.getenv('STORAGE_ENDPOINT')
STORAGE_ACCESS_KEY = os.getenv('STORAGE_ACCESS_KEY')
STORAGE_SECRET_KEY=os.getenv('STORAGE_SECRET_KEY')
STORAGE_BUCKET_NAME=os.getenv('STORAGE_BUCKET_NAME')

SUPPORTED_EXTENSIONS = tuple(os.getenv('SUPPORTED_EXTENSIONS').split(','))

# Initialize Storage client
storage_client = Minio(
    endpoint=STORAGE_ENDPOINT,
    access_key=STORAGE_ACCESS_KEY,
    secret_key=STORAGE_SECRET_KEY,
    secure=False
)

# Create a local 'temp' folder to hold file while processing
TEMP_DIR = os.path.join(os.path.dirname(__file__), "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

def extract_audio(input_path, output_path):
    """
        Convert video to optimized mono WAV for AI.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file does not exist: {input_path}")

    print("🎵 Running FFmpeg to extract audio...")
    print(f"🎵 Extracting audio to {output_path}...")

    # FFmpeg command optimized for AI speech-to-text
    command = [
        'ffmpeg', '-i', input_path,
        '-vn',                      # No video (discard the video track)
        '-acodec', 'pcm_s16le',     # 16-bit uncompressed WAV
        '-ar', '16000',             # 16kHz sample rate (Optimal for Whisper)
        '-ac', '1',                 # Mono audio (AI doesn't support stereo)
        output_path,
        '-y'                        # Overwrite output file if it exists
    ]

    # Run the command and hide massive FFmpeg text output
    result = subprocess.run(
        command, 
        capture_output=True,
        text=True
        # check=True, 
        # stdout=subprocess.DEVNULL, 
        # stderr=subprocess.DEVNULL
    )

    if result.returncode != 0:
        print(f"❌ FFmpeg failed with error: {result.stderr}")
        raise RuntimeError(f"FFmpeg failed: {result.stderr}")

    print("✅ FFmpeg extraction successful!")

def process_message(ch, method, properties, body):
    """
    This function is triggered every time a new message arrives in the queue.
    """

    local_raw_path = None
    local_audio_path = None

    try:
        message = json.loads(body.decode('utf-8'))
        file_key = message.get('fileKey')
        media_id = message.get('mediaId')

        print(f"📥 Received new task.")
        print(f"   - Media ID: {media_id}")
        print(f"   - File Key: {file_key}")

        # Define safe local file names
        _, ext = os.path.splitext(file_key.lower())
        local_raw_path = os.path.join(TEMP_DIR, f"{media_id}_raw{ext}")
        local_audio_path = os.path.join(TEMP_DIR, f"{media_id}_audio.wav")

        if ext not in SUPPORTED_EXTENSIONS:
            print(f"⚠️ Unsupported file format uploaded: {ext}")
            # TODO: Update MongoDB status to 'FAILED' so the user knows why
            ch.basic_ack(
                delivery_tag=method.delivery_tag
            ) # Remove from queue so it doesn't get stuck
            return

        try:
            # Download the video file from MinIO
            print(f"📥 Downloading video file '{file_key}' from MinIO...")
            storage_client.fget_object(
                bucket_name=STORAGE_BUCKET_NAME,
                object_name=file_key,
                file_path=local_raw_path
            )

            file_size = os.path.getsize(local_raw_path)
            print(f"📁 File size: {file_size} bytes")

            if file_size == 0:
                print(f"⚠️ File is empty: {local_raw_path}")
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                return

            # Extract Audio
            extract_audio(local_raw_path, local_audio_path)

            # Transcribe (AI Stub)
            print("🤖 (Stub) Audio is ready! Time to send to AI Model...")

        finally:
            # Clean up temporary files
            print("🧹 Cleaning up temporary files...")
            if os.path.exists(local_raw_path):
                os.remove(local_raw_path)
            if os.path.exists(local_audio_path):
                os.remove(local_audio_path)
            
        print("🎉 Task fully completed!\n")
        ch.basic_ack(
            delivery_tag=method.delivery_tag
        )

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