// Actualización del 4-nov-2026 de los puntos, las necesidades y las tareas de
// galapagos-2026, por la API (igual que seed-galapagos.mjs). Es idempotente:
// se puede volver a ejecutar sin duplicar.
//
// Uso:  API_URL=https://sosgalapagos.org/backend ADMIN_EMAIL=… ADMIN_PASSWORD=… node galapagos/actualizar-2026-11-04.mjs
//       Añade --seco para ver qué haría sin escribir nada.
//
// Fuente: grupos de coordinación de la sociedad civil, las ONG y la USFQ
// (2 al 3 de noviembre) y la coordinación de SOS Galápagos. El único refugio
// autorizado es el Colegio Miguel Ángel Cazares; los demás de la lista del GAD
// del 31-oct quedan cerrados.
//
// Privacidad: sin teléfonos, sin nombres de personas y con necesidades agregadas.

const API = process.env.API_URL ?? 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const SECO = process.argv.includes('--seco');
if (!EMAIL || !PASSWORD) throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios');

let TOKEN = '';
async function call(method, path, body, { allow = [] } = {}) {
  if (SECO && method !== 'GET' && path !== '/auth/login') {
    console.log(`  [seco] ${method} ${path}`, body ? JSON.stringify(body).slice(0, 160) : '');
    return { status: 0, data: { id: 'seco' } };
  }
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok && !allow.includes(res.status)) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return { status: res.status, data };
}
const lista = (d) => (Array.isArray(d) ? d : d?.items ?? []);

const MOTIVO = 'Actualización 4-nov-2026 con la información de los grupos de coordinación';
const CERRADO =
  'Ya no es un refugio autorizado. Al 3-nov-2026 el único refugio autorizado es el Colegio Miguel Ángel Cazares (Puerto Ayora).';

// Coordenadas de OpenStreetMap (extracto Geofabrik del 31-oct-2026).
const P = {
  puertoAyora: { address: 'Puerto Ayora, Santa Cruz, Galápagos', latitude: -0.7453, longitude: -90.3135 },
  cazares: { address: 'Colegio Nacional Miguel Ángel Cazares, Puerto Ayora, Santa Cruz', latitude: -0.73861, longitude: -90.31807 },
  // OSM way 61233032 (Coliseo Cerrado de Deportes Santa Cruz). La bodega del club de ciclismo está junto al coliseo.
  coliseo: { address: 'Bodega del club de ciclismo, junto al Coliseo Cerrado de Deportes, Puerto Ayora, Santa Cruz', latitude: -0.73757, longitude: -90.31433 },
  // OSM way 557992783 (Centro de Información de Energías Renovables).
  energias: { address: 'Centro de Energías Renovables, Pampas Coloradas, Puerto Ayora, Santa Cruz', latitude: -0.74585, longitude: -90.31853 },
  bellavista: { address: 'Bellavista, Santa Cruz, Galápagos', latitude: -0.6945, longitude: -90.3249 },
  laCascada: { address: 'Barrio La Cascada, Puerto Ayora, Santa Cruz', latitude: -0.7335, longitude: -90.3137 },
};

async function main() {
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  TOKEN = login.data.accessToken ?? login.data.token ?? login.data.access_token;
  if (!TOKEN) throw new Error('Login sin token');
  const E = (await call('GET', '/emergencies/by-slug/galapagos-2026')).data.id;
  const org = lista((await call('GET', '/organizations/mine')).data).find((o) => o.name === 'USFQ Galápagos');
  if (!org) throw new Error('No encuentro la organización USFQ Galápagos');
  const mios = lista((await call('GET', `/emergencies/${E}/resources/mine`)).data);
  const porNombre = (n) => mios.find((r) => r.name === n);
  console.log(`✓ sesión, emergencia ${E}, ${mios.length} puntos propios`);

  // 1) Refugios: solo el Cazares sigue abierto.
  const cerrar = [
    'Refugio — Colegio Nacional Galápagos (Miraflores)',
    'Refugio — Iglesia de Jesucristo de los Santos de los Últimos Días',
    'Refugio — Techado del barrio Las Palmas (Bellavista)',
    'Refugio — Coliseo Segundo Chapi (Santa Rosa)',
  ];
  for (const nombre of cerrar) {
    const r = porNombre(nombre);
    if (!r) { console.log('  · no está:', nombre); continue; }
    await call('PATCH', `/resources/${r.id}`, { reason: MOTIVO, description: CERRADO });
    if (r.publicStatus === 'hidden') console.log('  · sin publicar, no cambio el estado:', nombre);
    else await call('POST', `/resources/${r.id}/status`, { status: 'closed' }, { allow: [400] });
    console.log('✓ cerrado:', nombre);
  }

  const editar = [
    {
      nombre: 'Refugio — Colegio Miguel Ángel Cazares',
      cambios: {
        name: 'Refugio autorizado — Colegio Miguel Ángel Cazares',
        description:
          'Único refugio autorizado en Santa Cruz (3-nov-2026). Aquí se está reuniendo a las familias que estaban en otros refugios y en hoteles. Tiene camas, colchones y comida. Es también centro de acopio.',
      },
      estado: 'active',
    },
    {
      nombre: 'Centro de acopio oficial — Colegio Miguel Ángel Cazares',
      cambios: {
        description:
          'Centro de acopio y único refugio autorizado. Aquí se arman los kits de ropa y comida. No se recibe ropa usada. Hace falta repelente, agua, artículos de higiene y pañales.',
      },
      estado: 'active',
    },
    {
      // Ya no es refugio: solo el Cazares está autorizado. Se sigue usando para clasificar y entregar kits.
      nombre: 'Oficina USFQ Santa Cruz — refugio temporal',
      cambios: {
        name: 'Oficina USFQ Santa Cruz — clasificación y entrega de kits',
        description:
          'Oficina de la USFQ, frente a Bodega Blanca. Aquí los voluntarios de la brigada USFQ clasifican y arman kits. No es punto de entrega al público ni refugio.',
      },
      estado: 'paused',
    },
  ];
  for (const e of editar) {
    const r = porNombre(e.nombre) ?? porNombre(e.cambios.name);
    if (!r) { console.log('  · no está:', e.nombre); continue; }
    await call('PATCH', `/resources/${r.id}`, { reason: MOTIVO, ...e.cambios });
    if (e.estado && r.publicStatus !== 'hidden') await call('POST', `/resources/${r.id}/status`, { status: e.estado }, { allow: [400] });
    console.log('✓ actualizado:', e.cambios.name ?? e.nombre);
  }

  // 2) Puntos nuevos.
  const nuevos = [
    {
      type: 'collection_point',
      name: 'Acopio — Bodega del club de ciclismo (junto al coliseo)',
      description:
        'Recibe y reparte donaciones a La Cascada, El Bosque, Guayabillos, Aguacatal y la parte alta. Hace falta agua, repelente, pañales (de niño y de adulto), toallas húmedas, papel higiénico y artículos de higiene. No se recibe ropa usada. Ubicación aproximada: junto al Coliseo Cerrado de Deportes (OpenStreetMap).',
      location: P.coliseo, city: 'Puerto Ayora', accepts: ['water', 'hygiene', 'food_non_perishable'],
      fuente: 'Grupos de la sociedad civil',
    },
    {
      type: 'venue',
      name: 'Control de embarazadas y posparto — Centro de Energías Renovables',
      description:
        'Según un aviso difundido el 2-nov-2026, desde el 4-nov hay controles para mujeres embarazadas y madres que acaban de dar a luz. Ubicación: Centro de Energías Renovables, Pampas Coloradas (OpenStreetMap). Horario por confirmar en el centro de salud.',
      location: P.energias, city: 'Puerto Ayora',
      fuente: 'Ministerio de Salud Pública (aviso del 2-nov-2026)',
    },
  ];
  for (const n of nuevos) {
    if (porNombre(n.name)) { console.log('  · ya existe:', n.name); continue; }
    const { fuente, ...dto } = n;
    const creado = (await call('POST', `/emergencies/${E}/resources`, {
      ...dto, country: 'EC', ownerOrganizationId: org.id, sourceOrganisation: fuente,
    })).data;
    await call('POST', `/resources/${creado.id}/verify`, {}, { allow: [400, 409, 422] });
    await call('POST', `/resources/${creado.id}/publish`, {}, { allow: [400, 409, 422] });
    console.log('✓ punto nuevo:', n.name);
  }

  // 3) Necesidades de hoy (las del 1-nov caducaron a las 48 h).
  const needs = [
    {
      title: 'Repelente y mosquiteros (prevención de dengue)', priority: 'urgent', location: P.cazares,
      description: 'Hay muchos mosquitos y aguas estancadas en las quebradas. Repelente con DEET, de preferencia a granel, y mosquiteros para el refugio y las familias, además de los que ya vienen en camino.',
      items: [
        { name: 'Repelente con DEET', quantity: 1, unit: 'lote', category: 'hygiene' },
        { name: 'Mosquitero para cama', quantity: 1, unit: 'lote', category: 'shelter' },
      ],
    },
    {
      title: 'Agua para los barrios sin servicio', priority: 'urgent', location: P.bellavista,
      description: 'Se pide agua para beber en la parte alta y en barrios de Puerto Ayora. Entregar en los puntos de acopio. Comprar en Santa Cruz: no enviar agua entre islas.',
      items: [{ name: 'Agua embotellada', quantity: 1, unit: 'lote', category: 'water' }],
    },
    {
      title: 'Pañales, toallas húmedas y artículos de higiene', priority: 'high', location: P.coliseo,
      description: 'Pañales de niño (talla XL) y de adulto (talla G), toallas húmedas, papel higiénico, jabón, toallas higiénicas, pasta y cepillos de dientes.',
      items: [
        { name: 'Pañales de niño talla XL', quantity: 1, unit: 'lote', category: 'hygiene_infantile' },
        { name: 'Pañales de adulto talla G', quantity: 1, unit: 'lote', category: 'hygiene_personal' },
        { name: 'Toallas húmedas y papel higiénico', quantity: 1, unit: 'lote', category: 'hygiene_personal' },
      ],
    },
    {
      title: 'Víveres para las cocinas comunitarias (Torraja y La Colmena)', priority: 'high', location: P.puertoAyora,
      description: 'Las cocinas comunitarias dan tres comidas al día a las familias afectadas. Necesitan verduras (tomate, cebolla, pimiento), proteína y víveres no perecibles.',
      items: [
        { name: 'Verduras', quantity: 1, unit: 'lote', category: 'food_fresh' },
        { name: 'Proteína (pollo, carne, huevos)', quantity: 1, unit: 'lote', category: 'food_fresh' },
        { name: 'Víveres no perecibles', quantity: 1, unit: 'lote', category: 'food_non_perishable' },
      ],
    },
    {
      title: 'Botas de caucho para la limpieza de viviendas', priority: 'medium', location: P.laCascada,
      description: 'Para quienes limpian el lodo de las casas (militares, voluntarios y familias). Tallas variadas.',
      items: [{ name: 'Botas de caucho', quantity: 1, unit: 'lote', category: 'tools' }],
    },
    {
      title: 'Duchas para el refugio del Colegio Cazares', priority: 'high', location: P.cazares,
      description: 'El refugio recibe a las familias de los otros refugios y de los hoteles y le faltan duchas. Se necesitan materiales y manos para instalarlas.',
      items: [{ name: 'Materiales para duchas', quantity: 1, unit: 'lote', category: 'shelter' }],
    },
    {
      title: 'Suero oral, linternas y chubasqueros', priority: 'medium', location: P.cazares,
      description: 'Suero de rehidratación oral, linternas con pilas y chubasqueros para las familias del refugio y de la parte alta.',
      items: [
        { name: 'Suero de rehidratación oral', quantity: 1, unit: 'lote', category: 'medical_supplies' },
        { name: 'Linterna con pilas', quantity: 1, unit: 'lote', category: 'other' },
        { name: 'Chubasquero', quantity: 1, unit: 'lote', category: 'clothing' },
      ],
    },
    {
      title: 'Alimento y accesorios para perros y gatos', priority: 'medium', location: P.puertoAyora,
      description: 'Para los animales de las familias afectadas. Alimento balanceado o húmedo, collares, correas, transportadoras y toallas. Lo reciben Pan Animalia, Patitas Galapagueñas y Juanchito al Rescate.',
      items: [{ name: 'Alimento para perros y gatos', quantity: 1, unit: 'lote', category: 'other_pets' }],
    },
  ];
  const vigentes = new Set(lista((await call('GET', `/emergencies/${E}/public/needs?limit=100`)).data).map((n) => n.title));
  for (const n of needs) {
    if (vigentes.has(n.title)) { console.log('  · ya vigente:', n.title); continue; }
    const creada = (await call('POST', `/emergencies/${E}/needs`, { ...n, requesterOrganizationId: org.id })).data;
    await call('POST', `/needs/${creada.id}/validate`, {}, { allow: [400, 409, 422] });
    console.log('✓ necesidad:', n.title);
  }

  // 4) Tareas de voluntariado.
  const tasks = [
    { title: 'Llevar ayuda en vehículo a la parte alta', description: 'Faltan vehículos para llevar agua, comida y kits a Bellavista, El Bosque, Guayabillos, Aguacatal, Miconia y Los Arrayanes. Salir desde la bodega del club de ciclismo, junto al coliseo. No hacer entregas durante aguaceros.', location: P.coliseo, requiredSkill: 'driving' },
    { title: 'Ayudar en las cocinas comunitarias', description: 'Preparar y repartir comida con la Fundación Torraja y La Colmena.', location: P.puertoAyora, requiredSkill: 'cooking' },
    { title: 'Limpieza de lodo en viviendas de La Cascada', description: 'Con botas, guantes y palas. Coordinar con el refugio o el punto de acopio antes de ir; no ir solo a las zonas afectadas. No entrar a zonas evacuadas ni a cauces de quebrada, no ir con lluvia y seguir las indicaciones del COE y de los bomberos.', location: P.laCascada, requiredSkill: 'general' },
  ];
  const tareas = new Set(lista((await call('GET', `/emergencies/${E}/tasks`)).data).map((t) => t.title));
  for (const t of tasks) {
    if (tareas.has(t.title)) { console.log('  · ya existe:', t.title); continue; }
    await call('POST', `/emergencies/${E}/tasks`, t);
    console.log('✓ tarea:', t.title);
  }
  console.log('\nListo.');
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
