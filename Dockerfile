FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY db ./db
COPY knexfile.js ./

USER node

EXPOSE 8000

CMD ["node", "src/index.js"]
