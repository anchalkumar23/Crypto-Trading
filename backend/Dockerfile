FROM python:3.12-slim

WORKDIR /app

# Install OS deps needed by some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Directory for the SQLite database (mounted as a volume in production)
RUN mkdir -p /data

ENV DATABASE_URL=sqlite+aiosqlite:////data/vegalab.db

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
