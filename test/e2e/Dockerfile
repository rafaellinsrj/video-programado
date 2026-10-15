# Ambiente limpo para o teste de ponta a ponta (Linux), igual ao de um usuário novo.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 libxrandr2 libxkbcommon0 libxfixes3 \
      libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m testador
USER testador
WORKDIR /home/testador/app
COPY --chown=testador package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY --chown=testador . .
CMD ["node", "test/e2e/mcp-e2e.mjs"]
