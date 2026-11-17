// Función serverless de Vercel: comparación de Comidas entre todas las personas.
// Con la clave de cualquiera devuelve, de cada persona, SOLO la fecha, las calorías comidas
// y la meta de calorías de cada día anotado en Comidas (nutritionDays). Nada de finanzas,
// macros, quemadas ni los datos viejos de Salud.
//
// Respuesta: { users: [{ id, days: [{ date, eaten, goal }] }] }

const { USERS, COLLECTION, getDb, authUser } = require('./state.js');

function compareDays(value) {
  let s = null;
  try { s = JSON.parse(value); } catch (e) { return []; }
  const days = s && Array.isArray(s.nutritionDays) ? s.nutritionDays : [];
  return days
    .filter(function (d) { return d && typeof d.date === 'string' && d.eaten && d.goal; })
    .map(function (d) {
      return {
        date: d.date,
        eaten: typeof d.eaten.kcal === 'number' ? d.eaten.kcal : 0,
        goal: typeof d.goal.kcal === 'number' ? d.goal.kcal : 0
      };
    });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'Método no permitido.' });
      return;
    }
    if (!authUser(req, res)) return;

    const col = (await getDb()).collection(COLLECTION);
    const users = [];
    for (const id of Object.keys(USERS)) {
      const doc = await col.findOne({ _id: USERS[id].docId });
      users.push({ id: id, days: doc && typeof doc.value === 'string' ? compareDays(doc.value) : [] });
    }
    res.status(200).json({ users: users });
  } catch (err) {
    console.error('api/compare error:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
};
