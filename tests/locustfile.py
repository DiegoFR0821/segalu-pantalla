# ==============================================================================
# PROYECTO: SEGALÚ (segalu-pantalla)
# ARCHIVO: tests/locustfile.py
# OBJETIVO: Simulación de carga extrema con hasta 200 invitados concurrentes
#           evaluando límites de hardware de Render ($7 vs $25)
# ==============================================================================
# Ejecución local:
#   locust -f tests/locustfile.py --host http://localhost:8000
#
# Interfaz Web de Locust:
#   http://localhost:8089
# ==============================================================================

import io
import os
import random
import time
from locust import HttpUser, between, task
try:
    from PIL import Image
    _TIENE_PIL = True
except ImportError:
    Image = None
    _TIENE_PIL = False

# Catálogo oficial de avatares de Segalú
PERSONAJES_PERMITIDOS = [
    "pug_real",
    "gatito_gala",
    "osito_gala",
    "zorro_glam",
    "conejita_real",
]

NOMBRES_EJEMPLO = [
    "Carlos", "Valentina", "Mateo", "Camila", "Sebastián", "Sofía",
    "Alejandro", "Lucía", "Diego", "Martina", "Daniel", "Elena",
    "Joaquín", "Isabella", "Andrés", "Paula", "Lucas", "Victoria",
]

APELLIDOS_EJEMPLO = [
    "Flores", "Gómez", "Rojas", "Morales", "Vargas", "Castillo",
    "Pérez", "Mendoza", "Silva", "Torres", "Castro", "Romero",
]

# ==============================================================================
# CÓDIGO DEL EVENTO OBJETIVO (LÍNEA 48)
# Modifica esta variable si deseas apuntar a otro código de evento en el futuro.
# ==============================================================================
EVENT_CODE = os.getenv("LOCUST_EVENT_CODE", "SEGALU-2026").strip().upper()
CODIGO_EVENTO_OBJETIVO = EVENT_CODE


def _crear_imagen_jpeg_sintetica(calidad: int = 82) -> bytes:
    """
    Genera en memoria RAM una imagen JPEG con textura sintética (~250 KB)
    para no realizar lecturas de disco y no saturar la máquina que corre Locust.
    Funciona tanto en entornos con Pillow como en contenedores mínimos sin Pillow.
    """
    if _TIENE_PIL and Image is not None:
        raw = os.urandom(210 * 210 * 3)
        img = Image.frombytes("RGB", (210, 210), raw).resize((850, 850), Image.Resampling.BILINEAR)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=calidad)
        return buf.getvalue()

    # Cabecera JPEG válida estándar de 1x1 con relleno sintético para contenedores sin Pillow
    header = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00"
        b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342"
        b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
        b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
        b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00"
    )
    return header + os.urandom(220 * 1024) + b"\xff\xd9"


# Pool en memoria de 6 imágenes JPEG distintas de ~250 KB para simular fotos reales de invitados
print("⚡ [Locust Setup] Pre-generando imágenes de prueba (~250 KB c/u) en memoria RAM...")
POOL_IMAGENES_TEST = [_crear_imagen_jpeg_sintetica() for _ in range(6)]
print(f"✅ [Locust Setup] {len(POOL_IMAGENES_TEST)} imágenes listas en memoria (tamaño promedio: {round(len(POOL_IMAGENES_TEST[0]) / 1024, 1)} KB).")


class InvitadoSegaluUser(HttpUser):
    """
    Simula el comportamiento real de un invitado de gala conectado desde su teléfono móvil:
    1. Registro inicial con Nombre, Apellido y Avatar únicos.
    2. Polling activo de la pantalla de trivia y votación rápida ante preguntas activas.
    3. Envío moderado de fotografías en segundo plano para estresar CPU, RAM y BackgroundTasks.
    """

    # Simula el intervalo de atención de un usuario móvil en un evento (1 a 3 segundos)
    wait_time = between(1.0, 3.0)

    def on_start(self):
        """
        Ciclo de vida al conectar cada uno de los 200 bots:
        - Resuelve el evento activo en Supabase usando el código QR.
        - Registra un nuevo invitado único (evitando códigos 409 por nombres duplicados).
        - Guarda su ID y token de sesión.
        """
        self.evento_id = None
        self.invitado_id = None
        self.token_sesion = None
        self.preguntas_respondidas = set()
        self.registrado_ok = False
        # Limitar estrictamente a 1 o 2 fotos por bot durante toda la sesión
        self.max_fotos_sesion = random.randint(1, 2)
        self.fotos_subidas_cuenta = 0
        # Simulación CRM: ~85% de los invitados solicitarán Pase VIP para poblar el CRM en vivo
        self.desea_pase_vip_crm = random.random() < 0.85
        self.lead_crm_registrado = False

        # 1. Resolver el evento activo por código (con autodetección automática como respaldo)
        with self.client.get(
            f"/api/eventos/{EVENT_CODE}",
            name="/api/eventos/[codigo]",
            catch_response=True,
        ) as resp_evento:
            if resp_evento.status_code == 200:
                try:
                    datos = resp_evento.json()
                    self.evento_id = datos["evento"]["id"]
                except Exception as err:
                    resp_evento.failure(f"Error decodificando respuesta del evento: {err}")
            else:
                # Fallback: consultar el proyector para detectar automáticamente el evento activo
                with self.client.get(
                    "/api/proyector/estado",
                    name="/api/proyector/estado (autodetección)",
                    catch_response=True,
                ) as resp_auto:
                    if resp_auto.status_code == 200:
                        try:
                            d_auto = resp_auto.json()
                            self.evento_id = d_auto.get("evento_id")
                        except Exception:
                            pass

        if not self.evento_id:
            return

        # 2. Generar identidad única de gala (Nombre y Apellido aleatorio)
        self.nombre_invitado = (
            f"Invitado {random.choice(NOMBRES_EJEMPLO)} {random.choice(APELLIDOS_EJEMPLO)} "
            f"{random.randint(100, 9999)}"
        )
        avatar_aleatorio = f"{random.choice(PERSONAJES_PERMITIDOS)}|corona_imperial"

        # 3. Registrar al invitado en la base de datos
        payload_registro = {
            "evento_id": self.evento_id,
            "nombre_invitado": self.nombre_invitado,
            "avatar_munequito": avatar_aleatorio,
        }

        with self.client.post(
            "/api/invitados/registro",
            json=payload_registro,
            name="/api/invitados/registro",
            catch_response=True,
        ) as resp_reg:
            if resp_reg.status_code == 200:
                try:
                    data_reg = resp_reg.json()
                    self.invitado_id = data_reg["invitado"]["id"]
                    self.token_sesion = data_reg.get("token_sesion")
                    self.registrado_ok = True
                except Exception as e:
                    resp_reg.failure(f"Error leyendo JSON de registro: {e}")
            else:
                resp_reg.failure(
                    f"Fallo al registrar invitado ({resp_reg.status_code}): {resp_reg.text}"
                )

    # --------------------------------------------------------------------------
    # TAREA A (PESO PRINCIPAL = 18): CONSULTA DE TRIVIA Y RESPUESTA EN VIVO
    # --------------------------------------------------------------------------
    @task(18)
    def consultar_trivia_y_responder(self):
        """
        Tarea principal (+90% del tráfico total):
        - Consulta el estado en tiempo real de la sala de trivia.
        - Si hay una pregunta activa con ronda abierta y no la ha respondido aún,
          envía una respuesta aleatoria (A, B, C o D) calculando la velocidad.
        """
        if not self.registrado_ok or not self.evento_id or not self.invitado_id:
            return

        url_estado = (
            f"/api/eventos/{self.evento_id}/trivia/estado"
            f"?invitado_id={self.invitado_id}&en_sala_trivia=true"
        )

        with self.client.get(
            url_estado,
            name="/api/eventos/[id]/trivia/estado",
            catch_response=True,
        ) as resp_estado:
            if resp_estado.status_code != 200:
                resp_estado.failure(f"Error consultando estado de trivia: {resp_estado.status_code}")
                return

            try:
                data = resp_estado.json()
            except Exception:
                return

            pregunta_activa = data.get("pregunta_activa")
            ronda_cerrada = bool(data.get("ronda_cerrada"))

            # Si hay una pregunta en curso y la ronda no se ha cerrado:
            if pregunta_activa and not ronda_cerrada:
                pid = pregunta_activa.get("id")
                if pid and pid not in self.preguntas_respondidas:
                    # Enviar respuesta simulando tiempo de reacción humano (800ms a 4200ms)
                    tiempo_ms = random.randint(800, 4200)
                    opcion_random = random.choice(["A", "B", "C", "D"])

                    payload_respuesta = {
                        "evento_id": self.evento_id,
                        "pregunta_id": pid,
                        "invitado_id": self.invitado_id,
                        "opcion_elegida": opcion_random,
                        "tiempo_respuesta_ms": tiempo_ms,
                    }

                    with self.client.post(
                        "/api/trivia/responder",
                        json=payload_respuesta,
                        name="/api/trivia/responder",
                        catch_response=True,
                    ) as resp_vot:
                        if resp_vot.status_code == 200:
                            self.preguntas_respondidas.add(pid)
                        else:
                            resp_vot.failure(
                                f"Fallo al responder pregunta ({resp_vot.status_code}): {resp_vot.text}"
                            )

    # --------------------------------------------------------------------------
    # TAREA B (PESO LIGERO = 1): SUBIDA CONTROLADA DE MÁXIMO 1 O 2 FOTOS
    # --------------------------------------------------------------------------
    @task(1)
    def subir_fotografia_evento(self):
        """
        Tarea acotada a la realidad:
        - Cada invitado sube únicamente 1 o 2 fotos durante toda la fiesta.
        - Una vez alcanzado el cupo personal, no sube más fotos para evitar bucles infinitos.
        """
        if not self.registrado_ok or not self.evento_id or not self.invitado_id:
            return

        if self.fotos_subidas_cuenta >= self.max_fotos_sesion:
            return

        # Seleccionar una imagen del pool pre-generado en RAM
        imagen_bytes = random.choice(POOL_IMAGENES_TEST)
        nombre_archivo = f"stress_{self.invitado_id[:6]}_{int(time.time()*1000)%100000}.jpg"

        archivos = {
            "archivo": (nombre_archivo, imagen_bytes, "image/jpeg"),
        }
        datos_formulario = {
            "evento_id": self.evento_id,
            "invitado_id": self.invitado_id,
            "puntaje_ia_cliente": "95",
        }

        with self.client.post(
            "/api/multimedia/subir",
            data=datos_formulario,
            files=archivos,
            name="/api/multimedia/subir",
            catch_response=True,
        ) as resp_subida:
            if resp_subida.status_code == 200:
                self.fotos_subidas_cuenta += 1
            else:
                resp_subida.failure(
                    f"Fallo en subida de foto ({resp_subida.status_code}): {resp_subida.text}"
                )

    # --------------------------------------------------------------------------
    # TAREA C (PESO LIGERO = 1): LATIDO Y PANTALLA PROYECTOR
    # --------------------------------------------------------------------------
    @task(1)
    def consultar_pantalla_proyector(self):
        """
        Tarea ligera de lectura: simula la consulta periódica de la pantalla gigante
        o estado de la galería para evaluar la concurrencia en endpoints GET.
        """
        if not self.evento_id:
            return

        self.client.get(
            f"/api/proyector/estado?evento_id={self.evento_id}",
            name="/api/proyector/estado",
        )

    # --------------------------------------------------------------------------
    # TAREA D (PESO CONTROLADO = 2): SOLICITUD DE PASE VIP & CRM LEADS (9 DÍGITOS)
    # --------------------------------------------------------------------------
    @task(2)
    def solicitar_pase_vip_crm(self):
        """
        Simula que el invitado solicita su Pase VIP & Descuento Especial en el CRM:
        - Se ejecuta una sola vez por usuario calificado (~50-80 invitados en la simulación).
        - Genera números celulares peruanos de EXACTAMENTE 9 DÍGITOS (iniciando con 9 + 8 dígitos aleatorios).
        - Genera fechas de nacimiento válidas y correos opcionales realistas.
        - Envía la petición POST /api/eventos/{evento_id}/leads para poblar el CRM en vivo.
        """
        if not self.registrado_ok or not self.evento_id or self.lead_crm_registrado:
            return

        if not self.desea_pase_vip_crm:
            self.lead_crm_registrado = True
            return

        # Número de teléfono peruano estricto de exactamente 9 dígitos (9XXXXXXXX)
        telefono_9_digitos = f"9{random.randint(10000000, 99999999)}"

        # Fecha de nacimiento diversa (enriqueciendo rangos de Quinceañeras y Cumpleaños)
        anio_actual = 2026
        edad_simulada = random.choices([11, 14, 15, 16, 20, 24, 30, 42], weights=[10, 20, 25, 15, 10, 10, 5, 5])[0]
        anio_nac = anio_actual - edad_simulada
        mes_nac = f"{random.randint(1, 12):02d}"
        dia_nac = f"{random.randint(1, 28):02d}"
        fecha_nacimiento = f"{anio_nac}-{mes_nac}-{dia_nac}"

        nombre_lead = getattr(self, "nombre_invitado", None) or f"{random.choice(NOMBRES_EJEMPLO)} {random.choice(APELLIDOS_EJEMPLO)}"
        genero_simulado = random.choice(["Femenino", "Masculino", "Otro"])
        correo_simulado = (
            f"{nombre_lead.lower().replace(' ', '.')}{random.randint(10, 999)}@gmail.com"
            if random.random() < 0.70
            else None
        )

        payload_lead = {
            "evento_id": self.evento_id,
            "nombre": nombre_lead,
            "telefono": telefono_9_digitos,
            "fecha_nacimiento": fecha_nacimiento,
            "genero": genero_simulado,
            "correo": correo_simulado,
        }

        with self.client.post(
            f"/api/eventos/{self.evento_id}/leads",
            json=payload_lead,
            name="/api/eventos/[id]/leads",
            catch_response=True,
        ) as resp_lead:
            if resp_lead.status_code == 200:
                self.lead_crm_registrado = True
            else:
                resp_lead.failure(
                    f"Fallo al registrar lead CRM ({resp_lead.status_code}): {resp_lead.text}"
                )

    def on_stop(self):
        """
        Desconexión suave al pausar o detener el test en Locust.
        """
        if self.invitado_id:
            try:
                self.client.post(
                    f"/api/invitados/{self.invitado_id}/desconectar",
                    name="/api/invitados/[id]/desconectar",
                )
            except Exception:
                pass
