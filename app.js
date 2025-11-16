const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// URI de MongoDB (local por defecto; cambia si usas MongoDB Atlas)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/xpres';
let mongoClient;
let mongoDb;

// Conectar a MongoDB al iniciar el servidor
(async () => {
  try {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db();
    console.log('✓ Conectado a MongoDB:', MONGO_URI);
  } catch (err) {
    console.error('✗ Error conectando a MongoDB:', err.message);
    console.error('  Asegúrate de que MongoDB esté corriendo en localhost:27017 o configura MONGO_URI.');
  }
})();

// Middleware para parsear JSON entrante
app.use(express.json());

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));
// Si quieres una respuesta JSON en la raíz, mantenla; pero ahora también servimos `public/index.html`
app.get('/', (req, res) => {
  res.send({ message: 'Servidor Express activo. Abre /index.html para la UI o usa /internal, /internal-async, /external, /receive' });
});

// 1) JSON interno: cargar con require (sincrónico, cacheado)
app.get('/internal', (req, res) => {
  try {
    const data = require('./data/data.json');
    res.json({ source: 'require', data });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo cargar data interna con require', details: err.message });
  }
});

// 1b) JSON interno: lectura asíncrona desde disco (no cacheado)
app.get('/internal-async', (req, res) => {
  const file = path.join(__dirname, 'data', 'data.json');
  fs.readFile(file, 'utf8', (err, raw) => {
    if (err) return res.status(500).json({ error: 'Lectura fallida', details: err.message });
    try {
      const data = JSON.parse(raw);
      res.json({ source: 'fs.readFile', data });
    } catch (parseErr) {
      res.status(500).json({ error: 'JSON inválido en disco', details: parseErr.message });
    }
  });
});

// 2) JSON externo: obtener con axios y reenviar (actúa como proxy)
app.get('/external', async (req, res) => {
  // URL de ejemplo, puedes pasar ?url= para probar cualquier endpoint público
  const url = req.query.url || 'https://jsonplaceholder.typicode.com/todos/1';
  try {
    const response = await axios.get(url, { timeout: 5000 });
    res.json({ source: 'external', url, data: response.data });
  } catch (err) {
    const status = err.response ? err.response.status : 502;
    res.status(status).json({ error: 'Error al obtener JSON externo', details: err.message });
  }
});

// 3) Recibir JSON entrante y guardarlo en disco (POST /receive)
app.post('/receive', (req, res) => {
  const payload = req.body;
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Body JSON vacío o no enviado' });
  }

  const dest = path.join(__dirname, 'data', `received-${Date.now()}.json`);
  fs.writeFile(dest, JSON.stringify(payload, null, 2), 'utf8', (err) => {
    if (err) return res.status(500).json({ error: 'No se pudo guardar el JSON', details: err.message });
    res.status(201).json({ message: 'JSON recibido y guardado', file: path.basename(dest) });
  });
});

// 4) Recibir JSON y guardarlo en MongoDB (POST /receive-mongo)
app.post('/receive-mongo', async (req, res) => {
  const payload = req.body;
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Body JSON vacío o no enviado' });
  }
  
  if (!mongoDb) {
    return res.status(503).json({ error: 'MongoDB no está disponible. Asegúrate de que esté corriendo.' });
  }

  try {
    const collection = mongoDb.collection('received');
    const doc = { ...payload, created_at: new Date() };
    const result = await collection.insertOne(doc);
    res.status(201).json({ message: 'JSON guardado en MongoDB', _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar en MongoDB', details: err.message });
  }
});

// 5) Listar registros guardados en MongoDB (GET /received-mongo)
app.get('/received-mongo', async (req, res) => {
  if (!mongoDb) {
    return res.status(503).json({ error: 'MongoDB no está disponible.' });
  }

  try {
    const collection = mongoDb.collection('received');
    const docs = await collection.find({}).sort({ _id: -1 }).limit(100).toArray();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Error leyendo MongoDB', details: err.message });
  }
});

// Manejo de rutas no encontradas
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
