# Barra de Salud (Floating Health Bar)

Un add-on (Behavior Pack) para servidores de Minecraft Bedrock Edition que muestra una barra de vida interactiva encima de todas las entidades (mobs). 

**Características:**
* **Dinámico y Rápido:** La vida se actualiza al instante cuando la entidad recibe daño.
* **Colores por Porcentaje:** Verde (>66%), Amarillo (>33%), Rojo (≤33%).
* **Respeta Nombres Personalizados:** Si le pusiste una etiqueta (Name Tag) a tu mascota (ej. "Bobby"), se mostrará como `Bobby ❤ 20 / 20 HP`.
* **Optimizado para Servidores:** Utiliza `system.runJob` para no sobrecargar el servidor (cero lag), incluso si hay cientos de entidades. Filtra automáticamente proyectiles y entidades que no son monstruos.

## 📥 Instalación

1. Descarga el repositorio o los archivos del Add-on.
2. Coloca la carpeta dentro de `behavior_packs` en tu servidor Bedrock o en tu carpeta de Minecraft (`development_behavior_packs`).
3. (Recomendado) Agrega un archivo `pack_icon.png` (de 256x256 píxeles) en la raíz para que el add-on tenga icono en el menú del juego.
4. Asegúrate de habilitar los experimentos de **Beta APIs** en las opciones de tu mundo/servidor.

## ⚙️ Configuración (Opcional)
Si deseas modificar los parámetros (como mostrar la vida de los jugadores también, o habilitar los logs de diagnóstico), abre el archivo `scripts/main.js` y ajusta el bloque `CONFIG`:

```javascript
const CONFIG = {
  debug: false, // Cambia a true para ver logs en consola
  tickInterval: 20, // Cada cuánto revisa curaciones pasivas
  showOnPlayers: false, // ¿Mostrar barra en jugadores?
  ...
}
```

## 📜 Licencia
Este proyecto es libre de uso. Si lo modificas y redistribuyes, por favor da el crédito correspondiente.
