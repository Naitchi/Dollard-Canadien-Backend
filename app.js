import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url'; // Importer la fonction fileURLToPath depuis le module 'url'

const __filename = fileURLToPath(import.meta.url); // Obtenir le chemin du fichier en cours d'exécution
const __dirname = path.dirname(__filename); // Obtenir le répertoire du fichier en cours d'exécution

const app = express();
const server = http.createServer(app);

import index from './routes/index.js';

// Nécessaire pour les .env
dotenv.config();

mongoose
  .connect(process.env.MONGOOSE_SECRET_TOKEN, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connexion à MongoDB réussie !'))
  .catch(() => console.log('Connexion à MongoDB échouée !'));

// Nécessaire pour le router
app.use(express.json());

app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/public/index.html`);
});

app.use('/api/', index);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
