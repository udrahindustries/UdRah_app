# Production Dockerfile For AirRoute Model 3 Python ML Microservice
FROM python:3.10-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install System Utilities For Compiling & Probing
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python ML Dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Model Artifacts, Source Code, And Microservice Server
COPY Model3/ ./Model3/
COPY MlService/ ./MlService/

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "MlService.app:app", "--host", "0.0.0.0", "--port", "8000"]
