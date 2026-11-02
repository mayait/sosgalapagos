import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocationInput, extractFirstUrl } from './parse-location-input.ts';

function pointOf(input: string): [number, number] | string {
  const r = parseLocationInput(input);
  if (r.kind === 'point') return [r.latitude, r.longitude];
  if (r.kind === 'short-link') return `short:${r.url}`;
  return `invalid:${r.reason}`;
}

test('Google Maps: !3d!4d gana a @ y, si hay varios, vale el último', () => {
  assert.deepEqual(
    pointOf(
      'https://www.google.com/maps/place/Coliseo/@-0.7400,-90.3100,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-0.7432!4d-90.3122',
    ),
    [-0.7432, -90.3122],
  );
  assert.deepEqual(
    pointOf('https://www.google.com/maps/dir/data=!3d-1.1!4d-90.1!3d-0.9!4d-89.6'),
    [-0.9, -89.6],
  );
});

test('Google Maps: parámetros q, query, ll, destination, daddr, center y sll', () => {
  assert.deepEqual(pointOf('https://maps.google.com/?q=-0.7432,-90.3122'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('https://maps.google.com/?q=loc:-0.7432,-90.3122'), [-0.7432, -90.3122]);
  assert.deepEqual(
    pointOf('https://www.google.com/maps/search/?api=1&query=-0.7432%2C-90.3122'),
    [-0.7432, -90.3122],
  );
  assert.deepEqual(pointOf('https://www.google.com/maps?q=-0.7432+-90.3122'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('https://maps.google.com/maps?ll=-0.74,-90.31&z=15'), [-0.74, -90.31]);
  assert.deepEqual(
    pointOf('https://www.google.com/maps/dir/?api=1&destination=-0.74,-90.31'),
    [-0.74, -90.31],
  );
  assert.deepEqual(pointOf('https://maps.google.com/maps?daddr=-0.74,-90.31'), [-0.74, -90.31]);
  assert.deepEqual(
    pointOf('https://www.google.com/maps/@?api=1&map_action=map&center=-0.74,-90.31&zoom=12'),
    [-0.74, -90.31],
  );
  assert.deepEqual(pointOf('https://maps.google.com/maps?sll=-0.74,-90.31'), [-0.74, -90.31]);
  // Dominio de país.
  assert.deepEqual(pointOf('https://www.google.com.ec/maps?q=-0.74,-90.31'), [-0.74, -90.31]);
});

test('Google Maps: coordenadas en la ruta /maps/search|dir|place y @lat,lng,zoom', () => {
  assert.deepEqual(
    pointOf('https://www.google.com/maps/search/-0.7432,+-90.3122?entry=tts'),
    [-0.7432, -90.3122],
  );
  assert.deepEqual(
    pointOf('https://www.google.com/maps/place/-0.7432,-90.3122/@-0.7,-90.3,15z'),
    [-0.7432, -90.3122],
  );
  assert.deepEqual(
    pointOf('https://www.google.com/maps/dir/-0.95,-90.96/-0.7432,-90.3122/@-0.8,-90.5,10z'),
    [-0.7432, -90.3122],
  );
  assert.deepEqual(pointOf('https://www.google.com/maps/@-0.7432,-90.3122,15z'), [-0.7432, -90.3122]);
  // Sin esquema.
  assert.deepEqual(pointOf('www.google.com/maps/@-0.7432,-90.3122,15z'), [-0.7432, -90.3122]);
});

test('Google Maps: un lugar sin coordenadas en el enlace no se acepta', () => {
  assert.equal(pointOf('https://www.google.com/maps/place/Puerto+Ayora'), 'invalid:unrecognized');
  assert.equal(pointOf('https://maps.google.com/?q=Coliseo+de+Puerto+Ayora'), 'invalid:unrecognized');
});

test('enlaces cortos: se devuelven para expandirlos en el servidor', () => {
  assert.equal(
    pointOf('https://maps.app.goo.gl/AbC123xyz'),
    'short:https://maps.app.goo.gl/AbC123xyz',
  );
  assert.equal(pointOf('https://goo.gl/maps/AbC123'), 'short:https://goo.gl/maps/AbC123');
  assert.equal(pointOf('maps.app.goo.gl/AbC123'), 'short:https://maps.app.goo.gl/AbC123');
  // goo.gl fuera de /maps no es un enlace de mapa.
  assert.equal(pointOf('https://goo.gl/AbC123'), 'invalid:unrecognized');
});

test('geo: URI, con altitud, parámetros y q de Android', () => {
  assert.deepEqual(pointOf('geo:-0.7432,-90.3122'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('geo:-0.7432,-90.3122,12;u=35'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('geo:0,0?q=-0.7432,-90.3122(Casa)'), [-0.7432, -90.3122]);
  assert.equal(pointOf('geo:0,0'), 'invalid:out-of-range');
});

test('OpenStreetMap: mlat/mlon y #map=z/lat/lng', () => {
  assert.deepEqual(
    pointOf('https://www.openstreetmap.org/?mlat=-0.7432&mlon=-90.3122#map=17/-0.7/-90.3'),
    [-0.7432, -90.3122],
  );
  assert.deepEqual(
    pointOf('https://www.openstreetmap.org/#map=17/-0.74320/-90.31220'),
    [-0.7432, -90.3122],
  );
  assert.deepEqual(pointOf('https://osm.org/#map=15/-0.74/-90.31&layers=H'), [-0.74, -90.31]);
});

test('Apple Maps: ll y sll', () => {
  assert.deepEqual(pointOf('https://maps.apple.com/?ll=-0.7432,-90.3122&q=Pin'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('https://maps.apple.com/?sll=-0.7432,-90.3122'), [-0.7432, -90.3122]);
});

test('decimales: coma, espacio, punto y coma, paréntesis y menos tipográfico', () => {
  assert.deepEqual(pointOf('-0.7432, -90.3122'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('-0.7432 -90.3122'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('-0.7432;-90.3122'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('(-0.7432, -90.3122)'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('[-0.7432,-90.3122]'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('−0.7432, −90.3122'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('  +40.4168,-3.7038 '), [40.4168, -3.7038]);
});

test('coma decimal solo con separador ; o espacio', () => {
  assert.deepEqual(pointOf('-0,7432; -90,3122'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('-0,7432 -90,3122'), [-0.7432, -90.3122]);
  // «-0,7432,-90,3122» es ambiguo: no se adivina.
  assert.equal(pointOf('-0,7432,-90,3122'), 'invalid:unrecognized');
  assert.equal(pointOf('-0,7432, -90,3122'), 'invalid:unrecognized');
});

test('grados-minutos-segundos y letras de hemisferio', () => {
  const [lat, lng] = pointOf(`0°44'35.5"S 90°18'44.0"W`) as [number, number];
  assert.ok(Math.abs(lat - -0.743194) < 1e-5);
  assert.ok(Math.abs(lng - -90.312222) < 1e-5);

  const [lat2, lng2] = pointOf(`0º 44′ 35.5″ S, 90º 18′ 44″ O`) as [number, number];
  assert.ok(Math.abs(lat2 - -0.743194) < 1e-5);
  assert.ok(Math.abs(lng2 - -90.312222) < 1e-5);

  assert.deepEqual(pointOf('0.7432° S, 90.3122° W'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('0.7432S 90.3122W'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf('S 0.7432 W 90.3122'), [-0.7432, -90.3122]);
  // Orden lng-lat con letras: se reordena por la letra.
  assert.deepEqual(pointOf('90.3122 W 0.7432 S'), [-0.7432, -90.3122]);
  assert.deepEqual(pointOf(`40°25'N 3°42'W`)[0], 40 + 25 / 60);
  // Minutos fuera de rango, dos latitudes, o texto suelto.
  assert.equal(pointOf(`0°75'S 90°18'W`), 'invalid:unrecognized');
  assert.equal(pointOf('0.74 N 0.31 S'), 'invalid:unrecognized');
  assert.equal(pointOf('Calle 5 y 6, Barrio Norte'), 'invalid:unrecognized');
});

test('rechaza 0,0, fuera de rango e invertidas', () => {
  assert.equal(pointOf('0,0'), 'invalid:out-of-range');
  assert.equal(pointOf('0, 0'), 'invalid:out-of-range');
  assert.equal(pointOf('91, 10'), 'invalid:out-of-range');
  assert.equal(pointOf('10, 181'), 'invalid:out-of-range');
  // Pegadas al revés (lng, lat) en Galápagos: -90.31 no es una latitud válida.
  assert.equal(pointOf('-90.3122, -0.7432'), 'invalid:out-of-range');
  assert.equal(pointOf('https://www.google.com/maps/@0,0,3z'), 'invalid:out-of-range');
});

test('rechaza hosts que no son de mapas aunque lleven ?q=lat,lng', () => {
  assert.equal(pointOf('https://evil.com/?q=-0.74,-90.31'), 'invalid:unrecognized');
  assert.equal(pointOf('https://google.com.evil.com/maps?q=-0.74,-90.31'), 'invalid:unrecognized');
  assert.equal(pointOf('https://notgoogle.com/maps?q=-0.74,-90.31'), 'invalid:unrecognized');
  assert.equal(pointOf('https://www.google.com/search?q=-0.74,-90.31'), 'invalid:unrecognized');
  assert.equal(pointOf('ftp://maps.google.com/?q=-0.74,-90.31'), 'invalid:unrecognized');
});

test('vacío y texto sin ubicación', () => {
  assert.equal(pointOf('   '), 'invalid:empty');
  assert.equal(pointOf('detrás del coliseo'), 'invalid:unrecognized');
});

test('texto compartido por WhatsApp: se usa el enlace que contiene', () => {
  assert.equal(
    pointOf('Mira dónde estoy: https://maps.app.goo.gl/AbC123xyz?g_st=iw.'),
    'short:https://maps.app.goo.gl/AbC123xyz?g_st=iw',
  );
  assert.deepEqual(
    pointOf('Ubicación: https://maps.google.com/?q=-0.7432,-90.3122 (casa)'),
    [-0.7432, -90.3122],
  );
});

test('extractFirstUrl: primer enlace, sin puntuación final', () => {
  assert.equal(extractFirstUrl('hola https://a.com/x, y https://b.com'), 'https://a.com/x');
  assert.equal(extractFirstUrl('(ver https://maps.app.goo.gl/abc)'), 'https://maps.app.goo.gl/abc');
  assert.equal(
    extractFirstUrl('https://www.google.com/maps/place/A_(B)/@1,2,3z'),
    'https://www.google.com/maps/place/A_(B)/@1,2,3z',
  );
  assert.equal(extractFirstUrl('geo:-0.74,-90.31'), 'geo:-0.74,-90.31');
  assert.equal(extractFirstUrl('maps.app.goo.gl/abc'), 'https://maps.app.goo.gl/abc');
  assert.equal(extractFirstUrl('-0.74, -90.31'), null);
});
