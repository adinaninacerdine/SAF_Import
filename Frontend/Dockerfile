# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copier package.json
COPY package*.json ./
COPY postcss.config.js tailwind.config.js ./

# Installer les dépendances
RUN npm install

# Copier le code source
COPY src/ ./src/
COPY public/ ./public/

# Build l'application
RUN npm run build

# Stage 2: Production avec Nginx
FROM nginx:alpine

# Copier le build
COPY --from=builder /app/build /usr/share/nginx/html

# Copier la configuration Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
