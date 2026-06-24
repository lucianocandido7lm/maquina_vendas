FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requisitos_api.txt ./
RUN pip install --no-cache-dir -r requisitos_api.txt

COPY . .

EXPOSE 8000

CMD ["python", "aplicacao.py"]
