// ==============================================================================
// PROYECTO: MVP WEB SEGALU
// ARCHIVO: frontend/invitado/app.js
// FASE 2.5: Creador de Muñequitos Estilo Kahoot con Paquetes Temáticos,
//           Bloqueo/Eliminación de Nombre en Supabase y Promoción con Rastreo
// ==============================================================================

const STORAGE_KEY_SESION = "segalu_sesion_invitado";
const STORAGE_KEY_EN_TRIVIA = "segalu_invitado_en_trivia";
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
        googleMapsUrl: "https://maps.app.goo.gl/eNhM4PXQSV856TMK8",
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
        carpeta: "/static/accessories/boda",
        accesorios: [
            {
                id: "corona_imperial",
                nombre: "Corona Imperial",
                subtitulo: "Oro Real",
                icono: "👑",
                archivo: "corona_imperial.png",
            },
            {
                id: "corbatin_gala",
                nombre: "Corbatín de Gala",
                subtitulo: "Smoking VIP",
                icono: "👔",
                archivo: "corbatin_gala.png",
            },
            {
                id: "sombrero_gala",
                nombre: "Sombrero de Gala",
                subtitulo: "Clásico",
                icono: "🎩",
                archivo: "sombrero_gala.png",
            },
        ],
    },
    paquete_graduacion: {
        nombrePaquete: "Graduación",
        carpeta: "/static/accessories/graduacion",
        accesorios: [
            {
                id: "birrete",
                nombre: "Birrete de Gala",
                subtitulo: "Académico",
                icono: "🎓",
                archivo: "birrete.png",
            },
        ],
    },
    paquete_15_anos: {
        nombrePaquete: "15 Años",
        carpeta: "/static/accessories/quinceanero",
        accesorios: [
            {
                id: "tiara_xv",
                nombre: "Tiara XV Años",
                subtitulo: "Princesa",
                icono: "👑",
                archivo: "tiara_xv.png",
            },
            {
                id: "corona_flores",
                nombre: "Corona de Flores",
                subtitulo: "Primavera",
                icono: "🌸",
                archivo: "corona_flores.png",
            },
            {
                id: "antifaz_15",
                nombre: "Antifaz Veneciano",
                subtitulo: "Gala XV",
                icono: "🎭",
                archivo: "antifaz_15.png",
            },
        ],
    },
    paquete_general: {
        nombrePaquete: "Fiesta VIP",
        carpeta: "/static/accessories/general",
        accesorios: [
            {
                id: "lentes_vip",
                nombre: "Lentes VIP",
                subtitulo: "Glamour",
                icono: "🕶️",
                archivo: "lentes_vip.png",
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
};

// ------------------------------------------------------------------------------
// 3. ESTADO DE LA APLICACIÓN EN EL NAVEGADOR
// ------------------------------------------------------------------------------
let eventoActual = null;
let sesionInvitado = null;

/**
 * Persistencia de sesión del invitado en localStorage.
 * Guarda: nombre, apellido, avatar, token firmado y el evento, para que al recargar
 * la página (o si se cae la red del local) se reconecte sin volver al login.
 */
function guardarSesionInvitadoLocal(sesion) {
    if (!sesion?.invitado?.id) return;
    const nombreCompleto = String(sesion.invitado.nombre || "").trim();
    const [nombre, ...restoApellido] = nombreCompleto.split(/\s+/);
    const datos = {
        ...sesion,
        nombre: nombre || "",
        apellido: restoApellido.join(" "),
        avatar: sesion.invitado.avatar || "",
        token_sesion: sesion.token_sesion || "",
        guardado_en: Date.now(),
    };
    try {
        localStorage.setItem(STORAGE_KEY_SESION, JSON.stringify(datos));
    } catch (_) {
        // Modo incógnito sin almacenamiento: la sesión vive solo en memoria
    }
}

function leerSesionInvitadoLocal() {
    try {
        const texto = localStorage.getItem(STORAGE_KEY_SESION);
        if (!texto) return null;
        const sesion = JSON.parse(texto);
        return sesion?.invitado?.id && sesion?.evento?.id ? sesion : null;
    } catch (_) {
        localStorage.removeItem(STORAGE_KEY_SESION);
        return null;
    }
}

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
const registroCharLayerEl = document.getElementById("registro-char-layer");
const registroAccLayerEl = document.getElementById("registro-acc-layer");

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

// Elementos del Módulo CRM (Pase VIP & Cupón Promocional)
const btnAbrirModalLeadEl = document.getElementById("btn-abrir-modal-lead");
const btnFlotanteVipLeadEl = document.getElementById("btn-flotante-vip-lead");
const modalCrmLeadEl = document.getElementById("modal-crm-lead");
const btnCerrarModalLeadEl = document.getElementById("btn-cerrar-modal-lead");
const vistaLeadFormularioEl = document.getElementById("vista-lead-formulario");
const vistaLeadExitoEl = document.getElementById("vista-lead-exito");
const formCrmLeadEl = document.getElementById("form-crm-lead");
const leadNombreEl = document.getElementById("lead-nombre");
const leadTelefonoEl = document.getElementById("lead-telefono");
const leadNacimientoEl = document.getElementById("lead-nacimiento");
const leadGeneroEl = document.getElementById("lead-genero");
const leadCorreoEl = document.getElementById("lead-correo");
const btnEnviarLeadEl = document.getElementById("btn-enviar-lead");
const btnCancelarModalLeadEl = document.getElementById("btn-cancelar-modal-lead");
const voucherNombreInvitadoEl = document.getElementById("voucher-nombre-invitado");
const voucherCodigoPromocionalEl = document.getElementById("voucher-codigo-promocional");
const voucherQrImgEl = document.getElementById("voucher-qr-img");
const btnCompartirCuponWaEl = document.getElementById("btn-compartir-cupon-wa");
const btnCerrarCuponEl = document.getElementById("btn-cerrar-cupon");
const STORAGE_LEAD_PREFIX = "segalu_lead_promo_";

// ------------------------------------------------------------------------------
// 4. FUNCIONES AUXILIARES PARA BUSCAR PERSONAJES Y ACCESORIOS CON FILTRO TEMÁTICO
// ------------------------------------------------------------------------------
let accesoriosPersonalizadosServidor = [];

async function cargarAccesoriosPersonalizados() {
    try {
        const res = await fetch("/api/accesorios");
        const data = await res.json();
        if (data.ok) {
            if (Array.isArray(data.personalizados)) {
                accesoriosPersonalizadosServidor = data.personalizados;
            }
            if (data.paquetes && typeof data.paquetes === "object") {
                Object.entries(data.paquetes).forEach(([pkgId, pkgData]) => {
                    const accesoriosProcesados = (pkgData.accesorios || []).map((acc) => ({
                        id: acc.id,
                        nombre: acc.nombre,
                        subtitulo: acc.subtitulo || "Personalizado",
                        icono: acc.icono || "✨",
                        archivo: acc.archivo,
                        rutaImagen: acc.url || `/static/accessories/${pkgId}/${acc.archivo}`,
                    }));

                    if (PAQUETES_ACCESORIOS_TEMATICOS[pkgId]) {
                        PAQUETES_ACCESORIOS_TEMATICOS[pkgId].nombrePaquete = pkgData.nombre || PAQUETES_ACCESORIOS_TEMATICOS[pkgId].nombrePaquete;
                        const idsExistentes = new Set(PAQUETES_ACCESORIOS_TEMATICOS[pkgId].accesorios.map((a) => a.id));
                        accesoriosProcesados.forEach((a) => {
                            if (!idsExistentes.has(a.id)) {
                                PAQUETES_ACCESORIOS_TEMATICOS[pkgId].accesorios.push(a);
                                idsExistentes.add(a.id);
                            }
                        });
                    } else {
                        PAQUETES_ACCESORIOS_TEMATICOS[pkgId] = {
                            nombrePaquete: pkgData.nombre || pkgId,
                            carpeta: `/static/accessories/${pkgId}`,
                            accesorios: accesoriosProcesados,
                        };
                    }
                    MAPA_TEMATICA_A_PAQUETE[pkgId] = pkgId;
                    const sinPrefijo = pkgId.replace(/^paquete_/, "");
                    MAPA_TEMATICA_A_PAQUETE[sinPrefijo] = pkgId;
                });
            }
            if (typeof renderizarCuadriculaAccesorios === "function") {
                renderizarCuadriculaAccesorios();
            }
        }
    } catch (_) {}
}

const MAPA_TEMATICA_A_PAQUETE = {
    "15_anos": "paquete_15_anos",
    "15anos": "paquete_15_anos",
    "quinceanero": "paquete_15_anos",
    "graduacion": "paquete_graduacion",
    "gala_boda": "paquete_boda",
    "gala_bodas": "paquete_boda",
    "boda": "paquete_boda",
    "fiesta_vip": "paquete_general",
    "vip": "paquete_general",
    "general": "paquete_general",
    "princesas_disney": "paquete_princesas_disney",
};

function normalizarClavePaquete(tematica) {
    if (!tematica) return "todos";
    const t = tematica.toLowerCase().trim();
    if (t === "todos") return "todos";
    return (
        MAPA_TEMATICA_A_PAQUETE[t] ||
        (PAQUETES_ACCESORIOS_TEMATICOS[t]
            ? t
            : PAQUETES_ACCESORIOS_TEMATICOS[`paquete_${t}`]
            ? `paquete_${t}`
            : t)
    );
}

function obtenerTodosLosAccesorios() {
    const mapa = new Map();

    mapa.set("sin_accesorio", {
        id: "sin_accesorio",
        nombre: "Sin Accesorio",
        subtitulo: "Natural",
        icono: "—",
        rutaImagen: null,
        paqueteKey: "todos",
    });

    Object.entries(PAQUETES_ACCESORIOS_TEMATICOS).forEach(([paqueteKey, paquete]) => {
        (paquete.accesorios || []).forEach((acc) => {
            const ruta = acc.rutaImagen || `${paquete.carpeta}/${acc.archivo}`;
            mapa.set(acc.id, {
                ...acc,
                paqueteKey,
                nombrePaquete: paquete.nombrePaquete,
                rutaImagen: ruta,
            });
        });
    });

    accesoriosPersonalizadosServidor.forEach((acc) => {
        if (!acc || !acc.id) return;
        const pKey = normalizarClavePaquete(acc.tematica || acc.paquete_id || "general");
        const rutaImg = acc.url || acc.rutaImagen || `/static/accessories/${acc.tematica || "general"}/${acc.archivo || acc.id + ".png"}`;
        const existente = mapa.get(acc.id);
        if (existente) {
            mapa.set(acc.id, {
                ...existente,
                rutaImagen: rutaImg || existente.rutaImagen,
                paqueteKey: pKey || existente.paqueteKey,
            });
        } else {
            mapa.set(acc.id, {
                id: acc.id,
                nombre: acc.nombre,
                subtitulo: acc.subtitulo || "Personalizado",
                icono: acc.icono || "✨",
                rutaImagen: rutaImg,
                paqueteKey: pKey,
                nombrePaquete: PAQUETES_ACCESORIOS_TEMATICOS[pKey]?.nombrePaquete || "Personalizados",
            });
        }
    });

    return Array.from(mapa.values());
}

function obtenerAccesoriosPermitidosEvento() {
    const todos = obtenerTodosLosAccesorios();
    const tematica = (eventoActual?.tematica_accesorios || "todos").toLowerCase().trim();
    if (tematica === "todos") return todos;

    const paqueteRequerido = normalizarClavePaquete(tematica);
    const permitidos = todos.filter((acc) => acc.id === "sin_accesorio" || acc.paqueteKey === paqueteRequerido);

    if (permitidos.length <= 1) {
        return permitidos.length === 1 ? permitidos : [todos.find((a) => a.id === "sin_accesorio") || { id: "sin_accesorio", nombre: "Sin Accesorio" }];
    }
    return permitidos;
}

function seleccionarAccesorioAleatorioSegunTematica() {
    const permitidos = obtenerAccesoriosPermitidosEvento().filter((a) => a.id !== "sin_accesorio");
    if (permitidos.length === 0) return "sin_accesorio";
    const idx = Math.floor(Math.random() * permitidos.length);
    return permitidos[idx].id;
}

function actualizarPrevisualizacionRegistro() {
    if (registroCharLayerEl && registroAccLayerEl) {
        const personajeObj = buscarPersonajePorId(personajeSeleccionadoId);
        const accesorioObj = buscarAccesorioPorId(accesorioSeleccionadoId);
        pintarCapasAvatar(registroCharLayerEl, registroAccLayerEl, personajeObj, accesorioObj);
    }
}

function buscarPersonajePorId(id) {
    return CATALOGO_PERSONAJES.find((p) => p.id === id) || CATALOGO_PERSONAJES[0];
}

function buscarAccesorioPorId(id) {
    const todos = obtenerTodosLosAccesorios();
    const encontrado = todos.find((a) => a.id === id);
    if (encontrado) return encontrado;
    if (id && (id.startsWith("acc_") || id.includes("_"))) {
        return {
            id: id,
            nombre: "Accesorio Exclusivo",
            subtitulo: "Personalizado",
            icono: "✨",
            rutaImagen: `/static/accessories/general/${id}.png`,
            paqueteKey: "paquete_general",
        };
    }
    const permitidos = obtenerAccesoriosPermitidosEvento();
    const primeroPermitido = permitidos.find((a) => a.id !== "sin_accesorio");
    return primeroPermitido || todos.find((a) => a.id === "sin_accesorio") || todos[0];
}

function descomponerCodigoAvatar(codigoAvatar) {
    if (!codigoAvatar || typeof codigoAvatar !== "string") {
        return { personajeId: "pug_real", accesorioId: seleccionarAccesorioAleatorioSegunTematica() };
    }
    const partes = codigoAvatar.split("|");
    const personajeId = buscarPersonajePorId(partes[0]).id;
    const accesorioId = partes[1] ? buscarAccesorioPorId(partes[1]).id : seleccionarAccesorioAleatorioSegunTematica();
    return { personajeId, accesorioId };
}

/**
 * Renderiza la superposición de capas (Personaje + Accesorio en la cabeza).
 * Lógica estrictamente excluyente: 1 solo accesorio activo por avatar.
 */
function pintarCapasAvatar(contenedorChar, contenedorAcc, personajeObj, accesorioObj) {
    if (!contenedorChar || !contenedorAcc) return;

    // Capa 1: Personaje
    contenedorChar.innerHTML = "";
    if (personajeObj && personajeObj.imagen) {
        const imgChar = document.createElement("img");
        imgChar.src = personajeObj.imagen;
        imgChar.alt = personajeObj.nombre || "Personaje";
        imgChar.className = "avatar-custom-img";
        imgChar.onerror = () => {
            contenedorChar.innerHTML = "";
            contenedorChar.textContent = personajeObj.icono || "🐶";
        };
        contenedorChar.appendChild(imgChar);
    } else {
        contenedorChar.textContent = (personajeObj && personajeObj.icono) || "🐶";
    }

    // Capa 2: Accesorio superpuesto en la cabeza (EXCLUSIVO: Reemplaza cualquier accesorio anterior)
    contenedorAcc.innerHTML = "";
    if (!accesorioObj || accesorioObj.id === "sin_accesorio") {
        contenedorAcc.textContent = "";
        return;
    }

    if (accesorioObj.rutaImagen) {
        const imgAcc = document.createElement("img");
        imgAcc.src = accesorioObj.rutaImagen;
        imgAcc.alt = accesorioObj.nombre || "Accesorio";
        imgAcc.className = "accessory-custom-img";
        if (accesorioObj.id.includes("lentes") || accesorioObj.id.includes("antifaz") || accesorioObj.id.includes("gafas")) {
            imgAcc.classList.add("accessory-glasses");
        }
        imgAcc.onerror = () => {
            contenedorAcc.innerHTML = "";
            contenedorAcc.textContent = accesorioObj.icono || "✨";
        };
        imgAcc.onload = () => {
            // Aseguramos que solo esta imagen exista dentro del contenedor de accesorio (cero duplicados)
            while (contenedorAcc.childNodes.length > 1) {
                if (contenedorAcc.firstChild !== imgAcc) {
                    contenedorAcc.removeChild(contenedorAcc.firstChild);
                } else {
                    contenedorAcc.removeChild(contenedorAcc.lastChild);
                }
            }
        };
        contenedorAcc.appendChild(imgAcc);
    } else {
        contenedorAcc.textContent = accesorioObj.icono || "✨";
    }
}

let timerAlertaInvitado = null;

function ocultarAlertaInvitado() {
    if (timerAlertaInvitado) {
        clearTimeout(timerAlertaInvitado);
        timerAlertaInvitado = null;
    }
    if (alertaMensajeEl) {
        alertaMensajeEl.classList.add("alert-hiding");
        setTimeout(() => {
            alertaMensajeEl.classList.add("hidden");
            alertaMensajeEl.classList.remove("alert-hiding");
        }, 220);
    }
}

function formatearMensajeError(err) {
    if (!err) return "Ocurrió un error inesperado.";
    if (typeof err === "string") return err;
    if (Array.isArray(err)) {
        return err
            .map((item) => {
                if (typeof item === "string") return item;
                if (item && item.msg) {
                    const campo = item.loc ? item.loc[item.loc.length - 1] : "";
                    return campo && campo !== "body" ? `${campo}: ${item.msg}` : item.msg;
                }
                return JSON.stringify(item);
            })
            .join("; ");
    }
    if (typeof err === "object") {
        if (err.detail) return formatearMensajeError(err.detail);
        if (err.message) return formatearMensajeError(err.message);
        if (err.msg) return err.msg;
        try {
            return JSON.stringify(err);
        } catch (_) {
            return String(err);
        }
    }
    return String(err);
}

function mostrarAlerta(texto, tipo = "error") {
    if (!alertaMensajeEl) return;
    if (timerAlertaInvitado) {
        clearTimeout(timerAlertaInvitado);
        timerAlertaInvitado = null;
    }
    alertaMensajeEl.classList.remove("alert-hiding");

    const textoParseado = formatearMensajeError(texto);
    const textoLimpio = textoParseado.replace(/^(?:✅|❌|⚠️|ℹ️|🗑️|📊|🎉)\s*/u, "");
    const esExito = tipo === "exito";

    const iconoSvg = esExito
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    alertaMensajeEl.innerHTML = `
        <span class="toast-icon">${iconoSvg}</span>
        <div class="toast-message">${textoLimpio}</div>
        <button type="button" class="toast-close-btn" aria-label="Cerrar notificación">&times;</button>
    `;

    alertaMensajeEl.className = `alert-box ${esExito ? "alert-success" : "alert-error"}`;
    alertaMensajeEl.classList.remove("hidden");

    const btnCerrar = alertaMensajeEl.querySelector(".toast-close-btn");
    if (btnCerrar) {
        btnCerrar.onclick = () => ocultarAlertaInvitado();
    }

    timerAlertaInvitado = setTimeout(() => {
        ocultarAlertaInvitado();
    }, 4600);
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

    // Mensaje de gancho comercial dinámico para identificar clientes desde la aplicación
    const mensajeRastreo = `¡Hola Eventos Segalú! 🎉 Estoy participando en vivo en el evento ${nombreEvento} desde la app interactiva y me encantaría cotizar una fecha con mi beneficio especial de invitado.`;
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
        await cargarAccesoriosPersonalizados();
        accesorioSeleccionadoId = seleccionarAccesorioAleatorioSegunTematica();
        actualizarPrevisualizacionRegistro();
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
            token_sesion: resultado.token_sesion || "",
        };

        guardarSesionInvitadoLocal(sesionInvitado);
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

    // Nombre bloqueado en el Lobby y subtítulo fijo oficial Dark Luxury
    lobbyNombreInvitadoEl.textContent = sesion.invitado.nombre;
    lobbyDescripcionAvatarEl.textContent = "INVITADO DE HONOR";

    vistaRegistroEl.classList.add("hidden");
    vistaLobbyEl.classList.remove("hidden");

    // Mostrar el dock flotante inferior fijo
    const dockFlotanteEl = document.getElementById("dock-flotante-invitado");
    if (dockFlotanteEl) dockFlotanteEl.classList.remove("hidden");

    // Actualizar tarjetas de ubicación con el nombre del evento activo
    renderizarSeccionUbicacionSedes();

    // Cargar fotos aprobadas en el Muro en Vivo interactivo
    cargarFotosMuroLive();

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
    const eventoId = eventoActual?.id || "";

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
        // En caso de corte momentáneo de red, proceder a la limpieza local
    } finally {
        // 1. Limpieza profunda de almacenamiento en el navegador (sesión y cupones CRM)
        localStorage.removeItem(STORAGE_KEY_SESION);
        localStorage.removeItem(STORAGE_KEY_EN_TRIVIA);
        if (eventoId) {
            localStorage.removeItem(`${STORAGE_LEAD_PREFIX}${eventoId}`);
        }
        Object.keys(localStorage).forEach((k) => {
            if (k.startsWith(STORAGE_LEAD_PREFIX) || k.startsWith("segalu_invitado") || k.startsWith("segalu_sesion")) {
                localStorage.removeItem(k);
            }
        });
        sessionStorage.clear();

        // 2. Restablecer el formulario modal de Pase VIP / Cupón CRM para el nuevo nombre
        if (leadNombreEl) leadNombreEl.value = "";
        if (leadTelefonoEl) leadTelefonoEl.value = "";
        if (leadNacimientoEl) leadNacimientoEl.value = "";
        if (leadGeneroEl) leadGeneroEl.value = "Femenino";
        if (leadCorreoEl) leadCorreoEl.value = "";
        if (vistaLeadFormularioEl) vistaLeadFormularioEl.classList.remove("hidden");
        if (vistaLeadExitoEl) vistaLeadExitoEl.classList.add("hidden");

        sesionInvitado = null;
        vistaLobbyEl.classList.add("hidden");
        vistaTriviaInvitadoEl.classList.add("hidden");
        vistaRegistroEl.classList.remove("hidden");
        inputNombreEl.value = nombreActual;
        inputNombreEl.focus();
        btnCorregirNombreEl.disabled = false;
        btnCorregirNombreEl.textContent = "Salir / Corregir mi nombre";
        mostrarAlerta("Tu registro anterior y cupón fueron eliminados. Escribe tu nombre corregido.", "exito");
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
    const tematica = (eventoActual?.tematica_accesorios || "todos").toLowerCase().trim();

    let opcionesFiltro = [];
    if (tematica === "todos") {
        opcionesFiltro = [
            { key: "todos", label: "Todos" },
            ...Object.entries(PAQUETES_ACCESORIOS_TEMATICOS).map(([key, datos]) => ({
                key,
                label: datos.nombrePaquete,
            })),
        ];
    } else {
        const paqueteClave = normalizarClavePaquete(tematica);
        const nombrePaquete = PAQUETES_ACCESORIOS_TEMATICOS[paqueteClave]?.nombrePaquete || "Accesorios";
        opcionesFiltro = [
            { key: paqueteClave, label: `✨ ${nombrePaquete}` },
        ];
        paqueteFiltroActual = paqueteClave;
    }

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

    const permitidos = obtenerAccesoriosPermitidosEvento();
    const filtrados = permitidos.filter(
        (acc) =>
            paqueteFiltroActual === "todos" ||
            acc.id === "sin_accesorio" ||
            acc.paqueteKey === paqueteFiltroActual
    );

    filtrados.forEach((accesorio) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `item-option-card ${accesorio.id === accesorioSeleccionadoId ? "selected" : ""}`;

        // Miniatura visual: renderiza la imagen real del accesorio PNG o el emoji como respaldo
        let visualAccesorioHtml = `<span class="item-option-icon">${accesorio.icono}</span>`;
        if (accesorio.rutaImagen && accesorio.id !== "sin_accesorio") {
            visualAccesorioHtml = `
                <div class="accessory-thumb-wrapper">
                    <img
                        src="${accesorio.rutaImagen}"
                        alt="${accesorio.nombre}"
                        class="accessory-thumb-img"
                        onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='inline-block';"
                    />
                    <span class="item-option-icon fallback" style="display: none;">${accesorio.icono}</span>
                </div>
            `;
        }

        btn.innerHTML = `
            <span class="item-check-badge">✓</span>
            ${visualAccesorioHtml}
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
        guardarSesionInvitadoLocal(sesionInvitado);

        mostrarPantallaLobby(sesionInvitado);
        cerrarModalPersonalizador();
        mostrarAlerta(resultado.mensaje, "exito");

        // Notificación en tiempo real al proyector
        if (typeof BroadcastChannel !== "undefined") {
            try {
                const canalSync = new BroadcastChannel("segalu_proyector_sync");
                canalSync.postMessage({
                    tipo: "AVATAR_ACTUALIZADO",
                    invitado_id: invitadoId,
                    avatar: nuevoCodigoAvatar,
                    evento_id: sesionInvitado?.evento?.id || "",
                });
            } catch (_) {}
        }
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
            const esSede1 = sede.id === "sede1";
            // Ubicación exacta por sede: Sede 1 apunta a Eventos Segalu y Sede 2 a Salón Florencia
            const queryMapa = esSede1
                ? encodeURIComponent("Eventos Segalu, Carabayllo")
                : encodeURIComponent("Eventos Segalu - Salón Florencia, Carabayllo");
            const srcIframe = `https://maps.google.com/maps?q=${queryMapa}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

            return `
                <a
                    href="${sede.googleMapsUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="sede-ubicacion-card"
                    title="Abrir ubicación de ${sede.nombre} en Google Maps"
                >
                    <div class="sede-map-embed-wrapper">
                        <iframe
                            class="sede-map-iframe"
                            src="${srcIframe}"
                            loading="lazy"
                            allowfullscreen=""
                            referrerpolicy="no-referrer-when-downgrade"
                            title="Mapa de ubicación ${sede.nombre}"
                            tabindex="-1"
                        ></iframe>
                    </div>
                    <div class="sede-ubicacion-body">
                        <div class="sede-info-text">
                            <strong>${sede.nombre}</strong>
                            <span>📍 ${sede.direccionTexto}</span>
                        </div>
                        <span class="map-open-badge">Abrir ubicación ↗</span>
                    </div>
                </a>
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
                if (CONFIG_SEDES_SEGALU[sedeKey]?.fotos?.[idx]) {
                    if (infoFoto.existe && infoFoto.url) {
                        CONFIG_SEDES_SEGALU[sedeKey].fotos[idx].archivo = infoFoto.url;
                    }
                    if (infoFoto.titulo) {
                        CONFIG_SEDES_SEGALU[sedeKey].fotos[idx].titulo = infoFoto.titulo;
                    }
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
    renderizarSeccionUbicacionSedes();
    if (modalGaleriaEl && !modalGaleriaEl.classList.contains("hidden")) {
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
            renderizarSeccionUbicacionSedes();
            return;
        }
        const data = await res.json();
        aplicarMapaFotosSedes(data.fotos || {}, data.fotos_sedes || {});
    } catch (_) {
        actualizarPortadasSedesLobby();
        renderizarSeccionUbicacionSedes();
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

    const modalSedeTituloEl = document.getElementById("galeria-modal-sede-nombre");
    const badgeEl = document.getElementById("galeria-slide-badge");
    const iconoEl = document.getElementById("galeria-slide-icono");
    const imgSlideEl = document.getElementById("galeria-slide-img");
    const tituloEl = document.getElementById("galeria-slide-titulo");
    const indicadorEl = document.getElementById("galeria-indicador");

    if (modalSedeTituloEl) modalSedeTituloEl.textContent = sede.nombre;
    if (badgeEl) badgeEl.textContent = `Foto ${indiceSlideGaleria + 1} / ${total}`;
    if (tituloEl) tituloEl.textContent = slide.titulo || `${sede.nombreCorto} • Foto ${indiceSlideGaleria + 1}`;
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
}

function abrirGaleriaSegalu(sedeKey = "sede1", indiceInicial = 0) {
    sedeGaleriaActiva = CONFIG_SEDES_SEGALU[sedeKey] ? sedeKey : "sede1";
    mostrarSlideGaleria(indiceInicial);
    modalGaleriaEl.classList.remove("hidden");
}

if (btnAbrirGaleriaEl) btnAbrirGaleriaEl.addEventListener("click", () => abrirGaleriaSegalu("sede1", 0));
if (btnConoceSegaluEl) btnConoceSegaluEl.addEventListener("click", () => abrirGaleriaSegalu("sede1", 0));
if (btnCerrarGaleriaEl) btnCerrarGaleriaEl.addEventListener("click", () => modalGaleriaEl.classList.add("hidden"));
if (btnGaleriaPrevEl) btnGaleriaPrevEl.addEventListener("click", () => mostrarSlideGaleria(indiceSlideGaleria - 1));
if (btnGaleriaNextEl) btnGaleriaNextEl.addEventListener("click", () => mostrarSlideGaleria(indiceSlideGaleria + 1));

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
let blobFotoComprimidaCliente = null;
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
 * Compresión de imagen directa en el cliente (Navegador)
 * Reduce el peso a ~200-300 KB antes de transmitir para lograr subidas en <1 segundo.
 */
function comprimirImagenEnNavegador(elementoImg, calidad = 0.82) {
    return new Promise((resolve) => {
        try {
            const canvas = document.createElement("canvas");
            let ancho = elementoImg.naturalWidth || elementoImg.width;
            let alto = elementoImg.naturalHeight || elementoImg.height;
            const maxDim = 1280;

            if (ancho > maxDim || alto > maxDim) {
                if (ancho > alto) {
                    alto = Math.round((alto * maxDim) / ancho);
                    ancho = maxDim;
                } else {
                    ancho = Math.round((ancho * maxDim) / alto);
                    alto = maxDim;
                }
            }

            canvas.width = ancho;
            canvas.height = alto;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(elementoImg, 0, 0, ancho, alto);

            canvas.toBlob(
                (blob) => {
                    resolve(blob || null);
                },
                "image/jpeg",
                calidad
            );
        } catch (e) {
            resolve(null);
        }
    });
}

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
    blobFotoComprimidaCliente = null;
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
    const dockFlotanteEl = document.getElementById("dock-flotante-invitado");
    if (dockFlotanteEl) dockFlotanteEl.classList.add("hidden");
});

btnCerrarModalFotoEl.addEventListener("click", () => {
    modalSubirFotoEl.classList.add("hidden");
    const dockFlotanteEl = document.getElementById("dock-flotante-invitado");
    if (dockFlotanteEl) dockFlotanteEl.classList.remove("hidden");
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

        imgPreviewFotoEl.onload = async () => {
            // Ejecutamos el Pre-Filtro de IA local y comprimimos la foto en el cliente
            puntajeIaCalculadoCliente = calcularPuntajeIaEnCanvas(imgPreviewFotoEl);
            blobFotoComprimidaCliente = await comprimirImagenEnNavegador(imgPreviewFotoEl, 0.82);

            barraEstadoIaEl.classList.remove("hidden");
            if (puntajeIaCalculadoCliente >= 70) {
                barraEstadoIaEl.classList.remove("ia-warning");
                iaPuntajeTextoEl.textContent = `Pre-Filtro IA: ${puntajeIaCalculadoCliente}% Segura (Aprobada)`;
                iaDetalleTextoEl.textContent = "Tu foto se mostrará con el marco oficial de Segalú en la pantalla.";
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
    btnEnviarFotoEl.innerHTML = `<span>Enviando foto a la pantalla...</span>`;

    try {
        const datosFormulario = new FormData();
        datosFormulario.append("evento_id", eventoActual.id);
        datosFormulario.append("invitado_id", sesionInvitado.invitado.id);
        datosFormulario.append("puntaje_ia_cliente", String(puntajeIaCalculadoCliente));

        const archivoParaSubir = blobFotoComprimidaCliente || archivoFotoSeleccionado;
        datosFormulario.append("archivo", archivoParaSubir, "foto.jpg");

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
            `${resultado.mensaje} (${resultado.analisis_ia?.peso_kb || 200} KB)`,
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

let ultimaPreguntaIdRenderizada = null;

function iniciarCronometroFluidoPregunta(limiteSegundos, segundosRestantesServidor, preguntaId) {
    detenerCronometroFluidoPregunta();

    const limiteTotalMs = Math.max(5, Number(limiteSegundos || 20)) * 1000;
    // Al renderizarse la pregunta en el móvil, el contador arranca exactamente
    // desde el segundo total configurado (ej: 20s) sin desfases por latencia de red.
    let restanteInicialMs = limiteTotalMs;
    if (preguntaId && ultimaPreguntaIdRenderizada === preguntaId && typeof segundosRestantesServidor === "number") {
        restanteInicialMs = Math.max(500, Math.min(limiteTotalMs, segundosRestantesServidor * 1000));
    }
    ultimaPreguntaIdRenderizada = preguntaId;
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
        triviaResultadoPuestoEl.textContent = puestoTexto;
    }
    if (triviaResultadoTotalAcumuladoEl) {
        triviaResultadoTotalAcumuladoEl.textContent = `${totalAcumulado} pts`;
    }

    if (acerto) {
        triviaPanelResultadoEl.className = "kahoot-result-card result-correct";
        triviaResultadoIconoEl.innerHTML = `
            <svg class="result-badge-svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
        triviaResultadoTituloEl.textContent = "¡RESPUESTA CORRECTA!";
        triviaResultadoPuntosEl.textContent = `+${puntosGanados} pts`;
        triviaResultadoStageEl.classList.add("avatar-celebrating");
        triviaResultadoMensajeEl.textContent = `¡Excelente reflejo! Vas en el puesto ${puestoTexto} del ranking en vivo.`;
    } else {
        triviaPanelResultadoEl.className = "kahoot-result-card result-wrong";
        const iconoSvg =
            opcionElegida === "T"
                ? `<svg class="result-badge-svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
                : `<svg class="result-badge-svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

        triviaResultadoIconoEl.innerHTML = iconoSvg;
        triviaResultadoTituloEl.textContent =
            opcionElegida === "T" ? "¡TIEMPO AGOTADO!" : "¡RESPUESTA INCORRECTA!";
        triviaResultadoPuntosEl.textContent = "+0 pts";
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
        triviaSolucionOficialEl.innerHTML = `
            <div class="official-sol-badge">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Solución Oficial</span>
            </div>
            <div class="official-sol-text">
                <strong>Alternativa ${letraCorrecta}:</strong> ${textoSolucion}
            </div>
        `;
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
    if (document.hidden) return;
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
            localStorage.removeItem(STORAGE_KEY_EN_TRIVIA);
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
            guardarSesionInvitadoLocal(sesionInvitado);
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
                preg.tiempo_limite_segundos || 20,
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
    localStorage.setItem(STORAGE_KEY_EN_TRIVIA, "1");
    sincronizarBarraJugadorTrivia();
    vistaLobbyEl.classList.add("hidden");
    vistaTriviaInvitadoEl.classList.remove("hidden");
    const dockFlotanteEl = document.getElementById("dock-flotante-invitado");
    if (dockFlotanteEl) dockFlotanteEl.classList.add("hidden");
    iniciarPollingTriviaMovil();
});

btnVolverLobbyTriviaEl.addEventListener("click", () => {
    enVistaTrivia = false;
    localStorage.removeItem(STORAGE_KEY_EN_TRIVIA);
    detenerCronometroFluidoPregunta();
    detenerPollingTriviaMovil();
    vistaTriviaInvitadoEl.classList.add("hidden");
    vistaLobbyEl.classList.remove("hidden");
    const dockFlotanteEl = document.getElementById("dock-flotante-invitado");
    if (dockFlotanteEl) dockFlotanteEl.classList.remove("hidden");
    consultarEstadoTriviaEnVivo();
});

// ------------------------------------------------------------------------------
// 13. DESCONEXIÓN SUAVE (NO BORRA AL INVITADO)
// Al recargar, cambiar de app o bloquear el celular solo se pausa su presencia en la
// sala de trivia. Su registro, avatar y puntaje se conservan para la reconexión automática.
// El borrado definitivo ocurre únicamente con "Salir / Corregir mi nombre".
// ------------------------------------------------------------------------------
let desconexionEnviada = false;
function notificarPausaPresenciaInvitado() {
    if (desconexionEnviada) return;
    const invitadoId = sesionInvitado?.invitado?.id;
    if (!invitadoId) return;
    desconexionEnviada = true;

    try {
        if (navigator.sendBeacon) {
            navigator.sendBeacon(`/api/invitados/${encodeURIComponent(invitadoId)}/desconectar`, "");
        }
    } catch (e) {
        // Ignorar errores de sendBeacon
    }
}

window.addEventListener("pagehide", notificarPausaPresenciaInvitado);

// Si el navegador restaura la página desde caché (botón atrás / volver a la pestaña),
// reactivamos la presencia sin pedirle nada al invitado.
window.addEventListener("pageshow", (ev) => {
    if (ev.persisted && sesionInvitado?.invitado?.id) {
        desconexionEnviada = false;
        consultarEstadoTriviaEnVivo();
    }
});

/**
 * Reconexión automática: valida en segundo plano el token guardado y refresca nombre,
 * avatar y puntaje. Si el registro ya no existe (p. ej. el Admin lo eliminó) se vuelve
 * al login con el nombre pre-llenado. Si solo falla la red del local, se mantiene la sesión.
 */
async function reconectarSesionInvitado(sesionGuardada) {
    if (!sesionGuardada?.token_sesion) return; // Sesiones antiguas sin token: se respetan tal cual

    try {
        const res = await fetch("/api/invitados/reconectar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                invitado_id: sesionGuardada.invitado.id,
                evento_id: sesionGuardada.evento.id,
                token_sesion: sesionGuardada.token_sesion,
            }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 401 || res.status === 404) {
            const nombrePrevio = sesionGuardada.invitado?.nombre || "";
            localStorage.removeItem(STORAGE_KEY_SESION);
            localStorage.removeItem(STORAGE_KEY_EN_TRIVIA);
            sesionInvitado = null;
            detenerPulsoSincronizacionLobby();
            detenerPollingTriviaMovil();
            detenerCronometroFluidoPregunta();
            vistaLobbyEl.classList.add("hidden");
            vistaTriviaInvitadoEl.classList.add("hidden");
            vistaRegistroEl.classList.remove("hidden");
            inputNombreEl.value = nombrePrevio;
            if (sesionGuardada.evento?.codigo_acceso) {
                inputCodigoEventoEl.value = sesionGuardada.evento.codigo_acceso;
                await cargarEventoPorCodigo(sesionGuardada.evento.codigo_acceso);
            }
            mostrarAlerta(data.detail || "Tu sesión expiró. Vuelve a ingresar tu nombre.", "error");
            return;
        }

        if (!res.ok || !data.invitado) return; // Error temporal: conservamos la sesión local

        const sesionActualizada = {
            invitado: data.invitado,
            evento: data.evento || sesionGuardada.evento,
            token_sesion: data.token_sesion || sesionGuardada.token_sesion,
            posicion_ranking: data.posicion_ranking ?? sesionGuardada.posicion_ranking,
        };
        guardarSesionInvitadoLocal(sesionActualizada);
        mostrarPantallaLobby(sesionActualizada);
        if (enVistaTrivia) sincronizarBarraJugadorTrivia();
    } catch (_) {
        // Red del local inestable: el invitado sigue dentro con su sesión guardada
    }
}

// ------------------------------------------------------------------------------
// 14. INICIO AUTOMÁTICO AL CARGAR LA PÁGINA
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------
// OPTIMIZACIÓN DE POLLING EN PESTAÑAS INACTIVAS (PAGE VISIBILITY API)
// ------------------------------------------------------------------------------
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        detenerPulsoSincronizacionLobby();
        detenerPollingTriviaMovil();
    } else {
        if (sesionInvitado?.invitado?.id && eventoActual?.id) {
            consultarEstadoTriviaEnVivo();
            if (enVistaTrivia) {
                iniciarPollingTriviaMovil();
            } else {
                iniciarPulsoSincronizacionLobby();
            }
        }
    }
});

// ------------------------------------------------------------------------------
// MÓDULO CRM LEADS & CUPONES PROMOCIONALES (SEGALÚ VIP)
// ------------------------------------------------------------------------------
function inicializarSelectorFechaNacimiento() {
    const anioSelect = document.getElementById("lead-nac-anio");
    if (anioSelect && anioSelect.options.length <= 1) {
        const anioActual = new Date().getFullYear();
        for (let a = anioActual; a >= 1940; a--) {
            const opt = document.createElement("option");
            opt.value = String(a);
            opt.textContent = String(a);
            anioSelect.appendChild(opt);
        }
    }
}

function abrirModalCrmLead() {
    if (!modalCrmLeadEl) return;

    inicializarSelectorFechaNacimiento();

    if (leadNombreEl && sesionInvitado?.invitado?.nombre && !leadNombreEl.value) {
        leadNombreEl.value = sesionInvitado.invitado.nombre;
    }

    const eventoId = eventoActual?.id || "global";
    const cuponGuardado = localStorage.getItem(`${STORAGE_LEAD_PREFIX}${eventoId}`);
    if (cuponGuardado) {
        try {
            const dataCupon = JSON.parse(cuponGuardado);
            if (dataCupon && dataCupon.codigo_promocional) {
                mostrarTarjetaCuponGenerado(dataCupon);
                modalCrmLeadEl.classList.remove("hidden");
                return;
            }
        } catch (_) {}
    }

    if (vistaLeadFormularioEl) vistaLeadFormularioEl.classList.remove("hidden");
    if (vistaLeadExitoEl) vistaLeadExitoEl.classList.add("hidden");
    modalCrmLeadEl.classList.remove("hidden");
}

function cerrarModalCrmLead() {
    if (modalCrmLeadEl) {
        modalCrmLeadEl.classList.add("hidden");
    }
}

function mostrarTarjetaCuponGenerado(leadData) {
    if (!leadData) return;
    const codigoPromo = leadData.codigo_promocional || "SEGALU-PROMO-VIP";
    const nombre = leadData.nombre || sesionInvitado?.invitado?.nombre || "Invitado VIP";

    if (voucherNombreInvitadoEl) {
        voucherNombreInvitadoEl.textContent = `Invitado VIP: ${nombre}`;
    }
    if (voucherCodigoPromocionalEl) {
        voucherCodigoPromocionalEl.textContent = codigoPromo;
    }
    if (voucherQrImgEl) {
        voucherQrImgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(codigoPromo)}`;
    }

    if (btnCompartirCuponWaEl) {
        const nombreEvento = eventoActual?.nombre || "Gala Segalú";
        const msgWa = `¡Hola Eventos Segalú! 🎁 Tengo mi Pase VIP con código promocional "${codigoPromo}" generado en el evento "${nombreEvento}" y deseo cotizar mi fecha con mi beneficio exclusivo.`;
        btnCompartirCuponWaEl.href = `https://wa.me/${TELEFONO_WHATSAPP_SEGALU}?text=${encodeURIComponent(msgWa)}`;
    }

    if (vistaLeadFormularioEl) vistaLeadFormularioEl.classList.add("hidden");
    if (vistaLeadExitoEl) vistaLeadExitoEl.classList.remove("hidden");
}

async function enviarFormularioLead(e) {
    if (e) e.preventDefault();
    if (!eventoActual?.id) {
        mostrarAlerta("Ingresa primero a un evento activo para reclamar tu beneficio.", "error");
        return;
    }

    const nombre = (leadNombreEl?.value || "").trim();
    const telefono = (leadTelefonoEl?.value || "").trim();
    const diaEl = document.getElementById("lead-nac-dia");
    const mesEl = document.getElementById("lead-nac-mes");
    const anioEl = document.getElementById("lead-nac-anio");

    const dia = (diaEl?.value || "").trim();
    const mes = (mesEl?.value || "").trim();
    const anio = (anioEl?.value || "").trim();

    const genero = (leadGeneroEl?.value || "No especificado").trim();
    const correo = (leadCorreoEl?.value || "").trim();

    if (!nombre || !telefono) {
        mostrarAlerta("Por favor completa tu Nombre y Teléfono.", "error");
        return;
    }

    if (!dia || !mes || !anio) {
        mostrarAlerta("Por favor selecciona tu Día, Mes y Año de nacimiento.", "error");
        if (!dia && diaEl) diaEl.focus();
        else if (!mes && mesEl) mesEl.focus();
        else if (!anio && anioEl) anioEl.focus();
        return;
    }

    // Validación de fecha válida
    const numDia = parseInt(dia, 10);
    const numMes = parseInt(mes, 10);
    const numAnio = parseInt(anio, 10);
    const fechaObj = new Date(numAnio, numMes - 1, numDia);
    if (
        fechaObj.getFullYear() !== numAnio ||
        fechaObj.getMonth() !== (numMes - 1) ||
        fechaObj.getDate() !== numDia
    ) {
        mostrarAlerta("La fecha de nacimiento seleccionada no es válida en el calendario.", "error");
        return;
    }

    // Formato exacto dd/mm/aaaa
    const nacimiento = `${String(numDia).padStart(2, "0")}/${String(numMes).padStart(2, "0")}/${numAnio}`;
    if (leadNacimientoEl) {
        leadNacimientoEl.value = nacimiento;
    }

    // Validación estricta de teléfono: exactamente 9 dígitos numéricos
    const telefonoSoloDigitos = telefono.replace(/\s+/g, "");
    if (!/^\d{9}$/.test(telefonoSoloDigitos)) {
        mostrarAlerta("El número de teléfono debe tener exactamente 9 dígitos", "error");
        if (leadTelefonoEl) {
            leadTelefonoEl.focus();
        }
        return;
    }

    if (btnEnviarLeadEl) {
        btnEnviarLeadEl.disabled = true;
        btnEnviarLeadEl.innerHTML = `<span>⏳ Generando tu Pase VIP...</span>`;
    }

    try {
        const res = await fetch(`/api/eventos/${encodeURIComponent(eventoActual.id)}/leads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                evento_id: eventoActual.id,
                nombre,
                telefono: telefonoSoloDigitos,
                fecha_nacimiento: nacimiento,
                genero,
                correo: correo || null,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "No se pudo generar el cupón.");
        }

        const leadInfo = data.lead || {
            nombre,
            telefono,
            fecha_nacimiento: nacimiento,
            codigo_promocional: data.codigo_promocional,
        };

        localStorage.setItem(`${STORAGE_LEAD_PREFIX}${eventoActual.id}`, JSON.stringify(leadInfo));
        mostrarTarjetaCuponGenerado(leadInfo);
        mostrarAlerta("¡Felicitaciones! Tu Pase VIP y Cupón están listos.", "exito");
    } catch (err) {
        mostrarAlerta(err.message, "error");
    } finally {
        if (btnEnviarLeadEl) {
            btnEnviarLeadEl.disabled = false;
            btnEnviarLeadEl.innerHTML = `<span>✨ Obtener Mi Pase VIP y Descuento</span>`;
        }
    }
}

if (btnAbrirModalLeadEl) {
    btnAbrirModalLeadEl.addEventListener("click", abrirModalCrmLead);
}
if (btnFlotanteVipLeadEl) {
    btnFlotanteVipLeadEl.addEventListener("click", abrirModalCrmLead);
}
if (btnCerrarModalLeadEl) {
    btnCerrarModalLeadEl.addEventListener("click", cerrarModalCrmLead);
}
if (btnCancelarModalLeadEl) {
    btnCancelarModalLeadEl.addEventListener("click", cerrarModalCrmLead);
}
if (btnCerrarCuponEl) {
    btnCerrarCuponEl.addEventListener("click", cerrarModalCrmLead);
}
if (formCrmLeadEl) {
    formCrmLeadEl.addEventListener("submit", enviarFormularioLead);
}
if (leadTelefonoEl) {
    leadTelefonoEl.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/\D/g, "").slice(0, 9);
    });
}
if (modalCrmLeadEl) {
    modalCrmLeadEl.addEventListener("click", (e) => {
        if (e.target === modalCrmLeadEl) cerrarModalCrmLead();
    });
}

// ==============================================================================
// 15. MURO DE FOTOS EN VIVO Y CORAZONES INTERACTIVOS (FASE DARK LUXURY)
// ==============================================================================
const STORAGE_KEY_LIKES = "segalu_fotos_liked_ids";
let listaFotosAprobadasEvento = [];

function obtenerFotosLikedLocal() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_LIKES);
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

function guardarFotoLikedLocal(fotoId, liked) {
    try {
        let lista = obtenerFotosLikedLocal();
        if (liked) {
            if (!lista.includes(fotoId)) lista.push(fotoId);
        } else {
            lista = lista.filter((id) => id !== fotoId);
        }
        localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(lista));
    } catch (_) {}
}

function dispararBurstCorazon(contenedor) {
    if (!contenedor) return;
    const anim = document.createElement("span");
    anim.className = "heart-burst-anim";
    anim.textContent = "❤️";
    contenedor.appendChild(anim);
    setTimeout(() => anim.remove(), 850);
}

async function toggleLikeFoto(fotoId, btnEl, countEl, cardEl, forzarLike = false) {
    const likedList = obtenerFotosLikedLocal();
    const yaTieneLike = likedList.includes(fotoId);

    if (forzarLike && yaTieneLike) {
        dispararBurstCorazon(cardEl);
        return;
    }

    const nuevoEstado = forzarLike ? true : !yaTieneLike;
    guardarFotoLikedLocal(fotoId, nuevoEstado);

    let cuentaActual = parseInt(countEl?.textContent || "0", 10);
    if (isNaN(cuentaActual)) cuentaActual = 0;
    const nuevaCuenta = nuevoEstado ? cuentaActual + 1 : Math.max(0, cuentaActual - 1);

    if (countEl) countEl.textContent = String(nuevaCuenta);
    if (btnEl) {
        if (nuevoEstado) btnEl.classList.add("liked");
        else btnEl.classList.remove("liked");
    }

    if (nuevoEstado) {
        dispararBurstCorazon(cardEl);
    }

    // Sincronizar otros botones que muestren la misma foto
    document.querySelectorAll(`.photo-heart-btn[data-foto-id="${fotoId}"]`).forEach((b) => {
        if (nuevoEstado) b.classList.add("liked");
        else b.classList.remove("liked");
        const c = b.querySelector(".like-count");
        if (c) c.textContent = String(nuevaCuenta);
    });

    try {
        await fetch(`/api/multimedia/${encodeURIComponent(fotoId)}/like`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                delta: nuevoEstado ? 1 : -1,
                invitado_id: sesionInvitado?.invitado?.id || null,
            }),
        });
    } catch (e) {
        console.warn("Aviso al registrar like:", e);
    }
}

function construirTarjetaFotoMuro(foto) {
    const card = document.createElement("article");
    card.className = "live-photo-card";
    card.dataset.fotoId = foto.id;

    const likedList = obtenerFotosLikedLocal();
    const tieneLike = likedList.includes(foto.id);
    const likesCount = foto.likes || 0;

    card.innerHTML = `
        <img src="${foto.url}" alt="Foto del evento" class="live-photo-img" loading="lazy" />
        <div class="live-photo-overlay">
            <span class="live-photo-author">👤 ${foto.autor || "Invitado"}</span>
        </div>
        <button type="button" class="live-photo-heart-btn photo-heart-btn ${tieneLike ? 'liked' : ''}" data-foto-id="${foto.id}" aria-label="Dar me gusta">
            <span>❤️</span>
            <span class="like-count">${likesCount}</span>
        </button>
    `;

    const heartBtn = card.querySelector(".photo-heart-btn");
    const countEl = card.querySelector(".like-count");

    // 1-tap sobre el corazón
    heartBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleLikeFoto(foto.id, heartBtn, countEl, card, false);
    });

    // Doble tap sobre la tarjeta
    let lastTapTime = 0;
    card.addEventListener("click", (e) => {
        if (e.target.closest(".photo-heart-btn")) return;
        const now = Date.now();
        if (now - lastTapTime < 320) {
            toggleLikeFoto(foto.id, heartBtn, countEl, card, true);
            lastTapTime = 0;
        } else {
            lastTapTime = now;
        }
    });

    return card;
}

async function cargarFotosMuroLive() {
    const gridMuroEl = document.getElementById("grid-muro-fotos-live");
    if (!gridMuroEl || !eventoActual?.id) return;

    try {
        const res = await fetch(`/api/eventos/${encodeURIComponent(eventoActual.id)}/fotos`);
        if (!res.ok) return;
        const data = await res.json();
        listaFotosAprobadasEvento = data.fotos || [];

        const ultimasFotos = listaFotosAprobadasEvento.slice(0, 4);
        gridMuroEl.innerHTML = "";

        if (ultimasFotos.length === 0) {
            gridMuroEl.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: #94A3B8; font-size: 0.82rem; background: rgba(20,26,38,0.6); border: 1px dashed rgba(212,175,55,0.25); border-radius: 12px;">
                    📷 Sé el primero en compartir tu selfie tocando "Subir Foto" abajo
                </div>
            `;
            return;
        }

        ultimasFotos.forEach((f) => {
            gridMuroEl.appendChild(construirTarjetaFotoMuro(f));
        });
    } catch (err) {
        console.warn("Aviso al cargar fotos del muro live:", err);
    }
}

// Modal de Galería Completa
const modalGaleriaFotosEventoEl = document.getElementById("modal-galeria-fotos-evento");
const btnVerGaleriaCompletaEl = document.getElementById("btn-ver-galeria-completa");
const btnCerrarGaleriaCompletaEl = document.getElementById("btn-cerrar-galeria-completa");
const gridGaleriaCompletaEl = document.getElementById("grid-galeria-completa");
const contadorFotosGaleriaEl = document.getElementById("contador-fotos-galeria");
const galeriaVaciaAvisoEl = document.getElementById("galeria-vacia-aviso");

if (btnVerGaleriaCompletaEl) {
    btnVerGaleriaCompletaEl.addEventListener("click", () => {
        if (!modalGaleriaFotosEventoEl) return;
        modalGaleriaFotosEventoEl.classList.remove("hidden");

        if (contadorFotosGaleriaEl) {
            contadorFotosGaleriaEl.textContent = `${listaFotosAprobadasEvento.length} fotos`;
        }

        if (gridGaleriaCompletaEl) {
            gridGaleriaCompletaEl.innerHTML = "";
            if (listaFotosAprobadasEvento.length === 0) {
                if (galeriaVaciaAvisoEl) galeriaVaciaAvisoEl.classList.remove("hidden");
            } else {
                if (galeriaVaciaAvisoEl) galeriaVaciaAvisoEl.classList.add("hidden");
                listaFotosAprobadasEvento.forEach((f) => {
                    gridGaleriaCompletaEl.appendChild(construirTarjetaFotoMuro(f));
                });
            }
        }
    });
}

if (btnCerrarGaleriaCompletaEl) {
    btnCerrarGaleriaCompletaEl.addEventListener("click", () => {
        if (modalGaleriaFotosEventoEl) modalGaleriaFotosEventoEl.classList.add("hidden");
    });
}

window.addEventListener("DOMContentLoaded", async () => {
    inicializarSelectorFechaNacimiento();
    cargarAccesoriosPersonalizados();
    renderizarSeccionUbicacionSedes();
    sincronizarFotosSedesDesdeServidor();

    const parametrosUrl = new URLSearchParams(window.location.search);
    const codigoDesdeQR = parametrosUrl.get("codigo");

    if (codigoDesdeQR) {
        inputCodigoEventoEl.value = codigoDesdeQR.toUpperCase();
    }

    const sesionGuardada = leerSesionInvitadoLocal();
    if (
        sesionGuardada &&
        (!codigoDesdeQR || sesionGuardada.evento?.codigo_acceso === codigoDesdeQR.toUpperCase())
    ) {
        // 1. Restauración instantánea (sin esperar a la red) para no mostrar el login
        mostrarPantallaLobby(sesionGuardada);

        // 2. Si estaba dentro de la Ronda de Preguntas, lo devolvemos directamente a ella
        if (localStorage.getItem(STORAGE_KEY_EN_TRIVIA) === "1") {
            btnIrTriviaEl.click();
        }

        // 3. Validación silenciosa con el servidor (puntaje, avatar y posición actualizados)
        reconectarSesionInvitado(sesionGuardada);
        return;
    }

    await cargarEventoPorCodigo(inputCodigoEventoEl.value);
});


