/* THPS SCHOOL MANAGER ONLINE  v11  -  Tom Hoey Primary School, Mougulu, Middle Fly District, W/P
 * Installable web app (GitHub Pages) using the school Google Sheet (Apps Script web app) as its database.
 * Works offline: every page keeps its last copy on the device and saves wait in an outbox until the network returns.
 * Icons: Microsoft Fluent Emoji (MIT licence). */
(function () {
'use strict';
var VERSION = '11.0';
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function ls(k, v) {
  try {
    if (v === undefined) { var x = localStorage.getItem(k); return x ? JSON.parse(x) : null; }
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v));
  } catch (e) { if (v !== undefined) toast('This device is out of space for saved data.', 1); return null; }
}
function ico(k, cls) { return '<img class="' + (cls || 'ico') + '" src="icons/' + k + '.png" alt="">'; }
function money(n) { n = Number(n) || 0; return (n < 0 ? '-' : '') + 'K' + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fmtDate(s) { if (!s) return ''; var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : s; }
function toast(msg, bad) {
  var t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(function () { t.remove(); }, bad ? 5000 : 2600);
}

/* ------------------------------------------------------------------ API */
function apiUrl() { return window.THPS_API || ls('thpsm_api') || ''; }
var AUTH = ls('thpsm_auth'), ME = null, PAGE = ls('thps_page') || 'home', ONLINE = navigator.onLine, OUTBOX = ls('thps_outbox') || [], YEAR = null;
function call(fn) {
  var args = [].slice.call(arguments, 1);
  if (window.THPS_MOCK) return window.THPS_MOCK(fn, args);
  var u = apiUrl(); if (!u) return Promise.reject(new Error('NOLINK'));
  return fetch(u, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args }) })
    .then(function (r) { return r.text(); })
    .then(function (t) { var j; try { j = JSON.parse(t); } catch (e) { throw new Error('NET'); } if (!j.ok) throw new Error(j.error); return j.data; });
}
function isAuth(e) { return /AUTH/.test(String(e && e.message || e)); }
function errText(e) { var m = String(e && e.message || e); if (m === 'NET' || /Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No network'; return m.replace(/^Error:\s*/, '').replace(/^AUTH:\s*/, ''); }
function ckey(k) { return 'thps_c_' + (AUTH ? AUTH.user.toLowerCase() : '') + '_' + k; }
/* online first, the device copy when there is no network */
function load(key, fn) {
  var args = [].slice.call(arguments, 2);
  return call.apply(null, [fn].concat(args)).then(function (d) { setOnline(true); ls(ckey(key), d); return d; })
    .catch(function (e) {
      if (isAuth(e)) { signOut(errText(e)); throw e; }
      setOnline(false);
      var d = ls(ckey(key)); if (d) { d._offline = true; return d; }
      throw e;
    });
}
function setOnline(v) { ONLINE = v; var p = $('#pill'); if (p) { p.className = 'pill ' + (v ? 'on' : 'off'); p.innerHTML = '<i></i>' + (v ? 'Online' : 'Offline') + (OUTBOX.length ? ' · ' + OUTBOX.length + ' waiting' : ''); } }
/* saves that wait for the network */
function queueSave(name, rec) {
  OUTBOX = OUTBOX.filter(function (o) { return !(o.name === name && o.rec.Key === rec.Key); });
  OUTBOX.push({ name: name, rec: rec, del: !!rec._del }); ls('thps_outbox', OUTBOX); setOnline(ONLINE);
}
var FLUSHING = false;
function flush() {
  if (FLUSHING || !OUTBOX.length || !AUTH) return Promise.resolve();
  FLUSHING = true;
  var o = OUTBOX[0];
  var p = o.del ? call('apiDeleteRow', AUTH, o.name, o.rec.Key) : call('apiSaveRow', AUTH, o.name, o.rec);
  return p.then(function (r) {
    OUTBOX.shift(); ls('thps_outbox', OUTBOX); FLUSHING = false; setOnline(true);
    if (r && r.saved === false) toast('Not saved (' + o.name + '): ' + r.why, 1);
    return flush();
  }).catch(function (e) {
    FLUSHING = false;
    if (isAuth(e)) return;
    if (errText(e) !== 'No network') { OUTBOX.shift(); ls('thps_outbox', OUTBOX); toast('Not saved: ' + errText(e), 1); return flush(); }
    setOnline(false);
  });
}
window.addEventListener('online', function () { setOnline(true); flush().then(function () { if (PAGE !== 'home') render(); }); });
window.addEventListener('offline', function () { setOnline(false); });
setInterval(function () { if (OUTBOX.length) flush(); }, 60000);

/* ------------------------------------------------------------------ modules */
var C = { home: '#E46C0A', stu: '#D86B1E', asm: '#1F6FB2', tch: '#7030A0', fin: '#2E8B57', rpt: '#8B1A1A', adm: '#2F5597', inv: '#138D8D', oth: '#7A4E2D' };
var MODS = [
  { id: 'home', label: 'Dashboard', icon: 'house', c: C.home, sub: 'Overview of the school' },
  { id: 'students', label: 'Students', icon: 'student', c: C.stu, sub: 'Class lists · add or correct' },
  { id: 'assess', label: 'Assessment', icon: 'bar_chart', c: C.asm, sub: 'Marks entry, ID cards', href: 'marks.html' },
  { id: 'Staff', label: 'Teachers', icon: 'teacher', c: C.tch, sub: 'Staff details & postings', need: 'senior' },
  { id: 'Finance', label: 'Finance', icon: 'money_bag', c: C.fin, sub: 'Combined cash book', need: 'admin' },
  { id: 'SchoolReports', label: 'School Reports', icon: 'page_facing_up', c: C.rpt, sub: 'Incident · situational · inspection' },
  { id: 'Events', label: 'Admin Routines', icon: 'spiral_calendar', c: C.adm, sub: 'Term dates, events, duties' },
  { id: 'Inventory', label: 'Infrastructure', icon: 'building_construction', c: C.inv, sub: 'Buildings, stationery, books', need: 'admin' },
  { id: 'FormsLog', label: 'Other Forms', icon: 'card_index', c: C.oth, sub: 'Forms register' }
];
function can(need) { if (!ME) return false; if (need === 'admin') return ME.admin; if (need === 'senior') return ME.admin || ME.senior; return true; }
var FORMS = ['Leave application', 'DSA claim', 'Leave fare', 'EDB023 Record of appointment', 'RoDSS', 'EDB020 Registration', 'TSC Form 28', 'TSC Form 30', 'TSC Form 23',
  'Teacher sick leave', 'Student sick sheet', 'Travel request', 'Student counselling', 'Parent conference', 'Behaviour report', 'Suspension / termination',
  'NSL finance', 'TSL finance', 'TISA finance', 'BSP finance', 'United Finance loan', 'Nationwide Finance loan', 'Other'];
var SCHEMA = {
  Finance: { title: 'Finance – Combined Cash Book', icon: 'money_bag', c: C.fin, year: true,
    fields: [['Date', 'Date', 'date', 1], ['Kind', 'Receipt or payment', ['Receipt', 'Payment'], 1], ['Account', 'Account', ['TFF', 'PSF (Parent Support Fee)', 'Project', 'Fundraising', 'Other']],
             ['Payee', 'Received from / paid to', 'text', 1], ['Details', 'Details', 'text'], ['Folio', 'Folio', 'text'], ['RefNo', 'Receipt / voucher no.', 'text'],
             ['Cash', 'Cash amount (K)', 'number'], ['Bank', 'Bank amount (K)', 'number']],
    cols: [['Date', 'd'], ['Kind'], ['Payee'], ['Details'], ['RefNo', '', 'Ref'], ['Cash', 'k'], ['Bank', 'k']], sort: 'Date' },
  SchoolReports: { title: 'School Reports', icon: 'page_facing_up', c: C.rpt, year: true, printOne: true,
    fields: [['Date', 'Date', 'date', 1], ['Type', 'Type of report', ['Incident', 'Situational', 'Inspection', 'Monthly', 'Annual', 'Other'], 1], ['Title', 'Title', 'text', 1],
             ['Place', 'Place', 'text'], ['People', 'People involved', 'text'], ['Details', 'What happened / report', 'area', 1], ['Action', 'Action taken', 'area'],
             ['ReportedBy', 'Reported by', 'text'], ['Status', 'Status', ['Open', 'Closed']]],
    cols: [['Date', 'd'], ['Type'], ['Title'], ['Place'], ['ReportedBy', '', 'Reported by'], ['Status']], sort: 'Date' },
  Events: { title: 'Admin Routines – Term Dates, Events & Duties', icon: 'spiral_calendar', c: C.adm, year: true,
    fields: [['Date', 'Date', 'date', 1], ['EndDate', 'End date', 'date'], ['Kind', 'Kind', ['Term date', 'Event', 'Meeting', 'Holiday', 'Duty', 'Inspection']], ['Title', 'Title', 'text', 1], ['Notes', 'Notes', 'area']],
    cols: [['Date', 'd'], ['EndDate', 'd', 'Until'], ['Kind'], ['Title'], ['Notes']], sort: 'Date', asc: true },
  Inventory: { title: 'Infrastructure & Inventory', icon: 'building_construction', c: C.inv,
    fields: [['Category', 'Category', ['Building', 'Furniture', 'Stationery', 'Curriculum books', 'Equipment', 'Other'], 1], ['Item', 'Item', 'text', 1], ['Location', 'Location / room', 'text'],
             ['Qty', 'Quantity', 'number'], ['Condition', 'Condition', ['Good', 'Fair', 'Needs repair', 'Low stock', 'Out of stock']], ['Notes', 'Notes', 'area']],
    cols: [['Category'], ['Item'], ['Location'], ['Qty', 'n'], ['Condition']], sort: 'Category', asc: true },
  Staff: { title: 'Teachers – Staff Details', icon: 'teacher', c: C.tch,
    fields: [['FileNo', 'File no.', 'text'], ['Name', 'Name', 'text', 1], ['Sex', 'Sex', ['M', 'F']], ['Position', 'Position', 'text'], ['Level', 'Level', 'text'],
             ['Status', 'Status', ['On posting', 'Not on posting', 'Pool', 'Leave', 'Suspension', 'Transferred']], ['Class', 'Class', 'text'], ['Phone', 'Phone', 'text'], ['Email', 'Email', 'text'], ['Notes', 'Notes', 'area']],
    cols: [['FileNo', '', 'File no.'], ['Name'], ['Sex'], ['Position'], ['Class'], ['Status'], ['Phone']], sort: 'Name', asc: true },
  FormsLog: { title: 'Other Forms – Register', icon: 'card_index', c: C.oth, year: true,
    fields: [['Date', 'Date', 'date', 1], ['Form', 'Form', FORMS, 1], ['Person', 'Teacher / student', 'text', 1], ['Purpose', 'Purpose', 'text'], ['Notes', 'Notes', 'area']],
    cols: [['Date', 'd'], ['Form'], ['Person'], ['Purpose']], sort: 'Date' }
};

/* ------------------------------------------------------------------ sign in */
function showLogin(msg) {
  var needLink = !apiUrl() || msg === 'NOLINK';
  $('#root').innerHTML = '<div class="login"><div class="box"><div class="logos"><img src="img/school.png" alt=""><img src="img/province.png" alt=""></div>' +
    '<h2>THPS SCHOOL MANAGER</h2><div class="muted">Tom Hoey Primary School · Mougulu, Middle Fly District</div>' +
    (msg && msg !== 'NOLINK' ? '<div class="note bad" style="margin-top:12px">' + esc(msg) + '</div>' : '') +
    '<div class="form">' +
    (needLink ? '<label>School database link (ends with /exec) – needed once<input id="lUrl" value="' + esc(apiUrl()) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' : '') +
    '<label>UserName<input id="lU" autocomplete="username" autocapitalize="none" value="' + esc(ls('thpsm_last') || '') + '"></label>' +
    '<label>Password<input id="lP" type="password" autocomplete="current-password"></label></div>' +
    '<button class="btn pri" id="lGo" style="width:100%;justify-content:center;margin-top:14px">' + ico('key') + 'Sign in</button>' +
    '<p class="muted" style="font-size:12px;margin-top:12px">Use the same UserName and Password as the Assessment (SARRS). The first sign-in needs the internet; after that the app opens without signal.</p></div></div>';
  var go = function () {
    var u = $('#lU').value.trim(), p = $('#lP').value;
    if ($('#lUrl')) { var url = $('#lUrl').value.trim(); if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)) return showLogin('Paste the database link from the Head Teacher. It starts with https://script.google.com/'); ls('thpsm_api', url); }
    if (!u || !p) return showLogin('Type your UserName and Password.');
    $('#lGo').disabled = true; $('#lGo').innerHTML = 'Signing in…';
    var a = { user: u, pass: p };
    call('apiDashboard', a).then(function (d) {
      AUTH = a; ls('thpsm_auth', a); ls('thpsm_last', u); ls('thps_pw_' + u.toLowerCase(), hash(p)); ls(ckey('dash'), d);
      start(d);
    }).catch(function (e) {
      if (isAuth(e)) return showLogin(errText(e));
      var saved = ls('thps_c_' + u.toLowerCase() + '_dash');
      if (saved && ls('thps_pw_' + u.toLowerCase()) === hash(p)) { AUTH = a; ls('thpsm_auth', a); setOnline(false); saved._offline = true; start(saved); toast('No network – working with the copy on this device.'); }
      else showLogin(errText(e) === 'NOLINK' ? 'NOLINK' : 'Cannot reach the school database (' + errText(e) + '). Connect to the internet for the first sign-in.');
    });
  };
  $('#lGo').onclick = go; $('#lP').onkeydown = function (e) { if (e.key === 'Enter') go(); };
  setTimeout(function () { ($('#lU').value ? $('#lP') : $('#lU')).focus(); }, 50);
}
function hash(s) { var h = 5381; s = String(s) + '|thps'; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }
function signOut(msg) {
  if (OUTBOX.length && !msg && !confirm(OUTBOX.length + ' change(s) are still waiting for the network. They stay on this device. Sign out?')) return;
  ls('thpsm_auth', null); AUTH = null; ME = null; showLogin(msg);
}

/* ------------------------------------------------------------------ layout */
function start(d) {
  ME = d.me; YEAR = d.year;
  var nav = MODS.map(function (m) {
    var ok = can(m.need);
    return '<button class="nav' + (ok ? '' : ' locked') + '" data-p="' + m.id + '" style="--c:' + m.c + '"' + (ok ? '' : ' title="Not for your login"') + '>' + ico(m.icon) + esc(m.label) + '</button>';
  }).join('');
  $('#root').innerHTML = '<div class="app"><aside class="side" id="side"><div class="brand"><img src="img/school.png" alt=""><b>THPS SCHOOL MANAGER</b><small>' + esc(d.school || 'TOM HOEY PRIMARY SCHOOL') + '</small></div>' +
    '<div class="sec">MENU</div>' + nav +
    '<div class="sec">SYSTEM</div><button class="nav" id="bSync">' + ico('counterclockwise_arrows_button') + 'Sync now</button><button class="nav" id="bOut" style="--c:#b22222">' + ico('locked') + 'Sign out</button>' +
    '<div class="owner"><b>Mr Saun Aloksep</b><br>Head Teacher – System Owner<br>Tom Hoey Primary School<br>Mougulu, Middle Fly District, W/P<br>☎ 74621880<br>saun.aloksep115@gmail.com</div></aside>' +
    '<div class="main"><div class="top"><button class="burger" id="burger">☰</button><img src="img/school.png" alt="" style="height:38px"><div><h1>THPS SCHOOL MANAGER</h1><div class="sub">Western Provincial Administration · Division of Education, Middle Fly District</div></div>' +
    '<span class="sp"></span><span class="pill" id="pill"></span><span class="pill">' + esc(ME.name || ME.user) + (ME.admin ? ' · Administrator' : ME.senior ? ' · Senior Teacher' : ' · Teacher') + '</span>' +
    '<img src="img/province.png" alt="" style="height:38px"></div><div class="content" id="page"></div></div></div>';
  $$('.nav[data-p]').forEach(function (b) { b.onclick = function () { go(b.dataset.p); }; });
  $('#bOut').onclick = function () { signOut(); };
  $('#bSync').onclick = function () { flush().then(function () { render(); toast(OUTBOX.length ? OUTBOX.length + ' change(s) still waiting' : 'Up to date'); }); };
  $('#burger').onclick = function () { $('#side').classList.toggle('open'); };
  setOnline(!d._offline);
  flush();
  render(d);
}
function go(p) {
  var m = MODS.filter(function (x) { return x.id === p; })[0];
  if (m && !can(m.need)) return toast('Your login cannot open ' + m.label + '.', 1);
  if (m && m.href) { location.href = m.href; return; }
  PAGE = p; ls('thps_page', p); $('#side').classList.remove('open'); render();
}
function render(dash) {
  $$('.nav[data-p]').forEach(function (b) { b.classList.toggle('on', b.dataset.p === PAGE); });
  var el = $('#page'); el.innerHTML = '<div class="muted">Loading…</div>';
  if (PAGE === 'home') return pageHome(dash);
  if (PAGE === 'students') return pageStudents();
  if (SCHEMA[PAGE]) return pageTable(PAGE);
  PAGE = 'home'; pageHome(dash);
}
function head(icon, title, crumb, lead) {
  return '<div class="phead"><img src="img/school.png" alt=""><div><b>TOM HOEY PRIMARY SCHOOL</b><br>' + esc(title) + '</div></div>' +
    '<div class="crumb noprint">Home  ›  ' + esc(crumb) + '</div><h2 class="ttl">' + ico(icon) + esc(title) + '</h2>' + (lead ? '<p class="lead">' + lead + '</p>' : '');
}

/* ------------------------------------------------------------------ charts (plain SVG) */
function bars(labels, series, opt) {
  opt = opt || {}; var W = 520, H = opt.h || 210, L = 40, B = 26, T = 10, n = labels.length;
  var stacked = !!opt.stacked, max = 0;
  labels.forEach(function (_, i) {
    var v = stacked ? series.reduce(function (t, s) { return t + (Number(s.data[i]) || 0); }, 0) : Math.max.apply(null, series.map(function (s) { return Number(s.data[i]) || 0; }));
    max = Math.max(max, v);
  });
  if (opt.max) max = opt.max; if (!max) max = 1; if (!opt.max && !opt.k && max < 4) max = 4;
  var step = Math.pow(10, Math.floor(Math.log10(max))), nice = Math.ceil(max / step) * step; max = nice;
  var cw = (W - L - 6) / n, g = '';
  for (var k = 0; k <= 4; k++) { var y = T + (H - T - B) * (1 - k / 4), v = max * k / 4; g += '<line x1="' + L + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#333b46"/><text x="' + (L - 4) + '" y="' + (y + 4) + '" text-anchor="end">' + (opt.k ? (v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)) : Math.round(v)) + '</text>'; }
  labels.forEach(function (lab, i) {
    var x0 = L + i * cw + cw * 0.15, bw = cw * 0.7, base = H - B;
    if (stacked) {
      var acc = 0;
      series.forEach(function (s) { var v = Number(s.data[i]) || 0, h = (H - T - B) * v / max; g += '<rect x="' + x0 + '" y="' + (base - acc - h) + '" width="' + bw + '" height="' + h + '" fill="' + s.color + '" rx="2"><title>' + esc(s.name + ': ' + v) + '</title></rect>'; acc += h; });
    } else {
      var w1 = bw / series.length;
      series.forEach(function (s, j) { var v = Number(s.data[i]) || 0, h = (H - T - B) * v / max; g += '<rect x="' + (x0 + j * w1) + '" y="' + (base - h) + '" width="' + (w1 - 1) + '" height="' + h + '" fill="' + s.color + '" rx="2"><title>' + esc(s.name + ': ' + (opt.k ? money(v) : Math.round(v * 10) / 10)) + '</title></rect>'; });
    }
    g += '<text x="' + (L + i * cw + cw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lab) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%">' + g + '</svg><div class="legend">' + series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
}

/* ------------------------------------------------------------------ HOME */
function pageHome(d) {
  var p = d ? Promise.resolve(d) : load('dash', 'apiDashboard', AUTH);
  p.then(function (d) {
    YEAR = d.year;
    var fin = d.finance;
    var k = [['STUDENTS (ACTIVE)', d.students, d.enrol.reduce(function (t, g) { return t + g.m; }, 0) + ' boys · ' + d.enrol.reduce(function (t, g) { return t + g.f; }, 0) + ' girls', C.stu, 'busts_in_silhouette'],
             ['AVERAGE YEAR %', (Math.round(d.avgYear * 10) / 10) + '%', d.promote + ' promote · ' + d.repeat + ' repeat', C.asm, 'trophy'],
             ['TEACHERS & CLASSES', d.teachers, d.classes + ' classes · year ' + d.year, C.tch, 'teacher']];
    if (fin) k.push(['FINANCE BALANCE', money(fin.cash + fin.bank), 'Cash ' + money(fin.cash) + ' · Bank ' + money(fin.bank), C.fin, 'bank']);
    else k.push(['SCHOOL REPORTS', d.reports, 'Saved this year', C.rpt, 'page_facing_up']);
    var groups = [
      ['STUDENTS & ASSESSMENT', C.asm, 'bar_chart', ['students', 'assess']],
      ['TEACHERS & ADMINISTRATION', C.tch, 'teacher', ['Staff', 'Events', 'FormsLog']],
      ['FINANCE, REPORTS & INFRASTRUCTURE', C.fin, 'money_bag', ['Finance', 'SchoolReports', 'Inventory']]];
    var h = head('house', 'Dashboard', 'Overview', 'School year <b>' + d.year + '</b>' + (d._offline ? ' · <span style="color:#e0a400">offline copy</span>' : '') + ' · choose a module to begin');
    h += '<div class="kpis">' + k.map(function (x) { return '<div class="kpi" style="--c:' + x[3] + '"><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b><span>' + esc(x[2]) + '</span>' + ico(x[4]) + '</div>'; }).join('') + '</div>';
    h += '<div class="cols"><div>' + groups.map(function (g) {
      return '<div class="group" style="--c:' + g[1] + '"><h4>' + ico(g[2]) + g[0] + '</h4><div class="tiles">' + g[3].map(function (id) {
        var m = MODS.filter(function (x) { return x.id === id; })[0], ok = can(m.need);
        return '<button class="tile" data-go="' + id + '" style="--c:' + m.c + (ok ? '' : ';opacity:.45') + '"><span class="sq">' + ico(m.icon) + '</span><span><b>' + esc(m.label) + '</b><small>' + esc(ok ? m.sub : 'Not for your login') + '</small></span></button>';
      }).join('') + '</div></div>';
    }).join('');
    h += '<div class="panel" style="--c:' + C.stu + '"><h3>' + ico('busts_in_silhouette') + 'Students by grade</h3>' +
      bars(d.enrol.map(function (g) { return g.grade.replace('Grade ', 'G'); }), [{ name: 'Boys', color: '#2F80ED', data: d.enrol.map(function (g) { return g.m; }) }, { name: 'Girls', color: '#E46C0A', data: d.enrol.map(function (g) { return g.f; }) }], { stacked: true }) + '</div>';
    h += '<div class="panel" style="--c:' + C.asm + '"><h3>' + ico('chart_increasing') + 'Average % by grade – AP1 and AP2</h3>' +
      bars(d.gradeAvg.map(function (g) { return g.grade.replace('Grade ', 'G'); }), [{ name: 'AP1 %', color: '#2F80ED', data: d.gradeAvg.map(function (g) { return g.ap1; }) }, { name: 'AP2 %', color: '#2E8B57', data: d.gradeAvg.map(function (g) { return g.ap2; }) }], { max: 100 }) + '</div>';
    h += '</div><div>';
    h += '<div class="panel" style="--c:' + C.home + '"><h3>' + ico('clipboard') + 'Summary</h3><table class="tbl">' +
      [['School year', d.year], ['Students active', d.students], ['Left / withdrawn', d.left], ['Classes', d.classes], ['Reports saved', d.reports], ['Waiting to upload', OUTBOX.length]].map(function (r) { return '<tr><td class="muted">' + r[0] + '</td><td><b>' + esc(r[1]) + '</b></td></tr>'; }).join('') + '</table></div>';
    h += '<div class="panel" style="--c:' + C.adm + '"><h3>' + ico('spiral_calendar') + 'Coming up</h3>' + (d.events.length ? '<table class="tbl">' + d.events.map(function (e) { return '<tr><td>' + fmtDate(e.date) + '</td><td><b>' + esc(e.title) + '</b><br><small class="muted">' + esc(e.kind) + '</small></td></tr>'; }).join('') + '</table>' : '<p class="muted">No events listed. Add them in Admin Routines.</p>') + '</div>';
    if (fin) h += '<div class="panel" style="--c:' + C.fin + '"><h3>' + ico('money_bag') + 'Receipts vs payments</h3>' +
      bars(['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], [{ name: 'Receipts', color: '#2E8B57', data: fin.months.map(function (m) { return m.rin; }) }, { name: 'Payments', color: '#E46C0A', data: fin.months.map(function (m) { return m.rout; }) }], { k: true, h: 190 }) + '</div>';
    h += '<div class="panel" style="--c:' + C.asm + '"><h3>' + ico('link') + 'Shortcuts</h3><div class="bar" style="margin:0">' +
      '<button class="btn" data-go="assess">' + ico('pencil') + 'Enter marks</button><button class="btn" data-go="students">' + ico('plus') + 'Add student</button>' +
      '<button class="btn" data-go="SchoolReports">' + ico('warning') + 'Write a report</button><button class="btn" onclick="print()">' + ico('printer') + 'Print</button></div></div>';
    h += '</div></div>';
    $('#page').innerHTML = h;
    $$('[data-go]').forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; });
  }).catch(function (e) { $('#page').innerHTML = '<div class="note bad">Cannot open the dashboard: ' + esc(errText(e)) + '</div>'; });
}

/* ------------------------------------------------------------------ STUDENTS (same list the Excel database and the marks app use) */
var SV = { cc: '', q: '', list: null };
function pageStudents() {
  load('students', 'apiStudents', AUTH).then(function (d) {
    SV.list = d.students; var cls = d.classes || ME.classes;
    if (!SV.cc || cls.indexOf(SV.cc) < 0) SV.cc = 'ALL';
    var h = head('student', 'Students ' + d.year, 'Students', 'Every change reaches the class teacher at once, and goes into the Excel database with <b>Download Online</b>.' + (d._offline ? ' <span style="color:#e0a400">Offline copy – adding needs the internet.</span>' : ''));
    var act = d.students.filter(function (s) { return !/left|withdraw|expel/i.test(s.status); });
    h += '<div class="kpis"><div class="kpi" style="--c:' + C.stu + '"><small>ACTIVE STUDENTS</small><b>' + act.length + '</b><span>' + act.filter(function (s) { return /^m/i.test(s.sex); }).length + ' boys · ' + act.filter(function (s) { return /^f/i.test(s.sex); }).length + ' girls</span>' + ico('busts_in_silhouette') + '</div>' +
      '<div class="kpi" style="--c:' + C.asm + '"><small>CLASSES</small><b>' + cls.length + '</b><span>' + esc(cls.join(', ')) + '</span>' + ico('school') + '</div>' +
      '<div class="kpi" style="--c:' + C.home + '"><small>ADDED ONLINE</small><b>' + d.students.filter(function (s) { return s.pending; }).length + '</b><span>waiting for Excel</span>' + ico('outbox_tray') + '</div></div>';
    h += '<div class="bar"><select id="sCc"><option value="ALL">All my classes</option>' + cls.map(function (c) { return '<option' + (c === SV.cc ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<input id="sQ" placeholder="Search name or ID" value="' + esc(SV.q) + '"><button class="btn pri" id="sAdd">' + ico('plus') + 'Add student</button><button class="btn" onclick="print()">' + ico('printer') + 'Print list</button></div><div id="sList"></div>';
    $('#page').innerHTML = h;
    $('#sCc').onchange = function () { SV.cc = this.value; drawStudents(); };
    $('#sQ').oninput = function () { SV.q = this.value; drawStudents(); };
    $('#sAdd').onclick = function () { stuForm({ id: '', sur: '', name: '', sex: '', cc: SV.cc !== 'ALL' ? SV.cc : cls[0], status: 'Active', dob: '' }, cls); };
    drawStudents(cls);
  }).catch(function (e) { $('#page').innerHTML = '<div class="note bad">' + esc(errText(e)) + '</div>'; });
}
function drawStudents(cls) {
  cls = cls || ME.classes;
  var q = SV.q.toLowerCase(), list = SV.list.filter(function (s) { return (SV.cc === 'ALL' || s.cc === SV.cc) && (!q || (s.sur + ' ' + s.name + ' ' + s.id).toLowerCase().indexOf(q) >= 0); })
    .sort(function (a, b) { return (a.cc + a.sur + a.name).localeCompare(b.cc + b.sur + b.name); });
  $('#sList').innerHTML = '<div class="wrap"><table class="tbl"><thead><tr><th>#</th><th>ID</th><th>Surname</th><th>Name</th><th>Sex</th><th>Class</th><th>Status</th><th class="noprint"></th></tr></thead><tbody>' +
    list.map(function (s, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(s.id) + (s.pending ? ' <span class="tag new">new</span>' : '') + '</td><td><b>' + esc(s.sur) + '</b></td><td>' + esc(s.name) + '</td><td>' + esc(s.sex) + '</td><td>' + esc(s.cc) + '</td><td>' + esc(s.status || 'Active') + '</td><td class="noprint"><button class="btn" data-e="' + esc(s.id) + '">' + ico('pencil') + 'Edit</button></td></tr>'; }).join('') +
    (list.length ? '' : '<tr><td colspan="8" class="muted">No students found.</td></tr>') + '</tbody></table></div><p class="muted">' + list.length + ' students shown · <span class="tag new">new</span> = added or changed online, waiting for Excel.</p>';
  $$('#sList [data-e]').forEach(function (b) { b.onclick = function () { stuForm(JSON.parse(JSON.stringify(SV.list.filter(function (s) { return s.id === b.dataset.e; })[0])), cls); }; });
}
function opts(arr, v) { return arr.map(function (x) { return '<option' + (String(x) === String(v) ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); }
function stuForm(s, cls) {
  var m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = '<div class="box"><h2>' + ico('student') + (s.id ? 'Change ' + esc(s.id) : 'New student') + '</h2><div class="form">' +
    '<label>Surname<input id="fSur" value="' + esc(s.sur) + '" style="text-transform:uppercase"></label><label>Name<input id="fName" value="' + esc(s.name) + '"></label>' +
    '<label>Sex<select id="fSex"><option></option>' + opts(['M', 'F'], s.sex) + '</select></label><label>Class<select id="fCc">' + opts(cls, s.cc) + '</select></label>' +
    '<label>Status<select id="fSt">' + opts(['Active', 'Left', 'Withdrawn'], s.status || 'Active') + '</select></label><label>Date of birth<input id="fDob" placeholder="dd/mm/yyyy" value="' + esc(s.dob || '') + '"></label></div>' +
    '<div class="acts"><button class="btn" id="fX">Cancel</button><button class="btn ok" id="fS">' + ico('floppy_disk') + 'Save</button></div></div>';
  document.body.appendChild(m);
  $('#fX', m).onclick = function () { m.remove(); };
  $('#fS', m).onclick = function () {
    var st = { id: s.id, sur: $('#fSur', m).value.trim(), name: $('#fName', m).value.trim(), sex: $('#fSex', m).value, cc: $('#fCc', m).value, status: $('#fSt', m).value, dob: $('#fDob', m).value.trim() };
    this.disabled = true;
    call('apiSaveStudent', AUTH, st).then(function (d) { setOnline(true); m.remove(); SV.list = d.students; ls(ckey('students'), { year: YEAR, students: d.students, classes: cls }); toast('Saved ' + d.id); drawStudents(cls); })
      .catch(function (e) { $('#fS', m).disabled = false; toast(errText(e) === 'No network' ? 'Adding students needs the internet. Try again when the network is back.' : 'Not saved: ' + errText(e), 1); });
  };
}

/* ------------------------------------------------------------------ TABLE PAGES (Finance, Reports, Events, Inventory, Staff, Forms) */
var TV = {};
function pageTable(name) {
  var S = SCHEMA[name], st = TV[name] = TV[name] || { q: '', year: YEAR, f: '' };
  load('t_' + name + '_' + (S.year ? st.year : ''), 'apiTable', AUTH, name, S.year ? st.year : '').then(function (d) {
    // show what is still waiting in the outbox
    var rows = d.rows.slice();
    OUTBOX.filter(function (o) { return o.name === name; }).forEach(function (o) {
      rows = rows.filter(function (r) { return r.Key !== o.rec.Key; });
      if (!o.del) { var r = JSON.parse(JSON.stringify(o.rec)); r._wait = true; rows.push(r); }
    });
    st.rows = rows; st.canWrite = d.canWrite;
    var m = MODS.filter(function (x) { return x.id === name; })[0];
    var h = head(S.icon, S.title + (S.year ? '  ' + st.year : ''), m.label, (d._offline ? '<span style="color:#e0a400">Offline copy – new entries are kept on this device and upload when the network returns.</span>' : (d.canWrite ? 'Add, change or delete entries. Everything saves to the school database.' : 'You can read this page.')));
    h += summaryFor(name, rows);
    h += '<div class="bar">' + (S.year ? '<select id="tY">' + opts([YEAR - 2, YEAR - 1, YEAR, YEAR + 1], st.year) + '</select>' : '') +
      '<input id="tQ" placeholder="Search" value="' + esc(st.q) + '">' + (d.canWrite ? '<button class="btn pri" id="tAdd">' + ico('plus') + 'Add</button>' : '') +
      '<button class="btn" onclick="print()">' + ico('printer') + 'Print</button><button class="btn" id="tCsv">' + ico('outbox_tray') + 'Export (CSV)</button></div><div id="tList"></div>';
    $('#page').innerHTML = h;
    if ($('#tY')) $('#tY').onchange = function () { st.year = Number(this.value); pageTable(name); };
    $('#tQ').oninput = function () { st.q = this.value; drawTable(name); };
    if ($('#tAdd')) $('#tAdd').onclick = function () { rowForm(name, null); };
    $('#tCsv').onclick = function () { csv(name); };
    drawTable(name);
  }).catch(function (e) { $('#page').innerHTML = '<div class="note bad">' + esc(errText(e)) + '</div>'; });
}
function summaryFor(name, rows) {
  if (name === 'Finance') {
    var rin = 0, rout = 0, cash = 0, bank = 0, months = []; for (var i = 0; i < 12; i++) months.push({ i: 0, o: 0 });
    rows.forEach(function (r) { var c = Number(r.Cash) || 0, b = Number(r.Bank) || 0, s = r.Kind === 'Payment' ? -1 : 1, mo = (Number(String(r.Date).slice(5, 7)) || 1) - 1;
      if (s > 0) { rin += c + b; months[mo].i += c + b; } else { rout += c + b; months[mo].o += c + b; } cash += s * c; bank += s * b; });
    return '<div class="kpis"><div class="kpi" style="--c:#2E8B57"><small>RECEIPTS</small><b>' + money(rin) + '</b><span>this year</span>' + ico('inbox_tray') + '</div>' +
      '<div class="kpi" style="--c:#B22222"><small>PAYMENTS</small><b>' + money(rout) + '</b><span>this year</span>' + ico('outbox_tray') + '</div>' +
      '<div class="kpi" style="--c:#E9B949"><small>CASH ON HAND</small><b>' + money(cash) + '</b><span>receipts less payments</span>' + ico('coin') + '</div>' +
      '<div class="kpi" style="--c:#2F80ED"><small>CASH AT BANK</small><b>' + money(bank) + '</b><span>receipts less payments</span>' + ico('bank') + '</div></div>' +
      '<div class="panel noprint" style="--c:#2E8B57"><h3>' + ico('chart_increasing') + 'Receipts vs payments by month</h3>' + bars(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        [{ name: 'Receipts', color: '#2E8B57', data: months.map(function (m) { return m.i; }) }, { name: 'Payments', color: '#E46C0A', data: months.map(function (m) { return m.o; }) }], { k: true, h: 180 }) + '</div>';
  }
  var key = { SchoolReports: 'Type', Events: 'Kind', Inventory: 'Condition', Staff: 'Status', FormsLog: 'Form' }[name], cnt = {};
  rows.forEach(function (r) { var v = r[key] || '—'; cnt[v] = (cnt[v] || 0) + 1; });
  var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 3);
  return '<div class="kpis"><div class="kpi" style="--c:' + SCHEMA[name].c + '"><small>TOTAL ENTRIES</small><b>' + rows.length + '</b><span>' + esc(SCHEMA[name].title) + '</span>' + ico(SCHEMA[name].icon) + '</div>' +
    top.map(function (t) { return '<div class="kpi" style="--c:#3A4250"><small>' + esc(String(t).toUpperCase()) + '</small><b>' + cnt[t] + '</b><span>' + esc(key) + '</span></div>'; }).join('') + '</div>';
}
function cellOut(r, c) {
  var v = r[c[0]];
  if (c[1] === 'd') return fmtDate(v);
  if (c[1] === 'k') return v === '' || v == null ? '' : money(v);
  return esc(v);
}
function drawTable(name) {
  var S = SCHEMA[name], st = TV[name], q = st.q.toLowerCase();
  var rows = st.rows.filter(function (r) { return !q || S.cols.map(function (c) { return r[c[0]]; }).join(' ').toLowerCase().indexOf(q) >= 0; })
    .sort(function (a, b) { var x = String(a[S.sort] || ''), y = String(b[S.sort] || ''); return S.asc ? x.localeCompare(y) : y.localeCompare(x); });
  $('#tList').innerHTML = '<div class="wrap"><table class="tbl"><thead><tr>' + S.cols.map(function (c) { return '<th' + (c[1] === 'k' || c[1] === 'n' ? ' style="text-align:right"' : '') + '>' + esc(c[2] || c[0]) + '</th>'; }).join('') + '<th class="noprint"></th></tr></thead><tbody>' +
    rows.map(function (r) { return '<tr>' + S.cols.map(function (c) { return '<td' + (c[1] === 'k' || c[1] === 'n' ? ' class="n"' : '') + '>' + cellOut(r, c) + '</td>'; }).join('') +
      '<td class="noprint" style="white-space:nowrap">' + (r._wait ? '<span class="tag new">waiting</span> ' : '') + '<button class="btn" data-k="' + esc(r.Key) + '">' + ico(st.canWrite ? 'pencil' : 'magnifying_glass_tilted_left') + (st.canWrite ? 'Open' : 'View') + '</button></td></tr>'; }).join('') +
    (rows.length ? '' : '<tr><td colspan="' + (S.cols.length + 1) + '" class="muted">Nothing here yet.</td></tr>') + '</tbody></table></div><p class="muted">' + rows.length + ' entries</p>';
  $$('#tList [data-k]').forEach(function (b) { b.onclick = function () { rowForm(name, st.rows.filter(function (r) { return r.Key === b.dataset.k; })[0]); }; });
}
function rowForm(name, r) {
  var S = SCHEMA[name], st = TV[name], isNew = !r, ro = !st.canWrite;
  r = r ? JSON.parse(JSON.stringify(r)) : {};
  if (isNew) S.fields.forEach(function (f) { if (f[2] === 'date' && f[3]) r[f[0]] = (!S.year || String(st.year) === today().slice(0, 4)) ? today() : st.year + '-01-01'; });
  var m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = '<div class="box"><h2>' + ico(S.icon) + (isNew ? 'New entry' : esc(r.Title || r.Item || r.Name || r.Payee || r.Form || 'Entry')) + '</h2><div class="form">' +
    S.fields.map(function (f) {
      var v = r[f[0]] == null ? '' : r[f[0]], dis = ro ? ' disabled' : '', lab = esc(f[1]) + (f[3] ? ' *' : '');
      if (Array.isArray(f[2])) return '<label>' + lab + '<select data-f="' + f[0] + '"' + dis + '><option></option>' + opts(f[2], v) + '</select></label>';
      if (f[2] === 'area') return '<label class="wide">' + lab + '<textarea data-f="' + f[0] + '"' + dis + '>' + esc(v) + '</textarea></label>';
      return '<label>' + lab + '<input data-f="' + f[0] + '" type="' + (f[2] === 'number' ? 'number" step="0.01' : f[2]) + '" value="' + esc(String(v).slice(0, f[2] === 'date' ? 10 : 999)) + '"' + dis + '></label>';
    }).join('') + '</div><div class="acts">' +
    (!isNew && st.canWrite ? '<button class="btn bad" id="rDel">' + ico('wastebasket') + 'Delete</button>' : '') +
    (S.printOne && !isNew ? '<button class="btn" id="rPrint">' + ico('printer') + 'Print</button>' : '') +
    '<button class="btn" id="rX">Close</button>' + (st.canWrite ? '<button class="btn ok" id="rS">' + ico('floppy_disk') + 'Save</button>' : '') + '</div></div>';
  document.body.appendChild(m);
  $('#rX', m).onclick = function () { m.remove(); };
  if ($('#rPrint', m)) $('#rPrint', m).onclick = function () { printOne(name, r); };
  if ($('#rDel', m)) $('#rDel', m).onclick = function () {
    if (!confirm('Delete this entry?')) return;
    var rec = { Key: r.Key, _del: true }; m.remove();
    st.rows = st.rows.filter(function (x) { return x.Key !== r.Key; });
    send(name, rec, true);
  };
  if ($('#rS', m)) $('#rS', m).onclick = function () {
    var rec = { Key: r.Key || (name.charAt(0) + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)), Ms: Date.now() }, miss = [];
    $$('[data-f]', m).forEach(function (el) { rec[el.dataset.f] = el.value; });
    S.fields.forEach(function (f) { if (f[3] && !String(rec[f[0]] || '').trim()) miss.push(f[1]); });
    if (name === 'Finance' && !(Number(rec.Cash) || Number(rec.Bank))) miss.push('Cash or bank amount');
    if (miss.length) return toast('Please fill: ' + miss.join(', '), 1);
    if (S.year) rec.Year = Number(String(rec.Date || '').slice(0, 4)) || st.year;
    m.remove();
    st.rows = st.rows.filter(function (x) { return x.Key !== rec.Key; }); var shown = JSON.parse(JSON.stringify(rec)); shown._wait = true; st.rows.push(shown);
    drawTable(name);
    send(name, rec, false);
  };
}
function send(name, rec, del) {
  queueSave(name, rec);
  flush().then(function () {
    var still = OUTBOX.some(function (o) { return o.name === name && o.rec.Key === rec.Key; });
    toast(still ? 'Saved on this device – it uploads when the network returns' : (del ? 'Deleted' : 'Saved'));
    if (!still && PAGE === name) pageTable(name); else if (PAGE === name) drawTable(name);
  });
}
function printOne(name, r) {
  var S = SCHEMA[name], w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print.', 1);
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(r.Title || S.title) + '</title><style>body{font:14px Arial;margin:24px;color:#000}h1{font-size:18px;margin:0}' +
    '.h{display:flex;gap:14px;align-items:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px}.h img{height:70px}table{width:100%;border-collapse:collapse}td{border:1px solid #999;padding:8px;vertical-align:top}td:first-child{width:28%;font-weight:bold;background:#f2f2f2}' +
    '.sig{margin-top:50px;display:flex;justify-content:space-between}.sig div{border-top:1px solid #000;width:40%;padding-top:4px;text-align:center}</style></head><body>' +
    '<div class="h"><img src="' + location.href.replace(/[^/]*$/, '') + 'img/school.png"><div><h1>TOM HOEY PRIMARY SCHOOL</h1>Mougulu, Middle Fly District, Western Province<br><b>' + esc((r.Type || '') + ' REPORT').toUpperCase() + '</b></div>' +
    '<img src="' + location.href.replace(/[^/]*$/, '') + 'img/province.png" style="margin-left:auto"></div><table>' +
    S.fields.map(function (f) { return '<tr><td>' + esc(f[1]) + '</td><td>' + esc(f[2] === 'date' ? fmtDate(r[f[0]]) : r[f[0]]).replace(/\n/g, '<br>') + '</td></tr>'; }).join('') +
    '</table><div class="sig"><div>Reported by</div><div>Head Teacher – Mr Saun Aloksep</div></div><script>onload=function(){print()}<\/script></body></html>');
  w.document.close();
}
function csv(name) {
  var S = SCHEMA[name], rows = TV[name].rows, f = S.fields.map(function (x) { return x[0]; });
  var out = [f.join(',')].concat(rows.map(function (r) { return f.map(function (k) { var v = String(r[k] == null ? '' : r[k]); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }));
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/csv' })); a.download = 'THPS_' + name + '_' + (TV[name].year || '') + '.csv'; a.click();
}

/* ------------------------------------------------------------------ boot */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
if (AUTH) {
  var cached = ls(ckey('dash'));
  call('apiDashboard', AUTH).then(function (d) { ls(ckey('dash'), d); start(d); })
    .catch(function (e) { if (isAuth(e)) return signOut(errText(e)); if (cached) { cached._offline = true; start(cached); } else showLogin('Cannot reach the school database (' + errText(e) + ').'); });
} else showLogin();
window.THPS = { version: VERSION, go: go };
})();
