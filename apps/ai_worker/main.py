import pika, json, os, subprocess, torch, whisper, time, math
from dotenv import load_dotenv
from minio import Minio
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime, timezone
from urllib.parse import unquote

# Load environment variables
load_dotenv()

RABBITMQ_URL = os.getenv('RABBITMQ_URL')
RABBITMQ_QUEUE = os.getenv('RABBITMQ_QUEUE')

STORAGE_ENDPOINT = os.getenv('STORAGE_ENDPOINT')
STORAGE_ACCESS_KEY = os.getenv('STORAGE_ACCESS_KEY')
STORAGE_SECRET_KEY=os.getenv('STORAGE_SECRET_KEY')
STORAGE_BUCKET_NAME=os.getenv('STORAGE_BUCKET_NAME')

MONGODB_URL = os.getenv('MONGODB_URL')

SUPPORTED_EXTENSIONS = tuple(os.getenv('SUPPORTED_EXTENSIONS').split(','))

# Setup GPU if available
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🚀 AI Hardware: {device.upper()} ({torch.cuda.get_device_name(0) if device == 'cuda' else 'CPU'})")

# Load Whisper
print("🧠 Loading Whisper 'base' model... ")
model = whisper.load_model("base", device=device)

# Initialize DB client
db_client = MongoClient(MONGODB_URL)
db = db_client[os.getenv('MONGODB_DATABASE_NAME')]

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

def get_media_length(file_path):
    """Use ffprobe to get the exact duration of the media in milliseconds."""
    try:
        cmd = [
            'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1', file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return int(float(result.stdout.strip()) * 1000) if result.stdout else 0
    except Exception as e:
        print(f"⚠️ Could not get media length: {e}")
        return 0

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
    )

    if result.returncode != 0:
        print(f"❌ FFmpeg failed with error: {result.stderr}")
        raise RuntimeError(f"FFmpeg failed: {result.stderr}")

    print("✅ FFmpeg extraction successful!")

def process_message(ch, method, properties, body):
    """
    This function is triggered every time a new message arrives in the queue.
    """
    start_time = time.time()

    local_raw_path = local_audio_path = local_json_path = None
    media_id = None
    model_name = 'base'
    current_stage = "INITIALIZING"

    try:
        message = json.loads(body.decode('utf-8'))
        file_key = message.get('fileKey')
        media_id = message.get('mediaId')

        print(f"📥 Received new task.")
        print(f"   - Media ID: {media_id}")
        print(f"   - File Key: {file_key}")

        # Update Status to PROCESSING
        db.media.update_one(
            {"_id" : ObjectId(media_id)},
            {"$set": {
                "status": "PROCESSING", 
                "errorDetails": None,
            }}
        )

        # Define safe local file names
        _, ext = os.path.splitext(file_key.lower())
        local_raw_path = os.path.join(TEMP_DIR, f"{media_id}_raw{ext}")
        local_audio_path = os.path.join(TEMP_DIR, f"{media_id}_audio.wav")
        local_json_path = os.path.join(TEMP_DIR, f"{media_id}_transcript.json")

        if ext not in SUPPORTED_EXTENSIONS:
            current_stage = "UNSUPPORTED_FILE_FORMAT"
            raise ValueError(f"Unsupported file format: {ext}")

        # Download the video file from MinIO
        current_stage = "DOWNLOADING"
        file_key = unquote(file_key)  # URL decode the file key
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
            current_stage = "EMPTY_FILE"
            raise ValueError("Downloaded file is empty (0 bytes)")

        # Get exact media length using ffprobe
        media_length_ms = get_media_length(local_raw_path)

        # Extract Audio
        current_stage = "EXTRACTING_AUDIO"
        extract_audio(local_raw_path, local_audio_path)

        # Transcribe (AI Stub)
        print("🤖 (Stub) Audio is ready! Time to send to AI Model...")

        # Start Transcription
        current_stage = "TRANSCRIBING"
        print(f"🤖 Transcribing on {torch.cuda.get_device_name(0)}...")
        model_start = time.time()
        result = model.transcribe(
            local_audio_path,
            fp16=False
        )
        model_end = time.time()

        # Calculate AI Confidence (0 to 1) from Whisper's log probabilities
        segments = result.get('segments', [])
        confidence = 0
        if segments:
            avg_logprob = sum(s.get('avg_logprob', 0) for s in segments) / len(segments)
            confidence = round(math.exp(avg_logprob), 4)

        # Create JSON file for MinIO
        current_stage = "UPLOADING_JSON"
        transcript_data = {
            "text": result['text'],
            "segments": result.get('segments', [])
        }

        with open(local_json_path, 'w') as f:
            json.dump(transcript_data, f, indent=2)

        # Upload JSON file to MinIO
        print(f"📤 Uploading transcript JSON to MinIO: {local_json_path}")
        json_key = f"transcripts/{media_id}.json"
        storage_client.fput_object(
            bucket_name=STORAGE_BUCKET_NAME,
            object_name=json_key,
            file_path=local_json_path,
            content_type="application/json"
        )
        json_size = os.path.getsize(local_json_path)

        # Save to Database
        current_stage = "SAVING_TO_DB"
        transcript_doc = {
            "mediaId": ObjectId(media_id),
            "plainText": result["text"].strip(),
            "jsonFile": {
                "bucket": STORAGE_BUCKET_NAME,
                "key": json_key,
                "sizeBytes": json_size,
                "format": "json"
            },
            "language": result.get("language", "en"),
            "confidence": confidence,
            "modelSize": model_name,
            "totalTranscriptionTime": round(time.time() - start_time, 2),
            "modelProcessingTime": round(model_end - model_start, 2),
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }

        # Insert into the 'transcripts' collection
        db.transcripts.insert_one(transcript_doc)

        # Update Media status
        update_result = db.media.update_one(
            {"_id": ObjectId(media_id)},
            {"$set": {
                "status": "COMPLETED",
                "sizeBytes": file_size,
                "storage.sizeBytes": file_size,
                "actualLanguage": result.get("language", "en"),
                "lengthMs": media_length_ms
            }}
        )

        print(f"📝 DB Update Report -> Matched: {update_result.matched_count} | Modified: {update_result.modified_count}")

        print(f"✅ Transcript saved and media status updated for media ID: {media_id}")
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        print(f"❌ Error processing message: {e}")
        if media_id:
            db.media.update_one(
                {"_id": ObjectId(media_id)},
                {"$set": {
                    "status": "FAILED",
                    "errorDetails": {
                        "stage": current_stage,
                        "message": str(e)
                    }
                }}
            )
        ch.basic_nack(
            delivery_tag=method.delivery_tag, 
            requeue=False
        )

    finally:
        # Clean up temporary files
        print("🧹 Cleaning up temporary files...")
        for path in [local_raw_path, local_audio_path, local_json_path]:
            if path is not None and os.path.exists(path):
                os.remove(path)
                print(f"🗑️ Removed temporary file: {path}")

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
    
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    start_worker()