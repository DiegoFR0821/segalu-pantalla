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

import concurrent.futures
import io
import json
import os
import random
import re
import time
import urllib.request
import uuid
import zipfile
import zlib
from datetime import date, datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps
from pydantic import BaseModel, Field, field_validator
from supabase import create_client, Client

# Importación de pypdf y google-generativeai (Fase 4.5)
try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=FutureWarning)
        import google.generativeai as genai
except ImportError:
    genai = None

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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip() or "gemini-3.5-flash-lite"

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY and "tu-proyecto-id" not in SUPABASE_URL:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print(
        "⚠️ [AVISO DIDÁCTICO]: Aún no has configurado tu archivo .env con SUPABASE_URL y SUPABASE_KEY reales."
    )

# Cachés de alta velocidad en memoria para responder en <200ms al cambiar de evento
_CACHE_LOCALES: list | None = None
_CACHE_DASHBOARD_POR_EVENTO: dict[str, dict] = {}
_CACHE_TTL_SEGUNDOS = 2.0

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


def invalidar_cache_evento(evento_id: str | None = None):
    if evento_id:
        _CACHE_DASHBOARD_POR_EVENTO.pop(evento_id.strip(), None)
    else:
        _CACHE_DASHBOARD_POR_EVENTO.clear()


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
    if not re.match(r"^[a-z0-9_]+(\|[a-z0-9_]+)?$", valor_limpio) or len(valor_limpio) > 50:
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
        pattern="^(abrir_lobby|lanzar_pregunta|revelar_respuesta|mostrar_podio|cerrar_trivia|reiniciar_puntajes)$",
    )
    pregunta_id: str | None = Field(default=None)


class ResponderTriviaInput(BaseModel):
    evento_id: str = Field(..., min_length=10, max_length=50)
    pregunta_id: str = Field(..., min_length=5, max_length=50)
    invitado_id: str = Field(..., min_length=10, max_length=50)
    opcion_elegida: str = Field(..., pattern="^[ABCDTabcdt]$")
    tiempo_respuesta_ms: int = Field(default=5000, ge=0, le=120000)


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


def verificar_admin_password(x_admin_password: str | None):
    if not x_admin_password or x_admin_password.strip() != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=401,
            detail="Contraseña de Administrador incorrecta o no proporcionada.",
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
    DIDÁCTICA (Fase 4.5 - Lector de PDF con pypdf):
    Lee todas las páginas del archivo PDF subido por el Administrador y extrae
    su texto limpio para enviarlo al generador de preguntas.
    """
    texto_paginas = []

    if pypdf is not None:
        try:
            lector = pypdf.PdfReader(io.BytesIO(pdf_bytes))
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
    DIDÁCTICA (Conexión con Google Gemini IA - gemini-3.5-flash-lite):
    Lee el nombre del modelo desde la variable de entorno GEMINI_MODEL
    (por defecto 'gemini-3.5-flash-lite') e invoca generate_content con
    generation_config={"response_mime_type": "application/json"} para garantizar
    que devuelva el arreglo JSON limpio de las 10 preguntas.
    """
    if not GEMINI_API_KEY or "tu-api-key" in GEMINI_API_KEY.lower() or genai is None:
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
    miniatura = imagen_rgb.resize((160, 160), Image.Resampling.BILINEAR).convert("YCbCr")
    pixeles = list(miniatura.getdata())
    total_pixeles = len(pixeles)

    conteo_piel_total = 0
    conteo_piel_centro = 0
    total_centro = 0

    for idx, (y_val, cb, cr) in enumerate(pixeles):
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


def estampar_marca_agua_y_comprimir(archivo_bytes: bytes) -> tuple[bytes, dict]:
    try:
        imagen_original = Image.open(io.BytesIO(archivo_bytes))
        imagen_original.verify()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="El archivo enviado no es una imagen válida (usa JPG, PNG o WebP).",
        )

    img = Image.open(io.BytesIO(archivo_bytes))
    img = ImageOps.exif_transpose(img)
    img_rgb = img.convert("RGB")

    resultado_ia = analizar_seguridad_imagen_ia(img_rgb)

    img_rgb.thumbnail((1280, 1280), Image.Resampling.LANCZOS)

    # 1. Versión ORIGINAL LIMPIA (100% sin marca de agua) para `originales/{uuid}_original.jpg`
    img_original_limpia = img_rgb.copy()
    calidad_orig = 85
    bytes_sin_marca = b""
    while calidad_orig >= 55:
        buf_orig = io.BytesIO()
        img_original_limpia.save(buf_orig, format="JPEG", quality=calidad_orig, optimize=True)
        bytes_sin_marca = buf_orig.getvalue()
        if len(bytes_sin_marca) <= 320 * 1024:
            break
        calidad_orig -= 8

    # 2. Versión CON MARCO / SELLO SEGALÚ para `multimedia/{uuid}_con_marco.jpg`
    imagen_base = img_rgb.copy().convert("RGBA")
    ancho, alto = imagen_base.size

    if LOGO_SEGALU_PATH.exists():
        try:
            logo_png = Image.open(LOGO_SEGALU_PATH).convert("RGBA")
            tamano_logo = max(75, min(165, int(min(ancho, alto) * 0.15)))
            logo_png.thumbnail((tamano_logo, tamano_logo), Image.Resampling.LANCZOS)

            pos_x = int(ancho * 0.03)
            pos_y = int(alto * 0.03)

            imagen_base.paste(logo_png, (pos_x, pos_y), mask=logo_png)
        except Exception as err:
            print(f"Aviso al estampar logo_segalu.png: {err}")

    imagen_final_rgb = imagen_base.convert("RGB")

    calidad = 84
    bytes_salida = b""
    while calidad >= 55:
        buffer = io.BytesIO()
        imagen_final_rgb.save(buffer, format="JPEG", quality=calidad, optimize=True)
        bytes_salida = buffer.getvalue()
        if len(bytes_salida) <= 310 * 1024:
            break
        calidad -= 8

    resultado_ia["peso_kb"] = round(len(bytes_salida) / 1024, 1)
    resultado_ia["bytes_sin_marca"] = bytes_sin_marca
    return bytes_salida, resultado_ia


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
    DIDÁCTICA:
    Obtiene la ruta exacta dentro del Bucket de Supabase Storage:
    - 'originales/<uuid>_original.jpg'
    - 'multimedia/<uuid>_con_marco.jpg'
    - o rutas anteriores 'eventos/<evento_id>/segalu_xxxx.jpg'
    """
    if not url_multimedia:
        return None
    url_sin_hash = url_multimedia.split("#")[0].split("?")[0].strip()

    marcador_bucket = f"/{SUPABASE_BUCKET}/"
    if marcador_bucket in url_sin_hash:
        return url_sin_hash.split(marcador_bucket, 1)[1].lstrip("/")

    if "/static/uploads/originales/" in url_sin_hash:
        return "originales/" + url_sin_hash.split("/static/uploads/originales/", 1)[1].lstrip("/")
    if "/static/uploads/multimedia/" in url_sin_hash:
        return "multimedia/" + url_sin_hash.split("/static/uploads/multimedia/", 1)[1].lstrip("/")

    nombre_archivo = url_sin_hash.split("/")[-1]
    if nombre_archivo.endswith("_original.jpg"):
        return f"originales/{nombre_archivo}"
    if nombre_archivo.endswith("_con_marco.jpg"):
        return f"multimedia/{nombre_archivo}"
    if (nombre_archivo.startswith("segalu_") or nombre_archivo.startswith("orig_segalu_")) and evento_id:
        return f"eventos/{evento_id.strip()}/{nombre_archivo}"
    return None


# ------------------------------------------------------------------------------
# 9. ENDPOINTS PÚBLICOS DEL INVITADO (REGISTRO, FOTOS Y TRIVIA KAHOOT)
# ------------------------------------------------------------------------------
@app.get("/api/eventos/{codigo_acceso}")
def obtener_evento_por_codigo(codigo_acceso: str):
    codigo_limpio = codigo_acceso.strip().upper()

    try:
        respuesta = ejecutar_consulta_segura(
            lambda db: db.table("eventos")
            .select(
                "id, nombre, codigo_acceso, fecha_evento, estado, trivia_activa, locales(nombre, direccion, telefono_contacto)"
            )
            .eq("codigo_acceso", codigo_limpio)
            .eq("estado", "activo")
            .execute()
        )

        datos = respuesta.data
        if not datos:
            raise HTTPException(
                status_code=404,
                detail=f"No encontramos un evento activo con el código '{codigo_limpio}'. Verifica el QR de tu mesa.",
            )

        evento = datos[0]
        estado_ev = obtener_estado_evento(evento["id"])
        evento["fase_trivia"] = estado_ev.get("fase_trivia", "inactiva")
        return {"ok": True, "evento": evento}
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

    # 3. Desvincular fotos subidas por el invitado (si la columna lo permite) para conservar las fotos del evento
    try:
        ejecutar_consulta_segura(
            lambda db: db.table("multimedia")
            .update({"invitado_id": None})
            .eq("invitado_id", iid)
            .execute()
        )
    except Exception:
        pass

    # 4. Eliminar físicamente la sesión del invitado de la tabla invitados
    ejecutar_consulta_segura(
        lambda db: db.table("invitados").delete().eq("id", iid).execute()
    )
    invalidar_cache_evento()


@app.delete("/api/invitados/{invitado_id}")
@app.post("/api/invitados/{invitado_id}/desconectar")
def eliminar_invitado(invitado_id: str):
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
    evento_id: str = Form(...),
    invitado_id: str = Form(...),
    puntaje_ia_cliente: int = Form(default=95),
    archivo: UploadFile = File(...),
):
    contenido_bytes = archivo.file.read()
    if not contenido_bytes:
        raise HTTPException(status_code=400, detail="El archivo de imagen está vacío.")

    if len(contenido_bytes) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="La imagen original supera los 15 MB permitidos.",
        )

    jpeg_procesado, info_ia = estampar_marca_agua_y_comprimir(contenido_bytes)

    puntaje_final = min(
        max(0, min(100, int(puntaje_ia_cliente))),
        info_ia["puntaje_ia_seguridad"],
    )
    aprobado_ia = puntaje_final >= 70

    estado_ev = obtener_estado_evento(evento_id.strip())
    auto_aprobar_activo = bool(estado_ev.get("auto_aprobar_fotos", False))
    aprobar_directamente = auto_aprobar_activo and aprobado_ia

    uid_hex = uuid.uuid4().hex[:12]
    nombre_archivo_orig = f"{uid_hex}_original.jpg"
    nombre_archivo_marca = f"{uid_hex}_con_marco.jpg"

    ruta_storage_orig = f"originales/{nombre_archivo_orig}"
    ruta_storage_marca = f"multimedia/{nombre_archivo_marca}"

    bytes_sin_marca = info_ia.get("bytes_sin_marca") or jpeg_procesado

    # Guardamos copias físicas separadas en carpetas locales (`originales/` y `multimedia/`)
    dir_local_orig = LOCAL_UPLOADS_DIR / "originales"
    dir_local_marca = LOCAL_UPLOADS_DIR / "multimedia"
    dir_local_orig.mkdir(parents=True, exist_ok=True)
    dir_local_marca.mkdir(parents=True, exist_ok=True)

    (dir_local_orig / nombre_archivo_orig).write_bytes(bytes_sin_marca)
    (dir_local_marca / nombre_archivo_marca).write_bytes(jpeg_procesado)

    url_marca_publica = f"/static/uploads/multimedia/{nombre_archivo_marca}"
    url_orig_publica = f"/static/uploads/originales/{nombre_archivo_orig}"
    origen_almacenamiento = "local_fallback"

    try:
        db = verificar_conexion_supabase()
        # a) Subir versión ORIGINAL LIMPIA (sin marca de agua) -> originales/{uuid}_original.jpg
        db.storage.from_(SUPABASE_BUCKET).upload(
            path=ruta_storage_orig,
            file=bytes_sin_marca,
            file_options={"content-type": "image/jpeg", "upsert": "true"},
        )
        url_orig_sb = db.storage.from_(SUPABASE_BUCKET).get_public_url(ruta_storage_orig)
        if url_orig_sb:
            url_orig_publica = url_orig_sb

        # b) Subir versión CON MARCO SEGALÚ -> multimedia/{uuid}_con_marco.jpg
        db.storage.from_(SUPABASE_BUCKET).upload(
            path=ruta_storage_marca,
            file=jpeg_procesado,
            file_options={"content-type": "image/jpeg", "upsert": "true"},
        )
        url_marca_sb = db.storage.from_(SUPABASE_BUCKET).get_public_url(ruta_storage_marca)
        if url_marca_sb:
            url_marca_publica = url_marca_sb

        origen_almacenamiento = "supabase_storage"
    except Exception as storage_err:
        print(f"Aviso Supabase Storage ({SUPABASE_BUCKET}): {storage_err}")

    try:
        nueva_multimedia = {
            "evento_id": evento_id.strip(),
            "invitado_id": invitado_id.strip(),
            "url_original": f"{url_orig_publica}#ia={puntaje_final}",
            "url_con_marca": url_marca_publica,
            "tipo": "foto",
            "filtro_ia_aprobado": aprobado_ia,
            "estado_moderacion": "pendiente",
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

        if aprobar_directamente:
            res_auto = ejecutar_consulta_segura(
                lambda db: db.table("multimedia")
                .update({"estado_moderacion": "aprobado"})
                .eq("id", fila_creada["id"])
                .execute()
            )
            if res_auto.data:
                fila_creada = res_auto.data[0]
            else:
                fila_creada["estado_moderacion"] = "aprobado"

        invalidar_cache_evento(evento_id)

        mensaje_exito = (
            "¡Foto aprobada automáticamente con el sello de Segalú! Ya está lista para la pantalla gigante."
            if aprobar_directamente
            else "¡Foto enviada con el sello de Segalú! Está en espera de aprobación del Administrador."
        )

        return {
            "ok": True,
            "mensaje": mensaje_exito,
            "auto_aprobada": aprobar_directamente,
            "multimedia": fila_creada,
            "analisis_ia": {
                "puntaje_ia_seguridad": puntaje_final,
                "filtro_ia_aprobado": aprobado_ia,
                "peso_kb": info_ia["peso_kb"],
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
        if ts_inicio > 0:
            transcurrido = max(0.0, time.time() - ts_inicio)
            segundos_restantes = max(0, int(round(limite_seg - transcurrido)))
        else:
            segundos_restantes = limite_seg

        if fase == "respuesta_revelada" or bool(pregunta_actual.get("revelar_respuesta")) or segundos_restantes <= 0:
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

    return {
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
    }


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
    DIDÁCTICA (Fase 4.5 - Requerimiento B: Velocidad Instantánea <200ms):
    1. Si el evento fue consultado hace menos de 2 segundos y no hubo cambios,
       responde en <5ms desde la caché en RAM.
    2. Si toca refrescar desde Supabase, lanza las consultas de 'multimedia',
       'invitados' y 'preguntas' EN PARALELO usando ThreadPoolExecutor, y cuenta
       todas las respuestas en un solo lote (sin bucle N+1).
    """
    eid = evento_id.strip()
    ahora = time.time()

    if usar_cache and eid in _CACHE_DASHBOARD_POR_EVENTO:
        entrada = _CACHE_DASHBOARD_POR_EVENTO[eid]
        if (ahora - entrada["ts"]) <= _CACHE_TTL_SEGUNDOS:
            return entrada["datos"]

    estado_ev = obtener_estado_evento(eid)
    auto_aprobar_fotos = bool(estado_ev.get("auto_aprobar_fotos", False))

    def _query_multimedia():
        # Creamos cliente ligero por hilo para evitar contención de sockets en httpx
        cli = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else verificar_conexion_supabase()
        res = (
            cli.table("multimedia")
            .select("*, invitados(id, nombre, avatar)")
            .eq("evento_id", eid)
            .order("created_at", desc=True)
            .execute()
        )
        lista = []
        for item in res.data or []:
            item["puntaje_ia_seguridad"] = extraer_puntaje_ia_de_url(
                item.get("url_original"), item.get("filtro_ia_aprobado", True)
            )
            lista.append(item)
        return lista

    def _query_invitados():
        cli = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else verificar_conexion_supabase()
        res = (
            cli.table("invitados")
            .select("*")
            .eq("evento_id", eid)
            .order("puntaje_total", desc=True)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def _query_preguntas():
        return listar_preguntas_evento(eid)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        fut_multi = executor.submit(_query_multimedia)
        fut_inv = executor.submit(_query_invitados)
        fut_preg = executor.submit(_query_preguntas)

        multimedia_lista = fut_multi.result()
        invitados_lista = fut_inv.result()
        preguntas_raw = fut_preg.result()

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
    verificar_admin_password(datos.password)
    return {
        "ok": True,
        "mensaje": "Sesión de Administrador Único verificada correctamente.",
    }


def fijar_evento_proyector(evento_id: str | None):
    if not evento_id:
        return
    eid = evento_id.strip()
    if eid and _ESTADO_EVENTOS.get("__proyector_evento_id__") != eid:
        _ESTADO_EVENTOS["__proyector_evento_id__"] = eid
        _guardar_estado_eventos_disco()


@app.get("/api/admin/eventos/{evento_id}/dashboard-completo")
def obtener_dashboard_completo_evento(
    evento_id: str,
    x_admin_password: str | None = Header(default=None),
):
    """
    DIDÁCTICA (Fase 4.5 - Requerimiento B):
    Endpoint consolidado ultrarrápido (<200ms) que devuelve fotos, preguntas,
    estado de trivia e invitados al cambiar de evento en el selector del Admin.
    Además sincroniza automáticamente el evento proyectado en /proyector (OBS Studio).
    """
    verificar_admin_password(x_admin_password)
    t0 = time.perf_counter()
    try:
        fijar_evento_proyector(evento_id)
        datos = construir_dashboard_evento_rapido(evento_id, usar_cache=True)
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
    x_admin_password: str | None = Header(default=None),
):
    global _CACHE_LOCALES
    verificar_admin_password(x_admin_password)
    t0 = time.perf_counter()

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

        evento_seleccionado_id = evento_id
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
            "bucket_configurado": SUPABASE_BUCKET,
            "gemini_configurado": bool(GEMINI_API_KEY and "tu-api-key" not in GEMINI_API_KEY.lower()),
            "locales": _CACHE_LOCALES,
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
    verificar_admin_password(x_admin_password)

    codigo_limpio = re.sub(r"[^A-Z0-9\-]", "", datos.codigo_acceso.strip().upper())
    if len(codigo_limpio) < 3:
        raise HTTPException(
            status_code=400,
            detail="El código de acceso debe tener al menos 3 letras o números.",
        )

    try:
        nuevo_evento = {
            "local_id": datos.local_id.strip(),
            "nombre": datos.nombre.strip(),
            "codigo_acceso": codigo_limpio,
            "fecha_evento": datos.fecha_evento,
            "estado": "activo",
            "trivia_activa": False,
        }
        res = ejecutar_consulta_segura(
            lambda db: db.table("eventos").insert(nuevo_evento).execute()
        )
        if not res.data:
            raise HTTPException(status_code=500, detail="No se pudo crear el evento.")

        return {
            "ok": True,
            "mensaje": f"Evento '{datos.nombre}' creado con éxito (Código QR: {codigo_limpio}).",
            "evento": res.data[0],
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear el evento (verifica que el código QR no esté repetido): {str(error)}",
        )


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
                LOCAL_UPLOADS_DIR / "originales" / nombre_archivo,
                LOCAL_UPLOADS_DIR / "multimedia" / nombre_archivo,
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
def _extraer_uuid_de_urls_foto(url_marca: str, url_orig: str) -> str | None:
    """
    Extrae el identificador hexadecimal de 12 caracteres de una foto para poder
    resolver directamente `originales/{uuid}_original.jpg` o `multimedia/{uuid}_con_marco.jpg`.
    """
    for u in (url_orig, url_marca):
        if not u:
            continue
        nombre = u.split("#")[0].split("?")[0].split("/")[-1]
        m = re.match(r"^([a-f0-9]{12})_(?:original|con_marco)\.jpg$", nombre)
        if m:
            return m.group(1)
        m2 = re.match(r"^(?:orig_)?segalu_([a-f0-9]{12})\.jpg$", nombre)
        if m2:
            return m2.group(1)
    return None


def _descargar_bytes_por_version_foto(
    url_marca: str,
    url_orig: str,
    evento_id: str,
    con_marca_agua: bool,
) -> bytes | None:
    """
    Recupera los bytes JPEG de la carpeta correspondiente según `con_marca_agua`:
    - `con_marca_agua=True`  -> lee de `multimedia/{uuid}_con_marco.jpg` (`url_con_marca`)
    - `con_marca_agua=False` -> lee de `originales/{uuid}_original.jpg` (`url_original`)
    """
    uid_foto = _extraer_uuid_de_urls_foto(url_marca, url_orig)
    carpeta_objetivo = "multimedia" if con_marca_agua else "originales"
    url_primaria = (url_marca if con_marca_agua else url_orig).split("#")[0].strip()

    # 1. Intentar desde las carpetas locales `originales/` o `multimedia/` por UUID directo
    if uid_foto:
        nombre_directo = (
            f"{uid_foto}_con_marco.jpg" if con_marca_agua else f"{uid_foto}_original.jpg"
        )
        ruta_local_directa = LOCAL_UPLOADS_DIR / carpeta_objetivo / nombre_directo
        if ruta_local_directa.exists():
            try:
                return ruta_local_directa.read_bytes()
            except Exception:
                pass

        # Compatibilidad con fotos subidas con prefijo anterior (`orig_segalu_` / `segalu_`)
        nombre_legacy = f"segalu_{uid_foto}.jpg" if con_marca_agua else f"orig_segalu_{uid_foto}.jpg"
        ruta_local_legacy = LOCAL_UPLOADS_DIR / nombre_legacy
        if ruta_local_legacy.exists():
            try:
                return ruta_local_legacy.read_bytes()
            except Exception:
                pass

    # 2. Intentar descarga desde el Bucket de Supabase Storage en la carpeta correspondiente
    rutas_storage_candidatas: list[str] = []
    if uid_foto:
        if con_marca_agua:
            rutas_storage_candidatas.append(f"multimedia/{uid_foto}_con_marco.jpg")
            rutas_storage_candidatas.append(f"eventos/{evento_id}/{f'segalu_{uid_foto}.jpg'}")
        else:
            rutas_storage_candidatas.append(f"originales/{uid_foto}_original.jpg")
            rutas_storage_candidatas.append(f"eventos/{evento_id}/{f'orig_segalu_{uid_foto}.jpg'}")

    ruta_desde_url = extraer_ruta_storage_de_url(url_primaria, evento_id)
    if ruta_desde_url and ruta_desde_url not in rutas_storage_candidatas:
        # Evitar usar una ruta de `multimedia/` cuando se pidieron `originales/`
        if con_marca_agua or not ruta_desde_url.startswith("multimedia/"):
            rutas_storage_candidatas.append(ruta_desde_url)

    if supabase is not None:
        for ruta_st in rutas_storage_candidatas:
            try:
                datos = supabase.storage.from_(SUPABASE_BUCKET).download(ruta_st)
                if datos:
                    return datos
            except Exception:
                pass

    # 3. Intentar desde disco local por nombre de archivo en `url_primaria`
    nombre_url = url_primaria.split("?")[0].split("/")[-1]
    if nombre_url:
        for cand_local in (
            LOCAL_UPLOADS_DIR / carpeta_objetivo / nombre_url,
            LOCAL_UPLOADS_DIR / nombre_url,
        ):
            if cand_local.exists():
                try:
                    return cand_local.read_bytes()
                except Exception:
                    pass

    # 4. Intentar vía HTTP público desde la URL correspondiente
    if url_primaria.startswith("http://") or url_primaria.startswith("https://"):
        try:
            req = urllib.request.Request(
                url_primaria,
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
    con_marca_agua: bool = True,
    admin_password: str | None = None,
    x_admin_password: str | None = Header(default=None),
):
    """
    Genera y descarga al instante un archivo .ZIP con todas las fotografías del evento:
    - ?con_marca_agua=true  -> Lee de `multimedia/{uuid}_con_marco.jpg` (con logo Segalú)
    - ?con_marca_agua=false -> Lee de `originales/{uuid}_original.jpg` (originales limpias sin marca)
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

        buffer_zip = io.BytesIO()
        archivos_agregados = 0

        with zipfile.ZipFile(buffer_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for idx, item in enumerate(lista_fotos, start=1):
                url_marca = (item.get("url_con_marca") or "").strip()
                url_orig = (item.get("url_original") or "").split("#")[0].strip()

                img_bytes = _descargar_bytes_por_version_foto(
                    url_marca=url_marca,
                    url_orig=url_orig,
                    evento_id=eid,
                    con_marca_agua=con_marca_agua,
                )
                if not img_bytes:
                    continue

                autor_raw = (item.get("invitados") or {}).get("nombre") or "Invitado"
                autor_slug = re.sub(r"[^A-Za-z0-9]+", "_", autor_raw).strip("_") or "Invitado"
                estado_slug = str(item.get("estado_moderacion") or "foto").upper()
                sufijo_tipo = "CON_MARCO" if con_marca_agua else "ORIGINAL_SIN_MARCO"
                nombre_en_zip = f"{idx:03d}_{autor_slug}_{estado_slug}_{sufijo_tipo}.jpg"

                zf.writestr(nombre_en_zip, img_bytes)
                archivos_agregados += 1

        if archivos_agregados == 0:
            raise HTTPException(
                status_code=404,
                detail="No se pudieron recuperar archivos físicos de imagen para este evento.",
            )

        buffer_zip.seek(0)
        etiqueta_zip = "Con_Marco_Segalu" if con_marca_agua else "Originales_Sin_Marco"
        nombre_zip = f"Fotos_{codigo_limpio}_{etiqueta_zip}.zip"

        return StreamingResponse(
            buffer_zip,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{nombre_zip}"',
                "Cache-Control": "no-store",
            },
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
    (tanto de `originales/` como de `multimedia/`) y elimina los registros de `multimedia`.
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
        url_marca = reg.get("url_con_marca") or ""
        url_orig = reg.get("url_original") or ""
        uid_foto = _extraer_uuid_de_urls_foto(url_marca, url_orig)
        if uid_foto:
            for r_uid in (f"originales/{uid_foto}_original.jpg", f"multimedia/{uid_foto}_con_marco.jpg"):
                if r_uid not in rutas_storage:
                    rutas_storage.append(r_uid)

        for campo in ("url_con_marca", "url_original"):
            url_val = reg.get(campo) or ""
            ruta_st = extraer_ruta_storage_de_url(url_val, eid)
            if ruta_st and ruta_st not in rutas_storage:
                rutas_storage.append(ruta_st)

            nombre_local = url_val.split("#")[0].split("?")[0].split("/")[-1]
            if nombre_local:
                for archivo_local in (
                    LOCAL_UPLOADS_DIR / "originales" / nombre_local,
                    LOCAL_UPLOADS_DIR / "multimedia" / nombre_local,
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
            # Supabase Storage permite borrar listas de rutas en lote
            db.storage.from_(SUPABASE_BUCKET).remove(rutas_storage)
        except Exception as st_err:
            print(f"Aviso al purgar lote de fotos en Supabase Storage: {st_err}")

    if registros:
        ejecutar_consulta_segura(
            lambda db: db.table("multimedia").delete().eq("evento_id", eid).execute()
        )

    return len(registros), len(rutas_storage)


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

        # 4. Borrar el evento en la tabla eventos
        ejecutar_consulta_segura(
            lambda db: db.table("eventos").delete().eq("id", eid).execute()
        )

        # 5. Limpiar estados en memoria y caché
        _ESTADO_EVENTOS.pop(eid, None)
        if _ESTADO_EVENTOS.get("__proyector_evento_id__") == eid:
            _ESTADO_EVENTOS["__proyector_evento_id__"] = None
        _guardar_estado_eventos_disco()
        invalidar_cache_evento(eid)
        _CACHE_META_EVENTOS_PROYECTOR.clear()

        return {
            "ok": True,
            "evento_eliminado_id": eid,
            "fotos_eliminadas": fotos_borradas,
            "archivos_storage_purgados": archivos_borrados,
            "mensaje": f"🗑️ El evento '{nombre_ev}' fue eliminado por completo junto con sus fotos, invitados, preguntas y respuestas.",
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
    verificando archivos locales si existieran.
    """
    guardadas_raw = _ESTADO_EVENTOS.get("__fotos_sedes__")
    guardadas = guardadas_raw if isinstance(guardadas_raw, dict) else {}

    fotos_listas: dict[str, list[dict]] = {"sede1": [], "sede2": []}
    fotos_mapa: dict[str, dict[str, str]] = {"sede1": {}, "sede2": {}}

    for sede_key in ("sede1", "sede2"):
        mapa_sede = guardadas.get(sede_key)
        if not isinstance(mapa_sede, dict):
            mapa_sede = {}

        for num in range(1, 5):
            nombre_jpg = f"{sede_key}_foto{num}.jpg"
            ruta_local = SEDES_IMG_DIR / nombre_jpg
            url_guardada = str(mapa_sede.get(str(num)) or "").strip()

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
    x_admin_password: str | None = Header(default=None),
):
    """
    Sube cualquiera de las 4 fotos promocionales de Sede 1 o Sede 2:
    1. Redimensiona y optimiza en proporción 16:10 (1280x800 JPEG).
    2. Sube el archivo al Bucket de Supabase Storage (`sedes/sede1_foto1.jpg` con upsert=true)
       y guarda también una copia en `frontend/static/img/sedes/`.
    3. Registra la URL pública en la configuración de la sede para que se refleje
       de inmediato en `index.html` y en el Panel de Administrador.
    """
    verificar_admin_password(x_admin_password)

    sede_recibida = (sede or sede_key or "").strip().lower()
    if sede_recibida not in ("sede1", "sede2"):
        raise HTTPException(status_code=400, detail="Sede inválida. Usa 'sede1' o 'sede2'.")

    indice_recibido = numero_foto if numero_foto is not None else indice_foto
    if indice_recibido is None:
        raise HTTPException(status_code=400, detail="Indica el número de foto (1 a 4).")

    num = max(1, min(4, int(indice_recibido)))
    raw_bytes = archivo.file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="El archivo de imagen seleccionado está vacío.")

    try:
        img = Image.open(io.BytesIO(raw_bytes))
        img = ImageOps.exif_transpose(img).convert("RGB")
        # Recorte inteligente 16:10 (1280x800) para que las tarjetas luzcan uniformes
        img_16_10 = ImageOps.fit(img, (1280, 800), method=Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        img_16_10.save(buf, format="JPEG", quality=86, optimize=True)
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
                file_options={"content-type": "image/jpeg", "upsert": "true"},
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
            "mensaje": f"✅ Foto {num}/4 de {sede_recibida.upper()} subida y actualizada en la galería de invitados.",
        }
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo procesar o subir la foto de la sede: {str(err)}",
        )


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

    pdf_bytes = archivo_pdf.file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="El archivo PDF está vacío.")

    texto_extraido = extraer_texto_de_pdf(pdf_bytes)
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
            "tiempo_limite_segundos": int(q.get("tiempo_limite_segundos") or 20),
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
_CACHE_META_EVENTOS_PROYECTOR: dict[str, dict] = {}


def resolver_evento_proyector(
    evento_id: str | None = None,
    codigo: str | None = None,
) -> dict | None:
    """
    Resuelve automáticamente el evento que debe proyectarse en /proyector:
    1. Si se pasa ?codigo=SEGALU-2026 o ?evento_id=UUID en la URL, usa ese evento.
    2. Si se abre http://localhost:8000/proyector directo en OBS Studio sin parámetros,
       toma el evento que el Administrador tenga seleccionado en /admin (o el último activo).
    """
    ahora = time.time()
    clave_busqueda = (
        f"cod:{codigo.strip().upper()}"
        if codigo and codigo.strip()
        else f"id:{(evento_id or _ESTADO_EVENTOS.get('__proyector_evento_id__') or '').strip()}"
    )

    if clave_busqueda in _CACHE_META_EVENTOS_PROYECTOR:
        item = _CACHE_META_EVENTOS_PROYECTOR[clave_busqueda]
        if (ahora - item["ts"]) <= 4.0:
            return item["evento"]

    try:
        ev = None
        if codigo and codigo.strip():
            cod_limpio = re.sub(r"[^A-Z0-9\-]", "", codigo.strip().upper())
            res = ejecutar_consulta_segura(
                lambda db: db.table("eventos")
                .select("*, locales(nombre, direccion)")
                .eq("codigo_acceso", cod_limpio)
                .limit(1)
                .execute()
            )
            if res.data:
                ev = res.data[0]

        if not ev:
            eid_candidato = (
                evento_id.strip()
                if (evento_id and evento_id.strip())
                else str(_ESTADO_EVENTOS.get("__proyector_evento_id__") or "").strip()
            )
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
        return ev
    except Exception as err:
        print(f"Aviso al resolver evento del proyector: {err}")
        return None


@app.get("/api/proyector/estado")
def obtener_estado_proyector_en_vivo(
    evento_id: str | None = None,
    codigo: str | None = None,
):
    """
    DIDÁCTICA (Fase 5 - Pantalla Gigante de Proyección 1920x1080 para OBS Studio):
    Devuelve en una sola consulta ultrarrápida todo el espectáculo visual:
    - modo_proyector:
        * 'GALERIA'              -> Carrusel de fotos APROBADAS con Doble Capa Ambient Blur
        * 'LOBBY_KAHOOT'         -> Invitados uniéndose en vivo con sus avatares compuestos
        * 'PREGUNTA_ACTIVA'      -> Enunciado gigante, cronómetro, contador y 4 tarjetas Kahoot
        * 'RESULTADOS_PREGUNTA'  -> Check ✅ en la correcta + Gráfico de Barras (A, B, C, D)
        * 'PODIO'                -> Gala secuencial 3° -> 2° -> 1° con explosiones
    """
    evento = resolver_evento_proyector(evento_id=evento_id, codigo=codigo)
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

    # 1. Filtrar ESTRICTAMENTE las fotos con estado_moderacion == 'aprobado'
    fotos_aprobadas = [
        m
        for m in (datos_dash.get("multimedia") or [])
        if str(m.get("estado_moderacion") or "").lower() == "aprobado"
    ]

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

        if (
            fase == "respuesta_revelada"
            or bool(pregunta_actual.get("revelar_respuesta"))
            or segundos_restantes <= 0
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
    elif fase == "podio":
        modo_proyector = "PODIO"
    else:
        modo_proyector = "GALERIA"

    datos_local = evento.get("locales") or {}
    return {
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
        "pregunta_activa": datos_pregunta_proyector,
    }


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
@app.get("/admin.html")
def servir_panel_admin():
    return FileResponse(FRONTEND_ADMIN_DIR / "admin.html")


app.mount(
    "/admin",
    StaticFiles(directory=str(FRONTEND_ADMIN_DIR), html=True),
    name="admin_static",
)


@app.get("/")
def servir_pantalla_invitado():
    return FileResponse(FRONTEND_INVITADO_DIR / "index.html")


app.mount(
    "/",
    StaticFiles(directory=str(FRONTEND_INVITADO_DIR), html=True),
    name="invitado_static",
)
