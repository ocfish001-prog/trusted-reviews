FROM python:3.11-slim

WORKDIR /app

# Copy backend code (when rootDir is /, we're in the repo root)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Ensure clean __init__.py files
RUN find /app -name "__init__.py" -exec sh -c 'echo "# init" > "$1"' _ {} \;

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
