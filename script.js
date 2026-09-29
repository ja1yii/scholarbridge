/* ScholarBridge frontend v1. Data lives in localStorage until the backend is connected.
   Sample scholarship data: verify every detail on the official portal before relying on it. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATES = ['Andhra Pradesh','Bihar','Delhi','Gujarat','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Odisha','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','West Bengal','Other'];
const ADMIN_PASS = 'admin123'; // demo only

const SEED = [
 {id:1,name:'Post Matric Scholarship for SC Students',provider:'Govt. of India (NSP)',amount:'Course fees + maintenance allowance',maxIncome:250000,states:['All'],categories:['SC'],levels:['12th','UG','PG'],deadline:'2026-11-30',link:'https://scholarships.gov.in',docs:['Aadhaar','Caste certificate','Income certificate','Previous marksheet','Bank passbook'],about:'Central scheme for SC students studying after class 10.'},
 {id:2,name:'Central Sector Scholarship Scheme',provider:'Ministry of Education',amount:'Rs. 12,000 to 20,000 per year',maxIncome:450000,states:['All'],categories:['All'],levels:['UG','PG'],deadline:'2026-10-31',link:'https://scholarships.gov.in',docs:['Aadhaar','12th marksheet (above 80th percentile)','Income certificate','Bank passbook','Bonafide certificate'],about:'For meritorious college students from low-income families.'},
 {id:3,name:'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti',provider:'Govt. of Maharashtra (MahaDBT)',amount:'Fee reimbursement (50%)',maxIncome:800000,states:['Maharashtra'],categories:['General','OBC','EWS'],levels:['UG','PG'],deadline:'2026-12-15',link:'https://mahadbt.maharashtra.gov.in',docs:['Domicile certificate','Income certificate','Admission receipt','Marksheet','Bank passbook'],about:'Fee concession for eligible students in professional courses in Maharashtra.'},
 {id:4,name:'Pre-Matric Scholarship for Minorities',provider:'Ministry of Minority Affairs',amount:'Up to Rs. 10,000 per year',maxIncome:100000,states:['All'],categories:['Minority'],levels:['10th'],deadline:'2026-10-20',link:'https://scholarships.gov.in',docs:['Aadhaar','Minority community proof','Income certificate','Previous marksheet (50%+)','School ID'],about:'Support for minority students in school.'},
 {id:5,name:'Reliance Foundation Undergraduate Scholarship',provider:'Reliance Foundation',amount:'Up to Rs. 2,00,000 total',maxIncome:1500000,states:['All'],categories:['All'],levels:['UG'],deadline:'2026-11-10',link:'https://www.scholarships.reliancefoundation.org',docs:['Aadhaar','12th marksheet','Income proof','Admission proof','Photo'],about:'Merit-cum-means scholarship for first-year UG students.'}
];

let sch = get('sb_sch', null); if (!sch) { sch = SEED; set('sb_sch', sch); }
const users = () => get('sb_users', []);
const me = () => users().find(u => u.email === get('sb_session'));
const saved = () => get('sb_saved_' + get('sb_session'), []);
const isAdmin = () => get('sb_admin', false);

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600); }
const days = d => Math.ceil((new Date(d + 'T23:59:59') - new Date()) / 864e5);
const fmt = d => new Date(d + 'T00:00').toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});

/* Eligibility matching: returns {status, reasons[]} */
function match(s, u) {
  if (!u || !u.income) return {status:'unknown', reasons:['Complete your profile to see if you qualify.']};
  const r = [], fail = [];
  const chk = (ok, good, bad) => ok ? r.push('✔ ' + good) : fail.push('✘ ' + bad);
  chk(+u.income <= +s.maxIncome, 'Income within limit', `Income above Rs. ${(+s.maxIncome).toLocaleString('en-IN')} limit`);
  chk(s.states.includes('All') || s.states.includes(u.state), 'State matches', `Only for ${s.states.join(', ')}`);
  chk(s.categories.includes('All') || s.categories.includes(u.category), 'Category matches', `Only for ${s.categories.join(', ')}`);
  chk(s.levels.includes(u.level), 'Course level matches', `Only for ${s.levels.join(', ')}`);
  return {status: fail.length ? 'no' : 'yes', reasons: [...fail, ...r]};
}
const badge = m => ({yes:'<span class="tag ok">You may be eligible</span>', no:'<span class="tag bad">Not eligible</span>', unknown:'<span class="tag warn">Add profile to check</span>'}[m.status]);

/* Routing */
const PROTECTED = ['dashboard','profile','saved','notifications'];
function route() {
  const [, page = 'home', arg] = location.hash.split('/');
  if (PROTECTED.includes(page) && !me()) return location.hash = '#/login';
  if (page === 'admin' && !isAdmin()) return location.hash = '#/adminlogin';
  $$('.view').forEach(v => v.classList.remove('on'));
  const v = $('#v-' + page) || $('#v-home'); v.classList.add('on');
  ({dashboard, profile, find:renderFind, details:() => details(+arg), saved:renderSaved, notifications:renderNotes, admin:renderAdmin}[page] || (() => {}))();
  drawNav(); $('#nav').classList.remove('open'); scrollTo(0, 0);
}
function drawNav() {
  const u = me(), n = u ? notes().length : 0;
  $('#nav').innerHTML = u
    ? `<a href="#/dashboard">Dashboard</a><a href="#/find">Find</a><a href="#/saved">Saved</a><a href="#/notifications">Alerts${n ? `<span class="n">${n}</span>` : ''}</a><a href="#/profile">Profile</a><button id="out">Logout</button>`
    : `<a href="#/find">Find scholarships</a><a href="#/login">Login</a><a href="#/register">Register</a><a href="#/adminlogin">Admin</a>`;
  if (isAdmin()) $('#nav').insertAdjacentHTML('beforeend', '<a href="#/admin">Admin panel</a>');
  const o = $('#out'); if (o) o.onclick = () => { localStorage.removeItem('sb_session'); location.hash = '#/home'; toast('Logged out'); };
}
addEventListener('hashchange', route);
$('#menuBtn').onclick = () => $('#nav').classList.toggle('open');

/* Auth */
const fd = f => Object.fromEntries(new FormData(f));
$('#fReg').onsubmit = e => {
  e.preventDefault(); const d = fd(e.target), us = users();
  if (us.some(u => u.email === d.email.toLowerCase())) return toast('This email is already registered. Try logging in.');
  us.push({name:d.name, email:d.email.toLowerCase(), password:d.password}); set('sb_users', us); // backend must hash passwords
  set('sb_session', d.email.toLowerCase()); location.hash = '#/profile'; toast('Account created. Now complete your profile.');
};
$('#fLogin').onsubmit = e => {
  e.preventDefault(); const d = fd(e.target), u = users().find(u => u.email === d.email.toLowerCase() && u.password === d.password);
  if (!u) return toast('Email or password is incorrect.');
  set('sb_session', u.email); location.hash = '#/dashboard';
};
$('#fForgot').onsubmit = e => {
  e.preventDefault(); const d = fd(e.target), us = users(), u = us.find(u => u.email === d.email.toLowerCase());
  if (!u) return toast('No account found with this email.');
  u.password = d.password; set('sb_users', us); location.hash = '#/login'; toast('Password reset. Please login.');
};
$('#fAdminLogin').onsubmit = e => {
  e.preventDefault(); if (fd(e.target).password !== ADMIN_PASS) return toast('Wrong admin password.');
  set('sb_admin', true); location.hash = '#/admin';
};

/* Profile */
$$('select[name=state]').forEach(s => s.insertAdjacentHTML('beforeend', STATES.map(x => `<option>${x}</option>`).join('')));
$('#fState').insertAdjacentHTML('beforeend', STATES.map(x => `<option>${x}</option>`).join(''));
function profile() { const u = me(), f = $('#fProfile'); for (const k of ['name','state','category','level','course','marks','income']) f[k].value = u[k] ?? ''; }
$('#fProfile').onsubmit = e => {
  e.preventDefault(); const us = users(), u = us.find(x => x.email === get('sb_session'));
  Object.assign(u, fd(e.target)); set('sb_users', us); toast('Profile saved'); location.hash = '#/dashboard';
};

/* Cards */
function card(s, u) {
  const m = match(s, u), d = days(s.deadline), sv = saved().includes(s.id);
  const dl = d < 0 ? '<span class="tag bad">Closed</span>' : d <= 15 ? `<span class="tag warn">${d} day${d === 1 ? '' : 's'} left</span>` : '';
  return `<article class="card"><h3>${esc(s.name)}</h3><div class="meta">${esc(s.provider)}</div><div>${esc(s.amount)}</div>
  <div class="meta">Last date: ${fmt(s.deadline)}</div>${badge(m)} ${dl}
  <div class="row"><a class="btn sm" href="#/details/${s.id}">View details</a>${me() ? `<button class="btn sm ghost" data-save="${s.id}">${sv ? '❤️ Saved' : '🤍 Save'}</button>` : ''}</div></article>`;
}
document.addEventListener('click', e => {
  const id = e.target.dataset.save; if (!id) return;
  let l = saved(); const n = +id; l = l.includes(n) ? l.filter(x => x !== n) : [...l, n];
  set('sb_saved_' + get('sb_session'), l); toast(l.includes(n) ? 'Saved' : 'Removed from saved'); route();
});

function renderFind() {
  const u = me(), q = $('#q').value.toLowerCase(), st = $('#fState').value, ct = $('#fCat').value, lv = $('#fLevel').value, mine = $('#fMine').checked;
  const r = sch.filter(s => (!q || (s.name + s.provider).toLowerCase().includes(q))
    && (!st || s.states.includes('All') || s.states.includes(st))
    && (!ct || s.categories.includes('All') || s.categories.includes(ct))
    && (!lv || s.levels.includes(lv))
    && (!mine || match(s, u).status === 'yes'));
  $('#list').innerHTML = r.length ? r.map(s => card(s, u)).join('') : '<p>No scholarships match these filters. Try removing one.</p>';
}
['q','fState','fCat','fLevel','fMine'].forEach(id => $('#' + id).addEventListener('input', renderFind));

function details(id) {
  const s = sch.find(x => x.id === id), v = $('#v-details'); if (!s) return v.innerHTML = '<p>Scholarship not found. <a href="#/find">Back to search</a></p>';
  const m = match(s, me()), d = days(s.deadline);
  v.innerHTML = `<a href="#/find">Back to search</a><h2>${esc(s.name)}</h2><p class="meta">${esc(s.provider)}</p><p>${esc(s.about)}</p>
  <p><b>Benefit:</b> ${esc(s.amount)}<br><b>Last date:</b> ${fmt(s.deadline)} (${d < 0 ? 'closed' : d + ' days left'})</p>
  <h3>Do you qualify?</h3>${badge(m)}<ul class="reasons">${m.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  <h3>Documents you need</h3><ul>${s.docs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  <p><a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(s.link)}">Apply on official website</a>
  ${me() ? ` <button class="btn ghost" data-save="${s.id}">${saved().includes(s.id) ? '❤️ Saved' : '🤍 Save'}</button>` : ''}</p>
  <p class="hint">Applications are not submitted on ScholarBridge. Always confirm details on the official portal.</p>`;
}

function renderSaved() {
  const l = sch.filter(s => saved().includes(s.id));
  $('#savedList').innerHTML = l.length ? l.map(s => card(s, me())).join('') : '<p>Nothing saved yet. <a href="#/find">Find scholarships</a> and tap Save.</p>';
}

/* Notifications: saved scholarships closing within 15 days, or already closed */
function notes() { return sch.filter(s => saved().includes(s.id) && days(s.deadline) <= 15); }
function renderNotes() {
  const n = notes().sort((a, b) => a.deadline.localeCompare(b.deadline));
  $('#notes').innerHTML = n.length ? n.map(s => { const d = days(s.deadline);
    return `<div class="note ${d < 0 ? 'late' : ''}"><b>${esc(s.name)}</b><br>${d < 0 ? 'Applications closed on ' + fmt(s.deadline) : `Closes ${fmt(s.deadline)}, ${d} day${d === 1 ? '' : 's'} left.`} <a href="#/details/${s.id}">Open</a></div>`; }).join('')
    : '<p>No deadlines coming up for your saved scholarships.</p>';
}

function dashboard() {
  const u = me(), m = sch.filter(s => match(s, u).status === 'yes' && days(s.deadline) >= 0);
  $('#v-dashboard').innerHTML = `<h2>Hi, ${esc(u.name.split(' ')[0])}</h2>
  ${u.income ? '' : '<div class="note">Your profile is incomplete. <a href="#/profile">Add income, state and category</a> to see matches.</div>'}
  <div class="stats"><div><b>${m.length}</b>open scholarships you may qualify for</div><div><b>${saved().length}</b>saved</div><div><b>${notes().length}</b>deadline alerts</div></div>
  <h3>Best matches for you</h3><div class="grid">${m.slice(0, 6).map(s => card(s, u)).join('') || '<p>No matches yet.</p>'}</div>`;
}

/* Admin */
function renderAdmin() {
  $('#adminTable').innerHTML = '<tr><th>Name</th><th>Last date</th><th>Link</th><th></th></tr>' + sch.map(s =>
    `<tr><td>${esc(s.name)}</td><td>${fmt(s.deadline)}</td><td><a target="_blank" rel="noopener" href="${esc(s.link)}">Open</a></td>
    <td><button class="btn sm ghost" data-edit="${s.id}">Edit</button> <button class="btn sm ghost" data-del="${s.id}">Delete</button></td></tr>`).join('');
}
const list = v => v.split(',').map(x => x.trim()).filter(Boolean);
$('#fSch').onsubmit = e => {
  e.preventDefault(); const d = fd(e.target), id = +d.id || Date.now();
  const o = {id, name:d.name, provider:d.provider, amount:d.amount, maxIncome:+d.maxIncome, states:list(d.states), categories:list(d.categories), levels:list(d.levels), deadline:d.deadline, link:d.link, docs:list(d.docs), about:d.about};
  sch = d.id ? sch.map(s => s.id === id ? o : s) : [...sch, o]; set('sb_sch', sch);
  e.target.reset(); e.target.id.value = ''; renderAdmin(); toast('Scholarship saved');
};
$('#cancelEdit').onclick = () => { $('#fSch').reset(); $('#fSch').id.value = ''; };
document.addEventListener('click', e => {
  const f = $('#fSch');
  if (e.target.dataset.edit) { const s = sch.find(x => x.id === +e.target.dataset.edit);
    Object.entries({...s, states:s.states.join(', '), categories:s.categories.join(', '), levels:s.levels.join(', '), docs:s.docs.join(', ')}).forEach(([k, v]) => f.elements[k] && (f.elements[k].value = v)); scrollTo(0, 0); }
  if (e.target.dataset.del && confirm('Delete this scholarship?')) { sch = sch.filter(x => x.id !== +e.target.dataset.del); set('sb_sch', sch); renderAdmin(); toast('Deleted'); }
});

route();