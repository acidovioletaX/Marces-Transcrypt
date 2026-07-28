# Etiquetador de Transcripciones Clínicas

App web estática que etiqueta automáticamente quién habla (profesional / paciente) en transcripciones de entrevistas psicológicas sin marcas de interlocutor, usando la API de Claude (Anthropic) directamente desde el navegador.

No requiere backend: se puede publicar gratis en **GitHub Pages**.

## Cómo funciona

1. Pegas o cargas el `.txt` con la transcripción sin etiquetar.
2. Defines cómo se debe llamar cada interlocutor (ej. `Psicóloga Marcela` / `Paciente Osiris`).
3. Pegas tu propia API key de Anthropic (nunca sale de tu navegador, se guarda en `localStorage`).
4. La página llama directamente a `https://api.anthropic.com/v1/messages` con el prompt de reglas fijo (inferencia por estilo conversacional, sin inventar ni resumir contenido, mismo orden, etc.) y muestra el resultado etiquetado, listo para copiar o descargar.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube el contenido de esta carpeta (`index.html`, `README.md`, `example/`).
   ```bash
   cd "D:\GOOGLE CLOUD\transcript-labeler"
   git init
   git add .
   git commit -m "Etiquetador de transcripciones clínicas"
   git branch -M main
   git remote add origin <URL-de-tu-repo>
   git push -u origin main
   ```
2. En GitHub: **Settings → Pages → Source → Deploy from a branch → main / (root)**.
3. GitHub te dará una URL tipo `https://<usuario>.github.io/<repo>/`. Ábrela y ya puedes usar la app.

## Obtener una API key de Anthropic

Créala en [console.anthropic.com](https://console.anthropic.com/settings/keys). El uso de la API tiene costo asociado a tu cuenta de Anthropic (se cobra por tokens procesados), independiente de este proyecto.

## Notas y límites

- **Privacidad**: la transcripción y la API key solo viajan de tu navegador a la API de Anthropic; esta página no tiene servidor propio ni almacena nada fuera de tu `localStorage`.
- **Documentos muy largos**: el modo actual envía el documento completo en un solo llamado. Si el resultado se corta (el estado lo indicará), sube el valor de "Máximo de tokens de salida" en Opciones avanzadas, o divide la transcripción en partes y procesa cada una por separado.
- **Ambigüedad real**: si una intervención es imposible de atribuir con el contexto disponible, el modelo la marcará como `[Interlocutor incierto]:` en vez de adivinar.
- **Ejemplo de entrada**: `example/ejemplo_ficticio.txt` contiene una transcripción ficticia (sin datos reales de ninguna persona) con el mismo formato de timestamps sin etiquetar, para probar la app. No subas transcripciones reales de pacientes a este repositorio si es público — contienen datos clínicos identificables.

## Estructura del proyecto

```
transcript-labeler/
├── index.html      # App completa (HTML + CSS + JS), sin dependencias externas
├── README.md
└── example/
    └── ejemplo_ficticio.txt
```
