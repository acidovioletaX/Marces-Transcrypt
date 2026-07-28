# Marce's Transcrypt

App web que etiqueta automáticamente quién habla (profesional / paciente) en transcripciones de entrevistas psicológicas sin marcas de interlocutor, usando Claude (Anthropic) como motor de inferencia.

El frontend es estático (se publica en **GitHub Pages**) y llama a un **proxy propio en Google Cloud Run**, con la clave de Anthropic guardada en **Secret Manager**. La clave **nunca** viaja al navegador, ni queda en el repositorio, ni es visible para quien abra "ver código fuente" de la página pública.

> ¿Vas a seguir desarrollando esto? Lee primero [CONTINUAR.md](CONTINUAR.md) — resume el estado actual, decisiones de diseño, un incidente de costo ya resuelto y las ideas pendientes.

## Arquitectura

```
Navegador (index.html, GitHub Pages)
        │  fetch(PROXY_URL)  — sin API key, solo texto + config
        ▼
Cloud Run (gcp-proxy/)
        │  ANTHROPIC_API_KEY inyectada desde Secret Manager
        ▼
api.anthropic.com
```

- El modelo por defecto es **claude-haiku-4.5** (rápido y económico); también se puede elegir claude-sonnet-5.
- El servicio solo acepta esos dos modelos y limita `max_tokens` a 8000, como tope de costo por si alguien llama al proxy directamente.
- Un campo opcional de "código de acceso" permite exigir una frase compartida para poder usar el proxy público (variable de entorno `APP_ACCESS_CODE`). Si no la configuras, el proxy queda abierto a quien tenga la URL.

## 1. Requisitos

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) instalado (`gcloud`).
- Una cuenta de Google Cloud con un proyecto activo y facturación habilitada (Cloud Run y Secret Manager tienen capa gratuita amplia para este uso, pero el proyecto igual necesita una cuenta de facturación vinculada).
- Sesión iniciada: `gcloud auth login` y `gcloud config set project TU_PROYECTO`.

> Nota para Windows: si `gcloud` falla con "no se encontró Python", el SDK trae su propio intérprete. Antes de usarlo, define:
> ```powershell
> $env:CLOUDSDK_PYTHON = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\platform\bundledpython\python.exe"
> ```

## 2. Habilitar las APIs necesarias

```bash
gcloud services enable run.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## 3. Crear el secreto (la API key nunca toca este repo ni el chat)

Crea el contenedor del secreto:

```bash
gcloud secrets create anthropic-api-key --replication-policy=automatic
```

Añade tu API key real como una versión del secreto, **en tu propia terminal**, obtenida de [console.anthropic.com](https://console.anthropic.com/settings/keys):

```powershell
$key = Read-Host "Pega tu API key de Anthropic"
$key | gcloud secrets versions add anthropic-api-key --data-file=-
Remove-Variable key
```

Dale acceso de lectura del secreto a la cuenta de servicio con la que corre Cloud Run (por defecto, la de cómputo del proyecto):

```bash
gcloud secrets add-iam-policy-binding anthropic-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 4. Desplegar el servicio en Cloud Run

Desde la carpeta `gcp-proxy/` (usa Cloud Native Buildpacks, no requiere Docker):

```bash
gcloud run deploy marces-transcrypt-proxy \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets=ANTHROPIC_API_KEY=anthropic-api-key:latest \
  --set-env-vars=ALLOWED_ORIGIN=https://acidovioletax.github.io
```

El comando imprime la URL pública del servicio, algo como:

```
https://marces-transcrypt-proxy-xxxxxxxxxx-uc.a.run.app
```

Esa URL **no es secreta**, solo es la dirección del proxy.

Si prefieres construir con Docker en vez de Buildpacks, hay un `Dockerfile` opcional en `gcp-proxy/` — despliega entonces con `gcloud run deploy --image` en lugar de `--source .`.

## 5. Conectar el frontend al proxy

Edita la constante `PROXY_URL` al inicio del `<script>` en [index.html](index.html):

```js
const PROXY_URL = 'https://marces-transcrypt-proxy-xxxxxxxxxx-uc.a.run.app';
```

Si cambias el dominio de GitHub Pages, actualiza también `ALLOWED_ORIGIN` (variable de entorno del servicio de Cloud Run, se puede modificar sin redesplegar todo el código con `gcloud run services update`).

## 6. Publicar el frontend en GitHub Pages

```bash
git add index.html
git commit -m "Configurar URL del proxy de Cloud Run"
git push
```

En GitHub: **Settings → Pages → Source → Deploy from a branch → main / (root)**. La URL pública queda como `https://<usuario>.github.io/<repo>/`.

## Personalización

- **Paletas de color**: el selector de círculos junto al título permite cambiar entre Kawaii rosa (por defecto, con títulos en Mochiy Pop One), Lavanda, Menta, Durazno, Nocturno, Pastelería y Café. Las 3 últimas (Nocturno, Pastelería, Café) tienen un tratamiento extra "loco": bordes blancos en los paneles, botones con efecto 3D (se hunden al hacer clic), tamaños de título distintos por panel, una paleta de 3-4 colores por tema (no solo un acento), el título principal con un degradado animado tipo espectro, un icono de pixel art en el botón principal, y un patrón decorativo de fondo (estrellitas en Nocturno, rayas pastel en Pastelería, rayas café en Café).
- **Playlist de concentración**: embebida directamente en el panel "3. Procesar" (iframe responsivo de Spotify, ~7 canciones visibles). Para cambiarla, edita el `src` del `<iframe>` dentro de `.spotify-embed` en `index.html`.
- **Nombres de interlocutores**: configurables en la propia interfaz, se recuerdan en `localStorage`.
- **Timestamps**: checkbox para conservarlos o eliminarlos del resultado.
- **Modo de velocidad**: "Automático" (por defecto) decide sola según el largo del texto — documentos de hasta ~25,000 caracteres se procesan completos (más preciso), más largos se dividen en fragmentos (más rápido). También se puede forzar manualmente "Preciso" o "Rápido". En modo fragmentado, cada fragmento recibe solo un pequeño resumen de continuidad del anterior en vez de reenviar todo el documento en cada llamada.
- **Progreso mientras procesa**: barra de porcentaje, indicador de "paso X de ~Y" (o "fragmento X de Y" en modo rápido), y una rotación de haikus clásicos y frases anónimas breves (20 segundos cada uno, con fundido) para acompañar la espera.

## Fidelidad del resultado

- El prompt exige explícitamente que la salida contenga el contenido completo del original, sin resumir ni omitir nada; la única transformación permitida es anteponer la etiqueta del interlocutor (y quitar timestamps si se pidió).
- Si el modelo se corta por límite de tokens a mitad de una intervención, la app continúa automáticamente (hasta 6 rondas) retomando exactamente donde quedó, en vez de pedirte que subas manualmente el tope de tokens.
- Como red de seguridad adicional, al terminar la app compara el número de palabras del resultado contra el original; si el resultado tiene muchas menos palabras de las esperadas, muestra una advertencia para que revises manualmente si se omitió contenido (es una heurística aproximada, no una garantía).

## Notas de seguridad y límites

- El proxy no implementa rate-limiting real (solo tope de `max_tokens` y modelos permitidos). Si compartes la URL públicamente y quieres controlar el gasto, considera Cloud Armor, cuotas de Cloud Run, o el código de acceso opcional (`APP_ACCESS_CODE`).
- **Documentos muy largos**: usa el modo de velocidad "Rápido" para reducir el tiempo de espera; el modo "Preciso" reenvía el documento completo en cada continuación, lo que puede tardar varios minutos en transcripciones muy extensas.
- **Ambigüedad real**: si una intervención es imposible de atribuir con el contexto disponible, el modelo la marcará como `[Interlocutor incierto]:` en vez de adivinar.
- **Ejemplo de entrada**: `example/ejemplo_ficticio.txt` contiene una transcripción ficticia (sin datos reales de ninguna persona) para probar la app. No subas transcripciones reales de pacientes a este repositorio si es público — contienen datos clínicos identificables.

## Estructura del proyecto

```
transcript-labeler/
├── index.html            # Frontend estático (HTML + CSS + JS), sin dependencias externas
├── README.md
├── gcp-proxy/
│   ├── package.json
│   ├── index.js          # Servidor Node.js: recibe la transcripción, llama a Anthropic con la key de Secret Manager
│   └── Dockerfile         # Opcional, solo si despliegas por contenedor en vez de Buildpacks
└── example/
    └── ejemplo_ficticio.txt
```
