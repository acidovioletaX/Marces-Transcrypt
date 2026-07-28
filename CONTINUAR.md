# Guía para continuar/expandir Marce's Transcrypt

Este documento resume el estado del proyecto al cierre de esta ronda de desarrollo, para que una futura sesión (con Claude o con quien sea) pueda retomarlo sin tener que releer todo el historial de conversación.

## Qué es esto

App web que toma una transcripción de entrevista psicológica **sin marcas de interlocutor** y devuelve el mismo texto con cada intervención etiquetada como profesional o paciente, infiriendo quién es quién por el estilo conversacional (preguntas abiertas vs. relatos personales). Prioridad número uno del proyecto: **fidelidad exacta** al original — nunca resumir, nunca inventar, nunca perder contenido.

## Enlaces clave

- **Repo**: https://github.com/acidovioletaX/Marces-Transcrypt
- **App en vivo**: https://acidovioletax.github.io/Marces-Transcrypt/ (GitHub Pages, rama `master`, raíz)
- **Proxy (Cloud Run)**: https://marces-transcrypt-proxy-924631262984.us-central1.run.app
- **Proyecto GCP**: `proud-amphora-449223-h7` (número `924631262984`), región `us-central1`
- **Secreto**: `anthropic-api-key` en Secret Manager de ese proyecto (la clave real de Anthropic nunca está en el repo ni en el código)

## Arquitectura

```
Navegador (index.html, GitHub Pages, estático)
        │  fetch(PROXY_URL) — sin API key
        ▼
Cloud Run: gcp-proxy/index.js (Node, sin dependencias)
        │  ANTHROPIC_API_KEY inyectada desde Secret Manager
        ▼
api.anthropic.com
```

Todo el detalle de despliegue (habilitar APIs, crear el secreto, `gcloud run deploy`, etc.) está en [README.md](README.md).

## Decisiones importantes (y el porqué)

- **La API key nunca vive en el cliente.** Se evaluó Cloudflare Workers primero; se migró a Cloud Run porque el usuario quería reforzar aprendizaje de Google Cloud específicamente. El proxy valida modelo permitido y limita `max_tokens` a 8000 por llamada como tope de costo básico.
- **Modo de velocidad "Automático" (por defecto)**: decide entre procesar el documento completo de una vez ("Preciso") o dividirlo en fragmentos ("Rápido") según la longitud del texto, con un umbral de **25,000 caracteres** (`AUTO_MODE_THRESHOLD_CHARS` en `index.html`). Por debajo del umbral, un documento cabe en una sola llamada sin necesitar continuaciones. Por encima, fragmentar es mucho más barato (ver "Incidente de costo" abajo).
- **Continuación automática por límite de tokens**: si una llamada se corta por `max_tokens`, la app reintenta automáticamente (hasta `MAX_CONTINUATIONS = 6` rondas) usando el texto ya generado como *prefill* del mensaje `assistant`, en vez de pedirle al usuario que suba el tope manualmente.
- **Verificación de fidelidad**: al terminar, se compara el conteo de palabras del resultado contra el original; si el resultado tiene <80% de las palabras esperadas, se muestra una advertencia. Es una heurística aproximada (no detecta reformulaciones sutiles), no una garantía formal.
- **Temas visuales**: Kawaii rosa (por defecto, intacta) + Lavanda, Menta, Durazno (con títulos Fredoka en negrita) + Nocturno, Pastelería, Café ("modo loco": bordes blancos, botones 3D, paleta de 3-4 colores con `--accent2`/`--accent3`, título con degradado animado, ícono pixel art, fondo con patrón decorativo). Ver bloque `:is([data-theme="nocturno"], [data-theme="pasteleria"], [data-theme="cafe"])` en el `<style>` de `index.html` para tocar las tres juntas.

## Incidente de costo (2026-07-28) — resuelto, dejar registro

El usuario gastó ~US$1 en 3 corridas de prueba con un documento largo (~77,000 caracteres). Se verificó en la consola de Anthropic (Analíticas → Uso): 406,809 tokens de entrada + 121,046 de salida, 100% en `claude-haiku-4-5-20251001` (el modelo correcto, no fue un error de selección).

**Causa raíz**: antes de agregar el modo "Automático", el único camino ("Preciso") reenviaba el documento completo **en cada ronda de continuación**, más todo lo ya generado. Para un documento de ~24,000 tokens que necesitaba ~4 rondas, eso da ~144,000 tokens de entrada por corrida — cuadra casi exacto con lo observado (3 corridas × ~144k ≈ 432k vs. 406,809 real).

**Fix aplicado**: el modo "Rápido" (ahora usado automáticamente sobre el umbral de 25,000 caracteres) fragmenta el texto y solo pasa un resumen corto de continuidad entre fragmentos, sin reenviar el documento completo. Estimado: mismo documento debería costar ~60,000 tokens totales en vez de ~144,000 (~60% menos).

**Pendiente de verificar**: no se ha vuelto a correr el documento largo real desde el fix para confirmar el ahorro con datos reales de la consola. Sería el primer paso útil en la próxima sesión.

## Qué quedó pendiente / ideas para expandir

Discutido pero no implementado todavía:

1. **Alerta de costo/confirmación antes de procesar documentos largos** — mostrar una estimación de tokens/costo aproximado y pedir confirmación explícita antes de lanzar la llamada, especialmente en modo "Preciso" forzado o documentos muy largos. Se ofreció en la última sesión pero no se llegó a construir.
2. **Rate limiting real en el proxy** — hoy solo hay tope de `max_tokens` y modelos permitidos; cualquiera con la URL del servicio de Cloud Run puede llamarlo directamente (sin pasar por el frontend) y generar costo. Opciones: código de acceso obligatorio (`APP_ACCESS_CODE`, ya soportado pero no activado), Cloud Armor, cuotas de Cloud Run.
3. **Optimizar el overhead del prompt de sistema en modo Rápido** — el system prompt completo (reglas 1-11 + nota de fidelidad) se reenvía en cada fragmento; para documentos con muchos fragmentos pequeños eso es overhead repetido. Podría acortarse una versión "ligera" para fragmentos 2+.
4. **Botón para cancelar un procesamiento en curso** — hoy, una vez que le das a "Etiquetar transcripción", no hay forma de abortar desde la interfaz.
5. **Exportar a otros formatos** (Word/PDF) además de `.txt`.
6. **Multi-idioma** — el prompt y la interfaz están en español únicamente.
7. **Historial local** — guardar transcripciones procesadas recientes en `localStorage` para no perder el resultado si se cierra la pestaña sin descargar.

## Comandos de referencia rápida

```bash
# Reautenticar gcloud en Windows si falla con "no se encontró Python"
export CLOUDSDK_PYTHON="/c/Users/VLADO 2/AppData/Local/Google/Cloud SDK/google-cloud-sdk/platform/bundledpython/python.exe"

# Redesplegar el proxy tras cambiar gcp-proxy/index.js
cd "D:\GOOGLE CLOUD\transcript-labeler\gcp-proxy"
gcloud run deploy marces-transcrypt-proxy --source . --region us-central1 \
  --allow-unauthenticated \
  --set-secrets=ANTHROPIC_API_KEY=anthropic-api-key:latest \
  --set-env-vars=ALLOWED_ORIGIN=https://acidovioletax.github.io

# Publicar cambios del frontend
cd "D:\GOOGLE CLOUD\transcript-labeler"
git add index.html
git commit -m "..."
git push
```

## Archivos clave

| Archivo | Qué contiene |
|---|---|
| `index.html` | Todo el frontend: estilos, temas, prompt de sistema, lógica de fragmentación/continuación, panel de progreso. |
| `gcp-proxy/index.js` | El proxy que llama a Anthropic con la key de Secret Manager. |
| `README.md` | Instrucciones de despliegue paso a paso (GCP + GitHub Pages). |
| `example/ejemplo_ficticio.txt` | Transcripción ficticia para probar sin usar datos reales de pacientes. |
| `CONTINUAR.md` | Este archivo. |
