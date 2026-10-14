/**
 * =========================================================
 *  Barra de Salud v2 — Minecraft Bedrock Edition
 *  Script API ESTABLE (@minecraft/server 2.3.0): no necesita
 *  activar "Beta APIs" ni ningún otro experimento en el mundo.
 * =========================================================
 *
 *  Muestra una barra de vida sobre el mob que estás mirando
 *  o que acaba de recibir daño:
 *
 *      Bobby
 *      ❤ ||||||||||||||||||||  14/20
 *
 *  La barra es temporal: a los pocos segundos el mob recupera
 *  su nombre original (o se queda sin nombre). Así no se
 *  renombran todos los mobs del mundo para siempre, que era el
 *  problema de la v1 (además de depender de Beta APIs).
 *
 *  Color según el porcentaje de vida:
 *      §a  verde     > 66%
 *      §e  amarillo  > 33%
 *      §c  rojo      ≤ 33%
 */

import { world, system } from "@minecraft/server";

// ── Configuración ──────────────────────────────────────────
const CONFIG = {
  /** Logs de diagnóstico en la consola del servidor. */
  debug: false,

  /** Cuánto se ve la barra después de recibir daño (20 ticks = 1 s). */
  duracionDanoTicks: 100,

  /** Mostrar la barra del mob al que el jugador está mirando. */
  mostrarAlMirar: true,

  /** Cuánto se ve la barra después de dejar de mirar al mob. */
  duracionMiradaTicks: 40,

  /** Distancia máxima (en bloques) para detectar el mob mirado. */
  distanciaMirada: 16,

  /** Cada cuántos ticks se revisa a qué mira cada jugador. */
  intervaloMiradaTicks: 4,

  /** Cada cuántos ticks se actualizan las barras visibles (regeneración, pociones…). */
  intervaloRefrescoTicks: 2,

  /** Número de segmentos de la barra y carácter usado. */
  segmentos: 20,
  caracterBarra: "|",

  /** Si el mob no tiene nombre propio, mostrar su tipo ("Zombie", "Iron Golem"…). */
  mostrarNombreDelTipo: true,

  /** Nombre arriba y barra abajo (true) o todo en una línea (false). */
  dosLineas: true,

  /** ¿Mostrar barra también sobre los jugadores? */
  mostrarEnJugadores: false,

  /** Familias que nunca llevan barra (botes, vagonetas, soportes de armadura…). */
  excluirFamilias: ["inanimate"],

  /** Tipos de entidad que nunca llevan barra. */
  excluirTipos: new Set([
    // Objetos, proyectiles y efectos
    "minecraft:item",
    "minecraft:xp_orb",
    "minecraft:arrow",
    "minecraft:thrown_trident",
    "minecraft:fishing_hook",
    "minecraft:snowball",
    "minecraft:egg",
    "minecraft:ender_pearl",
    "minecraft:fireball",
    "minecraft:small_fireball",
    "minecraft:area_effect_cloud",
    "minecraft:lightning_bolt",
    "minecraft:fireworks_rocket",
    "minecraft:evocation_fang",
    "minecraft:tnt",
    "minecraft:falling_block",
    "minecraft:shulker_bullet",
    "minecraft:llama_spit",
    "minecraft:eye_of_ender_signal",
    "minecraft:wither_skull",
    "minecraft:wither_skull_dangerous",
    "minecraft:dragon_fireball",
    // Entidades decorativas o vehículos
    "minecraft:armor_stand",
    "minecraft:painting",
    "minecraft:minecart",
    "minecraft:boat",
    "minecraft:chest_boat",
    "minecraft:chest_minecart",
    "minecraft:hopper_minecart",
    "minecraft:tnt_minecart",
    "minecraft:command_block_minecart",
    "minecraft:leash_knot",
    "minecraft:ender_crystal",
    "minecraft:npc",
    // Jefes: ya tienen su propia barra y el nombre se usa como título de ella
    "minecraft:ender_dragon",
    "minecraft:wither",
    // Muebles de otros addons del servidor (tienen salud pero no son mobs)
    "f:sit",
    "f:silladeruedas",
    "f:cofremini_container",
    "he:sit",
  ]),
};

// ── Estado ─────────────────────────────────────────────────

/**
 * Nombre original del mob mientras muestra la barra. Se guarda en la
 * propia entidad para poder restaurarlo aunque el servidor se apague
 * con la barra visible.
 */
const PROP_NOMBRE = "barra_salud:nombre_original";

/**
 * Barras visibles ahora mismo, por id de entidad.
 * @type {Map<string, { entity: import("@minecraft/server").Entity, original: string, escrito: string | undefined, expira: number }>}
 */
const activas = new Map();

function log(msg) {
  if (CONFIG.debug) console.warn(`[BarraSalud] ${msg}`);
}

// ── Nombres ────────────────────────────────────────────────

/** "minecraft:iron_golem" → "Iron Golem", "rf:duck" → "Duck". */
function nombreDelTipo(typeId) {
  return capitalizar(typeId.replace(/^[^:]*:/, ""));
}

function capitalizar(texto) {
  return texto
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/**
 * Formato de la v1: "§fDave §a❤ 22 / 24 HP" (o sin el nombre).
 * La v1 renombraba a todos los mobs para siempre, así que los mundos
 * que la usaron tienen mobs guardados con ese nombre. Lo detectamos
 * para devolverles su nombre real.
 */
const PATRON_V1 = /^(?:§f([\s\S]*?) )?§[ace]❤ \d+ \/ \d+ HP$/;

function limpiarNombreV1(nameTag, typeId) {
  let nombre = nameTag;
  let coincidencia;
  let cambiado = false;
  while (nombre && (coincidencia = PATRON_V1.exec(nombre))) {
    nombre = coincidencia[1] ?? "";
    cambiado = true;
  }
  // La v1 ponía el tipo como nombre a los mobs sin nombre propio.
  if (cambiado && nombre === capitalizar(typeId.replace(/^minecraft:/, ""))) return "";
  return nombre;
}

// ── Barra ──────────────────────────────────────────────────

function colorPorVida(ratio) {
  if (ratio > 0.66) return "§a";
  if (ratio > 0.33) return "§e";
  return "§c";
}

/** Devuelve el texto de la barra, o undefined si la entidad no tiene salud. */
function construirTexto(entity, original) {
  const salud = entity.getComponent("minecraft:health");
  if (!salud) return undefined;

  const actual = Math.max(0, salud.currentValue);
  const max = salud.effectiveMax > 0 ? salud.effectiveMax : salud.defaultValue || 20;
  const ratio = Math.min(1, actual / max);

  const n = CONFIG.segmentos;
  // Si le queda algo de vida, siempre al menos un segmento lleno.
  const llenos = actual > 0 ? Math.max(1, Math.round(ratio * n)) : 0;
  const barra =
    colorPorVida(ratio) + CONFIG.caracterBarra.repeat(llenos) +
    "§8" + CONFIG.caracterBarra.repeat(n - llenos);
  const linea = `§c❤ ${barra} §f${Math.ceil(actual)}§7/${Math.ceil(max)}`;

  const nombre = original || (CONFIG.mostrarNombreDelTipo ? nombreDelTipo(entity.typeId) : "");
  if (!nombre) return linea;
  return `§f${nombre}§r${CONFIG.dosLineas ? "\n" : " "}${linea}`;
}

function esRastreable(entity) {
  try {
    if (!entity?.isValid) return false;
    if (entity.typeId === "minecraft:player" && !CONFIG.mostrarEnJugadores) return false;
    if (CONFIG.excluirTipos.has(entity.typeId)) return false;
    if (CONFIG.excluirFamilias.length > 0 && !entity.matches({ excludeFamilies: CONFIG.excluirFamilias })) {
      return false;
    }
    return entity.getComponent("minecraft:health") !== undefined;
  } catch {
    return false;
  }
}

/** Muestra (o mantiene visible) la barra de la entidad durante `duracion` ticks. */
function mostrar(entity, duracion) {
  if (!esRastreable(entity)) return;
  try {
    const salud = entity.getComponent("minecraft:health");
    if (!salud || salud.currentValue <= 0) return; // muriendo: no hace falta barra

    const expira = system.currentTick + duracion;
    const existente = activas.get(entity.id);
    if (existente) {
      existente.expira = Math.max(existente.expira, expira);
      refrescar(existente);
      return;
    }

    // Si ya hay un nombre guardado es que el servidor se cerró con la barra
    // visible: el nameTag actual es nuestra barra, el nombre bueno es el guardado.
    let original = entity.getDynamicProperty(PROP_NOMBRE);
    if (typeof original !== "string") {
      original = limpiarNombreV1(entity.nameTag ?? "", entity.typeId);
      entity.setDynamicProperty(PROP_NOMBRE, original);
    }

    const registro = { entity, original, escrito: undefined, expira };
    activas.set(entity.id, registro);
    refrescar(registro);
    log(`Barra visible en ${entity.typeId} (${entity.id}), nombre original: "${original}"`);
  } catch (e) {
    log(`Error al mostrar barra en ${entity.typeId}: ${e}`);
  }
}

function refrescar(registro) {
  const { entity } = registro;
  // Si el nameTag ya no es lo que escribimos, alguien lo renombró mientras
  // se veía la barra (etiqueta de nombre, otro addon…): ese es su nombre nuevo.
  if (registro.escrito !== undefined && entity.nameTag !== registro.escrito) {
    registro.original = entity.nameTag;
    entity.setDynamicProperty(PROP_NOMBRE, registro.original);
  }

  const texto = construirTexto(entity, registro.original);
  if (texto === undefined) {
    ocultar(entity.id, registro);
    return;
  }
  if (entity.nameTag !== texto) entity.nameTag = texto;
  registro.escrito = texto;
}

/** Quita la barra y devuelve a la entidad su nombre original. */
function ocultar(id, registro) {
  activas.delete(id);
  const { entity } = registro;
  try {
    if (!entity.isValid) return;
    // Renombrado justo en el último momento: respetar el nombre nuevo.
    const renombrado = registro.escrito !== undefined && entity.nameTag !== registro.escrito;
    if (!renombrado) entity.nameTag = registro.original;
    entity.setDynamicProperty(PROP_NOMBRE, undefined);
    log(`Barra oculta en ${entity.typeId} (${id}), nombre: "${entity.nameTag}"`);
  } catch (e) {
    log(`Error al ocultar barra en ${id}: ${e}`);
  }
}

/**
 * Repara entidades que cargan con restos de una barra: las que quedaron
 * a medias al apagarse el servidor y las renombradas por la v1.
 */
function sanear(entity) {
  try {
    if (!entity?.isValid || activas.has(entity.id)) return;

    const guardado = entity.getDynamicProperty(PROP_NOMBRE);
    if (typeof guardado === "string") {
      entity.nameTag = guardado;
      entity.setDynamicProperty(PROP_NOMBRE, undefined);
      log(`Restaurado nombre de ${entity.typeId}: "${guardado}"`);
      return;
    }

    const tag = entity.nameTag;
    if (tag && tag.includes("❤")) {
      const limpio = limpiarNombreV1(tag, entity.typeId);
      if (limpio !== tag) {
        entity.nameTag = limpio;
        log(`Limpiado nombre de la v1 en ${entity.typeId}: "${tag}" → "${limpio}"`);
      }
    }
  } catch {
    // Entidad descargada a mitad de camino: ya se saneará cuando vuelva a cargar.
  }
}

// ── Eventos ────────────────────────────────────────────────

world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
  mostrar(hurtEntity, CONFIG.duracionDanoTicks);
});

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  const registro = activas.get(deadEntity.id);
  if (registro) ocultar(deadEntity.id, registro);
});

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
  activas.delete(removedEntityId);
});

world.afterEvents.entityLoad.subscribe(({ entity }) => {
  sanear(entity);
});

world.afterEvents.worldLoad.subscribe(() => {
  let revisadas = 0;
  for (const dimId of ["overworld", "nether", "the_end"]) {
    try {
      for (const entity of world.getDimension(dimId).getEntities()) {
        sanear(entity);
        revisadas++;
      }
    } catch {
      // Dimensión no disponible: se sanearán al cargar (entityLoad).
    }
  }
  console.warn(`[BarraSalud] ❤ v2 activa (API estable, sin experimentos). Entidades revisadas: ${revisadas}`);
});

// ── Bucles ─────────────────────────────────────────────────

// Mantiene al día las barras visibles y las quita cuando caducan.
system.runInterval(() => {
  const ahora = system.currentTick;
  for (const [id, registro] of activas) {
    try {
      if (!registro.entity.isValid) {
        activas.delete(id);
      } else if (ahora >= registro.expira) {
        ocultar(id, registro);
      } else {
        refrescar(registro);
      }
    } catch {
      activas.delete(id);
    }
  }
}, CONFIG.intervaloRefrescoTicks);

// Barra del mob al que mira cada jugador.
if (CONFIG.mostrarAlMirar) {
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      let impactos;
      try {
        impactos = player.getEntitiesFromViewDirection({
          maxDistance: CONFIG.distanciaMirada,
          excludeFamilies: CONFIG.excluirFamilias,
        });
      } catch {
        continue;
      }
      for (const { entity } of impactos) {
        if (entity.id !== player.id && esRastreable(entity)) {
          mostrar(entity, CONFIG.duracionMiradaTicks);
          break;
        }
      }
    }
  }, CONFIG.intervaloMiradaTicks);
}
