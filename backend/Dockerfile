FROM node:18-alpine

WORKDIR /app

# Copier package.json
COPY package*.json ./

# Installer les dépendances
RUN npm install --production

# Copier le code source
COPY . .

# Créer le dossier uploads
RUN mkdir -p uploads

# Exposer le port
EXPOSE 3001

# Commande de démarrage
CMD ["node", "server.js"]
