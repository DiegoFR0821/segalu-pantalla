// ==============================================================================
// PROYECTO: MVP WEB SEGALU
// ARCHIVO: frontend/invitado/app.js
// FASE 2.5: Creador de Muñequitos Estilo Kahoot con Paquetes Temáticos,
//           Bloqueo/Eliminación de Nombre en Supabase y Promoción con Rastreo
// ==============================================================================

const STORAGE_KEY_SESION = "segalu_sesion_invitado";
const TELEFONO_WHATSAPP_SEGALU = "51907512340"; // Número oficial de Segalú (Carabayllo)

// ==============================================================================
// 0. CONFIGURACIÓN CENTRAL DE SEDES SEGALÚ (4 FOTOS POR SEDE + GOOGLE MAPS)
//    Puedes editar directamente aquí la dirección, el enlace de Google Maps
//    o las rutas de las 4 fotos de cada local (o subirlas desde el Panel Admin).
// ==============================================================================
const CONFIG_SEDES_SEGALU = {
    sede1: {
        id: "sede1",
        nombre: "Sede 1 - El Colocho (Carabayllo)",
        nombreCorto: "Sede 1 • El Colocho",
        badge: "Sede 1 • Av. Manuel Prado KM 22",
        capacidad: "Capacidad: 300 invitados",
        // 👇 EDITA AQUÍ LA DIRECCIÓN Y EL ENLACE DE GOOGLE MAPS DE LA SEDE 1:
        direccionTexto: "Av. Manuel Prado KM 22, Carabayllo — Sede 1 (El Colocho)",
        googleMapsUrl: "https://maps.app.goo.gl/93WowYMPxvxbFkCD7",
        fotos: [
            {
                id: "sede1_foto1",
                archivo: "/static/img/sedes/sede1_foto1.jpg",
                titulo: "Salón Principal de Gala • Sede 1",
                descripcion:
                    "Salón de gala para 300 invitados con iluminación inteligente, pista de baile central y proyección interactiva en pantalla gigante.",
                svgRespaldo: `<svg class="svg-icon svg-lg" viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>`,
            },
            {
                id: "sede1_foto2",
                archivo: "/static/img/sedes/sede1_foto2.jpg",
                titulo: "Pista de Baile LED & Escenario • Sede 1",
                descripcion:
                    "Escenario principal con cabezas móviles, sonido line-array profesional y efectos especiales para ingresos triunfales.",
                svgRespaldo: `<svg class="svg-icon svg-lg" viewBox="0 0 24 24"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>`,
            },
            {
                id: "sede1_foto3",
                archivo: "/static/img/sedes/sede1_foto3.jpg",
                titulo: "Mesas Imperiales & Decoración Floral • Sede 1",
                descripcion:
                    "Montaje de etiqueta con menaje dorado, centros de mesa florales y distribución cómoda para todas las familias.",
                svgRespaldo: `<svg class="svg-icon svg-lg" viewBox="0 0 24 24"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>`,
            },
            {
                id: "sede1_foto4",
                archivo: "/static/img/sedes/sede1_foto4.jpg",
                titulo: "Zona Lounge & Recepción VIP • Sede 1",
                descripcion:
                    "Área de bienvenida con barra de coctelería, estación fotográfica con sello dorado y atención personalizada.",
                svgRespaldo: `<svg class="svg-icon svg-lg" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
            },
        ],
    },
    sede2: {
        id: "sede2",
        nombre: "Sede 2 - Crystal Garden (Carabayllo)",
        nombreCorto: "Sede 2 • Crystal Garden",
        badge: "Sede 2 • A 1 cuadra de Sede 1 (KM 22)",
        capacidad: "Capacidad: 300 invitados",
        // 👇 EDITA AQUÍ LA DIRECCIÓN Y EL ENLACE DE GOOGLE MAPS DE LA SEDE 2:
        direccionTexto: "Av. Manuel Prado KM 22 (A 1 cuadra de Sede 1), Carabayllo — Sede 2 (Crystal Garden)",
        googleMapsUrl: "https://maps.app.goo.gl/bQ5MLqC9EfSrrybS9",
        fotos: [
            {
                id: "sede2_foto1",
                archivo: "/static/img/sedes/sede2_foto1.jpg",
                titulo: "Salón Crystal Garden • Sede 2",
                descripcion:
                    "A solo una cuadra de distancia, con capacidad para 300 personas. Ideal para bodas soñadas, quinceañeros y recepciones de lujo.",
                svgRespaldo: `<svg class="svg-icon svg-lg" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
            },
            {
                id: "sede2_foto2",
                archivo: "/static/img/sedes/sede2_foto2.jpg",
                titulo: "Producción Integral de 15 Años • Sede 2",
                descripcion:
                    "Escenografía temática, escalera/ingreso real, hora loca, fotos en vivo y trivias interactivas para todas las mesas.",
                svgRespaldo: `<svg class="svg-icon svg-lg" viewBox="0 0 24 24"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>`,
            },
            {
                id: "sede2_foto3",
                archivo: "/static/img/sedes/sede2_foto3.jpg",
                titulo: "Bodas & Aniversarios de Gala • Sede 2",
                descripcion:
                    "Catering selecto, decoración en cristal y flores naturales, sonido profesional y coordinación integral minuto a minuto.",
                svgRespaldo: `<svg class="svg-icon svg-lg" viewBox="0 0 24 24"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>`,
            },
            {
                id: "sede2_foto4",
                archivo: "/static/img/sedes/sede2_foto4.jpg",
                titulo: "Terraza & Estación de Fotos • Sede 2",
                descripcion:
                    "Espacios fotográficos iluminados y pantalla gigante Full HD para compartir recuerdos en tiempo real durante la fiesta.",
                svgRespaldo: `<svg class="svg-icon svg-lg" viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>`,
            },
        ],
    },
};

// ------------------------------------------------------------------------------
// 1. CATÁLOGO DE PERSONAJES BASE (Pestaña "Personaje")
// DIDÁCTICA: Si colocas un archivo PNG/SVG en la ruta 'imagen', el sistema lo
// usará automáticamente; si aún no existe el archivo, mostrará el 'icono' de respaldo.
// ------------------------------------------------------------------------------
const CATALOGO_PERSONAJES = [
    {
        id: "pug_real",
        nombre: "Pug Real",
        subtitulo: "Anfitrión VIP",
        icono: "🐶",
        imagen: "/static/img/personajes/pug_real.png",
    },
    {
        id: "gatito_gala",
        nombre: "Gato Smoking",
        subtitulo: "Elegante",
        icono: "🐱",
        imagen: "/static/img/personajes/gatito_gala.png",
    },
    {
        id: "osito_gala",
        nombre: "Osito Gala",
        subtitulo: "Festivo",
        icono: "🧸",
        imagen: "/static/img/personajes/osito_gala.png",
    },
    {
        id: "zorro_glam",
        nombre: "Zorro Glam",
        subtitulo: "Astuto",
        icono: "🦊",
        imagen: "/static/img/personajes/zorro_glam.png",
    },
    {
        id: "conejita_real",
        nombre: "Conejita Real",
        subtitulo: "Tierna",
        icono: "🐰",
        imagen: "/static/img/personajes/conejita_real.png",
    },
    {
        id: "leon_imperial",
        nombre: "León Imperial",
        subtitulo: "Majestad",
        icono: "🦁",
        imagen: "/static/img/personajes/leon_imperial.png",
    },
];

// ------------------------------------------------------------------------------
// 2. ARQUITECTURA MODULAR DE ACCESORIOS POR PAQUETES TEMÁTICOS (Pestaña "Accesorio")
// ------------------------------------------------------------------------------
const PAQUETES_ACCESORIOS_TEMATICOS = {
    paquete_boda: {
        nombrePaquete: "Gala & Bodas",
        carpeta: "/static/img/accesorios/paquete_boda",
        accesorios: [
            {
                id: "corona_imperial",
                nombre: "Corona Imperial",
                subtitulo: "Oro Real",
                icono: "👑",
                archivo: "corona_imperial.png",
            },
            {
                id: "sombrero_gala",
                nombre: "Sombrero de Gala",
                subtitulo: "Clásico",
                icono: "🎩",
                archivo: "sombrero_gala.png",
            },
            {
                id: "gorra_vip",
                nombre: "Gorra Fiesta",
                subtitulo: "Hora Loca",
                icono: "🧢",
                archivo: "gorra_vip.png",
            },
        ],
    },
    paquete_15_anos: {
        nombrePaquete: "15 Años",
        carpeta: "/static/img/accesorios/paquete_15_anos",
        accesorios: [
            {
                id: "corona_flores",
                nombre: "Corona de Flores",
                subtitulo: "Primavera",
                icono: "🌸",
                archivo: "corona_flores.png",
            },
            {
                id: "antifaz_15",
                nombre: "Antifaz de 15 Años",
                subtitulo: "Veneciano",
                icono: "🎭",
                archivo: "antifaz_15.png",
            },
        ],
    },
    paquete_princesas_disney: {
        nombrePaquete: "Princesas",
        carpeta: "/static/img/accesorios/paquete_princesas_disney",
        accesorios: [
            {
                id: "tiara_real",
                nombre: "Tiara de Cristal",
                subtitulo: "Realeza",
                icono: "💎",
                archivo: "tiara_real.png",
            },
            {
                id: "diadema_magica",
                nombre: "Diadema de Hadas",
                subtitulo: "Encantada",
                icono: "🌟",
                archivo: "diadema_magica.png",
            },
        ],
    },
};

// ------------------------------------------------------------------------------
// 3. ESTADO DE LA APLICACIÓN EN EL NAVEGADOR
// ------------------------------------------------------------------------------
let eventoActual = null;
let sesionInvitado = null;

// Selección temporal dentro del Creador de Muñequitos estilo Kahoot
let personajeSeleccionadoId = "pug_real";
let accesorioSeleccionadoId = "corona_imperial";
let paqueteFiltroActual = "todos";
let sedeGaleriaActiva = "sede1";
let indiceSlideGaleria = 0;

// Referencias DOM principales
const tituloEventoEl = document.getElementById("titulo-evento");
const subtituloLocalEl = document.getElementById("subtitulo-local");
const alertaMensajeEl = document.getElementById("alerta-mensaje");

const vistaRegistroEl = document.getElementById("vista-registro");
const vistaLobbyEl = document.getElementById("vista-lobby");

const inputCodigoEventoEl = document.getElementById("input-codigo-evento");
const btnVerificarCodigoEl = document.getElementById("btn-verificar-codigo");
const formRegistroEl = document.getElementById("form-registro-invitado");
const inputNombreEl = document.getElementById("input-nombre");
const btnEntrarEl = document.getElementById("btn-entrar");

// Elementos del Lobby
const lobbyCharLayerEl = document.getElementById("lobby-char-layer");
const lobbyAccLayerEl = document.getElementById("lobby-acc-layer");
const lobbyNombreInvitadoEl = document.getElementById("lobby-nombre-invitado");
const lobbyDescripcionAvatarEl = document.getElementById("lobby-descripcion-avatar");
const btnAbrirEditorAvatarEl = document.getElementById("btn-abrir-editor-avatar");
const medallonClickableEl = document.getElementById("medallon-clickable");

const btnIrFotosEl = document.getElementById("btn-ir-fotos");
const btnIrTriviaEl = document.getElementById("btn-ir-trivia");
const btnCorregirNombreEl = document.getElementById("btn-corregir-nombre");
const btnWhatsappSegaluEl = document.getElementById("btn-whatsapp-segalu");

// Elementos del Modal Personalizador Kahoot
const modalPersonalizarEl = document.getElementById("modal-personalizar-avatar");
const modalCharLayerEl = document.getElementById("modal-char-layer");
const modalAccLayerEl = document.getElementById("modal-acc-layer");
const modalPreviewTituloEl = document.getElementById("modal-preview-titulo");
const tabBtnPersonajeEl = document.getElementById("tab-btn-personaje");
const tabBtnAccesorioEl = document.getElementById("tab-btn-accesorio");
const panelPestanaPersonajeEl = document.getElementById("panel-pestana-personaje");
const panelPestanaAccesorioEl = document.getElementById("panel-pestana-accesorio");
const gridPersonajesEl = document.getElementById("grid-personajes");
const filtroPaquetesEl = document.getElementById("filtro-paquetes-tematicos");
const gridAccesoriosEl = document.getElementById("grid-accesorios");
const btnGuardarAvatarEl = document.getElementById("btn-guardar-avatar");
const btnCancelarAvatarEl = document.getElementById("btn-cancelar-avatar");

// Elementos del Modal de Galería
const modalGaleriaEl = document.getElementById("modal-galeria-segalu");
const btnAbrirGaleriaEl = document.getElementById("btn-abrir-galeria");
const btnConoceSegaluEl = document.getElementById("btn-conoce-segalu");
const btnCerrarGaleriaEl = document.getElementById("btn-cerrar-galeria");
const btnGaleriaPrevEl = document.getElementById("btn-galeria-prev");
const btnGaleriaNextEl = document.getElementById("btn-galeria-next");

// ------------------------------------------------------------------------------
// 4. FUNCIONES AUXILIARES PARA BUSCAR PERSONAJES Y ACCESORIOS
// ------------------------------------------------------------------------------
function obtenerTodosLosAccesorios() {
    const lista = [
        {
            id: "sin_accesorio",
            nombre: "Sin Accesorio",
            subtitulo: "Natural",
            icono: "—",
            rutaImagen: null,
            paqueteKey: "todos",
        },
    ];

    Object.entries(PAQUETES_ACCESORIOS_TEMATICOS).forEach(([paqueteKey, paquete]) => {
        paquete.accesorios.forEach((acc) => {
            lista.push({
                ...acc,
                paqueteKey,
                nombrePaquete: paquete.nombrePaquete,
                rutaImagen: `${paquete.carpeta}/${acc.archivo}`,
            });
        });
    });

    return lista;
}

function buscarPersonajePorId(id) {
    return CATALOGO_PERSONAJES.find((p) => p.id === id) || CATALOGO_PERSONAJES[0];
}

function buscarAccesorioPorId(id) {
    const todos = obtenerTodosLosAccesorios();
    return todos.find((a) => a.id === id) || todos[1]; // Por defecto Corona Imperial
}

function descomponerCodigoAvatar(codigoAvatar) {
    if (!codigoAvatar || typeof codigoAvatar !== "string") {
        return { personajeId: "pug_real", accesorioId: "corona_imperial" };
    }
    const partes = codigoAvatar.split("|");
    const personajeId = buscarPersonajePorId(partes[0]).id;
    const accesorioId = partes[1] ? buscarAccesorioPorId(partes[1]).id : "corona_imperial";
    return { personajeId, accesorioId };
}

/**
 * Renderiza la superposición de capas (Personaje + Accesorio en la cabeza).
 * Intenta cargar la imagen PNG/SVG si el usuario la colocó en la carpeta;
 * si no existe, muestra inmediatamente el ícono de respaldo sin error visual.
 */
function pintarCapasAvatar(contenedorChar, contenedorAcc, personajeObj, accesorioObj) {
    // Capa 1: Personaje
    contenedorChar.innerHTML = "";
    if (personajeObj.imagen) {
        const imgChar = document.createElement("img");
        imgChar.src = personajeObj.imagen;
        imgChar.alt = personajeObj.nombre;
        imgChar.className = "avatar-custom-img";
        imgChar.onerror = () => {
            contenedorChar.textContent = personajeObj.icono;
        };
        contenedorChar.appendChild(imgChar);
    } else {
        contenedorChar.textContent = personajeObj.icono;
    }

    // Capa 2: Accesorio superpuesto en la cabeza
    contenedorAcc.innerHTML = "";
    if (accesorioObj.id === "sin_accesorio") {
        contenedorAcc.textContent = "";
        return;
    }

    if (accesorioObj.rutaImagen) {
        const imgAcc = document.createElement("img");
        imgAcc.src = accesorioObj.rutaImagen;
        imgAcc.alt = accesorioObj.nombre;
        imgAcc.className = "accessory-custom-img";
        imgAcc.onerror = () => {
            contenedorAcc.textContent = accesorioObj.icono;
        };
        contenedorAcc.appendChild(imgAcc);
    } else {
        contenedorAcc.textContent = accesorioObj.icono;
    }
}

function mostrarAlerta(texto, tipo = "error") {
    alertaMensajeEl.textContent = texto;
    alertaMensajeEl.className = `alert-box ${tipo === "exito" ? "alert-success" : "alert-error"}`;
    alertaMensajeEl.classList.remove("hidden");
    setTimeout(() => {
        alertaMensajeEl.classList.add("hidden");
    }, 4500);
}

// ------------------------------------------------------------------------------
// 5. ENCABEZADO DE GALA Y ENLACE DE WHATSAPP CON RASTREO DINÁMICO
// ------------------------------------------------------------------------------
function actualizarCabeceraYWhatsApp(evento) {
    if (!evento) return;

    const nombreEvento = evento.nombre || "Gala Segalú";
    const nombreLocal = evento.locales?.nombre || "Sede 1 - El Colocho";

    tituloEventoEl.innerHTML = `¡Bienvenido a <em class="gold-italic">${nombreEvento}</em>!`;
    subtituloLocalEl.textContent = nombreLocal.toUpperCase();

    // Mensaje de rastreo dinámico para identificar clientes desde la aplicación
    const mensajeRastreo = `¡Hola Segalú! Estoy en el evento "${nombreEvento}" en "${nombreLocal}" usando la app interactiva de la pantalla gigante y deseo información de sus paquetes de eventos.`;
    btnWhatsappSegaluEl.href = `https://wa.me/${TELEFONO_WHATSAPP_SEGALU}?text=${encodeURIComponent(mensajeRastreo)}`;
}

// ------------------------------------------------------------------------------
// 6. CONSULTAR EVENTO ACTIVO EN PYTHON (GET /api/eventos/{codigo_acceso})
// ------------------------------------------------------------------------------
async function cargarEventoPorCodigo(codigoAcceso) {
    const codigoLimpio = (codigoAcceso || "").trim().toUpperCase();
    if (!codigoLimpio) {
        mostrarAlerta("Ingresa o escanea el código QR del evento.");
        return null;
    }

    try {
        const respuestaHttp = await fetch(`/api/eventos/${encodeURIComponent(codigoLimpio)}`);
        const resultado = await respuestaHttp.json();

        if (!respuestaHttp.ok) {
            throw new Error(resultado.detail || "No se encontró el evento.");
        }

        eventoActual = resultado.evento;
        actualizarCabeceraYWhatsApp(eventoActual);
        return eventoActual;
    } catch (error) {
        eventoActual = null;
        tituloEventoEl.innerHTML = `Verifica el <em class="gold-italic">Código QR</em>`;
        subtituloLocalEl.textContent = "SEGALÚ EVENTOS • CARABAYLLO";
        mostrarAlerta(error.message, "error");
        return null;
    }
}

// ------------------------------------------------------------------------------
// 7. REGISTRO DEL INVITADO (POST /api/invitados/registro)
// ------------------------------------------------------------------------------
const HTML_BTN_ENTRAR_ORIGINAL = `
    <svg class="svg-icon svg-sm icon-dark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3L14 9L20 11L14 13L12 19L10 13L4 11L10 9L12 3Z" />
    </svg>
    <span>Ingresar a la Gala en Vivo</span>
`;

formRegistroEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!eventoActual) {
        const verificado = await cargarEventoPorCodigo(inputCodigoEventoEl.value);
        if (!verificado) return;
    }

    const nombreInvitado = inputNombreEl.value.trim();
    if (nombreInvitado.length < 2) {
        mostrarAlerta("Por favor escribe tu nombre (mínimo 2 letras).");
        inputNombreEl.focus();
        return;
    }

    btnEntrarEl.disabled = true;
    btnEntrarEl.innerHTML = `<span>Conectando con la pantalla...</span>`;

    try {
        const avatarInicial = `${personajeSeleccionadoId}|${accesorioSeleccionadoId}`;
        const respuestaHttp = await fetch("/api/invitados/registro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                evento_id: eventoActual.id,
                nombre_invitado: nombreInvitado,
                avatar_munequito: avatarInicial,
            }),
        });

        const resultado = await respuestaHttp.json();
        if (!respuestaHttp.ok) {
            throw new Error(resultado.detail || "No se pudo registrar tu ingreso.");
        }

        sesionInvitado = {
            invitado: resultado.invitado,
            evento: eventoActual,
        };

        localStorage.setItem(STORAGE_KEY_SESION, JSON.stringify(sesionInvitado));
        mostrarAlerta(resultado.mensaje, "exito");
        mostrarPantallaLobby(sesionInvitado);
    } catch (error) {
        mostrarAlerta(error.message, "error");
    } finally {
        btnEntrarEl.disabled = false;
        btnEntrarEl.innerHTML = HTML_BTN_ENTRAR_ORIGINAL;
    }
});

// ------------------------------------------------------------------------------
// 8. PINTAR LOBBY DE GALA (Nombre Bloqueado + Muñequito con Capas)
// ------------------------------------------------------------------------------
function mostrarPantallaLobby(sesion) {
    sesionInvitado = sesion;
    eventoActual = sesion.evento;

    actualizarCabeceraYWhatsApp(eventoActual);

    const { personajeId, accesorioId } = descomponerCodigoAvatar(sesion.invitado.avatar);
    personajeSeleccionadoId = personajeId;
    accesorioSeleccionadoId = accesorioId;

    const personajeObj = buscarPersonajePorId(personajeId);
    const accesorioObj = buscarAccesorioPorId(accesorioId);

    // Pintamos las 2 capas en el medallón central del Lobby
    pintarCapasAvatar(lobbyCharLayerEl, lobbyAccLayerEl, personajeObj, accesorioObj);

    // Nombre bloqueado en el Lobby (sin puntos de trivia)
    lobbyNombreInvitadoEl.textContent = sesion.invitado.nombre;
    lobbyDescripcionAvatarEl.textContent =
        accesorioObj.id === "sin_accesorio"
            ? `Invitado de Honor • ${personajeObj.nombre}`
            : `Invitado de Honor • ${personajeObj.nombre} con ${accesorioObj.nombre}`;

    vistaRegistroEl.classList.add("hidden");
    vistaLobbyEl.classList.remove("hidden");

    // Actualizar tarjetas de ubicación con el nombre del evento activo
    renderizarSeccionUbicacionSedes();

    // [FASE 4.5 - REQUERIMIENTO C] Iniciamos el pulso automático en segundo plano (cada 2.5s)
    // para que el invitado nunca tenga que recargar la página si el Admin abre o cierra la trivia.
    iniciarPulsoSincronizacionLobby();
}

// ------------------------------------------------------------------------------
// 9. SALIR / CORREGIR MI NOMBRE (DELETE /api/invitados/{id} EN SUPABASE)
// DIDÁCTICA: Elimina físicamente el registro de la base de datos para no dejar
// usuarios fantasma cuando alguien se equivocó al escribir su nombre.
// ------------------------------------------------------------------------------
btnCorregirNombreEl.addEventListener("click", async () => {
    const invitadoId = sesionInvitado?.invitado?.id;
    const nombreActual = sesionInvitado?.invitado?.nombre || "";

    btnCorregirNombreEl.disabled = true;
    btnCorregirNombreEl.textContent = "Liberando tu registro...";

    detenerPulsoSincronizacionLobby();
    detenerPollingTriviaMovil();
    detenerCronometroFluidoPregunta();

    try {
        if (invitadoId) {
            await fetch(`/api/invitados/${encodeURIComponent(invitadoId)}`, {
                method: "DELETE",
            });
        }
    } catch (e) {
        // Incluso si hubiera corte momentáneo de red, limpiamos la sesión local
    } finally {
        localStorage.removeItem(STORAGE_KEY_SESION);
        sesionInvitado = null;
        vistaLobbyEl.classList.add("hidden");
        vistaTriviaInvitadoEl.classList.add("hidden");
        vistaRegistroEl.classList.remove("hidden");
        inputNombreEl.value = nombreActual;
        inputNombreEl.focus();
        btnCorregirNombreEl.disabled = false;
        btnCorregirNombreEl.textContent = "Salir / Corregir mi nombre";
        mostrarAlerta("Tu registro anterior fue eliminado. Escribe tu nombre corregido.", "exito");
    }
});

// ------------------------------------------------------------------------------
// 10. CREADOR DE MUÑEQUITOS ESTILO KAHOOT (2 PESTAÑAS + PAQUETES TEMÁTICOS)
// ------------------------------------------------------------------------------
function actualizarPrevisualizacionModal() {
    const personajeObj = buscarPersonajePorId(personajeSeleccionadoId);
    const accesorioObj = buscarAccesorioPorId(accesorioSeleccionadoId);

    pintarCapasAvatar(modalCharLayerEl, modalAccLayerEl, personajeObj, accesorioObj);

    modalPreviewTituloEl.textContent =
        accesorioObj.id === "sin_accesorio"
            ? `${personajeObj.nombre} (Natural)`
            : `${personajeObj.nombre} con ${accesorioObj.nombre}`;
}

function renderizarCuadriculaPersonajes() {
    gridPersonajesEl.innerHTML = "";

    CATALOGO_PERSONAJES.forEach((personaje) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `item-option-card ${personaje.id === personajeSeleccionadoId ? "selected" : ""}`;
        btn.innerHTML = `
            <span class="item-check-badge">✓</span>
            <span class="item-option-icon">${personaje.icono}</span>
            <span class="item-option-title">${personaje.nombre}</span>
            <span class="item-option-sub">${personaje.subtitulo}</span>
        `;
        btn.addEventListener("click", () => {
            personajeSeleccionadoId = personaje.id;
            renderizarCuadriculaPersonajes();
            actualizarPrevisualizacionModal();
        });
        gridPersonajesEl.appendChild(btn);
    });
}

function renderizarFiltrosPaquetes() {
    filtroPaquetesEl.innerHTML = "";

    const opcionesFiltro = [
        { key: "todos", label: "Todos" },
        ...Object.entries(PAQUETES_ACCESORIOS_TEMATICOS).map(([key, datos]) => ({
            key,
            label: datos.nombrePaquete,
        })),
    ];

    opcionesFiltro.forEach((op) => {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = `package-pill-btn ${paqueteFiltroActual === op.key ? "active" : ""}`;
        pill.textContent = op.label;
        pill.addEventListener("click", () => {
            paqueteFiltroActual = op.key;
            renderizarFiltrosPaquetes();
            renderizarCuadriculaAccesorios();
        });
        filtroPaquetesEl.appendChild(pill);
    });
}

function renderizarCuadriculaAccesorios() {
    gridAccesoriosEl.innerHTML = "";

    const todos = obtenerTodosLosAccesorios();
    const filtrados = todos.filter(
        (acc) =>
            paqueteFiltroActual === "todos" ||
            acc.id === "sin_accesorio" ||
            acc.paqueteKey === paqueteFiltroActual
    );

    filtrados.forEach((accesorio) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `item-option-card ${accesorio.id === accesorioSeleccionadoId ? "selected" : ""}`;
        btn.innerHTML = `
            <span class="item-check-badge">✓</span>
            <span class="item-option-icon">${accesorio.icono}</span>
            <span class="item-option-title">${accesorio.nombre}</span>
            <span class="item-option-sub">${accesorio.subtitulo}</span>
        `;
        btn.addEventListener("click", () => {
            accesorioSeleccionadoId = accesorio.id;
            renderizarCuadriculaAccesorios();
            actualizarPrevisualizacionModal();
        });
        gridAccesoriosEl.appendChild(btn);
    });
}

function abrirModalPersonalizador() {
    if (sesionInvitado?.invitado?.avatar) {
        const actual = descomponerCodigoAvatar(sesionInvitado.invitado.avatar);
        personajeSeleccionadoId = actual.personajeId;
        accesorioSeleccionadoId = actual.accesorioId;
    }

    renderizarCuadriculaPersonajes();
    renderizarFiltrosPaquetes();
    renderizarCuadriculaAccesorios();
    actualizarPrevisualizacionModal();

    modalPersonalizarEl.classList.remove("hidden");
}

function cerrarModalPersonalizador() {
    modalPersonalizarEl.classList.add("hidden");
}

// Conmutación entre Pestaña "Personaje" y Pestaña "Accesorio"
tabBtnPersonajeEl.addEventListener("click", () => {
    tabBtnPersonajeEl.classList.add("active");
    tabBtnAccesorioEl.classList.remove("active");
    panelPestanaPersonajeEl.classList.remove("hidden");
    panelPestanaAccesorioEl.classList.add("hidden");
});

tabBtnAccesorioEl.addEventListener("click", () => {
    tabBtnAccesorioEl.classList.add("active");
    tabBtnPersonajeEl.classList.remove("active");
    panelPestanaAccesorioEl.classList.remove("hidden");
    panelPestanaPersonajeEl.classList.add("hidden");
});

btnAbrirEditorAvatarEl.addEventListener("click", abrirModalPersonalizador);
medallonClickableEl.addEventListener("click", abrirModalPersonalizador);
btnCancelarAvatarEl.addEventListener("click", cerrarModalPersonalizador);

// Guardar en Supabase al pulsar "¡Listo! Guardar y Proyectar"
btnGuardarAvatarEl.addEventListener("click", async () => {
    const nuevoCodigoAvatar = `${personajeSeleccionadoId}|${accesorioSeleccionadoId}`;
    const invitadoId = sesionInvitado?.invitado?.id;

    if (!invitadoId) {
        cerrarModalPersonalizador();
        return;
    }

    btnGuardarAvatarEl.disabled = true;
    btnGuardarAvatarEl.textContent = "Guardando en pantalla...";

    try {
        const respuestaHttp = await fetch(`/api/invitados/${encodeURIComponent(invitadoId)}/avatar`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ avatar_munequito: nuevoCodigoAvatar }),
        });

        const resultado = await respuestaHttp.json();
        if (!respuestaHttp.ok) {
            throw new Error(resultado.detail || "No se pudo actualizar tu personaje.");
        }

        sesionInvitado.invitado = resultado.invitado;
        localStorage.setItem(STORAGE_KEY_SESION, JSON.stringify(sesionInvitado));

        mostrarPantallaLobby(sesionInvitado);
        cerrarModalPersonalizador();
        mostrarAlerta(resultado.mensaje, "exito");
    } catch (error) {
        mostrarAlerta(error.message, "error");
    } finally {
        btnGuardarAvatarEl.disabled = false;
        btnGuardarAvatarEl.textContent = "¡Listo! Guardar y Proyectar";
    }
});

// ------------------------------------------------------------------------------
// 11. GALERÍA DE 4 FOTOS POR SEDE + UBICACIÓN GOOGLE MAPS Y COMPARTIR WHATSAPP
// ------------------------------------------------------------------------------
function generarUrlCompartirUbicacionWhatsApp(sedeConfig) {
    const nombreEventoTxt = eventoActual?.nombre_evento
        ? ` para el evento "${eventoActual.nombre_evento}"`
        : "";
    const mensaje = [
        `📍 *Ubicación de ${sedeConfig.nombre}*${nombreEventoTxt}`,
        `🏛️ Dirección: ${sedeConfig.direccionTexto}`,
        `🗺️ Ver en Google Maps: ${sedeConfig.googleMapsUrl}`,
    ].join("\n");

    // https://wa.me/?text=... sin número fijo permite al invitado elegir a cualquier familiar/contacto
    return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}

function renderizarSeccionUbicacionSedes() {
    const contenedorEl = document.getElementById("contenedor-tarjetas-ubicacion");
    if (!contenedorEl) return;

    const listaSedes = [CONFIG_SEDES_SEGALU.sede1, CONFIG_SEDES_SEGALU.sede2];
    contenedorEl.innerHTML = listaSedes
        .map((sede) => {
            const urlWaShare = generarUrlCompartirUbicacionWhatsApp(sede);
            return `
                <article class="sede-ubicacion-card">
                    <div class="sede-ubicacion-top">
                        <div class="sede-pin-badge" aria-hidden="true">📍</div>
                        <div class="sede-ubicacion-info">
                            <strong>${sede.nombre}</strong>
                            <span>${sede.direccionTexto}</span>
                        </div>
                    </div>
                    <div class="sede-ubicacion-actions">
                        <a
                            href="${sede.googleMapsUrl}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="btn-sede-maps"
                        >
                            <span>🗺️ Abrir en Google Maps</span>
                        </a>
                        <a
                            href="${urlWaShare}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="btn-sede-share-wa"
                        >
                            <span>📲 Compartir dirección a un invitado</span>
                        </a>
                    </div>
                </article>
            `;
        })
        .join("");
}

function actualizarPortadasSedesLobby() {
    const mapeoPortadas = [
        { sedeKey: "sede1", imgId: "img-portada-sede1", iconoId: "icono-portada-sede1" },
        { sedeKey: "sede2", imgId: "img-portada-sede2", iconoId: "icono-portada-sede2" },
    ];

    mapeoPortadas.forEach(({ sedeKey, imgId, iconoId }) => {
        const sede = CONFIG_SEDES_SEGALU[sedeKey];
        const primeraFoto = sede?.fotos?.[0];
        const imgEl = document.getElementById(imgId);
        const iconoEl = document.getElementById(iconoId);
        if (!imgEl || !primeraFoto) return;

        imgEl.onload = () => {
            imgEl.classList.remove("hidden");
            if (iconoEl) iconoEl.classList.add("hidden");
        };
        imgEl.onerror = () => {
            imgEl.classList.add("hidden");
            if (iconoEl) iconoEl.classList.remove("hidden");
        };
        imgEl.src = primeraFoto.archivo;
    });
}

function aplicarMapaFotosSedes(fotosServidor, fotosMapa) {
    ["sede1", "sede2"].forEach((sedeKey) => {
        const listaServidor = fotosServidor?.[sedeKey];
        if (Array.isArray(listaServidor)) {
            listaServidor.forEach((infoFoto, idx) => {
                if (infoFoto.existe && infoFoto.url && CONFIG_SEDES_SEGALU[sedeKey]?.fotos?.[idx]) {
                    CONFIG_SEDES_SEGALU[sedeKey].fotos[idx].archivo = infoFoto.url;
                }
            });
        }

        const mapaSede = fotosMapa?.[sedeKey];
        if (mapaSede && typeof mapaSede === "object") {
            for (let num = 1; num <= 4; num++) {
                const urlCustom = mapaSede[String(num)];
                if (urlCustom && CONFIG_SEDES_SEGALU[sedeKey]?.fotos?.[num - 1]) {
                    CONFIG_SEDES_SEGALU[sedeKey].fotos[num - 1].archivo = urlCustom;
                }
            }
        }
    });

    actualizarPortadasSedesLobby();
    if (!modalGaleriaEl.classList.contains("hidden")) {
        mostrarSlideGaleria(indiceSlideGaleria);
    }
}

async function sincronizarFotosSedesDesdeServidor() {
    // 1. Si hay caché inmediata en el mismo navegador, aplicarla al instante
    try {
        const cacheLocal = localStorage.getItem("segalu_fotos_sedes_cache");
        if (cacheLocal) {
            aplicarMapaFotosSedes({}, JSON.parse(cacheLocal));
        }
    } catch (_) {}

    // 2. Consultar al backend (/api/sedes/fotos) para obtener las URLs de Supabase Storage
    try {
        const res = await fetch("/api/sedes/fotos");
        if (!res.ok) {
            actualizarPortadasSedesLobby();
            return;
        }
        const data = await res.json();
        aplicarMapaFotosSedes(data.fotos || {}, data.fotos_sedes || {});
    } catch (_) {
        actualizarPortadasSedesLobby();
    }
}

if (typeof BroadcastChannel !== "undefined") {
    const canalSedesInvitado = new BroadcastChannel("segalu_sedes_sync");
    canalSedesInvitado.addEventListener("message", (ev) => {
        if (ev.data?.tipo === "FOTO_SEDE_ACTUALIZADA") {
            aplicarMapaFotosSedes({}, ev.data.fotos_sedes || {});
        }
    });
}

function mostrarSlideGaleria(indice) {
    const sede = CONFIG_SEDES_SEGALU[sedeGaleriaActiva] || CONFIG_SEDES_SEGALU.sede1;
    const fotosSede = sede.fotos || [];
    const total = fotosSede.length || 4;
    indiceSlideGaleria = (indice + total) % total;
    const slide = fotosSede[indiceSlideGaleria];

    // Sincronizar pestañas Sede 1 / Sede 2 (compatible con data-sede y data-sede-tab)
    document.querySelectorAll(".btn-sede-tab").forEach((btn) => {
        const keyBtn = btn.dataset.sede || btn.dataset.sedeTab;
        btn.classList.toggle("active", keyBtn === sedeGaleriaActiva);
    });

    const badgeEl = document.getElementById("galeria-slide-badge");
    const iconoEl = document.getElementById("galeria-slide-icono");
    const imgSlideEl = document.getElementById("galeria-slide-img");
    const tituloEl = document.getElementById("galeria-slide-titulo");
    const descEl = document.getElementById("galeria-slide-desc");
    const indicadorEl = document.getElementById("galeria-indicador");

    if (badgeEl) badgeEl.textContent = `${sede.badge} • Foto ${indiceSlideGaleria + 1} de ${total}`;
    if (iconoEl) iconoEl.innerHTML = slide.svgRespaldo;
    if (tituloEl) tituloEl.textContent = slide.titulo;
    if (descEl) descEl.textContent = slide.descripcion;
    if (indicadorEl) indicadorEl.textContent = `${indiceSlideGaleria + 1} / ${total}`;

    if (imgSlideEl) {
        imgSlideEl.onload = () => {
            imgSlideEl.classList.remove("hidden");
            if (iconoEl) iconoEl.classList.add("hidden");
        };
        imgSlideEl.onerror = () => {
            imgSlideEl.classList.add("hidden");
            if (iconoEl) iconoEl.classList.remove("hidden");
        };
        imgSlideEl.src = slide.archivo;
    }

    // Actualizar tarjeta de ubicación y botones del modal para la sede activa
    const dirModalEl = document.getElementById("galeria-modal-direccion-texto");
    const btnMapsModalEl = document.getElementById("btn-modal-abrir-maps");
    const btnWaModalEl = document.getElementById("btn-modal-compartir-wa");

    if (dirModalEl) dirModalEl.textContent = sede.direccionTexto;
    if (btnMapsModalEl) btnMapsModalEl.href = sede.googleMapsUrl;
    if (btnWaModalEl) btnWaModalEl.href = generarUrlCompartirUbicacionWhatsApp(sede);
}

function abrirGaleriaSegalu(sedeKey = "sede1", indiceInicial = 0) {
    sedeGaleriaActiva = CONFIG_SEDES_SEGALU[sedeKey] ? sedeKey : "sede1";
    mostrarSlideGaleria(indiceInicial);
    modalGaleriaEl.classList.remove("hidden");
}

btnAbrirGaleriaEl.addEventListener("click", () => abrirGaleriaSegalu("sede1", 0));
btnConoceSegaluEl.addEventListener("click", () => abrirGaleriaSegalu("sede1", 0));
btnCerrarGaleriaEl.addEventListener("click", () => modalGaleriaEl.classList.add("hidden"));
btnGaleriaPrevEl.addEventListener("click", () => mostrarSlideGaleria(indiceSlideGaleria - 1));
btnGaleriaNextEl.addEventListener("click", () => mostrarSlideGaleria(indiceSlideGaleria + 1));

document.querySelectorAll(".btn-sede-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const sedeDestino = tabBtn.dataset.sede || tabBtn.dataset.sedeTab || "sede1";
        sedeGaleriaActiva = CONFIG_SEDES_SEGALU[sedeDestino] ? sedeDestino : "sede1";
        mostrarSlideGaleria(0);
    });
});

document.querySelectorAll(".space-card").forEach((card) => {
    card.addEventListener("click", () => {
        const sedeKey = card.dataset.sede || card.dataset.sedeTab || "sede1";
        const slideIdx = parseInt(card.dataset.slide || "0", 10);
        abrirGaleriaSegalu(sedeKey, slideIdx);
    });
});

// Botones de acción de Fase 3 y Fase 4
btnVerificarCodigoEl.addEventListener("click", () => {
    cargarEventoPorCodigo(inputCodigoEventoEl.value);
});

// ------------------------------------------------------------------------------
// 12. [FASE 3] SUBIDA DE FOTOS CON PRE-FILTRO DE IA GRATUITO Y SELLO SEGALÚ
// ------------------------------------------------------------------------------
const modalSubirFotoEl = document.getElementById("modal-subir-foto");
const inputArchivoFotoEl = document.getElementById("input-archivo-foto");
const placeholderSubidaEl = document.getElementById("placeholder-subida");
const contenedorPreviewFotoEl = document.getElementById("contenedor-preview-foto");
const imgPreviewFotoEl = document.getElementById("img-preview-foto");
const barraEstadoIaEl = document.getElementById("barra-estado-ia");
const iaPuntajeTextoEl = document.getElementById("ia-puntaje-texto");
const iaDetalleTextoEl = document.getElementById("ia-detalle-texto");
const btnEnviarFotoEl = document.getElementById("btn-enviar-foto");
const btnCerrarModalFotoEl = document.getElementById("btn-cerrar-modal-foto");

let archivoFotoSeleccionado = null;
let puntajeIaCalculadoCliente = 95;

const HTML_BTN_ENVIAR_FOTO_ORIGINAL = `
    <svg class="svg-icon svg-sm icon-dark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
    <span>Enviar Foto a la Pantalla</span>
`;

/**
 * DIDÁCTICA (Pre-Filtro de IA 100% Gratuito en el Navegador):
 * Dibuja la foto en un pequeño lienzo <canvas> de 120x120 px en memoria
 * y analiza la crominancia YCbCr de cada píxel para calcular el porcentaje
 * de seguridad (0 a 100%) sin usar servidores externos ni API Keys de pago.
 */
function calcularPuntajeIaEnCanvas(elementoImagen) {
    try {
        const canvas = document.createElement("canvas");
        const lado = 120;
        canvas.width = lado;
        canvas.height = lado;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(elementoImagen, 0, 0, lado, lado);

        const datos = ctx.getImageData(0, 0, lado, lado).data;
        const totalPixeles = lado * lado;
        let pielTotal = 0;
        let pielCentro = 0;
        let totalCentro = 0;

        for (let i = 0; i < datos.length; i += 4) {
            const idxPixel = i / 4;
            const fila = Math.floor(idxPixel / lado);
            const col = idxPixel % lado;
            const enCentro = fila >= 30 && fila <= 90 && col >= 30 && col <= 90;
            if (enCentro) totalCentro++;

            const r = datos[i];
            const g = datos[i + 1];
            const b = datos[i + 2];

            // Conversión RGB a espacio cromático YCbCr
            const y = 0.299 * r + 0.587 * g + 0.114 * b;
            const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
            const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

            if (y > 60 && y < 245 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
                pielTotal++;
                if (enCentro) pielCentro++;
            }
        }

        const ratioGlobal = pielTotal / totalPixeles;
        const ratioCentro = pielCentro / Math.max(1, totalCentro);
        const indiceRiesgo = ratioCentro * 0.6 + ratioGlobal * 0.4;

        let puntaje = 96;
        if (indiceRiesgo <= 0.22) {
            puntaje = Math.round(99 - indiceRiesgo * 40);
        } else if (indiceRiesgo <= 0.42) {
            puntaje = Math.round(90 - (indiceRiesgo - 0.22) * 90);
        } else {
            puntaje = Math.max(15, Math.round(70 - (indiceRiesgo - 0.42) * 140));
        }

        return Math.max(5, Math.min(99, puntaje));
    } catch (e) {
        return 94;
    }
}

function reiniciarModalFoto() {
    archivoFotoSeleccionado = null;
    inputArchivoFotoEl.value = "";
    imgPreviewFotoEl.src = "";
    const bgBlurEl = document.getElementById("bg-blur-preview-foto");
    if (bgBlurEl) bgBlurEl.style.backgroundImage = "none";
    placeholderSubidaEl.classList.remove("hidden");
    contenedorPreviewFotoEl.classList.add("hidden");
    barraEstadoIaEl.classList.add("hidden");
    barraEstadoIaEl.classList.remove("ia-warning");
    btnEnviarFotoEl.disabled = true;
    btnEnviarFotoEl.innerHTML = HTML_BTN_ENVIAR_FOTO_ORIGINAL;
}

btnIrFotosEl.addEventListener("click", () => {
    reiniciarModalFoto();
    modalSubirFotoEl.classList.remove("hidden");
});

btnCerrarModalFotoEl.addEventListener("click", () => {
    modalSubirFotoEl.classList.add("hidden");
});

inputArchivoFotoEl.addEventListener("change", (eventoChange) => {
    const archivo = eventoChange.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
        mostrarAlerta("Por favor selecciona una imagen válida (JPG, PNG o WebP).");
        return;
    }

    archivoFotoSeleccionado = archivo;
    const lector = new FileReader();

    lector.onload = (e) => {
        const dataUrl = e.target.result;
        const bgBlurEl = document.getElementById("bg-blur-preview-foto");
        if (bgBlurEl) {
            bgBlurEl.style.backgroundImage = `url("${dataUrl}")`;
        }

        imgPreviewFotoEl.onload = () => {
            // Ejecutamos el Pre-Filtro de IA 100% gratuito en el navegador
            puntajeIaCalculadoCliente = calcularPuntajeIaEnCanvas(imgPreviewFotoEl);

            barraEstadoIaEl.classList.remove("hidden");
            if (puntajeIaCalculadoCliente >= 70) {
                barraEstadoIaEl.classList.remove("ia-warning");
                iaPuntajeTextoEl.textContent = `Pre-Filtro IA: ${puntajeIaCalculadoCliente}% Segura (Aprobada)`;
                iaDetalleTextoEl.textContent = "Se estampará el sello transparente de Segalú arriba a la izquierda.";
            } else {
                barraEstadoIaEl.classList.add("ia-warning");
                iaPuntajeTextoEl.textContent = `Pre-Filtro IA: ${puntajeIaCalculadoCliente}% (Revisión Especial)`;
                iaDetalleTextoEl.textContent = "El Administrador revisará manualmente esta fotografía.";
            }
            btnEnviarFotoEl.disabled = false;
        };

        imgPreviewFotoEl.src = dataUrl;
        placeholderSubidaEl.classList.add("hidden");
        contenedorPreviewFotoEl.classList.remove("hidden");
    };

    lector.readAsDataURL(archivo);
});

btnEnviarFotoEl.addEventListener("click", async () => {
    if (!archivoFotoSeleccionado || !sesionInvitado?.invitado?.id || !eventoActual?.id) {
        mostrarAlerta("Selecciona una foto antes de enviar.");
        return;
    }

    btnEnviarFotoEl.disabled = true;
    btnEnviarFotoEl.innerHTML = `<span>Procesando sello Segalú y subiendo...</span>`;

    try {
        const datosFormulario = new FormData();
        datosFormulario.append("evento_id", eventoActual.id);
        datosFormulario.append("invitado_id", sesionInvitado.invitado.id);
        datosFormulario.append("puntaje_ia_cliente", String(puntajeIaCalculadoCliente));
        datosFormulario.append("archivo", archivoFotoSeleccionado);

        const respuestaHttp = await fetch("/api/multimedia/subir", {
            method: "POST",
            body: datosFormulario,
        });

        const resultado = await respuestaHttp.json();
        if (!respuestaHttp.ok) {
            throw new Error(resultado.detail || "No se pudo subir la foto.");
        }

        modalSubirFotoEl.classList.add("hidden");
        mostrarAlerta(
            `${resultado.mensaje} (IA: ${resultado.analisis_ia.puntaje_ia_seguridad}% • ${resultado.analisis_ia.peso_kb} KB)`,
            "exito"
        );
    } catch (error) {
        mostrarAlerta(error.message, "error");
        btnEnviarFotoEl.disabled = false;
        btnEnviarFotoEl.innerHTML = HTML_BTN_ENVIAR_FOTO_ORIGINAL;
    }
});

// ------------------------------------------------------------------------------
// 13. [FASE 4.5] EXPERIENCIA DE JUEGO DE TRIVIA KAHOOT EN EL CELULAR
//     - Requerimiento C: Pulso ligero cada 2.5s en el Lobby (sin recargar F5).
//     - Requerimiento D: Pantalla neutral al tocar opción ("⏳ Respuesta enviada...")
//                        y UN ÚNICO MENSAJE DEFINITIVO al terminar el tiempo.
//     - Requerimiento E: Cuadro CUADRADO centrado con medalla pentagonal en el Podio.
// ------------------------------------------------------------------------------
const vistaTriviaInvitadoEl = document.getElementById("vista-trivia-invitado");
const btnVolverLobbyTriviaEl = document.getElementById("btn-volver-lobby-trivia");
const etiquetaEstadoTriviaLobbyEl = document.getElementById("etiqueta-estado-trivia-lobby");
const badgeFaseTriviaMovilEl = document.getElementById("badge-fase-trivia-movil");

// Sub-paneles de Trivia (Espera | Pregunta | Enviada Neutral | Resultado Único | Podio Cuadrado)
const triviaPanelEsperaEl = document.getElementById("trivia-panel-espera");
const triviaPanelPreguntaEl = document.getElementById("trivia-panel-pregunta");
const triviaPanelEnviadaEl = document.getElementById("trivia-panel-enviada");
const triviaPanelResultadoEl = document.getElementById("trivia-panel-resultado");
const triviaPanelPodioEl = document.getElementById("trivia-panel-podio");

// Elementos de espera
const triviaEsperaCharEl = document.getElementById("trivia-espera-char");
const triviaEsperaAccEl = document.getElementById("trivia-espera-acc");
const triviaEsperaTituloEl = document.getElementById("trivia-espera-titulo");
const triviaEsperaSubtituloEl = document.getElementById("trivia-espera-subtitulo");

// Elementos de pregunta activa y temporizador fluido
const triviaNumeroOrdenEl = document.getElementById("trivia-numero-orden");
const cajaRelojTriviaEl = document.getElementById("caja-reloj-trivia");
const triviaRelojSegundosEl = document.getElementById("trivia-reloj-segundos");
const triviaBarraProgresoEl = document.getElementById("trivia-barra-progreso");
const triviaTextoEnunciadoEl = document.getElementById("trivia-texto-enunciado");
const triviaTextoOpAEl = document.getElementById("trivia-texto-op-a");
const triviaTextoOpBEl = document.getElementById("trivia-texto-op-b");
const triviaTextoOpCEl = document.getElementById("trivia-texto-op-c");
const triviaTextoOpDEl = document.getElementById("trivia-texto-op-d");
const botonesOpcionesKahoot = document.querySelectorAll(".kahoot-option-btn");

// Elementos de pantalla neutral ("⏳ Respuesta enviada...")
const triviaEnviadaCharEl = document.getElementById("trivia-enviada-char");
const triviaEnviadaAccEl = document.getElementById("trivia-enviada-acc");
const triviaEnviadaRelojEl = document.getElementById("trivia-enviada-reloj");

// Elementos de pantalla de resultado único y definitivo (Verde ✅ / Roja ❌)
const triviaResultadoIconoEl = document.getElementById("trivia-resultado-icono");
const triviaResultadoTituloEl = document.getElementById("trivia-resultado-titulo");
const triviaResultadoPuntosEl = document.getElementById("trivia-resultado-puntos");
const triviaResultadoPuestoEl = document.getElementById("trivia-resultado-puesto");
const triviaResultadoTotalAcumuladoEl = document.getElementById("trivia-resultado-total-acumulado");
const triviaResultadoStageEl = document.getElementById("trivia-resultado-stage");
const triviaResultadoCharEl = document.getElementById("trivia-resultado-char");
const triviaResultadoAccEl = document.getElementById("trivia-resultado-acc");
const triviaResultadoMensajeEl = document.getElementById("trivia-resultado-mensaje");
const triviaSolucionOficialEl = document.getElementById("trivia-solucion-oficial");

// Elementos del Cuadro CUADRADO de Podio en el celular (Requerimiento E)
const triviaPodioMedallaEl = document.getElementById("trivia-podio-medalla");
const triviaPodioNumeroPuestoEl = document.getElementById("trivia-podio-numero-puesto");
const triviaPodioEtiquetaPuestoEl = document.getElementById("trivia-podio-etiqueta-puesto");
const triviaPodioFelicidadesEl = document.getElementById("trivia-podio-felicidades");
const triviaPodioCharEl = document.getElementById("trivia-podio-char");
const triviaPodioAccEl = document.getElementById("trivia-podio-acc");
const triviaPodioPuntajeFinalEl = document.getElementById("trivia-podio-puntaje-final");

// Elementos de la barra inferior del jugador
const triviaPlayerCharEl = document.getElementById("trivia-player-char");
const triviaPlayerAccEl = document.getElementById("trivia-player-acc");
const triviaPlayerNombreEl = document.getElementById("trivia-player-nombre");
const triviaPlayerComboEl = document.getElementById("trivia-player-combo");
const triviaPlayerPuntajeEl = document.getElementById("trivia-player-puntaje");

// Estado local y semáforos de sincronización
let enVistaTrivia = false;
let peticionEstadoTriviaEnCurso = false;
let timerPulsoLobby = null;
let timerPollingTrivia = null;
let timerCronometroFluido = null;

let triviaEstabaActivaEnServidor = false;
let preguntaActivaEnPantallaId = null;
let preguntaRespondidaLocalmenteId = null;
let resultadoDefinitivoMostradoPreguntaId = null;
let respuestasValidadasPorPregunta = {};
let instanteInicioPreguntaMs = 0;

function sincronizarBarraJugadorTrivia() {
    if (!sesionInvitado?.invitado) return;

    const { personajeId, accesorioId } = descomponerCodigoAvatar(sesionInvitado.invitado.avatar);
    const personajeObj = buscarPersonajePorId(personajeId);
    const accesorioObj = buscarAccesorioPorId(accesorioId);

    // Pintamos las capas del muñequito compuesto en barra inferior, espera, pantalla enviada, resultado y podio cuadrado
    pintarCapasAvatar(triviaPlayerCharEl, triviaPlayerAccEl, personajeObj, accesorioObj);
    pintarCapasAvatar(triviaEsperaCharEl, triviaEsperaAccEl, personajeObj, accesorioObj);
    if (triviaEnviadaCharEl && triviaEnviadaAccEl) {
        pintarCapasAvatar(triviaEnviadaCharEl, triviaEnviadaAccEl, personajeObj, accesorioObj);
    }
    pintarCapasAvatar(triviaResultadoCharEl, triviaResultadoAccEl, personajeObj, accesorioObj);
    if (triviaPodioCharEl && triviaPodioAccEl) {
        pintarCapasAvatar(triviaPodioCharEl, triviaPodioAccEl, personajeObj, accesorioObj);
    }

    triviaPlayerNombreEl.textContent = sesionInvitado.invitado.nombre;
    triviaPlayerComboEl.textContent =
        accesorioObj.id === "sin_accesorio"
            ? personajeObj.nombre
            : `${personajeObj.nombre} + ${accesorioObj.nombre}`;
    triviaPlayerPuntajeEl.textContent = `${sesionInvitado.invitado.puntaje_total || 0} pts`;
}

function mostrarSubpanelTrivia(nombrePanel) {
    triviaPanelEsperaEl.classList.toggle("hidden", nombrePanel !== "espera");
    triviaPanelPreguntaEl.classList.toggle("hidden", nombrePanel !== "pregunta");
    if (triviaPanelEnviadaEl) {
        triviaPanelEnviadaEl.classList.toggle("hidden", nombrePanel !== "enviada");
    }
    triviaPanelResultadoEl.classList.toggle("hidden", nombrePanel !== "resultado");
    triviaPanelPodioEl.classList.toggle("hidden", nombrePanel !== "podio");
}

function detenerCronometroFluidoPregunta() {
    if (timerCronometroFluido) {
        clearInterval(timerCronometroFluido);
        timerCronometroFluido = null;
    }
}

function iniciarCronometroFluidoPregunta(limiteSegundos, segundosRestantesServidor, preguntaId) {
    detenerCronometroFluidoPregunta();

    const limiteTotalMs = Math.max(5, limiteSegundos) * 1000;
    const restanteInicialMs = Math.max(
        500,
        Math.min(limiteTotalMs, segundosRestantesServidor * 1000)
    );
    const tInicioLocal = performance.now();

    timerCronometroFluido = setInterval(() => {
        const transcurridoMs = performance.now() - tInicioLocal;
        const quedaMs = Math.max(0, restanteInicialMs - transcurridoMs);
        const segRestantes = Math.ceil(quedaMs / 1000);
        const porcentaje = Math.max(0, Math.min(100, (quedaMs / limiteTotalMs) * 100));

        triviaRelojSegundosEl.textContent = `${segRestantes}s`;
        triviaBarraProgresoEl.style.width = `${porcentaje}%`;
        if (triviaEnviadaRelojEl) {
            triviaEnviadaRelojEl.textContent = `${segRestantes}s`;
        }

        if (segRestantes <= 5) {
            cajaRelojTriviaEl.classList.add("timer-urgent");
            triviaBarraProgresoEl.classList.add("bar-urgent");
        } else {
            cajaRelojTriviaEl.classList.remove("timer-urgent");
            triviaBarraProgresoEl.classList.remove("bar-urgent");
        }

        if (quedaMs <= 0) {
            detenerCronometroFluidoPregunta();
            // Consultamos al servidor de inmediato para mostrar el resultado único y definitivo
            consultarEstadoTriviaEnVivo();
        }
    }, 100);
}

/**
 * [FASE 4.5 - REQUERIMIENTO D]
 * Muestra UN ÚNICO MENSAJE DEFINITIVO validado por el servidor SOLO cuando el
 * tiempo de la pregunta terminó (ronda_cerrada === true) o el Admin reveló la respuesta.
 */
function pintarPantallaResultadoDefinitivoKahoot(
    datosResultado,
    preguntaActual,
    puntajeTotalInvitado,
    posicionRanking
) {
    mostrarSubpanelTrivia("resultado");

    const acerto = Boolean(datosResultado.es_correcta);
    const puntosGanados = Number(datosResultado.puntos_obtenidos || 0);
    const opcionElegida = datosResultado.opcion_elegida || "T";
    const totalAcumulado = Number(
        puntajeTotalInvitado ?? sesionInvitado?.invitado?.puntaje_total ?? 0
    );
    const puestoTexto = posicionRanking ? `#${posicionRanking}` : "#1";

    if (triviaResultadoPuestoEl) {
        triviaResultadoPuestoEl.textContent = `Puesto actual: ${puestoTexto}`;
    }
    if (triviaResultadoTotalAcumuladoEl) {
        triviaResultadoTotalAcumuladoEl.textContent = `Puntaje total: ${totalAcumulado} pts`;
    }

    if (acerto) {
        triviaPanelResultadoEl.className = "kahoot-result-card result-correct";
        triviaResultadoIconoEl.textContent = "✅";
        triviaResultadoTituloEl.textContent = "¡RESPUESTA CORRECTA!";
        triviaResultadoPuntosEl.textContent = `+${puntosGanados} puntos en esta pregunta`;
        triviaResultadoStageEl.classList.add("avatar-celebrating");
        triviaResultadoMensajeEl.textContent = `¡Excelente reflejo! Vas en el puesto ${puestoTexto} del ranking en vivo.`;
    } else {
        triviaPanelResultadoEl.className = "kahoot-result-card result-wrong";
        triviaResultadoIconoEl.textContent = "❌";
        triviaResultadoTituloEl.textContent =
            opcionElegida === "T" ? "¡TIEMPO AGOTADO!" : "¡RESPUESTA INCORRECTA!";
        triviaResultadoPuntosEl.textContent = "+0 puntos en esta pregunta";
        triviaResultadoStageEl.classList.remove("avatar-celebrating");
        triviaResultadoMensajeEl.textContent = `Vas en el puesto ${puestoTexto} con ${totalAcumulado} pts. ¡En la siguiente pregunta puedes remontar!`;
    }

    const letraCorrecta =
        datosResultado.respuesta_correcta || preguntaActual?.respuesta_correcta || null;
    if (letraCorrecta && preguntaActual) {
        const mapaTextoOpciones = {
            A: preguntaActual.opcion_a,
            B: preguntaActual.opcion_b,
            C: preguntaActual.opcion_c,
            D: preguntaActual.opcion_d,
        };
        const textoSolucion = mapaTextoOpciones[letraCorrecta] || "";
        triviaSolucionOficialEl.textContent = `Solución oficial: Alternativa ${letraCorrecta} (${textoSolucion})`;
        triviaSolucionOficialEl.classList.remove("hidden");
    } else {
        triviaSolucionOficialEl.classList.add("hidden");
    }
}

/**
 * [FASE 4.5 - REQUERIMIENTO E]
 * Pinta un contenedor CUADRADO centrado y elegante en el celular del invitado
 * con "¡Felicidades, [Nombre]!", medalla pentagonal con su puesto exacto (#1, #2, #4...),
 * su muñequito compuesto y su puntaje final (sin lista plana).
 */
function pintarPodioCuadradoEnCelular(listaPodio, posicionServidor, puntajeServidor) {
    mostrarSubpanelTrivia("podio");
    sincronizarBarraJugadorTrivia();

    const miId = sesionInvitado?.invitado?.id;
    const miNombre = sesionInvitado?.invitado?.nombre || "Invitado";
    let miPuesto = posicionServidor || null;
    let miPuntaje =
        typeof puntajeServidor === "number"
            ? puntajeServidor
            : sesionInvitado?.invitado?.puntaje_total || 0;

    if (Array.isArray(listaPodio) && listaPodio.length > 0 && miId) {
        const idxEncontrado = listaPodio.findIndex((j) => j.id === miId);
        if (idxEncontrado !== -1) {
            miPuesto = idxEncontrado + 1;
            miPuntaje = listaPodio[idxEncontrado].puntaje_total || 0;
        }
    }
    if (!miPuesto) miPuesto = 1;

    // Configurar clase y texto de la medalla pentagonal según el puesto (#1, #2, #3 o #4+)
    let claseMedalla = "medal-purple";
    let textoEtiqueta = `PUESTO #${miPuesto} EN EL RANKING`;
    if (miPuesto === 1) {
        claseMedalla = "medal-gold";
        textoEtiqueta = "¡1ER PUESTO EN EL PODIO!";
    } else if (miPuesto === 2) {
        claseMedalla = "medal-silver";
        textoEtiqueta = "¡2DO PUESTO EN EL PODIO!";
    } else if (miPuesto === 3) {
        claseMedalla = "medal-bronze";
        textoEtiqueta = "¡3ER PUESTO EN EL PODIO!";
    }

    if (triviaPodioMedallaEl) {
        triviaPodioMedallaEl.className = `kahoot-mobile-pentagon-medal ${claseMedalla}`;
    }
    if (triviaPodioNumeroPuestoEl) {
        triviaPodioNumeroPuestoEl.textContent = miPuesto <= 3 ? String(miPuesto) : `#${miPuesto}`;
    }
    if (triviaPodioEtiquetaPuestoEl) {
        triviaPodioEtiquetaPuestoEl.textContent = textoEtiqueta;
    }
    if (triviaPodioFelicidadesEl) {
        triviaPodioFelicidadesEl.textContent = `¡Felicidades, ${miNombre}!`;
    }
    if (triviaPodioPuntajeFinalEl) {
        triviaPodioPuntajeFinalEl.textContent = `${miPuntaje} puntos`;
    }
}

/**
 * [FASE 4.5 - REQUERIMIENTO D]
 * Al tocar una opción (A, B, C o D):
 * 1. Bloquea los botones al instante.
 * 2. Muestra ÚNICAMENTE la pantalla neutral "⏳ Respuesta enviada. Esperando a que finalice el tiempo de la ronda..."
 *    sin mostrar ningún mensaje prematuro ni falso error.
 * 3. Envía el voto al servidor y aguarda a que termine el tiempo de la pregunta.
 */
async function enviarRespuestaTrivia(opcionElegida) {
    if (!eventoActual?.id || !sesionInvitado?.invitado?.id || !preguntaActivaEnPantallaId) {
        return;
    }

    const preguntaId = preguntaActivaEnPantallaId;
    if (preguntaRespondidaLocalmenteId === preguntaId) {
        return;
    }

    preguntaRespondidaLocalmenteId = preguntaId;

    botonesOpcionesKahoot.forEach((btn) => {
        btn.disabled = true;
    });

    // Mostramos inmediatamente la pantalla neutral de espera
    sincronizarBarraJugadorTrivia();
    mostrarSubpanelTrivia("enviada");

    const tiempoReaccionMs = Math.max(
        120,
        Math.round(performance.now() - instanteInicioPreguntaMs)
    );

    try {
        const res = await fetch("/api/trivia/responder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                evento_id: eventoActual.id,
                pregunta_id: preguntaId,
                invitado_id: sesionInvitado.invitado.id,
                opcion_elegida: opcionElegida,
                tiempo_respuesta_ms: tiempoReaccionMs,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "No se pudo registrar tu respuesta.");
        }

        // Guardamos la respuesta validada por el servidor en memoria para mostrarla
        // cuando el reloj de la ronda llegue a 0 o el Admin revele la respuesta.
        respuestasValidadasPorPregunta[preguntaId] = data;

        // Consultamos el estado por si la ronda ya hubiera cerrado justo en ese instante
        await consultarEstadoTriviaEnVivo();
    } catch (err) {
        preguntaRespondidaLocalmenteId = null;
        botonesOpcionesKahoot.forEach((btn) => {
            btn.disabled = false;
        });
        mostrarSubpanelTrivia("pregunta");
        mostrarAlerta(err.message, "error");
    }
}

botonesOpcionesKahoot.forEach((btn) => {
    btn.addEventListener("click", () => {
        const opcion = btn.dataset.opcion;
        if (opcion) {
            enviarRespuestaTrivia(opcion);
        }
    });
});

async function consultarEstadoTriviaEnVivo() {
    if (!eventoActual?.id || peticionEstadoTriviaEnCurso) return;
    peticionEstadoTriviaEnCurso = true;

    const invitadoId = sesionInvitado?.invitado?.id || "";
    const enSalaParam = enVistaTrivia ? "true" : "false";
    const url = `/api/eventos/${encodeURIComponent(eventoActual.id)}/trivia/estado?invitado_id=${encodeURIComponent(invitadoId)}&en_sala_trivia=${enSalaParam}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        const activaAhora = Boolean(data.trivia_activa);

        // 1. [FASE 4.5 - REQUERIMIENTO C] Sincronización automática del botón del Lobby cada 2.5s
        if (etiquetaEstadoTriviaLobbyEl) {
            if (activaAhora) {
                etiquetaEstadoTriviaLobbyEl.textContent =
                    "🔥 ¡Trivia en Vivo Ahora! Toca para entrar";
                etiquetaEstadoTriviaLobbyEl.classList.add("live-now");
            } else {
                etiquetaEstadoTriviaLobbyEl.textContent = "⏳ En espera del Host";
                etiquetaEstadoTriviaLobbyEl.classList.remove("live-now");
            }
        }

        // Si el invitado estaba dentro de la trivia y el Admin la finalizó/cerró,
        // lo regresamos suavemente al Lobby sin errores ni necesidad de recargar (F5).
        if (enVistaTrivia && triviaEstabaActivaEnServidor && !activaAhora) {
            triviaEstabaActivaEnServidor = false;
            enVistaTrivia = false;
            detenerCronometroFluidoPregunta();
            detenerPollingTriviaMovil();
            vistaTriviaInvitadoEl.classList.add("hidden");
            vistaLobbyEl.classList.remove("hidden");
            mostrarAlerta("La Ronda de Preguntas ha finalizado. ¡Gracias por jugar!", "exito");
            return;
        }
        triviaEstabaActivaEnServidor = activaAhora;

        // 2. Actualizar puntaje acumulado en la barra inferior solo cuando no estemos ocultando el resultado de la ronda en curso
        const rondaCerrada = Boolean(data.ronda_cerrada);
        if (
            sesionInvitado?.invitado &&
            typeof data.puntaje_invitado === "number" &&
            (rondaCerrada || data.fase !== "pregunta_activa")
        ) {
            sesionInvitado.invitado.puntaje_total = data.puntaje_invitado;
            localStorage.setItem(STORAGE_KEY_SESION, JSON.stringify(sesionInvitado));
            triviaPlayerPuntajeEl.textContent = `${data.puntaje_invitado} pts`;
        }

        if (!enVistaTrivia) return;

        const fase = data.fase || "inactiva";
        const mapaFaseTexto = {
            inactiva: "⏳ EN ESPERA DEL HOST",
            lobby: "🔥 LOBBY DE TRIVIA ABIERTO",
            pregunta_activa: rondaCerrada ? "⏱ TIEMPO FINALIZADO" : "🔥 PREGUNTA EN VIVO",
            respuesta_revelada: "✅ SOLUCIÓN OFICIAL",
            podio: "🏆 PODIO OFICIAL",
        };
        badgeFaseTriviaMovilEl.textContent = mapaFaseTexto[fase] || "RONDA EN VIVO";

        // Caso A: Sala de espera o inactiva
        if (fase === "inactiva" || fase === "lobby") {
            detenerCronometroFluidoPregunta();
            preguntaActivaEnPantallaId = null;
            preguntaRespondidaLocalmenteId = null;
            resultadoDefinitivoMostradoPreguntaId = null;
            mostrarSubpanelTrivia("espera");

            if (fase === "lobby") {
                triviaEsperaTituloEl.textContent = "¡Lobby de Trivia Abierto!";
                triviaEsperaSubtituloEl.textContent =
                    "El Administrador ya abrió la sala en vivo. ¡Mantén los ojos en tu celular, la primera pregunta está por comenzar!";
            } else {
                triviaEsperaTituloEl.textContent = "⏳ En espera del Host";
                triviaEsperaSubtituloEl.textContent =
                    "Esperando a que el Administrador inicie la Ronda de Preguntas desde su consola...";
            }
            return;
        }

        // Caso B: Podio Final (Cuadro CUADRADO centrado estilo Kahoot)
        if (fase === "podio") {
            detenerCronometroFluidoPregunta();
            pintarPodioCuadradoEnCelular(
                data.podio || [],
                data.posicion_ranking,
                data.puntaje_invitado
            );
            return;
        }

        const preg = data.pregunta_activa;
        if (!preg) {
            mostrarSubpanelTrivia("espera");
            return;
        }

        // Caso C: Si la ronda YA CERRÓ (segundos_restantes <= 0 o Admin reveló la respuesta):
        // Mostramos UN ÚNICO MENSAJE DEFINITIVO validado por el servidor (nunca antes).
        if (rondaCerrada) {
            detenerCronometroFluidoPregunta();
            if (resultadoDefinitivoMostradoPreguntaId !== preg.id) {
                resultadoDefinitivoMostradoPreguntaId = preg.id;

                const respuestaServidor =
                    data.mi_respuesta && typeof data.mi_respuesta.es_correcta === "boolean"
                        ? data.mi_respuesta
                        : respuestasValidadasPorPregunta[preg.id] || {
                              es_correcta: false,
                              puntos_obtenidos: 0,
                              opcion_elegida: "T",
                              respuesta_correcta: preg.respuesta_correcta,
                          };

                pintarPantallaResultadoDefinitivoKahoot(
                    respuestaServidor,
                    preg,
                    data.puntaje_invitado,
                    data.posicion_ranking
                );
            }
            return;
        }

        // Caso D: La ronda sigue corriendo (ronda_cerrada === false):
        // Si el invitado ya tocó una opción, mostramos ÚNICAMENTE la pantalla neutral:
        // "⏳ Respuesta enviada. Esperando a que finalice el tiempo de la ronda..."
        const yaRespondioEstaPregunta =
            preguntaRespondidaLocalmenteId === preg.id || Boolean(data.mi_respuesta?.respondida);

        if (yaRespondioEstaPregunta) {
            preguntaRespondidaLocalmenteId = preg.id;
            mostrarSubpanelTrivia("enviada");
            if (triviaEnviadaRelojEl && typeof preg.segundos_restantes === "number") {
                triviaEnviadaRelojEl.textContent = `${preg.segundos_restantes}s`;
            }
            return;
        }

        // Caso E: Nueva pregunta en vivo y el invitado aún no ha respondido
        if (preguntaActivaEnPantallaId !== preg.id) {
            preguntaActivaEnPantallaId = preg.id;
            preguntaRespondidaLocalmenteId = null;
            resultadoDefinitivoMostradoPreguntaId = null;
            instanteInicioPreguntaMs = performance.now();

            triviaNumeroOrdenEl.textContent = `PREGUNTA #${preg.orden || 1}`;
            triviaTextoEnunciadoEl.textContent = preg.enunciado;
            triviaTextoOpAEl.textContent = preg.opcion_a;
            triviaTextoOpBEl.textContent = preg.opcion_b;
            triviaTextoOpCEl.textContent = preg.opcion_c;
            triviaTextoOpDEl.textContent = preg.opcion_d;

            botonesOpcionesKahoot.forEach((btn) => {
                btn.disabled = false;
            });

            mostrarSubpanelTrivia("pregunta");
            iniciarCronometroFluidoPregunta(
                preg.tiempo_limite_segundos || 20,
                preg.segundos_restantes ?? (preg.tiempo_limite_segundos || 20),
                preg.id
            );
        }
    } catch (e) {
        // Ignorar micro-cortes de red en el polling
    } finally {
        peticionEstadoTriviaEnCurso = false;
    }
}

// [FASE 4.5 - REQUERIMIENTO C] Pulso ligero en segundo plano cada 2.5 segundos en el Lobby
function iniciarPulsoSincronizacionLobby() {
    detenerPulsoSincronizacionLobby();
    consultarEstadoTriviaEnVivo();
    timerPulsoLobby = setInterval(() => {
        if (!enVistaTrivia) {
            consultarEstadoTriviaEnVivo();
        }
    }, 2500);
}

function detenerPulsoSincronizacionLobby() {
    if (timerPulsoLobby) {
        clearInterval(timerPulsoLobby);
        timerPulsoLobby = null;
    }
}

function iniciarPollingTriviaMovil() {
    detenerPollingTriviaMovil();
    consultarEstadoTriviaEnVivo();
    timerPollingTrivia = setInterval(() => {
        consultarEstadoTriviaEnVivo();
    }, 1000);
}

function detenerPollingTriviaMovil() {
    if (timerPollingTrivia) {
        clearInterval(timerPollingTrivia);
        timerPollingTrivia = null;
    }
}

btnIrTriviaEl.addEventListener("click", () => {
    enVistaTrivia = true;
    sincronizarBarraJugadorTrivia();
    vistaLobbyEl.classList.add("hidden");
    vistaTriviaInvitadoEl.classList.remove("hidden");
    iniciarPollingTriviaMovil();
});

btnVolverLobbyTriviaEl.addEventListener("click", () => {
    enVistaTrivia = false;
    detenerCronometroFluidoPregunta();
    detenerPollingTriviaMovil();
    vistaTriviaInvitadoEl.classList.add("hidden");
    vistaLobbyEl.classList.remove("hidden");
    consultarEstadoTriviaEnVivo();
});

// Eliminación inmediata de la sesión del invitado si cierra su pestaña o sale del navegador
let desconexionEnviada = false;
function notificarCierreSesionInvitado() {
    if (desconexionEnviada) return;
    const invitadoId = sesionInvitado?.invitado?.id;
    if (!invitadoId) return;
    desconexionEnviada = true;

    const urlDesconectar = `/api/invitados/${encodeURIComponent(invitadoId)}/desconectar`;
    const urlDelete = `/api/invitados/${encodeURIComponent(invitadoId)}`;

    try {
        if (navigator.sendBeacon) {
            navigator.sendBeacon(urlDesconectar, "");
        }
    } catch (e) {
        // Ignorar errores de sendBeacon
    }

    try {
        fetch(urlDelete, { method: "DELETE", keepalive: true }).catch(() => {});
    } catch (e) {
        // Ignorar errores en descarga de pestaña
    }

    localStorage.removeItem(STORAGE_KEY_SESION);
}

window.addEventListener("pagehide", () => {
    notificarCierreSesionInvitado();
});

window.addEventListener("beforeunload", () => {
    notificarCierreSesionInvitado();
});

// ------------------------------------------------------------------------------
// 14. INICIO AUTOMÁTICO AL CARGAR LA PÁGINA
// ------------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
    renderizarSeccionUbicacionSedes();
    sincronizarFotosSedesDesdeServidor();

    const parametrosUrl = new URLSearchParams(window.location.search);
    const codigoDesdeQR = parametrosUrl.get("codigo");

    if (codigoDesdeQR) {
        inputCodigoEventoEl.value = codigoDesdeQR.toUpperCase();
    }

    const sesionGuardadaTexto = localStorage.getItem(STORAGE_KEY_SESION);
    if (sesionGuardadaTexto) {
        try {
            const sesionGuardada = JSON.parse(sesionGuardadaTexto);
            if (
                !codigoDesdeQR ||
                sesionGuardada.evento?.codigo_acceso === codigoDesdeQR.toUpperCase()
            ) {
                mostrarPantallaLobby(sesionGuardada);
                return;
            }
        } catch (e) {
            localStorage.removeItem(STORAGE_KEY_SESION);
        }
    }

    await cargarEventoPorCodigo(inputCodigoEventoEl.value);
});


