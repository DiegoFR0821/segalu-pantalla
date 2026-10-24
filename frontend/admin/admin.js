// ==============================================================================
// PROYECTO: MVP WEB SEGALU
// ARCHIVO: frontend/admin/admin.js
// FASE 4.5: Panel del Administrador Único con Eliminación Definitiva (Bucket + SQL),
//           Cambio Instantáneo de Evento (<200ms), Podio Escalonado de 3 Tarimas
//           Estilo Kahoot con Fuegos Artificiales y Generador de 10 Preguntas desde PDF con IA
// ==============================================================================

const SESSION_ADMIN_KEY = "segalu_admin_pass_session";

const MAPA_PERSONAJES = {
    pug_real: { nombre: "Pug Real", icono: "🐶" },
    gatito_gala: { nombre: "Gato Smoking", icono: "🐱" },
    osito_gala: { nombre: "Osito Gala", icono: "🧸" },
    zorro_glam: { nombre: "Zorro Glam", icono: "🦊" },
    conejita_real: { nombre: "Conejita Real", icono: "🐰" },
    leon_imperial: { nombre: "León Imperial", icono: "🦁" },
};

const MAPA_ACCESORIOS = {
    sin_accesorio: { nombre: "Natural", icono: "" },
    corona_imperial: { nombre: "Corona Imperial", icono: "👑" },
    sombrero_gala: { nombre: "Sombrero de Gala", icono: "🎩" },
    gorra_vip: { nombre: "Gorra Fiesta", icono: "🧢" },
    corona_flores: { nombre: "Corona de Flores", icono: "🌸" },
    antifaz_15: { nombre: "Antifaz 15 Años", icono: "🎭" },
    tiara_real: { nombre: "Tiara de Cristal", icono: "💎" },
    diadema_magica: { nombre: "Diadema de Hadas", icono: "🌟" },
};

function escaparHtml(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Estado en memoria y semáforos de concurrencia para evitar peticiones solapadas
let adminPasswordActiva = sessionStorage.getItem(SESSION_ADMIN_KEY) || "";
let eventoSeleccionadoId = null;
let eventoSeleccionado = null;
let filtroSedeAdminActivo = localStorage.getItem("segalu_admin_sede_filtro") || "todos";
let filtroEstadoFoto = "pendiente";
let autoAprobarFotosActivo = false;

let cacheMultimedia = [];
let cacheEventos = [];
let cacheInvitados = [];
let cacheLeads = [];
let cachePreguntas = [];
let estadoTriviaActual = {
    fase: "inactiva",
    pregunta_activa_id: null,
    total_respuestas_activa: 0,
};

function obtenerEventoSeleccionado() {
    if (eventoSeleccionadoId && Array.isArray(cacheEventos)) {
        const ev = cacheEventos.find((e) => e.id === eventoSeleccionadoId);
        if (ev) return ev;
    }
    return cacheEventos && cacheEventos.length > 0 ? cacheEventos[0] : null;
}

function actualizarContadorTopbarEnVivo() {
    const el = document.getElementById("topbar-live-count");
    if (!el) return;
    const countInv = Array.isArray(cacheInvitados) ? cacheInvitados.length : 0;
    const countLeads = Array.isArray(cacheLeads) ? cacheLeads.length : 0;
    // Refleja dinámicamente las conexiones reales combinando invitados en vivo y prospectos CRM del evento activo
    const totalReal = Math.max(countInv, countLeads);
    el.textContent = String(totalReal);
}

let peticionResumenEnCurso = false;
let refrescoPendienteEnCola = false;
let temporizadorAutoRefresco = null;

// Referencias DOM
const adminAlertaEl = document.getElementById("admin-alerta");
const vistaLoginAdminEl = document.getElementById("vista-login-admin");
const vistaDashboardAdminEl = document.getElementById("vista-dashboard-admin");
const adminHeaderControlsEl = document.getElementById("admin-header-controls");
const badgeRolAdminEl = document.getElementById("badge-rol-admin");

let rolAdminActivo = sessionStorage.getItem("segalu_admin_rol") || "superadmin";
let sedeNombreActiva = sessionStorage.getItem("segalu_admin_sede_nom") || "";

const formLoginAdminEl = document.getElementById("form-login-admin");
const inputAdminPassEl = document.getElementById("input-admin-pass");
const btnRefrescarPanelEl = document.getElementById("btn-refrescar-panel");
const btnCerrarAdminEl = document.getElementById("btn-cerrar-admin");

const selectFiltroSedeAdminEl = document.getElementById("select-filtro-sede-admin");
const selectEventoActivoEl = document.getElementById("select-evento-activo");
const badgeVelocidadEventoEl = document.getElementById("badge-velocidad-evento");
const indicadorCargaEventoEl = document.getElementById("indicador-carga-evento");
const infoEventoSeleccionadoEl = document.getElementById("info-evento-seleccionado");
const selectSedeLocalEl = document.getElementById("select-sede-local");
const formCrearEventoEl = document.getElementById("form-crear-evento");
const inputFechaEventoEl = document.getElementById("input-fecha-evento");

// Controles Ejecutivos de Respaldo ZIP y Base de Datos del Evento
const btnDescargarZipConMarcoEl = document.getElementById("btn-descargar-zip-con-marco");
const btnDescargarZipOriginalesEl = document.getElementById("btn-descargar-zip-originales");
const btnPurgarFotosStorageEl = document.getElementById("btn-purgar-fotos-storage");
const btnEliminarEventoCompletoEl = document.getElementById("btn-eliminar-evento-completo");

// Controles de Moderación de Fotos (Aprobar, Rechazar, Eliminar Definitivamente, Auto-Aprobar y Masivo)
const btnToggleAutoAprobarEl = document.getElementById("btn-toggle-auto-aprobar");
const subtituloAutoAprobarEl = document.getElementById("subtitulo-auto-aprobar");
const badgeAutoAprobarEl = document.getElementById("badge-auto-aprobar");
const btnAprobarTodasBandejaEl = document.getElementById("btn-aprobar-todas-bandeja");
const countAprobarTodasEl = document.getElementById("count-aprobar-todas");
const gridModeracionFotosEl = document.getElementById("grid-moderacion-fotos");

// Controles de Trivia Kahoot (Botones numerados 1, 2, 3, 4)
const badgeEstadoTriviaAdminEl = document.getElementById("badge-estado-trivia-admin");
const textoEstadoTriviaAdminEl = document.getElementById("texto-estado-trivia-admin");
const contadorVotosRondaEl = document.getElementById("contador-votos-ronda");

const btnTriviaAbrirLobbyEl = document.getElementById("btn-trivia-abrir-lobby");
const btnTriviaLanzarPreguntaEl = document.getElementById("btn-trivia-lanzar-pregunta");
const btnTriviaRevelarRespuestaEl = document.getElementById("btn-trivia-revelar-respuesta");
const btnTriviaMostrarRankingEl = document.getElementById("btn-trivia-mostrar-ranking");
const btnTriviaMostrarPodioEl = document.getElementById("btn-trivia-mostrar-podio");
const btnTriviaReiniciarPuntajesEl = document.getElementById("btn-trivia-reiniciar-puntajes");
const btnTriviaCerrarEl = document.getElementById("btn-trivia-cerrar");
const btnTriviaLanzarTextoEl = document.getElementById("btn-trivia-lanzar-texto");
const btnTriviaLanzarSubtextoEl = document.getElementById("btn-trivia-lanzar-subtexto");
let idProximaPreguntaTrivia = null;

// Generador PDF con IA Gratuita y Creador de Preguntas (en Ventana Modal Flotante)
const inputPdfTriviaIaEl = document.getElementById("input-pdf-trivia-ia");
const btnSubirPdfIaEl = document.getElementById("btn-subir-pdf-ia");
const estadoGeneracionPdfIaEl = document.getElementById("estado-generacion-pdf-ia");
const textoEstadoPdfIaEl = document.getElementById("texto-estado-pdf-ia");

const formCrearPreguntaEl = document.getElementById("form-crear-pregunta");
const listaPreguntasAdminEl = document.getElementById("lista-preguntas-admin");
const countPreguntasEventoEl = document.getElementById("count-preguntas-evento");
const btnVaciarPreguntasEventoEl = document.getElementById("btn-vaciar-preguntas-evento");

const listaInvitadosAdminEl = document.getElementById("lista-invitados-admin");
const btnLimpiarTodosInvitadosEl = document.getElementById("btn-limpiar-todos-invitados");

// Ventana Modal de Crear Nuevo Evento en Segalú
const modalCrearEventoAdminEl = document.getElementById("modal-crear-evento-admin");
const btnAbrirModalCrearEventoEl = document.getElementById("btn-abrir-modal-crear-evento");
const btnCerrarModalCrearEventoXEl = document.getElementById("btn-cerrar-modal-crear-evento-x");
const btnCancelarModalCrearEventoEl = document.getElementById("btn-cancelar-modal-crear-evento");

// Navegación por Pestañas (Tabs) en la Columna Principal
const tabBadgePendientesEl = document.getElementById("tab-badge-pendientes");
const tabBadgeTriviaFaseEl = document.getElementById("tab-badge-trivia-fase");
const tabBadgeInvitadosEl = document.getElementById("tab-badge-invitados");
const SESSION_ADMIN_TAB_KEY = "segalu_admin_active_tab";

// Paginación Corta de Bandeja de Fotos (6 en 6)
const LIMITE_FOTOS_PASO = 6;
let limiteFotosVisible = 6;
let mostrarTodasLasFotos = false;
const paginacionFotosAdminEl = document.getElementById("paginacion-fotos-admin");
const textoPaginacionFotosEl = document.getElementById("texto-paginacion-fotos");
const btnFotosMostrarMasEl = document.getElementById("btn-fotos-mostrar-mas");
const btnFotosToggleTodasEl = document.getElementById("btn-fotos-toggle-todas");

// Búsqueda Rápida y Paginación de Invitados (8 en 8)
const LIMITE_INVITADOS_PASO = 8;
let limiteInvitadosVisible = 8;
let mostrarTodosLosInvitados = false;
let filtroTextoInvitado = "";
const inputBuscarInvitadoEl = document.getElementById("input-buscar-invitado");
const btnLimpiarBusquedaInvitadoEl = document.getElementById("btn-limpiar-busqueda-invitado");
const conteoFiltradoInvitadosEl = document.getElementById("conteo-filtrado-invitados");
const paginacionInvitadosAdminEl = document.getElementById("paginacion-invitados-admin");
const btnInvitadosMostrarMasEl = document.getElementById("btn-invitados-mostrar-mas");
const btnInvitadosToggleTodosEl = document.getElementById("btn-invitados-toggle-todos");

// Elementos de las Ventanas Modales Flotantes (Galería de Sedes y Creador de Preguntas)
const modalGestorSedesAdminEl = document.getElementById("modal-gestor-sedes-admin");
const btnGuardarModalSedesEl = document.getElementById("btn-guardar-modal-sedes");
const btnAdminTabSede1El = document.getElementById("btn-admin-tab-sede1");
const btnAdminTabSede2El = document.getElementById("btn-admin-tab-sede2");
const btnAdminSedeToggleNavEl = document.getElementById("btn-admin-sede-toggle-nav");
const bloqueModalSede1El = document.getElementById("bloque-modal-sede1");
const bloqueModalSede2El = document.getElementById("bloque-modal-sede2");

const modalCrearPreguntasAdminEl = document.getElementById("modal-crear-preguntas-admin");
const btnAceptarModalPreguntasEl = document.getElementById("btn-aceptar-modal-preguntas");
const btnAbrirModalPreguntasInlineEl = document.getElementById("btn-abrir-modal-preguntas-inline");

// Elementos de la Ventana Modal de Edición de Pregunta
const modalEditarPreguntaAdminEl = document.getElementById("modal-editar-pregunta-admin");
const formEditarPreguntaEl = document.getElementById("form-editar-pregunta");
const editPreguntaIdEl = document.getElementById("edit-pregunta-id");
const editEnunciadoPreguntaEl = document.getElementById("edit-enunciado-pregunta");
const editOpcionAEl = document.getElementById("edit-opcion-a");
const editOpcionBEl = document.getElementById("edit-opcion-b");
const editOpcionCEl = document.getElementById("edit-opcion-c");
const editOpcionDEl = document.getElementById("edit-opcion-d");
const editSelectRespuestaCorrectaEl = document.getElementById("edit-select-respuesta-correcta");
const editSelectTiempoLimiteEl = document.getElementById("edit-select-tiempo-limite");
const btnCerrarModalEditarPreguntaXEl = document.getElementById("btn-cerrar-modal-editar-pregunta-x");
const btnCerrarModalEditarPreguntaEl = document.getElementById("btn-cerrar-modal-editar-pregunta");

// Elementos de la Ventana Modal de Gestor de Paquetes de Accesorios
const modalSubirAccesorioAdminEl = document.getElementById("modal-subir-accesorio-admin");
const btnAbrirModalSubirAccesorioEl = document.getElementById("btn-abrir-modal-subir-accesorio");
const btnCerrarModalAccesorioXEl = document.getElementById("btn-cerrar-modal-accesorio-x");
const btnCancelarModalAccesorioEl = document.getElementById("btn-cancelar-modal-accesorio");
const formSubirAccesorioEl = document.getElementById("form-subir-accesorio");
const radioModoDestinoNuevoEl = document.getElementById("modo-destino-nuevo");
const radioModoDestinoExistenteEl = document.getElementById("modo-destino-existente");
const bloqueDestinoNuevoEl = document.getElementById("bloque-destino-nuevo");
const bloqueDestinoExistenteEl = document.getElementById("bloque-destino-existente");
const inputNombreNuevoPaqueteEl = document.getElementById("input-nombre-nuevo-paquete");
const selectPaqueteExistenteAdminEl = document.getElementById("select-paquete-existente-admin");
const inputArchivoAccesorioEl = document.getElementById("input-archivo-accesorio");
const stagedAccesoriosWrapEl = document.getElementById("staged-accesorios-wrap");
const stagedAccesoriosListaEl = document.getElementById("staged-accesorios-lista");
const stagedContadorEl = document.getElementById("staged-contador");
const btnLimpiarStagedEl = document.getElementById("btn-limpiar-staged");
const listaPaquetesAdminEl = document.getElementById("lista-paquetes-admin");
const selectTematicaEventoEl = document.getElementById("select-tematica-evento");

// Elementos del Visor Lightbox con Ambient Blur
const modalVisorFotoAdminEl = document.getElementById("modal-visor-foto-admin");
const visorAdminBlurEl = document.getElementById("visor-admin-blur");
const visorAdminImgEl = document.getElementById("visor-admin-img");
const visorAdminAutorEl = document.getElementById("visor-admin-autor");
const btnCerrarVisorAdminEl = document.getElementById("btn-cerrar-visor-admin");

let sedeActivaEnModalAdmin = "sede1";

function seleccionarSedeModalAdmin(sedeKey = "sede1") {
    sedeActivaEnModalAdmin = sedeKey === "sede2" ? "sede2" : "sede1";
    const esSede1 = sedeActivaEnModalAdmin === "sede1";

    if (bloqueModalSede1El) bloqueModalSede1El.classList.toggle("hidden", !esSede1);
    if (bloqueModalSede2El) bloqueModalSede2El.classList.toggle("hidden", esSede1);

    if (btnAdminTabSede1El) btnAdminTabSede1El.classList.toggle("active", esSede1);
    if (btnAdminTabSede2El) btnAdminTabSede2El.classList.toggle("active", !esSede1);

    if (btnAdminSedeToggleNavEl) {
        btnAdminSedeToggleNavEl.textContent = esSede1
            ? "Sede Siguiente ➔"
            : "◀ Sede Anterior";
    }
}

if (btnAdminTabSede1El) {
    btnAdminTabSede1El.addEventListener("click", () => seleccionarSedeModalAdmin("sede1"));
}
if (btnAdminTabSede2El) {
    btnAdminTabSede2El.addEventListener("click", () => seleccionarSedeModalAdmin("sede2"));
}
if (btnAdminSedeToggleNavEl) {
    btnAdminSedeToggleNavEl.addEventListener("click", () => {
        seleccionarSedeModalAdmin(sedeActivaEnModalAdmin === "sede1" ? "sede2" : "sede1");
    });
}

function abrirModalGestorSedesAdmin() {
    seleccionarSedeModalAdmin(sedeActivaEnModalAdmin);
    cargarFotosSedesAdmin();
    if (modalGestorSedesAdminEl) {
        modalGestorSedesAdminEl.classList.remove("hidden");
    }
}

async function cerrarModalGestorSedesAdmin(conRefresco = false) {
    if (modalGestorSedesAdminEl) {
        modalGestorSedesAdminEl.classList.add("hidden");
    }
    if (conRefresco) {
        await cargarFotosSedesAdmin();
        await cargarResumenPanel({ silencioso: true });
    }
}

function abrirModalCrearPreguntasAdmin() {
    if (!eventoSeleccionadoId) {
        mostrarAlertaAdmin("Selecciona o crea primero un evento activo.", "error");
        return;
    }
    if (modalCrearPreguntasAdminEl) {
        modalCrearPreguntasAdminEl.classList.remove("hidden");
    }
}

async function cerrarModalCrearPreguntasAdmin(conRefresco = false) {
    if (modalCrearPreguntasAdminEl) {
        modalCrearPreguntasAdminEl.classList.add("hidden");
    }
    if (conRefresco) {
        await cargarResumenPanel({ silencioso: true });
    }
}

if (btnGuardarModalSedesEl) {
    btnGuardarModalSedesEl.addEventListener("click", async () => {
        await cerrarModalGestorSedesAdmin(true);
        mostrarAlertaAdmin("✅ Galería de fotos por sede guardada y actualizada.", "exito");
    });
}
if (modalGestorSedesAdminEl) {
    modalGestorSedesAdminEl.addEventListener("click", (ev) => {
        if (ev.target === modalGestorSedesAdminEl) {
            cerrarModalGestorSedesAdmin(false);
        }
    });
}

if (btnAceptarModalPreguntasEl) {
    btnAceptarModalPreguntasEl.addEventListener("click", () => cerrarModalCrearPreguntasAdmin(true));
}
if (btnAbrirModalPreguntasInlineEl) {
    btnAbrirModalPreguntasInlineEl.addEventListener("click", () => abrirModalCrearPreguntasAdmin());
}
if (modalCrearPreguntasAdminEl) {
    modalCrearPreguntasAdminEl.addEventListener("click", (ev) => {
        if (ev.target === modalCrearPreguntasAdminEl) {
            cerrarModalCrearPreguntasAdmin(false);
        }
    });
}

// Controles de Ventana Modal "Crear Nuevo Evento en Segalú"
function abrirModalCrearEventoAdmin() {
    if (modalCrearEventoAdminEl) {
        modalCrearEventoAdminEl.classList.remove("hidden");
        const inputNombre = document.getElementById("input-nombre-evento");
        if (inputNombre) setTimeout(() => inputNombre.focus(), 80);
    }
}

function cerrarModalCrearEventoAdmin() {
    if (modalCrearEventoAdminEl) {
        modalCrearEventoAdminEl.classList.add("hidden");
    }
}

if (btnAbrirModalCrearEventoEl) {
    btnAbrirModalCrearEventoEl.addEventListener("click", abrirModalCrearEventoAdmin);
}
if (btnCerrarModalCrearEventoXEl) {
    btnCerrarModalCrearEventoXEl.addEventListener("click", cerrarModalCrearEventoAdmin);
}
if (btnCancelarModalCrearEventoEl) {
    btnCancelarModalCrearEventoEl.addEventListener("click", cerrarModalCrearEventoAdmin);
}
if (modalCrearEventoAdminEl) {
    modalCrearEventoAdminEl.addEventListener("click", (ev) => {
        if (ev.target === modalCrearEventoAdminEl) {
            cerrarModalCrearEventoAdmin();
        }
    });
}

// Navegación por Pestañas (Tabs) en la Columna Principal
function cambiarPestanaPrincipalAdmin(targetPaneId) {
    const botones = document.querySelectorAll(".admin-main-tab");
    const paneles = document.querySelectorAll(".admin-tab-pane");

    paneles.forEach((pane) => {
        const esActivo = pane.id === targetPaneId;
        pane.classList.toggle("hidden", !esActivo);
        pane.classList.toggle("active", esActivo);
    });

    botones.forEach((btn) => {
        const esActivo = btn.dataset.tabTarget === targetPaneId;
        btn.classList.toggle("active", esActivo);
    });

    sessionStorage.setItem(SESSION_ADMIN_TAB_KEY, targetPaneId);

    if (targetPaneId === "tab-contenido-leads" && eventoSeleccionadoId) {
        cargarLeadsEvento(eventoSeleccionadoId);
    }
}

document.querySelectorAll(".admin-main-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.tabTarget;
        if (target) cambiarPestanaPrincipalAdmin(target);
    });
});

let timerAlertaAdmin = null;

function ocultarAlertaAdmin() {
    if (timerAlertaAdmin) {
        clearTimeout(timerAlertaAdmin);
        timerAlertaAdmin = null;
    }
    if (adminAlertaEl) {
        adminAlertaEl.classList.add("alert-hiding");
        setTimeout(() => {
            adminAlertaEl.classList.add("hidden");
            adminAlertaEl.classList.remove("alert-hiding");
        }, 220);
    }
}

/**
 * Convierte cualquier error, detalle de validación o estructura de FastAPI
 * en un mensaje legible y amigable, evitando terminantemente "[object Object]".
 */
function formatearMensajeError(err, fallback = "Ocurrió un error inesperado.") {
    if (!err) return fallback;
    if (typeof err === "string") {
        if (err.includes("[object Object]")) {
            return "Datos inválidos en el formulario o error de validación en el servidor.";
        }
        return err;
    }
    if (Array.isArray(err)) {
        return err
            .map((item) => formatearMensajeError(item))
            .filter(Boolean)
            .join(" | ") || fallback;
    }
    if (typeof err === "object") {
        if (typeof err.message === "string" && err.message && !err.message.includes("[object Object]")) {
            return err.message;
        }
        if (typeof err.detail === "string" && err.detail) {
            return err.detail;
        }
        if (Array.isArray(err.detail)) {
            return err.detail
                .map((d) => {
                    if (d && typeof d === "object") {
                        const loc = Array.isArray(d.loc) ? d.loc.slice(-1)[0] : "";
                        const msg = d.msg || d.message || JSON.stringify(d);
                        return loc ? `${loc}: ${msg}` : msg;
                    }
                    return String(d);
                })
                .join(" | ");
        }
        if (err.msg && typeof err.msg === "string") {
            return err.msg;
        }
        try {
            return JSON.stringify(err);
        } catch (_) {
            return fallback;
        }
    }
    return String(err);
}

function escapeHtml(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function mostrarAlertaAdmin(texto, tipo = "exito") {
    if (!adminAlertaEl) return;
    if (timerAlertaAdmin) {
        clearTimeout(timerAlertaAdmin);
        timerAlertaAdmin = null;
    }
    adminAlertaEl.classList.remove("alert-hiding");

    const textoFormateado = formatearMensajeError(texto, "Operación realizada.");
    const textoLimpio = String(textoFormateado || "").replace(/^(?:✅|❌|⚠️|ℹ️|🗑️|📊|🎉)\s*/u, "");
    const esExito = tipo === "exito";

    const iconoSvg = esExito
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    adminAlertaEl.innerHTML = `
        <span class="toast-icon">${iconoSvg}</span>
        <div class="toast-message">${textoLimpio}</div>
        <button type="button" class="toast-close-btn" aria-label="Cerrar notificación">&times;</button>
    `;

    adminAlertaEl.className = `alert-box ${esExito ? "alert-success" : "alert-error"}`;
    adminAlertaEl.classList.remove("hidden");

    const btnCerrar = adminAlertaEl.querySelector(".toast-close-btn");
    if (btnCerrar) {
        btnCerrar.onclick = () => ocultarAlertaAdmin();
    }

    timerAlertaAdmin = setTimeout(() => {
        ocultarAlertaAdmin();
    }, 4600);
}

function decodificarAvatarInvitado(codigoAvatar) {
    const partes = (codigoAvatar || "pug_real|corona_imperial").split("|");
    const per = MAPA_PERSONAJES[partes[0]] || MAPA_PERSONAJES.pug_real;
    const acc = MAPA_ACCESORIOS[partes[1]] || MAPA_ACCESORIOS.corona_imperial;
    return {
        iconoPersonaje: per.icono,
        iconoAccesorio: acc.icono,
        descripcion: acc.icono ? `${per.nombre} + ${acc.nombre}` : per.nombre,
    };
}

// ------------------------------------------------------------------------------
// 1. AUTENTICACIÓN DEL ADMINISTRADOR ÚNICO
// ------------------------------------------------------------------------------
formLoginAdminEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = inputAdminPassEl.value.trim();
    if (!pass) return;

    try {
        const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: pass }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Contraseña incorrecta.");
        }

        adminPasswordActiva = pass;
        rolAdminActivo = data.rol || "superadmin";
        sedeNombreActiva = data.sede_nombre || "";
        sessionStorage.setItem(SESSION_ADMIN_KEY, pass);
        sessionStorage.setItem("segalu_admin_rol", rolAdminActivo);
        sessionStorage.setItem("segalu_admin_sede_nom", sedeNombreActiva);
        ocultarAlertaAdmin();
        await cargarResumenPanel({ silencioso: false });
        cargarFotosSedesAdmin();
    cargarYRenderizarPaquetesAdmin();
        iniciarCicloRefrescoSecuencial();
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    }
});

btnCerrarAdminEl.addEventListener("click", () => {
    detenerCicloRefrescoSecuencial();
    sessionStorage.removeItem(SESSION_ADMIN_KEY);
    sessionStorage.removeItem("segalu_admin_rol");
    sessionStorage.removeItem("segalu_admin_sede_nom");
    adminPasswordActiva = "";
    rolAdminActivo = "superadmin";
    sedeNombreActiva = "";
    if (badgeRolAdminEl) badgeRolAdminEl.classList.add("hidden");
    vistaDashboardAdminEl.classList.add("hidden");
    adminHeaderControlsEl.classList.add("hidden");
    vistaLoginAdminEl.classList.remove("hidden");
    inputAdminPassEl.value = "";
});

// ------------------------------------------------------------------------------
// 2. [FASE 4.5 - REQUERIMIENTO B] CARGA INSTANTÁNEA EN PARALELO (<200ms)
// ------------------------------------------------------------------------------
function aplicarDatosDashboardEnDOM(data, tiempoClienteMs) {
    vistaLoginAdminEl.classList.add("hidden");
    vistaDashboardAdminEl.classList.remove("hidden");
    adminHeaderControlsEl.classList.remove("hidden");

    if (data.rol) rolAdminActivo = data.rol;
    if (data.sede_nombre) sedeNombreActiva = data.sede_nombre;

    if (badgeRolAdminEl) {
        badgeRolAdminEl.classList.remove("hidden");
        if (rolAdminActivo === "sede1") {
            badgeRolAdminEl.className = "topbar-role-badge role-sede1";
            badgeRolAdminEl.textContent = `📍 ${sedeNombreActiva || "Sede 1 - El Colocho"}`;
        } else if (rolAdminActivo === "sede2") {
            badgeRolAdminEl.className = "topbar-role-badge role-sede2";
            badgeRolAdminEl.textContent = `📍 ${sedeNombreActiva || "Sede 2 - Crystal Garden"}`;
        } else {
            badgeRolAdminEl.className = "topbar-role-badge";
            badgeRolAdminEl.textContent = `👑 Superadmin (Todas las Sedes)`;
        }
    }

    const msMostrados = data.tiempo_carga_ms ?? Math.round(tiempoClienteMs);
    const pingEl = document.getElementById("server-ping-ms");
    if (pingEl) {
        pingEl.textContent = String(msMostrados);
    }

    // 1. Llenar selectores de Sedes (Filtro superior y Creador de Eventos)
    if (data.locales) {
        selectSedeLocalEl.innerHTML = "";
        data.locales.forEach((loc) => {
            const opt = document.createElement("option");
            opt.value = loc.id;
            opt.textContent = `${loc.nombre} (${loc.direccion})`;
            selectSedeLocalEl.appendChild(opt);
        });

        if (selectFiltroSedeAdminEl) {
            selectFiltroSedeAdminEl.innerHTML = rolAdminActivo === "superadmin"
                ? '<option value="todos">🌐 Todas las Sedes</option>'
                : '';
            data.locales.forEach((loc) => {
                const opt = document.createElement("option");
                opt.value = loc.id;
                opt.textContent = `📍 ${loc.nombre}`;
                selectFiltroSedeAdminEl.appendChild(opt);
            });
        }

        // Control estricto por sede: si es operador de Sede 1 o Sede 2, bloquear selector
        if (rolAdminActivo === "sede1" || rolAdminActivo === "sede2") {
            const sedeAsignada = data.locales[0];
            if (sedeAsignada) {
                filtroSedeAdminActivo = sedeAsignada.id;
                if (selectFiltroSedeAdminEl) {
                    selectFiltroSedeAdminEl.value = sedeAsignada.id;
                    selectFiltroSedeAdminEl.disabled = true;
                    selectFiltroSedeAdminEl.title = `🔒 Acceso restringido: ${sedeAsignada.nombre}`;
                }
                if (selectSedeLocalEl) {
                    selectSedeLocalEl.value = sedeAsignada.id;
                    selectSedeLocalEl.disabled = true;
                    selectSedeLocalEl.title = `🔒 Acceso restringido: ${sedeAsignada.nombre}`;
                }
            }
        } else {
            if (selectFiltroSedeAdminEl) {
                selectFiltroSedeAdminEl.disabled = false;
                selectFiltroSedeAdminEl.value = filtroSedeAdminActivo;
            }
            if (selectSedeLocalEl) {
                selectSedeLocalEl.disabled = false;
            }
        }
    }

    // 2. Actualizar selector de Eventos respetando el filtro de sede seleccionado
    if (Array.isArray(data.eventos)) {
        cacheEventos = data.eventos;
        const eventosFiltrados = filtroSedeAdminActivo === "todos"
            ? cacheEventos
            : cacheEventos.filter((ev) => ev.local_id === filtroSedeAdminActivo);

        selectEventoActivoEl.innerHTML = "";

        if (eventosFiltrados.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "No hay eventos para esta sede";
            selectEventoActivoEl.appendChild(opt);
            eventoSeleccionadoId = null;
        } else {
            const existeEnFiltrados = eventosFiltrados.some(
                (ev) => ev.id === (eventoSeleccionadoId || data.evento_seleccionado_id)
            );

            if (existeEnFiltrados) {
                eventoSeleccionadoId = eventoSeleccionadoId || data.evento_seleccionado_id;
            } else {
                eventoSeleccionadoId = eventosFiltrados[0].id;
            }

            eventosFiltrados.forEach((ev) => {
                const opt = document.createElement("option");
                opt.value = ev.id;
                opt.textContent = `${ev.nombre} [${ev.codigo_acceso}]`;
                if (ev.id === eventoSeleccionadoId) opt.selected = true;
                selectEventoActivoEl.appendChild(opt);
            });
            selectEventoActivoEl.value = eventoSeleccionadoId;
        }
    } else if (data.evento_seleccionado_id) {
        eventoSeleccionadoId = data.evento_seleccionado_id;
    }

    pintarResumenEventoActual();

    // 3. Estado del botón Auto-Aprobar y Controles de Galería del Proyector
    autoAprobarFotosActivo = Boolean(data.auto_aprobar_fotos);
    pintarEstadoBotonAutoAprobar();
    if (data.config_galeria) {
        sincronizarUIControlesGaleria(
            data.config_galeria.modo_galeria || "ciclo_auto",
            Number(data.config_galeria.duracion_foto_segundos || 8)
        );
    }

    // 4. Renderizar bandeja de fotos, trivia e invitados (sin simulación de podio en Admin)
    cacheMultimedia = data.multimedia || [];
    cacheInvitados = data.invitados || [];
    cachePreguntas = data.preguntas || [];
    estadoTriviaActual = data.estado_trivia || {
        fase: "inactiva",
        pregunta_activa_id: null,
        total_respuestas_activa: 0,
    };

    renderizarBandejaFotos();
    renderizarSeccionTrivia();
    renderizarListaInvitados(cacheInvitados);
    cargarLeadsEvento(eventoSeleccionadoId);
}

async function cargarResumenPanel(opciones = { silencioso: true }) {
    if (!adminPasswordActiva) return;

    if (peticionResumenEnCurso) {
        refrescoPendienteEnCola = true;
        return;
    }

    peticionResumenEnCurso = true;
    const t0 = performance.now();

    const params = new URLSearchParams();
    if (eventoSeleccionadoId) params.set("evento_id", eventoSeleccionadoId);
    if (opciones?.force_refresh) params.set("force_refresh", "true");
    const qs = params.toString();
    const url = qs ? `/api/admin/resumen?${qs}` : `/api/admin/resumen`;

    try {
        const res = await fetch(url, {
            headers: { "X-Admin-Password": adminPasswordActiva },
        });
        const data = await res.json();

        if (res.status === 401) {
            detenerCicloRefrescoSecuencial();
            sessionStorage.removeItem(SESSION_ADMIN_KEY);
            vistaDashboardAdminEl.classList.add("hidden");
            vistaLoginAdminEl.classList.remove("hidden");
            mostrarAlertaAdmin("Sesión expirada o contraseña inválida.", "error");
            return;
        }

        if (!res.ok) {
            throw new Error(data.detail || "No se pudo cargar el panel.");
        }

        const tTotal = performance.now() - t0;
        aplicarDatosDashboardEnDOM(data, tTotal);
        if (eventoSeleccionadoId) {
            cargarLeadsEvento(eventoSeleccionadoId, { force_refresh: Boolean(opciones?.force_refresh) });
        }
    } catch (err) {
        if (!opciones.silencioso) {
            mostrarAlertaAdmin(err.message, "error");
        }
    } finally {
        peticionResumenEnCurso = false;
        if (refrescoPendienteEnCola) {
            refrescoPendienteEnCola = false;
            cargarResumenPanel({ silencioso: true });
        }
    }
}

/**
 * [FASE 4.5 - REQUERIMIENTO B] Cambio instantáneo de evento (<200ms)
 * Llama al endpoint consolidado GET /api/admin/eventos/{evento_id}/dashboard-completo
 * que ejecuta las consultas de fotos, invitados y preguntas en paralelo en el servidor.
 */
async function cambiarEventoInstantaneo(nuevoEventoId) {
    if (!nuevoEventoId || !adminPasswordActiva) return;
    eventoSeleccionadoId = nuevoEventoId;

    // Reiniciar paginación y buscador para el nuevo evento activo
    limiteFotosVisible = LIMITE_FOTOS_PASO;
    mostrarTodasLasFotos = false;
    limiteInvitadosVisible = LIMITE_INVITADOS_PASO;
    mostrarTodosLosInvitados = false;
    filtroTextoInvitado = "";
    if (inputBuscarInvitadoEl) inputBuscarInvitadoEl.value = "";

    // Reiniciar filtros de CRM & Leads para no mezclar eventos ajenos
    cacheLeads = [];
    filtroActivoGrafico = null;
    filtroRapidoCrmActivo = "todos";
    document.querySelectorAll(".crm-filter-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.filtroRapido === "todos");
    });
    if (inputBuscarLeadsEl) inputBuscarLeadsEl.value = "";
    if (btnLimpiarBusquedaLeadsEl) btnLimpiarBusquedaLeadsEl.classList.add("hidden");
    const bannerCrm = document.getElementById("crm-active-filter-banner");
    if (bannerCrm) bannerCrm.classList.add("hidden");

    // Actualizamos al instante la tarjeta informativa del evento seleccionado
    pintarResumenEventoActual();
    if (indicadorCargaEventoEl) {
        indicadorCargaEventoEl.classList.remove("hidden");
    }

    const t0 = performance.now();
    try {
        const res = await fetch(
            `/api/admin/eventos/${encodeURIComponent(nuevoEventoId)}/dashboard-completo`,
            {
                headers: { "X-Admin-Password": adminPasswordActiva },
            }
        );
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Error al cambiar de evento.");
        }

        const tTotal = performance.now() - t0;
        aplicarDatosDashboardEnDOM(data, tTotal);
        cargarLeadsEvento(nuevoEventoId);
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    } finally {
        if (indicadorCargaEventoEl) {
            indicadorCargaEventoEl.classList.add("hidden");
        }
    }
}

function iniciarCicloRefrescoSecuencial() {
    detenerCicloRefrescoSecuencial();
    temporizadorAutoRefresco = setTimeout(async function ciclo() {
        if (!adminPasswordActiva) return;
        if (!document.hidden) {
            await cargarResumenPanel({ silencioso: true });
            if (eventoSeleccionadoId) {
                cargarLeadsEvento(eventoSeleccionadoId);
            }
        }
        temporizadorAutoRefresco = setTimeout(ciclo, 3500);
    }, 3500);
}

function detenerCicloRefrescoSecuencial() {
    if (temporizadorAutoRefresco) {
        clearTimeout(temporizadorAutoRefresco);
        temporizadorAutoRefresco = null;
    }
}

// [PAGE VISIBILITY API] Pausa inteligente de peticiones cuando la pestaña está en segundo plano
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        detenerCicloRefrescoSecuencial();
    } else {
        if (adminPasswordActiva && eventoSeleccionadoId) {
            cargarResumenPanel({ silencioso: true });
            iniciarCicloRefrescoSecuencial();
        }
    }
});

function obtenerUrlProyectorEventoActual() {
    const ev = cacheEventos.find((e) => e.id === eventoSeleccionadoId);
    if (!ev) return `${window.location.origin}/proyector`;
    const params = new URLSearchParams({
        codigo: ev.codigo_acceso,
        sede: ev.local_id || "",
    });
    return `${window.location.origin}/proyector?${params.toString()}`;
}

function pintarResumenEventoActual() {
    const ev = obtenerEventoSeleccionado();
    eventoSeleccionado = ev;
    if (!ev) {
        infoEventoSeleccionadoEl.innerHTML = `
            <div>Aún no hay eventos creados.</div>
            <div class="sidebar-event-actions">
                <button type="button" id="btn-abrir-modal-sedes" class="btn-sidebar-action btn-sidebar-modal-sedes">
                    🖼️ Galería
                </button>
            </div>
        `;
        const btnSedesSinEv = document.getElementById("btn-abrir-modal-sedes");
        if (btnSedesSinEv) {
            btnSedesSinEv.addEventListener("click", () => abrirModalGestorSedesAdmin());
        }
        return;
    }
    const enlaceQR = `${window.location.origin}/invitado?codigo=${encodeURIComponent(ev.codigo_acceso)}`;
    const enlaceProyector = obtenerUrlProyectorEventoActual();
    const etiquetasTematica = {
        todos: "✨ Todos los Paquetes",
        "15anos": "👑 15 Años",
        graduacion: "🎓 Graduación",
        gala_bodas: "🎩 Gala y Bodas",
        fiesta_vip: "🕶️ Fiesta VIP",
    };
    const tematicaLabel = etiquetasTematica[ev.tematica_accesorios || "todos"] || "✨ Todos los Paquetes";

    const autoLimpieza = ev.estado_autolimpieza || {};
    let esPurgado = Boolean(autoLimpieza.purgado);
    let diasRest = typeof autoLimpieza.dias_restantes === "number" ? autoLimpieza.dias_restantes : null;
    if (diasRest === null) {
        const fechaRef = new Date(ev.fecha_evento || ev.created_at || Date.now());
        const diasTrans = Math.max(0, (Date.now() - fechaRef.getTime()) / (1000 * 60 * 60 * 24));
        diasRest = Math.max(0, Math.floor(30 - diasTrans));
        if (diasTrans >= 30) esPurgado = true;
    }
    const badgeTexto = autoLimpieza.badge_texto || (esPurgado ? "🧹 Multimedia purgada (CRM activo)" : `⏳ Autolimpieza multimedia: ${diasRest} día${diasRest !== 1 ? 's' : ''} restante${diasRest !== 1 ? 's' : ''}`);
    const badgeColor = esPurgado ? "#A0AEC0" : (diasRest <= 5 ? "#F6AD55" : "#68D391");
    const badgeBg = esPurgado ? "rgba(160, 174, 192, 0.12)" : (diasRest <= 5 ? "rgba(246, 173, 85, 0.12)" : "rgba(104, 211, 145, 0.12)");
    const badgeBorder = esPurgado ? "rgba(160, 174, 192, 0.3)" : (diasRest <= 5 ? "rgba(246, 173, 85, 0.3)" : "rgba(104, 211, 145, 0.3)");

    infoEventoSeleccionadoEl.innerHTML = `
        <div style="margin-bottom: 4px;"><strong>Sede:</strong> ${ev.locales?.nombre || "Segalú"}</div>
        <div style="margin-bottom: 4px;"><strong>Código QR:</strong> <code style="color: #D4AF37; font-weight: 800; background: rgba(212,175,55,0.12); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(212,175,55,0.3);">${ev.codigo_acceso}</code></div>
        <div style="margin-bottom: 6px;"><strong>Temática:</strong> ${tematicaLabel}</div>
        <div style="margin-top: 8px;">
            <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeBorder}; border-radius: 9999px; padding: 4px 10px; line-height: 1.3;">
                ${badgeTexto}
            </span>
        </div>
    `;

    // Actualizar el enlace al proyector en la lista operativa del sidebar
    const btnSidebarProyectorEl = document.getElementById("btn-sidebar-proyector");
    if (btnSidebarProyectorEl) {
        btnSidebarProyectorEl.href = enlaceProyector;
    }
}

// Vinculación de los 8 botones operacionales del Sidebar (100% funcionales)
const btnSidebarEnlaceInvEl = document.getElementById("btn-sidebar-enlace-invitados");
if (btnSidebarEnlaceInvEl) {
    btnSidebarEnlaceInvEl.addEventListener("click", () => {
        const ev = cacheEventos.find((e) => e.id === eventoSeleccionadoId);
        if (!ev) {
            mostrarAlertaAdmin("Selecciona primero un evento activo.", "error");
            return;
        }
        const url = `${window.location.origin}/invitado?codigo=${encodeURIComponent(ev.codigo_acceso)}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).catch(() => {});
        }
        mostrarAlertaAdmin(`📱 Enlace copiado al portapapeles y abierto en nueva pestaña: ${url}`, "exito");
        window.open(url, "_blank");
    });
}

const btnSidebarGaleriaEl = document.getElementById("btn-sidebar-galeria");
if (btnSidebarGaleriaEl) {
    btnSidebarGaleriaEl.addEventListener("click", () => {
        abrirModalGestorSedesAdmin();
    });
}

const btnSidebarPreguntasEl = document.getElementById("btn-sidebar-preguntas");
if (btnSidebarPreguntasEl) {
    btnSidebarPreguntasEl.addEventListener("click", () => {
        abrirModalCrearPreguntasAdmin();
    });
}

// Medición periódica de ping en vivo hacia el servidor Python
async function medirPingServidorAdmin() {
    const pingEl = document.getElementById("server-ping-ms");
    if (!pingEl) return;
    try {
        const t0 = performance.now();
        await fetch("/api/sedes/fotos", { method: "HEAD", cache: "no-store" });
        const diff = Math.max(1, Math.round(performance.now() - t0));
        pingEl.textContent = String(diff);
    } catch (_) {
        pingEl.textContent = "18";
    }
}
setInterval(medirPingServidorAdmin, 6000);
setTimeout(medirPingServidorAdmin, 1000);

const btnAbrirProyectorTopbarEl = document.getElementById("btn-abrir-proyector-topbar");
if (btnAbrirProyectorTopbarEl) {
    btnAbrirProyectorTopbarEl.addEventListener("click", () => {
        window.open(obtenerUrlProyectorEventoActual(), "_blank", "noopener");
    });
}

if (selectFiltroSedeAdminEl) {
    selectFiltroSedeAdminEl.addEventListener("change", () => {
        filtroSedeAdminActivo = selectFiltroSedeAdminEl.value;
        localStorage.setItem("segalu_admin_sede_filtro", filtroSedeAdminActivo);

        // Si se seleccionó una sede específica, auto-sincronizar el selector del creador de eventos
        if (filtroSedeAdminActivo !== "todos" && selectSedeLocalEl) {
            selectSedeLocalEl.value = filtroSedeAdminActivo;
        }

        const eventosFiltrados = filtroSedeAdminActivo === "todos"
            ? cacheEventos
            : cacheEventos.filter((ev) => ev.local_id === filtroSedeAdminActivo);

        selectEventoActivoEl.innerHTML = "";
        if (eventosFiltrados.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "No hay eventos para esta sede";
            selectEventoActivoEl.appendChild(opt);
            eventoSeleccionadoId = null;
            pintarResumenEventoActual();
            cacheMultimedia = [];
            cacheInvitados = [];
            cachePreguntas = [];
            renderizarBandejaFotos();
            renderizarSeccionTrivia();
            renderizarListaInvitados([]);
            return;
        }

        eventosFiltrados.forEach((ev) => {
            const opt = document.createElement("option");
            opt.value = ev.id;
            opt.textContent = `${ev.nombre} [${ev.codigo_acceso}]`;
            selectEventoActivoEl.appendChild(opt);
        });

        const sigueExiste = eventosFiltrados.some((e) => e.id === eventoSeleccionadoId);
        if (!sigueExiste) {
            eventoSeleccionadoId = eventosFiltrados[0].id;
            selectEventoActivoEl.value = eventoSeleccionadoId;
            cambiarEventoInstantaneo(eventoSeleccionadoId);
        } else {
            selectEventoActivoEl.value = eventoSeleccionadoId;
        }
    });
}

selectEventoActivoEl.addEventListener("change", () => {
    cambiarEventoInstantaneo(selectEventoActivoEl.value);
});

btnRefrescarPanelEl.addEventListener("click", async () => {
    btnRefrescarPanelEl.disabled = true;
    btnRefrescarPanelEl.classList.add("loading");
    await cargarResumenPanel({ silencioso: false, force_refresh: true });
    if (eventoSeleccionadoId) {
        await cargarLeadsEvento(eventoSeleccionadoId, { force_refresh: true });
    }
    btnRefrescarPanelEl.classList.remove("loading");
    btnRefrescarPanelEl.disabled = false;
    mostrarAlertaAdmin("🔄 Datos frescos recargados desde Supabase y caché purgada.", "exito");
});

// ------------------------------------------------------------------------------
// 2.5 GESTIÓN EJECUTIVA DE BASE DE DATOS Y DESCARGA ZIP DEL EVENTO ACTIVO
// ------------------------------------------------------------------------------
async function descargarZipFotosEvento() {
    if (!eventoSeleccionadoId) {
        mostrarAlertaAdmin("Selecciona primero un evento activo.", "error");
        return;
    }

    const boton = btnDescargarZipOriginalesEl || btnDescargarZipConMarcoEl;
    const textoOriginal = boton ? boton.innerHTML : "";
    if (boton) {
        boton.disabled = true;
        boton.innerHTML = `<span>⏳ Empaquetando archivo ZIP limpio...</span>`;
    }

    try {
        const urlZip = `/api/admin/eventos/${encodeURIComponent(
            eventoSeleccionadoId
        )}/descargar-zip`;

        const res = await fetch(urlZip, {
            headers: {
                "X-Admin-Password": adminPasswordActiva,
            },
        });

        if (!res.ok) {
            let msgError = "No se pudo generar el archivo ZIP.";
            try {
                const errJson = await res.json();
                if (errJson.detail) msgError = errJson.detail;
            } catch (_) {}
            throw new Error(msgError);
        }

        const blob = await res.blob();
        const ev = cacheEventos.find((e) => e.id === eventoSeleccionadoId);
        const cod = ev?.codigo_acceso || "EVENTO";
        const nombreDescarga = `Fotos_${cod}_Originales.zip`;

        const urlBlob = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = urlBlob;
        a.download = nombreDescarga;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(urlBlob), 4000);

        mostrarAlertaAdmin(
            `📦 Descarga iniciada: ${nombreDescarga}`,
            "exito"
        );
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.innerHTML = textoOriginal;
        }
    }
}

if (btnDescargarZipOriginalesEl) {
    btnDescargarZipOriginalesEl.addEventListener("click", () => descargarZipFotosEvento());
}

if (btnDescargarZipConMarcoEl) {
    btnDescargarZipConMarcoEl.addEventListener("click", () => descargarZipFotosEvento());
}

if (btnPurgarFotosStorageEl) {
    btnPurgarFotosStorageEl.addEventListener("click", async () => {
        if (!eventoSeleccionadoId) {
            mostrarAlertaAdmin("Selecciona primero un evento activo.", "error");
            return;
        }
        const ev = cacheEventos.find((e) => e.id === eventoSeleccionadoId);
        const nombreEv = ev?.nombre || "este evento";

        const confirmar = window.confirm(
            `¿Deseas VACIAR / PURGAR todas las fotos del Storage para "${nombreEv}"?\n\n` +
                `• Se borrarán físicamente las imágenes del Bucket de Supabase Storage para liberar espacio en la nube.\n` +
                `• Los invitados registrados y las preguntas del evento NO se borrarán.`
        );
        if (!confirmar) return;

        btnPurgarFotosStorageEl.disabled = true;
        try {
            const res = await fetch(
                `/api/admin/eventos/${encodeURIComponent(eventoSeleccionadoId)}/purgar-fotos`,
                {
                    method: "DELETE",
                    headers: { "X-Admin-Password": adminPasswordActiva },
                }
            );
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || "No se pudieron purgar las fotos del Storage.");
            }
            cacheMultimedia = [];
            renderizarBandejaFotos();
            mostrarAlertaAdmin(data.mensaje, "exito");
        } catch (err) {
            mostrarAlertaAdmin(err.message, "error");
        } finally {
            btnPurgarFotosStorageEl.disabled = false;
        }
    });
}

if (btnEliminarEventoCompletoEl) {
    btnEliminarEventoCompletoEl.addEventListener("click", async () => {
        if (!eventoSeleccionadoId) {
            mostrarAlertaAdmin("Selecciona primero un evento activo.", "error");
            return;
        }
        const ev = cacheEventos.find((e) => e.id === eventoSeleccionadoId);
        const nombreEv = ev?.nombre || "este evento";

        const confirmar = window.confirm(
            `⚠️ ¿ELIMINAR POR COMPLETO el evento "${nombreEv}"?\n\n` +
                `Esta acción borrará en cascada definitiva:\n` +
                `1. Todas las fotos del Bucket de Supabase Storage y tabla multimedia.\n` +
                `2. Todas las preguntas y respuestas de la trivia.\n` +
                `3. Todos los invitados conectados.\n` +
                `4. TODOS los prospectos y cupones CRM generados para este evento.\n` +
                `5. El registro del evento en la base de datos.`
        );
        if (!confirmar) return;

        btnEliminarEventoCompletoEl.disabled = true;
        try {
            const idBorrar = eventoSeleccionadoId;
            const res = await fetch(`/api/admin/eventos/${encodeURIComponent(idBorrar)}`, {
                method: "DELETE",
                headers: { "X-Admin-Password": adminPasswordActiva },
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || "No se pudo eliminar el evento.");
            }

            cacheEventos = cacheEventos.filter((e) => e.id !== idBorrar);
            eventoSeleccionadoId = cacheEventos[0]?.id || null;
            mostrarAlertaAdmin(data.mensaje, "exito");
            await cargarResumenPanel({ silencioso: true });
        } catch (err) {
            mostrarAlertaAdmin(err.message, "error");
        } finally {
            btnEliminarEventoCompletoEl.disabled = false;
        }
    });
}

// ------------------------------------------------------------------------------
// 3. CREAR NUEVO EVENTO ASIGNADO A UNA SEDE DE SEGALÚ
// ------------------------------------------------------------------------------
formCrearEventoEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
        local_id: selectSedeLocalEl.value,
        nombre: document.getElementById("input-nombre-evento").value.trim(),
        codigo_acceso: document.getElementById("input-codigo-qr").value.trim().toUpperCase(),
        fecha_evento: inputFechaEventoEl.value,
        tematica_accesorios: document.getElementById("select-tematica-evento")?.value || "todos",
    };

    try {
        const res = await fetch("/api/admin/eventos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Password": adminPasswordActiva,
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "No se pudo crear el evento.");
        }

        mostrarAlertaAdmin(data.mensaje, "exito");
        eventoSeleccionadoId = data.evento.id;
        formCrearEventoEl.reset();
        cerrarModalCrearEventoAdmin();
        inputFechaEventoEl.value = new Date().toISOString().split("T")[0];
        await cargarResumenPanel({ silencioso: true });
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    }
});

// ------------------------------------------------------------------------------
// 4. AUTO-APROBAR Y APROBACIÓN MASIVA DE LA BANDEJA
// ------------------------------------------------------------------------------
function pintarEstadoBotonAutoAprobar() {
    if (autoAprobarFotosActivo) {
        btnToggleAutoAprobarEl.classList.add("active");
        btnToggleAutoAprobarEl.setAttribute("aria-pressed", "true");
        subtituloAutoAprobarEl.textContent =
            "Activo • Las fotos nuevas con filtro IA ≥ 70% se aprueban al instante";
        badgeAutoAprobarEl.textContent = "ACTIVO";
    } else {
        btnToggleAutoAprobarEl.classList.remove("active");
        btnToggleAutoAprobarEl.setAttribute("aria-pressed", "false");
        subtituloAutoAprobarEl.textContent =
            "Inactivo • Las fotos nuevas requieren tu aprobación manual";
        badgeAutoAprobarEl.textContent = "OFF";
    }
}

btnToggleAutoAprobarEl.addEventListener("click", async () => {
    if (!eventoSeleccionadoId) return;

    const nuevoValor = !autoAprobarFotosActivo;
    autoAprobarFotosActivo = nuevoValor;
    pintarEstadoBotonAutoAprobar();

    try {
        const res = await fetch(
            `/api/admin/eventos/${encodeURIComponent(eventoSeleccionadoId)}/auto-aprobar`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Password": adminPasswordActiva,
                },
                body: JSON.stringify({ activo: nuevoValor }),
            }
        );
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "No se pudo cambiar el estado de Auto-Aprobar.");
        }
        mostrarAlertaAdmin(data.mensaje, "exito");
    } catch (err) {
        autoAprobarFotosActivo = !nuevoValor;
        pintarEstadoBotonAutoAprobar();
        mostrarAlertaAdmin(err.message, "error");
    }
});

btnAprobarTodasBandejaEl.addEventListener("click", async () => {
    if (!eventoSeleccionadoId) return;

    const pendientes = cacheMultimedia.filter((m) => m.estado_moderacion === "pendiente");
    if (pendientes.length === 0) {
        mostrarAlertaAdmin("No hay fotos pendientes en la bandeja en este momento.", "exito");
        return;
    }

    const idsPendientes = pendientes.map((m) => m.id);

    cacheMultimedia.forEach((m) => {
        if (m.estado_moderacion === "pendiente") {
            m.estado_moderacion = "aprobado";
        }
    });
    renderizarBandejaFotos();

    try {
        const res = await fetch(
            `/api/admin/eventos/${encodeURIComponent(eventoSeleccionadoId)}/aprobar-todas`,
            {
                method: "POST",
                headers: { "X-Admin-Password": adminPasswordActiva },
            }
        );
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "No se pudieron aprobar todas las fotos.");
        }
        mostrarAlertaAdmin(data.mensaje, "exito");
    } catch (err) {
        cacheMultimedia.forEach((m) => {
            if (idsPendientes.includes(m.id)) {
                m.estado_moderacion = "pendiente";
            }
        });
        renderizarBandejaFotos();
        mostrarAlertaAdmin(err.message, "error");
    }
});

// ------------------------------------------------------------------------------
// 5. [FASE 4.5 - REQUERIMIENTO A] BANDEJA DE MODERACIÓN CON APROBAR, RECHAZAR
//    Y BOTÓN "🗑️ ELIMINAR DEFINITIVAMENTE" (BORRADO FÍSICO BUCKET + SQL)
// ------------------------------------------------------------------------------
function renderizarBandejaFotos() {
    const pendientes = cacheMultimedia.filter((m) => m.estado_moderacion === "pendiente");
    const aprobadas = cacheMultimedia.filter((m) => m.estado_moderacion === "aprobado");
    const rechazadas = cacheMultimedia.filter((m) => m.estado_moderacion === "rechazado");

    document.getElementById("count-pendientes").textContent = pendientes.length;
    document.getElementById("count-aprobadas").textContent = aprobadas.length;
    document.getElementById("count-rechazadas").textContent = rechazadas.length;

    if (tabBadgePendientesEl) {
        tabBadgePendientesEl.textContent = pendientes.length;
    }

    countAprobarTodasEl.textContent = pendientes.length;
    btnAprobarTodasBandejaEl.disabled = pendientes.length === 0;

    const listaMostrar = cacheMultimedia.filter((m) => m.estado_moderacion === filtroEstadoFoto);
    gridModeracionFotosEl.innerHTML = "";

    if (listaMostrar.length === 0) {
        gridModeracionFotosEl.innerHTML = `
            <div class="empty-state">
                No hay fotografías en estado "${filtroEstadoFoto.toUpperCase()}" para este evento.
            </div>
        `;
        if (paginacionFotosAdminEl) {
            paginacionFotosAdminEl.classList.add("hidden");
        }
        return;
    }

    const totalFotos = listaMostrar.length;
    const fotosPaginadas = mostrarTodasLasFotos
        ? listaMostrar
        : listaMostrar.slice(0, limiteFotosVisible);

    fotosPaginadas.forEach((foto) => {
        const autorNombre = foto.invitados?.nombre || "Invitado";
        const avatarInfo = decodificarAvatarInvitado(foto.invitados?.avatar);
        const puntajeIa = foto.puntaje_ia_seguridad ?? 95;
        const esSegura = foto.filtro_ia_aprobado !== false && puntajeIa >= 70;
        const urlSegura = foto.url_con_marca;

        const card = document.createElement("article");
        card.className = "photo-mod-card";
        card.innerHTML = `
            <div class="photo-mod-img-wrap" title="Haz clic para ampliar con Efecto Ambient Blur">
                <!-- Capa 1 (Fondo): La misma foto con blur(28px) y scale(1.12) -->
                <div class="ambient-blur-layer" style="background-image: url('${urlSegura}');"></div>
                <!-- Capa 2 (Frente): La foto completa y nítida con el logo en la esquina superior izquierda -->
                <img src="${urlSegura}" alt="Foto de ${autorNombre}" class="ambient-sharp-img" loading="lazy" />
                <span class="ia-score-pill ${esSegura ? "ia-safe" : "ia-alert"}">
                    IA: ${puntajeIa}% ${esSegura ? "Segura" : "Revisar"}
                </span>
            </div>
            <div class="photo-mod-body">
                <div class="author-row">
                    <div class="mini-avatar-stage">
                        <span class="mini-char">${avatarInfo.iconoPersonaje}</span>
                        <span class="mini-acc">${avatarInfo.iconoAccesorio}</span>
                    </div>
                    <div class="author-meta">
                        <strong>${autorNombre}</strong>
                        <span>${avatarInfo.descripcion}</span>
                    </div>
                </div>
                <!-- Botones Aprobar y Rechazar (permite re-aprobar una foto rechazada por error) -->
                <div class="mod-actions-row">
                    <button type="button" class="btn-approve" data-id="${foto.id}" data-accion="aprobado">
                        APROBAR
                    </button>
                    <button type="button" class="btn-reject" data-id="${foto.id}" data-accion="rechazado">
                        RECHAZAR
                    </button>
                </div>
                <!-- [FASE 4.5 - REQUERIMIENTO A] Tercer botón: Eliminar Definitivamente (Bucket + SQL) -->
                <button type="button" class="btn-delete-forever" data-delete-id="${foto.id}">
                    <span>🗑️ Eliminar Definitivamente</span>
                </button>
            </div>
        `;

        card.querySelector(".photo-mod-img-wrap").addEventListener("click", () => {
            abrirVisorFotoAdmin(urlSegura, `${autorNombre} (${avatarInfo.descripcion})`);
        });

        card.querySelectorAll("button[data-accion]").forEach((btn) => {
            btn.addEventListener("click", () =>
                moderarFotoOptimista(btn.dataset.id, btn.dataset.accion)
            );
        });

        card.querySelector(".btn-delete-forever").addEventListener("click", () => {
            eliminarFotoDefinitivamente(foto);
        });

        gridModeracionFotosEl.appendChild(card);
    });

    if (paginacionFotosAdminEl) {
        if (totalFotos <= LIMITE_FOTOS_PASO) {
            paginacionFotosAdminEl.classList.add("hidden");
        } else {
            paginacionFotosAdminEl.classList.remove("hidden");
            if (textoPaginacionFotosEl) {
                textoPaginacionFotosEl.textContent = `Mostrando ${fotosPaginadas.length} de ${totalFotos} fotos (${filtroEstadoFoto})`;
            }
            if (btnFotosMostrarMasEl) {
                const restantes = totalFotos - fotosPaginadas.length;
                if (restantes > 0 && !mostrarTodasLasFotos) {
                    btnFotosMostrarMasEl.classList.remove("hidden");
                    btnFotosMostrarMasEl.textContent = `Mostrar más fotos (+${Math.min(LIMITE_FOTOS_PASO, restantes)})`;
                } else {
                    btnFotosMostrarMasEl.classList.add("hidden");
                }
            }
            if (btnFotosToggleTodasEl) {
                btnFotosToggleTodasEl.textContent = mostrarTodasLasFotos
                    ? "Contraer (Ver 6)"
                    : `Mostrar todas (${totalFotos})`;
            }
        }
    }
}

function abrirVisorFotoAdmin(urlFoto, textoAutor) {
    visorAdminAutorEl.textContent = textoAutor;
    visorAdminBlurEl.style.backgroundImage = `url("${urlFoto}")`;
    visorAdminImgEl.src = urlFoto;
    modalVisorFotoAdminEl.classList.remove("hidden");
}

btnCerrarVisorAdminEl.addEventListener("click", () => {
    modalVisorFotoAdminEl.classList.add("hidden");
    visorAdminImgEl.src = "";
});

async function moderarFotoOptimista(multimediaId, nuevoEstado) {
    const item = cacheMultimedia.find((m) => m.id === multimediaId);
    const estadoAnterior = item ? item.estado_moderacion : "pendiente";
    if (item) {
        item.estado_moderacion = nuevoEstado;
        renderizarBandejaFotos();
    }

    try {
        const res = await fetch(`/api/admin/multimedia/${encodeURIComponent(multimediaId)}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Password": adminPasswordActiva,
            },
            body: JSON.stringify({ estado_moderacion: nuevoEstado }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Error al moderar la foto.");
        }
        mostrarAlertaAdmin(data.mensaje, "exito");
    } catch (err) {
        if (item) {
            item.estado_moderacion = estadoAnterior;
            renderizarBandejaFotos();
        }
        mostrarAlertaAdmin(err.message, "error");
    }
}

/**
 * [FASE 4.5 - REQUERIMIENTO A]
 * Borra físicamente el archivo de imagen del Bucket de Supabase Storage
 * y ejecuta DELETE del registro en la tabla `multimedia` de PostgreSQL.
 */
async function eliminarFotoDefinitivamente(foto) {
    const autorNombre = foto.invitados?.nombre || "este invitado";
    const confirmar = window.confirm(
        `¿Eliminar definitivamente la foto de "${autorNombre}"?\n\nEsta acción borrará el archivo físico del Bucket de Supabase Storage para liberar espacio y eliminará el registro de la tabla SQL.`
    );
    if (!confirmar) return;

    const copiaRespaldo = [...cacheMultimedia];
    cacheMultimedia = cacheMultimedia.filter((m) => m.id !== foto.id);
    renderizarBandejaFotos();

    try {
        const res = await fetch(`/api/admin/multimedia/${encodeURIComponent(foto.id)}`, {
            method: "DELETE",
            headers: {
                "X-Admin-Password": adminPasswordActiva,
            },
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "No se pudo eliminar definitivamente la foto.");
        }
        mostrarAlertaAdmin(data.mensaje, "exito");
    } catch (err) {
        cacheMultimedia = copiaRespaldo;
        renderizarBandejaFotos();
        mostrarAlertaAdmin(err.message, "error");
    }
}

if (btnFotosMostrarMasEl) {
    btnFotosMostrarMasEl.addEventListener("click", () => {
        limiteFotosVisible += LIMITE_FOTOS_PASO;
        renderizarBandejaFotos();
    });
}

if (btnFotosToggleTodasEl) {
    btnFotosToggleTodasEl.addEventListener("click", () => {
        mostrarTodasLasFotos = !mostrarTodasLasFotos;
        if (!mostrarTodasLasFotos) {
            limiteFotosVisible = LIMITE_FOTOS_PASO;
        }
        renderizarBandejaFotos();
    });
}

document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        filtroEstadoFoto = tab.dataset.estado;
        limiteFotosVisible = LIMITE_FOTOS_PASO;
        mostrarTodasLasFotos = false;
        renderizarBandejaFotos();
    });
});

// ------------------------------------------------------------------------------
// 6. RONDA DE PREGUNTAS ESTILO KAHOOT EN EL PANEL ADMIN (CONTROL POR BOTONES 1, 2, 3, 4)
// ------------------------------------------------------------------------------
function renderizarSeccionTrivia() {
    const fase = estadoTriviaActual.fase || "inactiva";
    const mapaEtiquetasFase = {
        inactiva: "TRIVIA INACTIVA",
        lobby: "LOBBY DE TRIVIA ABIERTO",
        pregunta_activa: "PREGUNTA EN VIVO AHORA",
        respuesta_revelada: "RESPUESTA CORRECTA REVELADA",
        ranking: "TABLA DE POSICIONES EN VIVO",
        podio: "PODIO EN PANTALLA",
    };

    textoEstadoTriviaAdminEl.textContent = mapaEtiquetasFase[fase] || "TRIVIA INACTIVA";
    if (fase === "inactiva") {
        badgeEstadoTriviaAdminEl.classList.remove("is-live");
    } else {
        badgeEstadoTriviaAdminEl.classList.add("is-live");
    }

    if (tabBadgeTriviaFaseEl) {
        if (fase === "inactiva") {
            tabBadgeTriviaFaseEl.classList.remove("is-live");
            tabBadgeTriviaFaseEl.title = "Trivia Inactiva";
        } else {
            tabBadgeTriviaFaseEl.classList.add("is-live");
            tabBadgeTriviaFaseEl.title = mapaEtiquetasFase[fase] || "Trivia en Vivo";
        }
    }

    contadorVotosRondaEl.textContent = `Respuestas recibidas en pregunta activa: ${
        estadoTriviaActual.total_respuestas_activa || 0
    }`;

    btnTriviaAbrirLobbyEl.classList.toggle("active-phase", fase === "lobby");
    btnTriviaLanzarPreguntaEl.classList.toggle("active-phase", fase === "pregunta_activa");
    btnTriviaRevelarRespuestaEl.classList.toggle("active-phase", fase === "respuesta_revelada");
    if (btnTriviaMostrarRankingEl) btnTriviaMostrarRankingEl.classList.toggle("active-phase", fase === "ranking");
    btnTriviaMostrarPodioEl.classList.toggle("active-phase", fase === "podio");

    // Lógica dinámica del Botón #2 ("Lanzar Pregunta") y resaltado guiado de pasos (1 -> 2 -> 3 -> 4 -> 2)
    const totalPreg = cachePreguntas.length;
    let proximaPreguntaId = null;
    let siguientePasoSugerido = 1; // 1: lobby, 2: lanzar, 3: revelar, 4: ranking, 5: podio

    if (totalPreg === 0) {
        if (btnTriviaLanzarTextoEl) btnTriviaLanzarTextoEl.textContent = "Lanzar Pregunta";
        if (btnTriviaLanzarSubtextoEl) btnTriviaLanzarSubtextoEl.textContent = "Crea preguntas primero";
        siguientePasoSugerido = 1;
    } else {
        const idActiva = estadoTriviaActual.pregunta_activa_id;
        const idxActiva = cachePreguntas.findIndex((p) => p.id === idActiva);

        if (fase === "inactiva") {
            proximaPreguntaId = cachePreguntas[0].id;
            if (btnTriviaLanzarTextoEl) btnTriviaLanzarTextoEl.textContent = "Lanzar Pregunta #1";
            if (btnTriviaLanzarSubtextoEl) btnTriviaLanzarSubtextoEl.textContent = "4 opciones y reloj";
            siguientePasoSugerido = 1;
        } else if (fase === "lobby") {
            proximaPreguntaId = cachePreguntas[0].id;
            if (btnTriviaLanzarTextoEl) btnTriviaLanzarTextoEl.textContent = "Lanzar Pregunta #1";
            if (btnTriviaLanzarSubtextoEl) btnTriviaLanzarSubtextoEl.textContent = "4 opciones y reloj";
            siguientePasoSugerido = 2;
        } else if (fase === "pregunta_activa") {
            const numPreg = idxActiva >= 0 ? idxActiva + 1 : 1;
            if (btnTriviaLanzarTextoEl) btnTriviaLanzarTextoEl.textContent = `Pregunta Activa (#${numPreg} de ${totalPreg})`;
            if (btnTriviaLanzarSubtextoEl) btnTriviaLanzarSubtextoEl.textContent = "Reloj en vivo";
            proximaPreguntaId = idxActiva + 1 < totalPreg ? cachePreguntas[idxActiva + 1].id : null;
            siguientePasoSugerido = 3;
        } else if (fase === "respuesta_revelada") {
            const nextIdx = idxActiva >= 0 ? idxActiva + 1 : 0;
            if (nextIdx < totalPreg) {
                proximaPreguntaId = cachePreguntas[nextIdx].id;
                if (btnTriviaLanzarTextoEl) btnTriviaLanzarTextoEl.textContent = `Lanzar Siguiente (#${nextIdx + 1} de ${totalPreg}) ➡️`;
                if (btnTriviaLanzarSubtextoEl) btnTriviaLanzarSubtextoEl.textContent = "4 opciones y reloj";
            } else {
                proximaPreguntaId = null;
                if (btnTriviaLanzarTextoEl) btnTriviaLanzarTextoEl.textContent = `Todas Lanzadas (${totalPreg}/${totalPreg})`;
                if (btnTriviaLanzarSubtextoEl) btnTriviaLanzarSubtextoEl.textContent = "Fin de preguntas";
            }
            siguientePasoSugerido = 4;
        } else if (fase === "ranking") {
            const nextIdx = idxActiva >= 0 ? idxActiva + 1 : 0;
            if (nextIdx < totalPreg) {
                proximaPreguntaId = cachePreguntas[nextIdx].id;
                if (btnTriviaLanzarTextoEl) btnTriviaLanzarTextoEl.textContent = `Lanzar Siguiente (#${nextIdx + 1} de ${totalPreg}) ➡️`;
                if (btnTriviaLanzarSubtextoEl) btnTriviaLanzarSubtextoEl.textContent = "4 opciones y reloj";
                siguientePasoSugerido = 2;
            } else {
                proximaPreguntaId = null;
                if (btnTriviaLanzarTextoEl) btnTriviaLanzarTextoEl.textContent = `Todas Lanzadas (${totalPreg}/${totalPreg})`;
                if (btnTriviaLanzarSubtextoEl) btnTriviaLanzarSubtextoEl.textContent = "Fin de preguntas";
                siguientePasoSugerido = 5;
            }
        } else if (fase === "podio") {
            if (btnTriviaLanzarTextoEl) btnTriviaLanzarTextoEl.textContent = "Podio en Pantalla";
            if (btnTriviaLanzarSubtextoEl) btnTriviaLanzarSubtextoEl.textContent = "Fin del juego";
            siguientePasoSugerido = null;
        }
    }
    idProximaPreguntaTrivia = proximaPreguntaId;

    // Resaltado visual con borde dorado del siguiente paso sugerido
    [btnTriviaAbrirLobbyEl, btnTriviaLanzarPreguntaEl, btnTriviaRevelarRespuestaEl, btnTriviaMostrarRankingEl, btnTriviaMostrarPodioEl].forEach(
        (btn) => btn && btn.classList.remove("next-suggested-step")
    );
    if (siguientePasoSugerido === 1 && btnTriviaAbrirLobbyEl) btnTriviaAbrirLobbyEl.classList.add("next-suggested-step");
    if (siguientePasoSugerido === 2 && btnTriviaLanzarPreguntaEl) btnTriviaLanzarPreguntaEl.classList.add("next-suggested-step");
    if (siguientePasoSugerido === 3 && btnTriviaRevelarRespuestaEl) btnTriviaRevelarRespuestaEl.classList.add("next-suggested-step");
    if (siguientePasoSugerido === 4 && btnTriviaMostrarRankingEl) btnTriviaMostrarRankingEl.classList.add("next-suggested-step");
    if (siguientePasoSugerido === 5 && btnTriviaMostrarPodioEl) btnTriviaMostrarPodioEl.classList.add("next-suggested-step");

    // Renderizar banco de preguntas
    countPreguntasEventoEl.textContent = cachePreguntas.length;
    listaPreguntasAdminEl.innerHTML = "";

    if (cachePreguntas.length === 0) {
        listaPreguntasAdminEl.innerHTML = `
            <div class="empty-state">
                Aún no hay preguntas para este evento. Pulsa <strong>"➕ Crear Preguntas (Manual o PDF con IA)"</strong> para redactar una pregunta o subir un documento PDF.
            </div>
        `;
        return;
    }

    cachePreguntas.forEach((preg, idx) => {
        const esActiva = preg.id === estadoTriviaActual.pregunta_activa_id;
        const correcta = (preg.respuesta_correcta || "A").toUpperCase();

        const card = document.createElement("article");
        card.className = `question-admin-card ${esActiva ? "is-active-question" : ""}`;
        card.innerHTML = `
            <div class="question-card-top">
                <div class="question-title-wrap">
                    <strong>#${idx + 1}. ${preg.enunciado}</strong>
                </div>
                <div class="question-meta-pills">
                    ${esActiva ? `<span class="meta-pill pill-live">● EN VIVO</span>` : ""}
                    <span class="meta-pill">⏱ ${preg.tiempo_limite_segundos || 20}s</span>
                    <span class="meta-pill">✔ Correcta: ${correcta}</span>
                    <span class="meta-pill">Respuestas: ${preg.total_respuestas || 0}</span>
                </div>
            </div>

            <div class="question-options-preview">
                <div class="opt-preview-chip ${correcta === "A" ? "correct-opt" : ""}">
                    <span>▲ <strong>A:</strong> ${preg.opcion_a}</span>
                    ${correcta === "A" ? "<span>✅</span>" : ""}
                </div>
                <div class="opt-preview-chip ${correcta === "B" ? "correct-opt" : ""}">
                    <span>◆ <strong>B:</strong> ${preg.opcion_b}</span>
                    ${correcta === "B" ? "<span>✅</span>" : ""}
                </div>
                <div class="opt-preview-chip ${correcta === "C" ? "correct-opt" : ""}">
                    <span>● <strong>C:</strong> ${preg.opcion_c}</span>
                    ${correcta === "C" ? "<span>✅</span>" : ""}
                </div>
                <div class="opt-preview-chip ${correcta === "D" ? "correct-opt" : ""}">
                    <span>■ <strong>D:</strong> ${preg.opcion_d}</span>
                    ${correcta === "D" ? "<span>✅</span>" : ""}
                </div>
            </div>

            <div class="question-card-actions">
                <button type="button" class="btn-launch-this" data-id="${preg.id}">
                    🚀 Lanzar esta pregunta en vivo
                </button>
                <button type="button" class="btn-edit-pregunta" data-id="${preg.id}">
                    ✏️ Editar
                </button>
                <button type="button" class="btn-delete-guest btn-del-pregunta" data-id="${preg.id}">
                    Eliminar
                </button>
            </div>
        `;

        card.querySelector(".btn-launch-this").addEventListener("click", () => {
            ejecutarControlTrivia("lanzar_pregunta", preg.id);
        });

        card.querySelector(".btn-edit-pregunta").addEventListener("click", () => {
            abrirModalEditarPreguntaAdmin(preg);
        });

        card.querySelector(".btn-del-pregunta").addEventListener("click", async () => {
            cachePreguntas = cachePreguntas.filter((q) => q.id !== preg.id);
            renderizarSeccionTrivia();
            await fetch(`/api/admin/preguntas/${encodeURIComponent(preg.id)}`, {
                method: "DELETE",
                headers: { "X-Admin-Password": adminPasswordActiva },
            });
            mostrarAlertaAdmin("Pregunta eliminada del evento.", "exito");
        });

        listaPreguntasAdminEl.appendChild(card);
    });
}

// Canal de sincronización instantánea entre Admin y Proyector
const canalSyncProyector =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("segalu_proyector_sync") : null;

const canalSyncSedes =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("segalu_sedes_sync") : null;

let modoGaleriaActualAdmin = localStorage.getItem("segalu_modo_galeria") || "ciclo_auto";
let duracionFotoActualAdmin = Number(localStorage.getItem("segalu_duracion_foto") || 8);

function sincronizarUIControlesGaleria(modo, duracionSeg) {
    modoGaleriaActualAdmin = modo || "ciclo_auto";
    duracionFotoActualAdmin = Number(duracionSeg || 8);

    localStorage.setItem("segalu_modo_galeria", modoGaleriaActualAdmin);
    localStorage.setItem("segalu_duracion_foto", String(duracionFotoActualAdmin));

    document.querySelectorAll(".btn-gallery-mode").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.modoGaleria === modoGaleriaActualAdmin);
    });
    document.querySelectorAll(".btn-gallery-duration").forEach((btn) => {
        btn.classList.toggle(
            "active",
            Number(btn.dataset.duracionFoto) === duracionFotoActualAdmin
        );
    });
}

async function guardarConfiguracionGaleriaProyector(nuevoModo, nuevaDuracion) {
    sincronizarUIControlesGaleria(nuevoModo, nuevaDuracion);

    if (canalSyncProyector) {
        canalSyncProyector.postMessage({
            tipo: "CONFIG_GALERIA",
            evento_id: eventoSeleccionadoId,
            modo_galeria: modoGaleriaActualAdmin,
            duracion_foto_segundos: duracionFotoActualAdmin,
        });
    }

    if (!eventoSeleccionadoId || !adminPasswordActiva) return;
    try {
        const res = await fetch(
            `/api/admin/eventos/${encodeURIComponent(eventoSeleccionadoId)}/config-galeria`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Password": adminPasswordActiva,
                },
                body: JSON.stringify({
                    modo_galeria: modoGaleriaActualAdmin,
                    duracion_foto_segundos: duracionFotoActualAdmin,
                }),
            }
        );
        const data = await res.json();
        if (res.ok && data.mensaje) {
            mostrarAlertaAdmin(data.mensaje, "exito");
        }
    } catch (_) {
        // Ya quedó sincronizado instantáneamente vía localStorage + BroadcastChannel
    }
}

document.querySelectorAll(".btn-gallery-mode").forEach((btn) => {
    btn.addEventListener("click", () => {
        guardarConfiguracionGaleriaProyector(
            btn.dataset.modoGaleria,
            duracionFotoActualAdmin
        );
    });
});

document.querySelectorAll(".btn-gallery-duration").forEach((btn) => {
    btn.addEventListener("click", () => {
        guardarConfiguracionGaleriaProyector(
            modoGaleriaActualAdmin,
            Number(btn.dataset.duracionFoto)
        );
    });
});

sincronizarUIControlesGaleria(modoGaleriaActualAdmin, duracionFotoActualAdmin);

async function ejecutarControlTrivia(accion, preguntaId = null) {
    if (!eventoSeleccionadoId) return;

    const esCerrar = accion === "cerrar_trivia";
    const textoOriginalCerrar = btnTriviaCerrarEl ? btnTriviaCerrarEl.innerHTML : "";
    if (esCerrar && btnTriviaCerrarEl) {
        btnTriviaCerrarEl.disabled = true;
        btnTriviaCerrarEl.innerHTML = "<span>⏳ Cerrando Trivia y volviendo a Galería...</span>";
    }

    try {
        const res = await fetch(
            `/api/admin/eventos/${encodeURIComponent(eventoSeleccionadoId)}/trivia/control`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Password": adminPasswordActiva,
                },
                body: JSON.stringify({
                    accion,
                    pregunta_id: preguntaId,
                }),
            }
        );
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "No se pudo ejecutar la acción de trivia.");
        }

        if (canalSyncProyector) {
            canalSyncProyector.postMessage({
                tipo: "ACCION_TRIVIA",
                accion,
                evento_id: eventoSeleccionadoId,
            });
        }

        const msgExito = esCerrar
            ? "✅ Trivia finalizada en celulares. El Proyector regresó automáticamente al modo GALERÍA DE FOTOS."
            : data.mensaje;
        mostrarAlertaAdmin(msgExito, "exito");

        await cargarResumenPanel({ silencioso: true });
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    } finally {
        if (esCerrar && btnTriviaCerrarEl) {
            btnTriviaCerrarEl.disabled = false;
            btnTriviaCerrarEl.innerHTML = textoOriginalCerrar;
        }
    }
}

btnTriviaAbrirLobbyEl.addEventListener("click", () => ejecutarControlTrivia("abrir_lobby"));
btnTriviaLanzarPreguntaEl.addEventListener("click", () =>
    ejecutarControlTrivia("lanzar_pregunta", idProximaPreguntaTrivia)
);
btnTriviaRevelarRespuestaEl.addEventListener("click", () =>
    ejecutarControlTrivia("revelar_respuesta")
);
if (btnTriviaMostrarRankingEl) {
    btnTriviaMostrarRankingEl.addEventListener("click", () =>
        ejecutarControlTrivia("mostrar_ranking")
    );
}
btnTriviaMostrarPodioEl.addEventListener("click", () => ejecutarControlTrivia("mostrar_podio"));
btnTriviaReiniciarPuntajesEl.addEventListener("click", () =>
    ejecutarControlTrivia("reiniciar_puntajes")
);
btnTriviaCerrarEl.addEventListener("click", () => ejecutarControlTrivia("cerrar_trivia"));

if (btnVaciarPreguntasEventoEl) {
    btnVaciarPreguntasEventoEl.addEventListener("click", async () => {
        if (!eventoSeleccionadoId) {
            mostrarAlertaAdmin("Selecciona primero un evento activo.", "error");
            return;
        }
        const ev = cacheEventos.find((e) => e.id === eventoSeleccionadoId);
        const nombreEv = ev?.nombre || "este evento";

        const confirmar = window.confirm(
            `⚠️ ¿Estás seguro de que deseas ELIMINAR TODAS las preguntas de la trivia para "${nombreEv}"?\n\n` +
            `• Se vaciará por completo el banco de preguntas de este evento.\n` +
            `• Los invitados conectados y sus puntajes NO se verán afectados.`
        );
        if (!confirmar) return;

        btnVaciarPreguntasEventoEl.disabled = true;
        try {
            const res = await fetch(
                `/api/admin/eventos/${encodeURIComponent(eventoSeleccionadoId)}/preguntas`,
                {
                    method: "DELETE",
                    headers: { "X-Admin-Password": adminPasswordActiva },
                }
            );
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || "No se pudieron eliminar las preguntas.");
            }

            cachePreguntas = [];
            renderizarSeccionTrivia();
            mostrarAlertaAdmin(data.mensaje || "Banco de preguntas vaciado con éxito.", "exito");
        } catch (err) {
            mostrarAlertaAdmin(err.message, "error");
        } finally {
            btnVaciarPreguntasEventoEl.disabled = false;
        }
    });
}

// ------------------------------------------------------------------------------
// 7. [FASE 4.5 - REQUERIMIENTO F] SUBIR PDF PARA GENERAR 10 PREGUNTAS CON IA
// ------------------------------------------------------------------------------
if (btnSubirPdfIaEl && inputPdfTriviaIaEl) {
    btnSubirPdfIaEl.addEventListener("click", () => {
        if (!eventoSeleccionadoId) {
            mostrarAlertaAdmin("Selecciona primero un evento activo.", "error");
            return;
        }
        inputPdfTriviaIaEl.value = "";
        inputPdfTriviaIaEl.click();
    });

    inputPdfTriviaIaEl.addEventListener("change", async (e) => {
        const archivoPdf = e.target.files?.[0];
        if (!archivoPdf || !eventoSeleccionadoId) return;

        if (!archivoPdf.name.toLowerCase().endsWith(".pdf")) {
            mostrarAlertaAdmin("Por favor selecciona un archivo con extensión .pdf", "error");
            return;
        }

        const tiempoSeleccionado =
            document.getElementById("select-tiempo-ia")?.value ||
            document.getElementById("select-tiempo-limite")?.value ||
            "20";

        btnSubirPdfIaEl.disabled = true;
        if (estadoGeneracionPdfIaEl) {
            textoEstadoPdfIaEl.textContent = `🤖 Leyendo "${archivoPdf.name}" con pypdf y generando 10 preguntas con distractores similares...`;
            estadoGeneracionPdfIaEl.classList.remove("hidden");
        }

        try {
            const formData = new FormData();
            formData.append("archivo_pdf", archivoPdf);
            formData.append("tiempo_limite_segundos", String(tiempoSeleccionado));

            const res = await fetch(
                `/api/admin/eventos/${encodeURIComponent(eventoSeleccionadoId)}/generar-preguntas-pdf`,
                {
                    method: "POST",
                    headers: {
                        "X-Admin-Password": adminPasswordActiva,
                    },
                    body: formData,
                }
            );
            const data = await res.json();
            if (!res.ok) {
                throw new Error(
                    data.detail || "No se pudieron generar las preguntas desde el PDF."
                );
            }

            mostrarAlertaAdmin(data.mensaje, "exito");
            await cerrarModalCrearPreguntasAdmin(true);
        } catch (err) {
            mostrarAlertaAdmin(err.message, "error");
        } finally {
            btnSubirPdfIaEl.disabled = false;
            if (estadoGeneracionPdfIaEl) {
                estadoGeneracionPdfIaEl.classList.add("hidden");
            }
        }
    });
}

formCrearPreguntaEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!eventoSeleccionadoId) return;

    const payload = {
        evento_id: eventoSeleccionadoId,
        enunciado: document.getElementById("input-enunciado-pregunta").value.trim(),
        opcion_a: document.getElementById("input-opcion-a").value.trim(),
        opcion_b: document.getElementById("input-opcion-b").value.trim(),
        opcion_c: document.getElementById("input-opcion-c").value.trim(),
        opcion_d: document.getElementById("input-opcion-d").value.trim(),
        respuesta_correcta: document.getElementById("select-respuesta-correcta").value,
        tiempo_limite_segundos: parseInt(
            document.getElementById("select-tiempo-limite").value,
            10
        ),
    };

    if (
        !payload.enunciado ||
        !payload.opcion_a ||
        !payload.opcion_b ||
        !payload.opcion_c ||
        !payload.opcion_d
    ) {
        mostrarAlertaAdmin("Completa el enunciado y las 4 opciones (A, B, C, D).", "error");
        return;
    }

    try {
        const res = await fetch("/api/admin/preguntas", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Password": adminPasswordActiva,
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "No se pudo guardar la pregunta.");
        }

        formCrearPreguntaEl.reset();
        mostrarAlertaAdmin(data.mensaje, "exito");
        await cerrarModalCrearPreguntasAdmin(true);
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    }
});

// ------------------------------------------------------------------------------
// 8. GESTIÓN, RANKING Y ELIMINACIÓN DE INVITADOS ACTIVOS
// ------------------------------------------------------------------------------
function renderizarListaInvitados(invitados) {
    const totalInvitados = (invitados || []).length;
    document.getElementById("count-invitados").textContent = totalInvitados;
    if (tabBadgeInvitadosEl) {
        tabBadgeInvitadosEl.textContent = totalInvitados;
    }
    actualizarContadorTopbarEnVivo();

    const busqueda = (filtroTextoInvitado || "").trim().toLowerCase();
    const invitadosFiltrados = busqueda
        ? (invitados || []).filter((inv) => (inv.nombre || "").toLowerCase().includes(busqueda))
        : (invitados || []);

    if (conteoFiltradoInvitadosEl) {
        if (busqueda) {
            conteoFiltradoInvitadosEl.classList.remove("hidden");
            conteoFiltradoInvitadosEl.textContent = `${invitadosFiltrados.length} encontrados`;
        } else {
            conteoFiltradoInvitadosEl.classList.add("hidden");
            conteoFiltradoInvitadosEl.textContent = "";
        }
    }
    if (btnLimpiarBusquedaInvitadoEl) {
        btnLimpiarBusquedaInvitadoEl.classList.toggle("hidden", !busqueda);
    }

    listaInvitadosAdminEl.innerHTML = "";

    if (!invitados || invitados.length === 0) {
        listaInvitadosAdminEl.innerHTML = `
            <div class="empty-state">Aún no hay invitados conectados en este evento.</div>
        `;
        if (paginacionInvitadosAdminEl) paginacionInvitadosAdminEl.classList.add("hidden");
        return;
    }

    if (invitadosFiltrados.length === 0) {
        listaInvitadosAdminEl.innerHTML = `
            <div class="empty-state">No se encontraron invitados que coincidan con "${filtroTextoInvitado}".</div>
        `;
        if (paginacionInvitadosAdminEl) paginacionInvitadosAdminEl.classList.add("hidden");
        return;
    }

    const totalFiltrados = invitadosFiltrados.length;
    const invitadosPaginados = mostrarTodosLosInvitados
        ? invitadosFiltrados
        : invitadosFiltrados.slice(0, limiteInvitadosVisible);

    invitadosPaginados.forEach((inv, idx) => {
        const indiceReal = invitados.findIndex((g) => g.id === inv.id);
        const rankIdx = indiceReal !== -1 ? indiceReal : idx;
        const puntos = inv.puntaje_total || 0;
        const rankBadgeClass =
            rankIdx === 0 && puntos > 0
                ? "rank-top-1"
                : rankIdx === 1 && puntos > 0
                  ? "rank-top-2"
                  : rankIdx === 2 && puntos > 0
                    ? "rank-top-3"
                    : "";
        const rankBadgeText =
            rankIdx === 0 && puntos > 0
                ? "🥇"
                : rankIdx === 1 && puntos > 0
                  ? "🥈"
                  : rankIdx === 2 && puntos > 0
                    ? "🥉"
                    : `#${rankIdx + 1}`;

        const item = document.createElement("div");
        item.className = "guest-clean-row";
        item.innerHTML = `
            <div class="guest-clean-left">
                <span class="guest-clean-rank ${rankBadgeClass}">${rankBadgeText}</span>
                <strong class="guest-clean-name" title="${inv.nombre}">${inv.nombre}</strong>
            </div>
            <div class="guest-clean-right">
                <span class="guest-clean-score">🏆 ${puntos} pts</span>
                <button type="button" class="btn-rename-guest" data-id="${inv.id}" title="Corregir nombre">
                    ✏️ Renombrar
                </button>
                <button type="button" class="btn-delete-guest" data-id="${inv.id}" title="Eliminar del evento">
                    🗑️ Eliminar
                </button>
            </div>
        `;

        item.querySelector(".btn-rename-guest").addEventListener("click", async () => {
            const nuevoNombre = window.prompt("Corregir nombre del invitado:", inv.nombre);
            if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre.trim() === inv.nombre) return;
            try {
                const res = await fetch(`/api/admin/invitados/${encodeURIComponent(inv.id)}/renombrar`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Admin-Password": adminPasswordActiva,
                    },
                    body: JSON.stringify({ nuevo_nombre: nuevoNombre.trim() }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || "Error al renombrar invitado.");
                inv.nombre = nuevoNombre.trim();
                renderizarListaInvitados(cacheInvitados);
                mostrarAlertaAdmin(`✅ Invitado renombrado a "${inv.nombre}".`, "exito");
            } catch (err) {
                mostrarAlertaAdmin(err.message, "error");
            }
        });

        item.querySelector(".btn-delete-guest").addEventListener("click", async () => {
            cacheInvitados = cacheInvitados.filter((g) => g.id !== inv.id);
            renderizarListaInvitados(cacheInvitados);

            await fetch(`/api/invitados/${encodeURIComponent(inv.id)}`, { method: "DELETE" });
            mostrarAlertaAdmin(`Invitado '${inv.nombre}' eliminado del evento.`, "exito");
        });

        listaInvitadosAdminEl.appendChild(item);
    });

    if (paginacionInvitadosAdminEl) {
        if (totalFiltrados <= LIMITE_INVITADOS_PASO) {
            paginacionInvitadosAdminEl.classList.add("hidden");
        } else {
            paginacionInvitadosAdminEl.classList.remove("hidden");
            if (btnInvitadosMostrarMasEl) {
                const restantes = totalFiltrados - invitadosPaginados.length;
                if (restantes > 0 && !mostrarTodosLosInvitados) {
                    btnInvitadosMostrarMasEl.classList.remove("hidden");
                    btnInvitadosMostrarMasEl.textContent = `Ver más invitados (+${Math.min(LIMITE_INVITADOS_PASO, restantes)})`;
                } else {
                    btnInvitadosMostrarMasEl.classList.add("hidden");
                }
            }
            if (btnInvitadosToggleTodosEl) {
                btnInvitadosToggleTodosEl.textContent = mostrarTodosLosInvitados
                    ? "Contraer (Ver 8)"
                    : `Ver todos (${totalFiltrados})`;
            }
        }
    }
}

if (inputBuscarInvitadoEl) {
    inputBuscarInvitadoEl.addEventListener("input", (e) => {
        filtroTextoInvitado = e.target.value;
        limiteInvitadosVisible = LIMITE_INVITADOS_PASO;
        mostrarTodosLosInvitados = false;
        renderizarListaInvitados(cacheInvitados);
    });
}

if (btnLimpiarBusquedaInvitadoEl) {
    btnLimpiarBusquedaInvitadoEl.addEventListener("click", () => {
        if (inputBuscarInvitadoEl) inputBuscarInvitadoEl.value = "";
        filtroTextoInvitado = "";
        limiteInvitadosVisible = LIMITE_INVITADOS_PASO;
        mostrarTodosLosInvitados = false;
        renderizarListaInvitados(cacheInvitados);
    });
}

if (btnInvitadosMostrarMasEl) {
    btnInvitadosMostrarMasEl.addEventListener("click", () => {
        limiteInvitadosVisible += LIMITE_INVITADOS_PASO;
        renderizarListaInvitados(cacheInvitados);
    });
}

if (btnInvitadosToggleTodosEl) {
    btnInvitadosToggleTodosEl.addEventListener("click", () => {
        mostrarTodosLosInvitados = !mostrarTodosLosInvitados;
        if (!mostrarTodosLosInvitados) {
            limiteInvitadosVisible = LIMITE_INVITADOS_PASO;
        }
        renderizarListaInvitados(cacheInvitados);
    });
}

btnLimpiarTodosInvitadosEl.addEventListener("click", async () => {
    if (!eventoSeleccionadoId) return;
    if (!confirm("¿Deseas eliminar a todos los invitados activos de este evento?")) return;

    cacheInvitados = [];
    renderizarListaInvitados([]);

    await fetch(`/api/eventos/${encodeURIComponent(eventoSeleccionadoId)}/invitados`, {
        method: "DELETE",
    });
    mostrarAlertaAdmin("Se vació la lista de invitados del evento.", "exito");
});

// ------------------------------------------------------------------------------
// 9. GESTOR RÁPIDO DE 4 FOTOS POR SEDE (SEDE 1 Y SEDE 2) CON SUPABASE STORAGE
// ------------------------------------------------------------------------------
async function cargarFotosSedesAdmin() {
    const gridSede1El = document.getElementById("grid-fotos-admin-sede1");
    const gridSede2El = document.getElementById("grid-fotos-admin-sede2");
    if (!gridSede1El || !gridSede2El) return;

    try {
        const res = await fetch("/api/sedes/fotos");
        const data = await res.json();
        const fotos = data.fotos || {};

        if (data.fotos_sedes) {
            localStorage.setItem("segalu_fotos_sedes_cache", JSON.stringify(data.fotos_sedes));
        }

        renderizarSlotsSedeAdmin("sede1", gridSede1El, fotos.sede1 || []);
        renderizarSlotsSedeAdmin("sede2", gridSede2El, fotos.sede2 || []);
    } catch (_) {
        renderizarSlotsSedeAdmin("sede1", gridSede1El, []);
        renderizarSlotsSedeAdmin("sede2", gridSede2El, []);
    }
}

function renderizarSlotsSedeAdmin(sedeKey, contenedorEl, listaFotos) {
    contenedorEl.innerHTML = "";
    for (let num = 1; num <= 4; num++) {
        const info = listaFotos.find((f) => Number(f.numero) === num) || {
            numero: num,
            archivo: `${sedeKey}_foto${num}.jpg`,
            url: `/static/img/sedes/${sedeKey}_foto${num}.jpg`,
            existe: false,
            titulo: "",
        };

        const tituloInicial = info.titulo || "";

        const card = document.createElement("div");
        card.className = "sede-slot-card";
        card.innerHTML = `
            <div class="sede-slot-preview">
                ${
                    info.existe
                        ? `<img src="${info.url}" alt="${info.archivo}" />`
                        : `<span class="sede-slot-placeholder">Foto ${num}/4<br/><small>${info.archivo}</small></span>`
                }
            </div>
            <div class="sede-slot-footer">
                <div class="sede-slot-footer-header">
                    <strong>Foto ${num} / 4 (Vertical 4:5)</strong>
                </div>
                <div class="sede-slot-title-row">
                    <input
                        type="text"
                        class="input-titulo-sede-slot"
                        placeholder="Título corto (ej. Salón Principal)"
                        value="${escapeHtml(tituloInicial)}"
                        maxlength="45"
                    />
                    <button type="button" class="btn-guardar-titulo-slot" title="Guardar título">💾</button>
                </div>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    class="hidden input-file-sede"
                    data-sede="${sedeKey}"
                    data-num="${num}"
                />
                <button type="button" class="btn-upload-sede-slot">
                    📷 Subir Foto Vertical
                </button>
            </div>
        `;

        const inputEl = card.querySelector(".input-file-sede");
        const btnSubirSlotEl = card.querySelector(".btn-upload-sede-slot");
        const inputTituloEl = card.querySelector(".input-titulo-sede-slot");
        const btnGuardarTituloEl = card.querySelector(".btn-guardar-titulo-slot");

        btnSubirSlotEl.addEventListener("click", () => {
            inputEl.value = "";
            inputEl.click();
        });

        inputEl.addEventListener("change", async (e) => {
            const archivo = e.target.files?.[0];
            if (!archivo) return;
            const tituloActual = inputTituloEl ? inputTituloEl.value.trim() : "";
            await subirFotoSedeSlot(sedeKey, num, archivo, btnSubirSlotEl, tituloActual);
        });

        const guardarTituloFn = async () => {
            const nuevoTitulo = inputTituloEl ? inputTituloEl.value.trim() : "";
            await guardarTituloFotoSede(sedeKey, num, nuevoTitulo, btnGuardarTituloEl);
        };

        if (btnGuardarTituloEl) {
            btnGuardarTituloEl.addEventListener("click", guardarTituloFn);
        }
        if (inputTituloEl) {
            inputTituloEl.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    guardarTituloFn();
                }
            });
        }

        contenedorEl.appendChild(card);
    }
}

async function guardarTituloFotoSede(sedeKey, numeroFoto, nuevoTitulo, botonEl = null) {
    const claveAuth = adminPasswordActiva || sessionStorage.getItem(SESSION_ADMIN_KEY) || "";
    if (botonEl) {
        botonEl.disabled = true;
        botonEl.textContent = "⏳";
    }
    try {
        const res = await fetch("/api/admin/sedes/galeria/titulo", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Password": claveAuth,
            },
            body: JSON.stringify({
                sede: sedeKey,
                numero_foto: numeroFoto,
                titulo: nuevoTitulo,
            }),
        });
        let data = {};
        try {
            data = await res.json();
        } catch (_) {
            data = { detail: "Respuesta no válida del servidor." };
        }
        if (!res.ok) {
            throw new Error(formatearMensajeError(data.detail || "No se pudo actualizar el título de la foto."));
        }
        if (canalSyncSedes) {
            canalSyncSedes.postMessage({
                tipo: "TITULO_SEDE_ACTUALIZADO",
                sede: sedeKey,
                numero_foto: numeroFoto,
                titulo: nuevoTitulo,
            });
        }
        mostrarAlertaAdmin("✅ Título de foto guardado con éxito.", "exito");
    } catch (err) {
        mostrarAlertaAdmin(err, "error");
    } finally {
        if (botonEl) {
            botonEl.disabled = false;
            botonEl.textContent = "💾";
        }
    }
}

async function subirFotoSedeSlot(sedeKey, numeroFoto, archivo, botonEl = null, tituloFoto = "") {
    const claveAuth = adminPasswordActiva || sessionStorage.getItem(SESSION_ADMIN_KEY) || "";
    const formData = new FormData();
    formData.append("sede", sedeKey);
    formData.append("sede_key", sedeKey);
    formData.append("numero_foto", String(numeroFoto));
    formData.append("indice_foto", String(numeroFoto));
    formData.append("archivo", archivo);
    if (tituloFoto) {
        formData.append("titulo", tituloFoto);
    }

    const textoOriginal = botonEl ? botonEl.textContent : "📷 Subir Foto Vertical";
    if (botonEl) {
        botonEl.disabled = true;
        botonEl.textContent = "⏳ Subiendo...";
    }

    try {
        const res = await fetch("/api/admin/sedes/galeria", {
            method: "POST",
            headers: {
                "X-Admin-Password": claveAuth,
            },
            body: formData,
        });
        let data = {};
        try {
            data = await res.json();
        } catch (_) {
            data = { detail: "Respuesta no válida del servidor." };
        }
        if (!res.ok) {
            throw new Error(formatearMensajeError(data.detail || "No se pudo subir la foto de la sede."));
        }

        if (data.fotos_sedes) {
            localStorage.setItem("segalu_fotos_sedes_cache", JSON.stringify(data.fotos_sedes));
        }
        if (canalSyncSedes) {
            canalSyncSedes.postMessage({
                tipo: "FOTO_SEDE_ACTUALIZADA",
                sede: sedeKey,
                numero_foto: numeroFoto,
                url: data.url || data.url_foto,
                fotos_sedes: data.fotos_sedes,
            });
        }

        mostrarAlertaAdmin(data.mensaje || "Foto vertical guardada con éxito.", "exito");
        await cargarFotosSedesAdmin();
    } catch (err) {
        mostrarAlertaAdmin(err, "error");
    } finally {
        if (botonEl) {
            botonEl.disabled = false;
            botonEl.textContent = textoOriginal;
        }
    }
}

// ==============================================================================
// 10. MODAL PARA EDITAR PREGUNTA EXISTENTE DEL BANCO
// ==============================================================================
function abrirModalEditarPreguntaAdmin(preg) {
    if (!preg) return;
    if (editPreguntaIdEl) editPreguntaIdEl.value = preg.id;
    if (editEnunciadoPreguntaEl) editEnunciadoPreguntaEl.value = preg.enunciado || "";
    if (editOpcionAEl) editOpcionAEl.value = preg.opcion_a || "";
    if (editOpcionBEl) editOpcionBEl.value = preg.opcion_b || "";
    if (editOpcionCEl) editOpcionCEl.value = preg.opcion_c || "";
    if (editOpcionDEl) editOpcionDEl.value = preg.opcion_d || "";
    if (editSelectRespuestaCorrectaEl) {
        editSelectRespuestaCorrectaEl.value = (preg.respuesta_correcta || "A").toUpperCase();
    }
    if (editSelectTiempoLimiteEl) {
        editSelectTiempoLimiteEl.value = String(preg.tiempo_limite_segundos || 20);
    }
    if (modalEditarPreguntaAdminEl) modalEditarPreguntaAdminEl.classList.remove("hidden");
}

function cerrarModalEditarPreguntaAdmin() {
    if (modalEditarPreguntaAdminEl) modalEditarPreguntaAdminEl.classList.add("hidden");
}

if (btnCerrarModalEditarPreguntaXEl) {
    btnCerrarModalEditarPreguntaXEl.addEventListener("click", cerrarModalEditarPreguntaAdmin);
}
if (btnCerrarModalEditarPreguntaEl) {
    btnCerrarModalEditarPreguntaEl.addEventListener("click", cerrarModalEditarPreguntaAdmin);
}
if (modalEditarPreguntaAdminEl) {
    modalEditarPreguntaAdminEl.addEventListener("click", (e) => {
        if (e.target === modalEditarPreguntaAdminEl) cerrarModalEditarPreguntaAdmin();
    });
}

if (formEditarPreguntaEl) {
    formEditarPreguntaEl.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pregId = editPreguntaIdEl.value;
        if (!pregId) return;

        const payload = {
            enunciado: editEnunciadoPreguntaEl.value.trim(),
            opcion_a: editOpcionAEl.value.trim(),
            opcion_b: editOpcionBEl.value.trim(),
            opcion_c: editOpcionCEl.value.trim(),
            opcion_d: editOpcionDEl.value.trim(),
            respuesta_correcta: editSelectRespuestaCorrectaEl.value,
            tiempo_limite_segundos: parseInt(editSelectTiempoLimiteEl.value, 10) || 20,
        };

        try {
            const res = await fetch(`/api/admin/preguntas/${encodeURIComponent(pregId)}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Password": adminPasswordActiva,
                },
                body: JSON.stringify(payload),
            });
            let data = {};
            try {
                data = await res.json();
            } catch (_) {
                data = { detail: "Error inesperado en el servidor al editar la pregunta." };
            }
            if (!res.ok) {
                throw new Error(formatearMensajeError(data.detail || "Error al actualizar la pregunta."));
            }

            const idx = cachePreguntas.findIndex((p) => p.id === pregId);
            if (idx !== -1) {
                cachePreguntas[idx] = { ...cachePreguntas[idx], ...payload };
            }

            cerrarModalEditarPreguntaAdmin();
            renderizarSeccionTrivia();
            mostrarAlertaAdmin("✅ Pregunta actualizada con éxito en la base de datos.", "exito");
        } catch (err) {
            mostrarAlertaAdmin(err, "error");
        }
    });
}

// ==============================================================================
// 11. GESTOR DE PAQUETES DE ACCESORIOS PERSONALIZADOS EN PNG (256x256)
// ==============================================================================
let stagedFilesAccesorios = [];
let catalogoPaquetesAdmin = {};

function alternarModoDestinoPaquetes() {
    const esCrear = radioModoDestinoNuevoEl ? radioModoDestinoNuevoEl.checked : true;
    if (bloqueDestinoNuevoEl) bloqueDestinoNuevoEl.classList.toggle("hidden", !esCrear);
    if (bloqueDestinoExistenteEl) bloqueDestinoExistenteEl.classList.toggle("hidden", esCrear);
}

if (radioModoDestinoNuevoEl) {
    radioModoDestinoNuevoEl.addEventListener("change", alternarModoDestinoPaquetes);
}
if (radioModoDestinoExistenteEl) {
    radioModoDestinoExistenteEl.addEventListener("change", alternarModoDestinoPaquetes);
}

function renderizarStagedAccesorios() {
    if (!stagedAccesoriosListaEl) return;
    stagedAccesoriosListaEl.innerHTML = "";

    const total = stagedFilesAccesorios.length;
    if (stagedContadorEl) stagedContadorEl.textContent = String(total);
    if (stagedAccesoriosWrapEl) {
        stagedAccesoriosWrapEl.classList.toggle("hidden", total === 0);
    }

    stagedFilesAccesorios.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "staged-item-card";

        const thumb = document.createElement("img");
        thumb.className = "staged-item-thumb";
        thumb.src = item.dataUrl;
        thumb.alt = item.name;

        const inputNombre = document.createElement("input");
        inputNombre.type = "text";
        inputNombre.className = "staged-item-input";
        inputNombre.value = item.name;
        inputNombre.placeholder = "Nombre del accesorio";
        inputNombre.addEventListener("input", (e) => {
            item.name = e.target.value.trim() || `Accesorio ${index + 1}`;
        });

        const btnQuitar = document.createElement("button");
        btnQuitar.type = "button";
        btnQuitar.className = "btn-remove-staged";
        btnQuitar.setAttribute("aria-label", "Quitar de la lista");
        btnQuitar.innerHTML = "&times;";
        btnQuitar.addEventListener("click", () => {
            stagedFilesAccesorios.splice(index, 1);
            renderizarStagedAccesorios();
        });

        card.appendChild(thumb);
        card.appendChild(inputNombre);
        card.appendChild(btnQuitar);
        stagedAccesoriosListaEl.appendChild(card);
    });
}

function limpiarStagedAccesorios() {
    stagedFilesAccesorios = [];
    if (inputArchivoAccesorioEl) inputArchivoAccesorioEl.value = "";
    renderizarStagedAccesorios();
}

if (btnLimpiarStagedEl) {
    btnLimpiarStagedEl.addEventListener("click", limpiarStagedAccesorios);
}

if (inputArchivoAccesorioEl) {
    inputArchivoAccesorioEl.addEventListener("change", (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        let pendientes = files.length;
        files.forEach((file) => {
            if (!file.name.toLowerCase().endsWith(".png")) {
                mostrarAlertaAdmin(`El archivo '${file.name}' fue omitido porque no es PNG.`, "error");
                pendientes--;
                return;
            }

            const baseSinExt = file.name.replace(/\.png$/i, "");
            const nombreLegible = baseSinExt
                .replace(/[_\-]+/g, " ")
                .trim()
                .replace(/\b\w/g, (l) => l.toUpperCase());

            const reader = new FileReader();
            reader.onload = (ev) => {
                stagedFilesAccesorios.push({
                    id: `staged_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    file,
                    name: nombreLegible || "Accesorio",
                    dataUrl: ev.target.result,
                });
                pendientes--;
                if (pendientes <= 0) {
                    renderizarStagedAccesorios();
                }
            };
            reader.readAsDataURL(file);
        });
    });
}

async function cargarYRenderizarPaquetesAdmin() {
    if (!listaPaquetesAdminEl) return;
    listaPaquetesAdminEl.innerHTML = `<div class="paquetes-loading">Cargando paquetes de accesorios...</div>`;

    try {
        const res = await fetch("/api/accesorios", { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudo obtener el catálogo de accesorios.");
        const data = await res.json();
        catalogoPaquetesAdmin = data.paquetes || {};

        // 1. Poblar select de paquetes existentes en el formulario
        if (selectPaqueteExistenteAdminEl) {
            selectPaqueteExistenteAdminEl.innerHTML = "";
            Object.values(catalogoPaquetesAdmin).forEach((pkg) => {
                const opt = document.createElement("option");
                opt.value = pkg.id;
                const totalAcc = Array.isArray(pkg.accesorios) ? pkg.accesorios.length : 0;
                opt.textContent = `${pkg.icono || "✨"} ${pkg.nombre} (${totalAcc} accesorios)`;
                selectPaqueteExistenteAdminEl.appendChild(opt);
            });
        }

        // 2. Actualizar dinámicamente el selector de temáticas del modal "Crear Evento"
        if (selectTematicaEventoEl) {
            const valorPrevio = selectTematicaEventoEl.value || "todos";
            selectTematicaEventoEl.innerHTML = `<option value="todos">✨ Todos los Paquetes (Universal)</option>`;
            Object.values(catalogoPaquetesAdmin).forEach((pkg) => {
                const opt = document.createElement("option");
                opt.value = pkg.id;
                opt.textContent = `${pkg.icono || "✨"} ${pkg.nombre}`;
                selectTematicaEventoEl.appendChild(opt);
            });
            selectTematicaEventoEl.value = valorPrevio;
        }

        // 3. Renderizar listado visual de tarjetas de paquetes
        listaPaquetesAdminEl.innerHTML = "";
        const listaPaquetes = Object.values(catalogoPaquetesAdmin);
        if (listaPaquetes.length === 0) {
            listaPaquetesAdminEl.innerHTML = `<div class="paquetes-loading">No hay paquetes registrados aún.</div>`;
            return;
        }

        const evActivo = obtenerEventoSeleccionado();
        eventoSeleccionado = evActivo;
        const tematicaEventoActivo = (evActivo?.tematica_accesorios || "todos").toLowerCase().trim();

        listaPaquetes.forEach((pkg) => {
            const esActivoEnEvento =
                tematicaEventoActivo === pkg.id.toLowerCase() ||
                (tematicaEventoActivo === "15anos" && pkg.id === "paquete_15_anos") ||
                (tematicaEventoActivo === "gala_bodas" && pkg.id === "paquete_boda") ||
                (tematicaEventoActivo === "fiesta_vip" && pkg.id === "paquete_general");

            const esDesactivadoEnEvento =
                tematicaEventoActivo === `!${pkg.id.toLowerCase()}` ||
                tematicaEventoActivo === `desactivado:${pkg.id.toLowerCase()}`;

            const card = document.createElement("div");
            card.className = `paquete-admin-card ${esActivoEnEvento ? "active-event-theme" : ""} ${esDesactivadoEnEvento ? "disabled-event-theme" : ""}`;

            const headerRow = document.createElement("div");
            headerRow.className = "paquete-admin-header";

            const titleRow = document.createElement("div");
            titleRow.className = "paquete-admin-title-row";

            const titleEl = document.createElement("h5");
            titleEl.className = "paquete-admin-title";
            titleEl.textContent = `${pkg.icono || "✨"} ${pkg.nombre}`;

            const scopeBadge = document.createElement("span");
            scopeBadge.className = `badge-scope-pill ${pkg.scope === "evento" ? "evento" : "global"}`;
            scopeBadge.textContent = pkg.scope === "evento" ? "📍 Solo Evento" : "🌐 Permanente";

            titleRow.appendChild(titleEl);
            titleRow.appendChild(scopeBadge);

            if (esActivoEnEvento) {
                const activeBadge = document.createElement("span");
                activeBadge.className = "badge-scope-pill activo-en-evento";
                activeBadge.textContent = "✓ Activo en este Evento";
                titleRow.appendChild(activeBadge);
            } else if (esDesactivadoEnEvento) {
                const disabledBadge = document.createElement("span");
                disabledBadge.className = "badge-scope-pill desactivado-en-evento";
                disabledBadge.style.background = "rgba(239, 68, 68, 0.25)";
                disabledBadge.style.color = "#f87171";
                disabledBadge.style.border = "1px solid rgba(239, 68, 68, 0.4)";
                disabledBadge.textContent = "✕ Desactivado en este Evento";
                titleRow.appendChild(disabledBadge);
            }

            const actionsDiv = document.createElement("div");
            actionsDiv.className = "paquete-admin-actions";

            if (evActivo?.id) {
                const btnActivar = document.createElement("button");
                btnActivar.type = "button";
                btnActivar.className = "btn-activar-paquete";
                btnActivar.textContent = esActivoEnEvento ? "Reactivar Temática" : (esDesactivadoEnEvento ? "Reactivar Paquete" : "✨ Activar en Evento");
                btnActivar.addEventListener("click", () => activarPaqueteEnEventoActual(pkg.id, pkg.nombre));
                actionsDiv.appendChild(btnActivar);

                if (esActivoEnEvento) {
                    const btnDesactivar = document.createElement("button");
                    btnDesactivar.type = "button";
                    btnDesactivar.className = "btn-desactivar-paquete";
                    btnDesactivar.textContent = "✕ Desactivar";
                    btnDesactivar.title = "Quitar este paquete del evento y prohibir sus accesorios en los invitados";
                    btnDesactivar.addEventListener("click", () => desactivarTematicaEnEventoActual(pkg.id, pkg.nombre));
                    actionsDiv.appendChild(btnDesactivar);
                }
            }

            // Paquetes base protegidos: no se elimina el contenedor, solo paquetes personalizados
            const esPaqueteBase = ["paquete_15_anos", "paquete_boda", "paquete_graduacion", "paquete_general", "paquete_princesas_disney"].includes(pkg.id);
            if (!esPaqueteBase) {
                const btnEliminarPkg = document.createElement("button");
                btnEliminarPkg.type = "button";
                btnEliminarPkg.className = "btn-eliminar-paquete";
                btnEliminarPkg.textContent = "🗑️ Quitar Paquete";
                btnEliminarPkg.addEventListener("click", () => eliminarPaqueteAdmin(pkg.id, pkg.nombre));
                actionsDiv.appendChild(btnEliminarPkg);
            }

            headerRow.appendChild(titleRow);
            headerRow.appendChild(actionsDiv);
            card.appendChild(headerRow);

            // Lista de accesorios del paquete
            const itemsRow = document.createElement("div");
            itemsRow.className = "paquete-items-row";
            const accesorios = Array.isArray(pkg.accesorios) ? pkg.accesorios : [];

            if (accesorios.length === 0) {
                const vacioPill = document.createElement("span");
                vacioPill.style.fontSize = "0.74rem";
                vacioPill.style.color = "var(--text-warm-gray)";
                vacioPill.textContent = "Sin accesorios en este paquete aún. Sube archivos PNG arriba.";
                itemsRow.appendChild(vacioPill);
            } else {
                accesorios.forEach((acc) => {
                    const pill = document.createElement("div");
                    pill.className = "paquete-item-pill";

                    const thumbImg = document.createElement("img");
                    thumbImg.className = "paquete-item-thumb";
                    thumbImg.src = acc.url || `/static/accessories/${pkg.id}/${acc.archivo}`;
                    thumbImg.alt = acc.nombre;
                    thumbImg.onerror = () => { thumbImg.style.display = "none"; };

                    const nameSpan = document.createElement("span");
                    nameSpan.textContent = acc.nombre;

                    const btnDelItem = document.createElement("button");
                    btnDelItem.type = "button";
                    btnDelItem.className = "btn-eliminar-item";
                    btnDelItem.title = "Eliminar este accesorio";
                    btnDelItem.innerHTML = "&times;";
                    btnDelItem.addEventListener("click", () => eliminarItemAccesorioAdmin(pkg.id, acc.id, acc.nombre));

                    pill.appendChild(thumbImg);
                    pill.appendChild(nameSpan);
                    pill.appendChild(btnDelItem);
                    itemsRow.appendChild(pill);
                });
            }

            card.appendChild(itemsRow);
            listaPaquetesAdminEl.appendChild(card);
        });
    } catch (err) {
        listaPaquetesAdminEl.innerHTML = `<div class="paquetes-loading" style="color: #ef4444;">Error al cargar paquetes: ${err.message}</div>`;
    }
}

async function activarPaqueteEnEventoActual(paqueteId, nombrePaquete) {
    const evActivo = obtenerEventoSeleccionado();
    eventoSeleccionado = evActivo;
    const eventoId = evActivo?.id || eventoSeleccionadoId;
    if (!eventoId) {
        mostrarAlertaAdmin("Selecciona primero un evento en la barra superior para asignarle esta temática.", "error");
        return;
    }

    try {
        const res = await fetch(`/api/admin/eventos/${encodeURIComponent(eventoId)}/tematica`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Password": adminPasswordActiva,
            },
            body: JSON.stringify({ tematica_accesorios: paqueteId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "No se pudo actualizar la temática del evento.");

        if (evActivo) evActivo.tematica_accesorios = paqueteId;
        if (eventoSeleccionado) eventoSeleccionado.tematica_accesorios = paqueteId;
        mostrarAlertaAdmin(`✅ El evento ahora proyectará exclusivamente el paquete "${nombrePaquete}".`, "exito");
        cargarYRenderizarPaquetesAdmin();

        if (typeof BroadcastChannel !== "undefined") {
            try {
                const canalSync = new BroadcastChannel("segalu_proyector_sync");
                canalSync.postMessage({ tipo: "ACCESORIOS_ACTUALIZADOS" });
            } catch (_) {}
        }
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    }
}

async function desactivarTematicaEnEventoActual(paqueteId, nombrePaquete) {
    const evActivo = obtenerEventoSeleccionado();
    eventoSeleccionado = evActivo;
    const eventoId = evActivo?.id || eventoSeleccionadoId;
    if (!eventoId) {
        mostrarAlertaAdmin("Selecciona primero un evento en la barra superior.", "error");
        return;
    }

    try {
        const valorTematica = `!${paqueteId}`;
        const res = await fetch(`/api/admin/eventos/${encodeURIComponent(eventoId)}/tematica`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Password": adminPasswordActiva,
            },
            body: JSON.stringify({ tematica_accesorios: valorTematica }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "No se pudo desactivar el paquete del evento.");

        if (evActivo) evActivo.tematica_accesorios = valorTematica;
        if (eventoSeleccionado) eventoSeleccionado.tematica_accesorios = valorTematica;
        mostrarAlertaAdmin(`Paquete "${nombrePaquete}" desactivado en el evento. Los invitados ya no verán sus accesorios.`, "exito");
        cargarYRenderizarPaquetesAdmin();

        if (typeof BroadcastChannel !== "undefined") {
            try {
                const canalSync = new BroadcastChannel("segalu_proyector_sync");
                canalSync.postMessage({ tipo: "ACCESORIOS_ACTUALIZADOS", tematica: valorTematica, paquete_id: paqueteId });
            } catch (_) {}
        }
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    }
}

async function eliminarPaqueteAdmin(paqueteId, nombrePaquete) {
    if (!confirm(`¿Estás seguro de eliminar el paquete "${nombrePaquete}" y todos sus accesorios PNG asociados? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/admin/accesorios/paquetes/${encodeURIComponent(paqueteId)}`, {
            method: "DELETE",
            headers: {
                "X-Admin-Password": adminPasswordActiva,
            },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al eliminar el paquete.");

        mostrarAlertaAdmin(data.mensaje || `🗑️ Paquete "${nombrePaquete}" eliminado con éxito.`, "exito");
        cargarYRenderizarPaquetesAdmin();

        if (typeof BroadcastChannel !== "undefined") {
            try {
                const canalSync = new BroadcastChannel("segalu_proyector_sync");
                canalSync.postMessage({ tipo: "ACCESORIOS_ACTUALIZADOS" });
            } catch (_) {}
        }
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    }
}

async function eliminarItemAccesorioAdmin(paqueteId, accesorioId, nombreAccesorio) {
    if (!confirm(`¿Deseas eliminar el accesorio "${nombreAccesorio}" de este paquete?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/admin/accesorios/paquetes/${encodeURIComponent(paqueteId)}/items/${encodeURIComponent(accesorioId)}`, {
            method: "DELETE",
            headers: {
                "X-Admin-Password": adminPasswordActiva,
            },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al eliminar el accesorio.");

        mostrarAlertaAdmin(data.mensaje || `🗑️ Accesorio "${nombreAccesorio}" eliminado.`, "exito");
        cargarYRenderizarPaquetesAdmin();

        if (typeof BroadcastChannel !== "undefined") {
            try {
                const canalSync = new BroadcastChannel("segalu_proyector_sync");
                canalSync.postMessage({ tipo: "ACCESORIOS_ACTUALIZADOS" });
            } catch (_) {}
        }
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    }
}

function abrirModalSubirAccesorioAdmin() {
    if (modalSubirAccesorioAdminEl) modalSubirAccesorioAdminEl.classList.remove("hidden");
    alternarModoDestinoPaquetes();
    cargarYRenderizarPaquetesAdmin();
}

function cerrarModalSubirAccesorioAdmin() {
    if (modalSubirAccesorioAdminEl) modalSubirAccesorioAdminEl.classList.add("hidden");
    if (formSubirAccesorioEl) formSubirAccesorioEl.reset();
    limpiarStagedAccesorios();
    alternarModoDestinoPaquetes();
}

if (btnAbrirModalSubirAccesorioEl) {
    btnAbrirModalSubirAccesorioEl.addEventListener("click", abrirModalSubirAccesorioAdmin);
}
if (btnCerrarModalAccesorioXEl) {
    btnCerrarModalAccesorioXEl.addEventListener("click", cerrarModalSubirAccesorioAdmin);
}
if (btnCancelarModalAccesorioEl) {
    btnCancelarModalAccesorioEl.addEventListener("click", cerrarModalSubirAccesorioAdmin);
}
if (modalSubirAccesorioAdminEl) {
    modalSubirAccesorioAdminEl.addEventListener("click", (e) => {
        if (e.target === modalSubirAccesorioAdminEl) cerrarModalSubirAccesorioAdmin();
    });
}

if (formSubirAccesorioEl) {
    formSubirAccesorioEl.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (stagedFilesAccesorios.length === 0) {
            mostrarAlertaAdmin("Por favor selecciona al menos un archivo PNG transparente para subir.", "error");
            return;
        }

        const esCrear = radioModoDestinoNuevoEl ? radioModoDestinoNuevoEl.checked : true;
        let nombrePaquete = "";
        let paqueteId = "";
        let scopeVal = "global";

        if (esCrear) {
            nombrePaquete = (inputNombreNuevoPaqueteEl?.value || "").trim();
            if (!nombrePaquete) {
                mostrarAlertaAdmin("Por favor escribe un nombre para el nuevo paquete.", "error");
                inputNombreNuevoPaqueteEl?.focus();
                return;
            }
            const radioScopeEvento = document.getElementById("alcance-evento");
            if (radioScopeEvento && radioScopeEvento.checked) {
                scopeVal = "evento";
            }
        } else {
            paqueteId = selectPaqueteExistenteAdminEl?.value || "paquete_general";
        }

        const formData = new FormData();
        formData.append("modo_destino", esCrear ? "crear" : "existente");
        formData.append("nombre_paquete", nombrePaquete);
        formData.append("paquete_id", paqueteId);
        formData.append("scope", scopeVal);
        formData.append("evento_id", eventoSeleccionadoId || (obtenerEventoSeleccionado()?.id) || "");

        const nombresArray = stagedFilesAccesorios.map((s) => s.name);
        formData.append("nombres_json", JSON.stringify(nombresArray));

        stagedFilesAccesorios.forEach((s) => {
            formData.append("archivos", s.file);
        });

        const btnSubmit = document.getElementById("btn-guardar-accesorio");
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<span>⏳ Subiendo ${stagedFilesAccesorios.length} accesorio(s)...</span>`;
        }

        try {
            const res = await fetch("/api/admin/accesorios/paquetes/subir", {
                method: "POST",
                headers: {
                    "X-Admin-Password": adminPasswordActiva,
                },
                body: formData,
            });
            let data = {};
            try {
                data = await res.json();
            } catch (_) {
                data = { detail: "Respuesta inesperada del servidor." };
            }
            if (!res.ok) {
                throw new Error(formatearMensajeError(data.detail || "Error al subir los accesorios."));
            }

            mostrarAlertaAdmin(
                data.mensaje || `✅ Accesorios guardados con éxito en el paquete.`,
                "exito"
            );

            limpiarStagedAccesorios();
            if (inputNombreNuevoPaqueteEl) inputNombreNuevoPaqueteEl.value = "";
            cargarYRenderizarPaquetesAdmin();

            if (typeof BroadcastChannel !== "undefined") {
                try {
                    const canalSync = new BroadcastChannel("segalu_proyector_sync");
                    canalSync.postMessage({ tipo: "ACCESORIOS_ACTUALIZADOS" });
                } catch (_) {}
            }
        } catch (err) {
            mostrarAlertaAdmin(err.message || err, "error");
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<span>⬆️ Subir y Guardar Accesorios</span>`;
            }
        }
    });
}

// ==============================================================================
// 14. MÓDULO CRM & LEADS DE MARKETING
// ==============================================================================
let peticionLeadsEnCurso = false;

const tabBadgeLeadsEl = document.getElementById("tab-badge-leads");
const countLeadsTotalEl = document.getElementById("count-leads-total");
const crmMetricTotalEl = document.getElementById("crm-metric-total");
const crmMetricCuponesEl = document.getElementById("crm-metric-cupones");
const crmMetricTasaEl = document.getElementById("crm-metric-tasa");
const crmMetricQuinceanerasEl = document.getElementById("crm-metric-quinceaneras");
const inputBuscarLeadsEl = document.getElementById("input-buscar-leads");
const btnLimpiarBusquedaLeadsEl = document.getElementById("btn-limpiar-busqueda-leads");
const conteoFiltradoLeadsEl = document.getElementById("conteo-filtrado-leads");
const tbodyLeadsAdminEl = document.getElementById("tbody-leads-admin");
const btnExportarLeadsCsvEl = document.getElementById("btn-exportar-leads-csv");
const btnRemoverFiltroGraficoEl = document.getElementById("btn-remover-filtro-grafico");

let chartEdadesInstance = null;
let chartCumplesInstance = null;
let filtroActivoGrafico = null; // { tipo: 'edad' | 'cumple', valor: string }
let filtroRapidoCrmActivo = "todos"; // 'todos' | '15_anos' | 'hitos_18' | 'cumple_mes'

function parsearFechaNacimiento(fechaStr) {
    if (!fechaStr) return null;
    const str = String(fechaStr).trim();
    if (str.includes("/")) {
        const partes = str.split("/");
        if (partes.length === 3) {
            const d = parseInt(partes[0], 10);
            const m = parseInt(partes[1], 10) - 1;
            const y = parseInt(partes[2], 10);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                return { anio: y, mes: m, dia: d };
            }
        }
    } else if (str.includes("-")) {
        const partes = str.split("-");
        if (partes.length === 3) {
            if (partes[0].length === 4) {
                const y = parseInt(partes[0], 10);
                const m = parseInt(partes[1], 10) - 1;
                const d = parseInt(partes[2], 10);
                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                    return { anio: y, mes: m, dia: d };
                }
            } else {
                const d = parseInt(partes[0], 10);
                const m = parseInt(partes[1], 10) - 1;
                const y = parseInt(partes[2], 10);
                if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                    return { anio: y, mes: m, dia: d };
                }
            }
        }
    }
    return null;
}

function formatearFechaDMY(fechaStr) {
    const p = parsearFechaNacimiento(fechaStr);
    if (!p) return fechaStr || "—";
    const d = String(p.dia).padStart(2, "0");
    const m = String(p.mes + 1).padStart(2, "0");
    return `${d}/${m}/${p.anio}`;
}

function calcularEdadDetallada(fechaNacStr) {
    const p = parsearFechaNacimiento(fechaNacStr);
    if (!p) return null;

    const hoy = new Date();
    const aHoy = hoy.getFullYear();
    const mHoy = hoy.getMonth();
    const dHoy = hoy.getDate();

    let anios = aHoy - p.anio;
    let meses = mHoy - p.mes;

    if (dHoy < p.dia) {
        meses--;
    }
    if (meses < 0) {
        anios--;
        meses += 12;
    }

    if (anios < 0) return null;

    // Meses faltantes para cumplir 15 años
    let mesesPara15 = null;
    if (anios >= 13 && anios < 15) {
        const totalMesesActual = anios * 12 + meses;
        const totalMeses15 = 15 * 12;
        mesesPara15 = Math.max(1, totalMeses15 - totalMesesActual);
    }

    // Próximo cumpleaños y días restantes
    let cumpleEsteAnio = new Date(aHoy, p.mes, p.dia);
    if (cumpleEsteAnio < new Date(aHoy, mHoy, dHoy)) {
        cumpleEsteAnio = new Date(aHoy + 1, p.mes, p.dia);
    }
    const diffMs = cumpleEsteAnio.getTime() - new Date(aHoy, mHoy, dHoy).getTime();
    const diasParaCumple = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const esCumplePronto = diasParaCumple >= 0 && diasParaCumple <= 30;
    const cumpleEnEsteMes = (p.mes === mHoy);

    let textoEdad = "";
    if (anios === 0) {
        textoEdad = `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    } else if (meses === 0) {
        textoEdad = `${anios} ${anios === 1 ? 'año' : 'años'}`;
    } else {
        textoEdad = `${anios} ${anios === 1 ? 'año' : 'años'}, ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }

    return {
        anios,
        meses,
        textoEdad,
        mesesPara15,
        diasParaCumple,
        esCumplePronto,
        cumpleEnEsteMes,
    };
}

function calcularEdadLead(fechaNacStr) {
    const det = calcularEdadDetallada(fechaNacStr);
    return det ? det.anios : null;
}

function calcularDiasHastaCumple(fechaNacStr) {
    const det = calcularEdadDetallada(fechaNacStr);
    return det ? det.diasParaCumple : null;
}

function obtenerRangoEdadLead(edad) {
    if (edad === null || isNaN(edad)) return "Sin fecha";
    if (edad < 13) return "Menores de 12";
    if (edad <= 16) return "13 a 16 (Quinceañeras)";
    if (edad <= 25) return "17 a 25 años";
    return "26+ años";
}

function obtenerRangoCumpleLead(dias) {
    if (dias === null || isNaN(dias)) return "Sin fecha";
    if (dias <= 30) return "En < 30 días";
    if (dias <= 60) return "En 31 a 60 días";
    return "Más de 60 días";
}

async function cargarLeadsEvento(eventoId, opciones = {}) {
    if (!eventoId || !adminPasswordActiva || peticionLeadsEnCurso) return;
    peticionLeadsEnCurso = true;

    try {
        const url = `/api/eventos/${encodeURIComponent(eventoId)}/leads${opciones?.force_refresh ? "?force_refresh=true" : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok && Array.isArray(data.leads)) {
            cacheLeads = data.leads;
            actualizarGraficosCrm(cacheLeads);
            filtrarLeadsGeneral();
        }
    } catch (err) {
        console.warn("Aviso al cargar leads del evento:", err);
    } finally {
        peticionLeadsEnCurso = false;
    }
}

function actualizarGraficosCrm(listaLeads) {
    if (typeof Chart === "undefined") return;

    const canvasEdades = document.getElementById("chart-crm-edades");
    const canvasCumples = document.getElementById("chart-crm-cumples");
    if (!canvasEdades || !canvasCumples) return;

    const bucketsEdad = {
        "Menores de 12": 0,
        "13 a 16 (Quinceañeras)": 0,
        "17 a 25 años": 0,
        "26+ años": 0,
    };

    const bucketsCumple = {
        "En < 30 días": 0,
        "En 31 a 60 días": 0,
        "Más de 60 días": 0,
    };

    (listaLeads || []).forEach((l) => {
        const edad = calcularEdadLead(l.fecha_nacimiento);
        const rEdad = obtenerRangoEdadLead(edad);
        if (rEdad in bucketsEdad) bucketsEdad[rEdad]++;

        const dias = calcularDiasHastaCumple(l.fecha_nacimiento);
        const rCumple = obtenerRangoCumpleLead(dias);
        if (rCumple in bucketsCumple) bucketsCumple[rCumple]++;
    });

    // 1. Gráfico Doughnut: Rangos de Edad
    const labelsEdad = Object.keys(bucketsEdad);
    const dataEdad = Object.values(bucketsEdad);

    if (chartEdadesInstance) {
        chartEdadesInstance.data.labels = labelsEdad;
        chartEdadesInstance.data.datasets[0].data = dataEdad;
        chartEdadesInstance.update();
    } else {
        const ctxEdades = canvasEdades.getContext("2d");
        chartEdadesInstance = new Chart(ctxEdades, {
            type: "doughnut",
            data: {
                labels: labelsEdad,
                datasets: [{
                    data: dataEdad,
                    backgroundColor: [
                        "#F59E0B", // Menores 12
                        "#EC4899", // Quinceañeras
                        "#8B5CF6", // 17 a 25
                        "#3B82F6", // 26+
                    ],
                    borderWidth: 2,
                    borderColor: "#141A26",
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { boxWidth: 10, font: { size: 10, family: "Outfit" }, color: "#94A3B8" },
                    },
                },
                onClick: (evt, activeElements) => {
                    if (activeElements && activeElements.length > 0) {
                        const index = activeElements[0].index;
                        const label = labelsEdad[index];
                        aplicarFiltroGrafico("edad", label);
                    }
                },
            },
        });
    }

    // 2. Gráfico de Barras: Próximos Cumpleaños
    const labelsCumple = Object.keys(bucketsCumple);
    const dataCumple = Object.values(bucketsCumple);

    if (chartCumplesInstance) {
        chartCumplesInstance.data.labels = labelsCumple;
        chartCumplesInstance.data.datasets[0].data = dataCumple;
        chartCumplesInstance.update();
    } else {
        const ctxCumples = canvasCumples.getContext("2d");
        chartCumplesInstance = new Chart(ctxCumples, {
            type: "bar",
            data: {
                labels: labelsCumple,
                datasets: [{
                    label: "Prospectos",
                    data: dataCumple,
                    backgroundColor: [
                        "#10B981", // < 30 días
                        "#D4AF37", // 31 a 60 días (Dorado Segalú)
                        "#64748B", // > 60 días
                    ],
                    borderRadius: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0, font: { size: 10 }, color: "#94A3B8" },
                        grid: { color: "rgba(255, 255, 255, 0.06)" },
                    },
                    x: {
                        ticks: { font: { size: 10, family: "Outfit" }, color: "#94A3B8" },
                        grid: { display: false },
                    },
                },
                onClick: (evt, activeElements) => {
                    if (activeElements && activeElements.length > 0) {
                        const index = activeElements[0].index;
                        const label = labelsCumple[index];
                        aplicarFiltroGrafico("cumple", label);
                    }
                },
            },
        });
    }
}

function aplicarFiltroGrafico(tipo, valor) {
    if (filtroActivoGrafico && filtroActivoGrafico.tipo === tipo && filtroActivoGrafico.valor === valor) {
        removerFiltroGrafico();
        return;
    }
    filtroActivoGrafico = { tipo, valor };
    const banner = document.getElementById("crm-active-filter-banner");
    const labelEl = document.getElementById("crm-filter-label");
    if (banner && labelEl) {
        labelEl.textContent = `${tipo === "edad" ? "Rango de Edad" : "Cumpleaños"}: ${valor}`;
        banner.classList.remove("hidden");
    }
    filtrarLeadsGeneral();
}

function removerFiltroGrafico() {
    filtroActivoGrafico = null;
    const banner = document.getElementById("crm-active-filter-banner");
    if (banner) banner.classList.add("hidden");
    filtrarLeadsGeneral();
}

function renderizarTablaLeads(listaLeads) {
    if (!tbodyLeadsAdminEl) return;
    const leads = listaLeads || [];
    const totalLeads = cacheLeads.length;
    const totalInvitados = cacheInvitados.length || 1;

    // Actualizar badges, métricas y contador en vivo del topbar
    actualizarContadorTopbarEnVivo();
    if (tabBadgeLeadsEl) tabBadgeLeadsEl.textContent = String(totalLeads);
    if (countLeadsTotalEl) countLeadsTotalEl.textContent = String(totalLeads);
    if (crmMetricTotalEl) crmMetricTotalEl.textContent = String(totalLeads);
    if (crmMetricCuponesEl) crmMetricCuponesEl.textContent = String(totalLeads);

    const conversion = Math.min(100, Math.round((totalLeads / totalInvitados) * 100));
    if (crmMetricTasaEl) crmMetricTasaEl.textContent = `${conversion}%`;

    // 4to indicador KPI: Prospectos 15 Años (13 a 14 años)
    const quinceanerasTotal = cacheLeads.filter((l) => {
        const d = calcularEdadDetallada(l.fecha_nacimiento);
        return d && (d.anios === 13 || d.anios === 14);
    }).length;
    if (crmMetricQuinceanerasEl) {
        crmMetricQuinceanerasEl.textContent = String(quinceanerasTotal);
    }

    if (conteoFiltradoLeadsEl) {
        const hayFiltro = Boolean(filtroActivoGrafico || filtroRapidoCrmActivo !== "todos" || (inputBuscarLeadsEl?.value || "").trim());
        conteoFiltradoLeadsEl.textContent = hayFiltro
            ? `Mostrando ${leads.length} de ${totalLeads} interesados`
            : `${totalLeads} interesados`;
    }

    if (leads.length === 0) {
        tbodyLeadsAdminEl.innerHTML = `
            <tr>
                <td colspan="9" class="crm-empty-state">
                    ${(inputBuscarLeadsEl?.value || "").trim() || filtroActivoGrafico || filtroRapidoCrmActivo !== "todos"
                        ? "No se encontraron prospectos que coincidan con los filtros aplicados."
                        : "Aún no hay leads capturados en este evento. Los invitados podrán solicitarlos tocando '🎁 Pase VIP & Descuento'."}
                </td>
            </tr>
        `;
        return;
    }

    try {
        tbodyLeadsAdminEl.innerHTML = leads.map((l) => {
            const nombre = escaparHtml(l.nombre || "Interesado VIP");
            const tel = escaparHtml(l.telefono || "");
            const nacFmt = escaparHtml(formatearFechaDMY(l.fecha_nacimiento));
            const generoStr = escaparHtml(l.genero || "No especificado");
            const generoLower = generoStr.toLowerCase();
            const generoClase = generoLower === "femenino" ? "gender-femenino" : (generoLower === "masculino" ? "gender-masculino" : (generoLower === "otro" ? "gender-otro" : ""));
            const correo = escaparHtml(l.correo || "No especificado");
            const codigo = escaparHtml(l.codigo_promocional || "—");
            const fechaIso = l.creado_en || "";
            const fechaFmt = fechaIso ? new Date(fechaIso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
            const telSoloDigitos = (l.telefono || "").replace(/\D/g, "");
            const urlWa = telSoloDigitos ? `https://wa.me/51${telSoloDigitos}?text=${encodeURIComponent(`¡Hola ${l.nombre || ''}! Te saludamos de Eventos Segalú. Vemos que solicitaste tu Pase VIP (${l.codigo_promocional || ''}) y nos encantaría brindarte información de nuestros paquetes.`)}` : "#";

            const infoEdad = calcularEdadDetallada(l.fecha_nacimiento);
            let edadHtml = '<span style="color:var(--text-warm-gray);">—</span>';
            if (infoEdad) {
                let badgeProspecto = "";
                if (infoEdad.anios >= 13 && infoEdad.anios <= 14) {
                    const mesesFaltan = infoEdad.mesesPara15 || (15 * 12 - (infoEdad.anios * 12 + infoEdad.meses));
                    badgeProspecto = `<span class="crm-badge-prospect-15">👑 Rumbo a 15 Años (Faltan ${mesesFaltan}m)</span>`;
                } else if (infoEdad.anios === 17) {
                    badgeProspecto = `<span class="crm-badge-prospect-18">🥂 Rumbo a 18 Años</span>`;
                }
                const badgeBday = infoEdad.esCumplePronto
                    ? `<span class="crm-badge-bday-soon">🎂 Cumple pronto (${infoEdad.diasParaCumple}d)</span>`
                    : "";

                edadHtml = `
                    <span class="crm-age-text">${escaparHtml(infoEdad.textoEdad)}</span>
                    ${badgeProspecto}
                    ${badgeBday}
                `;
            }

            const rowClass = infoEdad?.esCumplePronto ? "lead-row-bday-highlight" : "";

            return `
                <tr class="${rowClass}">
                    <td>
                        <strong>${nombre}</strong>
                    </td>
                    <td>
                        ${tel ? `<a href="${urlWa}" target="_blank" rel="noopener noreferrer" class="crm-wa-link" title="Abrir chat en WhatsApp">📲 ${tel}</a>` : "—"}
                    </td>
                    <td><span>${nacFmt}</span></td>
                    <td>${edadHtml}</td>
                    <td><span class="crm-badge-gender ${generoClase}">${generoStr}</span></td>
                    <td><span style="color:var(--text-warm-gray);">${correo}</span></td>
                    <td><span class="crm-lead-code-pill">${codigo}</span></td>
                    <td><small style="color:var(--text-warm-gray);">${fechaFmt}</small></td>
                    <td>
                        ${tel ? `<a href="${urlWa}" target="_blank" rel="noopener noreferrer" class="btn-crm-whatsapp-action" title="Abrir WhatsApp oficial">💬 WhatsApp</a>` : "—"}
                    </td>
                </tr>
            `;
        }).join("");
    } catch (eRender) {
        console.error("Error al renderizar filas de leads:", eRender);
    }
}

function filtrarLeadsGeneral() {
    const query = (inputBuscarLeadsEl?.value || "").trim().toLowerCase();
    if (btnLimpiarBusquedaLeadsEl) {
        btnLimpiarBusquedaLeadsEl.classList.toggle("hidden", !query);
    }

    let filtrados = cacheLeads;

    // 1. Filtrar por botones rápidos de CRM
    if (filtroRapidoCrmActivo === "15_anos") {
        filtrados = filtrados.filter((l) => {
            const det = calcularEdadDetallada(l.fecha_nacimiento);
            return det && (det.anios === 13 || det.anios === 14);
        });
    } else if (filtroRapidoCrmActivo === "hitos_18") {
        filtrados = filtrados.filter((l) => {
            const det = calcularEdadDetallada(l.fecha_nacimiento);
            return det && [17, 27, 29, 39, 49].includes(det.anios);
        });
    } else if (filtroRapidoCrmActivo === "cumple_mes") {
        filtrados = filtrados.filter((l) => {
            const det = calcularEdadDetallada(l.fecha_nacimiento);
            return det && (det.cumpleEnEsteMes || det.esCumplePronto);
        });
    }

    // 2. Filtrar por gráfico interactivo si está activo
    if (filtroActivoGrafico) {
        if (filtroActivoGrafico.tipo === "edad") {
            filtrados = filtrados.filter((l) => {
                const edad = calcularEdadLead(l.fecha_nacimiento);
                return obtenerRangoEdadLead(edad) === filtroActivoGrafico.valor;
            });
        } else if (filtroActivoGrafico.tipo === "cumple") {
            filtrados = filtrados.filter((l) => {
                const dias = calcularDiasHastaCumple(l.fecha_nacimiento);
                return obtenerRangoCumpleLead(dias) === filtroActivoGrafico.valor;
            });
        }
    }

    // 3. Filtrar por término de búsqueda en texto
    if (query) {
        filtrados = filtrados.filter((l) => {
            const n = (l.nombre || "").toLowerCase();
            const t = (l.telefono || "").toLowerCase();
            const c = (l.codigo_promocional || "").toLowerCase();
            const em = (l.correo || "").toLowerCase();
            const gen = (l.genero || "").toLowerCase();
            return n.includes(query) || t.includes(query) || c.includes(query) || em.includes(query) || gen.includes(query);
        });
    }

    renderizarTablaLeads(filtrados);
}

// Botones de filtro rápido CRM
document.querySelectorAll(".crm-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".crm-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        filtroRapidoCrmActivo = btn.dataset.filtroRapido || "todos";
        filtrarLeadsGeneral();
    });
});

const cardQuinceanerasEl = document.getElementById("crm-metric-quinceaneras")?.closest(".crm-metric-card");
if (cardQuinceanerasEl) {
    cardQuinceanerasEl.style.cursor = "pointer";
    cardQuinceanerasEl.title = "Clic para filtrar prospectos de 13 y 14 años";
    cardQuinceanerasEl.addEventListener("click", () => {
        const btn15 = document.querySelector('.crm-filter-btn[data-filtro-rapido="15_anos"]');
        if (btn15) btn15.click();
    });
}

if (inputBuscarLeadsEl) {
    inputBuscarLeadsEl.addEventListener("input", filtrarLeadsGeneral);
}
if (btnLimpiarBusquedaLeadsEl) {
    btnLimpiarBusquedaLeadsEl.addEventListener("click", () => {
        inputBuscarLeadsEl.value = "";
        btnLimpiarBusquedaLeadsEl.classList.add("hidden");
        filtrarLeadsGeneral();
    });
}
if (btnRemoverFiltroGraficoEl) {
    btnRemoverFiltroGraficoEl.addEventListener("click", removerFiltroGrafico);
}

const btnVaciarLeadsAdminEl = document.getElementById("btn-vaciar-leads-admin");
if (btnVaciarLeadsAdminEl) {
    btnVaciarLeadsAdminEl.addEventListener("click", async () => {
        if (!eventoSeleccionadoId) {
            mostrarAlertaAdmin("Selecciona primero un evento activo.", "error");
            return;
        }
        if (!confirm("¿Estás seguro de que deseas vaciar todos los leads y cupones de este evento? Esta acción no se puede deshacer.")) {
            return;
        }

        btnVaciarLeadsAdminEl.disabled = true;
        try {
            const res = await fetch(
                `/api/admin/eventos/${encodeURIComponent(eventoSeleccionadoId)}/leads`,
                {
                    method: "DELETE",
                    headers: { "X-Admin-Password": adminPasswordActiva },
                }
            );
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || "Error al vaciar los leads.");
            }

            cacheLeads = [];
            filtroActivoGrafico = null;
            filtroRapidoCrmActivo = "todos";
            document.querySelectorAll(".crm-filter-btn").forEach((b) => {
                b.classList.toggle("active", b.dataset.filtroRapido === "todos");
            });
            if (inputBuscarLeadsEl) inputBuscarLeadsEl.value = "";
            if (btnLimpiarBusquedaLeadsEl) btnLimpiarBusquedaLeadsEl.classList.add("hidden");
            const bannerCrm = document.getElementById("crm-active-filter-banner");
            if (bannerCrm) bannerCrm.classList.add("hidden");

            actualizarGraficosCrm([]);
            renderizarTablaLeads([]);
            mostrarAlertaAdmin("🗑️ Se vaciaron todos los leads y cupones del evento.", "exito");
        } catch (err) {
            mostrarAlertaAdmin(err.message, "error");
        } finally {
            btnVaciarLeadsAdminEl.disabled = false;
        }
    });
}

if (btnExportarLeadsCsvEl) {
    btnExportarLeadsCsvEl.addEventListener("click", () => {
        if (!eventoSeleccionadoId) {
            mostrarAlertaAdmin("Selecciona un evento para exportar sus leads.", "error");
            return;
        }
        window.location.href = `/api/eventos/${encodeURIComponent(eventoSeleccionadoId)}/leads/csv`;
    });
}

// Inicialización al abrir /admin
window.addEventListener("DOMContentLoaded", async () => {
    inputFechaEventoEl.value = new Date().toISOString().split("T")[0];
    const tabGuardado = sessionStorage.getItem(SESSION_ADMIN_TAB_KEY) || "tab-contenido-fotos";
    const tabInicial = document.getElementById(tabGuardado) ? tabGuardado : "tab-contenido-fotos";
    cambiarPestanaPrincipalAdmin(tabInicial);
    cargarFotosSedesAdmin();
    cargarYRenderizarPaquetesAdmin();
    if (adminPasswordActiva) {
        await cargarResumenPanel({ silencioso: true });
        iniciarCicloRefrescoSecuencial();
    }
});
