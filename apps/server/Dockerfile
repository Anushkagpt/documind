FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
RUN npx prisma generate
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "run", "start"]
