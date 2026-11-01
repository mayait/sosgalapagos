// Precarga la emergencia "Inundaciones El Niño — Galápagos 2026" en una
// instancia LOCAL de ResponseGrid, usando la API pública (respeta el dominio).
//
// Uso:  ADMIN_EMAIL=... ADMIN_PASSWORD=... node galapagos/seed-galapagos.mjs
//
// Privacidad: NO se cargan nombres de personas afectadas ni estados de salud.
// Las necesidades se describen de forma agregada/anonimizada; las ubicaciones de
// necesidades las aproxima el propio backend (±300 m).

const API = process.env.API_URL ?? 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios');

let TOKEN = '';
async function call(method, path, body, { allow = [] } = {}) {
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

// ── Lugares (coordenadas de OSM / Nominatim) ─────────────────────────────────
const P = {
  puertoAyora: { address: 'Puerto Ayora, Santa Cruz, Galápagos', latitude: -0.7453, longitude: -90.3135 },
  laCascada: { address: 'Barrio La Cascada, Puerto Ayora, Santa Cruz', latitude: -0.7335, longitude: -90.3137 },
  flamingo: { address: 'Hotel Flamingo, Tomás de Berlanga, Barrio Central, Puerto Ayora', latitude: -0.7458, longitude: -90.3127 },
  viamar: { address: 'Viamar (recepción de carga), Puerto Ayora — ubicación por confirmar', latitude: -0.7480, longitude: -90.3110 },
  oficinaUsfqSC: { address: 'Oficina USFQ Galápagos, Puerto Ayora — ubicación por confirmar', latitude: -0.7445, longitude: -90.3140 },
  gsc: { address: 'Galapagos Science Center, Vía Universidad, Puerto Baquerizo Moreno, San Cristóbal', latitude: -0.8955, longitude: -89.6087 },
  bellavista: { address: 'Bellavista, Santa Cruz, Galápagos', latitude: -0.6945, longitude: -90.3249 },
  villamil: { address: 'Puerto Villamil, Isabela, Galápagos', latitude: -0.9561, longitude: -90.9656 },
  // Albergues y acopio del comunicado del COE Provincial y del GAD (1-nov-2026).
  // Coordenadas de OpenStreetMap (extracto Geofabrik del 31-oct-2026).
  cazares: { address: 'Colegio Nacional Miguel Ángel Cazares, Puerto Ayora, Santa Cruz', latitude: -0.73861, longitude: -90.31807 }, // OSM way 126176328
  colegioNacional: { address: 'Colegio Nacional Galápagos, barrio Miraflores, Puerto Ayora, Santa Cruz', latitude: -0.73844, longitude: -90.31658 }, // OSM
  iglesiaSUD: { address: 'Iglesia de Jesucristo de los Santos de los Últimos Días, Puerto Ayora, Santa Cruz', latitude: -0.73869, longitude: -90.31091 }, // OSM node 3106268566
  lasPalmas: { address: 'Techado del barrio Las Palmas, Bellavista, Santa Cruz — ubicación aproximada', latitude: -0.69678, longitude: -90.32415 }, // centro del barrio (CGREG)
  coliseoSantaRosa: { address: 'Coliseo Segundo Chapi, Santa Rosa, Santa Cruz', latitude: -0.6517, longitude: -90.40729 }, // OSM way 115927391
};

const ANNOUNCEMENT = [
  'Inundaciones por El Niño en Galápagos (noche del 30 al 31 de octubre de 2026). El COE declaró la emergencia en Santa Cruz; el barrio La Cascada (Puerto Ayora) es el más afectado. Actualizado: domingo 1 de noviembre, 12:20.',
  'Albergues (COE Provincial y GAD Santa Cruz): en Puerto Ayora, Colegio Nacional Galápagos (Miraflores), Colegio Miguel Ángel Cazares e Iglesia de Jesucristo de los Santos de los Últimos Días; en Bellavista, el techado del barrio Las Palmas; en Santa Rosa, el coliseo Segundo Chapi. Centro de acopio oficial: Colegio Miguel Ángel Cazares.',
  'Agua: la captación de La Camiseta ya funciona. Puerto Ayora tendrá distribución parcial cuando se llenen los tanques de El Mirador. Bellavista, sus alrededores y El Mirador siguen sin servicio. La entrega en hidrantes para tanqueros está suspendida.',
  'Si eres damnificado, completa el formulario de línea base del COE: https://docs.google.com/forms/d/e/1FAIpQLSe-wb4SGX8Z0IxRUCjMUBgY3XFLGGc-wwmfPux6aTaGxxOCzQ/viewform',
  'Clima: el INAMHI pronostica lluvia fuerte en Santa Cruz e Isabela. El riesgo está en la parte alta, que alimenta las encañadas. Para emergencias, llama al ECU 911.',
  'No envíes donaciones físicas desde el continente: ponen en riesgo la bioseguridad y saturan la logística. Dona dinero a organizaciones con trazabilidad, nunca a cuentas personales, y compra en Santa Cruz. Ante la mínima duda sobre el estado de un alimento, descártalo.',
].join('\n\n');

async function main() {
  // 1) Sesión
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  TOKEN = login.data.accessToken ?? login.data.token ?? login.data.access_token;
  if (!TOKEN) throw new Error('Login sin token: ' + JSON.stringify(login.data));
  console.log('✓ sesión iniciada');

  // 2) Emergencia
  let em = (await call('GET', '/emergencies/by-slug/galapagos-2026', undefined, { allow: [404] })).data;
  if (!em?.id) {
    em = (await call('POST', '/emergencies', {
      name: 'Inundaciones El Niño — Galápagos 2026',
      slug: 'galapagos-2026',
      country: 'EC',
    })).data;
  }
  const E = em.id;
  await call('PUT', `/emergencies/${E}/announcement`, { message: ANNOUNCEMENT });
  console.log('✓ emergencia', E);

  // 3) Organización
  const mine = (await call('GET', '/organizations/mine')).data;
  let org = (Array.isArray(mine) ? mine : mine?.items ?? []).find((o) => o.name === 'USFQ Galápagos');
  if (!org) {
    org = (await call('POST', '/organizations', {
      name: 'USFQ Galápagos',
      type: 'other',
      contactEmail: EMAIL,
    })).data;
  }
  console.log('✓ organización USFQ Galápagos', org.id);

  // 3b) Organizaciones aliadas (solo instituciones; sin contactos personales)
  const aliadas = [
    { name: 'Funcavid — Fundación Un Cambio por la Vida', type: 'ngo' },
    { name: 'Fundación Charles Darwin (FCD)', type: 'ngo' },
    { name: 'Fundación Jocotoco', type: 'ngo' },
    { name: 'Galápagos Life Fund', type: 'ngo' },
    { name: 'Galapagos Conservancy', type: 'ngo' },
    { name: 'Fundación ECOS', type: 'ngo' },
    { name: 'CAPTURGAL — Cámara Provincial de Turismo de Galápagos', type: 'association' },
  ];
  const mineList = Array.isArray(mine) ? mine : mine?.items ?? [];
  let nOrgs = 0;
  for (const o of aliadas) {
    if (mineList.some((x) => x.name === o.name)) continue;
    await call('POST', '/organizations', o);
    nOrgs++;
  }
  console.log('✓ organizaciones aliadas nuevas', nOrgs);

  // 4) Puntos logísticos
  const resources = [
    {
      key: 'gsc', type: 'collection_point', name: 'Centro de acopio GSC (San Cristóbal)',
      description: 'Recibe donaciones en San Cristóbal y despacha a Santa Cruz por barco. Ropa: bolsa marcada con talla y si es de hombre o mujer.',
      location: P.gsc, city: 'Puerto Baquerizo Moreno', accepts: ['food_non_perishable', 'water', 'hygiene', 'medical_supplies', 'clothing'],
      schedule: 'Todos los días, horario por confirmar',
    },
    {
      key: 'viamar', type: 'delivery_point', name: 'Recepción de carga en Puerto Ayora (Viamar)',
      description: 'Llegada de envíos desde San Cristóbal. Falta definir quién recibe y a dónde se redistribuye.',
      location: P.viamar, city: 'Puerto Ayora', accepts: ['food_non_perishable', 'water', 'hygiene', 'clothing'],
    },
    {
      key: 'flamingo', type: 'venue', name: 'Hotel Flamingo — alojamiento temporal y entrega de kits',
      description: 'Alojamiento temporal de familias desplazadas de la comunidad USFQ. Custodia temporal de kits para entrega. Sin habitaciones libres al 31-oct.',
      location: P.flamingo, city: 'Puerto Ayora', capacity: 15, occupancy: 15, isFinalRecipient: true,
    },
    {
      key: 'oficina', type: 'venue', name: 'Oficina USFQ Santa Cruz — albergue temporal',
      description: 'Aula habilitable como albergue temporal: baño, ducha y sofá cama.',
      location: P.oficinaUsfqSC, city: 'Puerto Ayora', capacity: 4,
    },
    {
      key: 'cazares', type: 'collection_point', name: 'Centro de acopio oficial — Colegio Miguel Ángel Cazares',
      description: 'Centro de acopio oficial y albergue. Aquí se arman los kits. Fuente: comunicado del COE Provincial y del GAD Santa Cruz (1-nov-2026). Ubicación: OpenStreetMap.',
      location: P.cazares, city: 'Puerto Ayora', accepts: ['hygiene', 'water', 'food_non_perishable'],
    },
    {
      key: 'albColegioNacional', type: 'venue', name: 'Albergue — Colegio Nacional Galápagos (Miraflores)',
      description: 'Albergue habilitado. Fuente: comunicado del COE Provincial y del GAD Santa Cruz (1-nov-2026). Ubicación: OpenStreetMap.',
      location: P.colegioNacional, city: 'Puerto Ayora', isFinalRecipient: true,
    },
    {
      key: 'albCazares', type: 'venue', name: 'Albergue — Colegio Miguel Ángel Cazares',
      description: 'Albergue habilitado; es también el centro de acopio oficial. Fuente: comunicado del COE Provincial y del GAD Santa Cruz (1-nov-2026). Ubicación: OpenStreetMap.',
      location: P.cazares, city: 'Puerto Ayora', isFinalRecipient: true,
    },
    {
      key: 'albIglesia', type: 'venue', name: 'Albergue — Iglesia de Jesucristo de los Santos de los Últimos Días',
      description: 'Albergue habilitado. Fuente: comunicado del COE Provincial y del GAD Santa Cruz (1-nov-2026). Ubicación: OpenStreetMap.',
      location: P.iglesiaSUD, city: 'Puerto Ayora', isFinalRecipient: true,
    },
    {
      key: 'albLasPalmas', type: 'venue', name: 'Albergue — Techado del barrio Las Palmas (Bellavista)',
      description: 'Albergue habilitado. Fuente: comunicado del COE Provincial y del GAD Santa Cruz (1-nov-2026). Ubicación aproximada (centro del barrio Las Palmas): falta ubicar el techado exacto.',
      location: P.lasPalmas, city: 'Bellavista', isFinalRecipient: true,
    },
    {
      key: 'albSantaRosa', type: 'venue', name: 'Albergue — Coliseo Segundo Chapi (Santa Rosa)',
      description: 'Albergue habilitado. Fuente: comunicado del COE Provincial y del GAD Santa Cruz (1-nov-2026). Ubicación: OpenStreetMap, donde figura como «Coliseo Cerrado de Deportes Sta. Rosa»; por confirmar que sea el mismo.',
      location: P.coliseoSantaRosa, city: 'Santa Rosa', isFinalRecipient: true,
    },
  ];
  const R = {};
  const existing = (await call('GET', `/emergencies/${E}/resources/mine`)).data;
  const existingList = Array.isArray(existing) ? existing : existing?.items ?? [];
  for (const r of resources) {
    const { key, ...dto } = r;
    let found = existingList.find((x) => x.name === dto.name);
    if (!found) {
      found = (await call('POST', `/emergencies/${E}/resources`, {
        ...dto, country: 'EC', ownerOrganizationId: org.id, sourceOrganisation: 'USFQ Galápagos',
      })).data;
      await call('POST', `/resources/${found.id}/verify`, {}, { allow: [400, 409, 422] });
      await call('POST', `/resources/${found.id}/publish`, {}, { allow: [400, 409, 422] });
    }
    R[key] = found.id;
  }
  console.log('✓ puntos logísticos', Object.keys(R).length);

  // 5) Necesidades (agregadas, sin nombres)
  const needs = [
    {
      title: 'Repelente a granel y mosquiteros (prevención de dengue)', priority: 'urgent', location: P.laCascada,
      description: 'Anticipando una segunda ola de dengue tras la inundación. Repelente en galones para evitar frascos plásticos.',
      items: [
        { name: 'Repelente de mosquitos a granel', quantity: 10, unit: 'galón', category: 'hygiene' },
        { name: 'Mosquitero para cama', quantity: 60, unit: 'unidad', category: 'shelter' },
      ],
    },
    {
      title: 'Agua embotellada — Puerto Ayora sin agua de red', priority: 'urgent', location: P.puertoAyora,
      description: 'El suministro por red pública está suspendido por algunos días.',
      items: [{ name: 'Agua embotellada', quantity: 300, unit: 'galón', category: 'water' }],
    },
    {
      title: 'Ropa por tallas para familias que perdieron todo', priority: 'high', location: P.laCascada,
      description: 'Varias personas solo tienen lo que llevan puesto. Falta el inventario de tallas: se compra localmente según tallas, no se recibe ropa usada desde Quito.',
      items: [{ name: 'Mudas de ropa (según inventario de tallas)', quantity: 40, unit: 'muda', category: 'clothing' }],
      requiredSkill: 'logistics',
    },
    {
      title: 'Kits de víveres, higiene y primeros auxilios', priority: 'high', location: P.laCascada,
      description: 'Kits de ~USD 100: alimentos no perecibles, agua, higiene, gel, gasas y alcohol. Ya se armaron 6–7 kits; hacen falta más según el censo.',
      items: [
        { name: 'Kit de alimentos no perecibles', quantity: 20, unit: 'kit', category: 'food_non_perishable' },
        { name: 'Kit de higiene personal', quantity: 20, unit: 'kit', category: 'hygiene_personal' },
        { name: 'Botiquín básico (gel, gasas, alcohol)', quantity: 20, unit: 'kit', category: 'medical_supplies' },
      ],
    },
    {
      title: 'Alojamiento temporal para familias desplazadas', priority: 'urgent', location: P.puertoAyora,
      description: 'Al menos una familia de 3 adultos (una persona con movilidad reducida) y 2 niños sin alojamiento. Hoteles con factura, 1–2 semanas.',
      items: [{ name: 'Plazas de alojamiento (noche)', quantity: 5, unit: 'plaza', category: 'shelter' }],
    },
    {
      title: 'Baterías portátiles para cargar teléfonos', priority: 'medium', location: P.puertoAyora,
      description: 'Para mantener comunicación con familias afectadas; se pueden rotar entre kits.',
      items: [{ name: 'Power bank', quantity: 15, unit: 'unidad', category: 'tools' }],
    },
    {
      title: 'Artículos de higiene: toallas higiénicas, jabón, pasta y cepillos de dientes', priority: 'high', location: P.cazares,
      description: 'Pedido del 1-nov para los albergues. Entregar en el centro de acopio del Colegio Miguel Ángel Cazares. Cantidades por confirmar: comprar en Santa Cruz.',
      items: [
        { name: 'Toallas higiénicas', quantity: 1, unit: 'lote', category: 'hygiene_personal' },
        { name: 'Jabón', quantity: 1, unit: 'lote', category: 'hygiene_personal' },
        { name: 'Pasta y cepillos de dientes', quantity: 1, unit: 'lote', category: 'hygiene_personal' },
      ],
    },
    {
      title: 'Fundas para armar kits en el Colegio Miguel Ángel Cazares', priority: 'high', location: P.cazares,
      description: 'Para empacar los kits que se arman en el centro de acopio. Cantidad por confirmar.',
      items: [{ name: 'Fundas para kits', quantity: 1, unit: 'lote', category: 'other' }],
    },
    {
      title: 'Ponchos de agua para la Policía (pedido del CGREG)', priority: 'medium', location: P.puertoAyora,
      description: 'Ya hay un aliado gestionándolos; confirmar antes de comprar para no duplicar.',
      items: [{ name: 'Poncho de agua', quantity: 20, unit: 'unidad', category: 'clothing' }],
    },
  ];
  const existingNeeds = (await call('GET', `/emergencies/${E}/needs/queue`)).data;
  const existingNeedTitles = new Set((Array.isArray(existingNeeds) ? existingNeeds : existingNeeds?.items ?? []).map((n) => n.title));
  const publicNeeds = (await call('GET', `/emergencies/${E}/public/needs`)).data;
  (Array.isArray(publicNeeds) ? publicNeeds : publicNeeds?.items ?? []).forEach((n) => existingNeedTitles.add(n.title));
  let nNeeds = 0;
  for (const n of needs) {
    if (existingNeedTitles.has(n.title)) continue;
    const created = (await call('POST', `/emergencies/${E}/needs`, { ...n, requesterOrganizationId: org.id })).data;
    await call('POST', `/needs/${created.id}/validate`, {}, { allow: [400, 409, 422] });
    nNeeds++;
  }
  console.log('✓ necesidades nuevas', nNeeds);

  // 6) Tareas de voluntariado
  const tasks = [
    { title: 'Levantar inventario de tallas', description: 'Contactar a las familias afectadas y registrar tallas (adulto/niño, hombre/mujer) para comprar ropa localmente.', location: P.puertoAyora, requiredSkill: 'admin' },
    { title: 'Recibir carga en Viamar y redistribuir', description: 'Recibir las cajas que llegan desde San Cristóbal y llevarlas al punto de entrega acordado. Con factura (transporte local).', location: P.viamar, requiredSkill: 'driving' },
    { title: 'Entregar kits custodiados en el Hotel Flamingo', description: 'Coordinar con la persona responsable en el hotel y confirmar cada entrega en la plataforma.', location: P.flamingo, requiredSkill: 'logistics' },
    { title: 'Completar censo de la comunidad (personas por confirmar)', description: 'Llamar a estudiantes y colaboradores que siguen “por confirmar” y actualizar su estado. No publicar datos personales.', location: P.puertoAyora, requiredSkill: 'admin' },
    { title: 'Diagnóstico de necesidades en Bellavista / parte alta', description: 'Recorrer y reportar (parte de campo) necesidades y accesos en la parte alta. Revisar vías y quebradas en el mapa antes de salir.', location: P.bellavista, requiredSkill: 'general' },
    { title: 'Armar kits para familias acogientes (con Funcavid)', description: 'Funcavid arma entre 24 y 30 kits para familias acogientes. Sumarse al armado y a la entrega.', location: P.cazares, requiredSkill: 'logistics' },
    { title: 'Voluntariado en el Colegio Miguel Ángel Cazares (con Fundación ECOS)', description: 'Apoyo en el centro de acopio y albergue: recepción, clasificación y armado de kits. Coordina Fundación ECOS.', location: P.cazares, requiredSkill: 'general' },
    { title: 'Isabela: punto focal y diagnóstico inicial', description: 'Identificar un punto focal en Puerto Villamil y reportar si hay afectaciones o necesidades.', location: P.villamil, requiredSkill: 'general' },
  ];
  const existingTasks = (await call('GET', `/emergencies/${E}/tasks`)).data;
  const taskTitles = new Set((Array.isArray(existingTasks) ? existingTasks : existingTasks?.items ?? []).map((t) => t.title));
  let nTasks = 0;
  for (const t of tasks) {
    if (taskTitles.has(t.title)) continue;
    await call('POST', `/emergencies/${E}/tasks`, t);
    nTasks++;
  }
  console.log('✓ tareas nuevas', nTasks);

  // 7) Expedición San Cristóbal → Santa Cruz
  const ships = (await call('GET', `/emergencies/${E}/logistics/shipments`)).data;
  if ((Array.isArray(ships) ? ships : ships?.items ?? []).length === 0) {
    await call('POST', '/logistics/shipments', {
      emergencyId: E, originResourceId: R.gsc, destinationResourceId: R.viamar,
      manifest: '5 cajas desde el acopio GSC (primer envío por barco).',
      items: [{ name: 'Cajas de donaciones mixtas', quantity: 5, unit: 'caja', category: 'other' }],
    });
    console.log('✓ expedición GSC → Viamar');
  }

  console.log(`\nListo: http://localhost:3001/e/galapagos-2026`);
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
