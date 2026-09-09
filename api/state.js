// Función serverless de Vercel: guarda y lee los datos de "Mi Vida Organizada"
// en MongoDB. Cada persona de la familia (Leo Jr, Isa, ...) tiene su propia
// clave y su propio documento, así los datos nunca se mezclan entre sí.
//
// Variables de entorno necesarias en Vercel (Project Settings -> Environment Variables):
//   MONGODB_URI     -> cadena de conexión de tu cluster de MongoDB Atlas
//   APP_SECRET      -> la clave de Leo Jr (la que ya se usaba antes)
//   APP_SECRET_ISA  -> la clave de Isa
//   MONGODB_DB      -> (opcional) nombre de la base de datos, por defecto "misfinanzas"
//
// Para agregar una persona más en el futuro: agrégala aquí abajo en USERS
// (con un docId nuevo y el nombre de una variable de entorno nueva), y crea
// esa variable de entorno en Vercel con su clave.

const { MongoClient } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'misfinanzas';
const COLLECTION = 'state';

const USERS = {
  leo: { docId: 'app-state', secretEnv: 'APP_SECRET' },
  isa: { docId: 'state-isa', secretEnv: 'APP_SECRET_ISA' }
};

// En un entorno serverless, cada invocación puede reutilizar procesos "tibios".
// Cachear la conexión evita abrir una conexión nueva a Mongo en cada request.
let cachedClient = null;
async function getDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Falta la variable de entorno MONGODB_URI');
  }
  if (cachedClient && cachedClient.topology && cachedClient.topology.isConnected()) {
    return cachedClient.db(DB_NAME);
  }
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client.db(DB_NAME);
}

module.exports = async function handler(req, res) {
  try {
    const userId = req.headers['x-app-user'] || '';
    const user = USERS[userId];
    if (!user) {
      res.status(400).json({ error: 'Usuario desconocido.' });
      return;
    }

    const expectedSecret = process.env[user.secretEnv];
    if (!expectedSecret) {
      res.status(500).json({ error: 'Falta configurar ' + user.secretEnv + ' en Vercel.' });
      return;
    }
    const secret = req.headers['x-app-secret'] || '';
    if (secret !== expectedSecret) {
      res.status(401).json({ error: 'Clave incorrecta.' });
      return;
    }

    const db = await getDb();
    const col = db.collection(COLLECTION);
    const docId = user.docId;

    if (req.method === 'GET') {
      const doc = await col.findOne({ _id: docId });
      res.status(200).json({ value: doc ? doc.value : null });
      return;
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      const value = body && typeof body.value === 'string' ? body.value : null;
      if (value === null) {
        res.status(400).json({ error: 'Falta el campo "value" (string) en el cuerpo de la petición.' });
        return;
      }
      await col.updateOne(
        { _id: docId },
        { $set: { value: value, updatedAt: new Date() } },
        { upsert: true }
      );
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    res.status(405).json({ error: 'Método no permitido.' });
  } catch (err) {
    console.error('api/state error:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
};
