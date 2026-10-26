# Contexto del proyecto: "mis-finanzas" / "Mi Vida Organizada"

> Este archivo es para que Claude (Claude Code en Visual Studio Code) entienda el proyecto desde cero.
> Léelo completo antes de tocar código.

## 1. Qué es
App personal para organizar la vida, hoy centrada en **finanzas** (Salud y Avances se quitaron el 2026-10-26). Es un **único archivo `index.html`** (~2.300 líneas, HTML + CSS + JS vanilla, sin frameworks ni build). Se usa desde celular y computador. Idioma de la interfaz y de los comentarios: **español**.

## 2. Archivos de esta carpeta
| Archivo | Para qué sirve |
|---|---|
| `index.html` | Toda la app (estilos en `<style>` desde la línea ~10, lógica en `<script>` desde la ~326). |
| `api/state.js` | Función serverless de Vercel: guarda/lee el estado de cada usuario en MongoDB (GET/PUT/POST), con control de versión e historial (ver sección 3). |
| `api/quote.js` | Función serverless de Vercel: precios de acciones vía Finnhub (`?symbols=AAPL,MSFT`). |
| `package.json` | Solo depende de `mongodb`. |

## 3. Despliegue e infraestructura
- Repo en GitHub, desplegado en **Vercel**. Los archivos de `api/` se publican como funciones automáticamente.
- Repo original en el Mac: `/Users/leopoldo/Documents/GitHub/organizar-mi-vida-` (se maneja con GitHub Desktop).
- **Esta carpeta es una copia** de trabajo. Para publicar, hay que llevar los cambios de vuelta al repo original y hacer commit/push.
- Variables de entorno en Vercel (NO están en el código, no pedirlas ni inventarlas): `MONGODB_URI`, `APP_SECRET` (clave de "leo"), `APP_SECRET_TIZIBIZI` (clave de "tizi"), `MONGODB_DB` (opcional, por defecto `misfinanzas`), `FINNHUB_API_KEY`.
- Usuarios: `leo` (aparece como "Leo Jr" en la lista `USERS` de index.html) y `tizi`. Cada uno tiene su propio documento en MongoDB; los datos no se mezclan. Cada request lleva headers `x-app-user` y `x-app-secret`. Para agregar una persona: añadirla en `USERS` de **ambos** archivos de `api/` y en la lista `USERS` del front, y crear su variable de entorno.
- En el navegador se guardan en `localStorage`: `mvo-secret-<usuario>` y `mvo-last-user`.

### Seguridad de los datos (desde 2026-10-26)
- Cada documento en la colección `state` tiene un campo `version`. GET devuelve `{value, version}`; PUT exige `{value, baseVersion}`. Si `baseVersion` no coincide con la versión actual (u omite la versión), responde **409** y no guarda. El front entonces recarga lo más nuevo y avisa "Hubo cambios desde otro dispositivo".
- Antes de cada guardado, la versión anterior se copia a la colección **`state_history`** (`{docId, version, value, updatedAt, savedAt}`); se conservan las últimas 30 por usuario. Ahí se recupera cualquier versión previa.
- Si la carga inicial falla, la app NO arranca con un estado vacío: muestra "No se pudo cargar · Reintentar" y no guarda nada (`state` queda en `null`).
- Los guardados del front van en fila (`saveState()` encadena promesas) para que cada uno lleve la versión más reciente.
- Ajustes → **Respaldo**: "Descargar respaldo" baja `respaldo-<usuario>-<fecha>.json` (`{app:'mi-vida-organizada', user, exportedAt, state}`); "Cargar respaldo" acepta ese formato o el estado crudo, rechaza respaldos de otro usuario, pide confirmación y baja antes una copia `...-antes-de-cargar.json`.
- Después de publicar cambios, recargar todas las pestañas abiertas: una pestaña con código viejo no manda versión y sus guardados se rechazan.

## 4. Estructura de la app
Riel de navegación con dos áreas: **Finanzas** y **Bolsa** (acciones reales con precios de Finnhub; distinta de la pestaña Bolsa dentro de Finanzas, que es un valor manual).

**Finanzas** (pestañas: Resumen, Movimientos, Metas, Wallets, Bolsa, Deudas)
- Multi-moneda (USD por defecto, también VES/bolívares). Pestañas de moneda arriba del selector de período.
- Cuentas/wallets: **los saldos se derivan de las transacciones, no se guardan**. Todo movimiento (ingreso, gasto, aporte a meta, inversión) está ligado a una cuenta.
- Metas de ahorro con aporte mensual (muestra equivalente diario), botón "Canjear" (cierra la meta sin devolver fondos) y "Cancelar" (devuelve los aportes a sus cuentas de origen).
- Bolsa: posiciones, monto invertido, valor actual, ganancia/pérdida, comisiones como monto fijo; precios vía `api/quote.js`.
- Deudas: "Debo" y "Me deben", con abonos parciales, barra de progreso e historial.
- Resumen: tarjeta de patrimonio (dona principal a la izquierda + mini-donas por wallet en grilla de 2 columnas), gráficas de ingresos vs gastos, categorías en una sola tarjeta expandible por moneda.
- Dos temas: cálido/beige y oscuro estilo "Razer" (negro con verde neón).

**Salud y Avances (quitadas el 2026-10-26)**
- Ya no hay código ni UI. Sus datos (`books`, `exerciseLogs`, `exerciseGoal`, `meals`, `calorieGoal`, `customCalendars`) se siguen normalizando en `normalizeState` y guardando, para no borrarlos de MongoDB. No eliminarlos de `normalizeState`/`defaultState`.

## 5. Reglas de dominio que hay que respetar
- Las mini-donas del patrimonio muestran el desglose **interno de cada wallet** (libre / bolsa / metas), NO la composición por moneda. No confundirlas.
- Cancelar una meta devuelve automáticamente cada aporte a su cuenta de origen, **sin preguntar**.
- Las deudas "Debo" solo afectan saldos **cuando se pagan**, no al crearlas.
- Los préstamos "Me deben" hoy **no** descuentan de ninguna wallet al crearlos (solo se anotan); los cobros sí entran a la wallet elegida. Se decidió dejarlo así (2026-10-26).
- Una wallet con movimientos, transferencias o aportes no se puede borrar (solo renombrar).
- "Debo / me deben" del Resumen muestra lo que **falta** por pagar/cobrar.
- La fecha de "hoy" es local (`todayStr()` usa `dateToStr`), no UTC.
- Los saldos son derivados: nunca guardar un saldo, siempre calcularlo.

## 6. Forma de trabajar con la dueña/dueño del proyecto (IMPORTANTE)
1. **Primero se define una lista de tareas (to-do)** y se confirma entendimiento. No programar antes.
2. **Esperar la luz verde** explícita ("dale play", "luz verde") antes de escribir código.
3. Implementar todo lo acordado **de una sola vez**, no por partes.
4. **No agregar nada que no se haya acordado.** Ya se llamó la atención por esto.
5. El diseño es deliberado y con criterio propio (compacto, posición de las donas, estructura de tarjetas): **no cambiarlo sin que lo pidan**.
6. Antes de entregar, **validar la lógica JS con pruebas tipo jsdom** (los scripts de prueba van en una carpeta aparte, no en el repo).
7. Comunicación informal en español.
8. Cada ronda de cambios se revisa y aprueba antes de pasar a nuevas funciones.

## 7. Problemas conocidos (re-verificar, pueden estar resueltos)
- La dona principal del patrimonio se veía vacía por funciones heredadas de artifacts; esas funciones ya no existen (todo va por `/api/state`). Solo sale vacía si el total es ≤ 0.
- En modo multi-moneda las gráficas de ingresos/gastos tuvieron fallas; se corrigieron en el chat, pero conviene probarlas.
- GitHub Desktop a veces no muestra de inmediato los cambios escritos por herramientas externas (problema de refresco, no del archivo).

## 8. Notas técnicas
- JS en modo estricto (`'use strict'`), estilo ES5 (`var`, `function`), un único estado global `state` + `ui`; renderizado por funciones `build*Html()` / `render*()` y modales `open*Modal()`; acciones por `data-action` en un manejador central.
- Hay migraciones al cargar datos viejos (dentro de `normalizeState`, alrededor de las líneas 394–530); no romperlas, hay datos reales guardados.
- Al hacer cambios grandes, conservar compatibilidad con el estado ya guardado en MongoDB.
