/* api/state.js: versión, historial y rechazo de guardados viejos. */
import { callApi, dbDoc, historyCol, seed } from './helpers/fakeServer';

const leo = { 'x-app-user': 'leo', 'x-app-secret': 'clave-leo' };

describe('api/state', () => {
  beforeEach(() => seed('leo', { transactions: [], accounts: [] }));

  it('pide clave correcta', async () => {
    expect((await callApi('GET', { 'x-app-user': 'leo', 'x-app-secret': 'mala' })).status).toBe(401);
    expect((await callApi('GET', { 'x-app-user': 'nadie', 'x-app-secret': 'x' })).status).toBe(400);
  });

  it('documento viejo sin versión: GET da versión 0 y el primer guardado la sube a 1', async () => {
    const g = await callApi('GET', leo);
    expect(g.body.version).toBe(0);
    const p = await callApi('PUT', leo, { value: '{"v":1}', baseVersion: 0 });
    expect(p.body).toEqual({ ok: true, version: 1 });
    expect(dbDoc().version).toBe(1);
  });

  it('guarda la versión anterior en el historial (máximo 30)', async () => {
    for (let i = 0; i < 35; i++) await callApi('PUT', leo, { value: '{"v":' + i + '}', baseVersion: i });
    expect(dbDoc().version).toBe(35);
    expect(historyCol.docs.length).toBe(30);
    expect(historyCol.docs.some(h => h.value === '{"v":33}')).toBe(true);
  });

  it('rechaza con 409 un guardado con versión vieja o sin versión', async () => {
    await callApi('PUT', leo, { value: '{"v":1}', baseVersion: 0 });
    expect((await callApi('PUT', leo, { value: '{"pisado":true}', baseVersion: 0 })).status).toBe(409);
    expect((await callApi('PUT', leo, { value: '{"pisado":true}' })).status).toBe(409);
    expect(dbDoc().value).toBe('{"v":1}');
  });

  it('usuario nuevo: crea su documento', async () => {
    seed('leo', {});
    (await import('./helpers/fakeServer')).stateCol.docs.length = 0;
    const p = await callApi('PUT', { 'x-app-user': 'tizi', 'x-app-secret': 'clave-tizi' }, { value: '{}', baseVersion: 0 });
    expect(p.body.version).toBe(1);
  });
});
