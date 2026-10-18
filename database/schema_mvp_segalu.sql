-- ==============================================================================
-- PROYECTO: MVP WEB SEGALU (Eventos & Experiencias)
-- ARCHIVO: database/schema_mvp_segalu.sql
-- DESCRIPCIÓN: Estructura de base de datos relacional en 3ra Forma Normal (3FN)
-- COMPATIBILIDAD: PostgreSQL 14+ / Supabase SQL Editor
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. LIMPIEZA PREVIA (Opcional: útil durante desarrollo para reiniciar pruebas)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS respuestas_trivia CASCADE;
DROP TABLE IF EXISTS preguntas CASCADE;
DROP TABLE IF EXISTS multimedia CASCADE;
DROP TABLE IF EXISTS invitados CASCADE;
DROP TABLE IF EXISTS eventos CASCADE;
DROP TABLE IF EXISTS locales CASCADE;

-- ------------------------------------------------------------------------------
-- 1. TABLA: LOCALES
-- DIDÁCTICA: Representa las sedes físicas de la empresa "Segalu" (2 locales).
-- Cumple 1FN, 2FN y 3FN al no mezclar datos de eventos ni duplicar información
-- de ubicación en cada evento.
-- ------------------------------------------------------------------------------
CREATE TABLE locales (
    -- PK: Identificador único universal (UUID) que previene enumeración maliciosa
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,          -- Ej: 'Sede 1 - El Colocho', 'Sede 2 - Crystal Garden'
    direccion VARCHAR(255) NOT NULL,              -- Ubicación física del local
    telefono_contacto VARCHAR(20),                -- Teléfono de administración
    capacidad_maxima INT CHECK (capacidad_maxima > 0), -- Regla de Integridad: aforo positivo
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE locales IS 'Almacena las sedes físicas de Segalu.';

-- ------------------------------------------------------------------------------
-- 2. TABLA: EVENTOS
-- DIDÁCTICA: Cada celebración (boda, XV años, corporativo) se realiza en un
-- local específico. 
-- Relación: Muchos eventos pertenecen a 1 local (1:N).
-- ------------------------------------------------------------------------------
CREATE TABLE eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FK: Conecta con la tabla locales. ON DELETE RESTRICT impide borrar un local si tiene eventos históricos.
    local_id UUID NOT NULL REFERENCES locales(id) ON DELETE RESTRICT,
    
    nombre VARCHAR(120) NOT NULL,                 -- Ej: 'Boda de Sofia y Mateo'
    codigo_acceso VARCHAR(20) NOT NULL UNIQUE,    -- Código legible para URL/QR (Ej: 'BODA-SOFIA-2026')
    fecha_evento DATE NOT NULL,                   -- Fecha del evento
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('borrador', 'activo', 'finalizado')),
    
    -- Control en vivo para el Administrador
    trivia_activa BOOLEAN DEFAULT FALSE,          -- ¿Se está jugando la trivia en este momento?
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE eventos IS 'Registra cada evento programado en los locales de Segalu.';

-- ------------------------------------------------------------------------------
-- 3. TABLA: INVITADOS
-- DIDÁCTICA: Los invitados ingresan escaneando el QR de la mesa.
-- Solo proporcionan su Nombre y su Avatar (muñequito). No requieren contraseña.
-- Relación: Muchos invitados pertenecen a 1 evento (1:N).
-- ------------------------------------------------------------------------------
CREATE TABLE invitados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FK: Si el evento se elimina, se borran sus invitados en cascada (ON DELETE CASCADE)
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    
    nombre VARCHAR(60) NOT NULL,                  -- Nombre o apodo del invitado (Ej: 'Tía Gloria', 'Carlos M.')
    avatar VARCHAR(50) NOT NULL,                  -- Nombre del muñequito (Ej: 'avatar_leon', 'avatar_cohete')
    puntaje_total INT DEFAULT 0 CHECK (puntaje_total >= 0), -- Puntaje acumulado en las trivias
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- REGLA DE INTEGRIDAD: En un mismo evento, evitamos dos invitados con el mismo nombre exacto
    CONSTRAINT uq_invitado_por_evento UNIQUE (evento_id, nombre)
);

COMMENT ON TABLE invitados IS 'Participantes del evento autenticados de forma ultra-ligera (nombre + avatar).';

-- ------------------------------------------------------------------------------
-- 4. TABLA: MULTIMEDIA (Fotos y Clips Cortos)
-- DIDÁCTICA: Fotos o clips subidos por los invitados desde sus móviles.
-- Maneja el ciclo de vida: Subida -> Pre-filtro IA -> Pendiente -> Aprobación Admin.
-- Relación: Muchas fotos pertenecen a 1 evento y opcionalmente a 1 invitado.
-- ------------------------------------------------------------------------------
CREATE TABLE multimedia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FK: Vinculación con el evento
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    
    -- FK: Quién la subió. Si el invitado se desvincula, la foto se mantiene (ON DELETE SET NULL)
    invitado_id UUID REFERENCES invitados(id) ON DELETE SET NULL,
    
    url_original TEXT NOT NULL,                   -- Enlace a la imagen subida sin procesar (Supabase Storage)
    url_con_marca TEXT,                           -- Enlace a la imagen tras aplicar el marco y logo "Segalu"
    tipo VARCHAR(10) DEFAULT 'foto' CHECK (tipo IN ('foto', 'video')),
    
    -- Filtros de Moderación y Seguridad
    filtro_ia_aprobado BOOLEAN DEFAULT TRUE,      -- Marcado por el microservicio gratuito de pre-filtro de contenido
    estado_moderacion VARCHAR(20) DEFAULT 'pendiente' 
        CHECK (estado_moderacion IN ('pendiente', 'aprobado', 'rechazado')),
        
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE multimedia IS 'Archivos fotográficos y de video subidos por los invitados con estados de moderación.';

-- ------------------------------------------------------------------------------
-- 5. TABLA: PREGUNTAS (Trivia estilo Kahoot)
-- DIDÁCTICA: Banco de preguntas preparadas para el evento (4 alternativas).
-- Relación: Muchas preguntas pertenecen a 1 evento (1:N).
-- ------------------------------------------------------------------------------
CREATE TABLE preguntas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FK: Vinculación con el evento específico
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    
    enunciado TEXT NOT NULL,                      -- Pregunta: Ej: '¿En qué año se conocieron los novios?'
    opcion_a TEXT NOT NULL,                       -- Alternativa A (Rojo / Triángulo)
    opcion_b TEXT NOT NULL,                       -- Alternativa B (Azul / Rombo)
    opcion_c TEXT NOT NULL,                       -- Alternativa C (Amarillo / Círculo)
    opcion_d TEXT NOT NULL,                       -- Alternativa D (Verde / Cuadrado)
    
    respuesta_correcta CHAR(1) NOT NULL CHECK (respuesta_correcta IN ('A', 'B', 'C', 'D')),
    tiempo_limite_segundos INT DEFAULT 20 CHECK (tiempo_limite_segundos BETWEEN 5 AND 60),
    orden INT DEFAULT 1 CHECK (orden > 0),        -- Posición de la pregunta en la ronda
    
    -- Estados controlados por el Administrador en tiempo real
    activa BOOLEAN DEFAULT FALSE,                 -- TRUE cuando el Admin lanza la pregunta a los celulares
    revelar_respuesta BOOLEAN DEFAULT FALSE,      -- TRUE cuando se agota el tiempo y OBS muestra la solución
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE preguntas IS 'Preguntas de opción múltiple para las dinámicas interactivas del evento.';

-- ------------------------------------------------------------------------------
-- 6. TABLA: RESPUESTAS_TRIVIA
-- DIDÁCTICA: Registro individual del voto de cada invitado para una pregunta.
-- Permite calcular puntajes por velocidad (milisegundos) y armar el podio.
-- Relación: Tabla asociativa (N:M resuelta) entre Invitados y Preguntas.
-- ------------------------------------------------------------------------------
CREATE TABLE respuestas_trivia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- FKs: Conexión con la pregunta y el invitado
    pregunta_id UUID NOT NULL REFERENCES preguntas(id) ON DELETE CASCADE,
    invitado_id UUID NOT NULL REFERENCES invitados(id) ON DELETE CASCADE,
    
    opcion_elegida CHAR(1) NOT NULL CHECK (opcion_elegida IN ('A', 'B', 'C', 'D')),
    tiempo_respuesta_ms INT NOT NULL CHECK (tiempo_respuesta_ms >= 0), -- Milisegundos transcurridos para bono de velocidad
    es_correcta BOOLEAN NOT NULL,                 -- Calculado al momento de responder
    puntos_obtenidos INT DEFAULT 0 CHECK (puntos_obtenidos >= 0),
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- REGLA DE INTEGRIDAD CRÍTICA: Un invitado solo puede emitir 1 respuesta por pregunta
    CONSTRAINT uq_una_respuesta_por_invitado UNIQUE (pregunta_id, invitado_id)
);

COMMENT ON TABLE respuestas_trivia IS 'Respuestas emitidas por los invitados con medición de tiempo para scoring Kahoot.';

-- ------------------------------------------------------------------------------
-- 7. ÍNDICES DE RENDIMIENTO (DISPONIBILIDAD & OPTIMIZACIÓN)
-- DIDÁCTICA: Los índices aceleran las búsquedas de llaves foráneas y consultas en vivo
-- ------------------------------------------------------------------------------
CREATE INDEX idx_eventos_codigo ON eventos(codigo_acceso);
CREATE INDEX idx_invitados_evento ON invitados(evento_id);
CREATE INDEX idx_invitados_ranking ON invitados(evento_id, puntaje_total DESC);
CREATE INDEX idx_multimedia_moderacion ON multimedia(evento_id, estado_moderacion);
CREATE INDEX idx_preguntas_evento ON preguntas(evento_id, orden);
CREATE INDEX idx_respuestas_pregunta ON respuestas_trivia(pregunta_id);

-- ------------------------------------------------------------------------------
-- 8. POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS) EN SUPABASE
-- DIDÁCTICA: RLS actúa como un cortafuegos a nivel de fila dentro del motor PostgreSQL.
-- ------------------------------------------------------------------------------
ALTER TABLE locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitados ENABLE ROW LEVEL SECURITY;
ALTER TABLE multimedia ENABLE ROW LEVEL SECURITY;
ALTER TABLE preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas_trivia ENABLE ROW LEVEL SECURITY;

-- Regla 1: Lectura pública de locales (para que la app o admin liste las sedes)
CREATE POLICY "Lectura publica de locales" 
ON locales FOR SELECT USING (true);

-- Regla 2: Lectura y gestión de eventos desde el servidor Python
CREATE POLICY "Lectura de eventos" 
ON eventos FOR SELECT USING (true);

CREATE POLICY "Permitir crear eventos desde servidor"
ON eventos FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualizar eventos desde servidor"
ON eventos FOR UPDATE USING (true) WITH CHECK (true);

-- Regla 3: Invitados pueden registrarse libremente indicando el evento
CREATE POLICY "Permitir registro de invitados" 
ON invitados FOR INSERT WITH CHECK (true);

-- Regla 4: Lectura de invitados del evento (para ver el ranking y autor de fotos)
CREATE POLICY "Lectura publica de invitados para ranking" 
ON invitados FOR SELECT USING (true);

-- Regla 4.1: Permitir actualizar el avatar/muñequito del invitado (Fase 2.5)
CREATE POLICY "Permitir actualizar avatar de invitado"
ON invitados FOR UPDATE USING (true) WITH CHECK (true);

-- Regla 4.2: Permitir eliminar invitado al corregir su nombre o limpiar evento (Fase 2.5)
CREATE POLICY "Permitir eliminar invitado"
ON invitados FOR DELETE USING (true);

-- Regla 5: Invitados pueden subir fotos (en 'pendiente' o 'aprobado' cuando Auto-Aprobar está activo)
CREATE POLICY "Subida de multimedia por invitados" 
ON multimedia FOR INSERT WITH CHECK (estado_moderacion IN ('pendiente', 'aprobado'));

-- Regla 6: Lectura y moderación de multimedia gestionada por el backend Python
-- (El endpoint público solo entrega 'aprobado' al proyector, y el endpoint /api/admin
-- protegido por ADMIN_PASSWORD entrega las 'pendiente' al Administrador)
CREATE POLICY "Lectura de multimedia para moderacion y proyeccion" 
ON multimedia FOR SELECT USING (true);

CREATE POLICY "Moderacion de multimedia por administrador"
ON multimedia FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Eliminacion de multimedia por administrador"
ON multimedia FOR DELETE USING (true);

-- Regla 7: Gestión y lectura de preguntas de Trivia controlada por el servidor Python (Fase 4)
-- (El servidor Python oculta 'respuesta_correcta' a los celulares hasta que el Admin la revela)
CREATE POLICY "Lectura de preguntas activas" 
ON preguntas FOR SELECT USING (true);

CREATE POLICY "Permitir crear preguntas desde servidor"
ON preguntas FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualizar preguntas desde servidor"
ON preguntas FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Permitir eliminar preguntas desde servidor"
ON preguntas FOR DELETE USING (true);

-- Regla 8: Invitados pueden insertar su respuesta y el servidor puede consultarlas para el puntaje
CREATE POLICY "Registro de respuesta trivia" 
ON respuestas_trivia FOR INSERT WITH CHECK (true);

CREATE POLICY "Lectura de respuestas trivia"
ON respuestas_trivia FOR SELECT USING (true);

CREATE POLICY "Permitir eliminar respuestas trivia"
ON respuestas_trivia FOR DELETE USING (true);

-- ------------------------------------------------------------------------------
-- 9. DATOS SEMILLA (SEED DATA DIDÁCTICO PARA PRUEBAS INICIALES)
-- ------------------------------------------------------------------------------
INSERT INTO locales (nombre, direccion, telefono_contacto, capacidad_maxima)
VALUES 
    ('Sede 1 - El Colocho', 'Av. Manuel Prado - KM 22, Carabayllo', '907512340', 300),
    ('Sede 2 - Crystal Garden', 'Av. Manuel Prado - KM 22, Carabayllo', '907512340', 300)
ON CONFLICT (nombre) DO NOTHING;

-- Evento de demostración inicial para probar el escaneo QR en la Fase 2 (Código: SEGALU-2026)
INSERT INTO eventos (local_id, nombre, codigo_acceso, fecha_evento, estado, trivia_activa)
SELECT id, 'Gran Fiesta Inaugural Segalu', 'SEGALU-2026', CURRENT_DATE, 'activo', FALSE
FROM locales
WHERE nombre = 'Sede 1 - El Colocho'
ON CONFLICT (codigo_acceso) DO NOTHING;

