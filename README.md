# Barra de Salud (Floating Health Bar)

Behavior Pack para servidores de Minecraft Bedrock Edition que muestra una barra de vida sobre los mobs:

```
Bobby
❤ ||||||||||||||||||||  14/20
```

**Características:**
* **Sin experimentos:** usa solo la Script API **estable** (`@minecraft/server` 2.3.0). No hace falta activar "Beta APIs", así que funciona en BDS 1.26.30+, donde los mundos con experimentos no dejan entrar a los jugadores.
* **Al mirar o al golpear:** la barra aparece sobre el mob que estás mirando o que acaba de recibir daño, y desaparece sola a los pocos segundos.
* **Barra de acción:** la vida del mob que miras o golpeas también sale encima de tu inventario (`Zombie  ❤ ||||||||  14/20`), solo para ti. Al matarlo muestra `☠`.
* **Cada jugador elige con `/barra`:** ver la sección [Comando](#-comando-barra).
* **No ensucia el mundo:** cuando la barra se quita, el mob recupera su nombre original. Ningún mob se queda renombrado para siempre.
* **Colores por porcentaje:** verde (>66%), amarillo (>33%), rojo (≤33%).
* **Respeta nombres propios:** si tu mascota se llama "Bobby", la barra va debajo de su nombre. Si le cambias el nombre con una etiqueta mientras se ve la barra, se respeta el nombre nuevo.
* **Ligero:** solo procesa los mobs con barra visible y un rayo de visión por jugador; no recorre todas las entidades del mundo cada segundo.

## 📥 Instalación

1. Copia esta carpeta dentro de `behavior_packs/` en tu servidor Bedrock (o en `development_behavior_packs/` para probar en local).
2. Agrega el pack a `worlds/<tu mundo>/world_behavior_packs.json`:
   ```json
   { "pack_id": "b8c4d28f-7f12-4c28-9812-70b13d42c3b2", "version": [2, 0, 0] }
   ```
3. **No** actives ningún experimento.
4. (Opcional) Agrega un `pack_icon.png` de 256×256 en la raíz para que tenga icono.

## 🔄 Actualizar desde la v1

La v1 dependía de `@minecraft/server 2.8.0-beta` (requería Beta APIs) y renombraba **permanentemente** a todos los mobs del mundo con `Zombie ❤ 20 / 20 HP`.

* Si quitaste los experimentos del mundo, la v2 ya funciona sin ellos (el Oráculo trae `tools/desactivar_experimentos.py` para eso).
* Los mobs guardados con el nombre de la v1 se limpian solos cuando se cargan: los que no tenían nombre se quedan sin nombre y los que tenían uno ("Dave") lo recuperan.
* Cambia en `world_behavior_packs.json` el `pack_id` y la versión por los de arriba.

## 💬 Comando `/barra`

Cualquier jugador puede usarlo, sin trucos activados. El modo se guarda en el jugador y se conserva aunque salga del servidor.

| Comando | Barra flotante | Barra de acción | Se activa al… |
|---|---|---|---|
| `/barra on` *(por defecto)* | ✅ | ✅ | mirar y golpear |
| `/barra golpe` | ✅ | ✅ | solo golpear |
| `/barra accion` | ❌ | ✅ | mirar y golpear |
| `/barra off` | ❌ | ❌ | — |
| `/barra` | muestra tu modo actual y las opciones | | |

La barra flotante es el nombre del mob, así que **la ven todos los jugadores cercanos**. El modo de cada jugador decide si *sus* miradas y golpes la activan. Quien tenga `off` o `accion` igual puede ver la barra flotante que activó otro jugador, o la de un mob que se está quemando o cayendo (eso último se desactiva con `flotantePorDanoAmbiental: false`).

## ⚙️ Configuración (opcional)

Edita el bloque `CONFIG` al inicio de `scripts/main.js`:

| Opción | Por defecto | Qué hace |
|---|---|---|
| `debug` | `false` | Logs de diagnóstico en la consola |
| `modoPorDefecto` | `"on"` | Modo de los jugadores que nunca usaron `/barra` |
| `flotantePorDanoAmbiental` | `true` | Barra flotante cuando el daño no viene de un jugador (lava, sol, otros mobs…) |
| `duracionDanoTicks` | `100` | Cuánto se ve la barra tras recibir daño (20 ticks = 1 s) |
| `mostrarAlMirar` | `true` | Mostrar la barra del mob que miras |
| `duracionMiradaTicks` | `40` | Cuánto se queda tras dejar de mirarlo |
| `distanciaMirada` | `16` | Distancia máxima en bloques |
| `segmentos` / `caracterBarra` | `20` / `"\|"` | Tamaño y carácter de la barra |
| `mostrarNombreDelTipo` | `true` | Mostrar "Zombie", "Iron Golem"… en mobs sin nombre |
| `dosLineas` | `true` | Nombre arriba y barra abajo, o todo en una línea |
| `mostrarEnJugadores` | `false` | Barra también sobre jugadores |
| `excluirFamilias` / `excluirTipos` | ver código | Entidades que nunca llevan barra (vehículos, proyectiles, jefes, muebles…) |

Si otro addon añade entidades que no deberían llevar barra (sillas, cofres…), agrega su identificador a `excluirTipos`.

## 📜 Licencia
Este proyecto es libre de uso. Si lo modificas y redistribuyes, por favor da el crédito correspondiente.
