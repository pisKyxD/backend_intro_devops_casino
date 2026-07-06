// Pruebas unitarias de la lógica de juegos (sin BD).
const { valorMano, nuevaMano } = require('../src/games/blackjack');
const { colorDe, jugar: jugarRuleta } = require('../src/games/roulette');
const { jugar: jugarSlots, SIMBOLOS } = require('../src/games/slots');

describe('blackjack · valorMano', () => {
  test('As + figura = 21 (blackjack)', () => {
    expect(valorMano([{ valor: 'A' }, { valor: 'K' }])).toBe(21);
  });
  test('dos Ases = 12 (un As vale 1)', () => {
    expect(valorMano([{ valor: 'A' }, { valor: 'A' }])).toBe(12);
  });
  test('As ajustable a 1 para no pasarse', () => {
    expect(valorMano([{ valor: 'A' }, { valor: '5' }, { valor: '9' }])).toBe(15);
  });
  test('figuras valen 10', () => {
    expect(valorMano([{ valor: 'K' }, { valor: 'Q' }])).toBe(20);
  });
});

describe('blackjack · nuevaMano', () => {
  test('reparte 2 cartas a cada uno y deja 48 en el mazo', () => {
    const m = nuevaMano(100);
    expect(m.jugador).toHaveLength(2);
    expect(m.banca).toHaveLength(2);
    expect(m.mazo).toHaveLength(48);
    expect(m.apuesta).toBe(100);
    expect(m.terminada).toBe(false);
  });
});

describe('ruleta · colorDe', () => {
  test('0 es verde', () => expect(colorDe(0)).toBe('verde'));
  test('1 es rojo', () => expect(colorDe(1)).toBe('rojo'));
  test('2 es negro', () => expect(colorDe(2)).toBe('negro'));
  test('36 es rojo', () => expect(colorDe(36)).toBe('rojo'));
  test('17 es negro', () => expect(colorDe(17)).toBe('negro'));
});

describe('ruleta · jugar', () => {
  test('devuelve número ganador 0..36 y resultados', () => {
    const r = jugarRuleta([{ tipo: 'color', valor: 'rojo', monto: 10 }]);
    expect(r).toBeTruthy();
    expect(r.numero).toBeGreaterThanOrEqual(0);
    expect(r.numero).toBeLessThanOrEqual(36);
  });
});

describe('slots · jugar', () => {
  test('SIMBOLOS no está vacío', () => {
    expect(Array.isArray(SIMBOLOS)).toBe(true);
    expect(SIMBOLOS.length).toBeGreaterThan(0);
  });
  test('tira 3 rodillos y un tipo de resultado válido', () => {
    const r = jugarSlots(50);
    expect(r.rodillos).toHaveLength(3);
    expect(r.apuesta).toBe(50);
    expect(['perdida', 'dos-iguales', 'tres-iguales']).toContain(r.tipo);
  });
});