# Optional: only needed if you deploy via `docker build` + `gcloud run deploy --image`
# instead of the simpler `gcloud run deploy --source .` (which uses Cloud Native
# Buildpacks and needs no Dockerfile at all).
FROM node:20-slim
WORKDIR /app
COPY package.json ./
COPY index.js ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "index.js"]
