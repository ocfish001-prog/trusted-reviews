FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Ensure all __init__.py files are clean (no null bytes from Windows)
RUN find /app -name "__init__.py" -exec sh -c 'echo "# init" > "$1"' _ {} \;

# Expose port
EXPOSE 8000

# Start server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
