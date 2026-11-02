import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInitialView, parseViewEnv, viewboxFor } from './initial-view.ts';

const FALLBACK = { latitude: 10, longitude: 20, zoom: 6 };
const p = (latitude: number, longitude: number) => ({ latitude, longitude });

test('sin puntos válidos usa la vista por defecto (o null)', () => {
  assert.deepEqual(computeInitialView([], { fallback: FALLBACK }), FALLBACK);
  assert.deepEqual(computeInitialView([p(0, 0), p(NaN, 1)], { fallback: FALLBACK }), FALLBACK);
  assert.equal(computeInitialView([], { fallback: null }), null);
});

test('un solo punto: centrado en él con zoom de calle', () => {
  assert.deepEqual(computeInitialView([p(-0.74, -90.31)], { fallback: null }), {
    latitude: -0.74,
    longitude: -90.31,
    zoom: 14,
  });
});

test('ignora puntos lejanos (continente) gracias a la mediana y al radio', () => {
  const island = [p(-0.74, -90.31), p(-0.75, -90.32), p(-0.73, -90.3), p(-0.76, -90.33)];
  const mainland = [p(-0.18, -78.47), p(-2.17, -79.92)];
  const view = computeInitialView([...island, ...mainland], { fallback: null })!;
  assert.ok(Math.abs(view.latitude - -0.745) < 0.01);
  assert.ok(Math.abs(view.longitude - -90.315) < 0.01);
  assert.ok(view.zoom >= 11, `zoom ${view.zoom}`);
});

test('el zoom se abre cuando los puntos están repartidos', () => {
  const close = computeInitialView([p(-0.74, -90.31), p(-0.75, -90.32)], { fallback: null })!;
  const spread = computeInitialView([p(-0.4, -90.6), p(-1.2, -89.4)], { fallback: null })!;
  assert.ok(spread.zoom < close.zoom);
  assert.ok(spread.zoom >= 5 && close.zoom <= 15);
});

test('si la mediana cae lejos de todos, usa el punto real más cercano', () => {
  const view = computeInitialView([p(-0.74, -90.31), p(40.4, -3.7)], { radiusKm: 50, fallback: null })!;
  assert.equal(view.zoom, 14);
  assert.ok([-0.74, 40.4].includes(view.latitude));
});

test('parseViewEnv: «lat,lng,zoom» válido o null', () => {
  assert.deepEqual(parseViewEnv('-0.742,-90.315,12'), { latitude: -0.742, longitude: -90.315, zoom: 12 });
  assert.deepEqual(parseViewEnv(' 40.4 , -3.7 , 10.6 '), { latitude: 40.4, longitude: -3.7, zoom: 11 });
  assert.equal(parseViewEnv(undefined), null);
  assert.equal(parseViewEnv(''), null);
  assert.equal(parseViewEnv('1,2'), null);
  assert.equal(parseViewEnv('0,0,5'), null);
  assert.equal(parseViewEnv('95,2,5'), null);
  assert.equal(parseViewEnv('1,2,40'), null);
  assert.equal(parseViewEnv('a,b,c'), null);
});

test('viewboxFor: oeste,sur,este,norte alrededor de la vista, recortado al mundo', () => {
  const box = viewboxFor({ latitude: -0.74, longitude: -90.31, zoom: 12 }).split(',').map(Number);
  const [w, s, e, n] = box as [number, number, number, number];
  assert.ok(w < -90.31 && e > -90.31 && s < -0.74 && n > -0.74);
  assert.ok(e - w >= 0.5);
  const world = viewboxFor({ latitude: 89, longitude: 179, zoom: 1 }).split(',').map(Number);
  assert.equal(world[2], 180);
  assert.equal(world[3], 90);
});
