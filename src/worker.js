import { createRemoteJWKSet, jwtVerify } from 'jose';

const EMPLOYEES = ['Steffen', 'Henrik', 'Sæter', 'Nyansatt 1'];
const STATUS_VALUES = ['planned', 'in_progress', 'completed', 'cancelled'];
const PAYMENT_VALUES = ['card', 'invoice', 'unknown'];
const MAX_BODY_BYTES = 2_000_000;
const MAX_IMPORT_JOBS = 5000;

const jwksCache = new Map();

class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

function cleanString(value, max = 1000) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function cleanBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function cleanNumber(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeIsoDateTime(value, fallback = '') {
  const text = cleanString(value, 40);
  if (!text) return fallback;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
}

function normalizeJob(input = {}, existing = {}) {
  const now = new Date().toISOString();
  const employee = EMPLOYEES.includes(input.employee)
    ? input.employee
    : (existing.employee || EMPLOYEES[0]);
  const paymentMethod = PAYMENT_VALUES.includes(input.paymentMethod)
    ? input.paymentMethod
    : (existing.paymentMethod || 'unknown');
  const status = STATUS_VALUES.includes(input.status)
    ? input.status
    : (existing.status || 'planned');

  const duration = Math.round(cleanNumber(input.durationMins, existing.durationMins || 90));
  const latitude = cleanNumber(input.latitude, existing.latitude ?? null);
  const longitude = cleanNumber(input.longitude, existing.longitude ?? null);

  const job = {
    id: cleanString(existing.id || input.id || crypto.randomUUID(), 100),
    employee,
    date: cleanString(input.date ?? existing.date, 10),
    startTime: cleanString(input.startTime ?? existing.startTime ?? '08:00', 5),
    durationMins: Math.max(15, Math.min(720, duration)),
    status,
    customerName: cleanString(input.customerName ?? existing.customerName, 160),
    contactPerson: cleanString(input.contactPerson ?? existing.contactPerson, 160),
    phone: cleanString(input.phone ?? existing.phone, 60),
    email: cleanString(input.email ?? existing.email, 160),
    orgNo: cleanString(input.orgNo ?? existing.orgNo, 40),
    address: cleanString(input.address ?? existing.address, 240),
    latitude,
    longitude,
    locationCapturedAt: normalizeIsoDateTime(
      input.locationCapturedAt ?? existing.locationCapturedAt,
      existing.locationCapturedAt || ''
    ),
    jobType: cleanString(input.jobType ?? existing.jobType, 120),
    vehicleInfo: cleanString(input.vehicleInfo ?? existing.vehicleInfo, 180),
    regNo: cleanString(input.regNo ?? existing.regNo, 80),
    description: cleanString(input.description ?? existing.description, 2500),
    paymentMethod,
    invoiceEmail: cleanString(input.invoiceEmail ?? existing.invoiceEmail, 160),
    invoiceReference: cleanString(input.invoiceReference ?? existing.invoiceReference, 160),
    invoiceSent: cleanBoolean(input.invoiceSent ?? existing.invoiceSent),
    invoiceSentAt: normalizeIsoDateTime(
      input.invoiceSentAt ?? existing.invoiceSentAt,
      existing.invoiceSentAt || ''
    ),
    cardPaid: cleanBoolean(input.cardPaid ?? existing.cardPaid),
    cardPaidAt: normalizeIsoDateTime(
      input.cardPaidAt ?? existing.cardPaidAt,
      existing.cardPaidAt || ''
    ),
    notes: cleanString(input.notes ?? existing.notes, 2500),
    createdAt: normalizeIsoDateTime(existing.createdAt || input.createdAt, now),
    updatedAt: now
  };

  if (job.invoiceSent && !job.invoiceSentAt) job.invoiceSentAt = now;
  if (!job.invoiceSent) job.invoiceSentAt = '';
  if (job.cardPaid && !job.cardPaidAt) job.cardPaidAt = now;
  if (!job.cardPaid) job.cardPaidAt = '';

  return job;
}

function validateJob(job) {
  const errors = [];
  if (!EMPLOYEES.includes(job.employee)) errors.push('Ugyldig ansatt');
  if (!job.date || !/^\d{4}-\d{2}-\d{2}$/.test(job.date)) errors.push('Dato må fylles ut');
  if (!/^\d{2}:\d{2}$/.test(job.startTime)) errors.push('Starttid må være på formatet TT:MM');
  if (!job.customerName) errors.push('Kundenavn må fylles ut');
  if (!job.address && (job.latitude === null || job.longitude === null)) {
    errors.push('Adresse eller geotag må fylles ut');
  }
  if (job.latitude !== null && (job.latitude < -90 || job.latitude > 90)) errors.push('Ugyldig breddegrad');
  if (job.longitude !== null && (job.longitude < -180 || job.longitude > 180)) errors.push('Ugyldig lengdegrad');
  if (job.email && !/^\S+@\S+\.\S+$/.test(job.email)) errors.push('Ugyldig e-postadresse');
  if (job.invoiceEmail && !/^\S+@\S+\.\S+$/.test(job.invoiceEmail)) errors.push('Ugyldig faktura-e-post');
  return errors;
}

function rowToJob(row) {
  return {
    id: row.id,
    employee: row.employee,
    date: row.date,
    startTime: row.start_time,
    durationMins: Number(row.duration_mins),
    status: row.status,
    customerName: row.customer_name,
    contactPerson: row.contact_person || '',
    phone: row.phone || '',
    email: row.email || '',
    orgNo: row.org_no || '',
    address: row.address || '',
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    locationCapturedAt: row.location_captured_at || '',
    jobType: row.job_type || '',
    vehicleInfo: row.vehicle_info || '',
    regNo: row.reg_no || '',
    description: row.description || '',
    paymentMethod: row.payment_method,
    invoiceEmail: row.invoice_email || '',
    invoiceReference: row.invoice_reference || '',
    invoiceSent: Boolean(row.invoice_sent),
    invoiceSentAt: row.invoice_sent_at || '',
    cardPaid: Boolean(row.card_paid),
    cardPaidAt: row.card_paid_at || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const JOB_COLUMNS = [
  'id', 'employee', 'date', 'start_time', 'duration_mins', 'status',
  'customer_name', 'contact_person', 'phone', 'email', 'org_no', 'address',
  'latitude', 'longitude', 'location_captured_at', 'job_type', 'vehicle_info',
  'reg_no', 'description', 'payment_method', 'invoice_email', 'invoice_reference',
  'invoice_sent', 'invoice_sent_at', 'card_paid', 'card_paid_at', 'notes',
  'created_at', 'updated_at', 'deleted_at'
];

const JOB_SELECT = `SELECT ${JOB_COLUMNS.join(', ')} FROM jobs`;

function jobBindings(job, deletedAt = null) {
  return [
    job.id,
    job.employee,
    job.date,
    job.startTime,
    job.durationMins,
    job.status,
    job.customerName,
    job.contactPerson,
    job.phone,
    job.email,
    job.orgNo,
    job.address,
    job.latitude,
    job.longitude,
    job.locationCapturedAt,
    job.jobType,
    job.vehicleInfo,
    job.regNo,
    job.description,
    job.paymentMethod,
    job.invoiceEmail,
    job.invoiceReference,
    job.invoiceSent ? 1 : 0,
    job.invoiceSentAt,
    job.cardPaid ? 1 : 0,
    job.cardPaidAt,
    job.notes,
    job.createdAt,
    job.updatedAt,
    deletedAt
  ];
}

const INSERT_JOB_SQL = `
  INSERT INTO jobs (${JOB_COLUMNS.join(', ')})
  VALUES (${JOB_COLUMNS.map(() => '?').join(', ')})
`;

const UPSERT_JOB_SQL = `${INSERT_JOB_SQL}
  ON CONFLICT(id) DO UPDATE SET
    employee = excluded.employee,
    date = excluded.date,
    start_time = excluded.start_time,
    duration_mins = excluded.duration_mins,
    status = excluded.status,
    customer_name = excluded.customer_name,
    contact_person = excluded.contact_person,
    phone = excluded.phone,
    email = excluded.email,
    org_no = excluded.org_no,
    address = excluded.address,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    location_captured_at = excluded.location_captured_at,
    job_type = excluded.job_type,
    vehicle_info = excluded.vehicle_info,
    reg_no = excluded.reg_no,
    description = excluded.description,
    payment_method = excluded.payment_method,
    invoice_email = excluded.invoice_email,
    invoice_reference = excluded.invoice_reference,
    invoice_sent = excluded.invoice_sent,
    invoice_sent_at = excluded.invoice_sent_at,
    card_paid = excluded.card_paid,
    card_paid_at = excluded.card_paid_at,
    notes = excluded.notes,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    deleted_at = NULL
`;

const UPDATE_JOB_SQL = `
  UPDATE jobs SET
    employee = ?, date = ?, start_time = ?, duration_mins = ?, status = ?,
    customer_name = ?, contact_person = ?, phone = ?, email = ?, org_no = ?,
    address = ?, latitude = ?, longitude = ?, location_captured_at = ?, job_type = ?,
    vehicle_info = ?, reg_no = ?, description = ?, payment_method = ?, invoice_email = ?,
    invoice_reference = ?, invoice_sent = ?, invoice_sent_at = ?, card_paid = ?,
    card_paid_at = ?, notes = ?, updated_at = ?
  WHERE id = ? AND deleted_at IS NULL
`;

function updateBindings(job) {
  return [
    job.employee,
    job.date,
    job.startTime,
    job.durationMins,
    job.status,
    job.customerName,
    job.contactPerson,
    job.phone,
    job.email,
    job.orgNo,
    job.address,
    job.latitude,
    job.longitude,
    job.locationCapturedAt,
    job.jobType,
    job.vehicleInfo,
    job.regNo,
    job.description,
    job.paymentMethod,
    job.invoiceEmail,
    job.invoiceReference,
    job.invoiceSent ? 1 : 0,
    job.invoiceSentAt,
    job.cardPaid ? 1 : 0,
    job.cardPaidAt,
    job.notes,
    job.updatedAt,
    job.id
  ];
}

async function parseJsonBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) throw new HttpError(413, 'Forespørselen er for stor');

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'Forespørselen er for stor');
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Ugyldig JSON');
  }
}

function assertSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin) throw new HttpError(403, 'Forespørselen ble blokkert');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite === 'cross-site') throw new HttpError(403, 'Forespørselen ble blokkert');
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'Kun JSON støttes');
  }
}

function isLocalRequest(url) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

function adminEmails(env) {
  return cleanString(env.ADMIN_EMAILS || '', 5000)
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

function getJwks(teamDomain) {
  if (!jwksCache.has(teamDomain)) {
    jwksCache.set(
      teamDomain,
      createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`))
    );
  }
  return jwksCache.get(teamDomain);
}

async function authenticate(request, env) {
  const url = new URL(request.url);
  const mode = cleanString(env.AUTH_MODE || 'cloudflare-access', 40).toLowerCase();

  if (isLocalRequest(url)) {
    return { email: 'lokal-utvikling@optituning.no', name: 'Lokal utvikling', isAdmin: true, local: true };
  }

  if (mode === 'off') {
    return { email: 'usikret@optituning.no', name: 'Usikret modus', isAdmin: true, local: false };
  }

  if (mode !== 'cloudflare-access') {
    throw new HttpError(503, 'Ugyldig AUTH_MODE i Worker-konfigurasjonen');
  }

  const teamDomainRaw = cleanString(env.TEAM_DOMAIN || '', 300).replace(/\/$/, '');
  const teamDomain = teamDomainRaw && !/^https?:\/\//i.test(teamDomainRaw)
    ? `https://${teamDomainRaw}`
    : teamDomainRaw;
  const audience = cleanString(env.POLICY_AUD || '', 500);

  if (!teamDomain || !audience) {
    throw new HttpError(
      503,
      'Cloudflare Access er ikke ferdig konfigurert. TEAM_DOMAIN og POLICY_AUD må settes.'
    );
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new HttpError(401, 'Innlogging kreves');

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: teamDomain,
      audience
    });
    const email = cleanString(payload.email || payload.sub || '', 320).toLowerCase();
    if (!email) throw new Error('Token mangler e-post');
    const admins = adminEmails(env);
    return {
      email,
      name: cleanString(payload.name || email, 200),
      isAdmin: admins.length === 0 || admins.includes(email),
      local: false
    };
  } catch (error) {
    console.warn('Cloudflare Access-token ble avvist:', error?.message || 'ukjent feil');
    throw new HttpError(401, 'Innloggingen kunne ikke bekreftes');
  }
}

function requireAdmin(user) {
  if (!user.isAdmin) throw new HttpError(403, 'Denne handlingen krever administratorrettigheter');
}

async function audit(db, user, action, jobId = '', snapshot = null) {
  const payload = snapshot === null ? '' : JSON.stringify(snapshot).slice(0, 100_000);
  return db.prepare(`
    INSERT INTO job_events (id, job_id, actor_email, action, occurred_at, snapshot_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    cleanString(jobId, 100),
    cleanString(user.email, 320),
    cleanString(action, 80),
    new Date().toISOString(),
    payload
  );
}

async function getJob(db, id) {
  const row = await db.prepare(`${JOB_SELECT} WHERE id = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(id)
    .first();
  return row ? rowToJob(row) : null;
}

async function handleApi(request, env, user, url) {
  if (!env.DB) throw new HttpError(503, 'D1-databasen er ikke koblet til Worker-applikasjonen');
  assertSameOrigin(request);

  const { pathname, searchParams } = url;

  if (pathname === '/api/me' && request.method === 'GET') {
    return json({
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      employees: EMPLOYEES,
      authMode: user.local ? 'local' : (env.AUTH_MODE || 'cloudflare-access')
    });
  }

  if (pathname === '/api/employees' && request.method === 'GET') {
    return json(EMPLOYEES);
  }

  if (pathname === '/api/jobs' && request.method === 'GET') {
    const conditions = ['deleted_at IS NULL'];
    const bindings = [];
    const from = cleanString(searchParams.get('from'), 10);
    const to = cleanString(searchParams.get('to'), 10);
    const employee = cleanString(searchParams.get('employee'), 100);

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      conditions.push('date >= ?');
      bindings.push(from);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      conditions.push('date <= ?');
      bindings.push(to);
    }
    if (employee && EMPLOYEES.includes(employee)) {
      conditions.push('employee = ?');
      bindings.push(employee);
    }

    const result = await env.DB.prepare(
      `${JOB_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY date ASC, start_time ASC, created_at ASC`
    ).bind(...bindings).all();
    return json((result.results || []).map(rowToJob));
  }

  if (pathname === '/api/jobs' && request.method === 'POST') {
    const body = await parseJsonBody(request);
    const job = normalizeJob(body);
    const errors = validateJob(job);
    if (errors.length) throw new HttpError(400, errors.join('. '));

    const insert = env.DB.prepare(INSERT_JOB_SQL).bind(...jobBindings(job));
    await env.DB.batch([insert, await audit(env.DB, user, 'job.created', job.id, job)]);
    return json(job, 201);
  }

  if (pathname === '/api/jobs/replace' && request.method === 'POST') {
    requireAdmin(user);
    const body = await parseJsonBody(request);
    if (!Array.isArray(body.jobs)) throw new HttpError(400, 'jobs må være en liste');
    if (body.jobs.length > MAX_IMPORT_JOBS) {
      throw new HttpError(400, `Maksimalt ${MAX_IMPORT_JOBS} jobber kan importeres om gangen`);
    }

    const normalized = body.jobs.map(item => normalizeJob(item, {
      id: item?.id ? cleanString(item.id, 100) : undefined,
      createdAt: normalizeIsoDateTime(item?.createdAt, new Date().toISOString())
    }));
    const invalid = normalized.flatMap(validateJob);
    if (invalid.length) throw new HttpError(400, `Ugyldige jobber: ${invalid.slice(0, 5).join('. ')}`);

    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE jobs SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL').bind(now, now),
      await audit(env.DB, user, 'jobs.replace.started', '', { count: normalized.length })
    ]);

    const chunkSize = 80;
    for (let index = 0; index < normalized.length; index += chunkSize) {
      const chunk = normalized.slice(index, index + chunkSize);
      await env.DB.batch(chunk.map(job => env.DB.prepare(UPSERT_JOB_SQL).bind(...jobBindings(job))));
    }

    await env.DB.batch([
      await audit(env.DB, user, 'jobs.replace.completed', '', { count: normalized.length })
    ]);
    return json({ ok: true, count: normalized.length });
  }

  if (pathname === '/api/audit' && request.method === 'GET') {
    requireAdmin(user);
    const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit') || 100)));
    const result = await env.DB.prepare(`
      SELECT id, job_id, actor_email, action, occurred_at
      FROM job_events
      ORDER BY occurred_at DESC
      LIMIT ?
    `).bind(limit).all();
    return json(result.results || []);
  }

  const match = pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);

    if (request.method === 'PUT') {
      const existing = await getJob(env.DB, id);
      if (!existing) throw new HttpError(404, 'Jobben finnes ikke');
      const body = await parseJsonBody(request);
      const job = normalizeJob(body, existing);
      const errors = validateJob(job);
      if (errors.length) throw new HttpError(400, errors.join('. '));

      const update = env.DB.prepare(UPDATE_JOB_SQL).bind(...updateBindings(job));
      await env.DB.batch([update, await audit(env.DB, user, 'job.updated', job.id, job)]);
      return json(job);
    }

    if (request.method === 'DELETE') {
      requireAdmin(user);
      const existing = await getJob(env.DB, id);
      if (!existing) throw new HttpError(404, 'Jobben finnes ikke');
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare('UPDATE jobs SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
          .bind(now, now, id),
        await audit(env.DB, user, 'job.deleted', id, existing)
      ]);
      return json({ ok: true });
    }
  }

  throw new HttpError(404, 'API-endepunktet finnes ikke');
}

function addSecurityHeaders(response, pathname, isApi = false) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self';"
  );

  if (isApi) {
    headers.set('Cache-Control', 'no-store');
  } else if (pathname === '/' || pathname.endsWith('.html') || pathname === '/sw.js') {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=3600');
  }

  if (pathname === '/sw.js') headers.set('Service-Worker-Allowed', '/');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function errorResponse(error, pathname = '') {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : 'Intern serverfeil';
  if (!(error instanceof HttpError)) console.error(error);

  if (pathname.startsWith('/api/')) {
    return json({ error: message, details: error?.details }, status);
  }

  const safeMessage = message.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  return new Response(`<!doctype html>
<html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Optituning – tilgang</title><style>
body{font-family:system-ui,sans-serif;background:#101927;color:#fff;min-height:100vh;display:grid;place-items:center;margin:0;padding:24px}
main{max-width:620px;background:#182438;border:1px solid #33445f;border-radius:20px;padding:32px;box-shadow:0 20px 60px #0006}
h1{margin:0 0 12px;font-size:28px}p{line-height:1.55;color:#d5deea}code{background:#0c1421;padding:3px 7px;border-radius:7px}
</style></head><body><main><h1>Optituning Jobbstyring</h1><p>${safeMessage}</p><p>Statuskode: <code>${status}</code></p></main></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return addSecurityHeaders(new Response(null, { status: 204 }), url.pathname, url.pathname.startsWith('/api/'));
    }

    try {
      if (url.pathname === '/api/health') {
        if (!env.DB) throw new HttpError(503, 'D1-databasen er ikke koblet til');
        const result = await env.DB.prepare('SELECT 1 AS ok').first();
        return addSecurityHeaders(json({
          ok: result?.ok === 1,
          service: env.APP_NAME || 'Optituning Jobbstyring',
          time: new Date().toISOString()
        }), url.pathname, true);
      }

      const user = await authenticate(request, env);

      if (url.pathname.startsWith('/api/')) {
        const response = await handleApi(request, env, user, url);
        return addSecurityHeaders(response, url.pathname, true);
      }

      if (!env.ASSETS) throw new HttpError(503, 'Statiske filer er ikke koblet til Worker-applikasjonen');
      const assetResponse = await env.ASSETS.fetch(request);
      return addSecurityHeaders(assetResponse, url.pathname, false);
    } catch (error) {
      return addSecurityHeaders(errorResponse(error, url.pathname), url.pathname, url.pathname.startsWith('/api/'));
    }
  }
};
