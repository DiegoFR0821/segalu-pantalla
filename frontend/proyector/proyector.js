// ==============================================================================
// PROYECTO: MVP WEB SEGALU (Eventos & Experiencias)
// ARCHIVO: frontend/proyector/proyector.js
// FASE 5: Motor en Tiempo Real del Proyector 100% Pantalla Completa (100vw x 100vh)
//         - Sin cabecera ni QR (100% área visual hasta los 4 bordes)
//         - Modo GALERIA con Doble Capa Ambient Blur + Mosaico de 6 a 8 Fotos
//         - Sincronización instantánea con Controles de Galería (5s, 8s, 12s)
//         - Modos LOBBY_KAHOOT, PREGUNTA_ACTIVA, RESULTADOS_PREGUNTA y PODIO
// ==============================================================================

// Vistas principales por modo
const vistaGaleriaEl = document.getElementById("vista-modo-galeria");
const vistaLobbyKahootEl = document.getElementById("vista-modo-lobby-kahoot");
const vistaPreguntaKahootEl = document.getElementById("vista-modo-pregunta-kahoot");
const vistaPodioEl = document.getElementById("vista-modo-podio");
const vistaRankingEl = document.getElementById("vista-modo-ranking");
const rankingFilasContenedorEl = document.getElementById("ranking-filas-contenedor");

// Elementos Modo GALERIA (Doble Capa Ambient Blur + Mosaico 6-8 Fotos)
const galeriaCapaBlurFondoEl = document.getElementById("galeria-capa-blur-fondo");
const galeriaContenedorFotoActivaEl = document.getElementById("galeria-contenedor-foto-activa");
const galeriaImgNitidaEl = document.getElementById("galeria-img-nitida");
const galeriaMarcoWrapperEl = document.getElementById("galeria-marco-wrapper");
const galeriaContenedorMosaicoEl = document.getElementById("galeria-contenedor-mosaico");
const galeriaGridMosaicoEl = document.getElementById("galeria-grid-mosaico");
const galeriaAutorCapsulaEl = document.getElementById("galeria-autor-capsula");
const galeriaAutorAvatarEl = document.getElementById("galeria-autor-avatar");
const galeriaAutorNombreEl = document.getElementById("galeria-autor-nombre");
const galeriaEstadoVacioEl = document.getElementById("galeria-estado-vacio");

// Elementos Modo LOBBY_KAHOOT
const lobbyNumeroJugadoresEl = document.getElementById("lobby-numero-jugadores");
const lobbyGridAvataresEl = document.getElementById("lobby-grid-avatares");

// Elementos Modos PREGUNTA_ACTIVA y RESULTADOS_PREGUNTA
const kahootBadgeNumeroPreguntaEl = document.getElementById("kahoot-badge-numero-pregunta");
const kahootBadgeEstadoRondaEl = document.getElementById("kahoot-badge-estado-ronda");
const kahootTextoEnunciadoEl = document.getElementById("kahoot-texto-enunciado");
const kahootRelojCirculoEl = document.getElementById("kahoot-reloj-circulo");
const kahootRelojProgresoEl = document.getElementById("kahoot-reloj-progreso");
const kahootSegundosNumeroEl = document.getElementById("kahoot-segundos-numero");
const kahootNumeroRespuestasEl = document.getElementById("kahoot-numero-respuestas");
const kahootCentroEsperandoEl = document.getElementById("kahoot-centro-esperando");
const kahootCentroGraficoBarrasEl = document.getElementById("kahoot-centro-grafico-barras");

// Elementos Modo PODIO (3 Tarimas Escalonadas)
const podioTituloPrincipalEl = document.getElementById("podio-gala-titulo-principal");
const podioSubtituloEl = document.getElementById("podio-gala-subtitulo");
const columnaPodio1El = document.getElementById("columna-podio-1");
const columnaPodio2El = document.getElementById("columna-podio-2");
const columnaPodio3El = document.getElementById("columna-podio-3");
const avatarPodio1El = document.getElementById("avatar-podio-1");
const avatarPodio2El = document.getElementById("avatar-podio-2");
const avatarPodio3El = document.getElementById("avatar-podio-3");
const nombrePodio1El = document.getElementById("nombre-podio-1");
const nombrePodio2El = document.getElementById("nombre-podio-2");
const nombrePodio3El = document.getElementById("nombre-podio-3");
const puntosPodio1El = document.getElementById("puntos-podio-1");
const puntosPodio2El = document.getElementById("puntos-podio-2");
const puntosPodio3El = document.getElementById("puntos-podio-3");
const podioMencionesBarraEl = document.getElementById("podio-menciones-barra");

// Estado en memoria del Proyector
let modoProyectorActual = "";
let fotosAprobadasCache = [];
const urlsFotosInvalidas = new Set();
let indiceCarruselActual = 0;
let mostrandoMosaicoEnCiclo = false;
let offsetMosaicoActual = 0;
let idFotoMostradaActual = "";
let temporizadorCarruselGaleria = null;

// Configuración de visualización de Galería ("ciclo_auto" | "individual" | "mosaico") y duración (5s | 8s | 12s)
let modoGaleriaConfig = localStorage.getItem("segalu_modo_galeria") || "ciclo_auto";
let duracionFotoSegundos = Number(localStorage.getItem("segalu_duracion_foto") || 8);

let firmaLobbyRenderizado = "";
let firmaPodioSecuenciaActual = "";
let timeoutsSecuenciaPodio = [];
let intervaloCelebracionCampeon = null;

// ------------------------------------------------------------------------------
// 1. SISTEMA DE AVATARES COMPUESTOS KAHOOT (PERSONAJE + ACCESORIO EN SVG)
// ------------------------------------------------------------------------------
const MAPA_LEGACY_AVATARES = {
    perrito_fiesta: { personaje: "pug_real", accesorio: "corona_imperial" },
    gatito_elegante: { personaje: "gatito_gala", accesorio: "corbatin_dorado" },
    panda_bailarin: { personaje: "osito_gala", accesorio: "sombrero_copa" },
    zorrito_cool: { personaje: "zorro_glam", accesorio: "lentes_vip" },
    conejito_vip: { personaje: "conejita_real", accesorio: "tiara_diamantes" },
    leon_rey: { personaje: "leon_imperial", accesorio: "corona_imperial" },
};

const SVG_PERSONAJES = {
    pug_real: `
        <circle cx="60" cy="64" r="34" fill="#E3C193" stroke="#5C4028" stroke-width="3"/>
        <path d="M26 46 Q18 62 28 74 Q36 62 34 48 Z" fill="#4A3525"/>
        <path d="M94 46 Q102 62 92 74 Q84 62 86 48 Z" fill="#4A3525"/>
        <ellipse cx="60" cy="73" rx="18" ry="13" fill="#4A3525"/>
        <circle cx="46" cy="58" r="6" fill="#231F20"/>
        <circle cx="44" cy="56" r="2" fill="#FFFFFF"/>
        <circle cx="74" cy="58" r="6" fill="#231F20"/>
        <circle cx="72" cy="56" r="2" fill="#FFFFFF"/>
        <ellipse cx="60" cy="69" rx="5.5" ry="4" fill="#1A1718"/>
        <path d="M54 77 Q60 82 66 77" fill="none" stroke="#F4979C" stroke-width="3" stroke-linecap="round"/>
    `,
    gatito_gala: `
        <polygon points="30,52 24,22 50,38" fill="#3B3A42" stroke="#232228" stroke-width="2.5"/>
        <polygon points="90,52 96,22 70,38" fill="#3B3A42" stroke="#232228" stroke-width="2.5"/>
        <circle cx="60" cy="64" r="33" fill="#4A4952" stroke="#232228" stroke-width="3"/>
        <ellipse cx="60" cy="74" rx="16" ry="11" fill="#F4F2EE"/>
        <circle cx="46" cy="58" r="5.5" fill="#E5C158"/>
        <circle cx="46" cy="58" r="2.5" fill="#16161D"/>
        <circle cx="74" cy="58" r="5.5" fill="#E5C158"/>
        <circle cx="74" cy="58" r="2.5" fill="#16161D"/>
        <polygon points="56,69 64,69 60,74" fill="#E28B97"/>
    `,
    osito_gala: `
        <circle cx="33" cy="36" r="12" fill="#9C6B43" stroke="#5A3A20" stroke-width="3"/>
        <circle cx="87" cy="36" r="12" fill="#9C6B43" stroke="#5A3A20" stroke-width="3"/>
        <circle cx="60" cy="64" r="34" fill="#B68052" stroke="#5A3A20" stroke-width="3"/>
        <ellipse cx="60" cy="72" rx="15" ry="12" fill="#EAD3B8"/>
        <circle cx="47" cy="57" r="5" fill="#231F20"/>
        <circle cx="73" cy="57" r="5" fill="#231F20"/>
        <ellipse cx="60" cy="68" rx="6" ry="4.2" fill="#3D2614"/>
    `,
    zorro_glam: `
        <polygon points="26,52 20,18 52,38" fill="#D96B27" stroke="#7A360D" stroke-width="2.5"/>
        <polygon points="94,52 100,18 68,38" fill="#D96B27" stroke="#7A360D" stroke-width="2.5"/>
        <circle cx="60" cy="64" r="33" fill="#E87A34" stroke="#7A360D" stroke-width="3"/>
        <path d="M29 66 Q45 92 60 95 Q75 92 91 66 Q76 62 60 72 Q44 62 29 66 Z" fill="#FFF8EE"/>
        <circle cx="46" cy="58" r="5" fill="#231F20"/>
        <circle cx="74" cy="58" r="5" fill="#231F20"/>
        <circle cx="60" cy="74" r="4.8" fill="#231F20"/>
    `,
    conejita_real: `
        <ellipse cx="44" cy="24" rx="8" ry="22" fill="#F7F3EB" stroke="#B7A99A" stroke-width="2.5"/>
        <ellipse cx="76" cy="24" rx="8" ry="22" fill="#F7F3EB" stroke="#B7A99A" stroke-width="2.5"/>
        <circle cx="60" cy="66" r="32" fill="#FFFDF9" stroke="#B7A99A" stroke-width="3"/>
        <circle cx="47" cy="60" r="5" fill="#3D2E3C"/>
        <circle cx="73" cy="60" r="5" fill="#3D2E3C"/>
        <polygon points="56,70 64,70 60,75" fill="#F294A5"/>
    `,
    leon_imperial: `
        <circle cx="60" cy="64" r="42" fill="#B56522" stroke="#6E390C" stroke-width="3"/>
        <circle cx="60" cy="64" r="31" fill="#E8B464" stroke="#8C5319" stroke-width="2.5"/>
        <circle cx="48" cy="58" r="5" fill="#231F20"/>
        <circle cx="72" cy="58" r="5" fill="#231F20"/>
        <polygon points="55,69 65,69 60,75" fill="#6E390C"/>
    `,
};

const SVG_ACCESORIOS = {
    corona_imperial: `
        <polygon points="34,34 42,12 60,26 78,12 86,34" fill="#F5D77F" stroke="#8A6D1B" stroke-width="2.5"/>
        <circle cx="60" cy="18" r="3.5" fill="#E21B3C"/>
    `,
    birrete: `
        <polygon points="60,10 18,24 60,38 102,24" fill="#1E1E24" stroke="#D4AF37" stroke-width="2"/>
        <rect x="44" y="32" width="32" height="12" rx="4" fill="#141419" stroke="#D4AF37" stroke-width="1.8"/>
        <circle cx="60" cy="24" r="3" fill="#D4AF37"/>
        <path d="M60 24 Q78 30 84 46" fill="none" stroke="#D4AF37" stroke-width="2.5"/>
        <circle cx="84" cy="48" r="3.5" fill="#D4AF37"/>
    `,
    tiara_xv: `
        <path d="M36 33 Q60 10 84 33 Z" fill="#EBF4FA" stroke="#D4AF37" stroke-width="2.2"/>
        <polygon points="60,14 65,24 60,31 55,24" fill="#7CD4FD"/>
        <circle cx="48" cy="24" r="2.5" fill="#E21B3C"/>
        <circle cx="72" cy="24" r="2.5" fill="#E21B3C"/>
    `,
    tiara_diamantes: `
        <path d="M36 33 Q60 10 84 33 Z" fill="#EBF4FA" stroke="#8A6D1B" stroke-width="2.2"/>
        <polygon points="60,15 65,24 60,31 55,24" fill="#7CD4FD"/>
    `,
    corona_flores: `
        <path d="M30 36 Q60 18 90 36" fill="none" stroke="#48BB78" stroke-width="4" stroke-linecap="round"/>
        <circle cx="34" cy="34" r="5" fill="#F687B3"/>
        <circle cx="47" cy="27" r="5" fill="#FAF089"/>
        <circle cx="60" cy="24" r="5.5" fill="#ED64A6"/>
        <circle cx="73" cy="27" r="5" fill="#9F7AEA"/>
        <circle cx="86" cy="34" r="5" fill="#F687B3"/>
    `,
    lentes_vip: `
        <rect x="31" y="49" width="25" height="16" rx="4" fill="#16161D" stroke="#D4AF37" stroke-width="2.8"/>
        <rect x="64" y="49" width="25" height="16" rx="4" fill="#16161D" stroke="#D4AF37" stroke-width="2.8"/>
        <line x1="56" y1="56" x2="64" y2="56" stroke="#D4AF37" stroke-width="3"/>
    `,
    antifaz_15: `
        <path d="M26 50 Q44 42 60 52 Q76 42 94 50 Q96 66 78 68 Q60 62 42 68 Q24 66 26 50 Z" fill="#44337A" stroke="#D4AF37" stroke-width="2.2"/>
        <ellipse cx="44" cy="56" rx="7" ry="5" fill="#111116"/>
        <ellipse cx="76" cy="56" rx="7" ry="5" fill="#111116"/>
    `,
    sombrero_copa: `
        <rect x="32" y="28" width="56" height="7" rx="3.5" fill="#1E1E24" stroke="#D4AF37" stroke-width="2"/>
        <rect x="41" y="6" width="38" height="24" rx="4" fill="#282832" stroke="#D4AF37" stroke-width="2"/>
        <rect x="41" y="22" width="38" height="5" fill="#D4AF37"/>
    `,
    sombrero_gala: `
        <rect x="32" y="28" width="56" height="7" rx="3.5" fill="#1E1E24" stroke="#D4AF37" stroke-width="2"/>
        <rect x="41" y="6" width="38" height="24" rx="4" fill="#282832" stroke="#D4AF37" stroke-width="2"/>
        <rect x="41" y="22" width="38" height="5" fill="#D4AF37"/>
    `,
    gorra_vip: `
        <path d="M38 32 Q60 14 82 32 Z" fill="#2B1954" stroke="#D4AF37" stroke-width="2"/>
        <ellipse cx="60" cy="32" rx="28" ry="6" fill="#1E1E24" stroke="#D4AF37" stroke-width="2"/>
        <rect x="52" y="20" width="16" height="8" rx="2" fill="#D4AF37"/>
    `,
    corbatin_dorado: `
        <polygon points="43,92 60,100 43,108" fill="#D4AF37" stroke="#7A5C12" stroke-width="2"/>
        <polygon points="77,92 60,100 77,108" fill="#D4AF37" stroke="#7A5C12" stroke-width="2"/>
        <circle cx="60" cy="100" r="4.5" fill="#F5D77F" stroke="#7A5C12" stroke-width="2"/>
    `,
    corbatin_gala: `
        <polygon points="43,92 60,100 43,108" fill="#D4AF37" stroke="#7A5C12" stroke-width="2"/>
        <polygon points="77,92 60,100 77,108" fill="#D4AF37" stroke="#7A5C12" stroke-width="2"/>
        <circle cx="60" cy="100" r="4.5" fill="#F5D77F" stroke="#7A5C12" stroke-width="2"/>
    `,
    auriculares_dj: `
        <path d="M24 62 A36 36 0 0 1 96 62" fill="none" stroke="#D4AF37" stroke-width="6" stroke-linecap="round"/>
        <rect x="17" y="52" width="11" height="22" rx="5" fill="#1E1E24" stroke="#D4AF37" stroke-width="2.2"/>
        <rect x="92" y="52" width="11" height="22" rx="5" fill="#1E1E24" stroke="#D4AF37" stroke-width="2.2"/>
    `,
};

let catalogoAccesoriosProyector = {};

async function cargarAccesoriosProyector() {
    try {
        const res = await fetch("/api/accesorios", { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            if (data.ok && Array.isArray(data.personalizados)) {
                data.personalizados.forEach((acc) => {
                    if (acc && acc.id && acc.url) {
                        catalogoAccesoriosProyector[acc.id] = acc.url;
                    }
                });
                firmaLobbyRenderizado = "";
                sincronizarEstadoProyector();
            }
        }
    } catch (_) {}
}

const MAPA_RUTAS_ACCESORIOS_DEFAULT = {
    corona_imperial: "/static/accessories/boda/corona_imperial.png",
    corbatin_gala: "/static/accessories/boda/corbatin_gala.png",
    corbatin_dorado: "/static/accessories/boda/corbatin_gala.png",
    sombrero_gala: "/static/accessories/boda/sombrero_gala.png",
    sombrero_copa: "/static/accessories/boda/sombrero_gala.png",
    birrete: "/static/accessories/graduacion/birrete.png",
    tiara_xv: "/static/accessories/quinceanero/tiara_xv.png",
    tiara_diamantes: "/static/accessories/quinceanero/tiara_xv.png",
    corona_flores: "/static/accessories/quinceanero/corona_flores.png",
    antifaz_15: "/static/accessories/quinceanero/antifaz_15.png",
    lentes_vip: "/static/accessories/general/lentes_vip.png",
    gorra_vip: "/static/accessories/general/gorra_vip.png",
};

function descomponerAvatar(codigoAvatar) {
    const limpio = String(codigoAvatar || "").trim().toLowerCase();
    if (limpio.includes("|")) {
        const [p, a] = limpio.split("|", 2);
        return {
            personaje: SVG_PERSONAJES[p] ? p : "pug_real",
            accesorio: a || "sin_accesorio",
        };
    }
    if (MAPA_LEGACY_AVATARES[limpio]) {
        return MAPA_LEGACY_AVATARES[limpio];
    }
    return { personaje: "pug_real", accesorio: "corona_imperial" };
}

function generarSvgAvatarCompuesto(codigoAvatar) {
    const { personaje, accesorio } = descomponerAvatar(codigoAvatar);

    let accesorioSvg = "";
    if (accesorio && accesorio !== "sin_accesorio") {
        const urlCustom = catalogoAccesoriosProyector[accesorio] || (accesorio.startsWith("acc_") ? `/static/accessories/general/${accesorio}.png` : "");
        if (urlCustom) {
            let x = "28", y = "2", w = "64", h = "42";
            if (accesorio.includes("corbatin") || accesorio.includes("collar")) {
                x = "36"; y = "82"; w = "48"; h = "28";
            } else if (accesorio.includes("lentes") || accesorio.includes("antifaz") || accesorio.includes("gafas")) {
                x = "26"; y = "44"; w = "68"; h = "28";
            }
            accesorioSvg = `<image href="${urlCustom}" xlink:href="${urlCustom}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" />`;
        } else if (SVG_ACCESORIOS[accesorio]) {
            accesorioSvg = SVG_ACCESORIOS[accesorio];
        } else if (MAPA_RUTAS_ACCESORIOS_DEFAULT[accesorio]) {
            const urlDef = MAPA_RUTAS_ACCESORIOS_DEFAULT[accesorio];
            let x = "28", y = "2", w = "64", h = "42";
            if (accesorio.includes("corbatin")) {
                x = "36"; y = "82"; w = "48"; h = "28";
            } else if (accesorio.includes("lentes") || accesorio.includes("antifaz")) {
                x = "26"; y = "44"; w = "68"; h = "28";
            }
            accesorioSvg = `<image href="${urlDef}" xlink:href="${urlDef}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" />`;
        } else {
            accesorioSvg = SVG_ACCESORIOS.corona_imperial;
        }
    }

    return `
        <svg viewBox="0 0 120 116" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="Avatar invitado">
            ${SVG_PERSONAJES[personaje] || SVG_PERSONAJES.pug_real}
            ${accesorioSvg}
        </svg>
    `;
}

// ------------------------------------------------------------------------------
// 2. CAMBIO AUTOMÁTICO DE VISTA ENTRE LOS 5 MODOS SIN RECARGAR LA PÁGINA
// ------------------------------------------------------------------------------
function activarVistaModo(modo) {
    if (modoProyectorActual === modo) return;
    const modoPrevio = modoProyectorActual;
    modoProyectorActual = modo;

    vistaGaleriaEl.classList.add("hidden");
    vistaLobbyKahootEl.classList.add("hidden");
    vistaPreguntaKahootEl.classList.add("hidden");
    if (vistaRankingEl) vistaRankingEl.classList.add("hidden");
    vistaPodioEl.classList.add("hidden");

    if (modoPrevio === "PODIO" && modo !== "PODIO") {
        detenerSecuenciaFuegosPodio();
    }

    if (modoPrevio === "PREGUNTA_ACTIVA" && modo !== "PREGUNTA_ACTIVA") {
        if (temporizadorLocalPregunta) {
            clearInterval(temporizadorLocalPregunta);
            temporizadorLocalPregunta = null;
        }
        idPreguntaActivaTimer = null;
    }

    if (modo === "GALERIA") {
        vistaGaleriaEl.classList.remove("hidden");
    } else if (modo === "LOBBY_KAHOOT") {
        vistaLobbyKahootEl.classList.remove("hidden");
    } else if (modo === "PREGUNTA_ACTIVA" || modo === "RESULTADOS_PREGUNTA") {
        vistaPreguntaKahootEl.classList.remove("hidden");
    } else if (modo === "RANKING") {
        if (vistaRankingEl) vistaRankingEl.classList.remove("hidden");
    } else if (modo === "PODIO") {
        vistaPodioEl.classList.remove("hidden");
    }
}

// ------------------------------------------------------------------------------
// 3. MODO GALERIA FULLSCREEN: CARRUSEL 1x1 + VISTA MOSAICO DE 6 A 8 FOTOS
// ------------------------------------------------------------------------------
function mostrarFotoIndividualEnPantalla(indice) {
    // Filtrar cualquier foto cuya URL haya fallado previamente para jamás mostrar ícono roto
    fotosAprobadasCache = fotosAprobadasCache.filter((f) => {
        const u = (f.url_con_marca || f.url_original || "").trim();
        return Boolean(u) && !urlsFotosInvalidas.has(u);
    });

    if (!fotosAprobadasCache.length) {
        galeriaContenedorFotoActivaEl.classList.add("hidden");
        galeriaContenedorMosaicoEl.classList.add("hidden");
        galeriaAutorCapsulaEl.classList.add("hidden");
        galeriaEstadoVacioEl.classList.remove("hidden");
        galeriaCapaBlurFondoEl.style.backgroundImage = "none";
        idFotoMostradaActual = "";
        return;
    }

    mostrandoMosaicoEnCiclo = false;
    galeriaEstadoVacioEl.classList.add("hidden");
    galeriaContenedorMosaicoEl.classList.add("hidden");
    galeriaContenedorFotoActivaEl.classList.remove("hidden");
    galeriaAutorCapsulaEl.classList.remove("hidden");

    const idxSeguro =
        ((indice % fotosAprobadasCache.length) + fotosAprobadasCache.length) %
        fotosAprobadasCache.length;
    indiceCarruselActual = idxSeguro;

    const foto = fotosAprobadasCache[idxSeguro];
    const urlFoto = (foto.url_con_marca || foto.url_original || "").trim();
    const invitado = foto.invitados || {};
    const nombreInvitado = invitado.nombre || "Invitado";
    const avatarInvitado = invitado.avatar || "pug_real|corona_imperial";

    // Actualizar cápsula compacta esquina inferior izquierda ("En vivo por [Nombre]")
    galeriaAutorNombreEl.textContent = nombreInvitado;
    galeriaAutorAvatarEl.innerHTML = generarSvgAvatarCompuesto(avatarInvitado);

    // Si es la misma foto que ya está activa en pantalla, no repetir animación
    if (
        idFotoMostradaActual === foto.id &&
        galeriaImgNitidaEl.getAttribute("src") === urlFoto
    ) {
        return;
    }
    idFotoMostradaActual = foto.id;

    // CAPA 1: Fondo Desenfocado (Ambient Blur 100vw x 100vh)
    galeriaCapaBlurFondoEl.style.backgroundImage = `url("${urlFoto}")`;

    // CAPA 2: Transición fluida (opacity + transform: scale) y detección de orientación Horizontal/Vertical
    const targetAnimacion = galeriaMarcoWrapperEl || galeriaImgNitidaEl;
    targetAnimacion.classList.add("transicion-foto");
    setTimeout(() => {
        /* === [EDITAR TAMAÑO DE FOTOS HORIZONTALES Y VERTICALES AQUÍ] === */
        // Al cargar cada foto proyectada (img.onload), detecta automáticamente si es
        // horizontal (naturalWidth > naturalHeight) o vertical, y aplica la clase CSS
        // .foto-proyector-horizontal o .foto-proyector-vertical cuyas dimensiones están en proyector.css (:root).
        galeriaImgNitidaEl.onload = () => {
            const esHorizontal =
                galeriaImgNitidaEl.naturalWidth > galeriaImgNitidaEl.naturalHeight;
            galeriaImgNitidaEl.classList.toggle("foto-proyector-horizontal", esHorizontal);
            galeriaImgNitidaEl.classList.toggle("foto-proyector-vertical", !esHorizontal);
            if (galeriaMarcoWrapperEl) {
                galeriaMarcoWrapperEl.classList.toggle("foto-proyector-horizontal", esHorizontal);
                galeriaMarcoWrapperEl.classList.toggle("foto-proyector-vertical", !esHorizontal);
            }
            targetAnimacion.classList.remove("transicion-foto");
        };

        // Si alguna URL antigua falla (onerror), la descarta limpiamente y pasa a la siguiente foto válida
        galeriaImgNitidaEl.onerror = () => {
            if (urlFoto) {
                urlsFotosInvalidas.add(urlFoto);
            }
            idFotoMostradaActual = "";
            fotosAprobadasCache = fotosAprobadasCache.filter(
                (f) => f.id !== foto.id && !urlsFotosInvalidas.has((f.url_con_marca || f.url_original || "").trim())
            );
            mostrarFotoIndividualEnPantalla(indiceCarruselActual);
        };

        galeriaImgNitidaEl.src = urlFoto;
        setTimeout(() => targetAnimacion.classList.remove("transicion-foto"), 180);
    }, 220);
}

function mostrarVistaMosaico6a8() {
    if (!fotosAprobadasCache.length) {
        mostrarFotoIndividualEnPantalla(0);
        return;
    }

    mostrandoMosaicoEnCiclo = true;
    idFotoMostradaActual = "__MOSAICO__";
    galeriaEstadoVacioEl.classList.add("hidden");
    galeriaContenedorFotoActivaEl.classList.add("hidden");
    galeriaContenedorMosaicoEl.classList.remove("hidden");
    galeriaAutorCapsulaEl.classList.remove("hidden");

    // Seleccionar entre 6 y 8 fotos aprobadas para el mural
    const totalDisponibles = fotosAprobadasCache.length;
    const cantidadObjetivo = totalDisponibles >= 8 ? 8 : Math.min(totalDisponibles, 6);
    const seleccionMosaico = [];

    for (let i = 0; i < Math.max(1, cantidadObjetivo); i++) {
        const idx = (offsetMosaicoActual + i) % totalDisponibles;
        seleccionMosaico.push(fotosAprobadasCache[idx]);
    }
    offsetMosaicoActual = (offsetMosaicoActual + seleccionMosaico.length) % totalDisponibles;

    // Usar la primera foto del lote para el Ambient Blur de fondo
    const urlFondo =
        seleccionMosaico[0]?.url_con_marca || seleccionMosaico[0]?.url_original || "";
    if (urlFondo) {
        galeriaCapaBlurFondoEl.style.backgroundImage = `url("${urlFondo}")`;
    }

    // Ajustar grilla (3x2 cuando son <=6 fotos, 4x2 cuando son 7 u 8 fotos)
    if (seleccionMosaico.length <= 6) {
        galeriaGridMosaicoEl.classList.add("mosaico-6-items");
    } else {
        galeriaGridMosaicoEl.classList.remove("mosaico-6-items");
    }

    galeriaGridMosaicoEl.innerHTML = seleccionMosaico
        .map((foto, idx) => {
            const url = foto.url_con_marca || foto.url_original || "";
            const autor = foto.invitados?.nombre || "Invitado";
            const delayMs = idx * 65;
            /* === [EDITAR MARCA DE AGUA LOGO SEGALÚ AQUÍ] === */
            return `
                <div class="mosaico-item-card" style="animation-delay: ${delayMs}ms;">
                    <div class="mosaico-item-blur" style="background-image: url('${url}');"></div>
                    <img class="mosaico-item-img" src="${url}" alt="" onerror="const c = this.closest('.mosaico-item-card'); if(c) c.style.display='none';" />
                    <div class="mosaico-item-overlay-marca" aria-hidden="true">
                        <img src="/static/img/logo_segalu.png" alt="Segalú" class="mosaico-logo-mini" onerror="this.style.display='none'" />
                    </div>
                    <div class="mosaico-item-autor">
                        <span>📸 ${escaparHtml(autor)}</span>
                    </div>
                </div>
            `;
        })
        .join("");

    // Cápsula inferior izquierda discreta durante el mosaico
    galeriaAutorAvatarEl.innerHTML = generarSvgAvatarCompuesto("leon_imperial|corona_imperial");
    galeriaAutorNombreEl.textContent = `Mosaico del Evento (${seleccionMosaico.length} fotos)`;
}

function avanzarPasoGaleria() {
    if (modoProyectorActual !== "GALERIA") return;
    const total = fotosAprobadasCache.length;
    if (total === 0) {
        mostrarFotoIndividualEnPantalla(0);
        return;
    }

    // Modo 1: Solo Mosaico (6 a 8 fotos)
    if (modoGaleriaConfig === "mosaico") {
        mostrarVistaMosaico6a8();
        return;
    }

    // Modo 2: Solo Foto Individual (Carrusel 1x1)
    if (modoGaleriaConfig === "individual" || total === 1) {
        mostrarFotoIndividualEnPantalla(indiceCarruselActual + 1);
        return;
    }

    // Modo 3: Ciclo Automático (Pasa las fotos 1 por 1 y al terminar la vuelta muestra el mosaico de 6 a 8 fotos)
    if (mostrandoMosaicoEnCiclo) {
        indiceCarruselActual = 0;
        mostrarFotoIndividualEnPantalla(0);
        return;
    }

    const siguienteIndice = indiceCarruselActual + 1;
    if (siguienteIndice >= total && total >= 2) {
        // Terminó de pasar todas las fotos individuales -> mostrar el Mosaico de 6 a 8 fotos
        mostrarVistaMosaico6a8();
    } else {
        mostrarFotoIndividualEnPantalla(siguienteIndice);
    }
}

function reiniciarTemporizadorGaleria() {
    if (temporizadorCarruselGaleria) {
        clearInterval(temporizadorCarruselGaleria);
        temporizadorCarruselGaleria = null;
    }
    const ms = Math.max(3000, Number(duracionFotoSegundos || 8) * 1000);
    temporizadorCarruselGaleria = setInterval(avanzarPasoGaleria, ms);
}

function aplicarConfiguracionGaleriaEnVivo(nuevoModo, nuevaDuracion) {
    const modoNormalizado = ["ciclo_auto", "individual", "mosaico"].includes(nuevoModo)
        ? nuevoModo
        : "ciclo_auto";
    const duracionNormalizada = [5, 8, 12].includes(Number(nuevaDuracion))
        ? Number(nuevaDuracion)
        : 8;

    const cambioModo = modoNormalizado !== modoGaleriaConfig;
    const cambioDuracion = duracionNormalizada !== duracionFotoSegundos;

    modoGaleriaConfig = modoNormalizado;
    duracionFotoSegundos = duracionNormalizada;

    if (cambioDuracion || !temporizadorCarruselGaleria) {
        reiniciarTemporizadorGaleria();
    }

    if (cambioModo && modoProyectorActual === "GALERIA" && fotosAprobadasCache.length > 0) {
        if (modoGaleriaConfig === "mosaico") {
            mostrarVistaMosaico6a8();
        } else {
            mostrarFotoIndividualEnPantalla(indiceCarruselActual);
        }
    }
}

function sincronizarModoGaleria(fotosServidor, configServidor) {
    if (configServidor) {
        aplicarConfiguracionGaleriaEnVivo(
            configServidor.modo_galeria,
            configServidor.duracion_foto_segundos
        );
    } else if (!temporizadorCarruselGaleria) {
        reiniciarTemporizadorGaleria();
    }

    const soloAprobadas = (fotosServidor || []).filter((f) => {
        if (String(f.estado_moderacion || "").toLowerCase() !== "aprobado") return false;
        const u = (f.url_con_marca || f.url_original || "").trim();
        return Boolean(u) && !urlsFotosInvalidas.has(u);
    });

    const idsPrevios = fotosAprobadasCache.map((f) => f.id).join(",");
    const idsNuevos = soloAprobadas.map((f) => f.id).join(",");
    fotosAprobadasCache = soloAprobadas;

    if (!fotosAprobadasCache.length) {
        mostrarFotoIndividualEnPantalla(0);
        return;
    }

    if (idsPrevios !== idsNuevos) {
        // Si acaba de aprobarse una foto nueva, mostrarla al instante
        idFotoMostradaActual = "";
        indiceCarruselActual = 0;
        if (modoGaleriaConfig === "mosaico") {
            offsetMosaicoActual = 0;
            mostrarVistaMosaico6a8();
        } else {
            mostrarFotoIndividualEnPantalla(0);
        }
        reiniciarTemporizadorGaleria();
    } else if (!idFotoMostradaActual) {
        if (modoGaleriaConfig === "mosaico") {
            mostrarVistaMosaico6a8();
        } else {
            mostrarFotoIndividualEnPantalla(indiceCarruselActual);
        }
    }
}

// ------------------------------------------------------------------------------
// 4. MODO LOBBY_KAHOOT (INVITADOS UNIÉNDOSE CON MUÑEQUITOS Y ACCESORIOS)
// ------------------------------------------------------------------------------
function renderizarModoLobbyKahoot(invitados) {
    const lista = invitados || [];
    lobbyNumeroJugadoresEl.textContent = String(lista.length);

    // Sistema de auto-escalado dinámico estilo Kahoot según cantidad de conectados
    lobbyGridAvataresEl.classList.remove("grid-scale-lg", "grid-scale-md", "grid-scale-sm", "grid-scale-xs", "grid-scale-xxs");
    if (lista.length <= 12) {
        lobbyGridAvataresEl.classList.add("grid-scale-lg");
    } else if (lista.length <= 28) {
        lobbyGridAvataresEl.classList.add("grid-scale-md");
    } else if (lista.length <= 64) {
        lobbyGridAvataresEl.classList.add("grid-scale-sm");
    } else if (lista.length <= 96) {
        lobbyGridAvataresEl.classList.add("grid-scale-xs");
    } else {
        lobbyGridAvataresEl.classList.add("grid-scale-xxs");
    }

    const firma = lista.map((i) => `${i.id}:${i.nombre}:${i.avatar}`).join("|");
    if (firma === firmaLobbyRenderizado) return;
    firmaLobbyRenderizado = firma;

    if (!lista.length) {
        lobbyGridAvataresEl.innerHTML = `
            <div class="lobby-jugador-card" style="grid-column: 1 / -1; justify-content: center; padding: 28px;">
                <span style="font-size: 1.35rem; font-weight: 700; color: #CBD5E1;">
                    📱 Toca "Jugar Ronda de Preguntas" en tu celular para aparecer en la pista con tu muñequito...
                </span>
            </div>
        `;
        return;
    }

    // Sin limitador artificial de 28 jugadores y SIN texto de puntaje "0 pts"
    lobbyGridAvataresEl.innerHTML = lista
        .map(
            (inv) => `
            <div class="lobby-jugador-card">
                <div class="lobby-jugador-avatar">
                    ${generarSvgAvatarCompuesto(inv.avatar)}
                </div>
                <div class="lobby-jugador-info">
                    <strong class="lobby-jugador-nombre">${escaparHtml(inv.nombre || "Invitado")}</strong>
                </div>
            </div>
        `
        )
        .join("");
}

// ------------------------------------------------------------------------------
// 5. MODOS PREGUNTA_ACTIVA Y RESULTADOS_PREGUNTA (GRÁFICO DE BARRAS KAHOOT)
// ------------------------------------------------------------------------------
let temporizadorLocalPregunta = null;
let idPreguntaActivaTimer = null;
let segundosRestantesLocales = 0;
let limiteSegundosLocal = 20;
let instanteFinPreguntaMs = 0;

function detenerTemporizadorLocalPregunta() {
    if (temporizadorLocalPregunta) {
        clearInterval(temporizadorLocalPregunta);
        temporizadorLocalPregunta = null;
    }
}

/**
 * Temporizador local fluido: se ancla a un instante de fin calculado UNA sola vez
 * (performance.now) y avanza con setInterval de 1 s. Al calcular el valor desde el
 * reloj monotónico no acumula deriva aunque el navegador retrase algún tick.
 */
function iniciarTemporizadorLocalPregunta(segundosIniciales, limiteSeg) {
    detenerTemporizadorLocalPregunta();
    limiteSegundosLocal = Math.max(1, limiteSeg || 20);
    segundosRestantesLocales = Math.min(limiteSegundosLocal, Math.round(segundosIniciales));
    instanteFinPreguntaMs = performance.now() + segundosRestantesLocales * 1000;
    actualizarGraficoReloj(segundosRestantesLocales, limiteSegundosLocal);

    temporizadorLocalPregunta = setInterval(() => {
        const restantes = Math.max(0, Math.round((instanteFinPreguntaMs - performance.now()) / 1000));
        if (restantes !== segundosRestantesLocales) {
            segundosRestantesLocales = restantes;
            actualizarGraficoReloj(segundosRestantesLocales, limiteSegundosLocal);
        }
        if (restantes <= 0) detenerTemporizadorLocalPregunta();
    }, 1000);
}

function actualizarGraficoReloj(restantesSeg, limiteSeg) {
    const lim = Math.max(1, limiteSeg || 20);
    const rest = Math.max(0, Math.min(lim, restantesSeg));
    kahootSegundosNumeroEl.textContent = String(rest);

    const circunferencia = 377;
    const proporcion = Math.max(0, Math.min(1, rest / lim));
    const offset = circunferencia * (1 - proporcion);
    kahootRelojProgresoEl.style.strokeDashoffset = String(offset.toFixed(1));

    if (rest <= 5) {
        kahootRelojCirculoEl.classList.add("urgente");
    } else {
        kahootRelojCirculoEl.classList.remove("urgente");
    }
}

function renderizarModoPreguntaYResultados(pregunta, modo) {
    if (!pregunta) return;

    const orden = Number(pregunta.orden || 1);
    const totalPreguntas = Math.max(orden, Number(pregunta.total_preguntas || 1));
    const limiteSeg = Math.max(1, Number(pregunta.tiempo_limite_segundos || 20));
    const totalRespuestas = Number(pregunta.total_respuestas || 0);
    const esResultados = modo === "RESULTADOS_PREGUNTA" || Boolean(pregunta.ronda_cerrada);
    const correcta = String(pregunta.respuesta_correcta || "A").trim().toUpperCase();

    kahootBadgeNumeroPreguntaEl.textContent = `PREGUNTA ${orden} DE ${totalPreguntas}`;
    kahootTextoEnunciadoEl.textContent = pregunta.enunciado || "";
    kahootNumeroRespuestasEl.textContent = String(totalRespuestas);

    if (esResultados) {
        detenerTemporizadorLocalPregunta();
        idPreguntaActivaTimer = null;
        segundosRestantesLocales = 0;
        actualizarGraficoReloj(0, limiteSeg);
    } else if (idPreguntaActivaTimer !== pregunta.id) {
        // Al renderizarse la pregunta en pantalla gigante, el contador arranca exactamente
        // desde el total configurado (ej: 20s) sin desfase por latencia de red ni tirones.
        idPreguntaActivaTimer = pregunta.id;
        iniciarTemporizadorLocalPregunta(limiteSeg, limiteSeg);
    }

    const opciones = ["A", "B", "C", "D"];
    const camposTexto = {
        A: pregunta.opcion_a,
        B: pregunta.opcion_b,
        C: pregunta.opcion_c,
        D: pregunta.opcion_d,
    };

    opciones.forEach((letra) => {
        const tarjetaEl = document.getElementById(`tarjeta-proyector-${letra}`);
        const textoEl = document.getElementById(`texto-opcion-proyector-${letra}`);
        const checkEl = document.getElementById(`indicador-correcta-${letra}`);

        if (textoEl) textoEl.textContent = camposTexto[letra] || `Opción ${letra}`;

        if (!esResultados) {
            tarjetaEl.classList.remove("opcion-correcta-iluminada", "opcion-incorrecta-atenuada");
            checkEl.classList.add("hidden");
        } else if (letra === correcta) {
            tarjetaEl.classList.add("opcion-correcta-iluminada");
            tarjetaEl.classList.remove("opcion-incorrecta-atenuada");
            checkEl.classList.remove("hidden");
        } else {
            tarjetaEl.classList.add("opcion-incorrecta-atenuada");
            tarjetaEl.classList.remove("opcion-correcta-iluminada");
            checkEl.classList.add("hidden");
        }
    });

    if (!esResultados) {
        kahootBadgeEstadoRondaEl.textContent = "⏱️ RESPONDE AHORA EN TU CELULAR";
        kahootCentroEsperandoEl.classList.remove("hidden");
        kahootCentroGraficoBarrasEl.classList.add("hidden");
    } else {
        kahootBadgeEstadoRondaEl.textContent = `✅ TIEMPO FINALIZADO · RESPUESTA CORRECTA: OPCIÓN ${correcta}`;
        kahootCentroEsperandoEl.classList.add("hidden");
        kahootCentroGraficoBarrasEl.classList.remove("hidden");

        const conteo = pregunta.conteo_opciones || { A: 0, B: 0, C: 0, D: 0 };
        const maxVotos = Math.max(1, conteo.A || 0, conteo.B || 0, conteo.C || 0, conteo.D || 0);

        opciones.forEach((letra) => {
            const votos = Number(conteo[letra] || 0);
            const alturaPorcentaje =
                votos === 0 ? 8 : Math.max(16, Math.round((votos / maxVotos) * 100));

            const colEl = document.getElementById(`col-barra-${letra}`);
            const checkBarraEl = document.getElementById(`check-barra-${letra}`);
            const votosBarraEl = document.getElementById(`votos-barra-${letra}`);
            const rellenoBarraEl = document.getElementById(`relleno-barra-${letra}`);

            if (votosBarraEl) votosBarraEl.textContent = String(votos);
            if (rellenoBarraEl) rellenoBarraEl.style.height = `${alturaPorcentaje}%`;

            if (letra === correcta) {
                colEl.classList.add("columna-ganadora");
                colEl.classList.remove("columna-atenuada");
                checkBarraEl.classList.remove("hidden");
            } else {
                colEl.classList.remove("columna-ganadora");
                colEl.classList.add("columna-atenuada");
                checkBarraEl.classList.add("hidden");
            }
        });
    }
}

// ------------------------------------------------------------------------------
// 6. MODO PODIO DE GALA SECUENCIAL (3° DERECHA -> 2° IZQUIERDA -> 1° CENTRO)
// ------------------------------------------------------------------------------
const canvasFuegosEl = document.getElementById("canvas-fuegos-proyector");
const ctxFuegos = canvasFuegosEl ? canvasFuegosEl.getContext("2d") : null;
let particulasFuegos = [];
let animacionFuegosActiva = false;

function redimensionarCanvasFuegos() {
    if (!canvasFuegosEl) return;
    canvasFuegosEl.width = window.innerWidth || 1920;
    canvasFuegosEl.height = window.innerHeight || 1080;
}
window.addEventListener("resize", redimensionarCanvasFuegos);
redimensionarCanvasFuegos();

function crearExplosionFuegoArtificial(x, y, paletaColores) {
    const colores = paletaColores || [
        "#F5D77F",
        "#D4AF37",
        "#FFF6D6",
        "#E21B3C",
        "#1368CE",
        "#26890C",
    ];
    const cantidad = 56;
    for (let i = 0; i < cantidad; i++) {
        const angulo = (Math.PI * 2 * i) / cantidad + (Math.random() - 0.5) * 0.15;
        const velocidad = 2.6 + Math.random() * 6.8;
        particulasFuegos.push({
            x,
            y,
            vx: Math.cos(angulo) * velocidad,
            vy: Math.sin(angulo) * velocidad - 1.2,
            alpha: 1,
            decay: 0.012 + Math.random() * 0.012,
            radio: 2.4 + Math.random() * 2.8,
            color: colores[i % colores.length],
        });
    }
    if (!animacionFuegosActiva) {
        animacionFuegosActiva = true;
        requestAnimationFrame(bucleFuegos60Fps);
    }
}

function bucleFuegos60Fps() {
    if (!ctxFuegos || !canvasFuegosEl) return;
    ctxFuegos.clearRect(0, 0, canvasFuegosEl.width, canvasFuegosEl.height);

    particulasFuegos = particulasFuegos.filter((p) => p.alpha > 0.03);
    for (const p of particulasFuegos) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.11;
        p.vx *= 0.985;
        p.alpha -= p.decay;

        ctxFuegos.save();
        ctxFuegos.globalAlpha = Math.max(0, p.alpha);
        ctxFuegos.fillStyle = p.color;
        ctxFuegos.shadowColor = p.color;
        ctxFuegos.shadowBlur = 10;
        ctxFuegos.beginPath();
        ctxFuegos.arc(p.x, p.y, p.radio, 0, Math.PI * 2);
        ctxFuegos.fill();
        ctxFuegos.restore();
    }

    if (particulasFuegos.length > 0) {
        requestAnimationFrame(bucleFuegos60Fps);
    } else {
        animacionFuegosActiva = false;
        ctxFuegos.clearRect(0, 0, canvasFuegosEl.width, canvasFuegosEl.height);
    }
}

function dispararDestelloPeldaño(origenX, colores) {
    const w = window.innerWidth || 1920;
    const h = window.innerHeight || 1080;
    crearExplosionFuegoArtificial(w * origenX, h * 0.36, colores);

    if (typeof window.confetti === "function") {
        window.confetti({
            particleCount: 55,
            spread: 68,
            origin: { x: origenX, y: 0.58 },
            colors: colores,
        });
    }
}

function lanzarGranCelebracionCampeon() {
    const coloresGala = ["#F5D77F", "#D4AF37", "#FFF8DC", "#E21B3C", "#1368CE", "#26890C"];
    dispararDestelloPeldaño(0.5, coloresGala);
    setTimeout(() => dispararDestelloPeldaño(0.24, coloresGala), 350);
    setTimeout(() => dispararDestelloPeldaño(0.76, coloresGala), 700);
    setTimeout(() => dispararDestelloPeldaño(0.5, coloresGala), 1150);

    if (intervaloCelebracionCampeon) clearInterval(intervaloCelebracionCampeon);
    let rafagas = 0;
    intervaloCelebracionCampeon = setInterval(() => {
        if (modoProyectorActual !== "PODIO" || rafagas >= 6) {
            clearInterval(intervaloCelebracionCampeon);
            intervaloCelebracionCampeon = null;
            return;
        }
        rafagas += 1;
        const posX = 0.2 + Math.random() * 0.6;
        dispararDestelloPeldaño(posX, coloresGala);
    }, 1800);
}

function detenerSecuenciaFuegosPodio() {
    timeoutsSecuenciaPodio.forEach((t) => clearTimeout(t));
    timeoutsSecuenciaPodio = [];
    if (intervaloCelebracionCampeon) {
        clearInterval(intervaloCelebracionCampeon);
        intervaloCelebracionCampeon = null;
    }
    particulasFuegos = [];
    firmaPodioSecuenciaActual = "";
}

function renderizarModoPodioSecuencial(podioLista) {
    const top = podioLista || [];
    const primero = top[0] || {
        nombre: "1° Campeón",
        avatar: "leon_imperial|corona_imperial",
        puntaje_total: 0,
    };
    const segundo = top[1] || {
        nombre: "2° Puesto",
        avatar: "gatito_gala|corbatin_dorado",
        puntaje_total: 0,
    };
    const tercero = top[2] || {
        nombre: "3° Puesto",
        avatar: "pug_real|lentes_vip",
        puntaje_total: 0,
    };

    avatarPodio1El.innerHTML = generarSvgAvatarCompuesto(primero.avatar);
    nombrePodio1El.textContent = primero.nombre || "1° Campeón";
    puntosPodio1El.textContent = String(Number(primero.puntaje_total || 0));

    avatarPodio2El.innerHTML = generarSvgAvatarCompuesto(segundo.avatar);
    nombrePodio2El.textContent = segundo.nombre || "2° Puesto";
    puntosPodio2El.textContent = String(Number(segundo.puntaje_total || 0));

    avatarPodio3El.innerHTML = generarSvgAvatarCompuesto(tercero.avatar);
    nombrePodio3El.textContent = tercero.nombre || "3° Puesto";
    puntosPodio3El.textContent = String(Number(tercero.puntaje_total || 0));

    const menciones = top.slice(3, 5);
    if (menciones.length > 0) {
        podioMencionesBarraEl.classList.remove("hidden");
        podioMencionesBarraEl.innerHTML = menciones
            .map(
                (inv, idx) =>
                    `<span>🏅 <strong>#${idx + 4} ${escaparHtml(inv.nombre)}</strong> (${Number(inv.puntaje_total || 0)} pts)</span>`
            )
            .join("<span>·</span>");
    } else {
        podioMencionesBarraEl.classList.add("hidden");
    }

    const firmaPodio = `${primero.id || primero.nombre}:${primero.puntaje_total}|${segundo.id || segundo.nombre}:${segundo.puntaje_total}|${tercero.id || tercero.nombre}:${tercero.puntaje_total}`;
    if (firmaPodio === firmaPodioSecuenciaActual) return;
    firmaPodioSecuenciaActual = firmaPodio;

    timeoutsSecuenciaPodio.forEach((t) => clearTimeout(t));
    timeoutsSecuenciaPodio = [];

    columnaPodio3El.classList.remove("podio-revelado");
    columnaPodio2El.classList.remove("podio-revelado");
    columnaPodio1El.classList.remove("podio-revelado");
    columnaPodio3El.classList.add("podio-oculto");
    columnaPodio2El.classList.add("podio-oculto");
    columnaPodio1El.classList.add("podio-oculto");

    podioTituloPrincipalEl.textContent = "¡PODIO OFICIAL DE CAMPEONES!";
    podioSubtituloEl.textContent = "🥁 Revelando el 3er Puesto en la derecha...";

    // PASO 1 (DERECHA): 3er Puesto
    timeoutsSecuenciaPodio.push(
        setTimeout(() => {
            columnaPodio3El.classList.remove("podio-oculto");
            columnaPodio3El.classList.add("podio-revelado");
            podioSubtituloEl.textContent = `🥉 3° Puesto: ¡${tercero.nombre}! · Preparando el 2do Puesto...`;
            dispararDestelloPeldaño(0.78, ["#F3C6A4", "#D4AF37", "#FFF3E8"]);
        }, 280)
    );

    // PASO 2 (IZQUIERDA): 2do Puesto
    timeoutsSecuenciaPodio.push(
        setTimeout(() => {
            columnaPodio2El.classList.remove("podio-oculto");
            columnaPodio2El.classList.add("podio-revelado");
            podioSubtituloEl.textContent = `🥈 2° Puesto: ¡${segundo.nombre}! · ¿Quién se lleva la corona de oro?`;
            dispararDestelloPeldaño(0.22, ["#F1F5F9", "#94A3B8", "#F5D77F"]);
        }, 1850)
    );

    // PASO 3 (CENTRO): 1er Puesto + Explosiones de Fuegos Artificiales y Confeti
    timeoutsSecuenciaPodio.push(
        setTimeout(() => {
            columnaPodio1El.classList.remove("podio-oculto");
            columnaPodio1El.classList.add("podio-revelado");
            podioTituloPrincipalEl.textContent = `👑 ¡FELICITACIONES ${String(primero.nombre || "CAMPEÓN").toUpperCase()}!`;
            podioSubtituloEl.textContent = `🏆 1° Puesto Absoluto de la Gala Segalú con ${Number(primero.puntaje_total || 0)} puntos`;
            lanzarGranCelebracionCampeon();
        }, 3550)
    );
}

// ------------------------------------------------------------------------------
// 6.5. MODO RANKING / TABLA DE POSICIONES EN VIVO ESTILO KAHOOT
// ------------------------------------------------------------------------------
let firmaRankingRenderizado = "";

function renderizarModoRanking(rankingLista) {
    if (!rankingFilasContenedorEl) return;
    const lista = (rankingLista || []).slice(0, 6);

    const firma = lista
        .map((i) => `${i.id}:${i.nombre}:${i.puntaje_total}:${i.delta_posicion}:${i.posicion}`)
        .join("|");
    if (firma === firmaRankingRenderizado) return;
    firmaRankingRenderizado = firma;

    if (!lista.length) {
        rankingFilasContenedorEl.innerHTML = `
            <div class="ranking-fila-card" style="justify-content: center; padding: 24px;">
                <span style="color: #94A3B8; font-weight: 700;">Aún no hay puntajes registrados en esta ronda.</span>
            </div>
        `;
        return;
    }

    rankingFilasContenedorEl.innerHTML = lista
        .map((inv, idx) => {
            const puesto = Number(inv.posicion || idx + 1);
            const delta = Number(inv.delta_posicion || 0);
            const claseTop = puesto === 1 ? "top-1" : puesto === 2 ? "top-2" : puesto === 3 ? "top-3" : "";

            let deltaHtml = "";
            if (delta > 0) {
                // Subió puestos: flecha minimalista blanca sin números
                deltaHtml = `<span class="ranking-delta-pill delta-up" title="Subió de posición" aria-label="Subió de posición">▲</span>`;
            } else if (delta < 0) {
                // Bajó puestos: flecha minimalista plomo/gris sin números
                deltaHtml = `<span class="ranking-delta-pill delta-down" title="Bajó de posición" aria-label="Bajó de posición">▼</span>`;
            } else {
                // Mantuvo el puesto: indicador neutral plomo sin números
                deltaHtml = `<span class="ranking-delta-pill delta-equal" title="Mantiene posición" aria-label="Mantiene posición">—</span>`;
            }

            return `
                <div class="ranking-fila-card ${claseTop}" style="animation-delay: ${idx * 60}ms;">
                    <div class="ranking-fila-izq">
                        <div class="ranking-posicion-circulo">${puesto}</div>
                        <div class="ranking-avatar-contenedor">
                            ${generarSvgAvatarCompuesto(inv.avatar)}
                        </div>
                        <strong class="ranking-nombre-texto">${escaparHtml(inv.nombre || "Invitado")}</strong>
                    </div>
                    <div class="ranking-fila-der">
                        ${deltaHtml}
                        <div class="ranking-puntos-caja">
                            <strong>${Number(inv.puntaje_total || 0).toLocaleString()}</strong>
                            <span>pts</span>
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");
}

// ------------------------------------------------------------------------------
// 7. SINCRONIZACIÓN INSTANTÁNEA (BROADCASTCHANNEL + POLLING CADA 1 SEGUNDO)
// ------------------------------------------------------------------------------
let idEventoProyectado = "";

function escaparHtml(texto) {
    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

if (typeof BroadcastChannel !== "undefined") {
    const canalSync = new BroadcastChannel("segalu_proyector_sync");
    canalSync.onmessage = (ev) => {
        const msg = ev.data || {};
        // Aislamiento Multi-Sede: si el mensaje pertenece a otro evento, no interferir
        if (msg.evento_id && idEventoProyectado && msg.evento_id !== idEventoProyectado) {
            return;
        }

        if (msg.tipo === "CONFIG_GALERIA") {
            aplicarConfiguracionGaleriaEnVivo(msg.modo_galeria, msg.duracion_foto_segundos);
        } else if (msg.tipo === "ACCION_TRIVIA") {
            if (msg.accion === "cerrar_trivia") {
                activarVistaModo("GALERIA");
                sincronizarModoGaleria(fotosAprobadasCache, null);
            }
            sincronizarEstadoProyector();
        } else if (msg.tipo === "AVATAR_ACTUALIZADO") {
            firmaLobbyRenderizado = "";
            sincronizarEstadoProyector();
        } else if (msg.tipo === "ACCESORIOS_ACTUALIZADOS") {
            cargarAccesoriosProyector();
        }
    };
}

window.addEventListener("storage", (e) => {
    if (e.key === "segalu_modo_galeria" || e.key === "segalu_duracion_foto") {
        aplicarConfiguracionGaleriaEnVivo(
            localStorage.getItem("segalu_modo_galeria") || modoGaleriaConfig,
            Number(localStorage.getItem("segalu_duracion_foto") || duracionFotoSegundos)
        );
    }
});

let consultaProyectorEnCurso = false;

async function sincronizarEstadoProyector() {
    if (consultaProyectorEnCurso) return;
    consultaProyectorEnCurso = true;

    try {
        const params = new URLSearchParams(window.location.search);
        const query = new URLSearchParams();
        if (params.get("evento_id")) query.set("evento_id", params.get("evento_id"));
        if (params.get("codigo")) query.set("codigo", params.get("codigo"));
        if (params.get("sede")) query.set("sede", params.get("sede"));
        if (params.get("local_id")) query.set("local_id", params.get("local_id"));

        const url = query.toString()
            ? `/api/proyector/estado?${query.toString()}`
            : `/api/proyector/estado`;

        const controlador = new AbortController();
        const temporizadorAbort = setTimeout(() => controlador.abort(), 5000);
        const res = await fetch(url, { cache: "no-store", signal: controlador.signal });
        clearTimeout(temporizadorAbort);
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.evento) return;

        idEventoProyectado = data.evento.id || "";

        if (data.catalogo_accesorios && typeof data.catalogo_accesorios === "object") {
            Object.assign(catalogoAccesoriosProyector, data.catalogo_accesorios);
        }

        const modo = data.modo_proyector || "GALERIA";
        activarVistaModo(modo);

        if (modo === "GALERIA") {
            sincronizarModoGaleria(data.fotos_aprobadas || [], data.config_galeria);
        } else if (modo === "LOBBY_KAHOOT") {
            renderizarModoLobbyKahoot(data.invitados || []);
        } else if (modo === "PREGUNTA_ACTIVA" || modo === "RESULTADOS_PREGUNTA") {
            renderizarModoPreguntaYResultados(data.pregunta_activa, modo);
        } else if (modo === "RANKING") {
            renderizarModoRanking(data.ranking || data.podio || []);
        } else if (modo === "PODIO") {
            renderizarModoPodioSecuencial(data.podio || []);
        }
    } catch (_) {
        // Silencioso para fluidez continua
    } finally {
        consultaProyectorEnCurso = false;
    }
}

// Sondeo ligero, secuencial y adaptativo (nunca se solapan peticiones). El reloj de la
// pregunta NO depende de este ciclo: corre localmente, así que se puede sondear con calma.
const INTERVALO_SONDEO_POR_MODO_MS = {
    GALERIA: 3000,
    LOBBY_KAHOOT: 1500,
    PREGUNTA_ACTIVA: 2000,
    RESULTADOS_PREGUNTA: 2000,
    RANKING: 2500,
    PODIO: 3000,
};

async function cicloSondeoProyector() {
    await sincronizarEstadoProyector();
    const espera = document.hidden
        ? 6000
        : INTERVALO_SONDEO_POR_MODO_MS[modoProyectorActual] || 2000;
    setTimeout(cicloSondeoProyector, espera);
}

cargarAccesoriosProyector();
cicloSondeoProyector();
