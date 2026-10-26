# Contexto del proyecto: "mis-finanzas" / "Mi Vida Organizada"

> Este archivo es para que Claude (Claude Code en Visual Studio Code) entienda el proyecto desde cero.
> Léelo completo antes de tocar código.

## 1. Qué es
App personal para organizar la vida, hoy centrada en **finanzas** (Salud y Avances se quitaron el 2026-10-26). Desde 2026-10-26 es una app **React 18 + TypeScript + Vite** (antes era un único `index.html` con JS vanilla). Se usa desde celular y computador. Idioma de la interfaz y de los comentarios: **español**.

## 2. Archivos
| Ruta | Para qué sirve |
|---|---|
| `index.html` | Entrada de Vite (solo carga fuentes y `src/main.tsx`). |
| `src/styles.css` | Todos los estilos (los mismos de la versión HTML; temas cálido y oscuro). |
| `src/lib/` | Lógica pura, sin pantalla: `types.ts`, `constants.ts` (categorías, monedas, `USERS`), `state.ts` (`defaultState`, `normalizeState` con las migraciones), `finance.ts` (saldos, metas, deudas, patrimonio, períodos), `format.ts` (moneda y fechas locales), `stocks.ts` (Bolsa del riel), `workout.ts` (Ejercicio: catálogo de ~70 ejercicios, búsqueda, récords, semanas), `backup.ts`. |
| `src/store.ts` | Store global (`state` = datos, `ui` = lo que se ve, sesión, avisos). `commit(fn)` aplica un cambio sobre una copia y guarda. |
| `src/api/client.ts` | Login/sesión, carga, guardado en fila con versión, conflicto, precios. |
| `src/actions.ts` | Acciones compartidas (borrar con "¿Seguro?", FAB, abrir modales que exigen "Por mes"). |
| `src/App.tsx` | Pantallas de entrada, riel, encabezado y estructura general. |
| `src/components/` | `Finanzas.tsx` (todas las pestañas + tablero de escritorio), `BolsaSection.tsx`, `EjercicioSection.tsx`, `charts.tsx` (donas, barras, líneas), `Overlays.tsx` (aviso y tooltip), `modals/` (un componente por modal; `ModalRoot.tsx` los elige según `ui.modal`). |
| `tests/` | Pruebas con Vitest + jsdom (`npm test`). `fixtures/expected-numbers.json` son los números calculados con la versión HTML anterior: la lógica debe seguir dándolos igual. |
| `api/state.js` | Función serverless de Vercel: guarda/lee el estado de cada usuario en MongoDB (GET/PUT/POST), con control de versión e historial (ver sección 3). |
| `api/quote.js` | Función serverless de Vercel: precios de acciones vía Finnhub (`?symbols=AAPL,MSFT`). |
| `vercel.json` | Le dice a Vercel que compile con Vite y publique `dist/`. |

## 3. Despliegue e infraestructura
- Repo en GitHub, desplegado en **Vercel** (https://organizar-mi-vida.vercel.app). Vercel corre `npm run build` y publica `dist/`; los archivos de `api/` se publican como funciones automáticamente. Cada rama distinta de `main` genera un link de prueba (preview) que **usa la misma base de datos real**: úsalo solo para mirar.
- El repo también se publica en GitHub Pages, pero ahí la app no funciona (no corren las funciones de `api/`). Usar siempre el link de Vercel.
- Comandos: `npm install`, `npm test` (pruebas), `npm run build` (revisa tipos y compila). `npm run dev` levanta solo el front; para que funcione `/api` en local hace falta `vercel dev`.
- Repo original en el Mac: `/Users/leopoldo/Documents/GitHub/organizar-mi-vida-` (se maneja con GitHub Desktop).
- `/Users/leopoldo/Desktop/mis-finanzas-contexto` fue la copia de trabajo de la versión HTML; desde la migración a React se trabaja directo en el repo original.
- Variables de entorno en Vercel (NO están en el código, no pedirlas ni inventarlas): `MONGODB_URI`, `APP_SECRET` (clave de "leo"), `APP_SECRET_TIZIBIZI` (clave de "tizi"), `MONGODB_DB` (opcional, por defecto `misfinanzas`), `FINNHUB_API_KEY`.
- Usuarios: `leo` (aparece como "Leo Jr" en la lista `USERS` de index.html) y `tizi`. Cada uno tiene su propio documento en MongoDB; los datos no se mezclan. Cada request lleva headers `x-app-user` y `x-app-secret`. Para agregar una persona: añadirla en `USERS` de **ambos** archivos de `api/` y en `USERS` de `src/lib/constants.ts`, y crear su variable de entorno.
- En el navegador se guardan en `localStorage`: `mvo-secret-<usuario>` y `mvo-last-user`.

### Seguridad de los datos (desde 2026-10-26)
- Cada documento en la colección `state` tiene un campo `version`. GET devuelve `{value, version}`; PUT exige `{value, baseVersion}`. Si `baseVersion` no coincide con la versión actual (u omite la versión), responde **409** y no guarda. El front entonces recarga lo más nuevo y avisa "Hubo cambios desde otro dispositivo".
- Antes de cada guardado, la versión anterior se copia a la colección **`state_history`** (`{docId, version, value, updatedAt, savedAt}`); se conservan las últimas 30 por usuario. Ahí se recupera cualquier versión previa.
- Si la carga inicial falla, la app NO arranca con un estado vacío: muestra "No se pudo cargar · Reintentar" y no guarda nada (`state` queda en `null`).
- Los guardados del front van en fila (`saveState()` en `src/api/client.ts` encadena promesas) para que cada uno lleve la versión más reciente.
- Ajustes → **Respaldo**: "Descargar respaldo" baja `respaldo-<usuario>-<fecha>.json` (`{app:'mi-vida-organizada', user, exportedAt, state}`); "Cargar respaldo" acepta ese formato o el estado crudo, rechaza respaldos de otro usuario, pide confirmación y baja antes una copia `...-antes-de-cargar.json`.
- Después de publicar cambios, recargar todas las pestañas abiertas: una pestaña con código viejo no manda versión y sus guardados se rechazan.

## 4. Estructura de la app
Riel de navegación con tres áreas: **Finanzas**, **Bolsa** (acciones reales con precios de Finnhub; distinta de la pestaña Bolsa dentro de Finanzas, que es un valor manual) y **Ejercicio**.

**Ejercicio** (desde 2026-10-26)
- Datos: `exercises` (nombre + `weighted` = usa pesa), `routines` (nombre + lista de `exerciseIds`, sin repeticiones objetivo), `workouts` (fecha, rutina, y por ejercicio sus series `{reps, kg}`), `bodyWeights`. Todo en kilos.
- En ejercicios sin pesa, `kg` es el lastre opcional (mochila).
- Un ejercicio es uno solo aunque esté en varias rutinas; así se compara su avance. El catálogo precargado está en `workout.ts` y solo pasa al estado cuando se usa. No se puede borrar un ejercicio ya registrado.
- Pantalla: resumen de la semana, "Hoy hice…" (sugiere la rutina que hace más tiempo no haces y muestra lo de la vez anterior), avance con gráfica de líneas por ejercicio o rutina y comparación contra la semana pasada, récords 🏆 (supera la mejor serie anterior en reps o kg; la primera vez no cuenta), calendario de días entrenados, historial, rutinas, mis ejercicios y peso corporal.
- Acordado no incluir: temporizador de descanso ni notas por sesión. Los días de ejercicio viejos de Salud (`exerciseLogs`) no se muestran.

**Finanzas** (pestañas: Resumen, Movimientos, Metas, Wallets, Bolsa, Deudas)
- Multi-moneda (USD por defecto, también VES/bolívares). Pestañas de moneda arriba del selector de período.
- Cuentas/wallets: **los saldos se derivan de las transacciones, no se guardan**. Todo movimiento (ingreso, gasto, aporte a meta, inversión) está ligado a una cuenta.
- Metas de ahorro con aporte mensual (muestra equivalente diario), botón "Canjear" (cierra la meta sin devolver fondos) y "Cancelar" (devuelve los aportes a sus cuentas de origen).
- Bolsa: posiciones, monto invertido, valor actual, ganancia/pérdida, comisiones como monto fijo; precios vía `api/quote.js`.
- Deudas: "Debo" y "Me deben", con abonos parciales, barra de progreso e historial.
- Resumen: tarjeta de patrimonio (dona principal a la izquierda + mini-donas por wallet en grilla de 2 columnas), gráficas de ingresos vs gastos, categorías en una sola tarjeta expandible por moneda.
- Dos temas: cálido/beige y oscuro estilo "Razer" (negro con verde neón).

**Salud y Avances (quitadas el 2026-10-26)**
- Ya no hay código ni UI. Sus datos (`books`, `exerciseLogs`, `exerciseGoal`, `meals`, `calorieGoal`, `customCalendars`) se siguen normalizando en `normalizeState` (`src/lib/state.ts`) y guardando, para no borrarlos de MongoDB. No eliminarlos de `normalizeState`/`defaultState`.

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
6. Antes de entregar, **correr `npm test` y `npm run build`**. Las pruebas viven en `tests/` dentro del repo (decidido el 2026-10-26).
7. Comunicación informal en español.
8. Cada ronda de cambios se revisa y aprueba antes de pasar a nuevas funciones.

## 7. Problemas conocidos (re-verificar, pueden estar resueltos)
- La dona principal del patrimonio se veía vacía por funciones heredadas de artifacts; esas funciones ya no existen (todo va por `/api/state`). Solo sale vacía si el total es ≤ 0.
- En modo multi-moneda las gráficas de ingresos/gastos tuvieron fallas; se corrigieron en el chat, pero conviene probarlas.
- GitHub Desktop a veces no muestra de inmediato los cambios escritos por herramientas externas (problema de refresco, no del archivo): cerrarlo con Cmd+Q y abrirlo de nuevo.

## 8. Notas técnicas
- TypeScript estricto. La lógica de dominio vive en `src/lib/` como funciones puras que reciben el estado (`fn(s, ...)`); las pantallas no calculan saldos por su cuenta.
- Para modificar datos: `commit(draft => { ... })` de `src/store.ts` (trabaja sobre una copia y guarda). Validar antes de llamar a `commit`. Nunca guardar un saldo.
- Modales: `openModal({ type, ...props })`; cada tipo se resuelve en `src/components/modals/ModalRoot.tsx`.
- Las migraciones de datos viejos están en `normalizeState` (`src/lib/state.ts`); no romperlas, hay datos reales guardados. `tests/logic.test.ts` comprueba que los números sigan iguales a los de la versión HTML.
- Al hacer cambios grandes, conservar compatibilidad con el estado ya guardado en MongoDB.
