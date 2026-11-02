import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocationFields } from './location-form-fields.ts';

const DEFAULT = { defaultAddress: 'Sin dirección' };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test('punto completo con referencia, método y precisión', () => {
  const r = parseLocationFields(
    form({
      address: 'Barrio Norte, Puerto Ayora',
      latitude: '-0.7432',
      longitude: '-90.3122',
      reference: '  Portón verde\njunto a la cancha ',
      method: 'gps',
      accuracyM: '23.6',
    }),
    DEFAULT,
  );
  assert.deepEqual(r, {
    ok: true,
    location: {
      address: 'Barrio Norte, Puerto Ayora',
      latitude: -0.7432,
      longitude: -90.3122,
      reference: 'Portón verde junto a la cancha',
      method: 'gps',
      accuracyM: 24,
    },
  });
});

test('sin coordenadas: required', () => {
  assert.deepEqual(parseLocationFields(form({ address: 'x' }), DEFAULT), { ok: false, error: 'required' });
  assert.deepEqual(parseLocationFields(form({ latitude: ' ', longitude: '1' }), DEFAULT), {
    ok: false,
    error: 'required',
  });
});

test('coordenadas no finitas, fuera de rango o 0,0: invalid', () => {
  for (const [latitude, longitude] of [
    ['abc', '1'],
    ['Infinity', '1'],
    ['91', '1'],
    ['1', '-181'],
    ['0', '0'],
  ] as const) {
    assert.deepEqual(parseLocationFields(form({ latitude, longitude }), DEFAULT), {
      ok: false,
      error: 'invalid',
    });
  }
});

test('dirección vacía usa la por defecto; textos se cortan a 200', () => {
  const r = parseLocationFields(
    form({ latitude: '1', longitude: '2', address: '', reference: 'r'.repeat(300) }),
    DEFAULT,
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.location.address, 'Sin dirección');
  assert.equal(r.location.reference?.length, 200);
  const long = parseLocationFields(form({ latitude: '1', longitude: '2', address: 'a'.repeat(300) }), DEFAULT);
  assert.ok(long.ok && long.location.address.length === 200);
});

test('método desconocido y precisión sin GPS se omiten', () => {
  const r = parseLocationFields(
    form({ latitude: '1', longitude: '2', method: 'telepatía', accuracyM: '10', reference: '' }),
    DEFAULT,
  );
  assert.deepEqual(r, { ok: true, location: { address: 'Sin dirección', latitude: 1, longitude: 2 } });
  const map = parseLocationFields(form({ latitude: '1', longitude: '2', method: 'map', accuracyM: '10' }), DEFAULT);
  assert.ok(map.ok && map.location.method === 'map' && map.location.accuracyM === undefined);
  const bad = parseLocationFields(form({ latitude: '1', longitude: '2', method: 'gps', accuracyM: '-5' }), DEFAULT);
  assert.ok(bad.ok && bad.location.accuracyM === undefined);
});
