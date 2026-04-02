const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({  origin:  ['http://localhost:5500', 'http://0.0.0.0:5500'] }));
app.use(express.json({limit:'50mb'}));
app.use('/api', routes);

app.listen(port, ()=>{
	console.log(`Serveur démarré sur http://localhost:${port}`);
});