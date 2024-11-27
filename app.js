import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; // Importer la fonction fileURLToPath depuis le module 'url'

const __filename = fileURLToPath(import.meta.url); // Obtenir le chemin du fichier en cours d'exécution
const __dirname = path.dirname(__filename); // Obtenir le répertoire du fichier en cours d'exécution

const app = express();
const server = http.createServer(app);

import index from './routes/index.js';

// Nécessaire pour les .env
dotenv.config();

// Nécessaire pour le router
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/public/index.html`);
});

app.use('/api/', index);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
