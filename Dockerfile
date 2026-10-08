FROM node:24-alpine

WORKDIR /app

COPY . .
RUN npm ci \
	&& npm run build \
	&& npm prune --omit=dev \
	&& npm cache clean --force

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
