// Función serverless de Vercel: devuelve el precio actual de una o varias acciones.
// Usa Finnhub (finnhub.io) del lado del servidor para no exponer la llave en el navegador.
//
// Variable de entorno necesaria en Vercel (Project Settings -> Environment Variables):
//   FINNHUB_API_KEY -> tu llave gratuita de https://finnhub.io (Sign up -> API Key)
//
// La misma clave de cada persona (APP_SECRET / APP_SECRET_ISA) protege este endpoint,
// para que nadie más gaste nuestra cuota gratis de consultas.

const USERS = {
  leo: { secretEnv: 'APP_SECRET' },
  isa: { secretEnv: 'APP_SECRET_ISA' }
};

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

    if (!process.env.FINNHUB_API_KEY) {
      res.status(500).json({ error: 'Falta configurar FINNHUB_API_KEY en Vercel.' });
      return;
    }

    const symbolsParam = (req.query && req.query.symbols) || '';
    const symbols = symbolsParam.split(',').map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean);
    if (symbols.length === 0) {
      res.status(400).json({ error: 'Falta el parámetro symbols.' });
      return;
    }
    if (symbols.length > 20) {
      res.status(400).json({ error: 'Demasiados símbolos en una sola consulta.' });
      return;
    }

    const results = {};
    await Promise.all(symbols.map(async function (sym) {
      try {
        const url = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(sym) + '&token=' + process.env.FINNHUB_API_KEY;
        const r = await fetch(url);
        const data = await r.json();
        if (data && typeof data.c === 'number' && data.c > 0) {
          results[sym] = { price: data.c, change: data.d, changePct: data.dp };
        } else {
          results[sym] = { error: 'No se encontró el símbolo.' };
        }
      } catch (e) {
        results[sym] = { error: 'No se pudo consultar.' };
      }
    }));

    res.status(200).json({ quotes: results });
  } catch (err) {
    console.error('api/quote error:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
};
