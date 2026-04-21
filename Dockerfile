FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install --prefix client && npx --prefix client vite build && npm install --prefix server
EXPOSE 3001
CMD ["node", "server/src/index.js"]
