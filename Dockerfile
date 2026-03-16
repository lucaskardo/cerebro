FROM python:3.11-slim
WORKDIR /app
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY .env.example .
EXPOSE 8000
CMD uvicorn apps.api.app.main:app --host 0.0.0.0 --port ${PORT:-8000}
