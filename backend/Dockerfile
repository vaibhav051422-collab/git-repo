FROM python:3.11-slim

# Install system deps required for building some Python packages
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc libffi-dev libssl-dev git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install first to leverage layer caching
COPY backend/requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy application code
COPY backend /app

ENV PORT 8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
