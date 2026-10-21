# ==============================================================================
# PROYECTO: SEGALÚ (segalu-pantalla)
# ARCHIVO: Dockerfile (Contenedor optimizado de producción para pruebas de estrés)
# ==============================================================================
# Imagen base ligera con Python 3.11 (idéntica a la versión de producción en Render)
FROM python:3.11-slim

# Variables de entorno para optimizar la ejecución de Python en contenedores:
# - PYTHONUNBUFFERED=1: Flujo continuo de logs sin retención en búfer
# - PYTHONDONTWRITEBYTECODE=1: Evita generar archivos .pyc innecesarios
# - PORT=8000: Puerto estándar de la aplicación
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Instalar utilidades básicas del sistema (curl para pruebas de salud)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements primero para aprovechar la memoria caché de capas de Docker
COPY requirements.txt .

# Instalar dependencias oficiales de Python sin guardar caché de ruedas para ahorrar espacio
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente del backend y los recursos estáticos del frontend
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY .env.example .env.example

# Asegurar la existencia de las carpetas de subida de fotos y almacenamiento local
RUN mkdir -p frontend/static/uploads/multimedia frontend/static/img/sedes backend

# Exponer el puerto de escucha
EXPOSE 8000

# Comando de arranque con servidor Uvicorn en modo producción
# NOTA DE ARQUITECTURA: Se utiliza 1 worker para respetar estrictamente los límites
# de 512 MB de RAM del Plan Starter de Render y evitar el OOM (Out Of Memory) Killer,
# además de mantener sincronizado el estado en memoria RAM sin necesidad de Redis.
# ${PORT:-8000} permite enlace dinámico al puerto asignado por Render (ej. 10000) o 8000 local.
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
