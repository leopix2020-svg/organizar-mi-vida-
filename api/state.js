// Función serverless de Vercel: guarda y lee los datos de "Mi Vida Organizada"
// en MongoDB. Cada persona de la familia (Leo Jr, Tizi, ...) tiene su propia
// clave y su propio documento, así los datos nunca se mezclan entre sí.
//
// Variables de entorno necesarias en Vercel (Project Settings -> Environment Variables):
//   MONGODB_URI          -> cadena de conexión de tu cluster de MongoDB Atlas
//   APP_SECRET           -> la clave de Leo Jr (la que ya se usaba antes)
//   APP_SECRET_TIZIBIZI  -> la clave de Tizi
//   MONGODB_DB           -> (opcional) nombre de la base de datos, por defecto "misfinanzas"
//
// Seguridad de los datos:
//   - Cada documento lleva un número "version". El navegador manda la versión que leyó
//     (baseVersion) y si no coincide con la actual se responde 409: así un dispositivo
//     nunca pisa lo que guardó otro.
//   - Antes de cada guardado, la versión anterior se copia a la colección "state_history"
//     (se conservan las últimas HISTORY_KEEP por persona) para poder recuperarla.
//
// Para agregar una persona más en el futuro: agrégala aquí abajo en USERS
// (con un docId nuevo y el nombre de una variable de entorno nueva), y crea
// esa variable de entorno en Vercel con su clave.

const { MongoClient } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'misfinanzas';
const COLLECTION = 'state';
const HISTORY_COLLECTION = 'state_history';
const HISTORY_KEEP = 30;

const USERS = {
  leo: { docId: 'app-state', secretEnv: 'APP_SECRET' },
  tizi: { docId: 'state-tizi', secretEnv: 'APP_SECRET_TIZIBIZI' }
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
      res.status(200).json({ value: doc ? doc.value : null, version: doc ? (doc.version || 0) : 0 });
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
      const baseVersion = body && typeof body.baseVersion === 'number' ? body.baseVersion : null;
      if (baseVersion === null) {
        res.status(409).json({ error: 'Falta la versión de los datos. Recarga la página.' });
        return;
      }

      const current = await col.findOne({ _id: docId });
      const currentVersion = current ? (current.version || 0) : 0;
      if (currentVersion !== baseVersion) {
        res.status(409).json({ error: 'Los datos cambiaron desde otro dispositivo.', version: currentVersion });
        return;
      }
      const newVersion = currentVersion + 1;

      if (current) {
        const history = db.collection(HISTORY_COLLECTION);
        await history.insertOne({ docId: docId, version: currentVersion, value: current.value, updatedAt: current.updatedAt || null, savedAt: new Date() });
        const old = await history.find({ docId: docId }).sort({ savedAt: -1 }).skip(HISTORY_KEEP).project({ _id: 1 }).toArray();
        if (old.length) await history.deleteMany({ _id: { $in: old.map(function (h) { return h._id; }) } });

        // Solo actualiza si nadie guardó entre la lectura y esta escritura.
        const versionFilter = currentVersion === 0
          ? { $or: [{ version: { $exists: false } }, { version: 0 }] }
          : { version: currentVersion };
        const result = await col.updateOne(
          Object.assign({ _id: docId }, versionFilter),
          { $set: { value: value, updatedAt: new Date(), version: newVersion } }
        );
        if (result.matchedCount === 0) {
          res.status(409).json({ error: 'Los datos cambiaron desde otro dispositivo.' });
          return;
        }
      } else {
        try {
          await col.insertOne({ _id: docId, value: value, updatedAt: new Date(), version: newVersion });
        } catch (e) {
          if (e && e.code === 11000) {
            res.status(409).json({ error: 'Los datos cambiaron desde otro dispositivo.' });
            return;
          }
          throw e;
        }
      }
      res.status(200).json({ ok: true, version: newVersion });
      return;
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    res.status(405).json({ error: 'Método no permitido.' });
  } catch (err) {
    console.error('api/state error:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
};
