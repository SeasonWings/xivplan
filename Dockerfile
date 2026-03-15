FROM node:20-alpine AS web-build
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile; elif [ -f package-lock.json ]; then npm ci; else npm i; fi
COPY . .
RUN npm run build

FROM node:20-alpine AS server
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* backend/pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile; elif [ -f package-lock.json ]; then npm ci; else npm i; fi
COPY backend ./
COPY --from=web-build /app/dist ./dist
EXPOSE 3000
CMD ["node", "app.js"]
