# Marce's Transcrypt

App web que etiqueta automáticamente quién habla (profesional / paciente) en transcripciones de entrevistas psicológicas sin marcas de interlocutor, usando Claude (Anthropic) como motor de inferencia.

El frontend es estático (se publica en **GitHub Pages**) y llama a un **proxy propio (Cloudflare Worker)** que guarda la clave de Anthropic como secreto de servidor. La clave **nunca** viaja al navegador, ni queda en el repositorio, ni es visible para quien abra "ver código fuente" de la página pública.

## Arquitectura

```
Navegador (index.html, GitHub Pages)
        │  fetch(WORKER_URL)  — sin API key, solo texto + config
        ▼
Cloudflare Worker (worker/)
        │  x-api-key: <secreto de Cloudflare, nunca en git>
        ▼
api.anthropic.com
```

- El modelo por defecto es **claude-haiku-4.5** (rápido y económico); también se puede elegir claude-sonnet-5.
- El Worker solo acepta esos dos modelos y limita `max_tokens` a 8000, como tope de costo por si alguien llama al proxy directamente.
- Un campo opcional de "código de acceso" permite, si quieres, exigir una frase compartida para poder usar el proxy público (ver más abajo). Si no configuras ese secreto, el proxy queda abierto a quien tenga la URL.

## 1. Desplegar el proxy (Cloudflare Worker)

Requiere Node.js y una cuenta gratuita de Cloudflare (sin tarjeta de crédito para el plan free de Workers).

```bash
cd worker
npx wrangler login          # abre el navegador para autenticarte en Cloudflare
npx wrangler deploy         # publica el Worker y te imprime su URL, algo como:
                             # https://marces-transcrypt-proxy.<tu-subdominio>.workers.dev

npx wrangler secret put ANTHROPIC_API_KEY
# pega tu API key real de https://console.anthropic.com/settings/keys cuando te la pida
# (queda cifrada en Cloudflare, nunca se escribe en ningún archivo del repo)

# Opcional, para exigir un código de acceso a quien use la app pública:
npx wrangler secret put APP_ACCESS_CODE
```

Si cambias el dominio de GitHub Pages, actualiza también `ALLOWED_ORIGIN` en [worker/src/index.js](worker/src/index.js) (por defecto: `https://acidovioletax.github.io`).

## 2. Conectar el frontend al Worker

Edita la constante `WORKER_URL` al inicio del `<script>` en [index.html](index.html) con la URL que te dio `wrangler deploy`:

```js
const WORKER_URL = 'https://marces-transcrypt-proxy.<tu-subdominio>.workers.dev';
```

Este valor **no es secreto** (es solo la dirección pública del proxy), así que sí se sube al repo sin problema.

## 3. Publicar el frontend en GitHub Pages

```bash
git add index.html
git commit -m "Configurar URL del proxy"
git push
```

En GitHub: **Settings → Pages → Source → Deploy from a branch → main / (root)**. La URL pública queda como `https://<usuario>.github.io/<repo>/`.

## Personalización

- **Paletas de color**: el selector de círculos junto al título permite cambiar entre Kawaii rosa (por defecto), Lavanda, Menta, Durazno y Nocturno (oscuro). La preferencia se guarda en el navegador de cada usuario.
- **Playlist de concentración**: el botón "♪ Playlist para concentrarte" apunta al enlace de Spotify configurado en el `href` del elemento `#spotifyLink` en `index.html`.
- **Nombres de interlocutores**: configurables en la propia interfaz, se recuerdan en `localStorage`.
- **Timestamps**: checkbox para conservarlos o eliminarlos del resultado.

## Notas de seguridad y límites

- El proxy no implementa rate-limiting real (solo tope de `max_tokens` y modelos permitidos). Si compartes la URL pública ampliamente y quieres controlar el gasto, activa una regla de *Rate Limiting* gratuita desde el dashboard de Cloudflare, o usa el código de acceso opcional descrito arriba.
- **Documentos muy largos**: se envían en un solo llamado; si el resultado se corta, sube el tope de tokens en Opciones avanzadas o procesa la transcripción por partes.
- **Ambigüedad real**: si una intervención es imposible de atribuir con el contexto disponible, el modelo la marcará como `[Interlocutor incierto]:` en vez de adivinar.
- **Ejemplo de entrada**: `example/ejemplo_ficticio.txt` contiene una transcripción ficticia (sin datos reales de ninguna persona) para probar la app. No subas transcripciones reales de pacientes a este repositorio si es público — contienen datos clínicos identificables.

## Estructura del proyecto

```
transcript-labeler/
├── index.html            # Frontend estático (HTML + CSS + JS), sin dependencias externas
├── README.md
├── worker/
│   ├── wrangler.toml
│   └── src/index.js      # Proxy Cloudflare Worker: guarda la API key como secreto
└── example/
    └── ejemplo_ficticio.txt
```
