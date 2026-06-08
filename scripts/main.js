/**
 * =========================================================
 *  Barra de Salud — Floating Health Name Tags
 *  Minecraft Bedrock Edition — Server-Side Script API
 * =========================================================
 *
 *  Displays a dynamic health indicator above every mob:
 *      ❤ 22 / 24 HP
 *  or, if the entity already has a custom name:
 *      Dave ❤ 22 / 24 HP
 *
 *  Color-coded by health percentage:
 *      §a  green   > 66%
 *      §e  yellow  > 33%
 *      §c  red     ≤ 33%
 */

import { world, system } from "@minecraft/server";

// ── Configuration ──────────────────────────────────────────
const CONFIG = {
  /** Activar logs de diagnóstico en consola */
  debug: false,

  /** Update every N ticks (20 ticks = 1 second). */
  tickInterval: 20,

  /** Show health bar on players too? */
  showOnPlayers: false,

  /** Entity types to EXCLUDE (lowercase identifiers). */
  excludedTypes: new Set([
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
    "minecraft:armor_stand",
    "minecraft:painting",
    "minecraft:minecart",
    "minecraft:boat",
    "minecraft:chest_minecart",
    "minecraft:hopper_minecart",
    "minecraft:tnt_minecart",
    "minecraft:command_block_minecart",
    "minecraft:leash_knot",
    "minecraft:ender_crystal",
    "minecraft:shulker_bullet",
    "minecraft:llama_spit",
    "minecraft:eye_of_ender_signal",
    "minecraft:wither_skull",
    "minecraft:wither_skull_dangerous",
    "minecraft:dragon_fireball",
    "minecraft:npc",
  ]),
};

// ── Stored original names ──────────────────────────────────
// We keep track of any custom name an entity had *before* we
// overwrote its nameTag, so we can prepend it later.
const originalNames = new Map();

// ── Helpers ────────────────────────────────────────────────

/**
 * Safely checks if an entity is valid.
 * Handles both property (older API) and method (newer API) forms.
 */
function isEntityValid(entity) {
  try {
    if (typeof entity.isValid === "function") return entity.isValid();
    return !!entity.isValid;
  } catch {
    return false;
  }
}

/**
 * Returns true if we should display a health bar on this entity.
 */
function shouldTrack(entity) {
  try {
    if (!entity || !isEntityValid(entity)) return false;
    if (!CONFIG.showOnPlayers && entity.typeId === "minecraft:player") return false;
    if (CONFIG.excludedTypes.has(entity.typeId)) return false;

    // Must have a health component
    const health = entity.getComponent("minecraft:health");
    if (!health) return false;

    return true;
  } catch (e) {
    console.warn(`[BarraSalud] shouldTrack error: ${e}`);
    return false;
  }
}

/**
 * Picks a §-color code based on the health percentage.
 */
function healthColor(ratio) {
  if (ratio > 0.66) return "§a";  // green
  if (ratio > 0.33) return "§e";  // yellow
  return "§c";                     // red
}

/**
 * Safely gets max health from an entity's health component.
 * Tries effectiveMax first, then defaultValue as fallback.
 */
function getMaxHealth(health) {
  try {
    if (typeof health.effectiveMax === "number" && health.effectiveMax > 0) {
      return health.effectiveMax;
    }
  } catch { /* not available */ }

  try {
    if (typeof health.defaultValue === "number" && health.defaultValue > 0) {
      return health.defaultValue;
    }
  } catch { /* not available */ }

  // Last resort fallback
  return 20;
}

/**
 * Builds the name tag string for the given entity.
 * Returns null if the entity is invalid or has no health component.
 */
function buildNameTag(entity) {
  try {
    if (!isEntityValid(entity)) return null;

    const health = entity.getComponent("minecraft:health");
    if (!health) return null;

    const cur = Math.ceil(health.currentValue);
    const max = Math.ceil(getMaxHealth(health));
    const ratio = max > 0 ? health.currentValue / max : 1;
    const color = healthColor(ratio);

    // Heart symbol
    const heart = "❤";

    // Check for a stored original name
    const id = entity.id;
    let prefix = "";
    if (originalNames.has(id)) {
      const name = originalNames.get(id);
      if (name) prefix = `§f${name} `;
    }

    return `${prefix}${color}${heart} ${cur} / ${max} HP`;
  } catch (e) {
    console.warn(`[BarraSalud] buildNameTag error: ${e}`);
    return null;
  }
}

/**
 * Updates (or sets) the name tag on a single entity.
 */
function updateEntityNameTag(entity) {
  if (!shouldTrack(entity)) return;

  try {
    // Store the original name once (only if we haven't already)
    const id = entity.id;
    if (!originalNames.has(id)) {
      const existingTag = entity.nameTag;
      // Only store it if it looks like a "real" name (not one we wrote)
      if (existingTag && !existingTag.includes("❤")) {
        originalNames.set(id, existingTag);
      } else {
        originalNames.set(id, "");
      }
    }

    const tag = buildNameTag(entity);
    if (tag !== null) {
      entity.nameTag = tag;
    }
  } catch (e) {
    console.warn(`[BarraSalud] updateEntityNameTag error for ${entity.typeId}: ${e}`);
  }
}

/**
 * Cleans up an entity's name tag and stored data.
 */
function cleanupEntity(entity) {
  try {
    const id = entity.id;
    if (originalNames.has(id)) {
      // Restore original name (or clear it)
      const original = originalNames.get(id);
      if (isEntityValid(entity)) {
        entity.nameTag = original || "";
      }
      originalNames.delete(id);
    }
  } catch (e) {
    console.warn(`[BarraSalud] cleanupEntity error: ${e}`);
  }
}

// ── Event Listeners ────────────────────────────────────────

/**
 * On entity hurt → immediately refresh the name tag so the
 * player sees the health drop right away.
 */
world.afterEvents.entityHurt.subscribe((event) => {
  const entity = event.hurtEntity;
  if (entity) {
    // Use system.run to safely modify entity state in the next tick
    system.run(() => {
      try {
        updateEntityNameTag(entity);
      } catch (e) {
        console.warn(`[BarraSalud] entityHurt handler error: ${e}`);
      }
    });
  }
});

/**
 * On entity spawn → set the initial health bar.
 */
world.afterEvents.entitySpawn.subscribe((event) => {
  const entity = event.entity;
  if (entity) {
    // Small delay to let components initialize
    system.runTimeout(() => {
      try {
        updateEntityNameTag(entity);
      } catch (e) {
        console.warn(`[BarraSalud] entitySpawn handler error: ${e}`);
      }
    }, 5);
  }
});

/**
 * On entity death → clean up name tag and stored data.
 */
world.afterEvents.entityDie.subscribe((event) => {
  const entity = event.deadEntity;
  if (entity) {
    cleanupEntity(entity);
  }
});

/**
 * On entity removed → final cleanup of our Map to prevent
 * memory leaks from accumulating dead entity IDs.
 */
world.afterEvents.entityRemove.subscribe((event) => {
  const id = event.removedEntityId;
  if (originalNames.has(id)) {
    originalNames.delete(id);
  }
});

// ── Periodic Update Job ───────────────────────────────────
// Catches health changes from regeneration, potions, or
// anything that doesn't fire entityHurt.
// Utiliza runJob para procesar entidades en lotes sin causar lag.
const BATCH_SIZE = 30;

function* healthUpdateJob() {
  let tickCount = 0;
  
  while (true) {
    tickCount++;
    let processed = 0;
    
    for (const dimId of ["overworld", "nether", "the_end"]) {
      try {
        const dim = world.getDimension(dimId);
        const entities = dim.getEntities();
        for (const entity of entities) {
          try {
            updateEntityNameTag(entity);
            processed++;
          } catch (e) {
            // Individual entity error — skip it
          }
          
          if (processed >= BATCH_SIZE) {
            yield; // Pausa la ejecución hasta el siguiente tick
            processed = 0;
          }
        }
      } catch {
        // Dimension may not be loaded — skip.
      }
    }

    // Diagnostic log every 60 intervals
    if (tickCount % 60 === 0) {
      try {
        const dim = world.getDimension("overworld");
        const allEntities = dim.getEntities();
        let count = 0;
        let tracked = 0;
        for (const e of allEntities) {
          count++;
          if (shouldTrack(e)) tracked++;
        }
        if (CONFIG.debug) console.warn(`[BarraSalud] Diagnóstico: ${count} entidades en overworld, ${tracked} con barra de salud. Map size: ${originalNames.size}`);
      } catch { /* ignore */ }
    }

    // Esperar el intervalo configurado antes de revisar de nuevo
    for (let i = 0; i < CONFIG.tickInterval; i++) {
      yield;
    }
  }
}

// Iniciar el trabajo en segundo plano
system.runJob(healthUpdateJob());

// ── Startup Log ────────────────────────────────────────────
console.warn("[BarraSalud] ❤ Script cargado. Iniciando...");

system.runTimeout(() => {
  console.warn("[BarraSalud] ❤ Health name tags activos!");

  // Initial scan of all existing entities
  try {
    for (const dimId of ["overworld", "nether", "the_end"]) {
      try {
        const dim = world.getDimension(dimId);
        const entities = dim.getEntities();
        let count = 0;
        for (const entity of entities) {
          try {
            updateEntityNameTag(entity);
            count++;
          } catch { /* skip */ }
        }
        if (count > 0 && CONFIG.debug) {
          console.warn(`[BarraSalud] Escaneadas ${count} entidades en ${dimId}`);
        }
      } catch { /* dimension not loaded */ }
    }
  } catch (e) {
    console.warn(`[BarraSalud] Error en escaneo inicial: ${e}`);
  }
}, 60);
