import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_PICKER_STATE,
  LOCATION_DRAFT_TTL_MS,
  locationPickerReducer as reduce,
  parseDraft,
  reverseKey,
  toDraft,
  type LocationPickerState,
} from './location-picker-state.ts';

const A = { latitude: -0.74321, longitude: -90.31222 };
const B = { latitude: -0.75, longitude: -90.32 };

function marked(method: 'map' | 'search' | 'gps' | 'link' = 'map'): LocationPickerState {
  return reduce(INITIAL_PICKER_STATE, { type: 'set-point', point: A, method });
}

test('reverseKey redondea a 4 decimales', () => {
  assert.equal(reverseKey(A), '-0.7432,-90.3122');
  assert.equal(reverseKey({ latitude: 1, longitude: 2 }), '1.0000,2.0000');
});

test('marcar un punto deja pendiente su geocodificación inversa', () => {
  const s = marked();
  assert.deepEqual(s.point, A);
  assert.equal(s.method, 'map');
  assert.equal(s.pendingReverseKey, reverseKey(A));
  assert.equal(s.zoneLabel, null);
});

test('solo se aplica el resultado de la petición pendiente', () => {
  let s = marked();
  const oldKey = s.pendingReverseKey!;
  s = reduce(s, { type: 'set-point', point: B, method: 'map' });
  // Llega tarde la respuesta del punto anterior: se descarta.
  s = reduce(s, { type: 'reverse-result', key: oldKey, label: 'Zona vieja' });
  assert.equal(s.zoneLabel, null);
  s = reduce(s, { type: 'reverse-result', key: reverseKey(B), label: '  Barrio Norte ' });
  assert.equal(s.zoneLabel, 'Barrio Norte');
  assert.equal(s.pendingReverseKey, null);
  // Un fallo de una clave vieja no cambia nada.
  assert.equal(reduce(s, { type: 'reverse-failed', key: oldKey }), s);
});

test('la geocodificación inversa no toca la referencia escrita', () => {
  let s = marked();
  s = reduce(s, { type: 'set-reference', value: 'Portón verde' });
  s = reduce(s, { type: 'reverse-result', key: reverseKey(A), label: 'Barrio Norte' });
  assert.equal(s.reference, 'Portón verde');
  assert.equal(s.zoneLabel, 'Barrio Norte');
});

test('editar la referencia nunca borra el punto', () => {
  let s = marked('search');
  s = reduce(s, { type: 'set-reference', value: 'Detrás del coliseo' });
  s = reduce(s, { type: 'set-reference', value: '' });
  assert.deepEqual(s.point, A);
  assert.equal(s.method, 'search');
});

test('la referencia se corta a 200 caracteres', () => {
  const s = reduce(marked(), { type: 'set-reference', value: 'x'.repeat(250) });
  assert.equal(s.reference.length, 200);
});

test('solo búsqueda, GPS y enlace recentran el mapa', () => {
  assert.equal(marked('map').recenterSeq, 0);
  assert.equal(marked('search').recenterSeq, 1);
  assert.equal(marked('gps').recenterSeq, 1);
  assert.equal(marked('link').recenterSeq, 1);
});

test('mover dentro de la misma celda conserva la zona', () => {
  let s = marked();
  s = reduce(s, { type: 'reverse-result', key: reverseKey(A), label: 'Barrio Norte' });
  s = reduce(s, {
    type: 'set-point',
    point: { latitude: A.latitude + 0.000001, longitude: A.longitude },
    method: 'map',
  });
  assert.equal(s.zoneLabel, 'Barrio Norte');
  assert.equal(s.pendingReverseKey, null);
});

test('la precisión solo se guarda con GPS', () => {
  const gps = reduce(INITIAL_PICKER_STATE, { type: 'set-point', point: A, method: 'gps', accuracyM: 35 });
  assert.equal(gps.accuracyM, 35);
  const moved = reduce(gps, { type: 'set-point', point: B, method: 'map', accuracyM: 35 });
  assert.equal(moved.accuracyM, null);
});

test('puntos inválidos se ignoran', () => {
  const s = marked();
  assert.equal(reduce(s, { type: 'set-point', point: { latitude: 0, longitude: 0 }, method: 'map' }), s);
  assert.equal(reduce(s, { type: 'set-point', point: { latitude: 95, longitude: 0 }, method: 'map' }), s);
});

test('sugerencia de la búsqueda: se puede usar como referencia', () => {
  let s = reduce(INITIAL_PICKER_STATE, {
    type: 'set-point',
    point: A,
    method: 'search',
    suggestion: 'Coliseo de Puerto Ayora',
  });
  assert.equal(s.suggestion, 'Coliseo de Puerto Ayora');
  // Ajustar el punto en el mapa conserva la sugerencia; usar el GPS la quita.
  s = reduce(s, { type: 'set-point', point: B, method: 'map' });
  assert.equal(s.suggestion, 'Coliseo de Puerto Ayora');
  s = reduce(s, { type: 'use-suggestion' });
  assert.equal(s.reference, 'Coliseo de Puerto Ayora');
  assert.equal(s.suggestion, null);
  s = reduce(s, { type: 'set-point', point: A, method: 'search', suggestion: 'Otro' });
  s = reduce(s, { type: 'set-point', point: B, method: 'gps' });
  assert.equal(s.suggestion, null);
  assert.equal(s.reference, 'Coliseo de Puerto Ayora');
});

test('borrador: ida y vuelta, y caduca a las 24 h', () => {
  let s = reduce(INITIAL_PICKER_STATE, { type: 'set-point', point: A, method: 'gps', accuracyM: 20 });
  s = reduce(s, { type: 'reverse-result', key: reverseKey(A), label: 'Barrio Norte' });
  s = reduce(s, { type: 'set-reference', value: 'Casa azul' });
  const now = 1_700_000_000_000;
  const raw = JSON.stringify(toDraft(s, now));

  const draft = parseDraft(raw, now + 1000)!;
  const restored = reduce(INITIAL_PICKER_STATE, { type: 'restore', snapshot: draft });
  assert.deepEqual(restored.point, A);
  assert.equal(restored.method, 'gps');
  assert.equal(restored.accuracyM, 20);
  assert.equal(restored.zoneLabel, 'Barrio Norte');
  assert.equal(restored.reference, 'Casa azul');
  assert.equal(restored.recenterSeq, 1);

  assert.equal(parseDraft(raw, now + LOCATION_DRAFT_TTL_MS + 1), null);
  assert.equal(parseDraft('{malformado', now), null);
  assert.equal(parseDraft(null, now), null);
});

test('borrador sin zona pide de nuevo la geocodificación inversa', () => {
  const draft = parseDraft(
    JSON.stringify({ latitude: A.latitude, longitude: A.longitude, method: 'map', reference: '', savedAt: 1 }),
    2,
  )!;
  const s = reduce(INITIAL_PICKER_STATE, { type: 'restore', snapshot: draft });
  assert.equal(s.pendingReverseKey, reverseKey(A));
});

test('reset vuelve al estado inicial', () => {
  const s = reduce(marked('search'), { type: 'reset' });
  assert.equal(s.point, null);
  assert.equal(s.reference, '');
});
