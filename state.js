// Función serverless de Vercel: guarda y lee los datos de "Mi Vida Organizada"
// en una sola colección de MongoDB. Es la única pieza que conoce la
// cadena de conexión a Mongo (nunca queda expuesta en el HTML del navegador).
//
// Variables de entorno necesarias en Vercel (Project Settings -> Environment Variables):
//   MONGODB_URI  -> cadena de conexión de tu cluster de MongoDB Atlas
//   APP_SECRET   -> la clave que protege tus datos (la misma que escribes en la app)
//   MONGODB_DB   -> (opcional) nombre de la base de datos, por defecto "misfinanzas"

const { MongoClient } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'misfinanzas';
const COLLECTION = 'state';
const DOC_ID = 'app-state';

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
    // La app necesita un APP_SECRET configurado para funcionar; si falta,
    // avisamos claro en vez de dejar la base de datos abierta a cualquiera.
    if (!process.env.APP_SECRET) {
      res.status(500).json({ error: 'Falta configurar APP_SECRET en Vercel.' });
      return;
    }
    const secret = req.headers['x-app-secret'] || '';
    if (secret !== process.env.APP_SECRET) {
      res.status(401).json({ error: 'Clave incorrecta.' });
      return;
    }

    const db = await getDb();
    const col = db.collection(COLLECTION);

    if (req.method === 'GET') {
      const doc = await col.findOne({ _id: DOC_ID });
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
        { _id: DOC_ID },
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
