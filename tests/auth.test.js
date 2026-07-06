// Pruebas unitarias del middleware de autenticación JWT.
const { firmar, requiereAuth } = require('../src/middleware/auth');

// Helpers para simular req/res de Express.
function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('auth · firmar', () => {
  test('genera un JWT con 3 segmentos', () => {
    const token = firmar({ sub: 1, username: 'demo' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('auth · requiereAuth', () => {
  test('rechaza (401) si no hay token', () => {
    const res = fakeRes();
    let llamoNext = false;
    requiereAuth({ headers: {} }, res, () => { llamoNext = true; });
    expect(res.statusCode).toBe(401);
    expect(llamoNext).toBe(false);
  });

  test('acepta un token válido y expone req.usuario', () => {
    const token = firmar({ sub: 7, username: 'tester' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = fakeRes();
    let llamoNext = false;
    requiereAuth(req, res, () => { llamoNext = true; });
    expect(llamoNext).toBe(true);
    expect(req.usuario.username).toBe('tester');
    expect(req.usuario.sub).toBe(7);
  });

  test('rechaza (401) un token inválido', () => {
    const res = fakeRes();
    let llamoNext = false;
    requiereAuth({ headers: { authorization: 'Bearer no.es.valido' } }, res, () => { llamoNext = true; });
    expect(res.statusCode).toBe(401);
    expect(llamoNext).toBe(false);
  });
});