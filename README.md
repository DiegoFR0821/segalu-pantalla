# MVP Segalu - Sistema Interactivo para Eventos

Sistema web interactivo en tiempo real para la empresa de eventos **Segalu** (2 locales). Diseñado para bodas, XV años y aniversarios con moderación de fotos en vivo, trivia interactiva estilo Kahoot y pantalla de proyección optimizada para OBS Studio.

---

## 📁 Estructura del Proyecto

```text
SEGALU/
├── database/
│   └── schema_mvp_segalu.sql   <-- [Fase 1] Script SQL en 3FN para Supabase
├── backend/                    <-- [Fase 2] Servidor Python / FastAPI / Procesamiento de imágenes
├── frontend/                   <-- [Fases 3, 4 y 5]
│   ├── admin/                  <-- Panel de moderación y control de trivia
│   ├── invitado/               <-- Interfaz móvil (QR, fotos, trivia Kahoot)
│   ├── proyector/              <-- Vista para OBS Studio (proyector.html)
│   └── static/                 <-- CSS, JS e imágenes/avatares
└── README.md
```

---

## 🗺️ Fases del Proyecto

- **Fase 1:** Base de datos relacional (PostgreSQL / Supabase) en 3ra Forma Normal (3FN) y Modelo de Seguridad. *(Actual)*
- **Fase 2:** Backend en Python (FastAPI/Flask), conexión segura y servicio de marca de agua/pre-filtro para imágenes.
- **Fase 3:** Frontend Móvil para Invitados (Escaneo QR, selección de Avatar, subida de fotos).
- **Fase 4:** Motor de Trivia estilo Kahoot en vivo (WebSockets/Realtime, 4 opciones, cálculo de velocidad y podio).
- **Fase 5:** Panel de Control del Administrador y Pantalla Gigante OBS (`proyector.html`).
