FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copiar requirements antes do código aproveita o cache de camadas do Docker.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 5000

# 1 worker: o último dado da telemetria fica em memória do processo.
CMD ["gunicorn", "--workers", "1", "--threads", "4", "--bind", "0.0.0.0:5000", "app:app"]
