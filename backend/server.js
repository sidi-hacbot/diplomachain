const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const port = process.env.PORT || 5000;

// ✅ Autoriser toutes les origines (pour Render)
app.use(cors({ origin: '*' }));

app.use(express.json({ limit: '50mb' }));
app.use('/api', routes);

app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});