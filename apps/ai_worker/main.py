import pika, json, os, subprocess, torch, whisper, time, math
from dotenv import load_dotenv
from minio import Minio
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime, timezone
from urllib.parse import unquote
from google import genai

# Load environment variables
load_dotenv()

RABBITMQ_URL = os.getenv('RABBITMQ_URL')
RABBITMQ_QUEUE = os.getenv('RABBITMQ_QUEUE')

STORAGE_ENDPOINT = os.getenv('STORAGE_ENDPOINT')
STORAGE_ACCESS_KEY = os.getenv('STORAGE_ACCESS_KEY')
STORAGE_SECRET_KEY = os.getenv('STORAGE_SECRET_KEY')
STORAGE_BUCKET_NAME = os.getenv('STORAGE_BUCKET_NAME')

MONGODB_URL = os.getenv('MONGODB_URL')

SUPPORTED_EXTENSIONS = tuple(os.getenv('SUPPORTED_EXTENSIONS').split(','))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Setup GPU if available
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🚀 AI Hardware: {device.upper()} ({torch.cuda.get_device_name(0) if device == 'cuda' else 'CPU'})")

# Setup Gemini API (For Translation)
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    print("⚠️ GEMINI_API_KEY not found in .env!")

# Load Whisper
print("🧠 Loading Whisper 'small' model... ")
model = whisper.load_model("small", device=device)

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

def _validate_and_fix_segments(translated_segments, original_segments):
    """
    Ensures translated segments have same count and same start/end as originals (sync).
    If timing was changed by the model, restore from originals. Returns (fixed_segments, ok).
    """
    if not original_segments or not translated_segments:
        return (translated_segments, len(translated_segments) == len(original_segments))
    if len(translated_segments) != len(original_segments):
        print(f"⚠️ Segment count mismatch: got {len(translated_segments)}, expected {len(original_segments)}. Restoring timing from original.")
    fixed = []
    for i in range(len(translated_segments)):
        t = dict(translated_segments[i]) if isinstance(translated_segments[i], dict) else translated_segments[i].copy()
        if i < len(original_segments):
            o = original_segments[i]
            t["start"] = o.get("start", t.get("start"))
            t["end"] = o.get("end", t.get("end"))
        fixed.append(t)
    return (fixed, len(fixed) == len(original_segments))


def translate_transcript_via_gemini(original_text, segments, target_language_code, source_language_code=None, max_retries=2):
    """
    Sends the text and segments to Gemini for translation.
    Returns (translated_text, translated_segments).
    Enforces: strict timing (no change to start/end), no name translation, natural/idiomatic output.
    Validates and fixes segment count and start/end after response.
    """
    from_desc = f" from {source_language_code}" if source_language_code else ""
    print(f"🌐 Sending {len(segments)} segments to Gemini for translation{from_desc} to '{target_language_code}'...")
    payload = {"text": original_text, "segments": segments}

    rules = """
    RULES (follow strictly):
    1. TIMING: Do not change start, end, or the number of segments. Only translate the "text" field inside each segment. One segment = one subtitle; do not merge or split segments.
    2. NAMES: Keep all names (people, places, brands, titles) in original language or standard romanization (e.g. Chinese names as Pinyin). Do not translate names into the target language.
    3. NATURAL: Translate so it sounds natural and idiomatic in the target language. Preserve tone and intent; avoid word-for-word translation when it would sound unnatural. Use common expressions where appropriate.
    4. OUTPUT: Return ONLY valid JSON: a single object with "text" and "segments" keys. Keep every other field (start, end, id, tokens, etc.) EXACTLY the same. Ensure every string is properly escaped and every array element is separated by commas.
    """
    direction = f"Translate the 'text' fields in the following JSON{from_desc} to the language code: '{target_language_code}'."
    prompt = f"""
    You are a professional subtitle translator.
    {direction}
    {rules}
    JSON Data:
    {json.dumps(payload)}
    """
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )
            translated_data = json.loads(response.text)
            if "text" not in translated_data or "segments" not in translated_data:
                last_error = ValueError("Response missing 'text' or 'segments'")
                continue
            out_segments = translated_data["segments"]
            out_text = translated_data["text"]
            out_segments, timing_ok = _validate_and_fix_segments(out_segments, segments)
            if not timing_ok:
                out_text = " ".join((s.get("text") or "").strip() for s in out_segments)
            translated_data["segments"] = out_segments
            translated_data["text"] = out_text
            return translated_data["text"], translated_data["segments"]
        except json.JSONDecodeError as e:
            last_error = e
            print(f"⚠️ Gemini JSON parse error (attempt {attempt + 1}/{max_retries + 1}): {e}")
            if attempt < max_retries:
                time.sleep(2)
        except Exception as e:
            print(f"❌ Gemini Translation Failed: {e}")
            raise
    print(f"❌ Gemini Translation Failed after {max_retries + 1} attempts: {last_error}")
    raise last_error


def get_user_friendly_error(stage, message):
    """Map technical stage + message to a short message the user can understand."""
    msg = (message or "").lower()
    if "connection reset" in msg or "channel is closed" in msg or "stream connection lost" in msg:
        return "The connection was interrupted. We'll try again."
    if "timeout" in msg or "timed out" in msg:
        return "The request took too long. We'll try again."
    if "out of memory" in msg or "oom" in msg:
        return "Processing ran out of memory. Try a shorter file or try again later."
    if "whisper" in msg or "transcri" in msg:
        return "Transcription failed. Check that the file has clear audio and try again."
    if "gemini" in msg or "translation" in msg or "translate" in msg or "expecting" in msg or "json" in msg:
        return "Translation failed temporarily. We'll try again."
    if "minio" in msg or "s3" in msg or "storage" in msg or "upload" in msg:
        return "Storage error. Please try again in a moment."
    if "network" in msg or "fetch" in msg or "connection" in msg:
        return "A network error occurred. We'll try again."
    if "unsupported" in msg or "format" in msg:
        return "This file format is not supported."
    if "empty" in msg:
        return "The file appears to be empty. Please upload a valid file."
    return "Something went wrong during processing. Please try again or try a different file."


def process_message(ch, method, properties, body):
    """
    This function is triggered every time a new message arrives in the queue.
    """
    start_time = time.time()

    local_raw_path = local_audio_path = local_json_path = None
    media_id = None
    model_name = 'small'
    current_stage = "INITIALIZING"
    completed_successfully = False
    processing_attempt = 1

    try:
        message = json.loads(body.decode('utf-8'))
        file_key = message.get('fileKey')
        media_id = message.get('mediaId')
        target_language_code = message.get('targetLanguageCode', 'original')
        source_language_code = message.get('sourceLanguageCode')

        print(f"📥 Received new task.")
        print(f"   - Media ID: {media_id}")
        print(f"   - File Key: {file_key}")
        print(f"   - Target Language Code: {target_language_code}")

        # Detect retry: if media was FAILED with attempt 1, this is attempt 2
        media_doc = db.media.find_one({"_id": ObjectId(media_id)})
        if media_doc and media_doc.get("status") == "FAILED":
            ed = media_doc.get("errorDetails") or {}
            if ed.get("attempt") == 1:
                processing_attempt = 2
                print(f"   🔄 Retrying (attempt 2)...")
                db.media.update_one(
                    {"_id": ObjectId(media_id)},
                    {"$set": {
                        "status": "PROCESSING",
                        "errorDetails": {
                            "stage": None,
                            "message": None,
                            "userMessage": "Retrying (attempt 2)...",
                            "attempt": 2,
                        },
                    }}
                )
            else:
                db.media.update_one(
                    {"_id": ObjectId(media_id)},
                    {"$set": {"status": "PROCESSING", "errorDetails": None}}
                )
        else:
            db.media.update_one(
                {"_id": ObjectId(media_id)},
                {"$set": {"status": "PROCESSING", "errorDetails": None}}
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
        print(f"🤖 Transcribing Audio on {torch.cuda.get_device_name(0)}...")
        model_start = time.time()

        # Determine Whisper Task: "translate" = output English only; "transcribe" = output in source language
        whisper_task = "translate" if target_language_code == 'en' else "transcribe"

        if source_language_code and source_language_code != 'auto':
            print(f"   -> Forcing Whisper to use source language: '{source_language_code}'")
            result = model.transcribe(
                local_audio_path, 
                task=whisper_task, 
                language=source_language_code, 
                fp16=False
            )
        else:
            print("   -> Auto-detecting source language...")
            result = model.transcribe(
                local_audio_path, 
                task=whisper_task, 
                fp16=False
            )

        model_end = time.time()

        # Whisper's detected source language (effective source = forced source or detected)
        detected_lang = result.get("language", "en")
        effective_source = (source_language_code if (source_language_code and source_language_code != 'auto') else detected_lang).lower()
        target_normalized = (target_language_code or "").lower()
        original_text = result["text"].strip()
        original_segments = result.get('segments', [])

        if target_language_code == 'original':
            final_text = original_text
            final_segments = original_segments
            output_lang = detected_lang
        elif target_language_code == 'en':
            final_text = original_text
            final_segments = original_segments
            output_lang = 'en'
        elif target_normalized == effective_source or target_normalized == detected_lang.lower():
            # Same language: Whisper already produced target language, no need for Gemini
            print(f"   -> Source and target both '{effective_source}'; using Whisper output (no Gemini).")
            final_text = original_text
            final_segments = original_segments
            output_lang = target_language_code
        else:
            # Pivot via English: source → en → target. Ensures segments sent to final step are in English for consistent quality.
            current_stage = "TRANSLATING_JSON"
            print(f"🧠 Pivot via English: {effective_source} → en → {target_language_code}")
            # Step 1: Translate source language to English (segments will be in English)
            english_text, english_segments = translate_transcript_via_gemini(
                original_text, original_segments, "en", source_language_code=effective_source
            )
            # Step 2: Translate English to target language (input is always English = consistent)
            final_text, final_segments = translate_transcript_via_gemini(
                english_text, english_segments, target_language_code, source_language_code="en"
            )
            output_lang = target_language_code

        # Calculate AI Confidence (0 to 1) from Whisper's log probabilities
        segments_for_confidence = original_segments or []
        confidence = 0
        if segments_for_confidence:
            avg_logprob = sum(s.get('avg_logprob', 0) for s in segments_for_confidence) / len(segments_for_confidence)
            confidence = round(math.exp(avg_logprob), 4)

        # Create JSON file for MinIO
        current_stage = "UPLOADING_JSON"
        transcript_data = {
            "text": final_text,
            "segments": final_segments
        }

        with open(local_json_path, 'w') as f:
            json.dump(transcript_data, f, indent=2)

        # Upload JSON file to MinIO
        print(f"📤 Uploading transcript JSON to MinIO: {local_json_path}")
        json_key = f"transcripts/{media_id}_{output_lang}.json"
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
            "plainText": final_text,
            "jsonFile": {
                "bucket": STORAGE_BUCKET_NAME,
                "key": json_key,
                "sizeBytes": json_size,
                "format": "json"
            },
            "language": output_lang,
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
                "detectedLanguage": detected_lang,
                "lengthMs": media_length_ms
            }}
        )

        print(f"📝 DB Update Report -> Matched: {update_result.matched_count} | Modified: {update_result.modified_count}")

        print(f"✅ Transcript saved and media status updated for media ID: {media_id}")
        completed_successfully = True
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        print(f"❌ Error processing message: {e}")
        if media_id and not completed_successfully:
            user_message = get_user_friendly_error(current_stage, str(e))
            if processing_attempt >= 2:
                user_message = f"Failed after 2 attempts. {user_message}"
            db.media.update_one(
                {"_id": ObjectId(media_id)},
                {"$set": {
                    "status": "FAILED",
                    "errorDetails": {
                        "stage": current_stage,
                        "message": str(e),
                        "userMessage": user_message,
                        "attempt": processing_attempt,
                    },
                }}
            )
        if not completed_successfully:
            requeue = processing_attempt == 1
            ch.basic_nack(
                delivery_tag=method.delivery_tag,
                requeue=requeue
            )
            if requeue:
                print(f"   📤 Message requeued for retry (attempt 2).")
        elif completed_successfully:
            # Work was done but ack failed (e.g. connection reset). Do not nack so message is not requeued.
            print("⚠️ Ack failed but transcript was saved; message will not be requeued.")

    finally:
        print("🧹 Cleaning up temporary files...")
        for path in [local_raw_path, local_audio_path, local_json_path]:
            if path is not None and os.path.exists(path):
                os.remove(path)
                print(f"🗑️ Removed temporary file: {path}")

def start_worker():
    print(f"⏳ Connecting to RabbitMQ at {RABBITMQ_URL}...")

    try:
        # Use heartbeat=0 so the connection is not closed during long operations (e.g. Gemini translation).
        # Default heartbeat is 60s; translation can take several minutes.
        url = RABBITMQ_URL
        url = url + ("&" if "?" in url else "?") + "heartbeat=0"
        connection = pika.BlockingConnection(pika.URLParameters(url))
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