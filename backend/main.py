# ==============================================================================
# PROYECTO: MVP WEB SEGALU (Eventos & Experiencias)
# ARCHIVO: backend/main.py
# FASE 5: Pantalla Gigante de Proyección 1920x1080 (/proyector) para OBS Studio,
#         Galería con Doble Capa de Fondo Desenfocado (Ambient Blur),
#         Trivia Kahoot con Gráfico de Barras y Podio Secuencial 3° -> 2° -> 1°
# ==============================================================================
# ¿Cómo ejecutar este servidor?
#   uvicorn backend.main:app --reload --port 8000
# Enlaces:
#   - Celular Invitado:      http://localhost:8000/?codigo=SEGALU-2026
#   - Panel Admin Único:     http://localhost:8000/admin
#   - Proyector OBS 1080p:   http://localhost:8000/proyector
# ==============================================================================

from __future__ import annotations

import copy
import ctypes
import gc
import hashlib
import hmac
import io
import json
import os
import random
import re
import time
import urllib.request
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from PIL import Image, ImageOps
from pydantic import BaseModel, Field, field_validator
from supabase import create_client, Client


def liberar_memoria_os():
    """
    Fuerza la recolección de basura en Python y ejecuta malloc_trim(0) en glibc (Linux)
    para devolver inmediatamente las páginas de memoria (RSS) al sistema operativo del contenedor.
    """
    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:
        pass


# ------------------------------------------------------------------------------
# 1. CARGA SEGURA DE VARIABLES DE ENTORNO (PILAR DE CONFIDENCIALIDAD)
# ------------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_INVITADO_DIR = BASE_DIR / "frontend" / "invitado"
FRONTEND_ADMIN_DIR = BASE_DIR / "frontend" / "admin"
FRONTEND_PROYECTOR_DIR = BASE_DIR / "frontend" / "proyector"
FRONTEND_STATIC_DIR = BASE_DIR / "frontend" / "static"
LOCAL_UPLOADS_DIR = FRONTEND_STATIC_DIR / "uploads"
LOGO_SEGALU_PATH = FRONTEND_STATIC_DIR / "img" / "logo_segalu.png"
ESTADO_EVENTOS_JSON_PATH = Path(__file__).resolve().parent / "estado_eventos_segalu.json"

for _dir_path in (
    FRONTEND_INVITADO_DIR,
    FRONTEND_ADMIN_DIR,
    FRONTEND_PROYECTOR_DIR,
    FRONTEND_STATIC_DIR,
    FRONTEND_STATIC_DIR / "img" / "sedes",
    LOCAL_UPLOADS_DIR,
):
    _dir_path.mkdir(parents=True, exist_ok=True)

load_dotenv(BASE_DIR / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "multimedia_segalu").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "SegaluAdmin2026").strip()
ADMIN_SEDE1_PASSWORD = os.getenv("ADMIN_SEDE1_PASSWORD", "segalu-sede1").strip()
ADMIN_SEDE2_PASSWORD = os.getenv("ADMIN_SEDE2_PASSWORD", "segalu-sede2").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip() or "gemini-3.5-flash-lite"

# Secreto para firmar (HMAC) el token de sesión del invitado. Es "stateless": no requiere
# columna nueva en Supabase y sigue siendo válido aunque Render reinicie el servidor.
SESSION_SECRET = (os.getenv("SESSION_SECRET") or f"segalu::{ADMIN_PASSWORD}::{SUPABASE_URL or ''}").encode()


def generar_token_sesion_invitado(invitado_id: str, evento_id: str) -> str:
    mensaje = f"{str(invitado_id).strip()}|{str(evento_id).strip()}".encode()
    return hmac.new(SESSION_SECRET, mensaje, hashlib.sha256).hexdigest()


def verificar_token_sesion_invitado(invitado_id: str, evento_id: str, token: str) -> bool:
    if not token:
        return False
    esperado = generar_token_sesion_invitado(invitado_id, evento_id)
    return hmac.compare_digest(esperado, str(token).strip())

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY and "tu-proyecto-id" not in SUPABASE_URL:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print(
        "⚠️ [AVISO DIDÁCTICO]: Aún no has configurado tu archivo .env con SUPABASE_URL y SUPABASE_KEY reales."
    )

# ==============================================================================
# SISTEMA DE CACHÉ INTELIGENTE EN MEMORIA RAM CON INVALIDACIÓN INSTANTÁNEA
# (TTL: 2.0s por Evento | Tope estricto: máximo 30 llaves y cero bytes de imagen)
# ==============================================================================
_CACHE_LOCALES: list | None = None
_CACHE_DASHBOARD_POR_EVENTO: dict[str, dict] = {}
_CACHE_RAM_SISTEMA: dict[str, dict] = {}
_EVENTO_A_CLAVES_CACHE: dict[str, set[str]] = {}
_CACHE_META_EVENTOS_PROYECTOR: dict[str, dict] = {}
_CACHE_TTL_SEGUNDOS = 2.0
_MAX_CACHE_RAM_ENTRADAS = 30
_CONTADOR_INSERCIONES_CACHE = 0


def _limitar_y_purgar_diccionario_cache(
    diccionario: dict[str, dict],
    ttl_seg: float | None = None,
    max_llaves: int = 30,
    ttl: float | None = None,
    ttl_max: float | None = None,
    **kwargs,
):
    """
    Purga entradas vencidas y aplica tope estricto de máximo 30 llaves (FIFO/LRU).
    Soporta invocaciones con ttl_seg, ttl, ttl_max o timestamp posicional sin lanzar TypeError.
    """
    ahora = time.time()
    ttl_efectivo = _CACHE_TTL_SEGUNDOS
    if ttl_max is not None:
        ttl_efectivo = float(ttl_max)
    elif ttl is not None:
        ttl_efectivo = float(ttl)
    elif ttl_seg is not None:
        # Si se pasó un timestamp Unix (> 1_000_000_000) como 2do argumento posicional, usar TTL por defecto (4.0s)
        ttl_efectivo = 4.0 if float(ttl_seg) > 1_000_000_000 else float(ttl_seg)

    expiradas = [
        k for k, v in list(diccionario.items())
        if not isinstance(v, dict) or (ahora - float(v.get("ts", 0))) > ttl_efectivo
    ]
    for k in expiradas:
        diccionario.pop(k, None)

    if len(diccionario) > max_llaves:
        ordenadas = sorted(diccionario.items(), key=lambda it: float(it[1].get("ts", 0) if isinstance(it[1], dict) else 0))
        exceso = len(diccionario) - max_llaves
        for k, _ in ordenadas[:exceso]:
            diccionario.pop(k, None)


def purgar_cache_ram_expirada():
    """
    Control estricto de memoria RAM para Render (Plan 512 MB):
    1. Purga automáticamente las entradas que excedieron el TTL en todos los diccionarios de caché.
    2. Garantiza que ningún diccionario de caché supere jamás las 30 llaves.
    """
    _limitar_y_purgar_diccionario_cache(_CACHE_RAM_SISTEMA, _CACHE_TTL_SEGUNDOS, _MAX_CACHE_RAM_ENTRADAS)
    _limitar_y_purgar_diccionario_cache(_CACHE_DASHBOARD_POR_EVENTO, _CACHE_TTL_SEGUNDOS, _MAX_CACHE_RAM_ENTRADAS)
    _limitar_y_purgar_diccionario_cache(_CACHE_META_EVENTOS_PROYECTOR, 4.0, _MAX_CACHE_RAM_ENTRADAS)

    if len(_EVENTO_A_CLAVES_CACHE) > _MAX_CACHE_RAM_ENTRADAS:
        for k in list(_EVENTO_A_CLAVES_CACHE.keys())[:-_MAX_CACHE_RAM_ENTRADAS]:
            _EVENTO_A_CLAVES_CACHE.pop(k, None)


def obtener_cache_ram(clave: str) -> Any | None:
    """
    Lógica de Lectura (GET): Purga llaves vencidas automáticamente en cada lectura.
    Si la llave está vigente (<= 2.0s), responde en <1ms desde RAM.
    """
    purgar_cache_ram_expirada()
    ahora = time.time()
    entrada = _CACHE_RAM_SISTEMA.get(clave)
    if entrada and (ahora - entrada["ts"]) <= _CACHE_TTL_SEGUNDOS:
        return entrada["datos"]
    _CACHE_RAM_SISTEMA.pop(clave, None)
    return None


def guardar_cache_ram(clave: str, datos: Any, evento_id: str | None = None):
    """
    Guarda un resultado JSON ligero en memoria RAM indexado por evento.
    Prohibido almacenar bytes de imágenes y tope estricto de 30 llaves.
    """
    if isinstance(datos, (bytes, bytearray, memoryview)):
        return

    global _CONTADOR_INSERCIONES_CACHE
    purgar_cache_ram_expirada()

    _CACHE_RAM_SISTEMA[clave] = {
        "ts": time.time(),
        "datos": datos,
        "evento_id": evento_id,
    }
    if evento_id:
        eid_clean = str(evento_id).strip()
        if eid_clean not in _EVENTO_A_CLAVES_CACHE:
            _EVENTO_A_CLAVES_CACHE[eid_clean] = set()
        _EVENTO_A_CLAVES_CACHE[eid_clean].add(clave)

    _CONTADOR_INSERCIONES_CACHE += 1
    if len(_CACHE_RAM_SISTEMA) > _MAX_CACHE_RAM_ENTRADAS or _CONTADOR_INSERCIONES_CACHE >= 10:
        _CONTADOR_INSERCIONES_CACHE = 0
        purgar_cache_ram_expirada()


def invalidar_cache_evento(evento_id: str | None = None):
    """
    LÓGICA DE ESCRITURA E INVALIDACIÓN INSTANTÁNEA (0 ms):
    Borra las entradas de caché del evento modificado y libera páginas de memoria al SO.
    """
    if evento_id:
        eid_clean = str(evento_id).strip()
        claves = _EVENTO_A_CLAVES_CACHE.pop(eid_clean, set())
        for k in claves:
            _CACHE_RAM_SISTEMA.pop(k, None)
        _CACHE_DASHBOARD_POR_EVENTO.pop(eid_clean, None)

        claves_extra = [
            k for k, v in list(_CACHE_RAM_SISTEMA.items())
            if v.get("evento_id") == eid_clean or eid_clean in k
        ]
        for k in claves_extra:
            _CACHE_RAM_SISTEMA.pop(k, None)
    else:
        _CACHE_RAM_SISTEMA.clear()
        _EVENTO_A_CLAVES_CACHE.clear()
        _CACHE_DASHBOARD_POR_EVENTO.clear()

    _CACHE_RAM_SISTEMA.pop("catalogo_accesorios", None)
    _CACHE_META_EVENTOS_PROYECTOR.clear()
    purgar_cache_ram_expirada()


# ------------------------------------------------------------------------------
# 2. ESTADO EN TIEMPO REAL POR EVENTO (AUTO-APROBAR FOTOS Y MOTOR DE TRIVIA)
# ------------------------------------------------------------------------------
_ESTADO_EVENTOS: dict[str, dict] = {}


def _cargar_estado_eventos_disco():
    global _ESTADO_EVENTOS
    if ESTADO_EVENTOS_JSON_PATH.exists():
        try:
            contenido = json.loads(ESTADO_EVENTOS_JSON_PATH.read_text(encoding="utf-8"))
            if isinstance(contenido, dict):
                _ESTADO_EVENTOS = contenido
        except Exception:
            _ESTADO_EVENTOS = {}


def _guardar_estado_eventos_disco():
    try:
        ESTADO_EVENTOS_JSON_PATH.write_text(
            json.dumps(_ESTADO_EVENTOS, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as err:
        print(f"Aviso al persistir estado de eventos: {err}")


_cargar_estado_eventos_disco()


def obtener_estado_evento(evento_id: str) -> dict:
    eid = evento_id.strip()
    if eid not in _ESTADO_EVENTOS:
        _ESTADO_EVENTOS[eid] = {
            "auto_aprobar_fotos": False,
            "modo_galeria": "ciclo_auto",  # ciclo_auto | individual | mosaico
            "duracion_foto_segundos": 8,   # 5 | 8 | 12
            "fase_trivia": "inactiva",     # inactiva | lobby | pregunta_activa | respuesta_revelada | podio
            "pregunta_activa_id": None,
            "timestamp_lanzamiento": 0.0,
            "preguntas_fallback": [],
            "respuestas_fallback": [],
        }
    estado = _ESTADO_EVENTOS[eid]
    estado.setdefault("modo_galeria", "ciclo_auto")
    estado.setdefault("duracion_foto_segundos", 8)
    return estado


# ------------------------------------------------------------------------------
# 3. CONFIGURACIÓN DE FASTAPI
# ------------------------------------------------------------------------------
app = FastAPI(
    title="API MVP Segalú - Fase 4.5",
    description="Servidor Backend de Segalú Eventos: Eliminación en Storage, Dashboard Paralelo (<200ms), Trivia Kahoot y Generador PDF con Gemini IA.",
    version="1.4.5",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PERSONAJES_PERMITIDOS = {
    "pug_real": "Pug Real",
    "gatito_gala": "Gato Smoking",
    "osito_gala": "Osito Gala",
    "zorro_glam": "Zorro Glam",
    "conejita_real": "Conejita Real",
    "leon_imperial": "León Imperial",
}


def validar_formato_avatar_kahoot(valor: str) -> str:
    valor_limpio = valor.strip().lower()
    if not re.match(r"^[a-z0-9_]+(\|[a-z0-9_\-\./]+)?$", valor_limpio) or len(valor_limpio) > 100:
        raise ValueError("Formato de muñequito o accesorio inválido.")

    partes = valor_limpio.split("|")
    personaje_id = partes[0]
    accesorio_id = partes[1] if len(partes) > 1 else "corona_imperial"

    if personaje_id not in PERSONAJES_PERMITIDOS:
        raise ValueError(f"El personaje '{personaje_id}' no está en el catálogo oficial de Segalú.")

    return f"{personaje_id}|{accesorio_id}"


# ------------------------------------------------------------------------------
# 4. MODELOS PYDANTIC (VALIDACIÓN ESTRICTA DE ENTRADA)
# ------------------------------------------------------------------------------
class RegistroInvitadoInput(BaseModel):
    evento_id: str = Field(..., min_length=10, max_length=50)
    nombre_invitado: str = Field(..., min_length=2, max_length=60)
    avatar_munequito: str = Field(default="pug_real|corona_imperial")

    @field_validator("nombre_invitado")
    @classmethod
    def validar_y_limpiar_nombre(cls, valor: str) -> str:
        nombre_limpio = " ".join(valor.strip().split())
        if len(nombre_limpio) < 2:
            raise ValueError("El nombre debe tener al menos 2 letras.")
        patron_seguro = re.compile(r"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\.\-]+$")
        if not patron_seguro.match(nombre_limpio):
            raise ValueError("El nombre solo puede contener letras, números y espacios.")
        return nombre_limpio

    @field_validator("avatar_munequito")
    @classmethod
    def validar_avatar(cls, valor: str) -> str:
        return validar_formato_avatar_kahoot(valor)


class ActualizarAvatarInput(BaseModel):
    avatar_munequito: str = Field(...)

    @field_validator("avatar_munequito")
    @classmethod
    def validar_avatar(cls, valor: str) -> str:
        return validar_formato_avatar_kahoot(valor)


class LoginAdminInput(BaseModel):
    password: str = Field(..., min_length=1, max_length=100)


class CrearEventoAdminInput(BaseModel):
    local_id: str = Field(..., min_length=10, max_length=50)
    nombre: str = Field(..., min_length=3, max_length=120)
    codigo_acceso: str = Field(..., min_length=3, max_length=20)
    fecha_evento: str = Field(default_factory=lambda: date.today().isoformat())
    tematica_accesorios: str | None = Field(default="todos")


class ActualizarTematicaEventoInput(BaseModel):
    tematica_accesorios: str = Field(..., max_length=200)


class RenombrarInvitadoInput(BaseModel):
    nombre: str | None = Field(default=None, max_length=100)
    nuevo_nombre: str | None = Field(default=None, max_length=100)


class TituloFotoSedeInput(BaseModel):
    sede: str = Field(..., max_length=20)
    numero_foto: int = Field(..., ge=1, le=4)
    titulo: str = Field(..., max_length=120)


class LikeFotoInput(BaseModel):
    delta: int = Field(default=1)
    invitado_id: str | None = Field(default=None)


class EditarPreguntaAdminInput(BaseModel):
    enunciado: str | None = Field(default=None, max_length=280)
    opcion_a: str | None = Field(default=None, max_length=140)
    opcion_b: str | None = Field(default=None, max_length=140)
    opcion_c: str | None = Field(default=None, max_length=140)
    opcion_d: str | None = Field(default=None, max_length=140)
    respuesta_correcta: str | None = Field(default=None, pattern="^[ABCDabcd]?$")
    tiempo_limite_segundos: int | None = Field(default=None, ge=5, le=60)


class ModerarMultimediaInput(BaseModel):
    estado_moderacion: str = Field(..., pattern="^(aprobado|rechazado|pendiente)$")


class AutoAprobarInput(BaseModel):
    activo: bool = Field(...)


class CrearPreguntaAdminInput(BaseModel):
    evento_id: str = Field(..., min_length=10, max_length=50)
    enunciado: str = Field(..., min_length=5, max_length=280)
    opcion_a: str = Field(..., min_length=1, max_length=140)
    opcion_b: str = Field(..., min_length=1, max_length=140)
    opcion_c: str = Field(..., min_length=1, max_length=140)
    opcion_d: str = Field(..., min_length=1, max_length=140)
    respuesta_correcta: str = Field(..., pattern="^[ABCDabcd]$")
    tiempo_limite_segundos: int = Field(default=20, ge=5, le=60)


class ControlTriviaInput(BaseModel):
    accion: str = Field(
        ...,
        pattern="^(abrir_lobby|lanzar_pregunta|revelar_respuesta|mostrar_ranking|mostrar_podio|cerrar_trivia|reiniciar_puntajes)$",
    )
    pregunta_id: str | None = Field(default=None)


class ResponderTriviaInput(BaseModel):
    evento_id: str = Field(..., min_length=10, max_length=50)
    pregunta_id: str = Field(..., min_length=5, max_length=50)
    invitado_id: str = Field(..., min_length=10, max_length=50)
    opcion_elegida: str = Field(..., pattern="^[ABCDTabcdt]$")
    tiempo_respuesta_ms: int = Field(default=5000, ge=0, le=120000)


class RegistroLeadInput(BaseModel):
    evento_id: str = Field(..., min_length=5, max_length=60)
    nombre: str = Field(..., min_length=2, max_length=150)
    telefono: str = Field(..., min_length=1, max_length=50)
    fecha_nacimiento: str = Field(..., min_length=4, max_length=30)
    genero: str | None = Field(default="No especificado", max_length=30)
    correo: str | None = Field(default=None, max_length=150)


# ------------------------------------------------------------------------------
# 5. CONEXIÓN SEGURA Y CLIENTE AISLADO PARA CONSULTAS EN PARALELO
# ------------------------------------------------------------------------------
def verificar_conexion_supabase() -> Client:
    global supabase
    if supabase is None:
        if SUPABASE_URL and SUPABASE_KEY and "tu-proyecto-id" not in SUPABASE_URL:
            supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        else:
            raise HTTPException(
                status_code=500,
                detail="El servidor Python aún no tiene configurado el archivo .env con SUPABASE_URL y SUPABASE_KEY.",
            )
    return supabase


def ejecutar_consulta_segura(operacion_fn):
    global supabase
    try:
        return operacion_fn(verificar_conexion_supabase())
    except HTTPException:
        raise
    except Exception:
        time.sleep(0.02)
        if SUPABASE_URL and SUPABASE_KEY:
            supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        return operacion_fn(verificar_conexion_supabase())


def obtener_rol_admin(x_admin_password: str | None) -> dict:
    """
    Control de acceso por sede con 0 MB de memoria extra:
    Compara en O(1) la contraseña recibida contra las variables de entorno:
    - ADMIN_PASSWORD -> superadmin (acceso global a todas las sedes)
    - ADMIN_SEDE1_PASSWORD -> sede1 (Sede 1 - El Colocho)
    - ADMIN_SEDE2_PASSWORD -> sede2 (Sede 2 - Crystal Garden)
    """
    if not x_admin_password:
        raise HTTPException(
            status_code=401,
            detail="Contraseña de Administrador incorrecta o no proporcionada.",
        )
    pw = x_admin_password.strip()
    if pw == ADMIN_PASSWORD:
        return {
            "rol": "superadmin",
            "sede_clave": None,
            "sede_nombre": "Todas las Sedes (Superadmin)",
            "es_superadmin": True,
        }
    elif pw == ADMIN_SEDE1_PASSWORD:
        return {
            "rol": "sede1",
            "sede_clave": "sede1",
            "sede_nombre": "Sede 1 - El Colocho",
            "es_superadmin": False,
        }
    elif pw == ADMIN_SEDE2_PASSWORD:
        return {
            "rol": "sede2",
            "sede_clave": "sede2",
            "sede_nombre": "Sede 2 - Crystal Garden",
            "es_superadmin": False,
        }
    else:
        raise HTTPException(
            status_code=401,
            detail="Contraseña de Administrador incorrecta o no autorizada.",
        )


def verificar_admin_password(x_admin_password: str | None) -> dict:
    return obtener_rol_admin(x_admin_password)


def validar_permiso_sede_evento(evento_id: str, info_rol: dict):
    """
    Verifica que un operador de Sede 1 o Sede 2 solo pueda modificar eventos de su sede asignada.
    """
    if not info_rol or info_rol.get("rol") == "superadmin":
        return
    eid = str(evento_id).strip()
    nombre_loc = ""
    try:
        res = ejecutar_consulta_segura(
            lambda db: db.table("eventos")
            .select("id, local_id, locales(nombre)")
            .or_(f"id.eq.{eid},codigo_acceso.eq.{eid}")
            .limit(1)
            .execute()
        )
        if res and res.data:
            nombre_loc = ((res.data[0].get("locales") or {}).get("nombre") or "").lower()
    except Exception:
        pass

    if not nombre_loc:
        return

    rol = info_rol.get("rol")
    if rol == "sede1" and ("colocho" not in nombre_loc and "sede 1" not in nombre_loc):
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado: este evento pertenece a Sede 2 - Crystal Garden.",
        )
    if rol == "sede2" and ("crystal" not in nombre_loc and "sede 2" not in nombre_loc):
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado: este evento pertenece a Sede 1 - El Colocho.",
        )


# ------------------------------------------------------------------------------
# 6. CAPA DE ACCESO A PREGUNTAS Y RESPUESTAS (SIN PROBLEMA N+1)
# ------------------------------------------------------------------------------
def listar_preguntas_evento(evento_id: str) -> list[dict]:
    eid = evento_id.strip()
    estado_ev = obtener_estado_evento(eid)
    try:
        res = ejecutar_consulta_segura(
            lambda db: db.table("preguntas")
            .select("*")
            .eq("evento_id", eid)
            .order("orden")
            .order("created_at")
            .execute()
        )
        datos_db = res.data or []
        if datos_db or not estado_ev.get("preguntas_fallback"):
            estado_ev["preguntas_fallback"] = datos_db
            return datos_db
        return estado_ev["preguntas_fallback"]
    except Exception:
        return estado_ev.get("preguntas_fallback", [])


def listar_respuestas_evento_lote(evento_id: str, pregunta_ids: list[str]) -> list[dict]:
    """
    DIDÁCTICA (Optimización Fase 4.5 - Cero Consultas N+1):
    En vez de hacer 10 consultas separadas a 'respuestas_trivia' (una por pregunta),
    traemos todas las respuestas del evento en UNA SOLA consulta usando .in_().
    """
    eid = evento_id.strip()
    estado_ev = obtener_estado_evento(eid)
    respuestas_locales = [
        r for r in estado_ev.get("respuestas_fallback", []) if r.get("pregunta_id") in pregunta_ids
    ]
    if not pregunta_ids:
        return []

    try:
        res = ejecutar_consulta_segura(
            lambda db: db.table("respuestas_trivia")
            .select("*")
            .in_("pregunta_id", pregunta_ids)
            .execute()
        )
        datos_db = res.data or []
        if datos_db:
            # Combinar con respuestas locales por (pregunta_id, invitado_id)
            mapa = {(r["pregunta_id"], r["invitado_id"]): r for r in respuestas_locales}
            for r in datos_db:
                mapa[(r["pregunta_id"], r["invitado_id"])] = r
            return list(mapa.values())
    except Exception:
        pass
    return respuestas_locales


def listar_respuestas_pregunta(evento_id: str, pregunta_id: str) -> list[dict]:
    return listar_respuestas_evento_lote(evento_id, [pregunta_id.strip()])


def insertar_pregunta_evento(nueva_pregunta: dict) -> dict:
    eid = nueva_pregunta["evento_id"]
    estado_ev = obtener_estado_evento(eid)
    invalidar_cache_evento(eid)

    try:
        res = ejecutar_consulta_segura(
            lambda db: db.table("preguntas").insert(nueva_pregunta).execute()
        )
        if res.data:
            creada = res.data[0]
            estado_ev["preguntas_fallback"].append(creada)
            _guardar_estado_eventos_disco()
            return creada
    except Exception as err:
        print(f"Aviso RLS tabla preguntas (usando respaldo sincronizado): {err}")

    pregunta_local = {
        "id": str(uuid.uuid4()),
        **nueva_pregunta,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    estado_ev["preguntas_fallback"].append(pregunta_local)
    _guardar_estado_eventos_disco()
    return pregunta_local


def eliminar_pregunta_por_id(pregunta_id: str) -> bool:
    pid = pregunta_id.strip()
    invalidar_cache_evento()
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("preguntas").delete().eq("id", pid).execute()
        )
    except Exception:
        pass

    for estado_ev in _ESTADO_EVENTOS.values():
        antes = len(estado_ev.get("preguntas_fallback", []))
        estado_ev["preguntas_fallback"] = [
            p for p in estado_ev.get("preguntas_fallback", []) if p.get("id") != pid
        ]
        if estado_ev.get("pregunta_activa_id") == pid:
            estado_ev["pregunta_activa_id"] = None
            estado_ev["fase_trivia"] = "lobby"
        if len(estado_ev["preguntas_fallback"]) != antes:
            _guardar_estado_eventos_disco()
    return True


def actualizar_flags_preguntas_evento(
    evento_id: str,
    pregunta_activa_id: str | None,
    revelar_respuesta: bool,
):
    eid = evento_id.strip()
    estado_ev = obtener_estado_evento(eid)
    invalidar_cache_evento(eid)

    try:
        ejecutar_consulta_segura(
            lambda db: db.table("preguntas")
            .update({"activa": False, "revelar_respuesta": False})
            .eq("evento_id", eid)
            .execute()
        )
        if pregunta_activa_id:
            ejecutar_consulta_segura(
                lambda db: db.table("preguntas")
                .update({"activa": True, "revelar_respuesta": revelar_respuesta})
                .eq("id", pregunta_activa_id)
                .execute()
            )
    except Exception:
        pass

    for p in estado_ev.get("preguntas_fallback", []):
        if pregunta_activa_id and p.get("id") == pregunta_activa_id:
            p["activa"] = True
            p["revelar_respuesta"] = revelar_respuesta
        else:
            p["activa"] = False
            p["revelar_respuesta"] = False
    _guardar_estado_eventos_disco()


# ------------------------------------------------------------------------------
# 7. GENERADOR DE HASTA 10 PREGUNTAS DESDE PDF CON IA GRATUITA (GEMINI / LOCAL)
# ------------------------------------------------------------------------------
def extraer_texto_de_pdf(pdf_bytes: bytes) -> str:
    """
    DIDÁCTICA (Fase 4.5 - Lector de PDF con Lazy Import de pypdf):
    Importa 'pypdf' de forma diferida solo cuando el Administrador sube un PDF,
    lee las páginas, cierra el buffer en memoria y libera páginas al SO Linux.
    """
    texto_paginas = []
    bio = None
    lector = None
    try:
        try:
            import pypdf as _pypdf
        except ImportError:
            _pypdf = None

        if _pypdf is not None:
            try:
                bio = io.BytesIO(pdf_bytes)
                lector = _pypdf.PdfReader(bio)
                for pagina in lector.pages:
                    txt = pagina.extract_text() or ""
                    if txt.strip():
                        texto_paginas.append(txt.strip())
            except Exception as err:
                print(f"Aviso pypdf: {err}")

        texto_unido = "\n".join(texto_paginas).strip()
        if texto_unido:
            return texto_unido

        # Respaldo de emergencia en caso de PDF con streams comprimidos simples
        try:
            import zlib
            fragmentos = []
            for match in re.finditer(rb"stream[\r\n]+(.*?)[\r\n]+endstream", pdf_bytes, re.DOTALL):
                bloque = match.group(1)
                try:
                    descomprimido = zlib.decompress(bloque).decode("latin-1", errors="ignore")
                except Exception:
                    descomprimido = bloque.decode("latin-1", errors="ignore")
                for texto_parentesis in re.findall(r"\(([^()]{2,200})\)", descomprimido):
                    fragmentos.append(texto_parentesis)
            return "\n".join(fragmentos).strip()
        except Exception:
            return ""
    finally:
        if bio is not None:
            try:
                bio.close()
            except Exception:
                pass
        del lector
        liberar_memoria_os()


BANCOS_DISTRACTORES_CERCANOS = {
    "distritos_lima": [
        "Carabayllo",
        "Comas",
        "Los Olivos",
        "Puente Piedra",
        "San Martín de Porres",
        "Independencia",
        "Miraflores",
        "San Isidro",
        "Santiago de Surco",
        "La Molina",
        "Barranco",
        "San Borja",
        "Jesús María",
        "Lince",
        "Magdalena del Mar",
        "Pueblo Libre",
        "San Miguel",
        "Chorrillos",
    ],
    "ciudades_peru": [
        "Lima",
        "Cusco",
        "Arequipa",
        "Trujillo",
        "Piura",
        "Ica",
        "Chiclayo",
        "Huancayo",
        "Cajamarca",
        "Tarapoto",
        "Puno",
        "Iquitos",
    ],
    "meses": [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
    ],
    "colores": [
        "Dorado Champán",
        "Azul Real",
        "Rojo Rubí",
        "Verde Esmeralda",
        "Blanco Marfil",
        "Plata Brillante",
        "Rosa Cuarzo",
        "Negro Gala",
    ],
    "generos_musicales": [
        "Salsa y Timba",
        "Cumbia Peruana",
        "Merengue Festivo",
        "Bachata Romántica",
        "Rock de los 80s",
        "Pop Latino",
        "Vals Criollo",
        "Reggaetón Clásico",
    ],
}


def generar_3_distractores_cercanos(respuesta_correcta: str, pool_respuestas_pdf: list[str]) -> list[str]:
    """
    DIDÁCTICA (Generador Semántico Local de 3 Alternativas Incorrectas Cercanas):
    Analiza la respuesta correcta extraída del PDF y crea 3 distractores muy
    parecidos de la misma categoría (ej. si es un distrito, otros 3 distritos;
    si es un año, 3 años cercanos; si es una cantidad, 3 cantidades cercanas).
    """
    resp_limpia = respuesta_correcta.strip()
    resp_lower = resp_limpia.lower()

    # 1. ¿Es un distrito de Lima (o contiene el nombre de un distrito)?
    for distrito in BANCOS_DISTRACTORES_CERCANOS["distritos_lima"]:
        if distrito.lower() in resp_lower:
            candidatos = [
                d for d in BANCOS_DISTRACTORES_CERCANOS["distritos_lima"]
                if d.lower() not in resp_lower
            ]
            random.shuffle(candidatos)
            return candidatos[:3]

    # 2. ¿Es una ciudad o departamento del Perú?
    for ciudad in BANCOS_DISTRACTORES_CERCANOS["ciudades_peru"]:
        if ciudad.lower() == resp_lower or f" {ciudad.lower()}" in f" {resp_lower}":
            candidatos = [
                c for c in BANCOS_DISTRACTORES_CERCANOS["ciudades_peru"]
                if c.lower() != resp_lower
            ]
            random.shuffle(candidatos)
            return candidatos[:3]

    # 3. ¿Es un mes del año?
    for mes in BANCOS_DISTRACTORES_CERCANOS["meses"]:
        if mes.lower() in resp_lower:
            candidatos = [
                m for m in BANCOS_DISTRACTORES_CERCANOS["meses"]
                if m.lower() not in resp_lower
            ]
            random.shuffle(candidatos)
            return candidatos[:3]

    # 4. ¿Es un año de 4 dígitos (ej. 1998, 2019, 2026)?
    match_anio = re.search(r"\b(19\d{2}|20\d{2})\b", resp_limpia)
    if match_anio and len(resp_limpia) <= 18:
        anio = int(match_anio.group(1))
        variaciones = [anio - 2, anio - 1, anio + 1, anio + 2, anio - 3]
        distractores = []
        for v in variaciones:
            nuevo_txt = resp_limpia.replace(str(anio), str(v), 1)
            if nuevo_txt != resp_limpia and nuevo_txt not in distractores:
                distractores.append(nuevo_txt)
        if len(distractores) >= 3:
            return distractores[:3]

    # 5. ¿Contiene un número o cantidad (ej. "300 personas", "15 años", "4 sedes")?
    match_num = re.search(r"\b(\d+)\b", resp_limpia)
    if match_num:
        num = int(match_num.group(1))
        if num > 20:
            paso = max(5, int(round(num * 0.25 / 5.0)) * 5)
            candidatos_num = [max(1, num - paso), num + paso, num + (paso * 2), max(1, num - (paso * 2))]
        else:
            candidatos_num = [max(1, num - 1), num + 1, num + 2, num + 3]

        distractores = []
        for cn in candidatos_num:
            if cn != num:
                nuevo_txt = re.sub(r"\b" + str(num) + r"\b", str(cn), resp_limpia, count=1)
                if nuevo_txt not in distractores:
                    distractores.append(nuevo_txt)
        if len(distractores) >= 3:
            return distractores[:3]

    # 6. ¿Es un color o género musical?
    for clave_banco in ("colores", "generos_musicales"):
        for item in BANCOS_DISTRACTORES_CERCANOS[clave_banco]:
            if item.split()[0].lower() in resp_lower:
                candidatos = [
                    x for x in BANCOS_DISTRACTORES_CERCANOS[clave_banco]
                    if x.lower() != resp_lower
                ]
                random.shuffle(candidatos)
                return candidatos[:3]

    # 7. Usar otras respuestas reales del mismo PDF como distractores contextuales
    otros_del_pdf = [
        r.strip()
        for r in pool_respuestas_pdf
        if r.strip() and r.strip().lower() != resp_lower and len(r.strip()) <= 120
    ]
    random.shuffle(otros_del_pdf)

    relleno_elegante = [
        "En San Isidro (Centro Empresarial)",
        "En Miraflores (Malecón de la Reserva)",
        "En Santiago de Surco",
        "Durante la ceremonia de aniversario",
        "En la recepción principal de gala",
    ]
    for extra in relleno_elegante:
        if extra.lower() != resp_lower and extra not in otros_del_pdf:
            otros_del_pdf.append(extra)

    return otros_del_pdf[:3]


def armar_pregunta_4_opciones(enunciado: str, respuesta_correcta_texto: str, distractores: list[str]) -> dict:
    """
    Mezcla la respuesta correcta con las 3 incorrectas para que la letra
    correcta ('A', 'B', 'C' o 'D') varíe aleatoriamente.
    """
    resp_limpia = respuesta_correcta_texto.strip()[:135]
    dist_limpios = []
    for d in distractores:
        d_str = str(d).strip()[:135]
        if d_str and d_str.lower() != resp_limpia.lower() and d_str not in dist_limpios:
            dist_limpios.append(d_str)

    while len(dist_limpios) < 3:
        extra = f"Alternativa de gala #{len(dist_limpios) + 1}"
        dist_limpios.append(extra)

    opciones_4 = [resp_limpia, dist_limpios[0], dist_limpios[1], dist_limpios[2]]
    random.shuffle(opciones_4)

    letras = ["A", "B", "C", "D"]
    indice_correcto = opciones_4.index(resp_limpia)
    letra_correcta = letras[indice_correcto]

    return {
        "enunciado": enunciado.strip()[:275],
        "opcion_a": opciones_4[0],
        "opcion_b": opciones_4[1],
        "opcion_c": opciones_4[2],
        "opcion_d": opciones_4[3],
        "respuesta_correcta": letra_correcta,
        "tiempo_limite_segundos": 20,
    }


def generar_preguntas_con_gemini_ia(texto_pdf: str, max_preguntas: int = 10) -> list[dict] | None:
    """
    DIDÁCTICA (Conexión con Google Gemini IA con Lazy Import):
    Importa 'google.generativeai' de forma diferida solo cuando se invoca la generación
    de trivia desde PDF y libera la memoria al finalizar.
    """
    if not GEMINI_API_KEY or "tu-api-key" in GEMINI_API_KEY.lower():
        return None

    try:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=FutureWarning)
            import google.generativeai as genai
    except ImportError:
        return None

    prompt_sistema = f"""
Eres el diseñador experto de trivias estilo Kahoot para "Segalú Eventos".
A continuación recibirás el texto extraído de un documento PDF que contiene preguntas y respuestas (o información de un evento).

TU TAREA:
1. Extrae hasta {max_preguntas} preguntas del texto junto con su respuesta correcta.
2. Para cada pregunta, inventa automáticamente 3 alternativas INCORRECTAS (distractores) que sean MUY CERCANAS, creíbles y de la misma categoría que la respuesta correcta (por ejemplo: si la respuesta correcta es un distrito de Lima, inventa otros 3 distritos cercanos; si es un año, otros 3 años cercanos; si es un plato o lugar, otros 3 similares).
3. Distribuye la respuesta correcta aleatoriamente entre las opciones A, B, C y D.
4. Responde ÚNICAMENTE con un arreglo JSON válido con este formato exacto:
[
  {{
    "enunciado": "¿Texto de la pregunta?",
    "opcion_a": "Texto opción A",
    "opcion_b": "Texto opción B",
    "opcion_c": "Texto opción C",
    "opcion_d": "Texto opción D",
    "respuesta_correcta": "A",
    "tiempo_limite_segundos": 20
  }}
]

TEXTO DEL PDF:
\"\"\"
{texto_pdf[:14000]}
\"\"\"
"""

    modelo = None
    respuesta = None
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        nombre_modelo = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip() or GEMINI_MODEL
        modelo = genai.GenerativeModel(
            nombre_modelo,
            generation_config={"response_mime_type": "application/json"},
        )
        respuesta = modelo.generate_content(
            prompt_sistema,
            generation_config={"response_mime_type": "application/json"},
        )
        texto_resp = (respuesta.text or "").strip()

        # Al usar response_mime_type="application/json", la respuesta ya viene como JSON limpio
        try:
            datos_parseados = json.loads(texto_resp)
        except json.JSONDecodeError:
            inicio = texto_resp.find("[")
            fin = texto_resp.rfind("]")
            if inicio != -1 and fin != -1 and fin > inicio:
                datos_parseados = json.loads(texto_resp[inicio : fin + 1])
            else:
                return None

        lista_json = (
            datos_parseados
            if isinstance(datos_parseados, list)
            else datos_parseados.get("preguntas", [])
            if isinstance(datos_parseados, dict)
            else []
        )

        preguntas_validas = []
        for item in lista_json[:max_preguntas]:
            if not isinstance(item, dict):
                continue
            letra = str(item.get("respuesta_correcta", "A")).strip().upper()
            if letra not in ("A", "B", "C", "D"):
                letra = "A"
            if item.get("enunciado") and item.get("opcion_a") and item.get("opcion_b"):
                preguntas_validas.append(
                    {
                        "enunciado": str(item["enunciado"]).strip()[:275],
                        "opcion_a": str(item["opcion_a"]).strip()[:135],
                        "opcion_b": str(item["opcion_b"]).strip()[:135],
                        "opcion_c": str(item.get("opcion_c", "Opción C")).strip()[:135],
                        "opcion_d": str(item.get("opcion_d", "Opción D")).strip()[:135],
                        "respuesta_correcta": letra,
                        "tiempo_limite_segundos": int(item.get("tiempo_limite_segundos") or 20),
                    }
                )
        if preguntas_validas:
            return preguntas_validas
    except Exception as err:
        print(f"Aviso Gemini API ({GEMINI_MODEL}): {err}")
    finally:
        del modelo
        del respuesta
        liberar_memoria_os()

    return None


def extraer_preguntas_pdf_modo_local(texto_pdf: str, max_preguntas: int = 10) -> list[dict]:
    """
    DIDÁCTICA (Modo Extractor Inteligente Local de Respaldo):
    Si el usuario aún no ha pegado su GEMINI_API_KEY en el archivo .env, este
    motor analiza las líneas del PDF buscando preguntas (¿...?) y sus respuestas
    correctas e inventa automáticamente las 3 alternativas cercanas.
    """
    lineas = [lin.strip() for lin in texto_pdf.splitlines() if lin.strip()]
    pares_encontrados: list[tuple[str, str]] = []

    i = 0
    while i < len(lineas) and len(pares_encontrados) < max_preguntas:
        linea = lineas[i]

        # Caso 1: Pregunta y respuesta en la misma línea (ej. "¿Dónde nació? Respuesta: Lima" o "¿Pregunta? - Lima")
        if "?" in linea:
            partes_q = linea.split("?", 1)
            enunciado_bruto = partes_q[0].strip() + "?"
            enunciado_limpio = re.sub(r"^\d+[\.\)\-\s]+", "", enunciado_bruto).strip()
            if not enunciado_limpio.startswith("¿"):
                enunciado_limpio = "¿" + enunciado_limpio

            resto_misma_linea = partes_q[1].strip()
            resto_misma_linea = re.sub(
                r"^(respuesta\s*correcta|respuesta|rpta|r|soluci[oó]n)\s*[:\-]\s*",
                "",
                resto_misma_linea,
                flags=re.IGNORECASE,
            ).strip(" :-•*")

            if len(resto_misma_linea) >= 2:
                pares_encontrados.append((enunciado_limpio, resto_misma_linea))
                i += 1
                continue

            # Buscar la respuesta en la siguiente línea no vacía
            if i + 1 < len(lineas):
                sig = lineas[i + 1].strip()
                sig_limpia = re.sub(
                    r"^(respuesta\s*correcta|respuesta|rpta|r|soluci[oó]n|correcta)\s*[:\-]\s*",
                    "",
                    sig,
                    flags=re.IGNORECASE,
                ).strip(" :-•*")
                if sig_limpia and "?" not in sig_limpia:
                    pares_encontrados.append((enunciado_limpio, sig_limpia))
                    i += 2
                    continue

        i += 1

    # Si el PDF tenía menos de 10 preguntas explícitas con '?', completamos con oraciones del PDF
    if len(pares_encontrados) < max_preguntas:
        oraciones = [
            s.strip()
            for s in re.split(r"[\.\n;]+", texto_pdf)
            if len(s.strip()) > 18 and "?" not in s
        ]
        for oracion in oraciones:
            if len(pares_encontrados) >= max_preguntas:
                break
            palabras = oracion.split()
            if len(palabras) >= 5:
                respuesta_clave = " ".join(palabras[-3:])
                pregunta_gen = f"Según el documento del evento, ¿cómo se completa: \"{' '.join(palabras[:-3])}...\"?"
                pares_encontrados.append((pregunta_gen, respuesta_clave))

    pool_respuestas = [resp for _, resp in pares_encontrados]
    preguntas_finales = []

    for enunciado, resp_correcta in pares_encontrados[:max_preguntas]:
        distractores = generar_3_distractores_cercanos(resp_correcta, pool_respuestas)
        preguntas_finales.append(
            armar_pregunta_4_opciones(enunciado, resp_correcta, distractores)
        )

    return preguntas_finales


# ------------------------------------------------------------------------------
# 8. PRE-FILTRO DE IA 100% GRATUITO Y MARCA DE AGUA TRANSPARENTE (PILLOW)
# ------------------------------------------------------------------------------
def analizar_seguridad_imagen_ia(imagen_rgb: Image.Image) -> dict:
    miniatura = None
    raw_ycbcr = None
    try:
        miniatura = imagen_rgb.resize((160, 160), Image.Resampling.BILINEAR).convert("YCbCr")
        raw_ycbcr = miniatura.tobytes()
        total_pixeles = 160 * 160

        conteo_piel_total = 0
        conteo_piel_centro = 0
        total_centro = 0

        for idx in range(total_pixeles):
            offset = idx * 3
            y_val = raw_ycbcr[offset]
            cb = raw_ycbcr[offset + 1]
            cr = raw_ycbcr[offset + 2]

            fila = idx // 160
            col = idx % 160
            en_centro = (40 <= fila <= 120) and (40 <= col <= 120)
            if en_centro:
                total_centro += 1

            if 60 < y_val < 245 and 77 <= cb <= 127 and 133 <= cr <= 173:
                conteo_piel_total += 1
                if en_centro:
                    conteo_piel_centro += 1

        ratio_global = conteo_piel_total / max(1, total_pixeles)
        ratio_centro = conteo_piel_centro / max(1, total_centro)
        indice_riesgo = (ratio_centro * 0.6) + (ratio_global * 0.4)

        if indice_riesgo <= 0.22:
            puntaje = int(round(99 - (indice_riesgo * 40)))
        elif indice_riesgo <= 0.42:
            puntaje = int(round(90 - ((indice_riesgo - 0.22) * 90)))
        else:
            puntaje = max(12, int(round(70 - ((indice_riesgo - 0.42) * 140))))

        puntaje = max(5, min(99, puntaje))
        return {
            "puntaje_ia_seguridad": puntaje,
            "filtro_ia_aprobado": puntaje >= 70,
        }
    finally:
        if miniatura is not None:
            try:
                miniatura.close()
            except Exception:
                pass
        del raw_ycbcr


def procesar_ia_background(
    multimedia_id: str,
    evento_id: str,
    contenido_bytes: bytes,
    puntaje_ia_cliente: int,
    auto_aprobar_activo: bool,
):
    """
    Tarea en segundo plano (FastAPI BackgroundTasks):
    Ejecuta el filtrado IA local sobre una miniatura de 160x160 sin descomprimir bitmaps gigantes,
    cierra los descriptores y ejecuta liberar_memoria_os() (gc.collect + malloc_trim) al terminar.
    """
    bio = None
    img = None
    img_rgb = None
    try:
        bio = io.BytesIO(contenido_bytes)
        img = Image.open(bio)
        try:
            img.draft("RGB", (160, 160))
        except Exception:
            pass
        img_small = img.resize((160, 160), Image.Resampling.BILINEAR)
        img_rgb = img_small.convert("RGB")
        if img_small is not img_rgb:
            try:
                img_small.close()
            except Exception:
                pass
        resultado_ia = analizar_seguridad_imagen_ia(img_rgb)
        puntaje_ia = resultado_ia.get("puntaje_ia_seguridad", 95)
        puntaje_final = min(max(0, min(100, int(puntaje_ia_cliente))), puntaje_ia)
        aprobado_final = puntaje_final >= 70

        nuevo_estado = "aprobado" if (auto_aprobar_activo and aprobado_final) else "pendiente"
        ejecutar_consulta_segura(
            lambda db: db.table("multimedia")
            .update({
                "filtro_ia_aprobado": aprobado_final,
                "estado_moderacion": nuevo_estado,
            })
            .eq("id", multimedia_id)
            .execute()
        )
        invalidar_cache_evento(evento_id)
    except Exception as err:
        print(f"Aviso en background IA de foto {multimedia_id}: {err}")
    finally:
        if img is not None:
            try:
                img.close()
            except Exception:
                pass
        if img_rgb is not None:
            try:
                img_rgb.close()
            except Exception:
                pass
        if bio is not None:
            try:
                bio.close()
            except Exception:
                pass
        del contenido_bytes
        liberar_memoria_os()


def extraer_puntaje_ia_de_url(url_original: str | None, filtro_aprobado: bool) -> int:
    if url_original and "#ia=" in url_original:
        try:
            parte = url_original.split("#ia=")[-1].split("&")[0]
            return max(0, min(100, int(parte)))
        except ValueError:
            pass
    return 95 if filtro_aprobado else 45


def extraer_ruta_storage_de_url(url_multimedia: str | None, evento_id: str = "") -> str | None:
    """
    Obtiene la ruta exacta dentro del Bucket de Supabase Storage en la carpeta multimedia/
    """
    if not url_multimedia:
        return None
    url_sin_hash = url_multimedia.split("#")[0].split("?")[0].strip()

    marcador_bucket = f"/{SUPABASE_BUCKET}/"
    if marcador_bucket in url_sin_hash:
        return url_sin_hash.split(marcador_bucket, 1)[1].lstrip("/")

    if "/static/uploads/multimedia/" in url_sin_hash:
        return "multimedia/" + url_sin_hash.split("/static/uploads/multimedia/", 1)[1].lstrip("/")
    if "/static/uploads/originales/" in url_sin_hash:
        return "multimedia/" + url_sin_hash.split("/static/uploads/originales/", 1)[1].lstrip("/")
    if "/static/uploads/" in url_sin_hash:
        return "multimedia/" + url_sin_hash.split("/static/uploads/", 1)[1].lstrip("/")

    nombre_archivo = url_sin_hash.split("/")[-1]
    if nombre_archivo:
        if nombre_archivo.endswith("_con_marco.jpg") or nombre_archivo.endswith("_original.jpg"):
            # Compatibilidad
            return f"multimedia/{nombre_archivo}"
        return f"multimedia/{nombre_archivo}"
    return None


def normalizar_url_multimedia_publica(url_raw: str | None) -> str:
    """
    Garantiza que toda foto aprobada tenga una URL pública válida y accesible para el proyector y el muro:
    1. Si ya es una URL absoluta (https://... de Supabase Storage), la retorna limpia.
    2. Si es una ruta relativa (/static/uploads/...) y el archivo existe localmente en el contenedor, la conserva.
    3. Si es una ruta relativa pero el archivo local no existe en el contenedor, construye automáticamente
       la URL pública oficial del Bucket de Supabase Storage para evitar íconos de imagen rota.
    """
    if not url_raw:
        return ""
    url_limpia = str(url_raw).split("#")[0].strip()
    if not url_limpia:
        return ""

    if url_limpia.startswith("http://") or url_limpia.startswith("https://"):
        return url_limpia

    nombre_archivo = url_limpia.split("?")[0].split("/")[-1].strip()
    if nombre_archivo:
        for posible_local in (
            LOCAL_UPLOADS_DIR / "multimedia" / nombre_archivo,
            LOCAL_UPLOADS_DIR / "originales" / nombre_archivo,
            LOCAL_UPLOADS_DIR / nombre_archivo,
        ):
            if posible_local.exists():
                return url_limpia

        if SUPABASE_URL:
            base_sb = SUPABASE_URL.rstrip("/")
            return f"{base_sb}/storage/v1/object/public/{SUPABASE_BUCKET}/multimedia/{nombre_archivo}"

    return url_limpia



# ------------------------------------------------------------------------------
# 9. ENDPOINTS PÚBLICOS DEL INVITADO (REGISTRO, FOTOS Y TRIVIA KAHOOT)
# ------------------------------------------------------------------------------
@app.get("/api/eventos/{codigo_acceso}")
def obtener_evento_por_codigo(
    codigo_acceso: str,
    local_id: str | None = None,
    sede: str | None = None,
):
    codigo_limpio = codigo_acceso.strip().upper()

    try:
        lid_filtro = local_id.strip() if local_id and local_id.strip() else None
        if not lid_filtro and sede and _CACHE_LOCALES:
            s_clean = sede.strip().lower()
            idx = 0 if "1" in s_clean else 1
            if idx < len(_CACHE_LOCALES):
                lid_filtro = _CACHE_LOCALES[idx]["id"]

        clave_cache = f"evento_codigo:{codigo_limpio}:{lid_filtro or ''}"
        cache_hit = obtener_cache_ram(clave_cache)
        if cache_hit:
            return cache_hit

        def _query_ev(db):
            q = (
                db.table("eventos")
                .select(
                    "*, locales(nombre, direccion, telefono_contacto)"
                )
                .eq("codigo_acceso", codigo_limpio)
                .eq("estado", "activo")
            )
            if lid_filtro:
                q = q.eq("local_id", lid_filtro)
            return q.order("created_at", desc=True).limit(1).execute()

        respuesta = ejecutar_consulta_segura(_query_ev)
        datos = respuesta.data
        if not datos:
            raise HTTPException(
                status_code=404,
                detail=f"No encontramos un evento activo con el código '{codigo_limpio}'. Verifica el QR de tu mesa.",
            )

        evento = datos[0]
        estado_ev = obtener_estado_evento(evento["id"])
        evento["fase_trivia"] = estado_ev.get("fase_trivia", "inactiva")
        tematica_val = (
            estado_ev.get("tematica_accesorios")
            or evento.get("tematica_accesorios")
            or "todos"
        )
        evento["tematica_accesorios"] = tematica_val
        estado_ev["tematica_accesorios"] = tematica_val
        resultado = {"ok": True, "evento": evento}
        guardar_cache_ram(clave_cache, resultado, evento_id=evento["id"])
        return resultado
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar el evento en Supabase: {str(error)}",
        )


@app.post("/api/invitados/registro")
def registrar_invitado(datos: RegistroInvitadoInput):
    try:
        busqueda_existente = ejecutar_consulta_segura(
            lambda db: db.table("invitados")
            .select("id, evento_id, nombre, avatar, puntaje_total")
            .eq("evento_id", datos.evento_id)
            .ilike("nombre", datos.nombre_invitado)
            .execute()
        )

        if busqueda_existente.data:
            raise HTTPException(
                status_code=409,
                detail=f"El nombre '{datos.nombre_invitado}' ya está registrado en el salón. Agrega tu inicial o apellido.",
            )

        nuevo_registro = {
            "evento_id": datos.evento_id,
            "nombre": datos.nombre_invitado,
            "avatar": datos.avatar_munequito,
            "puntaje_total": 0,
        }

        respuesta_insert = ejecutar_consulta_segura(
            lambda db: db.table("invitados").insert(nuevo_registro).execute()
        )
        if not respuesta_insert.data:
            raise HTTPException(status_code=500, detail="No se pudo registrar al invitado.")

        invalidar_cache_evento(datos.evento_id)
        invitado_creado = respuesta_insert.data[0]
        return {
            "ok": True,
            "mensaje": f"¡Bienvenido/a a la Gala de Segalú, {invitado_creado['nombre']}!",
            "invitado": invitado_creado,
            "token_sesion": generar_token_sesion_invitado(
                invitado_creado["id"], invitado_creado.get("evento_id") or datos.evento_id
            ),
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al registrar al invitado en Supabase: {str(error)}",
        )


@app.patch("/api/invitados/{invitado_id}/avatar")
def actualizar_avatar_invitado(invitado_id: str, datos: ActualizarAvatarInput):
    try:
        respuesta = ejecutar_consulta_segura(
            lambda db: db.table("invitados")
            .update({"avatar": datos.avatar_munequito})
            .eq("id", invitado_id.strip())
            .execute()
        )
        if not respuesta.data:
            raise HTTPException(status_code=404, detail="No se encontró tu sesión de invitado.")

        inv = respuesta.data[0]
        invalidar_cache_evento(inv.get("evento_id"))
        return {
            "ok": True,
            "mensaje": "¡Tu personaje y accesorio ya están listos para la pantalla gigante!",
            "invitado": inv,
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al actualizar el avatar en Supabase: {str(error)}",
        )


def _eliminar_invitado_por_completo(invitado_id: str):
    iid = invitado_id.strip()
    if not iid:
        return

    # 0. Obtener nombre y evento_id del invitado antes de borrarlo para limpiar su lead/cupón
    inv_nombre = None
    ev_id = None
    try:
        inv_res = ejecutar_consulta_segura(
            lambda db: db.table("invitados").select("nombre, evento_id").eq("id", iid).limit(1).execute()
        )
        if inv_res and inv_res.data:
            inv_nombre = inv_res.data[0].get("nombre")
            ev_id = inv_res.data[0].get("evento_id")
    except Exception as err_inv:
        print(f"Aviso al obtener datos previos del invitado: {err_inv}")

    # 1. Limpiar inmediatamente de cualquier Lobby de Trivia en memoria
    for val in _ESTADO_EVENTOS.values():
        if isinstance(val, dict):
            sala_ts = val.get("jugadores_sala_trivia_ts")
            if isinstance(sala_ts, dict):
                sala_ts.pop(iid, None)
            hb_ts = val.get("heartbeat_invitados_ts")
            if isinstance(hb_ts, dict):
                hb_ts.pop(iid, None)

    # 2. Eliminar respuestas de trivia asociadas para evitar bloqueos por clave foránea
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("respuestas_trivia").delete().eq("invitado_id", iid).execute()
        )
    except Exception:
        pass

    # 3. Eliminar cupón / lead en crm_leads si este invitado lo había reclamado
    if inv_nombre and ev_id:
        try:
            ejecutar_consulta_segura(
                lambda db: db.table("crm_leads")
                .delete()
                .eq("evento_id", ev_id)
                .ilike("nombre", inv_nombre.strip())
                .execute()
            )
        except Exception as err_crm:
            print(f"Aviso al eliminar crm_lead del invitado en Supabase: {err_crm}")

        # Limpiar también del respaldo local en memoria y disco
        if ev_id in _ESTADO_EVENTOS and isinstance(_ESTADO_EVENTOS[ev_id], dict):
            leads_loc = _ESTADO_EVENTOS[ev_id].get("crm_leads") or []
            _ESTADO_EVENTOS[ev_id]["crm_leads"] = [
                l for l in leads_loc if str(l.get("nombre") or "").strip().lower() != inv_nombre.strip().lower()
            ]
            _guardar_estado_eventos_disco()

    # 4. Desvincular fotos subidas por el invitado (multimedia.invitado_id = NULL) para CONSERVAR LAS FOTOS DEL EVENTO
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("multimedia")
            .update({"invitado_id": None})
            .eq("invitado_id", iid)
            .execute()
        )
    except Exception:
        pass

    # 5. Eliminar físicamente la sesión del invitado de la tabla invitados
    ejecutar_consulta_segura(
        lambda db: db.table("invitados").delete().eq("id", iid).execute()
    )
    if ev_id:
        invalidar_cache_evento(ev_id)
    else:
        invalidar_cache_evento()


@app.delete("/api/invitados/{invitado_id}")
def eliminar_invitado(invitado_id: str):
    """Borrado definitivo: solo cuando el invitado pulsa "Salir / Corregir mi nombre" o el Admin lo elimina."""
    try:
        _eliminar_invitado_por_completo(invitado_id)
        return {
            "ok": True,
            "mensaje": "Registro eliminado correctamente de la base de datos.",
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al eliminar el registro del invitado: {str(error)}",
        )


@app.post("/api/invitados/{invitado_id}/desconectar")
def desconectar_invitado_presencia(invitado_id: str):
    """
    Desconexión SUAVE (pagehide / recarga / bloqueo de pantalla del celular):
    retira al invitado del lobby de trivia y del pulso de presencia en memoria, pero
    CONSERVA su registro, avatar y puntaje en Supabase para que pueda reconectarse.
    """
    iid = invitado_id.strip()
    for eid, val in list(_ESTADO_EVENTOS.items()):
        if not isinstance(val, dict):
            continue
        sala_ts = val.get("jugadores_sala_trivia_ts")
        hb_ts = val.get("heartbeat_invitados_ts")
        removido = False
        if isinstance(sala_ts, dict) and sala_ts.pop(iid, None) is not None:
            removido = True
        if isinstance(hb_ts, dict) and hb_ts.pop(iid, None) is not None:
            removido = True
        if removido:
            invalidar_cache_evento(eid)
    return {"ok": True, "mensaje": "Presencia del invitado pausada. Su sesión sigue disponible."}


class ReconectarInvitadoInput(BaseModel):
    invitado_id: str = Field(..., min_length=1)
    evento_id: str = Field(..., min_length=1)
    token_sesion: str = Field(..., min_length=10)


@app.post("/api/invitados/reconectar")
def reconectar_invitado(datos: ReconectarInvitadoInput):
    """
    Restaura la sesión del invitado tras recargar la página (localStorage):
    valida el token firmado, confirma que el invitado y el evento siguen existiendo
    y devuelve sus datos actualizados (nombre, avatar, puntaje) para no expulsarlo al login.
    """
    iid = datos.invitado_id.strip()
    eid = datos.evento_id.strip()

    if not verificar_token_sesion_invitado(iid, eid, datos.token_sesion):
        raise HTTPException(status_code=401, detail="Sesión inválida. Vuelve a registrarte.")

    try:
        resp_inv = ejecutar_consulta_segura(
            lambda db: db.table("invitados")
            .select("id, evento_id, nombre, avatar, puntaje_total")
            .eq("id", iid)
            .limit(1)
            .execute()
        )
        if not resp_inv.data or str(resp_inv.data[0].get("evento_id")) != eid:
            raise HTTPException(
                status_code=404,
                detail="Tu registro ya no existe en este evento. Ingresa nuevamente tu nombre.",
            )

        resp_ev = ejecutar_consulta_segura(
            lambda db: db.table("eventos")
            .select(
                "id, local_id, nombre, codigo_acceso, fecha_evento, estado, trivia_activa, locales(nombre, direccion, telefono_contacto)"
            )
            .eq("id", eid)
            .limit(1)
            .execute()
        )
        if not resp_ev.data or resp_ev.data[0].get("estado") != "activo":
            raise HTTPException(status_code=404, detail="El evento ya no está activo.")

        evento = resp_ev.data[0]
        estado_ev = obtener_estado_evento(eid)
        evento["fase_trivia"] = estado_ev.get("fase_trivia", "inactiva")

        # Obtenemos su posición y puntaje actualizado en el ranking del evento
        _, puntaje_inv, posicion_ranking = obtener_ranking_evento(eid, iid)
        inv_data = dict(resp_inv.data[0])
        inv_data["puntaje_total"] = puntaje_inv
        inv_data["posicion_ranking"] = posicion_ranking

        # Reactivamos su pulso de presencia de inmediato
        estado_ev.setdefault("heartbeat_invitados_ts", {})[iid] = time.time()

        return {
            "ok": True,
            "mensaje": f"¡Bienvenido/a de nuevo, {inv_data['nombre']}!",
            "invitado": inv_data,
            "evento": evento,
            "posicion_ranking": posicion_ranking,
            "token_sesion": datos.token_sesion,
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo verificar tu sesión en este momento: {str(error)}",
        )


@app.delete("/api/eventos/{evento_id}/invitados")
def limpiar_invitados_de_evento(evento_id: str):
    eid = evento_id.strip()
    try:
        estado_ev = obtener_estado_evento(eid)
        estado_ev["jugadores_sala_trivia_ts"] = {}
        estado_ev["heartbeat_invitados_ts"] = {}

        ejecutar_consulta_segura(
            lambda db: db.table("invitados").delete().eq("evento_id", eid).execute()
        )
        invalidar_cache_evento(eid)
        return {
            "ok": True,
            "mensaje": "Se han eliminado todos los invitados activos del evento.",
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al limpiar los invitados del evento: {str(error)}",
        )


@app.post("/api/multimedia/subir")
def subir_foto_invitado(
    background_tasks: BackgroundTasks,
    evento_id: str = Form(...),
    invitado_id: str = Form(...),
    puntaje_ia_cliente: int = Form(default=95),
    archivo: UploadFile = File(...),
):
    """
    Subida directa y sin quemar marcos:
    1. Recibe la foto comprimida desde el móvil y la guarda DIRECTAMENTE una sola vez
       en Supabase Storage (carpeta multimedia/) sin quemar marcas ni usar Pillow.
    2. Ejecuta la validación de IA local en segundo plano (FastAPI BackgroundTasks)
       para responder de inmediato al celular del invitado en menos de 1 segundo ("¡Foto enviada!").
    """
    try:
        contenido_bytes = archivo.file.read()
    finally:
        try:
            archivo.file.close()
        except Exception:
            pass
    if not contenido_bytes:
        raise HTTPException(status_code=400, detail="El archivo de imagen está vacío.")

    if len(contenido_bytes) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="La imagen original supera los 15 MB permitidos.",
        )

    uid_hex = uuid.uuid4().hex[:12]
    nombre_archivo = f"{uid_hex}.jpg"
    ruta_storage = f"multimedia/{nombre_archivo}"

    url_publica = f"/static/uploads/multimedia/{nombre_archivo}"
    origen_almacenamiento = "local_fallback"
    ruta_temp_multimedia = LOCAL_UPLOADS_DIR / "multimedia" / nombre_archivo
    ruta_temp_originales = LOCAL_UPLOADS_DIR / "originales" / nombre_archivo

    try:
        try:
            db = verificar_conexion_supabase()
            db.storage.from_(SUPABASE_BUCKET).upload(
                path=ruta_storage,
                file=contenido_bytes,
                file_options={
                    "content-type": "image/jpeg",
                    "upsert": "true",
                    "cache-control": "86400",
                    "cacheControl": "86400",
                },
            )
            url_sb = db.storage.from_(SUPABASE_BUCKET).get_public_url(ruta_storage)
            if url_sb:
                url_publica = url_sb
            origen_almacenamiento = "supabase_storage"
        except Exception as storage_err:
            print(f"Aviso Supabase Storage ({SUPABASE_BUCKET}): {storage_err}")
            # Solo respaldar en disco local si Supabase Storage no estuvo disponible
            ruta_temp_multimedia.parent.mkdir(parents=True, exist_ok=True)
            ruta_temp_multimedia.write_bytes(contenido_bytes)

        estado_ev = obtener_estado_evento(evento_id.strip())
        auto_aprobar_activo = bool(estado_ev.get("auto_aprobar_fotos", False))
        puntaje_cliente_int = max(0, min(100, int(puntaje_ia_cliente)))
        aprobado_cliente = puntaje_cliente_int >= 70
        estado_inicial = "aprobado" if (auto_aprobar_activo and aprobado_cliente) else "pendiente"

        nueva_multimedia = {
            "evento_id": evento_id.strip(),
            "invitado_id": invitado_id.strip(),
            "url_original": url_publica,
            "url_con_marca": url_publica,
            "tipo": "foto",
            "filtro_ia_aprobado": aprobado_cliente,
            "estado_moderacion": estado_inicial,
        }

        respuesta_db = ejecutar_consulta_segura(
            lambda db: db.table("multimedia").insert(nueva_multimedia).execute()
        )
        if not respuesta_db.data:
            raise HTTPException(
                status_code=500,
                detail="No se pudo registrar la foto en la tabla multimedia.",
            )

        fila_creada = respuesta_db.data[0]
        invalidar_cache_evento(evento_id)

        # Encolar la validación IA local en segundo plano (BackgroundTasks)
        background_tasks.add_task(
            procesar_ia_background,
            fila_creada["id"],
            evento_id.strip(),
            contenido_bytes,
            puntaje_cliente_int,
            auto_aprobar_activo,
        )

        peso_kb = round(len(contenido_bytes) / 1024, 1)
        mensaje_exito = (
            "¡Foto enviada! Aprobada automáticamente para la pantalla gigante."
            if estado_inicial == "aprobado"
            else "¡Foto enviada! Está en espera de aprobación del Administrador."
        )

        return {
            "ok": True,
            "mensaje": mensaje_exito,
            "auto_aprobada": estado_inicial == "aprobado",
            "multimedia": fila_creada,
            "analisis_ia": {
                "puntaje_ia_seguridad": puntaje_cliente_int,
                "filtro_ia_aprobado": aprobado_cliente,
                "peso_kb": peso_kb,
                "almacenamiento": origen_almacenamiento,
            },
        }
    except HTTPException:
        raise
    except Exception as db_err:
        raise HTTPException(
            status_code=500,
            detail=f"Error al guardar la foto en la tabla multimedia de Supabase: {str(db_err)}",
        )
    finally:
        # Cero copias locales en contenedor cuando Supabase está activo
        if origen_almacenamiento == "supabase_storage":
            for ruta_tmp in (ruta_temp_multimedia, ruta_temp_originales):
                if ruta_tmp.exists():
                    try:
                        os.remove(ruta_tmp)
                    except Exception:
                        pass
        liberar_memoria_os()


@app.get("/api/eventos/{evento_id}/fotos")
def listar_fotos_aprobadas_evento(evento_id: str):
    """
    Retorna la lista de fotos aprobadas del evento para el muro en vivo y la galería del invitado,
    con soporte para código de acceso o UUID y caché RAM de 2.0s.
    """
    eid = evento_id.strip()
    clave_cache = f"fotos_aprobadas:{eid}"
    hit = obtener_cache_ram(clave_cache)
    if hit:
        return hit

    eid_real = eid
    if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", eid, re.I):
        try:
            ev_res = ejecutar_consulta_segura(
                lambda db: db.table("eventos").select("id").eq("codigo_acceso", eid.upper()).limit(1).execute()
            )
            if ev_res.data:
                eid_real = ev_res.data[0]["id"]
        except Exception:
            pass

    try:
        def _q(db):
            return (
                db.table("multimedia")
                .select("id, evento_id, invitado_id, url_con_marca, url_original, created_at, invitados(id, nombre, avatar)")
                .eq("evento_id", eid_real)
                .eq("estado_moderacion", "aprobado")
                .order("created_at", desc=True)
                .limit(60)
                .execute()
            )
        res = ejecutar_consulta_segura(_q)
        registros = res.data or []
    except Exception as err:
        print(f"Aviso al listar fotos aprobadas del evento: {err}")
        registros = []

    likes_map = _ESTADO_EVENTOS.get("__likes_fotos__", {}) if isinstance(_ESTADO_EVENTOS.get("__likes_fotos__"), dict) else {}
    fotos_formateadas = []
    for f in registros:
        inv = f.get("invitados") or {}
        nombre_autor = inv.get("nombre") if isinstance(inv, dict) else "Invitado"
        mid = f["id"]
        likes_count = int(likes_map.get(mid, 0))
        url_resuelta = normalizar_url_multimedia_publica(
            f.get("url_con_marca") or f.get("url_original")
        )
        if not url_resuelta:
            continue
        fotos_formateadas.append({
            "id": mid,
            "url": url_resuelta,
            "autor": nombre_autor or "Invitado",
            "autor_avatar": inv.get("avatar") if isinstance(inv, dict) else None,
            "created_at": f.get("created_at"),
            "likes": likes_count,
        })

    resultado = {"ok": True, "fotos": fotos_formateadas, "total": len(fotos_formateadas)}
    guardar_cache_ram(clave_cache, resultado, evento_id=eid_real)
    return resultado


@app.post("/api/multimedia/{multimedia_id}/like")
def dar_like_foto(multimedia_id: str, datos: LikeFotoInput | None = None):
    """
    Suma (+1) o resta (-1) likes a una foto interactiva con persistencia en el servidor.
    """
    mid = multimedia_id.strip()
    delta = 1
    if datos and hasattr(datos, "delta"):
        delta = 1 if datos.delta >= 0 else -1

    if not isinstance(_ESTADO_EVENTOS.get("__likes_fotos__"), dict):
        _ESTADO_EVENTOS["__likes_fotos__"] = {}

    actual = int(_ESTADO_EVENTOS["__likes_fotos__"].get(mid, 0))
    nuevo = max(0, actual + delta)
    _ESTADO_EVENTOS["__likes_fotos__"][mid] = nuevo
    _guardar_estado_eventos_disco()

    # Intentar actualizar en Supabase si la columna existiera
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("multimedia").update({"likes": nuevo}).eq("id", mid).execute()
        )
    except Exception:
        pass

    invalidar_cache_evento()

    return {"ok": True, "multimedia_id": mid, "likes": nuevo}


# ------------------------------------------------------------------------------
# 10. MOTOR DE TRIVIA KAHOOT SIN ERRORES FALSOS Y CON RANKING EN VIVO (FASE 4.5)
# ------------------------------------------------------------------------------
def obtener_ranking_evento(evento_id: str, invitado_id: str | None = None) -> tuple[list[dict], int, int]:
    """
    Devuelve: (lista_ordenada_invitados, puntaje_invitado, posicion_ranking_1_based)
    """
    eid = evento_id.strip()
    puntaje_invitado = 0
    posicion_ranking = 1
    lista_inv = []

    try:
        inv_res = ejecutar_consulta_segura(
            lambda db: db.table("invitados")
            .select("id, nombre, avatar, puntaje_total, created_at")
            .eq("evento_id", eid)
            .order("puntaje_total", desc=True)
            .order("created_at")
            .execute()
        )
        lista_inv = inv_res.data or []
        if invitado_id:
            iid = invitado_id.strip()
            for idx, inv in enumerate(lista_inv):
                if inv["id"] == iid:
                    puntaje_invitado = int(inv.get("puntaje_total") or 0)
                    posicion_ranking = idx + 1
                    break
    except Exception:
        pass

    return lista_inv, puntaje_invitado, posicion_ranking


@app.get("/api/eventos/{evento_id}/trivia/estado")
def obtener_estado_trivia_invitado(
    evento_id: str,
    invitado_id: str | None = None,
    en_sala_trivia: bool = False,
):
    """
    DIDÁCTICA (Fase 4.5 - Flujo Kahoot Sin Errores Falsos + Conteo Exclusivo en Sala de Trivia):
    1. Registra en 'jugadores_sala_trivia_ts' ÚNICAMENTE a los invitados que tocaron
       explícitamente el botón "Jugar Ronda de Preguntas" (en_sala_trivia=True).
       Si están en el lobby general viendo fotos (en_sala_trivia=False), los retira
       de la lista de "Invitados en la Pista" del proyector.
    2. Mientras 'segundos_restantes > 0' y el Admin no haya revelado la respuesta,
       'ronda_cerrada' es FALSE.
    """
    eid = evento_id.strip()
    estado_ev = obtener_estado_evento(eid)
    fase = estado_ev.get("fase_trivia", "inactiva")
    pregunta_activa_id = estado_ev.get("pregunta_activa_id")

    ahora_ts = time.time()
    jugadores_sala = estado_ev.setdefault("jugadores_sala_trivia_ts", {})
    heartbeats = estado_ev.setdefault("heartbeat_invitados_ts", {})

    # Optimización de RAM: Limpiar conexiones inactivas mayores a 60s
    corte_inactivo = ahora_ts - 60.0
    for k in [k for k, ts in list(heartbeats.items()) if ts < corte_inactivo]:
        heartbeats.pop(k, None)
    for k in [k for k, ts in list(jugadores_sala.items()) if ts < corte_inactivo]:
        jugadores_sala.pop(k, None)

    if invitado_id and invitado_id.strip():
        iid_clean = invitado_id.strip()
        heartbeats[iid_clean] = ahora_ts
        if en_sala_trivia:
            estaba_en_sala = iid_clean in jugadores_sala
            jugadores_sala[iid_clean] = ahora_ts
            if not estaba_en_sala:
                invalidar_cache_evento(eid)
        else:
            if iid_clean in jugadores_sala:
                jugadores_sala.pop(iid_clean, None)
                invalidar_cache_evento(eid)

    clave_cache = f"trivia_estado:{eid}:{invitado_id or ''}:{1 if en_sala_trivia else 0}"
    cache_hit = obtener_cache_ram(clave_cache)
    if cache_hit:
        return cache_hit

    lista_inv, puntaje_invitado, posicion_ranking = obtener_ranking_evento(eid, invitado_id)
    podio_top = lista_inv[:10]

    preguntas = listar_preguntas_evento(eid)
    pregunta_actual = None

    if pregunta_activa_id:
        pregunta_actual = next((p for p in preguntas if p["id"] == pregunta_activa_id), None)

    if not pregunta_actual:
        pregunta_actual = next((p for p in preguntas if p.get("activa")), None)
        if pregunta_actual:
            pregunta_activa_id = pregunta_actual["id"]

    datos_pregunta_publica = None
    mi_respuesta = None
    ronda_cerrada = False

    if pregunta_actual and fase in ("pregunta_activa", "respuesta_revelada"):
        limite_seg = int(pregunta_actual.get("tiempo_limite_segundos") or 20)
        ts_inicio = float(estado_ev.get("timestamp_lanzamiento") or 0.0)
        BUFFER_GRACIA_SEGUNDOS = 3.0
        if ts_inicio > 0:
            transcurrido = max(0.0, time.time() - ts_inicio)
            segundos_restantes = max(0, int(round(limite_seg - transcurrido)))
        else:
            transcurrido = 0.0
            segundos_restantes = limite_seg

        # Margen de gracia (+3 segundos) para compensar latencia móvil y no cortar antes de tiempo
        if (
            fase == "respuesta_revelada"
            or bool(pregunta_actual.get("revelar_respuesta"))
            or (ts_inicio > 0 and transcurrido >= (limite_seg + BUFFER_GRACIA_SEGUNDOS))
        ):
            ronda_cerrada = True
            segundos_restantes = 0

        if invitado_id:
            iid = invitado_id.strip()
            respuestas_preg = listar_respuestas_pregunta(eid, pregunta_actual["id"])
            for r in respuestas_preg:
                if r.get("invitado_id") == iid:
                    # Solo exponemos si acertó/falló cuando la ronda ha cerrado ('ronda_cerrada == True')
                    mi_respuesta = {
                        "respondio": True,
                        "opcion_elegida": r.get("opcion_elegida"),
                        "tiempo_respuesta_ms": int(r.get("tiempo_respuesta_ms") or 0),
                        "es_correcta": bool(r.get("es_correcta")) if ronda_cerrada else None,
                        "puntos_obtenidos": int(r.get("puntos_obtenidos") or 0) if ronda_cerrada else None,
                    }
                    break

        datos_pregunta_publica = {
            "id": pregunta_actual["id"],
            "orden": pregunta_actual.get("orden", 1),
            "enunciado": pregunta_actual["enunciado"],
            "opcion_a": pregunta_actual["opcion_a"],
            "opcion_b": pregunta_actual["opcion_b"],
            "opcion_c": pregunta_actual["opcion_c"],
            "opcion_d": pregunta_actual["opcion_d"],
            "tiempo_limite_segundos": limite_seg,
            "segundos_restantes": segundos_restantes,
            "ronda_cerrada": ronda_cerrada,
            "revelar_respuesta": ronda_cerrada,
            "respuesta_correcta": pregunta_actual["respuesta_correcta"] if ronda_cerrada else None,
        }

    resultado = {
        "ok": True,
        "fase": fase,
        "trivia_activa": fase != "inactiva",
        "ronda_cerrada": ronda_cerrada,
        "total_preguntas": len(preguntas),
        "puntaje_invitado": puntaje_invitado,
        "posicion_ranking": posicion_ranking,
        "total_jugadores": max(1, len(lista_inv)),
        "pregunta_activa": datos_pregunta_publica,
        "mi_respuesta": mi_respuesta,
        "podio": podio_top,
        "tematica_accesorios": estado_ev.get("tematica_accesorios", "todos"),
    }
    guardar_cache_ram(clave_cache, resultado, evento_id=eid)
    return resultado


@app.post("/api/trivia/responder")
def responder_pregunta_trivia(datos: ResponderTriviaInput):
    """
    DIDÁCTICA (Fase 4.5 - Registro Único de Respuesta):
    Guarda la opción elegida por el invitado, calcula su puntaje por velocidad
    (500 a 1000 pts si acertó; 0 si falló) en el servidor y actualiza su
    'puntaje_total' en Supabase. Además devuelve su 'posicion_ranking' exacta.
    """
    eid = datos.evento_id.strip()
    pid = datos.pregunta_id.strip()
    iid = datos.invitado_id.strip()
    opcion = datos.opcion_elegida.strip().upper()

    preguntas = listar_preguntas_evento(eid)
    pregunta = next((p for p in preguntas if p["id"] == pid), None)
    if not pregunta:
        raise HTTPException(status_code=404, detail="No se encontró la pregunta activa.")

    # 1. Bloquear doble respuesta a la misma pregunta
    respuestas_existentes = listar_respuestas_pregunta(eid, pid)
    for r in respuestas_existentes:
        if r.get("invitado_id") == iid:
            _, puntaje_actual, pos_actual = obtener_ranking_evento(eid, iid)
            return {
                "ok": True,
                "ya_respondida": True,
                "respuesta_registrada": True,
                "es_correcta": bool(r.get("es_correcta")),
                "puntos_obtenidos": int(r.get("puntos_obtenidos") or 0),
                "puntaje_total": puntaje_actual,
                "posicion_ranking": pos_actual,
                "opcion_elegida": r.get("opcion_elegida"),
                "respuesta_correcta": pregunta["respuesta_correcta"],
                "tiempo_respuesta_ms": int(r.get("tiempo_respuesta_ms") or 0),
            }

    # 2. Validar si acertó y calcular puntaje por velocidad (500 a 1000 pts)
    respuesta_correcta = str(pregunta["respuesta_correcta"]).strip().upper()
    es_correcta = opcion in ("A", "B", "C", "D") and (opcion == respuesta_correcta)

    limite_segundos = int(pregunta.get("tiempo_limite_segundos") or 20)
    limite_ms = max(1000, limite_segundos * 1000)
    tiempo_ms = max(0, min(limite_ms, int(datos.tiempo_respuesta_ms)))

    if es_correcta:
        factor_rapidez = 1.0 - (tiempo_ms / limite_ms)
        bono_velocidad = int(round(500 * factor_rapidez))
        puntos_obtenidos = max(500, min(1000, 500 + bono_velocidad))
    else:
        puntos_obtenidos = 0

    opcion_db = opcion if opcion in ("A", "B", "C", "D") else "A"

    registro_respuesta = {
        "pregunta_id": pid,
        "invitado_id": iid,
        "opcion_elegida": opcion_db,
        "tiempo_respuesta_ms": tiempo_ms,
        "es_correcta": es_correcta,
        "puntos_obtenidos": puntos_obtenidos,
    }

    # 3. Guardar en tabla respuestas_trivia (y en respaldo sincronizado)
    estado_ev = obtener_estado_evento(eid)
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("respuestas_trivia").insert(registro_respuesta).execute()
        )
    except Exception as err:
        print(f"Aviso al insertar en respuestas_trivia (guardado en respaldo): {err}")

    estado_ev["respuestas_fallback"].append(
        {
            "id": str(uuid.uuid4()),
            **registro_respuesta,
            "opcion_elegida": opcion,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    if len(estado_ev["respuestas_fallback"]) > 30:
        estado_ev["respuestas_fallback"] = estado_ev["respuestas_fallback"][-30:]
    _guardar_estado_eventos_disco()

    # 4. Actualizar puntaje_total acumulado del invitado en Supabase
    try:
        inv_res = ejecutar_consulta_segura(
            lambda db: db.table("invitados")
            .select("id, puntaje_total")
            .eq("id", iid)
            .execute()
        )
        if inv_res.data:
            puntaje_previo = int(inv_res.data[0].get("puntaje_total") or 0)
            nuevo_puntaje_total = puntaje_previo + puntos_obtenidos
            if puntos_obtenidos > 0:
                ejecutar_consulta_segura(
                    lambda db: db.table("invitados")
                    .update({"puntaje_total": nuevo_puntaje_total})
                    .eq("id", iid)
                    .execute()
                )
    except Exception as err:
        print(f"Aviso al actualizar puntaje_total del invitado: {err}")

    invalidar_cache_evento(eid)
    _, puntaje_final_invitado, posicion_ranking = obtener_ranking_evento(eid, iid)

    return {
        "ok": True,
        "ya_respondida": False,
        "respuesta_registrada": True,
        "es_correcta": es_correcta,
        "puntos_obtenidos": puntos_obtenidos,
        "puntaje_total": puntaje_final_invitado,
        "posicion_ranking": posicion_ranking,
        "opcion_elegida": opcion,
        "respuesta_correcta": respuesta_correcta,
        "tiempo_respuesta_ms": tiempo_ms,
    }


# ------------------------------------------------------------------------------
# 11. DASHBOARD CONSOLIDADO PARALELO (<200ms) Y ENDPOINTS DEL ADMINISTRADOR
# ------------------------------------------------------------------------------
def construir_dashboard_evento_rapido(evento_id: str, usar_cache: bool = True) -> dict:
    """
    DIDÁCTICA (Fase 4.5 - Requerimiento B: Velocidad Instantánea <200ms y Cero Fugas de RAM):
    1. Purga automáticamente llaves vencidas y responde desde caché RAM si está vigente (<= 2.0s).
    2. Reutiliza el único cliente persistente de Supabase (keep-alive socket) sin crear instancias
       adicionales de create_client() ni hilos de ThreadPoolExecutor que fragmenten arenas de glibc.
    """
    eid = evento_id.strip()
    purgar_cache_ram_expirada()
    ahora = time.time()

    if usar_cache and eid in _CACHE_DASHBOARD_POR_EVENTO:
        entrada = _CACHE_DASHBOARD_POR_EVENTO[eid]
        if (ahora - entrada["ts"]) <= _CACHE_TTL_SEGUNDOS:
            return entrada["datos"]
        _CACHE_DASHBOARD_POR_EVENTO.pop(eid, None)

    estado_ev = obtener_estado_evento(eid)
    auto_aprobar_fotos = bool(estado_ev.get("auto_aprobar_fotos", False))

    multimedia_lista = []
    try:
        res_multi = ejecutar_consulta_segura(
            lambda db: db.table("multimedia")
            .select("*, invitados(id, nombre, avatar)")
            .eq("evento_id", eid)
            .order("created_at", desc=True)
            .execute()
        )
        for item in res_multi.data or []:
            item["puntaje_ia_seguridad"] = extraer_puntaje_ia_de_url(
                item.get("url_original"), item.get("filtro_ia_aprobado", True)
            )
            url_norm = normalizar_url_multimedia_publica(
                item.get("url_con_marca") or item.get("url_original")
            )
            if url_norm:
                item["url_con_marca"] = url_norm
                item["url_original"] = normalizar_url_multimedia_publica(item.get("url_original")) or url_norm
            multimedia_lista.append(item)
    except Exception as err_m:
        print(f"Aviso en consulta multimedia dashboard: {err_m}")

    invitados_lista = []
    try:
        res_inv = ejecutar_consulta_segura(
            lambda db: db.table("invitados")
            .select("*")
            .eq("evento_id", eid)
            .order("puntaje_total", desc=True)
            .order("created_at", desc=True)
            .execute()
        )
        invitados_lista = res_inv.data or []
    except Exception as err_i:
        print(f"Aviso en consulta invitados dashboard: {err_i}")

    preguntas_raw = listar_preguntas_evento(eid)

    # Contamos respuestas en 1 sola consulta por lote (0 consultas N+1)
    ids_preguntas = [p["id"] for p in preguntas_raw if p.get("id")]
    todas_respuestas = listar_respuestas_evento_lote(eid, ids_preguntas)
    conteo_por_pregunta: dict[str, int] = {}
    for r in todas_respuestas:
        pid = r.get("pregunta_id")
        if pid:
            conteo_por_pregunta[pid] = conteo_por_pregunta.get(pid, 0) + 1

    pregunta_activa_id = estado_ev.get("pregunta_activa_id")
    preguntas_lista = []
    for idx, p in enumerate(preguntas_raw):
        pid = p["id"]
        preguntas_lista.append(
            {
                **p,
                "orden": p.get("orden") or (idx + 1),
                "total_respuestas": conteo_por_pregunta.get(pid, 0),
            }
        )

    estado_trivia_info = {
        "fase": estado_ev.get("fase_trivia", "inactiva"),
        "pregunta_activa_id": pregunta_activa_id,
        "total_respuestas_activa": conteo_por_pregunta.get(pregunta_activa_id, 0)
        if pregunta_activa_id
        else 0,
    }

    datos_consolidados = {
        "evento_seleccionado_id": eid,
        "auto_aprobar_fotos": auto_aprobar_fotos,
        "config_galeria": {
            "modo_galeria": estado_ev.get("modo_galeria", "ciclo_auto"),
            "duracion_foto_segundos": int(estado_ev.get("duracion_foto_segundos", 8)),
        },
        "estado_trivia": estado_trivia_info,
        "preguntas": preguntas_lista,
        "multimedia": multimedia_lista,
        "invitados": invitados_lista,
    }

    _CACHE_DASHBOARD_POR_EVENTO[eid] = {
        "ts": ahora,
        "datos": datos_consolidados,
    }
    return datos_consolidados


@app.post("/api/admin/login")
def login_administrador(datos: LoginAdminInput):
    info_rol = verificar_admin_password(datos.password)
    return {
        "ok": True,
        "mensaje": f"Sesión de Administrador verificada correctamente ({info_rol['rol']}).",
        "rol": info_rol["rol"],
        "sede_permitida": info_rol["sede_clave"],
        "sede_nombre": info_rol["sede_nombre"],
        "es_superadmin": info_rol["es_superadmin"],
    }


def fijar_evento_proyector(evento_id: str | None, local_id: str | None = None):
    if not evento_id:
        return
    eid = evento_id.strip()
    if eid:
        _ESTADO_EVENTOS["__proyector_evento_id__"] = eid
        if local_id:
            lid = local_id.strip()
            if "__proyector_por_sede__" not in _ESTADO_EVENTOS or not isinstance(
                _ESTADO_EVENTOS["__proyector_por_sede__"], dict
            ):
                _ESTADO_EVENTOS["__proyector_por_sede__"] = {}
            _ESTADO_EVENTOS["__proyector_por_sede__"][lid] = eid
        _guardar_estado_eventos_disco()


@app.get("/api/admin/eventos/{evento_id}/dashboard-completo")
def obtener_dashboard_completo_evento(
    evento_id: str,
    local_id: str | None = None,
    force_refresh: bool = False,
    x_admin_password: str | None = Header(default=None),
):
    """
    DIDÁCTICA (Fase 4.5 - Requerimiento B):
    Endpoint consolidado ultrarrápido (<200ms) que devuelve fotos, preguntas,
    estado de trivia e invitados al cambiar de evento en el selector del Admin.
    Además sincroniza automáticamente el evento proyectado en /proyector (OBS Studio).
    Si force_refresh=True, purga la caché en RAM y consulta datos frescos de Supabase.
    """
    verificar_admin_password(x_admin_password)
    t0 = time.perf_counter()
    if force_refresh:
        invalidar_cache_evento(evento_id)
        _CACHE_DASHBOARD_POR_EVENTO.pop(evento_id.strip(), None)

    try:
        fijar_evento_proyector(evento_id, local_id)
        datos = construir_dashboard_evento_rapido(evento_id, usar_cache=not force_refresh)
        ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "ok": True,
            "tiempo_carga_ms": ms,
            **datos,
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al cargar el dashboard del evento: {str(error)}",
        )


@app.get("/api/admin/resumen")
def obtener_resumen_admin(
    evento_id: str | None = None,
    force_refresh: bool = False,
    x_admin_password: str | None = Header(default=None),
):
    global _CACHE_LOCALES
    info_rol = verificar_admin_password(x_admin_password)
    t0 = time.perf_counter()

    if force_refresh:
        invalidar_cache_evento(None)
        _CACHE_LOCALES = []
        _CACHE_DASHBOARD_POR_EVENTO.clear()

    try:
        if not _CACHE_LOCALES:
            locales_res = ejecutar_consulta_segura(
                lambda db: db.table("locales").select("*").order("nombre").execute()
            )
            _CACHE_LOCALES = locales_res.data or []

        eventos_res = ejecutar_consulta_segura(
            lambda db: db.table("eventos")
            .select("*, locales(nombre, direccion)")
            .order("created_at", desc=True)
            .execute()
        )
        eventos = eventos_res.data or []

        # Verificación periódica de autolimpieza de 30 días (máximo cada 6 horas)
        try:
            verificar_y_ejecutar_autolimpieza_30_dias(eventos)
        except Exception as err_auto:
            print(f"Aviso al verificar autolimpieza 30d en resumen admin: {err_auto}")

        for ev in eventos:
            st_ev = obtener_estado_evento(ev["id"])
            ev["tematica_accesorios"] = ev.get("tematica_accesorios") or st_ev.get("tematica_accesorios") or "todos"
            ev["estado_autolimpieza"] = calcular_estado_30d_evento(ev)

        # Filtrado por Sede según el rol del operador autenticado
        locales_visibles = list(_CACHE_LOCALES or [])
        if info_rol["rol"] == "sede1":
            locales_visibles = [
                l for l in locales_visibles
                if "colocho" in (l.get("nombre") or "").lower() or "sede 1" in (l.get("nombre") or "").lower()
            ]
            ids_permitidos = {str(l.get("id")) for l in locales_visibles}
            eventos = [
                ev for ev in eventos
                if str(ev.get("local_id")) in ids_permitidos or "colocho" in ((ev.get("locales") or {}).get("nombre") or "").lower()
            ]
        elif info_rol["rol"] == "sede2":
            locales_visibles = [
                l for l in locales_visibles
                if "crystal" in (l.get("nombre") or "").lower() or "sede 2" in (l.get("nombre") or "").lower()
            ]
            ids_permitidos = {str(l.get("id")) for l in locales_visibles}
            eventos = [
                ev for ev in eventos
                if str(ev.get("local_id")) in ids_permitidos or "crystal" in ((ev.get("locales") or {}).get("nombre") or "").lower()
            ]

        ids_eventos_disponibles = [ev["id"] for ev in eventos]
        evento_seleccionado_id = evento_id
        if evento_seleccionado_id and evento_seleccionado_id not in ids_eventos_disponibles:
            evento_seleccionado_id = None
        if not evento_seleccionado_id and eventos:
            evento_seleccionado_id = eventos[0]["id"]

        if evento_seleccionado_id:
            fijar_evento_proyector(evento_seleccionado_id)
            datos_evento = construir_dashboard_evento_rapido(
                evento_seleccionado_id, usar_cache=False
            )
        else:
            datos_evento = {
                "evento_seleccionado_id": None,
                "auto_aprobar_fotos": False,
                "estado_trivia": {
                    "fase": "inactiva",
                    "pregunta_activa_id": None,
                    "total_respuestas_activa": 0,
                },
                "preguntas": [],
                "multimedia": [],
                "invitados": [],
            }

        ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "ok": True,
            "tiempo_carga_ms": ms,
            "rol": info_rol["rol"],
            "sede_permitida": info_rol["sede_clave"],
            "sede_nombre": info_rol["sede_nombre"],
            "es_superadmin": info_rol["es_superadmin"],
            "bucket_configurado": SUPABASE_BUCKET,
            "gemini_configurado": bool(GEMINI_API_KEY and "tu-api-key" not in GEMINI_API_KEY.lower()),
            "locales": locales_visibles,
            "eventos": eventos,
            **datos_evento,
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al cargar datos del panel de administración: {str(error)}",
        )


@app.post("/api/admin/eventos")
def crear_evento_admin(
    datos: CrearEventoAdminInput,
    x_admin_password: str | None = Header(default=None),
):
    info_rol = verificar_admin_password(x_admin_password)
    if info_rol["rol"] in ("sede1", "sede2"):
        locales_actuales = _CACHE_LOCALES or []
        local_target = next((loc for loc in locales_actuales if loc.get("id") == datos.local_id), None)
        if not local_target and supabase:
            try:
                res_loc = ejecutar_consulta_segura(lambda db: db.table("locales").select("*").eq("id", datos.local_id).limit(1).execute())
                if res_loc and res_loc.data:
                    local_target = res_loc.data[0]
            except Exception:
                pass
        if local_target:
            nom_l = (local_target.get("nombre") or "").lower()
            if info_rol["rol"] == "sede1" and ("colocho" not in nom_l and "sede 1" not in nom_l):
                raise HTTPException(status_code=403, detail="No tienes permisos para crear eventos en Sede 2 - Crystal Garden.")
            if info_rol["rol"] == "sede2" and ("crystal" not in nom_l and "sede 2" not in nom_l):
                raise HTTPException(status_code=403, detail="No tienes permisos para crear eventos en Sede 1 - El Colocho.")

    codigo_limpio = re.sub(r"[^A-Z0-9\-]", "", datos.codigo_acceso.strip().upper())
    if len(codigo_limpio) < 3:
        raise HTTPException(
            status_code=400,
            detail="El código de acceso debe tener al menos 3 letras o números.",
        )

    lid = datos.local_id.strip()

    # Validación estricta de Código Corto: si ya existe en la base de datos, advertir
    # con un mensaje de error claro para evitar conflictos entre sedes y pantallas.
    try:
        dup = ejecutar_consulta_segura(
            lambda db: db.table("eventos")
            .select("id, nombre, local_id, locales(nombre)")
            .eq("codigo_acceso", codigo_limpio)
            .limit(1)
            .execute()
        )
        if dup.data:
            ev_existente = dup.data[0]
            sede_info = ev_existente.get("locales")
            nombre_sede = (
                sede_info.get("nombre")
                if isinstance(sede_info, dict) and sede_info.get("nombre")
                else "otra sede"
            )
            raise HTTPException(
                status_code=400,
                detail=f"El código corto '{codigo_limpio}' ya está en uso en el evento '{ev_existente.get('nombre')}' ({nombre_sede}). Por favor elige un código diferente para evitar conflictos entre sedes.",
            )
    except HTTPException:
        raise
    except Exception:
        pass

    tematica_sel = (datos.tematica_accesorios or "todos").strip().lower()
    try:
        nuevo_evento = {
            "local_id": lid,
            "nombre": datos.nombre.strip(),
            "codigo_acceso": codigo_limpio,
            "fecha_evento": datos.fecha_evento,
            "estado": "activo",
            "trivia_activa": False,
            "tematica_accesorios": tematica_sel,
        }
        try:
            res = ejecutar_consulta_segura(
                lambda db: db.table("eventos").insert(nuevo_evento).execute()
            )
        except Exception:
            nuevo_evento_simple = {k: v for k, v in nuevo_evento.items() if k != "tematica_accesorios"}
            res = ejecutar_consulta_segura(
                lambda db: db.table("eventos").insert(nuevo_evento_simple).execute()
            )

        if not res.data:
            raise HTTPException(status_code=500, detail="No se pudo crear el evento.")

        ev_creado = res.data[0]
        ev_creado["tematica_accesorios"] = tematica_sel
        estado_ev = obtener_estado_evento(ev_creado["id"])
        estado_ev["tematica_accesorios"] = tematica_sel
        fijar_evento_proyector(ev_creado["id"], lid)

        return {
            "ok": True,
            "mensaje": f"Evento '{datos.nombre}' creado con éxito en la sede (Código QR: {codigo_limpio}).",
            "evento": ev_creado,
        }
    except HTTPException:
        raise
    except Exception as error:
        err_msg = str(error)
        if "duplicate key" in err_msg.lower() or "unique constraint" in err_msg.lower():
            raise HTTPException(
                status_code=400,
                detail=f"El código corto '{codigo_limpio}' ya está en uso en la base de datos. Por favor elige otro código para evitar conflictos entre sedes.",
            )
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear el evento: {err_msg}",
        )


@app.patch("/api/admin/eventos/{evento_id}/tematica")
def actualizar_tematica_evento_admin(
    evento_id: str,
    datos: ActualizarTematicaEventoInput,
    x_admin_password: str | None = Header(default=None),
):
    verificar_admin_password(x_admin_password)
    eid = evento_id.strip()
    tematica_nueva = datos.tematica_accesorios.strip().lower()
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("eventos").update({"tematica_accesorios": tematica_nueva}).eq("id", eid).execute()
        )
    except Exception as err:
        print(f"Aviso al actualizar tematica en BD: {err}")

    estado_ev = obtener_estado_evento(eid)
    estado_ev["tematica_accesorios"] = tematica_nueva
    _guardar_estado_eventos_disco()
    invalidar_cache_evento(eid)
    liberar_memoria_os()
    return {
        "ok": True,
        "mensaje": f"Temática de accesorios del evento actualizada a '{tematica_nueva}'.",
        "evento_id": eid,
        "tematica_accesorios": tematica_nueva,
    }


@app.patch("/api/admin/multimedia/{multimedia_id}")
def moderar_multimedia_admin(
    multimedia_id: str,
    datos: ModerarMultimediaInput,
    x_admin_password: str | None = Header(default=None),
):
    verificar_admin_password(x_admin_password)

    try:
        res = ejecutar_consulta_segura(
            lambda db: db.table("multimedia")
            .update({"estado_moderacion": datos.estado_moderacion})
            .eq("id", multimedia_id.strip())
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="No se encontró la foto indicada.")

        fila = res.data[0]
        invalidar_cache_evento(fila.get("evento_id"))

        accion_txt = (
            "APROBADA para la pantalla gigante"
            if datos.estado_moderacion == "aprobado"
            else "RECHAZADA"
        )
        return {
            "ok": True,
            "mensaje": f"Foto {accion_txt}.",
            "multimedia": fila,
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al actualizar el estado de moderación: {str(error)}",
        )


# ------------------------------------------------------------------------------
# REQUERIMIENTO A (FASE 4.5): ELIMINACIÓN DEFINITIVA EN STORAGE Y TABLA SQL
# ------------------------------------------------------------------------------
@app.delete("/api/admin/multimedia/{multimedia_id}")
def eliminar_multimedia_definitivamente(
    multimedia_id: str,
    x_admin_password: str | None = Header(default=None),
):
    """
    DIDÁCTICA (Fase 4.5 - Requerimiento A: Eliminación Definitiva):
    1. Consulta el registro en la tabla 'multimedia' para obtener su URL y evento_id.
    2. Borra físicamente el archivo JPEG del Bucket de Supabase Storage
       (db.storage.from_(SUPABASE_BUCKET).remove([ruta_storage])) para liberar
       espacio real de almacenamiento (y borra también del disco local si aplica).
    3. Ejecuta DELETE en la tabla SQL 'multimedia' de Supabase.
    """
    verificar_admin_password(x_admin_password)
    mid = multimedia_id.strip()

    try:
        consulta = ejecutar_consulta_segura(
            lambda db: db.table("multimedia")
            .select("id, evento_id, url_con_marca, url_original")
            .eq("id", mid)
            .execute()
        )
        if not consulta.data:
            raise HTTPException(status_code=404, detail="La fotografía ya no existe en la base de datos.")

        registro = consulta.data[0]
        evento_id = registro.get("evento_id") or ""
        url_marca = registro.get("url_con_marca") or ""
        url_orig = registro.get("url_original") or ""

        # Paso 1: Borrar físicamente los archivos (con marca y original) del Bucket de Supabase Storage
        rutas_storage = []
        for u in (url_marca, url_orig):
            r = extraer_ruta_storage_de_url(u, evento_id)
            if r and r not in rutas_storage:
                rutas_storage.append(r)

        borrado_storage = False
        if rutas_storage:
            try:
                db = verificar_conexion_supabase()
                db.storage.from_(SUPABASE_BUCKET).remove(rutas_storage)
                borrado_storage = True
            except Exception as st_err:
                print(f"Aviso al borrar objetos {rutas_storage} de Supabase Storage: {st_err}")

        # Si existiera copia en el directorio local de respaldo, eliminarla también
        for u in (url_marca, url_orig):
            nombre_archivo = u.split("#")[0].split("?")[0].split("/")[-1]
            for posible_ruta in (
                LOCAL_UPLOADS_DIR / "multimedia" / nombre_archivo,
                LOCAL_UPLOADS_DIR / "originales" / nombre_archivo,
                LOCAL_UPLOADS_DIR / nombre_archivo,
            ):
                if nombre_archivo and posible_ruta.exists():
                    try:
                        posible_ruta.unlink()
                    except Exception:
                        pass

        # Paso 2: Ejecutar DELETE en la tabla SQL 'multimedia'
        ejecutar_consulta_segura(
            lambda db: db.table("multimedia").delete().eq("id", mid).execute()
        )

        invalidar_cache_evento(evento_id)
        liberar_memoria_os()

        return {
            "ok": True,
            "borrado_storage": borrado_storage,
            "rutas_storage_eliminadas": rutas_storage,
            "mensaje": "Fotografía eliminada definitivamente de Supabase Storage y de la base de datos SQL.",
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al eliminar definitivamente la fotografía: {str(error)}",
        )


# ------------------------------------------------------------------------------
# GESTIÓN EJECUTIVA DE BASE DE DATOS Y DESCARGA ZIP DEL EVENTO (CON / SIN MARCO)
# ------------------------------------------------------------------------------
def _descargar_bytes_foto_limpia(url_foto: str, evento_id: str) -> bytes | None:
    """
    Recupera los bytes JPEG limpios originales tal como los subió el invitado,
    desde el almacenamiento local o directamente desde Supabase Storage.
    """
    if not url_foto:
        return None
    url_limpia = url_foto.split("#")[0].split("?")[0].strip()
    nombre_archivo = url_limpia.split("/")[-1]

    # 1. Intentar desde disco local
    if nombre_archivo:
        for cand_local in (
            LOCAL_UPLOADS_DIR / "multimedia" / nombre_archivo,
            LOCAL_UPLOADS_DIR / nombre_archivo,
        ):
            if cand_local.exists():
                try:
                    return cand_local.read_bytes()
                except Exception:
                    pass

    # 2. Intentar descarga desde Supabase Storage
    ruta_st = extraer_ruta_storage_de_url(url_limpia, evento_id)
    rutas_candidatas = [ruta_st] if ruta_st else []
    if nombre_archivo and f"multimedia/{nombre_archivo}" not in rutas_candidatas:
        rutas_candidatas.append(f"multimedia/{nombre_archivo}")

    if supabase is not None:
        for r in rutas_candidatas:
            if not r:
                continue
            try:
                datos = supabase.storage.from_(SUPABASE_BUCKET).download(r)
                if datos:
                    return datos
            except Exception:
                pass

    # 3. Intentar descarga vía HTTP si es URL pública
    if url_limpia.startswith("http://") or url_limpia.startswith("https://"):
        try:
            req = urllib.request.Request(
                url_limpia,
                headers={"User-Agent": "SegaluAdminZipDownloader/1.0"},
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                return resp.read()
        except Exception:
            pass

    return None


@app.get("/api/admin/eventos/{evento_id}/descargar-zip")
def descargar_fotos_evento_zip(
    evento_id: str,
    con_marca_agua: bool = False,
    admin_password: str | None = None,
    x_admin_password: str | None = Header(default=None),
):
    """
    Descarga limpia:
    Genera y descarga al instante un archivo .ZIP con todas las fotografías limpias
    originales tal como las subió el invitado.
    """
    clave_recibida = x_admin_password or admin_password
    verificar_admin_password(clave_recibida)
    eid = evento_id.strip()

    try:
        ev_res = ejecutar_consulta_segura(
            lambda db: db.table("eventos")
            .select("id, nombre, codigo_acceso")
            .eq("id", eid)
            .limit(1)
            .execute()
        )
        codigo_ev = (
            ev_res.data[0].get("codigo_acceso", "EVENTO")
            if ev_res.data
            else "EVENTO"
        )
        codigo_limpio = re.sub(r"[^A-Za-z0-9_\-]", "_", str(codigo_ev))

        mult_res = ejecutar_consulta_segura(
            lambda db: db.table("multimedia")
            .select("id, url_con_marca, url_original, estado_moderacion, created_at, invitados(nombre)")
            .eq("evento_id", eid)
            .order("created_at")
            .execute()
        )
        lista_fotos = mult_res.data or []
        if not lista_fotos:
            raise HTTPException(
                status_code=404,
                detail="Este evento aún no tiene fotografías subidas para empaquetar en ZIP.",
            )

        import zipfile

        buffer_zip = io.BytesIO()
        archivos_agregados = 0

        with zipfile.ZipFile(buffer_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for idx, item in enumerate(lista_fotos, start=1):
                url_foto = (item.get("url_con_marca") or item.get("url_original") or "").strip()

                img_bytes = _descargar_bytes_foto_limpia(
                    url_foto=url_foto,
                    evento_id=eid,
                )
                if not img_bytes:
                    continue

                autor_raw = (item.get("invitados") or {}).get("nombre") or "Invitado"
                autor_slug = re.sub(r"[^A-Za-z0-9]+", "_", autor_raw).strip("_") or "Invitado"
                estado_slug = str(item.get("estado_moderacion") or "foto").upper()
                nombre_en_zip = f"{idx:03d}_{autor_slug}_{estado_slug}_ORIGINAL.jpg"

                zf.writestr(nombre_en_zip, img_bytes)
                del img_bytes
                archivos_agregados += 1

        if archivos_agregados == 0:
            buffer_zip.close()
            liberar_memoria_os()
            raise HTTPException(
                status_code=404,
                detail="No se pudieron recuperar archivos físicos de imagen para este evento.",
            )

        buffer_zip.seek(0)
        nombre_zip = f"Fotos_{codigo_limpio}_Originales.zip"

        def _cerrar_y_limpiar_zip(buf):
            try:
                buf.close()
            except Exception:
                pass
            liberar_memoria_os()

        return StreamingResponse(
            buffer_zip,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{nombre_zip}"',
                "Cache-Control": "no-store",
            },
            background=BackgroundTask(_cerrar_y_limpiar_zip, buffer_zip),
        )
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar el archivo ZIP del evento: {str(err)}",
        )


def _purgar_archivos_storage_de_evento(evento_id: str) -> tuple[int, int]:
    """
    Auxiliar reutilizable que borra todas las fotos de un evento en Supabase Storage
    y elimina los registros de `multimedia`.
    """
    eid = evento_id.strip()
    mult_res = ejecutar_consulta_segura(
        lambda db: db.table("multimedia")
        .select("id, url_con_marca, url_original")
        .eq("evento_id", eid)
        .execute()
    )
    registros = mult_res.data or []
    rutas_storage: list[str] = []

    for reg in registros:
        for campo in ("url_con_marca", "url_original"):
            url_val = reg.get(campo) or ""
            ruta_st = extraer_ruta_storage_de_url(url_val, eid)
            if ruta_st and ruta_st not in rutas_storage:
                rutas_storage.append(ruta_st)

            nombre_local = url_val.split("#")[0].split("?")[0].split("/")[-1]
            if nombre_local:
                for archivo_local in (
                    LOCAL_UPLOADS_DIR / "multimedia" / nombre_local,
                    LOCAL_UPLOADS_DIR / "originales" / nombre_local,
                    LOCAL_UPLOADS_DIR / nombre_local,
                ):
                    if archivo_local.exists():
                        try:
                            archivo_local.unlink()
                        except Exception:
                            pass

    if rutas_storage:
        try:
            db = verificar_conexion_supabase()
            db.storage.from_(SUPABASE_BUCKET).remove(rutas_storage)
        except Exception as st_err:
            print(f"Aviso al purgar lote de fotos en Supabase Storage: {st_err}")

    if registros:
        ejecutar_consulta_segura(
            lambda db: db.table("multimedia").delete().eq("evento_id", eid).execute()
        )

    return len(registros), len(rutas_storage)


def _parsear_fecha_evento_o_creacion(ev: dict) -> datetime | None:
    """
    Parsea de forma robusta la fecha de celebración o de creación del evento.
    Prioriza `fecha_evento` (la fecha real de la fiesta) con fallback a `created_at`.
    """
    for campo in ("fecha_evento", "created_at"):
        val = ev.get(campo)
        if not val:
            continue
        val_str = str(val).strip()
        try:
            if "T" in val_str or "+" in val_str or "Z" in val_str:
                dt = datetime.fromisoformat(val_str.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            # Formato simple de fecha YYYY-MM-DD
            d = date.fromisoformat(val_str[:10])
            return datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)
        except Exception:
            continue
    return None


def calcular_estado_30d_evento(ev: dict) -> dict:
    """
    Calcula si un evento ha superado los 30 días de antigüedad o si ya fue purgado.
    Devuelve los días restantes y la información de la píldora informativa para el Admin.
    """
    eid = str(ev.get("id") or "").strip()
    st = _ESTADO_EVENTOS.get(eid) or {}
    ya_autolimpiado = bool(st.get("autolimpiado_30d"))

    fecha_base = _parsear_fecha_evento_o_creacion(ev)
    ahora = datetime.now(timezone.utc)

    if not fecha_base:
        return {
            "purgado": ya_autolimpiado,
            "dias_restantes": 0 if ya_autolimpiado else 30,
            "badge_texto": "🧹 Multimedia purgada (CRM activo)" if ya_autolimpiado else "⏳ Autolimpieza multimedia: 30 días restantes",
            "badge_tipo": "purgado" if ya_autolimpiado else "activo",
        }

    dias_transcurridos = (ahora - fecha_base).total_seconds() / 86400.0
    dias_restantes = max(0, int(30 - dias_transcurridos))

    if ya_autolimpiado or dias_transcurridos >= 30.0:
        return {
            "purgado": True,
            "dias_restantes": 0,
            "dias_antiguedad": int(dias_transcurridos),
            "badge_texto": "🧹 Multimedia purgada (CRM activo)",
            "badge_tipo": "purgado",
        }
    else:
        return {
            "purgado": False,
            "dias_restantes": dias_restantes,
            "dias_antiguedad": int(dias_transcurridos),
            "badge_texto": f"⏳ Autolimpieza multimedia: {dias_restantes} día{'s' if dias_restantes != 1 else ''} restante{'s' if dias_restantes != 1 else ''}",
            "badge_tipo": "advertencia" if dias_restantes <= 5 else "activo",
        }


def ejecutar_autolimpieza_30_dias_evento(evento_id: str) -> dict:
    """
    Ejecuta la purga periódica a los 30 días para un evento:
    1. Purga fotos del Storage y tabla `multimedia`.
    2. Purga preguntas y respuestas de la trivia.
    3. Purga invitados registrados en el evento.
    4. Purga paquetes de accesorios temporales vinculados exclusivamente a este evento (scope == 'evento').
    5. CRÍTICO: CONSERVA INTACTA la fila del evento en la tabla `eventos` y CONSERVA INTACTOS todos los prospectos en `crm_leads`.
    6. Marca el evento como autolimpiado en memoria y lo persiste a disco.
    """
    eid = evento_id.strip()

    # 1. Purgar fotos del Bucket de Supabase Storage y tabla multimedia
    fotos_borradas, archivos_borrados = _purgar_archivos_storage_de_evento(eid)

    # 2. Borrar respuestas_trivia y preguntas del evento
    try:
        preguntas_ev = listar_preguntas_evento(eid)
        for p in preguntas_ev:
            pid = p.get("id")
            if pid:
                try:
                    ejecutar_consulta_segura(
                        lambda db, _pid=pid: db.table("respuestas_trivia").delete().eq("pregunta_id", _pid).execute()
                    )
                except Exception:
                    pass
        ejecutar_consulta_segura(
            lambda db: db.table("preguntas").delete().eq("evento_id", eid).execute()
        )
    except Exception as err_preg:
        print(f"Aviso al purgar preguntas en autolimpieza 30d ({eid}): {err_preg}")

    # 3. Borrar invitados del evento
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("invitados").delete().eq("evento_id", eid).execute()
        )
    except Exception as err_inv:
        print(f"Aviso al purgar invitados en autolimpieza 30d ({eid}): {err_inv}")

    # 4. Purgar paquetes de accesorios temporales vinculados exclusivamente a este evento (scope == 'evento')
    try:
        catalogo_actual = obtener_catalogo_paquetes_completo()
        paquetes_a_borrar = [
            pid for pid, pkg in catalogo_actual.items()
            if pkg.get("scope") == "evento" and str(pkg.get("evento_id") or "").strip() == eid
        ]
        if paquetes_a_borrar:
            db_sb = verificar_conexion_supabase()
            for pid in paquetes_a_borrar:
                pkg = catalogo_actual[pid]
                rutas_storage = [f"accesorios/{pid}/{acc['archivo']}" for acc in pkg.get("accesorios", []) if acc.get("archivo")]
                if rutas_storage:
                    try:
                        db_sb.storage.from_(SUPABASE_BUCKET).remove(rutas_storage)
                    except Exception:
                        pass
                dir_loc = Path(__file__).parent.parent / "frontend" / "static" / "accessories" / pid
                if dir_loc.exists() and dir_loc.is_dir():
                    import shutil
                    shutil.rmtree(dir_loc, ignore_errors=True)
                del catalogo_actual[pid]
            guardar_catalogo_paquetes(catalogo_actual)
    except Exception as err_pkg:
        print(f"Aviso al purgar paquetes temporales en autolimpieza 30d ({eid}): {err_pkg}")

    # 5. Marcar estado autolimpiado conservando el evento y sus datos CRM
    st = obtener_estado_evento(eid)
    st["autolimpiado_30d"] = True
    st["fecha_autolimpieza_30d"] = datetime.now(timezone.utc).isoformat()
    _guardar_estado_eventos_disco()
    invalidar_cache_evento(eid)
    liberar_memoria_os()

    return {
        "ok": True,
        "evento_id": eid,
        "fotos_eliminadas": fotos_borradas,
        "archivos_storage_purgados": archivos_borrados,
        "crm_conservado": True,
        "evento_conservado": True,
        "mensaje": f"🧹 Autolimpieza de 30 días completada para el evento {eid}. Se purgaron {fotos_borradas} fotos y datos operativos, conservando intactos el evento y su base CRM.",
    }


_ULTIMA_VERIFICACION_AUTOLIMPIEZA: float = 0.0
INTERVALO_VERIFICACION_AUTOLIMPIEZA_SEG: float = 6 * 3600.0  # Máximo una vez cada 6 horas


def verificar_y_ejecutar_autolimpieza_30_dias(
    eventos: list[dict] | None = None,
    forzar: bool = False,
) -> list[str]:
    """
    Verifica periódicamente si existen eventos con más de 30 días de antigüedad
    (tomando fecha_evento o created_at) y ejecuta la autolimpieza conservando el CRM.
    Se limita a un chequeo máximo cada 6 horas para evitar sobrecarga en la base de datos.
    """
    global _ULTIMA_VERIFICACION_AUTOLIMPIEZA
    ahora_ts = time.time()
    if not forzar and (ahora_ts - _ULTIMA_VERIFICACION_AUTOLIMPIEZA) < INTERVALO_VERIFICACION_AUTOLIMPIEZA_SEG:
        return []

    _ULTIMA_VERIFICACION_AUTOLIMPIEZA = ahora_ts

    if eventos is None:
        try:
            res = ejecutar_consulta_segura(
                lambda db: db.table("eventos").select("id, nombre, fecha_evento, created_at").execute()
            )
            eventos = res.data or []
        except Exception as err:
            print(f"Aviso al consultar eventos para chequeo 30d: {err}")
            return []

    ahora_dt = datetime.now(timezone.utc)
    eventos_purgados: list[str] = []

    for ev in eventos:
        eid = str(ev.get("id") or "").strip()
        if not eid:
            continue
        st = _ESTADO_EVENTOS.get(eid) or {}
        if st.get("autolimpiado_30d"):
            continue

        fecha_ref = _parsear_fecha_evento_o_creacion(ev)
        if not fecha_ref:
            continue

        dias = (ahora_dt - fecha_ref).total_seconds() / 86400.0
        if dias >= 30.0:
            try:
                print(f"[AUTOLIMPIEZA 30D] Purgando automáticamente evento '{ev.get('nombre')}' ({eid}), antigüedad: {dias:.1f} días...")
                ejecutar_autolimpieza_30_dias_evento(eid)
                eventos_purgados.append(eid)
            except Exception as e_purge:
                print(f"[AUTOLIMPIEZA 30D] Error al purgar evento {eid}: {e_purge}")

    return eventos_purgados


@app.post("/api/admin/eventos/{evento_id}/autolimpieza-30d")
def forzar_autolimpieza_30d_evento(
    evento_id: str,
    x_admin_password: str | None = Header(default=None),
):
    """
    Fuerza manualmente la autolimpieza de 30 días para un evento:
    Purga fotos y datos operativos pero CONSERVA el registro del evento y todos los leads de crm_leads.
    """
    verificar_admin_password(x_admin_password)
    eid = evento_id.strip()
    return ejecutar_autolimpieza_30_dias_evento(eid)


@app.delete("/api/admin/eventos/{evento_id}/purgar-fotos")
def purgar_fotos_storage_evento(
    evento_id: str,
    x_admin_password: str | None = Header(default=None),
):
    """
    Vacía y purga todas las fotografías del evento en Supabase Storage y en la tabla
    `multimedia` para liberar espacio en la nube, manteniendo intactos el evento,
    los invitados registrados y el banco de preguntas.
    """
    verificar_admin_password(x_admin_password)
    eid = evento_id.strip()

    try:
        total_filas, total_archivos = _purgar_archivos_storage_de_evento(eid)
        invalidar_cache_evento(eid)
        liberar_memoria_os()
        return {
            "ok": True,
            "fotos_eliminadas": total_filas,
            "archivos_storage_purgados": total_archivos,
            "mensaje": (
                f"🧹 Se purgaron {total_filas} fotografía(s) y {total_archivos} archivo(s) del Storage. "
                "Los invitados y la trivia del evento se mantienen intactos."
            ),
        }
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Error al vaciar las fotos del evento: {str(err)}",
        )


@app.delete("/api/admin/eventos/{evento_id}")
@app.delete("/api/admin/eventos/{evento_id}/eliminar-completo")
def eliminar_evento_completo_en_cascada(
    evento_id: str,
    x_admin_password: str | None = Header(default=None),
):
    """
    Elimina en cascada TODO el evento:
    1. Purga físicamente todas las fotografías del Bucket de Supabase Storage y tabla `multimedia`.
    2. Elimina `respuestas_trivia` asociadas a las preguntas del evento.
    3. Elimina `preguntas` del evento.
    4. Elimina `invitados` del evento.
    5. Elimina el registro del evento en la tabla `eventos` y limpia su memoria caché.
    """
    verificar_admin_password(x_admin_password)
    eid = evento_id.strip()

    try:
        ev_res = ejecutar_consulta_segura(
            lambda db: db.table("eventos")
            .select("id, nombre, codigo_acceso")
            .eq("id", eid)
            .limit(1)
            .execute()
        )
        if not ev_res.data:
            raise HTTPException(status_code=404, detail="El evento indicado ya no existe.")
        nombre_ev = ev_res.data[0].get("nombre", "Evento")

        # 1. Purgar fotos del Bucket de Supabase Storage y tabla multimedia
        fotos_borradas, archivos_borrados = _purgar_archivos_storage_de_evento(eid)

        # 2. Borrar respuestas_trivia y preguntas del evento
        try:
            preguntas_ev = listar_preguntas_evento(eid)
            for p in preguntas_ev:
                pid = p.get("id")
                if pid:
                    try:
                        ejecutar_consulta_segura(
                            lambda db, _pid=pid: db.table("respuestas_trivia")
                            .delete()
                            .eq("pregunta_id", _pid)
                            .execute()
                        )
                    except Exception:
                        pass
            ejecutar_consulta_segura(
                lambda db: db.table("preguntas").delete().eq("evento_id", eid).execute()
            )
        except Exception:
            pass

        # 3. Borrar invitados del evento
        try:
            ejecutar_consulta_segura(
                lambda db: db.table("invitados").delete().eq("evento_id", eid).execute()
            )
        except Exception:
            pass

        # 3.5. Borrar leads CRM generados en este evento
        try:
            eid_uuid = eid
            if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", eid, re.I):
                ev_check = ejecutar_consulta_segura(
                    lambda db: db.table("eventos").select("id").eq("codigo_acceso", eid).limit(1).execute()
                )
                if ev_check and ev_check.data:
                    eid_uuid = ev_check.data[0]["id"]
            ejecutar_consulta_segura(
                lambda db: db.table("crm_leads").delete().eq("evento_id", eid_uuid).execute()
            )
            for clave in [eid, eid_uuid]:
                if clave in _ESTADO_EVENTOS and isinstance(_ESTADO_EVENTOS[clave], dict):
                    _ESTADO_EVENTOS[clave]["crm_leads"] = []
        except Exception as crm_err:
            print(f"Aviso al purgar crm_leads en eliminación total ({eid}): {crm_err}")

        # 4. Borrar el evento en la tabla eventos
        ejecutar_consulta_segura(
            lambda db: db.table("eventos").delete().eq("id", eid).execute()
        )

        # 4.5. Purgar en cascada paquetes de accesorios temporales vinculados a este evento (scope == "evento")
        try:
            catalogo_actual = obtener_catalogo_paquetes_completo()
            paquetes_a_borrar = [
                pid for pid, pkg in catalogo_actual.items()
                if pkg.get("scope") == "evento" and str(pkg.get("evento_id") or "").strip() == eid
            ]
            if paquetes_a_borrar:
                db_sb = verificar_conexion_supabase()
                for pid in paquetes_a_borrar:
                    pkg = catalogo_actual[pid]
                    rutas_storage = [f"accesorios/{pid}/{acc['archivo']}" for acc in pkg.get("accesorios", []) if acc.get("archivo")]
                    if rutas_storage:
                        try:
                            db_sb.storage.from_(SUPABASE_BUCKET).remove(rutas_storage)
                        except Exception:
                            pass
                    dir_loc = Path(__file__).parent.parent / "frontend" / "static" / "accessories" / pid
                    if dir_loc.exists() and dir_loc.is_dir():
                        import shutil
                        shutil.rmtree(dir_loc, ignore_errors=True)
                    del catalogo_actual[pid]
                guardar_catalogo_paquetes(catalogo_actual)
        except Exception as err_pkg:
            print(f"Aviso al purgar paquetes de accesorios del evento en cascada: {err_pkg}")

        # 5. Limpiar estados en memoria y caché
        _ESTADO_EVENTOS.pop(eid, None)
        if _ESTADO_EVENTOS.get("__proyector_evento_id__") == eid:
            _ESTADO_EVENTOS["__proyector_evento_id__"] = None
        _guardar_estado_eventos_disco()
        invalidar_cache_evento(eid)
        _CACHE_META_EVENTOS_PROYECTOR.clear()
        liberar_memoria_os()

        return {
            "ok": True,
            "evento_eliminado_id": eid,
            "fotos_eliminadas": fotos_borradas,
            "archivos_storage_purgados": archivos_borrados,
            "mensaje": f"🗑️ El evento '{nombre_ev}' fue eliminado por completo junto con sus fotos, invitados, preguntas, respuestas y prospectos CRM.",
        }
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Error al eliminar el evento en cascada: {str(err)}",
        )


class ConfigGaleriaInput(BaseModel):
    modo_galeria: str = Field(default="ciclo_auto")
    duracion_foto_segundos: int = Field(default=8, ge=3, le=30)


@app.post("/api/admin/eventos/{evento_id}/config-galeria")
def configurar_galeria_proyector(
    evento_id: str,
    datos: ConfigGaleriaInput,
    x_admin_password: str | None = Header(default=None),
):
    verificar_admin_password(x_admin_password)
    eid = evento_id.strip()
    fijar_evento_proyector(eid)
    estado_ev = obtener_estado_evento(eid)

    modo = datos.modo_galeria.strip().lower()
    if modo not in ("ciclo_auto", "individual", "mosaico"):
        modo = "ciclo_auto"

    duracion = int(datos.duracion_foto_segundos)
    if duracion not in (5, 8, 12):
        duracion = 8

    estado_ev["modo_galeria"] = modo
    estado_ev["duracion_foto_segundos"] = duracion
    _guardar_estado_eventos_disco()
    invalidar_cache_evento(eid)

    etiquetas = {
        "ciclo_auto": "Modo Ciclo Automático (Carrusel 1x1 + Mosaico de 6 a 8 fotos)",
        "individual": "Solo Foto Individual (Carrusel 1x1 a pantalla completa)",
        "mosaico": "Solo Mosaico (Mural de 6 a 8 fotos)",
    }
    return {
        "ok": True,
        "config_galeria": {
            "modo_galeria": modo,
            "duracion_foto_segundos": duracion,
        },
        "mensaje": f"Proyector actualizado: {etiquetas[modo]} · {duracion}s por foto.",
    }


# ------------------------------------------------------------------------------
# GESTOR DE 4 FOTOS POR SEDE CON SUPABASE STORAGE Y RESPALDO LOCAL
# ------------------------------------------------------------------------------
SEDES_IMG_DIR = FRONTEND_STATIC_DIR / "img" / "sedes"
SEDES_IMG_DIR.mkdir(parents=True, exist_ok=True)


def _construir_catalogo_fotos_sedes() -> tuple[dict, dict]:
    """
    Construye la estructura unificada de las 4 fotos de Sede 1 y Sede 2
    combinando las URLs de Supabase Storage guardadas en configuración y
    verificando archivos locales si existieran, incluyendo títulos personalizados.
    """
    guardadas_raw = _ESTADO_EVENTOS.get("__fotos_sedes__")
    guardadas = guardadas_raw if isinstance(guardadas_raw, dict) else {}

    titulos_raw = _ESTADO_EVENTOS.get("__titulos_sedes__")
    titulos_guardados = titulos_raw if isinstance(titulos_raw, dict) else {}

    titulos_default = {
        "sede1": {
            "1": "Salón Principal y Pista LED",
            "2": "Área de Recepción y Fotocall",
            "3": "Mesa de Honor y Arreglos Florales",
            "4": "Entrada de Gala e Iluminación",
        },
        "sede2": {
            "1": "Jardín Central y Altar Soñado",
            "2": "Pérgola Iluminada de Recepción",
            "3": "Salón Crystal con Candelabros",
            "4": "Zona Lounge y Espacios Abiertos",
        },
    }

    fotos_listas: dict[str, list[dict]] = {"sede1": [], "sede2": []}
    fotos_mapa: dict[str, dict[str, str]] = {"sede1": {}, "sede2": {}}

    for sede_key in ("sede1", "sede2"):
        mapa_sede = guardadas.get(sede_key)
        if not isinstance(mapa_sede, dict):
            mapa_sede = {}

        mapa_titulos = titulos_guardados.get(sede_key)
        if not isinstance(mapa_titulos, dict):
            mapa_titulos = {}

        for num in range(1, 5):
            nombre_jpg = f"{sede_key}_foto{num}.jpg"
            ruta_local = SEDES_IMG_DIR / nombre_jpg
            url_guardada = str(mapa_sede.get(str(num)) or "").strip()
            titulo_personalizado = str(mapa_titulos.get(str(num)) or "").strip()
            titulo_def = titulos_default.get(sede_key, {}).get(str(num), f"Foto {num}")
            titulo_final = titulo_personalizado or titulo_def

            if url_guardada:
                url_final = url_guardada
                existe_foto = True
            elif ruta_local.exists():
                ts_mod = int(ruta_local.stat().st_mtime)
                url_final = f"/static/img/sedes/{nombre_jpg}?v={ts_mod}"
                existe_foto = True
            else:
                url_final = f"/static/img/sedes/{nombre_jpg}"
                existe_foto = False

            if existe_foto:
                fotos_mapa[sede_key][str(num)] = url_final

            fotos_listas[sede_key].append(
                {
                    "numero": num,
                    "archivo": nombre_jpg,
                    "url": url_final,
                    "existe": existe_foto,
                    "titulo": titulo_final,
                }
            )

    return fotos_listas, fotos_mapa


@app.get("/api/sedes/fotos")
@app.get("/api/admin/sedes/galeria")
def obtener_fotos_personalizadas_sedes():
    fotos_listas, fotos_mapa = _construir_catalogo_fotos_sedes()
    return {
        "ok": True,
        "fotos": fotos_listas,
        "fotos_sedes": fotos_mapa,
    }


@app.post("/api/admin/sedes/galeria")
@app.post("/api/admin/sedes/subir-foto")
def subir_foto_sede_admin(
    sede: str | None = Form(default=None),
    sede_key: str | None = Form(default=None),
    numero_foto: int | None = Form(default=None),
    indice_foto: int | None = Form(default=None),
    archivo: UploadFile = File(...),
    titulo: str | None = Form(default=None),
    x_admin_password: str | None = Header(default=None),
):
    """
    Sube cualquiera de las 4 fotos promocionales de Sede 1 o Sede 2:
    1. Redimensiona y optimiza en formato vertical protagonista 4:5 (1080x1350 JPEG).
    2. Sube el archivo al Bucket de Supabase Storage (`sedes/sede1_foto1.jpg` con upsert=true)
       y guarda también una copia en `frontend/static/img/sedes/`.
    3. Registra la URL pública y el título en la configuración de la sede para que se refleje
       de inmediato en el visor vertical del invitado y en el Panel de Administrador.
    """
    verificar_admin_password(x_admin_password)

    sede_recibida = (sede or sede_key or "").strip().lower()
    if sede_recibida not in ("sede1", "sede2"):
        raise HTTPException(status_code=400, detail="Sede inválida. Usa 'sede1' o 'sede2'.")

    indice_recibido = numero_foto if numero_foto is not None else indice_foto
    if indice_recibido is None:
        raise HTTPException(status_code=400, detail="Indica el número de foto (1 a 4).")

    num = max(1, min(4, int(indice_recibido)))
    try:
        raw_bytes = archivo.file.read()
    finally:
        try:
            archivo.file.close()
        except Exception:
            pass
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="El archivo de imagen seleccionado está vacío.")

    bio = None
    img = None
    img_vertical = None
    buf = None
    try:
        bio = io.BytesIO(raw_bytes)
        img = Image.open(bio)
        img = ImageOps.exif_transpose(img).convert("RGB")
        # Recorte inteligente vertical 4:5 (1080x1350) protagonista para celular
        img_vertical = ImageOps.fit(img, (1080, 1350), method=Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        img_vertical.save(buf, format="JPEG", quality=86, optimize=True)
        jpeg_bytes = buf.getvalue()

        nombre_jpg = f"{sede_recibida}_foto{num}.jpg"
        ruta_destino_local = SEDES_IMG_DIR / nombre_jpg
        ruta_destino_local.write_bytes(jpeg_bytes)

        ts_version = int(time.time())
        ruta_storage_sede = f"sedes/{nombre_jpg}"
        url_publica = f"/static/img/sedes/{nombre_jpg}?v={ts_version}"
        origen_storage = "local_fallback"

        # Subir al Bucket de Supabase Storage para persistencia en la nube
        try:
            db = verificar_conexion_supabase()
            db.storage.from_(SUPABASE_BUCKET).upload(
                path=ruta_storage_sede,
                file=jpeg_bytes,
                file_options={
                "content-type": "image/jpeg",
                "upsert": "true",
                "cache-control": "86400",
                "cacheControl": "86400",
            },
            )
            url_sb = db.storage.from_(SUPABASE_BUCKET).get_public_url(ruta_storage_sede)
            if url_sb:
                sep = "&" if "?" in url_sb else "?"
                url_publica = f"{url_sb}{sep}v={ts_version}"
                origen_storage = "supabase_storage"
        except Exception as st_err:
            print(f"Aviso Supabase Storage al subir foto de sede ({ruta_storage_sede}): {st_err}")

        if not isinstance(_ESTADO_EVENTOS.get("__fotos_sedes__"), dict):
            _ESTADO_EVENTOS["__fotos_sedes__"] = {}
        if not isinstance(_ESTADO_EVENTOS["__fotos_sedes__"].get(sede_recibida), dict):
            _ESTADO_EVENTOS["__fotos_sedes__"][sede_recibida] = {}

        _ESTADO_EVENTOS["__fotos_sedes__"][sede_recibida][str(num)] = url_publica

        if titulo and titulo.strip():
            if not isinstance(_ESTADO_EVENTOS.get("__titulos_sedes__"), dict):
                _ESTADO_EVENTOS["__titulos_sedes__"] = {}
            if not isinstance(_ESTADO_EVENTOS["__titulos_sedes__"].get(sede_recibida), dict):
                _ESTADO_EVENTOS["__titulos_sedes__"][sede_recibida] = {}
            _ESTADO_EVENTOS["__titulos_sedes__"][sede_recibida][str(num)] = titulo.strip()

        _guardar_estado_eventos_disco()

        fotos_listas, fotos_mapa = _construir_catalogo_fotos_sedes()

        return {
            "ok": True,
            "sede": sede_recibida,
            "sede_key": sede_recibida,
            "numero_foto": num,
            "indice_foto": num,
            "archivo": nombre_jpg,
            "url": url_publica,
            "url_foto": url_publica,
            "almacenamiento": origen_storage,
            "fotos": fotos_listas,
            "fotos_sedes": fotos_mapa,
            "mensaje": f"✅ Foto vertical {num}/4 de {sede_recibida.upper()} subida y actualizada con éxito.",
        }
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo procesar o subir la foto de la sede: {str(err)}",
        )
    finally:
        if img is not None:
            try:
                img.close()
            except Exception:
                pass
        if img_vertical is not None:
            try:
                img_vertical.close()
            except Exception:
                pass
        if buf is not None:
            try:
                buf.close()
            except Exception:
                pass
        if bio is not None:
            try:
                bio.close()
            except Exception:
                pass
        del raw_bytes
        liberar_memoria_os()


@app.patch("/api/admin/sedes/galeria/titulo")
@app.post("/api/admin/sedes/galeria/titulo")
def actualizar_titulo_foto_sede(
    datos: TituloFotoSedeInput,
    x_admin_password: str | None = Header(default=None),
):
    try:
        verificar_admin_password(x_admin_password)
        sede_key = datos.sede.strip().lower()
        if sede_key not in ("sede1", "sede2"):
            return JSONResponse(status_code=400, content={"ok": False, "detail": "Sede inválida. Usa 'sede1' o 'sede2'."})
        num = max(1, min(4, int(datos.numero_foto)))
        titulo_limpio = datos.titulo.strip()

        if not isinstance(_ESTADO_EVENTOS.get("__titulos_sedes__"), dict):
            _ESTADO_EVENTOS["__titulos_sedes__"] = {}
        if not isinstance(_ESTADO_EVENTOS["__titulos_sedes__"].get(sede_key), dict):
            _ESTADO_EVENTOS["__titulos_sedes__"][sede_key] = {}

        _ESTADO_EVENTOS["__titulos_sedes__"][sede_key][str(num)] = titulo_limpio
        _guardar_estado_eventos_disco()

        fotos_listas, fotos_mapa = _construir_catalogo_fotos_sedes()

        return JSONResponse(
            status_code=200,
            content={
                "ok": True,
                "mensaje": f"✅ Título de la foto {num} actualizado a '{titulo_limpio}'.",
                "sede": sede_key,
                "numero_foto": num,
                "titulo": titulo_limpio,
                "fotos": fotos_listas,
                "fotos_sedes": fotos_mapa,
            }
        )
    except HTTPException as he:
        return JSONResponse(status_code=he.status_code, content={"ok": False, "detail": he.detail})
    except Exception as err:
        return JSONResponse(status_code=500, content={"ok": False, "detail": f"Error al actualizar título: {str(err)}"})


@app.post("/api/admin/eventos/{evento_id}/auto-aprobar")
def configurar_auto_aprobar_fotos(
    evento_id: str,
    datos: AutoAprobarInput,
    x_admin_password: str | None = Header(default=None),
):
    verificar_admin_password(x_admin_password)
    estado_ev = obtener_estado_evento(evento_id.strip())
    estado_ev["auto_aprobar_fotos"] = bool(datos.activo)
    _guardar_estado_eventos_disco()
    invalidar_cache_evento(evento_id)

    estado_txt = (
        "ACTIVADO (las fotos seguras se aprobarán automáticamente)"
        if datos.activo
        else "DESACTIVADO (las fotos nuevas quedarán en Pendientes)"
    )
    return {
        "ok": True,
        "auto_aprobar_fotos": bool(datos.activo),
        "mensaje": f"Modo Auto-Aprobar Fotos {estado_txt}.",
    }


@app.post("/api/admin/eventos/{evento_id}/aprobar-todas")
def aprobar_todas_las_fotos_pendientes(
    evento_id: str,
    x_admin_password: str | None = Header(default=None),
):
    verificar_admin_password(x_admin_password)
    eid = evento_id.strip()

    try:
        res = ejecutar_consulta_segura(
            lambda db: db.table("multimedia")
            .update({"estado_moderacion": "aprobado"})
            .eq("evento_id", eid)
            .eq("estado_moderacion", "pendiente")
            .execute()
        )
        aprobadas = res.data or []
        cantidad = len(aprobadas)
        invalidar_cache_evento(eid)

        if cantidad == 0:
            return {
                "ok": True,
                "cantidad_aprobadas": 0,
                "mensaje": "No había fotos pendientes por aprobar en la bandeja.",
            }

        return {
            "ok": True,
            "cantidad_aprobadas": cantidad,
            "mensaje": f"¡Aprobación masiva exitosa! Se aprobaron {cantidad} foto(s) en una sola consulta.",
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al aprobar masivamente las fotos en Supabase: {str(error)}",
        )


# ------------------------------------------------------------------------------
# 12. GESTIÓN DE PREGUNTAS, GENERADOR PDF CON IA Y CONTROLES EN VIVO DE TRIVIA
# ------------------------------------------------------------------------------
@app.post("/api/admin/preguntas")
def crear_pregunta_admin(
    datos: CrearPreguntaAdminInput,
    x_admin_password: str | None = Header(default=None),
):
    verificar_admin_password(x_admin_password)
    eid = datos.evento_id.strip()

    existentes = listar_preguntas_evento(eid)
    siguiente_orden = len(existentes) + 1

    nueva_pregunta = {
        "evento_id": eid,
        "enunciado": datos.enunciado.strip(),
        "opcion_a": datos.opcion_a.strip(),
        "opcion_b": datos.opcion_b.strip(),
        "opcion_c": datos.opcion_c.strip(),
        "opcion_d": datos.opcion_d.strip(),
        "respuesta_correcta": datos.respuesta_correcta.strip().upper(),
        "tiempo_limite_segundos": int(datos.tiempo_limite_segundos),
        "orden": siguiente_orden,
        "activa": False,
        "revelar_respuesta": False,
    }

    creada = insertar_pregunta_evento(nueva_pregunta)
    return {
        "ok": True,
        "mensaje": f"Pregunta #{siguiente_orden} agregada al banco del evento.",
        "pregunta": creada,
    }


@app.post("/api/admin/eventos/{evento_id}/generar-preguntas-pdf")
def generar_preguntas_desde_pdf_admin(
    evento_id: str,
    archivo_pdf: UploadFile = File(...),
    tiempo_limite_segundos: int = Form(default=20),
    x_admin_password: str | None = Header(default=None),
):
    """
    DIDÁCTICA (Fase 4.5 - Requerimiento F: Generador de 10 Preguntas desde PDF con IA):
    1. Lee el archivo PDF subido usando 'pypdf'.
    2. Si existe GEMINI_API_KEY en el archivo .env, usa el modelo configurado en
       GEMINI_MODEL ('gemini-3.5-flash-lite' por defecto) con response_mime_type='application/json'
       para extraer hasta 10 preguntas con su respuesta correcta e inventar 3 distractores
       muy cercanos/parecidos a la respuesta real.
    3. Si aún no se configuró GEMINI_API_KEY, usa el Extractor Inteligente Local
       con bancos semánticos (distritos, ciudades, años, cantidades, fechas).
    """
    verificar_admin_password(x_admin_password)
    eid = evento_id.strip()

    nombre_archivo = (archivo_pdf.filename or "").lower()
    if not nombre_archivo.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Por favor selecciona un archivo con extensión .PDF válido.",
        )

    pdf_bytes = None
    texto_extraido = None
    try:
        pdf_bytes = archivo_pdf.file.read()
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="El archivo PDF está vacío.")

        texto_extraido = extraer_texto_de_pdf(pdf_bytes)
        del pdf_bytes
        pdf_bytes = None
        if not texto_extraido or len(texto_extraido.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="No se encontró texto legible dentro del PDF (verifica que no sea una imagen escaneada sin texto).",
            )

        modelo_configurado = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip() or GEMINI_MODEL
        motor_utilizado = f"Google Gemini IA ({modelo_configurado})"
        preguntas_generadas = generar_preguntas_con_gemini_ia(texto_extraido, max_preguntas=10)

        if not preguntas_generadas:
            motor_utilizado = "Extractor Inteligente Local (Semántico)"
            preguntas_generadas = extraer_preguntas_pdf_modo_local(texto_extraido, max_preguntas=10)

        del texto_extraido
        texto_extraido = None

        if not preguntas_generadas:
            raise HTTPException(
                status_code=400,
                detail="No se pudieron estructurar preguntas desde el PDF proporcionado.",
            )

        existentes = listar_preguntas_evento(eid)
        base_orden = len(existentes)
        creadas = []

        for idx, q in enumerate(preguntas_generadas[:10]):
            nueva_q = {
                "evento_id": eid,
                "enunciado": q["enunciado"],
                "opcion_a": q["opcion_a"],
                "opcion_b": q["opcion_b"],
                "opcion_c": q["opcion_c"],
                "opcion_d": q["opcion_d"],
                "respuesta_correcta": q["respuesta_correcta"],
                "tiempo_limite_segundos": int(tiempo_limite_segundos or q.get("tiempo_limite_segundos") or 20),
                "orden": base_orden + idx + 1,
                "activa": False,
                "revelar_respuesta": False,
            }
            creadas.append(insertar_pregunta_evento(nueva_q))

        invalidar_cache_evento(eid)
        return {
            "ok": True,
            "motor_ia": motor_utilizado,
            "cantidad_generadas": len(creadas),
            "preguntas": creadas,
            "mensaje": f"¡Se generaron {len(creadas)} pregunta(s) desde tu PDF usando {motor_utilizado}!",
        }
    finally:
        try:
            archivo_pdf.file.close()
        except Exception:
            pass
        pdf_bytes = None
        texto_extraido = None
        liberar_memoria_os()


@app.post("/api/admin/eventos/{evento_id}/preguntas-ejemplo")
def cargar_preguntas_ejemplo_admin(
    evento_id: str,
    x_admin_password: str | None = Header(default=None),
):
    verificar_admin_password(x_admin_password)
    eid = evento_id.strip()
    existentes = listar_preguntas_evento(eid)
    base_orden = len(existentes)

    ejemplos = [
        {
            "evento_id": eid,
            "enunciado": "¿En qué distrito se encuentran las dos exclusivas sedes de Segalú Eventos?",
            "opcion_a": "Carabayllo (Av. Manuel Prado - KM 22)",
            "opcion_b": "Los Olivos",
            "opcion_c": "Comas",
            "opcion_d": "Puente Piedra",
            "respuesta_correcta": "A",
            "tiempo_limite_segundos": 20,
            "orden": base_orden + 1,
            "activa": False,
            "revelar_respuesta": False,
        },
        {
            "evento_id": eid,
            "enunciado": "¿Cuáles son los nombres oficiales de los 2 locales de Segalú?",
            "opcion_a": "Salón Imperial y Jardín Real",
            "opcion_b": "Sede 1 - El Colocho y Sede 2 - Crystal Garden",
            "opcion_c": "Palacio Dorado y Villa Cristal",
            "opcion_d": "Club Carabayllo y Hacienda Gala",
            "respuesta_correcta": "B",
            "tiempo_limite_segundos": 20,
            "orden": base_orden + 2,
            "activa": False,
            "revelar_respuesta": False,
        },
        {
            "evento_id": eid,
            "enunciado": "¿Cuál es la capacidad máxima de invitados en cada sede de Segalú?",
            "opcion_a": "200 personas",
            "opcion_b": "250 personas",
            "opcion_c": "300 personas cómodamente instaladas",
            "opcion_d": "350 personas",
            "respuesta_correcta": "C",
            "tiempo_limite_segundos": 15,
            "orden": base_orden + 3,
            "activa": False,
            "revelar_respuesta": False,
        },
    ]

    creadas = [insertar_pregunta_evento(ej) for ej in ejemplos]
    invalidar_cache_evento(eid)
    return {
        "ok": True,
        "mensaje": "¡Se cargaron 3 preguntas de demostración listas para lanzar en vivo!",
        "preguntas": creadas,
    }


@app.delete("/api/admin/preguntas/{pregunta_id}")
def eliminar_pregunta_admin(
    pregunta_id: str,
    x_admin_password: str | None = Header(default=None),
):
    verificar_admin_password(x_admin_password)
    eliminar_pregunta_por_id(pregunta_id)
    return {
        "ok": True,
        "mensaje": "Pregunta eliminada del evento.",
    }


@app.patch("/api/admin/preguntas/{pregunta_id}")
def editar_pregunta_admin(
    pregunta_id: str,
    datos: EditarPreguntaAdminInput,
    x_admin_password: str | None = Header(default=None),
):
    try:
        verificar_admin_password(x_admin_password)
        pid = pregunta_id.strip()

        campos_update = {}
        if datos.enunciado is not None and datos.enunciado.strip():
            campos_update["enunciado"] = datos.enunciado.strip()
        if datos.opcion_a is not None and datos.opcion_a.strip():
            campos_update["opcion_a"] = datos.opcion_a.strip()
        if datos.opcion_b is not None and datos.opcion_b.strip():
            campos_update["opcion_b"] = datos.opcion_b.strip()
        if datos.opcion_c is not None and datos.opcion_c.strip():
            campos_update["opcion_c"] = datos.opcion_c.strip()
        if datos.opcion_d is not None and datos.opcion_d.strip():
            campos_update["opcion_d"] = datos.opcion_d.strip()
        if datos.respuesta_correcta is not None and datos.respuesta_correcta.strip():
            campos_update["respuesta_correcta"] = datos.respuesta_correcta.strip().upper()
        if datos.tiempo_limite_segundos is not None:
            campos_update["tiempo_limite_segundos"] = int(datos.tiempo_limite_segundos)

        if not campos_update:
            return JSONResponse(status_code=400, content={"ok": False, "detail": "No se enviaron campos válidos para editar."})

        # Actualizar en la tabla oficial de Supabase 'preguntas'
        try:
            ejecutar_consulta_segura(
                lambda db: db.table("preguntas").update(campos_update).eq("id", pid).execute()
            )
        except Exception as err:
            print(f"Aviso actualizando pregunta en Supabase ('preguntas'): {err}")

        # Sincronizar en la memoria local
        evento_id_afectado = None
        with ESTADOS_EVENTOS_LOCK:
            for eid, estado_ev in _ESTADO_EVENTOS.items():
                if not isinstance(estado_ev, dict):
                    continue
                for q in estado_ev.get("preguntas_fallback", []):
                    if q.get("id") == pid:
                        q.update(campos_update)
                        evento_id_afectado = eid
                        break

        if evento_id_afectado:
            invalidar_cache_evento(evento_id_afectado)

        return JSONResponse(
            status_code=200,
            content={
                "ok": True,
                "mensaje": "✅ Pregunta actualizada correctamente en la base de datos.",
                "pregunta_id": pid,
                "campos": campos_update,
            }
        )
    except HTTPException as he:
        return JSONResponse(status_code=he.status_code, content={"ok": False, "detail": he.detail})
    except Exception as err:
        return JSONResponse(status_code=500, content={"ok": False, "detail": f"Error interno al editar pregunta: {str(err)}"})


@app.patch("/api/admin/invitados/{invitado_id}/renombrar")
def renombrar_invitado_admin(
    invitado_id: str,
    datos: RenombrarInvitadoInput,
    x_admin_password: str | None = Header(default=None),
):
    try:
        verificar_admin_password(x_admin_password)
        iid = invitado_id.strip()
        nuevo_nombre = ((datos.nuevo_nombre or datos.nombre) or "").strip()
        if len(nuevo_nombre) < 2:
            return JSONResponse(status_code=400, content={"ok": False, "detail": "El nombre debe tener al menos 2 caracteres."})

        try:
            ejecutar_consulta_segura(
                lambda db: db.table("invitados").update({"nombre": nuevo_nombre}).eq("id", iid).execute()
            )
        except Exception as err:
            print(f"Aviso actualizando nombre de invitado en Supabase: {err}")

        with ESTADOS_EVENTOS_LOCK:
            for eid, estado_ev in _ESTADO_EVENTOS.items():
                if not isinstance(estado_ev, dict):
                    continue
                for inv in estado_ev.get("invitados_fallback", []):
                    if inv.get("id") == iid:
                        inv["nombre"] = nuevo_nombre
                        invalidar_cache_evento(eid)
                        break

        return JSONResponse(
            status_code=200,
            content={
                "ok": True,
                "mensaje": f"Invitado renombrado exitosamente a '{nuevo_nombre}'.",
                "invitado_id": iid,
                "nombre": nuevo_nombre,
            }
        )
    except HTTPException as he:
        return JSONResponse(status_code=he.status_code, content={"ok": False, "detail": he.detail})
    except Exception as err:
        return JSONResponse(status_code=500, content={"ok": False, "detail": f"Error interno al renombrar invitado: {str(err)}"})


# ------------------------------------------------------------------------------
# 11. GESTOR DE PAQUETES DE ACCESORIOS PERSONALIZADOS (PERSISTENCIA SUPABASE STORAGE & CACHÉ RAM)
# ------------------------------------------------------------------------------
CATALOGO_STORAGE_PATH = "accesorios/paquetes_catalogo.json"
CATALOGO_PERSONALIZADOS_STORAGE_PATH = "accesorios/accesorios_personalizados.json"
CATALOGO_LOCAL_PATH = Path(__file__).parent.parent / "frontend" / "static" / "accessories" / "paquetes_catalogo.json"
PERSONALIZADOS_LOCAL_PATH = Path(__file__).parent.parent / "frontend" / "static" / "accessories" / "accesorios_personalizados.json"

DEFAULT_CATALOGO_PAQUETES = {
    "paquete_15_anos": {
        "id": "paquete_15_anos",
        "nombre": "15 Años",
        "scope": "global",
        "evento_id": None,
        "icono": "👑",
        "descripcion": "Coronas, Tiara XV, Flores y Antifaces de Gala",
        "accesorios": [
            {
                "id": "tiara_xv",
                "nombre": "Tiara XV Años",
                "subtitulo": "Princesa",
                "icono": "👑",
                "archivo": "tiara_xv.png",
                "tematica": "quinceanero",
                "url": "/static/accessories/quinceanero/tiara_xv.png",
            },
            {
                "id": "corona_flores",
                "nombre": "Corona de Flores",
                "subtitulo": "Primavera",
                "icono": "🌸",
                "archivo": "corona_flores.png",
                "tematica": "quinceanero",
                "url": "/static/accessories/quinceanero/corona_flores.png",
            },
            {
                "id": "antifaz_15",
                "nombre": "Antifaz Veneciano",
                "subtitulo": "Gala XV",
                "icono": "🎭",
                "archivo": "antifaz_15.png",
                "tematica": "quinceanero",
                "url": "/static/accessories/quinceanero/antifaz_15.png",
            },
        ],
    },
    "paquete_boda": {
        "id": "paquete_boda",
        "nombre": "Gala & Bodas",
        "scope": "global",
        "evento_id": None,
        "icono": "🎩",
        "descripcion": "Coronas Reales, Corbatines y Sombreros de Gala",
        "accesorios": [
            {
                "id": "corona_imperial",
                "nombre": "Corona Imperial",
                "subtitulo": "Oro Real",
                "icono": "👑",
                "archivo": "corona_imperial.png",
                "tematica": "boda",
                "url": "/static/accessories/boda/corona_imperial.png",
            },
            {
                "id": "corbatin_gala",
                "nombre": "Corbatín de Gala",
                "subtitulo": "Smoking VIP",
                "icono": "👔",
                "archivo": "corbatin_gala.png",
                "tematica": "boda",
                "url": "/static/accessories/boda/corbatin_gala.png",
            },
            {
                "id": "sombrero_gala",
                "nombre": "Sombrero de Gala",
                "subtitulo": "Clásico",
                "icono": "🎩",
                "archivo": "sombrero_gala.png",
                "tematica": "boda",
                "url": "/static/accessories/boda/sombrero_gala.png",
            },
        ],
    },
    "paquete_princesas_disney": {
        "id": "paquete_princesas_disney",
        "nombre": "Princesas Disney",
        "scope": "global",
        "evento_id": None,
        "icono": "👸",
        "descripcion": "Tiaras mágicas y accesorios de fantasía",
        "accesorios": [],
    },
    "paquete_graduacion": {
        "id": "paquete_graduacion",
        "nombre": "Graduación",
        "scope": "global",
        "evento_id": None,
        "icono": "🎓",
        "descripcion": "Birretes académicos y medallas de honor",
        "accesorios": [
            {
                "id": "birrete",
                "nombre": "Birrete de Gala",
                "subtitulo": "Académico",
                "icono": "🎓",
                "archivo": "birrete.png",
                "tematica": "graduacion",
                "url": "/static/accessories/graduacion/birrete.png",
            },
        ],
    },
    "paquete_general": {
        "id": "paquete_general",
        "nombre": "Fiesta VIP",
        "scope": "global",
        "evento_id": None,
        "icono": "🕶️",
        "descripcion": "Lentes VIP, gorras y accesorios de hora loca",
        "accesorios": [
            {
                "id": "lentes_vip",
                "nombre": "Lentes VIP",
                "subtitulo": "Glamour",
                "icono": "🕶️",
                "archivo": "lentes_vip.png",
                "tematica": "general",
                "url": "/static/accessories/general/lentes_vip.png",
            },
            {
                "id": "gorra_vip",
                "nombre": "Gorra Fiesta",
                "subtitulo": "Hora Loca",
                "icono": "🧢",
                "archivo": "gorra_vip.png",
                "tematica": "general",
                "url": "/static/accessories/general/gorra_vip.png",
            },
        ],
    },
}


def obtener_catalogo_paquetes_completo() -> dict[str, dict]:
    """
    Carga el catálogo de paquetes de accesorios unificado:
    1. Intenta descargar desde Supabase Storage (accesorios/paquetes_catalogo.json).
    2. Si falla o no existe, lee el archivo local frontend/static/accessories/paquetes_catalogo.json.
    3. Si no existe, inicializa con DEFAULT_CATALOGO_PAQUETES y asegura persistencia.
    """
    catalogo = None
    # 1. Intentar descargar desde Supabase Storage
    try:
        db = verificar_conexion_supabase()
        raw_bytes = db.storage.from_(SUPABASE_BUCKET).download(CATALOGO_STORAGE_PATH)
        if raw_bytes:
            catalogo = json.loads(raw_bytes.decode("utf-8"))
    except Exception:
        pass

    # 2. Fallback de lectura desde disco local
    if not isinstance(catalogo, dict) and CATALOGO_LOCAL_PATH.exists():
        try:
            catalogo = json.loads(CATALOGO_LOCAL_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass

    # 3. Inicializar con catálogo predeterminado si aún no existe
    if not isinstance(catalogo, dict):
        catalogo = copy.deepcopy(DEFAULT_CATALOGO_PAQUETES)

    # 4. Asegurar que los paquetes base siempre existan en el catálogo
    for pkg_id, pkg_base in DEFAULT_CATALOGO_PAQUETES.items():
        if pkg_id not in catalogo:
            catalogo[pkg_id] = copy.deepcopy(pkg_base)
        else:
            catalogo[pkg_id].setdefault("id", pkg_id)
            catalogo[pkg_id].setdefault("nombre", pkg_base.get("nombre", pkg_id))
            catalogo[pkg_id].setdefault("scope", pkg_base.get("scope", "global"))
            catalogo[pkg_id].setdefault("evento_id", None)
            catalogo[pkg_id].setdefault("icono", pkg_base.get("icono", "✨"))
            catalogo[pkg_id].setdefault("descripcion", pkg_base.get("descripcion", ""))
            catalogo[pkg_id].setdefault("accesorios", [])

    return catalogo


def guardar_catalogo_paquetes(catalogo: dict[str, dict]):
    """
    Persiste el catálogo en disco local y en Supabase Storage,
    mantiene sincronizado accesorios_personalizados.json para retrocompatibilidad
    e invalida instantáneamente la memoria caché en RAM.
    """
    CATALOGO_LOCAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    json_str = json.dumps(catalogo, ensure_ascii=False, indent=2)
    json_bytes = json_str.encode("utf-8")

    # 1. Guardar localmente el catálogo de paquetes
    try:
        CATALOGO_LOCAL_PATH.write_text(json_str, encoding="utf-8")
    except Exception as err:
        print(f"Aviso al guardar catálogo local: {err}")

    # 2. Generar lista aplanada para retrocompatibilidad
    lista_personalizados = []
    for pkg_id, pkg in catalogo.items():
        for acc in pkg.get("accesorios", []):
            item = dict(acc)
            item["paquete_id"] = pkg_id
            item["scope"] = pkg.get("scope", "global")
            item["evento_id"] = pkg.get("evento_id")
            lista_personalizados.append(item)

    json_pers_str = json.dumps(lista_personalizados, ensure_ascii=False, indent=2)
    try:
        PERSONALIZADOS_LOCAL_PATH.write_text(json_pers_str, encoding="utf-8")
    except Exception as err:
        print(f"Aviso al guardar accesorios personalizados local: {err}")

    # 3. Subir a Supabase Storage con upsert=True y cache_control=86400
    try:
        db = verificar_conexion_supabase()
        db.storage.from_(SUPABASE_BUCKET).upload(
            path=CATALOGO_STORAGE_PATH,
            file=json_bytes,
            file_options={
                "content-type": "application/json",
                "upsert": "true",
                "cache-control": "86400",
            },
        )
        db.storage.from_(SUPABASE_BUCKET).upload(
            path=CATALOGO_PERSONALIZADOS_STORAGE_PATH,
            file=json_pers_str.encode("utf-8"),
            file_options={
                "content-type": "application/json",
                "upsert": "true",
                "cache-control": "86400",
            },
        )
    except Exception as err:
        print(f"Aviso Supabase Storage al subir catálogo: {err}")

    # 4. Invalidar RAM caché al instante
    _CACHE_RAM_SISTEMA.pop("catalogo_accesorios", None)
    invalidar_cache_evento()


@app.post("/api/admin/accesorios/paquetes/subir")
async def subir_paquete_accesorios_admin(
    modo_destino: str = Form("existente"),
    nombre_paquete: str = Form(""),
    paquete_id: str = Form(""),
    scope: str = Form("global"),
    evento_id: str | None = Form(None),
    nombres_json: str = Form("[]"),
    archivos: list[UploadFile] = File(default=[]),
    archivo: UploadFile = File(default=None),
    x_admin_password: str | None = Header(default=None),
):
    """
    Subida múltiple de accesorios en formato PNG transparente:
    - Redimensiona automáticamente a 256x256 px con PIL LANCZOS.
    - Sube a Supabase Storage (multimedia_segalu/accesorios/{paquete_id}/{filename}) con cache_control="86400".
    - Respalda en disco local.
    - Asigna alcance global (Permanente) o por evento (Temporal).
    - Actualiza el catálogo en Supabase Storage e invalida la caché en RAM (2.0s).
    """
    verificar_admin_password(x_admin_password)

    # 1. Agrupar archivos enviados (soporte para lista múltiple o archivo único)
    todos_archivos = [f for f in archivos if f and f.filename]
    if archivo and archivo.filename:
        todos_archivos.append(archivo)

    if not todos_archivos:
        return JSONResponse(status_code=400, content={"ok": False, "detail": "Debes seleccionar al menos un archivo PNG transparente."})

    # 2. Cargar catálogo actual
    catalogo = obtener_catalogo_paquetes_completo()

    # 3. Resolver paquete de destino
    modo_limpio = modo_destino.strip().lower()
    scope_limpio = "evento" if scope.strip().lower() == "evento" else "global"
    evento_id_limpio = (evento_id or "").strip() or None

    if modo_limpio == "crear":
        nom_pkg = nombre_paquete.strip()
        if not nom_pkg:
            return JSONResponse(status_code=400, content={"ok": False, "detail": "Por favor ingresa un nombre para el nuevo paquete."})

        slug = re.sub(r"[^a-z0-9_]+", "_", nom_pkg.lower()).strip("_")
        target_pkg_id = f"paquete_{slug}" if not slug.startswith("paquete_") else slug

        # Si ya existe con el mismo ID, agregamos sufijo único
        if target_pkg_id in catalogo and catalogo[target_pkg_id].get("nombre") != nom_pkg:
            target_pkg_id = f"{target_pkg_id}_{int(time.time())}"

        if target_pkg_id not in catalogo:
            catalogo[target_pkg_id] = {
                "id": target_pkg_id,
                "nombre": nom_pkg,
                "scope": scope_limpio,
                "evento_id": evento_id_limpio if scope_limpio == "evento" else None,
                "icono": "✨",
                "descripcion": f"Paquete personalizado '{nom_pkg}'",
                "accesorios": [],
            }
    else:
        # Modo existente: resolver ID
        mapa_alias = {
            "15anos": "paquete_15_anos",
            "15_anos": "paquete_15_anos",
            "quinceanero": "paquete_15_anos",
            "graduacion": "paquete_graduacion",
            "gala_boda": "paquete_boda",
            "gala_bodas": "paquete_boda",
            "boda": "paquete_boda",
            "fiesta_vip": "paquete_general",
            "vip": "paquete_general",
            "general": "paquete_general",
            "princesas_disney": "paquete_princesas_disney",
        }
        target_pkg_id = mapa_alias.get((paquete_id or "").strip().lower(), (paquete_id or "").strip().lower())
        if not target_pkg_id:
            target_pkg_id = "paquete_general"

        if target_pkg_id not in catalogo:
            nombre_auto = target_pkg_id.replace("paquete_", "").replace("_", " ").title()
            catalogo[target_pkg_id] = {
                "id": target_pkg_id,
                "nombre": nombre_auto,
                "scope": scope_limpio,
                "evento_id": evento_id_limpio if scope_limpio == "evento" else None,
                "icono": "✨",
                "descripcion": f"Paquete '{nombre_auto}'",
                "accesorios": [],
            }

    paquete_actual = catalogo[target_pkg_id]

    # 4. Parsear nombres personalizados proporcionados en el staging
    nombres_lista = []
    try:
        nombres_lista = json.loads(nombres_json) if nombres_json else []
    except Exception:
        nombres_lista = []

    dir_destino_local = Path(__file__).parent.parent / "frontend" / "static" / "accessories" / target_pkg_id
    dir_destino_local.mkdir(parents=True, exist_ok=True)

    db_sb = None
    try:
        db_sb = verificar_conexion_supabase()
    except Exception:
        db_sb = None

    accesorios_agregados = []

    # 5. Procesar cada archivo individualmente
    for idx, f in enumerate(todos_archivos):
        nombre_orig = f.filename or f"accesorio_{idx}.png"
        if not nombre_orig.lower().endswith(".png"):
            return JSONResponse(status_code=400, content={"ok": False, "detail": f"El archivo '{nombre_orig}' no tiene extensión .png."})

        # Nombre legible: desde staging o auto-generado desde el nombre del archivo
        nombre_accesorio = ""
        if idx < len(nombres_lista) and str(nombres_lista[idx]).strip():
            nombre_accesorio = str(nombres_lista[idx]).strip()
        else:
            base_sin_ext = re.sub(r"\.png$", "", nombre_orig, flags=re.IGNORECASE)
            base_limpia = re.sub(r"[_\-]+", " ", base_sin_ext).strip()
            nombre_accesorio = base_limpia.title() or f"Accesorio {idx+1}"

        # Generar ID único
        slug_acc = re.sub(r"[^a-z0-9_]+", "_", nombre_accesorio.lower()).strip("_")
        acc_id = f"acc_{slug_acc}_{int(time.time())}_{idx}"[:50]
        nombre_archivo_final = f"{acc_id}.png"

        # Leer contenido en bytes
        bytes_img = await f.read()

        # Optimizar / Redimensionar a 256x256 px PNG con PIL LANCZOS
        img = None
        buf = None
        bio = None
        try:
            bio = io.BytesIO(bytes_img)
            img = Image.open(bio)
            if img.format != "PNG":
                return JSONResponse(status_code=400, content={"ok": False, "detail": f"El archivo '{nombre_orig}' no contiene una imagen PNG válida."})
            if img.size != (256, 256):
                img = img.resize((256, 256), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            png_bytes = buf.getvalue()
        except Exception:
            png_bytes = bytes_img
        finally:
            if img is not None:
                try:
                    img.close()
                except Exception:
                    pass
            if buf is not None:
                try:
                    buf.close()
                except Exception:
                    pass
            if bio is not None:
                try:
                    bio.close()
                except Exception:
                    pass
            del bytes_img

        # Guardar copia local de respaldo
        ruta_guardado_local = dir_destino_local / nombre_archivo_final
        with open(ruta_guardado_local, "wb") as f_out:
            f_out.write(png_bytes)

        # Subir al bucket de Supabase Storage (multimedia_segalu/accesorios/{paquete_id}/{filename})
        ruta_storage = f"accesorios/{target_pkg_id}/{nombre_archivo_final}"
        url_final = f"/static/accessories/{target_pkg_id}/{nombre_archivo_final}"

        if db_sb:
            try:
                db_sb.storage.from_(SUPABASE_BUCKET).upload(
                    path=ruta_storage,
                    file=png_bytes,
                    file_options={
                        "content-type": "image/png",
                        "upsert": "true",
                        "cache-control": "86400",
                    },
                )
                url_sb = db_sb.storage.from_(SUPABASE_BUCKET).get_public_url(ruta_storage)
                if url_sb:
                    url_final = url_sb
            except Exception as sb_err:
                print(f"Aviso al subir accesorio a Supabase Storage ({ruta_storage}): {sb_err}")

        item_acc = {
            "id": acc_id,
            "nombre": nombre_accesorio,
            "subtitulo": "Personalizado",
            "icono": "✨",
            "archivo": nombre_archivo_final,
            "tematica": target_pkg_id,
            "url": url_final,
        }

        # Evitar duplicados por ID
        paquete_actual["accesorios"] = [a for a in paquete_actual.get("accesorios", []) if a.get("id") != acc_id]
        paquete_actual["accesorios"].append(item_acc)
        accesorios_agregados.append(item_acc)

    # 6. Guardar catálogo actualizado en Storage y disco local
    guardar_catalogo_paquetes(catalogo)
    liberar_memoria_os()

    return {
        "ok": True,
        "mensaje": f"✅ Se subieron {len(accesorios_agregados)} accesorio(s) al paquete '{paquete_actual.get('nombre', target_pkg_id)}'.",
        "paquete_id": target_pkg_id,
        "paquete": paquete_actual,
        "accesorios_agregados": accesorios_agregados,
        "catalogo": catalogo,
    }


@app.post("/api/admin/accesorios/subir")
async def subir_accesorio_png_admin(
    archivo: UploadFile = File(None),
    archivo_png: UploadFile = File(None),
    tematica: str = Form("general"),
    nombre: str = Form(""),
    id_accesorio: str | None = Form(None),
    icono: str = Form(default="✨"),
    subtitulo: str = Form(default="Personalizado"),
    x_admin_password: str | None = Header(default=None),
):
    """Endpoint de compatibilidad con subidas anteriores: delega al gestor de paquetes."""
    file_obj = archivo or archivo_png
    archivos_list = [file_obj] if file_obj else []
    nombres_list = [nombre] if nombre else []
    return await subir_paquete_accesorios_admin(
        modo_destino="existente",
        paquete_id=tematica,
        nombres_json=json.dumps(nombres_list),
        archivos=archivos_list,
        x_admin_password=x_admin_password,
    )


@app.get("/api/accesorios")
def obtener_catalogo_accesorios():
    """
    Retorna el catálogo completo de paquetes y la lista unificada de accesorios
    con una caché en memoria RAM de 2.0 segundos para máxima velocidad y 0 consultas repetidas.
    """
    cache_hit = obtener_cache_ram("catalogo_accesorios")
    if cache_hit:
        return cache_hit

    catalogo = obtener_catalogo_paquetes_completo()
    lista_personalizados = []
    for pkg_id, pkg in catalogo.items():
        for acc in pkg.get("accesorios", []):
            item = dict(acc)
            item["paquete_id"] = pkg_id
            item["scope"] = pkg.get("scope", "global")
            item["evento_id"] = pkg.get("evento_id")
            lista_personalizados.append(item)

    resultado = {
        "ok": True,
        "paquetes": catalogo,
        "personalizados": lista_personalizados,
    }
    guardar_cache_ram("catalogo_accesorios", resultado)
    return resultado


@app.delete("/api/admin/accesorios/paquetes/{paquete_id}")
def eliminar_paquete_accesorios_admin(
    paquete_id: str,
    x_admin_password: str | None = Header(default=None),
):
    """
    Elimina por completo un paquete de accesorios personalizado:
    - Borra físicamente sus archivos de Supabase Storage y disco local.
    - Elimina la entrada del catálogo (o limpia accesorios si es un paquete base).
    - Invalida la caché en RAM al instante.
    """
    verificar_admin_password(x_admin_password)
    pkg_id = paquete_id.strip()
    catalogo = obtener_catalogo_paquetes_completo()

    if pkg_id not in catalogo:
        raise HTTPException(status_code=404, detail="El paquete de accesorios no existe.")

    pkg = catalogo[pkg_id]
    nombre_pkg = pkg.get("nombre", pkg_id)

    # 1. Eliminar archivos de Supabase Storage
    try:
        db = verificar_conexion_supabase()
        rutas_storage = [f"accesorios/{pkg_id}/{acc['archivo']}" for acc in pkg.get("accesorios", []) if acc.get("archivo")]
        if rutas_storage:
            db.storage.from_(SUPABASE_BUCKET).remove(rutas_storage)
    except Exception as err:
        print(f"Aviso al purgar accesorios de Supabase Storage: {err}")

    # 2. Borrar carpeta local si existe
    dir_local = Path(__file__).parent.parent / "frontend" / "static" / "accessories" / pkg_id
    if dir_local.exists() and dir_local.is_dir():
        import shutil
        shutil.rmtree(dir_local, ignore_errors=True)

    # 3. Remover del catálogo (o vaciar si es base)
    if pkg_id in DEFAULT_CATALOGO_PAQUETES:
        catalogo[pkg_id]["accesorios"] = []
    else:
        del catalogo[pkg_id]

    guardar_catalogo_paquetes(catalogo)
    liberar_memoria_os()

    return {
        "ok": True,
        "mensaje": f"🗑️ El paquete '{nombre_pkg}' y sus accesorios fueron eliminados con éxito.",
        "paquete_id": pkg_id,
        "catalogo": catalogo,
    }


@app.delete("/api/admin/accesorios/paquetes/{paquete_id}/items/{accesorio_id}")
def eliminar_accesorio_individual_admin(
    paquete_id: str,
    accesorio_id: str,
    x_admin_password: str | None = Header(default=None),
):
    """
    Elimina un accesorio individual dentro de un paquete:
    - Borra su archivo PNG de Supabase Storage y disco local.
    - Lo quita de la lista de accesorios del paquete.
    - Invalida la caché en RAM al instante.
    """
    verificar_admin_password(x_admin_password)
    pkg_id = paquete_id.strip()
    acc_id = accesorio_id.strip()

    catalogo = obtener_catalogo_paquetes_completo()
    if pkg_id not in catalogo:
        raise HTTPException(status_code=404, detail="El paquete indicado no existe.")

    pkg = catalogo[pkg_id]
    item_encontrado = None
    nuevos_accesorios = []

    for acc in pkg.get("accesorios", []):
        if acc.get("id") == acc_id:
            item_encontrado = acc
        else:
            nuevos_accesorios.append(acc)

    if not item_encontrado:
        raise HTTPException(status_code=404, detail="El accesorio no se encontró en este paquete.")

    # 1. Purgar archivo de Supabase Storage
    if item_encontrado.get("archivo"):
        nombre_arch = item_encontrado["archivo"]
        try:
            db = verificar_conexion_supabase()
            db.storage.from_(SUPABASE_BUCKET).remove([f"accesorios/{pkg_id}/{nombre_arch}"])
        except Exception as sb_err:
            print(f"Aviso al purgar accesorio de Supabase Storage: {sb_err}")

        ruta_local = Path(__file__).parent.parent / "frontend" / "static" / "accessories" / pkg_id / nombre_arch
        if ruta_local.exists():
            ruta_local.unlink(missing_ok=True)

    pkg["accesorios"] = nuevos_accesorios
    guardar_catalogo_paquetes(catalogo)
    liberar_memoria_os()

    return {
        "ok": True,
        "mensaje": f"🗑️ Accesorio '{item_encontrado.get('nombre', acc_id)}' eliminado del paquete '{pkg.get('nombre', pkg_id)}'.",
        "paquete_id": pkg_id,
        "accesorio_id": acc_id,
        "catalogo": catalogo,
    }


@app.delete("/api/admin/eventos/{evento_id}/preguntas")
def vaciar_preguntas_evento_admin(
    evento_id: str,
    x_admin_password: str | None = Header(default=None),
):
    """
    Vacía de forma rápida y limpia todas las preguntas del banco del evento,
    eliminando las respuestas asociadas y limpiando la memoria caché.
    """
    verificar_admin_password(x_admin_password)
    eid = evento_id.strip()

    # 1. Eliminar respuestas_trivia asociadas a las preguntas del evento
    preguntas_ev = listar_preguntas_evento(eid)
    for p in preguntas_ev:
        pid = p.get("id")
        if pid:
            try:
                ejecutar_consulta_segura(
                    lambda db, _pid=pid: db.table("respuestas_trivia")
                    .delete()
                    .eq("pregunta_id", _pid)
                    .execute()
                )
            except Exception:
                pass

    # 2. Eliminar todas las preguntas del evento de la tabla SQL
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("preguntas").delete().eq("evento_id", eid).execute()
        )
    except Exception:
        pass

    # 3. Limpiar estado en memoria RAM y disco
    estado_ev = obtener_estado_evento(eid)
    estado_ev["preguntas_fallback"] = []
    estado_ev["pregunta_activa_id"] = None
    estado_ev["respuestas_fallback"] = []
    _guardar_estado_eventos_disco()
    invalidar_cache_evento(eid)
    liberar_memoria_os()

    return {
        "ok": True,
        "preguntas_eliminadas": len(preguntas_ev),
        "mensaje": "🗑️ Se eliminaron todas las preguntas del banco de este evento.",
    }


@app.post("/api/admin/eventos/{evento_id}/trivia/control")
def controlar_trivia_en_vivo(
    evento_id: str,
    datos: ControlTriviaInput,
    x_admin_password: str | None = Header(default=None),
):
    verificar_admin_password(x_admin_password)
    eid = evento_id.strip()
    fijar_evento_proyector(eid)
    accion = datos.accion
    estado_ev = obtener_estado_evento(eid)
    preguntas = listar_preguntas_evento(eid)
    invalidar_cache_evento(eid)

    if accion == "abrir_lobby":
        try:
            ejecutar_consulta_segura(
                lambda db: db.table("eventos")
                .update({"trivia_activa": True})
                .eq("id", eid)
                .execute()
            )
        except Exception:
            pass

        estado_ev["fase_trivia"] = "lobby"
        estado_ev["pregunta_activa_id"] = None
        estado_ev["timestamp_lanzamiento"] = 0.0
        actualizar_flags_preguntas_evento(eid, None, False)
        return {
            "ok": True,
            "fase": "lobby",
            "mensaje": "Lobby de Trivia ABIERTO. El botón en los celulares cambió automáticamente a '🔥 ¡Trivia en Vivo Ahora!'.",
        }

    if accion == "lanzar_pregunta":
        if not preguntas:
            raise HTTPException(
                status_code=400,
                detail="Primero crea o genera desde un PDF al menos una pregunta antes de lanzar la ronda.",
            )

        pregunta_elegida = None
        if datos.pregunta_id:
            pregunta_elegida = next(
                (p for p in preguntas if p["id"] == datos.pregunta_id.strip()),
                None,
            )

        if not pregunta_elegida:
            actual_id = estado_ev.get("pregunta_activa_id")
            if actual_id:
                indices = [i for i, p in enumerate(preguntas) if p["id"] == actual_id]
                if indices and (indices[0] + 1) < len(preguntas):
                    pregunta_elegida = preguntas[indices[0] + 1]
            if not pregunta_elegida:
                pregunta_elegida = preguntas[0]

        try:
            ejecutar_consulta_segura(
                lambda db: db.table("eventos")
                .update({"trivia_activa": True})
                .eq("id", eid)
                .execute()
            )
        except Exception:
            pass

        # Guardar snapshot de posiciones previas para calcular deltas de ranking
        try:
            lista_inv_previa, _, _ = obtener_ranking_evento(eid, None)
            estado_ev["posiciones_previas"] = {
                inv["id"]: idx + 1 for idx, inv in enumerate(lista_inv_previa)
            }
        except Exception:
            estado_ev["posiciones_previas"] = {}

        estado_ev["fase_trivia"] = "pregunta_activa"
        estado_ev["pregunta_activa_id"] = pregunta_elegida["id"]
        estado_ev["timestamp_lanzamiento"] = time.time()
        actualizar_flags_preguntas_evento(eid, pregunta_elegida["id"], False)

        return {
            "ok": True,
            "fase": "pregunta_activa",
            "pregunta_activa_id": pregunta_elegida["id"],
            "mensaje": f"¡Pregunta lanzada en vivo!: \"{pregunta_elegida['enunciado']}\"",
        }

    if accion == "revelar_respuesta":
        actual_id = datos.pregunta_id or estado_ev.get("pregunta_activa_id")
        if not actual_id and preguntas:
            actual_id = preguntas[0]["id"]

        if not actual_id:
            raise HTTPException(
                status_code=400,
                detail="No hay ninguna pregunta activa para revelar su respuesta.",
            )

        estado_ev["fase_trivia"] = "respuesta_revelada"
        estado_ev["pregunta_activa_id"] = actual_id
        actualizar_flags_preguntas_evento(eid, actual_id, True)

        return {
            "ok": True,
            "fase": "respuesta_revelada",
            "pregunta_activa_id": actual_id,
            "mensaje": "¡Tiempo cerrado y respuesta oficial revelada en todos los celulares!",
        }

    if accion == "mostrar_ranking":
        try:
            ejecutar_consulta_segura(
                lambda db: db.table("eventos")
                .update({"trivia_activa": True})
                .eq("id", eid)
                .execute()
            )
        except Exception:
            pass

        estado_ev["fase_trivia"] = "ranking"
        return {
            "ok": True,
            "fase": "ranking",
            "mensaje": "¡Tabla de Posiciones en vivo activada en el proyector!",
        }

    if accion == "mostrar_podio":
        try:
            ejecutar_consulta_segura(
                lambda db: db.table("eventos")
                .update({"trivia_activa": True})
                .eq("id", eid)
                .execute()
            )
        except Exception:
            pass

        estado_ev["fase_trivia"] = "podio"
        actualizar_flags_preguntas_evento(eid, None, False)
        return {
            "ok": True,
            "fase": "podio",
            "mensaje": "¡Espectáculo de Podio de 3 Tarimas activado con fuegos artificiales!",
        }

    if accion == "reiniciar_puntajes":
        try:
            ejecutar_consulta_segura(
                lambda db: db.table("invitados")
                .update({"puntaje_total": 0})
                .eq("evento_id", eid)
                .execute()
            )
            for p in preguntas:
                ejecutar_consulta_segura(
                    lambda db: db.table("respuestas_trivia")
                    .delete()
                    .eq("pregunta_id", p["id"])
                    .execute()
                )
        except Exception:
            pass

        estado_ev["respuestas_fallback"] = []
        estado_ev["posiciones_previas"] = {}
        estado_ev["fase_trivia"] = "lobby"
        estado_ev["pregunta_activa_id"] = None
        actualizar_flags_preguntas_evento(eid, None, False)
        invalidar_cache_evento(eid)
        return {
            "ok": True,
            "fase": "lobby",
            "mensaje": "Puntajes y respuestas reiniciados a 0. Listo para una nueva partida.",
        }

    # cerrar_trivia
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("eventos")
            .update({"trivia_activa": False})
            .eq("id", eid)
            .execute()
        )
    except Exception:
        pass

    estado_ev["fase_trivia"] = "inactiva"
    estado_ev["pregunta_activa_id"] = None
    estado_ev["timestamp_lanzamiento"] = 0.0
    actualizar_flags_preguntas_evento(eid, None, False)
    return {
        "ok": True,
        "fase": "inactiva",
        "mensaje": "Ronda de Preguntas finalizada. Los celulares volvieron a '⏳ En espera del Host'.",
    }


# ------------------------------------------------------------------------------
# 13. FASE 5: MOTOR EN VIVO DE LA PANTALLA GIGANTE DE PROYECCIÓN (1920x1080 OBS)
# ------------------------------------------------------------------------------


def resolver_evento_proyector(
    evento_id: str | None = None,
    codigo: str | None = None,
    sede: str | None = None,
    local_id: str | None = None,
) -> dict | None:
    """
    Resuelve automáticamente el evento que debe proyectarse en /proyector:
    1. Si se pasa ?evento_id=UUID, proyecta ese evento específico.
    2. Si se pasa ?codigo=SEGALU-2026 (y opcionalmente &sede=sede1 / &local_id=...), proyecta ese evento en la sede.
    3. Si se pasa ?sede=sede1 o ?local_id=UUID (ej. OBS en local específico), proyecta el evento activo de ese local.
    4. Fallback global al último evento activo seleccionado en /admin.
    """
    ahora = time.time()
    _limitar_y_purgar_diccionario_cache(_CACHE_META_EVENTOS_PROYECTOR, ttl_seg=4.0, max_llaves=_MAX_CACHE_RAM_ENTRADAS, ttl_max=4.0)
    lid_busqueda = local_id.strip() if local_id and local_id.strip() else ""
    if not lid_busqueda and sede:
        s_clean = sede.strip().lower()
        if _CACHE_LOCALES:
            idx = 0 if "1" in s_clean else 1
            if idx < len(_CACHE_LOCALES):
                lid_busqueda = _CACHE_LOCALES[idx]["id"]

    clave_busqueda = (
        f"cod:{codigo.strip().upper()}:lid:{lid_busqueda}"
        if codigo and codigo.strip()
        else f"id:{(evento_id or '').strip()}:lid:{lid_busqueda}"
    )

    if clave_busqueda in _CACHE_META_EVENTOS_PROYECTOR:
        item = _CACHE_META_EVENTOS_PROYECTOR[clave_busqueda]
        if (ahora - item["ts"]) <= 4.0:
            return item["evento"]

    try:
        ev = None
        # 1. Por ID directo
        if evento_id and evento_id.strip():
            res = ejecutar_consulta_segura(
                lambda db: db.table("eventos")
                .select("*, locales(nombre, direccion)")
                .eq("id", evento_id.strip())
                .limit(1)
                .execute()
            )
            if res.data:
                ev = res.data[0]

        # 2. Por Código (con filtro por sede si aplica)
        if not ev and codigo and codigo.strip():
            cod_limpio = re.sub(r"[^A-Z0-9\-]", "", codigo.strip().upper())
            def _q_cod(db):
                q = db.table("eventos").select("*, locales(nombre, direccion)").eq("codigo_acceso", cod_limpio)
                if lid_busqueda:
                    q = q.eq("local_id", lid_busqueda)
                return q.order("created_at", desc=True).limit(1).execute()
            res = ejecutar_consulta_segura(_q_cod)
            if res.data:
                ev = res.data[0]

        # 3. Por Sede específica (aislamiento de pantallas independientes por local)
        if not ev and lid_busqueda:
            eid_sede = (_ESTADO_EVENTOS.get("__proyector_por_sede__") or {}).get(lid_busqueda)
            if eid_sede:
                res = ejecutar_consulta_segura(
                    lambda db: db.table("eventos")
                    .select("*, locales(nombre, direccion)")
                    .eq("id", eid_sede)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    ev = res.data[0]

            if not ev:
                res = ejecutar_consulta_segura(
                    lambda db: db.table("eventos")
                    .select("*, locales(nombre, direccion)")
                    .eq("local_id", lid_busqueda)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    ev = res.data[0]

        # 4. Fallback global: último evento fijado en memoria o último activo
        if not ev:
            eid_candidato = str(_ESTADO_EVENTOS.get("__proyector_evento_id__") or "").strip()
            if eid_candidato:
                res = ejecutar_consulta_segura(
                    lambda db: db.table("eventos")
                    .select("*, locales(nombre, direccion)")
                    .eq("id", eid_candidato)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    ev = res.data[0]

        if not ev:
            res_ult = ejecutar_consulta_segura(
                lambda db: db.table("eventos")
                .select("*, locales(nombre, direccion)")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if res_ult.data:
                ev = res_ult.data[0]

        if ev:
            _CACHE_META_EVENTOS_PROYECTOR[clave_busqueda] = {"ts": ahora, "evento": ev}
            _CACHE_META_EVENTOS_PROYECTOR[f"id:{ev['id']}"] = {"ts": ahora, "evento": ev}
            _limitar_y_purgar_diccionario_cache(_CACHE_META_EVENTOS_PROYECTOR, ttl_seg=4.0, max_llaves=_MAX_CACHE_RAM_ENTRADAS, ttl_max=4.0)
        return ev
    except Exception as err:
        print(f"Aviso al resolver evento del proyector: {err}")
        return None


@app.get("/api/proyector/estado")
def obtener_estado_proyector_en_vivo(
    evento_id: str | None = None,
    codigo: str | None = None,
    sede: str | None = None,
    local_id: str | None = None,
):
    """
    DIDÁCTICA (Fase 5 - Pantalla Gigante de Proyección 1920x1080 para OBS Studio):
    Devuelve en una sola consulta ultrarrápida todo el espectáculo visual:
    - modo_proyector:
        * 'GALERIA'              -> Carrusel de fotos APROBADAS con Doble Capa Ambient Blur
        * 'LOBBY_KAHOOT'         -> Invitados uniéndose en vivo con sus avatares compuestos
        * 'PREGUNTA_ACTIVA'      -> Enunciado gigante, cronómetro, contador y 4 tarjetas Kahoot
        * 'RESULTADOS_PREGUNTA'  -> Check ✅ en la correcta + Gráfico de Barras (A, B, C, D)
        * 'RANKING'              -> Tabla de posiciones animada con flechas neutras
        * 'PODIO'                -> Gala secuencial 3° -> 2° -> 1° con explosiones
    """
    clave_cache = f"proyector_estado:{evento_id or ''}:{codigo or ''}:{sede or ''}:{local_id or ''}"
    cache_hit = obtener_cache_ram(clave_cache)
    if cache_hit:
        return cache_hit

    evento = resolver_evento_proyector(
        evento_id=evento_id, codigo=codigo, sede=sede, local_id=local_id
    )
    if not evento:
        return {
            "ok": False,
            "modo_proyector": "GALERIA",
            "mensaje": "No hay eventos activos registrados todavía.",
            "evento": None,
            "fotos_aprobadas": [],
            "invitados": [],
            "podio": [],
            "pregunta_activa": None,
        }

    eid = evento["id"]
    datos_dash = construir_dashboard_evento_rapido(eid, usar_cache=True)
    estado_ev = obtener_estado_evento(eid)
    fase = estado_ev.get("fase_trivia", "inactiva")

    # 1. Filtrar ESTRICTAMENTE las fotos con estado_moderacion == 'aprobado' y URL pública válida
    fotos_aprobadas = []
    for m in (datos_dash.get("multimedia") or []):
        if str(m.get("estado_moderacion") or "").lower() != "aprobado":
            continue
        url_valida = normalizar_url_multimedia_publica(
            m.get("url_con_marca") or m.get("url_original")
        )
        if not url_valida:
            continue
        item_foto = dict(m)
        item_foto["url_con_marca"] = url_valida
        item_foto["url_original"] = normalizar_url_multimedia_publica(m.get("url_original")) or url_valida
        fotos_aprobadas.append(item_foto)

    # 2. Lista de invitados generales, Top del Podio y filtro exclusivo de "Invitados en la Pista"
    invitados = datos_dash.get("invitados") or []
    invitados_ranking = sorted(
        invitados,
        key=lambda x: (-int(x.get("puntaje_total") or 0), str(x.get("created_at") or "")),
    )
    podio_top = invitados_ranking[:10]

    # Filtrar ÚNICAMENTE los invitados que han tocado "Jugar Ronda de Preguntas"
    # y están esperando dentro del Lobby de Trivia activo (pulso en los últimos 8 segundos)
    ahora_ts = time.time()
    jugadores_sala_ts = estado_ev.get("jugadores_sala_trivia_ts") or {}
    ids_en_sala_trivia = {
        iid
        for iid, ts in list(jugadores_sala_ts.items())
        if (ahora_ts - float(ts or 0)) <= 8.0
    }
    invitados_en_pista = [
        inv for inv in invitados_ranking if inv.get("id") in ids_en_sala_trivia
    ]

    # 3. Resolver pregunta activa y conteo de votos por alternativa (A, B, C, D)
    preguntas = datos_dash.get("preguntas") or []
    pregunta_activa_id = estado_ev.get("pregunta_activa_id")
    pregunta_actual = None
    if pregunta_activa_id:
        pregunta_actual = next((p for p in preguntas if p["id"] == pregunta_activa_id), None)
    if not pregunta_actual and preguntas:
        pregunta_actual = next((p for p in preguntas if p.get("activa")), None)

    datos_pregunta_proyector = None
    ronda_cerrada = False

    if pregunta_actual and fase in ("pregunta_activa", "respuesta_revelada"):
        limite_seg = int(pregunta_actual.get("tiempo_limite_segundos") or 20)
        ts_inicio = float(estado_ev.get("timestamp_lanzamiento") or 0.0)
        if ts_inicio > 0:
            transcurrido = max(0.0, time.time() - ts_inicio)
            segundos_restantes = max(0, int(round(limite_seg - transcurrido)))
        else:
            segundos_restantes = limite_seg

        BUFFER_GRACIA_SEGUNDOS = 3.0
        if (
            fase == "respuesta_revelada"
            or bool(pregunta_actual.get("revelar_respuesta"))
            or (ts_inicio > 0 and transcurrido >= (limite_seg + BUFFER_GRACIA_SEGUNDOS))
        ):
            ronda_cerrada = True
            segundos_restantes = 0

        respuestas_preg = listar_respuestas_pregunta(eid, pregunta_actual["id"])
        conteo_opciones = {"A": 0, "B": 0, "C": 0, "D": 0}
        for r in respuestas_preg:
            op = str(r.get("opcion_elegida") or "").strip().upper()
            if op in conteo_opciones:
                conteo_opciones[op] += 1

        datos_pregunta_proyector = {
            "id": pregunta_actual["id"],
            "orden": pregunta_actual.get("orden", 1),
            "total_preguntas": len(preguntas),
            "enunciado": pregunta_actual["enunciado"],
            "opcion_a": pregunta_actual["opcion_a"],
            "opcion_b": pregunta_actual["opcion_b"],
            "opcion_c": pregunta_actual["opcion_c"],
            "opcion_d": pregunta_actual["opcion_d"],
            "tiempo_limite_segundos": limite_seg,
            "segundos_restantes": segundos_restantes,
            "ronda_cerrada": ronda_cerrada,
            "respuesta_correcta": str(pregunta_actual.get("respuesta_correcta") or "A").strip().upper()
            if ronda_cerrada
            else None,
            "total_respuestas": len(respuestas_preg),
            "conteo_opciones": conteo_opciones,
        }

    # 4. Determinar el modo exacto de proyección para la pantalla 1920x1080
    if fase == "lobby":
        modo_proyector = "LOBBY_KAHOOT"
    elif fase in ("pregunta_activa", "respuesta_revelada") and datos_pregunta_proyector:
        modo_proyector = "RESULTADOS_PREGUNTA" if ronda_cerrada else "PREGUNTA_ACTIVA"
    elif fase == "ranking":
        modo_proyector = "RANKING"
    elif fase == "podio":
        modo_proyector = "PODIO"
    else:
        modo_proyector = "GALERIA"

    # Calcular ranking animado estilo Kahoot con indicador de subida/bajada neutro
    posiciones_previas = estado_ev.get("posiciones_previas") or {}
    ranking_con_delta = []
    for idx, inv in enumerate(invitados_ranking[:10]):
        pos_actual = idx + 1
        pos_prev = posiciones_previas.get(inv.get("id"))
        delta = (int(pos_prev) - pos_actual) if pos_prev is not None else 0
        ranking_con_delta.append({
            "id": inv.get("id"),
            "nombre": inv.get("nombre", "Invitado"),
            "avatar": inv.get("avatar", "pug_real|corona_imperial"),
            "puntaje_total": int(inv.get("puntaje_total") or 0),
            "posicion": pos_actual,
            "posicion_previa": pos_prev or pos_actual,
            "delta_posicion": delta,
        })

    datos_local = evento.get("locales") or {}

    ruta_catalogo = Path(__file__).parent.parent / "frontend" / "static" / "accessories" / "accesorios_personalizados.json"
    catalogo_personalizados = {}
    if ruta_catalogo.exists():
        try:
            items_cat = json.loads(ruta_catalogo.read_text(encoding="utf-8"))
            if isinstance(items_cat, list):
                for it in items_cat:
                    if isinstance(it, dict) and it.get("id"):
                        catalogo_personalizados[it["id"]] = it.get("url")
        except Exception:
            pass

    resultado_proyector = {
        "ok": True,
        "modo_proyector": modo_proyector,
        "fase_trivia": fase,
        "config_galeria": {
            "modo_galeria": estado_ev.get("modo_galeria", "ciclo_auto"),
            "duracion_foto_segundos": int(estado_ev.get("duracion_foto_segundos", 8)),
        },
        "evento": {
            "id": eid,
            "nombre": evento.get("nombre", "Gala Exclusiva Segalú"),
            "codigo_acceso": evento.get("codigo_acceso", "SEGALU-2026"),
            "fecha_evento": evento.get("fecha_evento"),
            "estado": evento.get("estado", "activo"),
            "sede_nombre": datos_local.get("nombre", "Sede Segalú Eventos"),
            "sede_direccion": datos_local.get("direccion", "Carabayllo, Lima"),
        },
        "fotos_aprobadas": fotos_aprobadas,
        "total_fotos_aprobadas": len(fotos_aprobadas),
        "invitados": invitados_en_pista,
        "invitados_en_pista": invitados_en_pista,
        "total_invitados": len(invitados_en_pista),
        "podio": podio_top,
        "ranking": ranking_con_delta,
        "pregunta_activa": datos_pregunta_proyector,
        "catalogo_accesorios": catalogo_personalizados,
    }
    guardar_cache_ram(clave_cache, resultado_proyector, evento_id=eid)
    return resultado_proyector


# ------------------------------------------------------------------------------
# 13.5. MÓDULO CRM DE LEADS & CUPONES PROMOCIONALES (SEGALÚ MARKETING)
# ------------------------------------------------------------------------------
def normalizar_fecha_nacimiento_iso(fecha_str: str) -> tuple[str, str]:
    """
    Retorna (fecha_iso, fecha_dmy)
    Garantiza que Supabase reciba 'YYYY-MM-DD' para su columna DATE
    y el frontend / Excel reciban 'DD/MM/YYYY'.
    """
    f = str(fecha_str or "").strip()
    if "/" in f:
        partes = f.split("/")
        if len(partes) == 3:
            try:
                d, m, y = int(partes[0]), int(partes[1]), int(partes[2])
                return f"{y:04d}-{m:02d}-{d:02d}", f"{d:02d}/{m:02d}/{y:04d}"
            except ValueError:
                pass
    elif "-" in f:
        partes = f.split("-")
        if len(partes) == 3:
            try:
                if len(partes[0]) == 4:
                    y, m, d = int(partes[0]), int(partes[1]), int(partes[2])
                    return f"{y:04d}-{m:02d}-{d:02d}", f"{d:02d}/{m:02d}/{y:04d}"
                else:
                    d, m, y = int(partes[0]), int(partes[1]), int(partes[2])
                    return f"{y:04d}-{m:02d}-{d:02d}", f"{d:02d}/{m:02d}/{y:04d}"
            except ValueError:
                pass
    return f, f


def calcular_edad_anios_meses_py(fecha_str: str) -> tuple[str, str]:
    """
    Calcula dinámicamente con la fecha actual los años y meses exactos.
    Retorna (fecha_formateada_dmy, edad_texto).
    """
    if not fecha_str:
        return "—", "—"
    f = str(fecha_str).strip()
    d, m, y = None, None, None
    if "/" in f:
        p = f.split("/")
        if len(p) == 3:
            try:
                d, m, y = int(p[0]), int(p[1]), int(p[2])
            except ValueError:
                pass
    elif "-" in f:
        p = f.split("-")
        if len(p) == 3:
            try:
                if len(p[0]) == 4:
                    y, m, d = int(p[0]), int(p[1]), int(p[2])
                else:
                    d, m, y = int(p[0]), int(p[1]), int(p[2])
            except ValueError:
                pass
    if not (d and m and y):
        return f, "—"

    fecha_dmy = f"{d:02d}/{m:02d}/{y:04d}"
    try:
        hoy = date.today()
        anios = hoy.year - y
        meses = hoy.month - m
        if hoy.day < d:
            meses -= 1
        if meses < 0:
            anios -= 1
            meses += 12
        if anios < 0:
            return fecha_dmy, "—"
        if anios == 0:
            texto_edad = f"{meses} meses" if meses != 1 else "1 mes"
        elif meses == 0:
            texto_edad = f"{anios} años" if anios != 1 else "1 año"
        else:
            texto_edad = f"{anios} años, {meses} meses"
        return fecha_dmy, texto_edad
    except Exception:
        return fecha_dmy, "—"


@app.post("/api/eventos/{evento_id}/leads")
def registrar_lead_evento(evento_id: str, datos: RegistroLeadInput):
    """
    Guarda el lead en la tabla 'crm_leads' de Supabase (con fallback en estado_eventos)
    y genera un código promocional único para el invitado. Invalida la caché del evento.
    Valida estrictamente que el teléfono tenga exactamente 9 dígitos numéricos.
    """
    eid = evento_id.strip()
    nombre_limpio = datos.nombre.strip()
    telefono_limpio = re.sub(r"\s+", "", datos.telefono.strip())
    fecha_nac = datos.fecha_nacimiento.strip()
    f_iso, f_dmy = normalizar_fecha_nacimiento_iso(fecha_nac)
    genero_limpio = (datos.genero or "No especificado").strip()
    if genero_limpio not in ["Femenino", "Masculino", "Otro", "No especificado"]:
        genero_limpio = "No especificado"
    correo_limpio = (datos.correo or "").strip() or None

    # Resolución de UUID del evento si se proporcionó un código de acceso
    eid_uuid = eid
    if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", eid, re.I):
        try:
            ev_check = ejecutar_consulta_segura(
                lambda db: db.table("eventos").select("id").eq("codigo_acceso", eid).limit(1).execute()
            )
            if ev_check and ev_check.data:
                eid_uuid = ev_check.data[0]["id"]
        except Exception:
            pass

    # Validación estricta de teléfono: exactamente 9 dígitos numéricos
    if not re.fullmatch(r"^\d{9}$", telefono_limpio):
        raise HTTPException(
            status_code=400,
            detail="El número de teléfono debe tener exactamente 9 dígitos",
        )

    sufijo_random = f"{random.randint(100, 999)}-{uuid.uuid4().hex[:4].upper()}"
    codigo_promocional = f"SEGALU-PROMO-{sufijo_random}"
    ahora_iso = datetime.now(timezone.utc).isoformat()
    lead_id = str(uuid.uuid4())

    lead_record = {
        "id": lead_id,
        "evento_id": eid_uuid,
        "nombre": nombre_limpio,
        "telefono": telefono_limpio,
        "fecha_nacimiento": f_iso,
        "genero": genero_limpio,
        "codigo_promocional": codigo_promocional,
        "creado_en": ahora_iso,
    }
    if correo_limpio:
        lead_record["correo"] = correo_limpio

    guardado_supabase = False
    try:
        def _insert_lead(db):
            return db.table("crm_leads").insert(lead_record).execute()

        res = ejecutar_consulta_segura(_insert_lead)
        if res and res.data:
            guardado_supabase = True
    except Exception as err:
        err_msg = str(err).lower()
        record_fallback = dict(lead_record)
        if "genero" in err_msg and "column" in err_msg:
            record_fallback.pop("genero", None)
        if "correo" in err_msg and "column" in err_msg:
            record_fallback.pop("correo", None)
        try:
            res = ejecutar_consulta_segura(lambda db: db.table("crm_leads").insert(record_fallback).execute())
            if res and res.data:
                guardado_supabase = True
        except Exception as e2:
            print(f"Aviso al guardar lead en Supabase (se usará respaldo local): {e2}")

    # Respaldo en estado_eventos local para garantizar cero pérdida de prospectos
    estado_ev = obtener_estado_evento(eid_uuid)
    leads_ev = estado_ev.setdefault("crm_leads", [])
    leads_ev.append(lead_record)
    if eid != eid_uuid:
        estado_alias = obtener_estado_evento(eid)
        leads_alias = estado_alias.setdefault("crm_leads", [])
        leads_alias.append(lead_record)
    _guardar_estado_eventos_disco()

    invalidar_cache_evento(eid)
    if eid != eid_uuid:
        invalidar_cache_evento(eid_uuid)

    return {
        "ok": True,
        "mensaje": "¡Pase VIP y Cupón Especial generados con éxito!",
        "codigo_promocional": codigo_promocional,
        "lead": lead_record,
        "guardado_en_nube": guardado_supabase,
    }


@app.get("/api/eventos/{evento_id}/leads")
def listar_leads_evento(evento_id: str, force_refresh: bool = False):
    """
    Lista todos los leads recolectados en el evento (Supabase + respaldo local).
    Utiliza caché RAM con TTL de 2.0s para máxima rapidez a menos que force_refresh=True.
    """
    eid = evento_id.strip()
    clave_cache = f"leads:{eid}"
    if force_refresh:
        invalidar_cache_evento(eid)
    else:
        cache_hit = obtener_cache_ram(clave_cache)
        if cache_hit:
            return cache_hit

    # Resolver UUID si vino como código de acceso
    eid_uuid = eid
    codigo_acceso_ref = None
    if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", eid, re.I):
        try:
            ev_check = ejecutar_consulta_segura(
                lambda db: db.table("eventos").select("id, codigo_acceso").eq("codigo_acceso", eid).limit(1).execute()
            )
            if ev_check and ev_check.data:
                eid_uuid = ev_check.data[0]["id"]
                codigo_acceso_ref = ev_check.data[0].get("codigo_acceso")
        except Exception:
            pass
    else:
        try:
            ev_check = ejecutar_consulta_segura(
                lambda db: db.table("eventos").select("id, codigo_acceso").eq("id", eid_uuid).limit(1).execute()
            )
            if ev_check and ev_check.data:
                codigo_acceso_ref = ev_check.data[0].get("codigo_acceso")
        except Exception:
            pass

    # 1. Obtener leads del estado local (buscando por UUID y código para cero pérdidas)
    leads_map: dict[str, dict] = {}
    claves_a_revisar = [c for c in [eid, eid_uuid, codigo_acceso_ref] if c]
    for c_id in claves_a_revisar:
        if c_id in _ESTADO_EVENTOS:
            for l in _ESTADO_EVENTOS[c_id].get("crm_leads") or []:
                if isinstance(l, dict) and "id" in l:
                    leads_map[l["id"]] = l

    # 2. Consultar en Supabase para el evento_id exacto (UUID)
    try:
        res = ejecutar_consulta_segura(
            lambda db: db.table("crm_leads")
            .select("*")
            .eq("evento_id", eid_uuid)
            .order("creado_en", desc=True)
            .execute()
        )
        if res and res.data:
            for item in res.data:
                leads_map[item["id"]] = item
    except Exception as err:
        print(f"Aviso al consultar leads de Supabase: {err}")

    lista_final = list(leads_map.values())
    lista_final.sort(key=lambda x: str(x.get("creado_en") or ""), reverse=True)

    resultado = {
        "ok": True,
        "evento_id": eid,
        "evento_uuid": eid_uuid,
        "total": len(lista_final),
        "leads": lista_final,
    }
    guardar_cache_ram(clave_cache, resultado, evento_id=eid)
    if eid_uuid != eid:
        guardar_cache_ram(f"leads:{eid_uuid}", resultado, evento_id=eid_uuid)
    return resultado


@app.delete("/api/admin/eventos/{evento_id}/leads")
def vaciar_leads_evento_admin(
    evento_id: str,
    x_admin_password: str | None = Header(default=None),
):
    """
    Vacía todos los leads y cupones de un evento en Supabase (tabla crm_leads),
    limpia el respaldo local en _ESTADO_EVENTOS y purga la caché en RAM.
    """
    info_rol = verificar_admin_password(x_admin_password)
    validar_permiso_sede_evento(evento_id, info_rol)
    eid = evento_id.strip()

    # Resolver UUID si vino como código
    eid_uuid = eid
    if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", eid, re.I):
        try:
            ev_check = ejecutar_consulta_segura(
                lambda db: db.table("eventos").select("id").eq("codigo_acceso", eid).limit(1).execute()
            )
            if ev_check and ev_check.data:
                eid_uuid = ev_check.data[0]["id"]
        except Exception:
            pass

    # 1. Eliminar en Supabase
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("crm_leads").delete().eq("evento_id", eid_uuid).execute()
        )
    except Exception as err:
        print(f"Aviso al vaciar crm_leads en Supabase: {err}")

    # 2. Eliminar en estado_eventos local
    for clave in [eid, eid_uuid]:
        if clave in _ESTADO_EVENTOS and isinstance(_ESTADO_EVENTOS[clave], dict):
            _ESTADO_EVENTOS[clave]["crm_leads"] = []
    _guardar_estado_eventos_disco()

    # 3. Invalidar caché en RAM
    invalidar_cache_evento(eid)
    if eid != eid_uuid:
        invalidar_cache_evento(eid_uuid)

    return {"ok": True, "mensaje": "Todos los leads del evento fueron eliminados correctamente."}


@app.get("/api/eventos/{evento_id}/leads/csv")
def exportar_leads_evento_csv(evento_id: str):
    """
    Exporta la base de datos de leads del evento en formato CSV con codificación UTF-8 BOM
    compatible directamente con Microsoft Excel y herramientas de remarketing.
    Incluye la fecha de nacimiento en formato DD/MM/YYYY y la edad en años y meses.
    """
    import csv
    eid = evento_id.strip()
    datos_leads = listar_leads_evento(eid)
    leads = datos_leads.get("leads") or []

    nombre_archivo = f"leads_segalu_{eid[:8]}.csv"
    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM para soporte de caracteres en Excel

    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "ID",
        "Nombre y Apellido",
        "Teléfono / WhatsApp",
        "Fecha de Nacimiento",
        "Edad Actual (Años y Meses)",
        "Género",
        "Correo Electrónico",
        "Código Promocional",
        "Fecha de Registro (UTC)",
    ])

    for l in leads:
        f_dmy, edad_txt = calcular_edad_anios_meses_py(l.get("fecha_nacimiento", ""))
        writer.writerow([
            l.get("id", ""),
            l.get("nombre", ""),
            l.get("telefono", ""),
            f_dmy,
            edad_txt,
            l.get("genero", "") or "No especificado",
            l.get("correo", "") or "No especificado",
            l.get("codigo_promocional", ""),
            l.get("creado_en", ""),
        ])

    csv_bytes = output.getvalue().encode("utf-8-sig")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo}"',
            "Cache-Control": "no-cache",
        },
    )


# ------------------------------------------------------------------------------
# 14. SERVIR PROYECTOR (/proyector), ADMIN (/admin), RECURSOS (/static) E INVITADO (/)
# ------------------------------------------------------------------------------
app.mount(
    "/static",
    StaticFiles(directory=str(FRONTEND_STATIC_DIR)),
    name="static_assets",
)


@app.get("/proyector")
@app.get("/proyector.html")
def servir_pantalla_proyector():
    return FileResponse(FRONTEND_PROYECTOR_DIR / "proyector.html")


app.mount(
    "/proyector",
    StaticFiles(directory=str(FRONTEND_PROYECTOR_DIR), html=True),
    name="proyector_static",
)


@app.get("/admin")
@app.head("/admin")
@app.get("/admin/")
@app.head("/admin/")
@app.get("/admin.html")
@app.head("/admin.html")
def servir_panel_admin():
    return FileResponse(FRONTEND_ADMIN_DIR / "admin.html")


app.mount(
    "/admin",
    StaticFiles(directory=str(FRONTEND_ADMIN_DIR), html=True),
    name="admin_static",
)


@app.get("/invitado")
@app.head("/invitado")
@app.get("/invitado/")
@app.head("/invitado/")
@app.get("/invitado/index.html")
@app.head("/invitado/index.html")
def servir_ruta_invitado():
    """
    Ruta explícita para la vista de invitado que acepta query parameters
    (ej: /invitado?codigo=PROMO-24-11-26) sin generar error 404.
    """
    return FileResponse(FRONTEND_INVITADO_DIR / "index.html")


app.mount(
    "/invitado",
    StaticFiles(directory=str(FRONTEND_INVITADO_DIR), html=True),
    name="invitado_direct_static",
)


@app.get("/")
def servir_pantalla_invitado():
    return FileResponse(FRONTEND_INVITADO_DIR / "index.html")


app.mount(
    "/",
    StaticFiles(directory=str(FRONTEND_INVITADO_DIR), html=True),
    name="invitado_static",
)
