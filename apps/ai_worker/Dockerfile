# Single image for both CPU and GPU. GPU is used automatically when the container
# is started with the nvidia runtime (via docker-compose.gpu.yml); falls back to CPU otherwise.
FROM nvidia/cuda:12.6.3-runtime-ubuntu22.04

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# CUDA 12.4 wheel is compatible with any CUDA 12.x runtime
RUN pip3 install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cu124 \
    && pip3 install --no-cache-dir openai-whisper --no-deps \
    && pip3 install --no-cache-dir tqdm more-itertools numba numpy tiktoken \
    && pip3 install --no-cache-dir minio pika pymongo python-dotenv google-genai

COPY . .

CMD ["python3", "-u", "main.py"]
