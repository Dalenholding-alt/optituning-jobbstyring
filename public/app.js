const EMPLOYEES = ['Steffen', 'Henrik', 'Sæter', 'Nyansatt 1'];
const STATUS_LABELS = {
  planned: 'Planlagt',
  in_progress: 'Pågår',
  completed: 'Ferdig',
  cancelled: 'Avlyst'
};

const state = {
  jobs: [],
  currentWeekStart: startOfWeek(new Date()),
  selectedEmployee: localStorage.getItem('optituning.selectedEmployee') || 'all',
  dayContext: null,
  loading: false,
  currentUser: null
};

const $ = selector => document.querySelector(selector);

const els = {
  weekNumber: $('#weekNumber'),
  weekTitle: $('#weekTitle'),
  weekGrid: $('#weekGrid'),
  employeeFilters: $('#employeeFilters'),
  alertsList: $('#alertsList'),
  connectionStatus: $('#connectionStatus'),
  weekPlanSummary: $('#weekPlanSummary'),
  jobDialog: $('#jobDialog'),
  jobForm: $('#jobForm'),
  dialogTitle: $('#dialogTitle'),
  formError: $('#formError'),
  dataMenu: $('#dataMenu'),
  geoStatus: $('#geoStatus'),
  mapLink: $('#mapLink'),
  deleteJobBtn: $('#deleteJobBtn'),
  dayDialog: $('#dayDialog'),
  dayDialogTitle: $('#dayDialogTitle'),
  dayDialogSummary: $('#dayDialogSummary'),
  dayDialogList: $('#dayDialogList'),
  dayRouteBtn: $('#dayRouteBtn'),
  currentUser: $('#currentUser')
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function startOfWeek(date) {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  const weekday = result.getDay() || 7;
  result.setDate(result.getDate() - weekday + 1);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isoWeekNumber(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' }).format(date);
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat('nb-NO', { weekday: 'short' }).format(date).replace('.', '');
}

function formatFullWeekday(date) {
  const value = new Intl.DateTimeFormat('nb-NO', { weekday: 'long' }).format(date);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTime(value) {
  return value || '—';
}

function formatDuration(minutes) {
  const value = Number(minutes || 0);
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours}t ${rest}m` : `${hours}t`;
}

function formatTotalDuration(minutes) {
  const value = Number(minutes || 0);
  if (!value) return '0 timer';
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} t ${rest} min` : `${hours} timer`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function daysSince(dateKey) {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.floor((now - parseDateKey(dateKey)) / 86400000);
}

function isInvoiceAlert(job) {
  return job.paymentMethod === 'invoice'
    && !job.invoiceSent
    && job.status === 'completed'
    && daysSince(job.date) >= 7;
}

function withinWeek(job, weekStart = state.currentWeekStart) {
  const start = toDateKey(weekStart);
  const end = toDateKey(addDays(weekStart, 6));
  return job.date >= start && job.date <= end;
}

function displayedEmployees() {
  return state.selectedEmployee === 'all' ? EMPLOYEES : [state.selectedEmployee];
}

function selectedJobs() {
  return state.selectedEmployee === 'all'
    ? state.jobs
    : state.jobs.filter(job => job.employee === state.selectedEmployee);
}

function jobsForEmployeeDay(employee, dateKey) {
  return state.jobs
    .filter(job => job.employee === employee && job.date === dateKey)
    .sort((a, b) => `${a.startTime || ''}${a.customerName}`.localeCompare(`${b.startTime || ''}${b.customerName}`, 'nb'));
}

function jobsForEmployeeWeek(employee) {
  return state.jobs
    .filter(job => job.employee === employee && withinWeek(job) && job.status !== 'cancelled')
    .sort((a, b) => `${a.date}${a.startTime || ''}`.localeCompare(`${b.date}${b.startTime || ''}`));
}

function capacityClass(count) {
  if (count < 2) return 'low';
  if (count > 10) return 'high';
  return 'good';
}

function capacityLabel(count) {
  if (count < 2) return 'Ledig';
  if (count > 10) return 'Overbooket';
  return 'Planlagt';
}

function employeeInitials(name) {
  if (name === 'Nyansatt 1') return 'N1';
  if (name === 'Sæter') return 'SÆ';
  return name.slice(0, 1).toUpperCase();
}

function paymentPill(job) {
  if (job.paymentMethod === 'card') {
    return `<span class="meta-pill payment-card">${job.cardPaid ? 'Kort betalt' : 'Kort ikke markert'}</span>`;
  }
  if (job.paymentMethod === 'invoice') {
    if (isInvoiceAlert(job)) return '<span class="meta-pill payment-alert">Faktura mangler</span>';
    return `<span class="meta-pill payment-invoice">${job.invoiceSent ? 'Faktura sendt' : 'Faktura'}</span>`;
  }
  return '<span class="meta-pill">Betaling ikke avklart</span>';
}

function locationLabel(job) {
  if (job.address) return job.address;
  if (job.latitude !== null && job.longitude !== null) {
    return `${Number(job.latitude).toFixed(5)}, ${Number(job.longitude).toFixed(5)}`;
  }
  return 'Ingen lokasjon';
}

function locationForMaps(job) {
  if (job.latitude !== null && job.longitude !== null && job.latitude !== '' && job.longitude !== '') {
    return `${job.latitude},${job.longitude}`;
  }
  return job.address || '';
}

function routeUrl(jobs) {
  const locations = jobs.map(locationForMaps).filter(Boolean);
  if (!locations.length) return '';
  if (locations.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locations[0])}`;
  }

  const origin = locations[0];
  const destination = locations[locations.length - 1];
  const waypoints = locations.slice(1, -1).join('|');
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

async function api(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Feil ${response.status}`);
    }
    setConnection(true);
    return await response.json();
  } catch (error) {
    setConnection(false);
    throw error;
  }
}


async function loadSession() {
  state.currentUser = await api('/api/me');
  renderCurrentUser();
}

function renderCurrentUser() {
  const user = state.currentUser;
  if (!user || !els.currentUser) return;
  const local = user.authMode === 'local';
  const label = local
    ? 'Lokal test'
    : (user.name && user.name !== user.email ? user.name : user.email);
  const role = user.isAdmin ? 'Administrator' : 'Ansatt';
  els.currentUser.innerHTML = `<span class="role-dot"></span> ${escapeHtml(label)}`;
  els.currentUser.title = `${role} · ${user.email}`;
  document.querySelectorAll('[data-admin-only]').forEach(element => {
    element.hidden = !user.isAdmin;
  });
}

function setConnection(online) {
  els.connectionStatus.classList.toggle('offline', !online);
  els.connectionStatus.innerHTML = `<span></span> ${online ? 'Tilkoblet' : 'Frakoblet'}`;
}

async function loadJobs({ silent = false } = {}) {
  if (!silent) state.loading = true;
  try {
    state.jobs = await api('/api/jobs');
    render();
    maybeNotifyInvoiceAlerts();
  } catch (error) {
    toast(`Kunne ikke hente jobber: ${error.message}`, 'error');
  } finally {
    state.loading = false;
  }
}

function render() {
  renderWeekTitle();
  renderEmployeeFilters();
  renderStats();
  renderSchedule();
  renderAlerts();
  if (els.dayDialog.open && state.dayContext) renderDayDialog();
}

function renderWeekTitle() {
  const start = state.currentWeekStart;
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  els.weekNumber.textContent = `Uke ${isoWeekNumber(start)}`;
  els.weekTitle.textContent = sameMonth
    ? `${start.getDate()}.–${formatLongDate(end)}`
    : `${formatShortDate(start)} – ${formatLongDate(end)}`;
}

function renderEmployeeFilters() {
  const weekJobs = state.jobs.filter(job => withinWeek(job) && job.status !== 'cancelled');
  const options = ['all', ...EMPLOYEES];
  els.employeeFilters.innerHTML = options.map(name => {
    const label = name === 'all' ? 'Alle' : name;
    const count = name === 'all'
      ? weekJobs.length
      : weekJobs.filter(job => job.employee === name).length;
    return `<button class="employee-chip ${state.selectedEmployee === name ? 'active' : ''}" type="button" data-employee="${escapeHtml(name)}" role="tab" aria-selected="${state.selectedEmployee === name}">${escapeHtml(label)} <span class="count">${count}</span></button>`;
  }).join('');
}

function renderStats() {
  const employees = displayedEmployees();
  const weekJobs = selectedJobs().filter(job => withinWeek(job) && job.status !== 'cancelled');
  let availableDays = 0;
  let plannedDays = 0;

  employees.forEach(employee => {
    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      const dateKey = toDateKey(addDays(state.currentWeekStart, dayIndex));
      const count = jobsForEmployeeDay(employee, dateKey).filter(job => job.status !== 'cancelled').length;
      if (count < 2) availableDays += 1;
      if (count > 0) plannedDays += 1;
    }
  });

  $('#availableDaysStat').textContent = availableDays;
  $('#plannedDaysStat').textContent = plannedDays;
  $('#weekJobsStat').textContent = weekJobs.length;
  $('#invoiceAlertStat').textContent = state.jobs.filter(isInvoiceAlert).length;

  const totalWorkdays = employees.length * 5;
  els.weekPlanSummary.textContent = `${plannedDays} av ${totalWorkdays} arbeidsdager planlagt`;
}

function renderSchedule() {
  const todayKey = toDateKey(new Date());
  const days = Array.from({ length: 7 }, (_, index) => addDays(state.currentWeekStart, index));
  const employees = displayedEmployees();

  const header = [
    '<div class="schedule-corner">Ansatt</div>',
    ...days.map((date, index) => {
      const key = toDateKey(date);
      const classes = [key === todayKey ? 'today' : '', index >= 5 ? 'weekend' : ''].filter(Boolean).join(' ');
      return `<div class="schedule-day-header ${classes}"><span class="schedule-day-name">${escapeHtml(formatWeekday(date))}</span><span class="schedule-day-date">${date.getDate()}</span></div>`;
    })
  ].join('');

  const rows = employees.map(employee => {
    const employeeJobs = jobsForEmployeeWeek(employee);
    const employeeCell = `<div class="employee-cell">
      <span class="employee-avatar">${escapeHtml(employeeInitials(employee))}</span>
      <div>
        <span class="employee-name">${escapeHtml(employee)}</span>
        <span class="employee-summary">${employeeJobs.length} jobb${employeeJobs.length === 1 ? '' : 'er'} i uken</span>
        <button class="employee-route" type="button" data-employee-route="${escapeHtml(employee)}" ${employeeJobs.length ? '' : 'disabled'}>Åpne ukesrute</button>
      </div>
    </div>`;

    const cells = days.map((date, index) => {
      const dateKey = toDateKey(date);
      const allJobs = jobsForEmployeeDay(employee, dateKey);
      const activeJobs = allJobs.filter(job => job.status !== 'cancelled');
      const count = activeJobs.length;
      const preview = activeJobs.slice(0, 2).map(job => `<div class="mini-job">
        <span class="status-dot ${escapeHtml(job.status)}"></span>
        <span class="mini-time">${escapeHtml(formatTime(job.startTime))}</span>
        <span class="mini-customer">${escapeHtml(job.customerName)}</span>
      </div>`).join('');
      const remaining = count > 2 ? `<span class="more-jobs">+ ${count - 2} flere</span>` : '';
      const body = count
        ? `<div class="mini-jobs">${preview}${remaining}</div>`
        : '<div class="no-jobs">Ingen jobber</div>';
      const classes = [capacityClass(count), dateKey === todayKey ? 'today' : '', index >= 5 ? 'weekend' : ''].filter(Boolean).join(' ');

      return `<div class="schedule-cell ${classes}" data-date="${dateKey}" data-cell-employee="${escapeHtml(employee)}">
        <button class="cell-main" type="button" data-open-day="${dateKey}" data-day-employee="${escapeHtml(employee)}" aria-label="Åpne ${escapeHtml(employee)} ${escapeHtml(formatFullWeekday(date))}">
          <span class="cell-top"><span class="capacity-label">${capacityLabel(count)}</span><span class="job-count">${count}</span></span>
          ${body}
        </button>
        <button class="cell-add" type="button" data-add-date="${dateKey}" data-add-employee="${escapeHtml(employee)}" aria-label="Legg til jobb for ${escapeHtml(employee)}">+</button>
      </div>`;
    }).join('');

    return `${employeeCell}${cells}`;
  }).join('');

  els.weekGrid.innerHTML = `${header}${rows}`;
}

function renderAlerts() {
  const alerts = state.jobs.filter(isInvoiceAlert).sort((a, b) => a.date.localeCompare(b.date));
  if (!alerts.length) {
    els.alertsList.innerHTML = '<div class="empty-state"><strong>Ingen fakturavarsler</strong>Alle fullførte fakturajobber er markert sendt innen fristen.</div>';
    return;
  }

  els.alertsList.innerHTML = alerts.map(job => `<article class="alert-item">
    <div class="alert-item-head">
      <div>
        <strong>${escapeHtml(job.customerName)}</strong>
        <div class="alert-details">${escapeHtml(job.employee)} · ${escapeHtml(job.date)} · ${escapeHtml(job.invoiceEmail || job.email || 'Fakturaadresse mangler')}</div>
      </div>
      <span class="alert-age">${daysSince(job.date)} dager</span>
    </div>
    <div class="alert-actions">
      <button class="button button-soft button-small" type="button" data-open-job="${job.id}">Åpne</button>
      <button class="button button-primary button-small" type="button" data-mark-invoice="${job.id}">Marker sendt</button>
    </div>
  </article>`).join('');
}

function renderDayJobCard(job) {
  const quickAction = job.status === 'planned'
    ? `<button class="primary-action" type="button" data-quick-status="in_progress" data-id="${job.id}">Start jobb</button>`
    : job.status === 'in_progress'
      ? `<button class="primary-action" type="button" data-quick-status="completed" data-id="${job.id}">Fullfør</button>`
      : '';

  const paymentAction = job.paymentMethod === 'invoice' && !job.invoiceSent
    ? `<button type="button" data-mark-invoice="${job.id}">Faktura sendt</button>`
    : job.paymentMethod === 'card' && !job.cardPaid
      ? `<button type="button" data-mark-card="${job.id}">Kort betalt</button>`
      : '';

  return `<article class="day-job-card ${escapeHtml(job.status)} ${isInvoiceAlert(job) ? 'alert-card' : ''}">
    <div class="day-job-top">
      <div>
        <span class="day-job-time">${escapeHtml(formatTime(job.startTime))} · ${escapeHtml(formatDuration(job.durationMins))}</span>
        <div class="day-job-customer">${escapeHtml(job.customerName)}</div>
        <div class="day-job-location">${escapeHtml(locationLabel(job))}</div>
      </div>
      <span class="meta-pill">${escapeHtml(STATUS_LABELS[job.status] || job.status)}</span>
    </div>
    <div class="day-job-badges">
      ${job.jobType ? `<span class="meta-pill">${escapeHtml(job.jobType)}</span>` : ''}
      ${job.vehicleInfo ? `<span class="meta-pill">${escapeHtml(job.vehicleInfo)}</span>` : ''}
      ${paymentPill(job)}
    </div>
    <div class="day-job-actions">
      <button type="button" data-open-job="${job.id}">Åpne jobbkort</button>
      ${quickAction}
      ${paymentAction}
    </div>
  </article>`;
}

function openDayDialog(employee, dateKey) {
  state.dayContext = { employee, dateKey };
  renderDayDialog();
  if (!els.dayDialog.open) els.dayDialog.showModal();
}

function renderDayDialog() {
  if (!state.dayContext) return;
  const { employee, dateKey } = state.dayContext;
  const date = parseDateKey(dateKey);
  const jobs = jobsForEmployeeDay(employee, dateKey);
  const activeJobs = jobs.filter(job => job.status !== 'cancelled');
  const totalMinutes = activeJobs.reduce((sum, job) => sum + Number(job.durationMins || 0), 0);

  els.dayDialogTitle.textContent = `${employee} · ${formatFullWeekday(date)} ${date.getDate()}. ${new Intl.DateTimeFormat('nb-NO', { month: 'long' }).format(date)}`;
  els.dayDialogSummary.textContent = `${activeJobs.length} jobb${activeJobs.length === 1 ? '' : 'er'} · ${formatTotalDuration(totalMinutes)} planlagt`;
  els.dayRouteBtn.disabled = !activeJobs.length;

  els.dayDialogList.innerHTML = jobs.length
    ? jobs.map(renderDayJobCard).join('')
    : '<div class="empty-state"><strong>Ingen jobber denne dagen</strong>Bruk «Legg til jobb» for å fylle planen.</div>';
}

function closeDayDialog() {
  state.dayContext = null;
  if (els.dayDialog.open) els.dayDialog.close();
}

function openJobDialog(job = null, preset = {}) {
  if (els.dayDialog.open) closeDayDialog();
  els.jobForm.reset();
  els.formError.hidden = true;
  els.formError.textContent = '';
  $('#jobId').value = job?.id || '';
  els.dialogTitle.textContent = job ? `Rediger jobb – ${job.customerName}` : 'Ny jobb';
  els.deleteJobBtn.hidden = !job || !state.currentUser?.isAdmin;

  const values = job || {
    employee: preset.employee || (state.selectedEmployee !== 'all' ? state.selectedEmployee : EMPLOYEES[0]),
    date: preset.date || toDateKey(new Date()),
    startTime: '08:00',
    durationMins: 90,
    status: 'planned',
    paymentMethod: 'unknown',
    latitude: null,
    longitude: null
  };

  Object.entries(values).forEach(([key, value]) => {
    const field = els.jobForm.elements.namedItem(key);
    if (!field) return;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value ?? '';
  });

  updatePaymentFields();
  updateGeoDisplay();
  els.jobDialog.showModal();
  setTimeout(() => $('#customerName').focus(), 50);
}

function closeJobDialog() {
  if (els.jobDialog.open) els.jobDialog.close();
}

function updatePaymentFields() {
  const method = $('#paymentMethod').value;
  $('#invoiceEmailLabel').hidden = method !== 'invoice';
  $('#invoiceSentRow').hidden = method !== 'invoice';
  $('#cardPaidRow').hidden = method !== 'card';
}

function updateGeoDisplay() {
  const latitude = $('#latitude').value;
  const longitude = $('#longitude').value;
  if (latitude && longitude) {
    els.geoStatus.textContent = `Geotag: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
    els.geoStatus.classList.add('success');
    els.mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
    els.mapLink.hidden = false;
  } else {
    els.geoStatus.textContent = 'Ingen geotag registrert';
    els.geoStatus.classList.remove('success');
    els.mapLink.hidden = true;
  }
}

async function saveJob(event) {
  event.preventDefault();
  els.formError.hidden = true;
  const formData = new FormData(els.jobForm);
  const body = Object.fromEntries(formData.entries());
  body.durationMins = Number(body.durationMins || 90);
  body.invoiceSent = $('#invoiceSent').checked;
  body.cardPaid = $('#cardPaid').checked;
  body.latitude = body.latitude === '' ? null : Number(body.latitude);
  body.longitude = body.longitude === '' ? null : Number(body.longitude);

  if (!body.customerName.trim()) return showFormError('Kundenavn må fylles ut.');
  if (!body.date) return showFormError('Dato må fylles ut.');
  if (!body.address.trim() && (body.latitude === null || body.longitude === null)) {
    return showFormError('Legg inn adresse eller registrer geotag.');
  }

  const id = body.id;
  delete body.id;
  $('#saveJobBtn').disabled = true;
  try {
    if (id) {
      await api(`/api/jobs/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await api('/api/jobs', { method: 'POST', body: JSON.stringify(body) });
    }
    closeJobDialog();
    toast(id ? 'Jobben er oppdatert.' : 'Jobben er lagt inn.');
    await loadJobs({ silent: true });
  } catch (error) {
    showFormError(error.message);
  } finally {
    $('#saveJobBtn').disabled = false;
  }
}

function showFormError(message) {
  els.formError.textContent = message;
  els.formError.hidden = false;
  els.formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteCurrentJob() {
  const id = $('#jobId').value;
  if (!id || !confirm('Vil du slette denne jobben?')) return;
  try {
    await api(`/api/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    closeJobDialog();
    toast('Jobben er slettet.');
    await loadJobs({ silent: true });
  } catch (error) {
    showFormError(error.message);
  }
}

async function patchJob(id, patch, successMessage) {
  const current = state.jobs.find(job => job.id === id);
  if (!current) return;
  try {
    await api(`/api/jobs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...current, ...patch })
    });
    toast(successMessage);
    await loadJobs({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  }
}

function selectEmployee(employee) {
  state.selectedEmployee = employee;
  localStorage.setItem('optituning.selectedEmployee', employee);
  render();
}

async function captureGeolocation() {
  if (!navigator.geolocation) return showFormError('Denne nettleseren støtter ikke geotagging.');
  $('#geoBtn').disabled = true;
  els.geoStatus.textContent = 'Henter posisjon …';

  navigator.geolocation.getCurrentPosition(position => {
    $('#latitude').value = position.coords.latitude;
    $('#longitude').value = position.coords.longitude;
    $('#locationCapturedAt').value = new Date().toISOString();
    updateGeoDisplay();
    $('#geoBtn').disabled = false;
  }, error => {
    const secureHint = location.protocol !== 'https:' && location.hostname !== 'localhost'
      ? ' Geotagging på mobil krever at appen er åpnet via HTTPS.'
      : '';
    els.geoStatus.textContent = `Kunne ikke hente posisjon.${secureHint}`;
    $('#geoBtn').disabled = false;
    toast(`Posisjon ble ikke hentet: ${error.message}.${secureHint}`, 'error');
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
}

function toast(message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  $('#toastRegion').appendChild(node);
  setTimeout(() => node.remove(), 3600);
}

async function requestNotifications() {
  if (!('Notification' in window)) return toast('Nettleseren støtter ikke varsler.', 'error');
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    toast('Nettleservarsler er aktivert.');
    maybeNotifyInvoiceAlerts(true);
  } else {
    toast('Varsler ble ikke aktivert.', 'error');
  }
}

function maybeNotifyInvoiceAlerts(force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const count = state.jobs.filter(isInvoiceAlert).length;
  if (!count) return;
  const today = toDateKey(new Date());
  const last = localStorage.getItem('optituning.lastInvoiceNotification');
  if (!force && last === `${today}:${count}`) return;

  new Notification('Optituning: fakturaoppfølging', {
    body: `${count} jobb${count === 1 ? '' : 'er'} har faktura som ikke er markert sendt etter 7 dager.`,
    icon: '/icons/icon-192.png'
  });
  localStorage.setItem('optituning.lastInvoiceNotification', `${today}:${count}`);
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'Optituning Ukeplan',
    jobs: state.jobs
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `optituning-jobber-${toDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  closeDataMenu();
}

async function importData(file) {
  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    const jobs = Array.isArray(parsed) ? parsed : parsed.jobs;
    if (!Array.isArray(jobs)) throw new Error('Filen inneholder ikke en gyldig jobbliste.');
    if (!confirm(`Vil du erstatte eksisterende data med ${jobs.length} jobber fra filen?`)) return;
    await api('/api/jobs/replace', { method: 'POST', body: JSON.stringify({ jobs }) });
    toast('Sikkerhetskopien er importert.');
    await loadJobs({ silent: true });
  } catch (error) {
    toast(`Import feilet: ${error.message}`, 'error');
  } finally {
    $('#importInput').value = '';
    closeDataMenu();
  }
}

function sampleJobs() {
  const monday = startOfWeek(new Date());
  const templates = [
    { day: 0, time: '08:00', employee: 'Steffen', customer: 'Nord Transport AS', address: 'Industriveien 12, Oslo', type: 'Lastebil tuning', vehicle: 'Volvo FH16', payment: 'invoice', status: 'planned' },
    { day: 0, time: '10:30', employee: 'Steffen', customer: 'Ola Nordmann', address: 'Storgata 25, Lillestrøm', type: 'Personbil tuning', vehicle: 'BMW 530d', payment: 'card', status: 'planned' },
    { day: 1, time: '08:30', employee: 'Henrik', customer: 'Maskinpartner AS', address: 'Hamarvegen 44, Hamar', type: 'Gravemaskin', vehicle: 'CAT 320', payment: 'invoice', status: 'in_progress' },
    { day: 1, time: '11:00', employee: 'Henrik', customer: 'Øst Bilservice', address: 'Vangsvegen 111, Hamar', type: 'Filutlesing', vehicle: 'Mercedes Sprinter', payment: 'invoice', status: 'planned' },
    { day: 2, time: '09:00', employee: 'Sæter', customer: 'Fjord Entreprenør AS', address: 'Drammensveien 160, Drammen', type: 'Anleggsmaskin', vehicle: 'Komatsu WA380', payment: 'invoice', status: 'completed' },
    { day: 2, time: '12:00', employee: 'Nyansatt 1', customer: 'Vest Auto', address: 'Kjellstadveien 5, Lier', type: 'Diagnose', vehicle: 'Audi A6', payment: 'card', status: 'planned' },
    { day: 3, time: '08:00', employee: 'Steffen', customer: 'Bygg og Maskin AS', address: 'Rosenholmveien 25, Oslo', type: 'Hjullaster tuning', vehicle: 'Volvo L90', payment: 'invoice', status: 'planned' },
    { day: 3, time: '10:00', employee: 'Steffen', customer: 'Lokalbil AS', address: 'Smalvollveien 40, Oslo', type: 'Varebil tuning', vehicle: 'VW Crafter', payment: 'card', status: 'planned' },
    { day: 4, time: '08:00', employee: 'Henrik', customer: 'Langtransport Norge', address: 'Gardermovegen 55, Jessheim', type: 'Lastebil tuning', vehicle: 'Scania R', payment: 'invoice', status: 'in_progress' },
    { day: 4, time: '10:15', employee: 'Henrik', customer: 'Grønn Drift AS', address: 'Trondheimsvegen 310, Jessheim', type: 'Traktor tuning', vehicle: 'John Deere', payment: 'invoice', status: 'planned' },
    { day: 5, time: '09:00', employee: 'Sæter', customer: 'Bilpartner Romerike', address: 'Solheimvegen 3, Kløfta', type: 'Personbil tuning', vehicle: 'Audi Q7', payment: 'card', status: 'planned' },
    { day: 5, time: '11:00', employee: 'Sæter', customer: 'Romerike Varebil', address: 'Kongsvingervegen 12, Kløfta', type: 'Varebil tuning', vehicle: 'Ford Transit', payment: 'invoice', status: 'planned' },
    { day: -10, time: '10:00', employee: 'Henrik', customer: 'Faktura må følges opp AS', address: 'Testveien 7, Oslo', type: 'Lastebil tuning', vehicle: 'Scania R', payment: 'invoice', status: 'completed' }
  ];

  return templates.map(item => ({
    employee: item.employee,
    date: toDateKey(addDays(monday, item.day)),
    startTime: item.time,
    durationMins: 90,
    status: item.status,
    customerName: item.customer,
    contactPerson: '',
    phone: '',
    email: '',
    orgNo: '',
    address: item.address,
    latitude: null,
    longitude: null,
    locationCapturedAt: '',
    jobType: item.type,
    vehicleInfo: item.vehicle,
    regNo: '',
    description: 'Eksempeljobb som kan redigeres eller slettes.',
    paymentMethod: item.payment,
    invoiceEmail: item.payment === 'invoice' ? 'faktura@eksempel.no' : '',
    invoiceReference: '',
    invoiceSent: false,
    cardPaid: false,
    notes: ''
  }));
}

async function addDemoJobs() {
  closeDataMenu();
  if (state.jobs.length && !confirm('Legge til eksempeljobber i tillegg til eksisterende jobber?')) return;
  try {
    for (const job of sampleJobs()) {
      await api('/api/jobs', { method: 'POST', body: JSON.stringify(job) });
    }
    toast('Eksempeljobber er lagt inn.');
    await loadJobs({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function clearAllJobs() {
  closeDataMenu();
  if (!confirm('Dette sletter alle jobber permanent. Fortsette?')) return;
  try {
    await api('/api/jobs/replace', { method: 'POST', body: JSON.stringify({ jobs: [] }) });
    toast('Alle jobber er slettet.');
    await loadJobs({ silent: true });
  } catch (error) {
    toast(error.message, 'error');
  }
}

function closeDataMenu() {
  els.dataMenu.hidden = true;
  $('#dataMenuBtn').setAttribute('aria-expanded', 'false');
}

function openRouteForJobs(jobs) {
  const url = routeUrl(jobs.filter(job => job.status !== 'cancelled'));
  if (url) window.open(url, '_blank', 'noopener');
  else toast('Ingen adresser eller geotagger er registrert for denne ruten.', 'error');
}

function handleJobAction(event) {
  const open = event.target.closest('[data-open-job]');
  if (open) {
    const job = state.jobs.find(item => item.id === open.dataset.openJob);
    if (job) openJobDialog(job);
    return true;
  }

  const status = event.target.closest('[data-quick-status]');
  if (status) {
    patchJob(
      status.dataset.id,
      { status: status.dataset.quickStatus },
      status.dataset.quickStatus === 'completed' ? 'Jobben er fullført.' : 'Jobben er startet.'
    );
    return true;
  }

  const invoice = event.target.closest('[data-mark-invoice]');
  if (invoice) {
    patchJob(
      invoice.dataset.markInvoice,
      { invoiceSent: true, invoiceSentAt: new Date().toISOString() },
      'Faktura er markert sendt.'
    );
    return true;
  }

  const card = event.target.closest('[data-mark-card]');
  if (card) {
    patchJob(
      card.dataset.markCard,
      { cardPaid: true, cardPaidAt: new Date().toISOString() },
      'Kortbetaling er registrert.'
    );
    return true;
  }

  return false;
}

function bindEvents() {
  $('#newJobBtn').addEventListener('click', () => openJobDialog());
  $('#mobileNewBtn').addEventListener('click', () => openJobDialog());

  $('#prevWeekBtn').addEventListener('click', () => {
    state.currentWeekStart = addDays(state.currentWeekStart, -7);
    render();
  });
  $('#nextWeekBtn').addEventListener('click', () => {
    state.currentWeekStart = addDays(state.currentWeekStart, 7);
    render();
  });
  $('#todayBtn').addEventListener('click', () => {
    state.currentWeekStart = startOfWeek(new Date());
    render();
  });

  $('#navWeekBtn').addEventListener('click', () => $('#scheduleSection').scrollIntoView({ behavior: 'smooth' }));
  $('#navAlertsBtn').addEventListener('click', () => $('#alertsSection').scrollIntoView({ behavior: 'smooth' }));
  $('#mobileWeekBtn').addEventListener('click', () => $('#scheduleSection').scrollIntoView({ behavior: 'smooth' }));
  $('#mobileAlertsBtn').addEventListener('click', () => $('#alertsSection').scrollIntoView({ behavior: 'smooth' }));
  $('#notificationBtn').addEventListener('click', requestNotifications);

  els.employeeFilters.addEventListener('click', event => {
    const button = event.target.closest('[data-employee]');
    if (button) selectEmployee(button.dataset.employee);
  });

  els.weekGrid.addEventListener('click', event => {
    const add = event.target.closest('[data-add-date]');
    if (add) {
      openJobDialog(null, { date: add.dataset.addDate, employee: add.dataset.addEmployee });
      return;
    }

    const day = event.target.closest('[data-open-day]');
    if (day) {
      openDayDialog(day.dataset.dayEmployee, day.dataset.openDay);
      return;
    }

    const employeeRoute = event.target.closest('[data-employee-route]');
    if (employeeRoute) {
      openRouteForJobs(jobsForEmployeeWeek(employeeRoute.dataset.employeeRoute));
    }
  });

  $('#closeDayDialogBtn').addEventListener('click', closeDayDialog);
  $('#dayDialogAddBtn').addEventListener('click', () => {
    if (!state.dayContext) return;
    const context = { ...state.dayContext };
    closeDayDialog();
    openJobDialog(null, { date: context.dateKey, employee: context.employee });
  });
  els.dayRouteBtn.addEventListener('click', () => {
    if (!state.dayContext) return;
    openRouteForJobs(jobsForEmployeeDay(state.dayContext.employee, state.dayContext.dateKey));
  });
  els.dayDialogList.addEventListener('click', event => handleJobAction(event));
  els.dayDialog.addEventListener('click', event => {
    if (event.target === els.dayDialog) closeDayDialog();
  });

  els.alertsList.addEventListener('click', event => handleJobAction(event));

  els.jobForm.addEventListener('submit', saveJob);
  $('#closeDialogBtn').addEventListener('click', closeJobDialog);
  $('#cancelDialogBtn').addEventListener('click', closeJobDialog);
  $('#deleteJobBtn').addEventListener('click', deleteCurrentJob);
  $('#paymentMethod').addEventListener('change', updatePaymentFields);
  $('#geoBtn').addEventListener('click', captureGeolocation);
  els.jobDialog.addEventListener('click', event => {
    if (event.target === els.jobDialog) closeJobDialog();
  });

  $('#dataMenuBtn').addEventListener('click', event => {
    event.stopPropagation();
    els.dataMenu.hidden = !els.dataMenu.hidden;
    $('#dataMenuBtn').setAttribute('aria-expanded', String(!els.dataMenu.hidden));
  });
  document.addEventListener('click', event => {
    if (!els.dataMenu.hidden && !event.target.closest('#dataMenu') && !event.target.closest('#dataMenuBtn')) {
      closeDataMenu();
    }
  });
  $('#printWeekBtn').addEventListener('click', () => {
    closeDataMenu();
    window.print();
  });
  $('#exportBtn').addEventListener('click', exportData);
  $('#importInput').addEventListener('change', event => event.target.files[0] && importData(event.target.files[0]));
  $('#demoBtn').addEventListener('click', addDemoJobs);
  $('#clearBtn').addEventListener('click', clearAllJobs);

  window.addEventListener('online', () => {
    setConnection(true);
    loadJobs({ silent: true });
  });
  window.addEventListener('offline', () => setConnection(false));
}

async function init() {
  if (!['all', ...EMPLOYEES].includes(state.selectedEmployee)) state.selectedEmployee = 'all';
  $('#employee').innerHTML = EMPLOYEES.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  bindEvents();
  setConnection(navigator.onLine);
  try {
    await loadSession();
    await loadJobs();
  } catch (error) {
    toast(`Kunne ikke starte appen: ${error.message}`, 'error');
    return;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  setInterval(() => loadJobs({ silent: true }), 60000);
}

init();
