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

// Estado en memoria y semáforos de concurrencia para evitar peticiones solapadas
let adminPasswordActiva = sessionStorage.getItem(SESSION_ADMIN_KEY) || "";
let eventoSeleccionadoId = null;
let filtroEstadoFoto = "pendiente";
let autoAprobarFotosActivo = false;

let cacheMultimedia = [];
let cacheEventos = [];
let cacheInvitados = [];
let cachePreguntas = [];
let estadoTriviaActual = {
    fase: "inactiva",
    pregunta_activa_id: null,
    total_respuestas_activa: 0,
};

let peticionResumenEnCurso = false;
let refrescoPendienteEnCola = false;
let temporizadorAutoRefresco = null;

// Referencias DOM
const adminAlertaEl = document.getElementById("admin-alerta");
const vistaLoginAdminEl = document.getElementById("vista-login-admin");
const vistaDashboardAdminEl = document.getElementById("vista-dashboard-admin");
const adminHeaderControlsEl = document.getElementById("admin-header-controls");

const formLoginAdminEl = document.getElementById("form-login-admin");
const inputAdminPassEl = document.getElementById("input-admin-pass");
const btnRefrescarPanelEl = document.getElementById("btn-refrescar-panel");
const btnCerrarAdminEl = document.getElementById("btn-cerrar-admin");

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
const btnTriviaMostrarPodioEl = document.getElementById("btn-trivia-mostrar-podio");
const btnTriviaReiniciarPuntajesEl = document.getElementById("btn-trivia-reiniciar-puntajes");
const btnTriviaCerrarEl = document.getElementById("btn-trivia-cerrar");

// Generador PDF con IA Gratuita y Creador de Preguntas (en Ventana Modal Flotante)
const inputPdfTriviaIaEl = document.getElementById("input-pdf-trivia-ia");
const btnSubirPdfIaEl = document.getElementById("btn-subir-pdf-ia");
const estadoGeneracionPdfIaEl = document.getElementById("estado-generacion-pdf-ia");
const textoEstadoPdfIaEl = document.getElementById("texto-estado-pdf-ia");

const formCrearPreguntaEl = document.getElementById("form-crear-pregunta");
const listaPreguntasAdminEl = document.getElementById("lista-preguntas-admin");
const countPreguntasEventoEl = document.getElementById("count-preguntas-evento");

const listaInvitadosAdminEl = document.getElementById("lista-invitados-admin");
const btnLimpiarTodosInvitadosEl = document.getElementById("btn-limpiar-todos-invitados");

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

function mostrarAlertaAdmin(texto, tipo = "exito") {
    adminAlertaEl.textContent = texto;
    adminAlertaEl.className = `alert-box ${tipo === "exito" ? "alert-success" : "alert-error"}`;
    adminAlertaEl.classList.remove("hidden");
    setTimeout(() => {
        adminAlertaEl.classList.add("hidden");
    }, 4800);
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
        sessionStorage.setItem(SESSION_ADMIN_KEY, pass);
        adminAlertaEl.classList.add("hidden");
        await cargarResumenPanel({ silencioso: false });
        cargarFotosSedesAdmin();
        iniciarCicloRefrescoSecuencial();
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    }
});

btnCerrarAdminEl.addEventListener("click", () => {
    detenerCicloRefrescoSecuencial();
    sessionStorage.removeItem(SESSION_ADMIN_KEY);
    adminPasswordActiva = "";
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

    const msMostrados = data.tiempo_carga_ms ?? Math.round(tiempoClienteMs);
    if (badgeVelocidadEventoEl) {
        badgeVelocidadEventoEl.textContent = `⚡ ${msMostrados} ms`;
    }

    // 1. Llenar selector de Sedes solo si estaba vacío
    if (selectSedeLocalEl.options.length === 0 && data.locales) {
        data.locales.forEach((loc) => {
            const opt = document.createElement("option");
            opt.value = loc.id;
            opt.textContent = `${loc.nombre} (${loc.direccion})`;
            selectSedeLocalEl.appendChild(opt);
        });
    }

    // 2. Actualizar selector de Eventos conservando la selección actual
    if (Array.isArray(data.eventos)) {
        cacheEventos = data.eventos;
        eventoSeleccionadoId = data.evento_seleccionado_id || (cacheEventos[0]?.id ?? null);
        selectEventoActivoEl.innerHTML = "";

        cacheEventos.forEach((ev) => {
            const opt = document.createElement("option");
            opt.value = ev.id;
            opt.textContent = `${ev.nombre} [${ev.codigo_acceso}]`;
            if (ev.id === eventoSeleccionadoId) opt.selected = true;
            selectEventoActivoEl.appendChild(opt);
        });
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
}

async function cargarResumenPanel(opciones = { silencioso: true }) {
    if (!adminPasswordActiva) return;

    if (peticionResumenEnCurso) {
        refrescoPendienteEnCola = true;
        return;
    }

    peticionResumenEnCurso = true;
    const t0 = performance.now();

    const url = eventoSeleccionadoId
        ? `/api/admin/resumen?evento_id=${encodeURIComponent(eventoSeleccionadoId)}`
        : `/api/admin/resumen`;

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
        await cargarResumenPanel({ silencioso: true });
        temporizadorAutoRefresco = setTimeout(ciclo, 3500);
    }, 3500);
}

function detenerCicloRefrescoSecuencial() {
    if (temporizadorAutoRefresco) {
        clearTimeout(temporizadorAutoRefresco);
        temporizadorAutoRefresco = null;
    }
}

function obtenerUrlProyectorEventoActual() {
    const ev = cacheEventos.find((e) => e.id === eventoSeleccionadoId);
    if (!ev) return `${window.location.origin}/proyector`;
    return `${window.location.origin}/proyector?codigo=${encodeURIComponent(ev.codigo_acceso)}`;
}

function pintarResumenEventoActual() {
    const ev = cacheEventos.find((e) => e.id === eventoSeleccionadoId);
    if (!ev) {
        infoEventoSeleccionadoEl.innerHTML = `
            <div>Aún no hay eventos creados.</div>
            <div class="sidebar-event-actions">
                <button type="button" id="btn-abrir-modal-sedes" class="btn-sidebar-action btn-sidebar-modal-sedes">
                    🖼️ Administrar Galería de Fotos por Sede
                </button>
            </div>
        `;
        const btnSedesSinEv = document.getElementById("btn-abrir-modal-sedes");
        if (btnSedesSinEv) {
            btnSedesSinEv.addEventListener("click", () => abrirModalGestorSedesAdmin());
        }
        return;
    }
    const enlaceQR = `${window.location.origin}/?codigo=${encodeURIComponent(ev.codigo_acceso)}`;
    const enlaceProyector = obtenerUrlProyectorEventoActual();
    infoEventoSeleccionadoEl.innerHTML = `
        <div><strong>Sede:</strong> ${ev.locales?.nombre || "Segalú"}</div>
        <div><strong>Código QR:</strong> <code>${ev.codigo_acceso}</code></div>
        <div class="sidebar-event-actions">
            <a href="${enlaceProyector}" target="_blank" rel="noopener" class="btn-sidebar-action btn-sidebar-proyector">
                🖥️ Abrir Proyector en Vivo
            </a>
            <a href="${enlaceQR}" target="_blank" rel="noopener" class="btn-sidebar-action btn-sidebar-qr">
                📱 Abrir Enlace de Invitados
            </a>
            <button type="button" id="btn-abrir-modal-sedes" class="btn-sidebar-action btn-sidebar-modal-sedes">
                🖼️ Administrar Galería de Fotos por Sede
            </button>
            <button type="button" id="btn-abrir-modal-preguntas" class="btn-sidebar-action btn-sidebar-modal-preguntas">
                ➕ Crear Preguntas (Manual o PDF con IA)
            </button>
        </div>
    `;

    const btnModalSedesEl = document.getElementById("btn-abrir-modal-sedes");
    if (btnModalSedesEl) {
        btnModalSedesEl.addEventListener("click", () => abrirModalGestorSedesAdmin());
    }

    const btnModalPreguntasEl = document.getElementById("btn-abrir-modal-preguntas");
    if (btnModalPreguntasEl) {
        btnModalPreguntasEl.addEventListener("click", () => abrirModalCrearPreguntasAdmin());
    }
}

const btnAbrirProyectorTopbarEl = document.getElementById("btn-abrir-proyector-topbar");
if (btnAbrirProyectorTopbarEl) {
    btnAbrirProyectorTopbarEl.addEventListener("click", () => {
        window.open(obtenerUrlProyectorEventoActual(), "_blank", "noopener");
    });
}

selectEventoActivoEl.addEventListener("change", () => {
    cambiarEventoInstantaneo(selectEventoActivoEl.value);
});

btnRefrescarPanelEl.addEventListener("click", () => {
    cargarResumenPanel({ silencioso: false });
});

// ------------------------------------------------------------------------------
// 2.5 GESTIÓN EJECUTIVA DE BASE DE DATOS Y DESCARGA ZIP DEL EVENTO ACTIVO
// ------------------------------------------------------------------------------
async function descargarZipFotosEvento(conMarcaAgua = true) {
    if (!eventoSeleccionadoId) {
        mostrarAlertaAdmin("Selecciona primero un evento activo.", "error");
        return;
    }

    const boton = conMarcaAgua ? btnDescargarZipConMarcoEl : btnDescargarZipOriginalesEl;
    const textoOriginal = boton ? boton.innerHTML : "";
    if (boton) {
        boton.disabled = true;
        boton.innerHTML = `<span>⏳ Empaquetando archivo ZIP...</span>`;
    }

    try {
        const urlZip = `/api/admin/eventos/${encodeURIComponent(
            eventoSeleccionadoId
        )}/descargar-zip?con_marca_agua=${conMarcaAgua ? "true" : "false"}`;

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
        const sufijo = conMarcaAgua ? "Con_Marco_Segalu" : "Originales_Sin_Marco";
        const nombreDescarga = `Fotos_${cod}_${sufijo}.zip`;

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

if (btnDescargarZipConMarcoEl) {
    btnDescargarZipConMarcoEl.addEventListener("click", () => descargarZipFotosEvento(true));
}

if (btnDescargarZipOriginalesEl) {
    btnDescargarZipOriginalesEl.addEventListener("click", () => descargarZipFotosEvento(false));
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
                `Esta acción borrará en cascada:\n` +
                `1. Todas las fotos del Bucket de Supabase Storage y tabla multimedia.\n` +
                `2. Todas las preguntas y respuestas de la trivia.\n` +
                `3. Todos los invitados conectados.\n` +
                `4. El registro del evento.`
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
        return;
    }

    listaMostrar.forEach((foto) => {
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

document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        filtroEstadoFoto = tab.dataset.estado;
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
        podio: "PODIO EN PANTALLA",
    };

    textoEstadoTriviaAdminEl.textContent = mapaEtiquetasFase[fase] || "TRIVIA INACTIVA";
    if (fase === "inactiva") {
        badgeEstadoTriviaAdminEl.classList.remove("is-live");
    } else {
        badgeEstadoTriviaAdminEl.classList.add("is-live");
    }

    contadorVotosRondaEl.textContent = `Respuestas recibidas en pregunta activa: ${
        estadoTriviaActual.total_respuestas_activa || 0
    }`;

    btnTriviaAbrirLobbyEl.classList.toggle("active-phase", fase === "lobby");
    btnTriviaLanzarPreguntaEl.classList.toggle("active-phase", fase === "pregunta_activa");
    btnTriviaRevelarRespuestaEl.classList.toggle("active-phase", fase === "respuesta_revelada");
    btnTriviaMostrarPodioEl.classList.toggle("active-phase", fase === "podio");

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
                <button type="button" class="btn-delete-guest btn-del-pregunta" data-id="${preg.id}">
                    Eliminar
                </button>
            </div>
        `;

        card.querySelector(".btn-launch-this").addEventListener("click", () => {
            ejecutarControlTrivia("lanzar_pregunta", preg.id);
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
btnTriviaLanzarPreguntaEl.addEventListener("click", () => ejecutarControlTrivia("lanzar_pregunta"));
btnTriviaRevelarRespuestaEl.addEventListener("click", () =>
    ejecutarControlTrivia("revelar_respuesta")
);
btnTriviaMostrarPodioEl.addEventListener("click", () => ejecutarControlTrivia("mostrar_podio"));
btnTriviaReiniciarPuntajesEl.addEventListener("click", () =>
    ejecutarControlTrivia("reiniciar_puntajes")
);
btnTriviaCerrarEl.addEventListener("click", () => ejecutarControlTrivia("cerrar_trivia"));

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
            document.getElementById("select-tiempo-limite")?.value || "20";

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
    document.getElementById("count-invitados").textContent = invitados.length;
    listaInvitadosAdminEl.innerHTML = "";

    if (invitados.length === 0) {
        listaInvitadosAdminEl.innerHTML = `
            <div class="empty-state">Aún no hay invitados conectados en este evento.</div>
        `;
        return;
    }

    invitados.forEach((inv, idx) => {
        const avatarInfo = decodificarAvatarInvitado(inv.avatar);
        const puntos = inv.puntaje_total || 0;
        const medalla =
            idx === 0 && puntos > 0
                ? "🥇 "
                : idx === 1 && puntos > 0
                  ? "🥈 "
                  : idx === 2 && puntos > 0
                    ? "🥉 "
                    : `#${idx + 1} `;

        const item = document.createElement("div");
        item.className = "guest-admin-item";
        item.innerHTML = `
            <div class="author-row">
                <div class="mini-avatar-stage">
                    <span class="mini-char">${avatarInfo.iconoPersonaje}</span>
                    <span class="mini-acc">${avatarInfo.iconoAccesorio}</span>
                </div>
                <div class="author-meta">
                    <strong>${medalla}${inv.nombre}</strong>
                    <span>${avatarInfo.descripcion}</span>
                    <span class="guest-score-pill">🏆 ${puntos} pts</span>
                </div>
            </div>
            <button type="button" class="btn-delete-guest" data-id="${inv.id}">
                Eliminar
            </button>
        `;

        item.querySelector(".btn-delete-guest").addEventListener("click", async () => {
            cacheInvitados = cacheInvitados.filter((g) => g.id !== inv.id);
            renderizarListaInvitados(cacheInvitados);

            await fetch(`/api/invitados/${encodeURIComponent(inv.id)}`, { method: "DELETE" });
            mostrarAlertaAdmin(`Invitado '${inv.nombre}' eliminado del evento.`, "exito");
        });

        listaInvitadosAdminEl.appendChild(item);
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
        };

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
                <strong>Foto ${num} / 4</strong>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    class="hidden input-file-sede"
                    data-sede="${sedeKey}"
                    data-num="${num}"
                />
                <button type="button" class="btn-upload-sede-slot">
                    📷 Subir / Cambiar
                </button>
            </div>
        `;

        const inputEl = card.querySelector(".input-file-sede");
        const btnSubirSlotEl = card.querySelector(".btn-upload-sede-slot");

        btnSubirSlotEl.addEventListener("click", () => {
            inputEl.value = "";
            inputEl.click();
        });

        inputEl.addEventListener("change", async (e) => {
            const archivo = e.target.files?.[0];
            if (!archivo) return;
            await subirFotoSedeSlot(sedeKey, num, archivo, btnSubirSlotEl);
        });

        contenedorEl.appendChild(card);
    }
}

async function subirFotoSedeSlot(sedeKey, numeroFoto, archivo, botonEl = null) {
    const claveAuth = adminPasswordActiva || sessionStorage.getItem(SESSION_ADMIN_KEY) || "";
    const formData = new FormData();
    formData.append("sede", sedeKey);
    formData.append("sede_key", sedeKey);
    formData.append("numero_foto", String(numeroFoto));
    formData.append("indice_foto", String(numeroFoto));
    formData.append("archivo", archivo);

    const textoOriginal = botonEl ? botonEl.textContent : "📷 Subir / Cambiar";
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
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "No se pudo subir la foto de la sede.");
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

        mostrarAlertaAdmin(data.mensaje, "exito");
        await cargarFotosSedesAdmin();
    } catch (err) {
        mostrarAlertaAdmin(err.message, "error");
    } finally {
        if (botonEl) {
            botonEl.disabled = false;
            botonEl.textContent = textoOriginal;
        }
    }
}

// Inicialización al abrir /admin
window.addEventListener("DOMContentLoaded", async () => {
    inputFechaEventoEl.value = new Date().toISOString().split("T")[0];
    cargarFotosSedesAdmin();
    if (adminPasswordActiva) {
        await cargarResumenPanel({ silencioso: true });
        iniciarCicloRefrescoSecuencial();
    }
});
