/* THPS SCHOOL MANAGER ONLINE  v11  -  Tom Hoey Primary School, Mougulu, Middle Fly District, W/P
 * Installable web app (GitHub Pages) using the school Google Sheet (Apps Script web app) as its database.
 * Works offline: every page keeps its last copy on the device and saves wait in an outbox until the network returns.
 * Icons: Microsoft Fluent Emoji (MIT licence). */
(function () {
'use strict';
var VERSION = '13.0';
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
var AUTH = ls('thpsm_auth'), MAIN = ls('thpsm_main'), FIN = ls('thps_fin'), ME = null, PAGE = ls('thps_page') || 'home', ONLINE = navigator.onLine, OUTBOX = ls('thps_outbox') || [], YEAR = null;
function call(fn) {
  var args = [].slice.call(arguments, 1);
  if (window.THPS_MOCK) return window.THPS_MOCK(fn, args);
  var u = apiUrl(); if (!u) return Promise.reject(new Error('NOLINK'));
  return fetch(u, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args }) })
    .then(function (r) { return r.text(); })
    .then(function (t) { var j; try { j = JSON.parse(t); } catch (e) { throw new Error('NET'); } if (!j.ok) throw new Error(j.error); return j.data; });
}
function isAuth(e) { return /^(Error: )?AUTH:/.test(String(e && e.message || e)); }
function isFinAuth(e) { return /FINAUTH:/.test(String(e && e.message || e)); }
function MA() { return { t: MAIN && MAIN.t }; }                       // Main login
function FA() { return { t: MAIN && MAIN.t, f: FIN }; }               // Main + Finance login
function errText(e) { var m = String(e && e.message || e); if (m === 'NET' || /Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No network'; return m.replace(/^Error:\s*/, '').replace(/^(FIN)?AUTH:\s*/, ''); }
function ckey(k) { return 'thps_c_' + (MAIN ? String(MAIN.user || MAIN.role).toLowerCase() : '') + '_' + k; }
/* online first, the device copy when there is no network */
function load(key, fn) {
  var args = [].slice.call(arguments, 2);
  return call.apply(null, [fn].concat(args)).then(function (d) { setOnline(true); ls(ckey(key), d); return d; })
    .catch(function (e) {
      if (isAuth(e)) { signOut(errText(e)); throw e; }
      if (isFinAuth(e)) { FIN = null; ls('thps_fin', null); throw e; }
      if (/Wrong UserName or Password/.test(errText(e))) { AUTH = null; ls('thpsm_auth', null); throw e; }
      if (errText(e) !== 'No network') throw e;
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
  if (FLUSHING || !OUTBOX.length || !MAIN) return Promise.resolve();
  FLUSHING = true;
  var o = OUTBOX[0];
  var au = o.name === 'CCB' ? FA() : MA();
  var p = o.del ? call('apiDeleteRow', au, o.name, o.rec.Key) : call('apiSaveRow', au, o.name, o.rec);
  return p.then(function (r) {
    OUTBOX.shift(); ls('thps_outbox', OUTBOX); FLUSHING = false; setOnline(true);
    if (r && r.saved === false) toast('Not saved (' + o.name + '): ' + r.why, 1);
    return flush();
  }).catch(function (e) {
    FLUSHING = false;
    if (isAuth(e) || isFinAuth(e)) return;
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
  { id: 'messages', label: 'Messages', icon: 'envelope_with_arrow', c: '#2F5597', sub: 'Messages & this week\'s schedule' },
  { id: 'students', label: 'Students', icon: 'student', c: C.stu, sub: 'Student database', need: 'admin' },
  { id: 'assess', label: 'Assessment', icon: 'bar_chart', c: C.asm, sub: 'Results, marks entry, ID cards' },
  { id: 'Staff', label: 'Teachers', icon: 'teacher', c: C.tch, sub: 'Staff details & postings', need: 'admin' },
  { id: 'Finance', label: 'Finance', icon: 'money_bag', c: C.fin, sub: 'Combined cash book', need: 'admin' },
  { id: 'SchoolReports', label: 'School Reports', icon: 'page_facing_up', c: C.rpt, sub: 'Incident · situational · inspection', need: 'senior' },
  { id: 'Events', label: 'Admin Routines', icon: 'spiral_calendar', c: C.adm, sub: 'Term dates, events, duties' },
  { id: 'Inventory', label: 'Infrastructure', icon: 'building_construction', c: C.inv, sub: 'Infrastructure, stationery, curriculum', need: 'admin' },
  { id: 'FormsLog', label: 'Other Forms', icon: 'card_index', c: C.oth, sub: 'Forms register', need: 'teacher' }
];
/* who opens what - the same as the Excel Main login (LOGIN sheet) */
function can(need) {
  var r = MAIN ? MAIN.role : '';
  if (r === 'Admin') return true;
  if (need === 'admin') return false;
  if (need === 'senior') return r === 'Senior';
  if (need === 'teacher') return r === 'Teacher';
  return !!r;
}
function roleText() { return { Admin: 'Administrator', Teacher: 'Teacher', Senior: 'Senior Teacher' }[MAIN && MAIN.role] || ''; }
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

/* ------------------------------------------------------------------ sign in: the same three sign-in pages as the Excel workbook */
function loginBox(o) {
  return '<div class="login"><div class="box lg2"><div class="lgL"><div class="logos"><img src="img/school.png" alt=""><img src="img/province.png" alt=""></div>' +
    '<h2>' + esc(o.big) + '</h2><div class="muted">' + esc(o.small) + '</div><div class="muted" style="margin-top:8px"><b>TOM HOEY PRIMARY SCHOOL</b> (71 - 207)<br><i>In God, We Shall Prosper</i></div>' +
    '<div class="sh" style="--c:' + o.c + ';margin-top:14px">' + esc(o.title) + '</div><div class="lgRules">' + o.rules.map(function (r) { return '<p>● <b>' + r[0] + '</b> – ' + r[1] + '</p>'; }).join('') + '</div></div>' +
    '<div class="lgR"><h2 style="text-align:left">' + ico('key') + ' Sign in</h2><p class="muted" style="text-align:left;margin:4px 0 0">' + esc(o.lead) + '</p>' +
    (o.msg && o.msg !== 'NOLINK' ? '<div class="note bad" style="margin-top:12px;text-align:left">' + esc(o.msg) + '</div>' : '') +
    '<div class="form">' + (o.link ? '<label>School database link (ends with /exec) – needed once<input id="lUrl" value="' + esc(apiUrl()) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' : '') +
    '<label>USERNAME<input id="lU" autocomplete="username" autocapitalize="none" value="' + esc(o.user || '') + '"></label>' +
    '<label>PASSWORD<input id="lP" type="password" autocomplete="current-password"></label></div><p class="muted" style="font-size:12px;text-align:left">The password shows as dots.</p>' +
    '<button class="btn pri" id="lGo" style="width:100%;justify-content:center;margin-top:8px">' + ico('key') + 'Sign in</button>' +
    (o.back ? '<button class="btn" id="lBack" style="width:100%;justify-content:center;margin-top:8px">' + ico('house') + 'Back to Main Homepage</button>' : '') +
    '<p class="muted" style="font-size:12px;margin-top:12px;text-align:left">' + o.foot + '</p></div></div></div>';
}
function bindLogin(go) {
  $('#lGo').onclick = go; $('#lP').onkeydown = function (e) { if (e.key === 'Enter') go(); };
  if ($('#lBack')) $('#lBack').onclick = function () { PAGE = 'home'; ls('thps_page', 'home'); go('home'); };
  setTimeout(function () { ($('#lU').value ? $('#lP') : $('#lU')).focus(); }, 50);
}
/* MAIN LOGIN (Excel sheet LOGIN) */
function showLogin(msg) {
  var needLink = !apiUrl() || msg === 'NOLINK';
  $('#root').innerHTML = loginBox({ big: 'THPS SCHOOL MANAGER', small: 'Main School Database', c: C.home, title: 'MAIN SIGN IN', msg: msg, link: needLink, user: ls('thpsm_last'),
    lead: 'Use your username and password to open the School Manager.',
    rules: [['Administrator', 'every module, setup, Finance and reports'], ['Teachers', 'the teachers\' login: Admin Routines, Other Forms and Assessment (open Assessment with your own password)'],
            ['Senior Teachers', 'your own Assessment username and password: Admin Routines, School Reports (print only) and Assessment']],
    foot: 'The first sign-in needs the internet; after that the app opens without signal. THPS School Manager v' + VERSION });
  bindLogin(function () {
    var u = $('#lU').value.trim(), p = $('#lP').value;
    if ($('#lUrl')) { var url = $('#lUrl').value.trim(); if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)) return showLogin('Paste the database link from the Head Teacher. It starts with https://script.google.com/'); ls('thpsm_api', url); }
    if (!u || !p) return showLogin('Type your username and password, then click Sign in.');
    $('#lGo').disabled = true; $('#lGo').innerHTML = 'Signing in…';
    call('apiMainLogin', u, p).then(function (r) {
      MAIN = { t: r.t, role: r.role, name: r.name, user: u }; ls('thpsm_main', MAIN); ls('thpsm_last', u); ls('thps_mpw_' + u.toLowerCase(), hash(p)); ls('thps_main_' + u.toLowerCase(), MAIN);
      if (r.role === 'Senior') { AUTH = { user: u, pass: p }; ls('thpsm_auth', AUTH); }   // Senior Teachers go straight into Assessment
      ls(ckey('dash'), r.dash); PAGE = 'home'; ls('thps_page', 'home');
      start(r.dash);
    }).catch(function (e) {
      var t = errText(e);
      if (t !== 'No network') return showLogin(t === 'NOLINK' ? 'NOLINK' : t);
      var last = ls('thps_main_' + u.toLowerCase());
      if (last && ls('thps_mpw_' + u.toLowerCase()) === hash(p)) {
        MAIN = last; ls('thpsm_main', MAIN); var saved = ls(ckey('dash'));
        if (saved) { setOnline(false); saved._offline = true; start(saved); return toast('No network – working with the copy on this device.'); }
      }
      showLogin('Cannot reach the school database (' + t + '). Connect to the internet for the first sign-in.');
    });
  });
}
function hash(s) { var h = 5381; s = String(s) + '|thps'; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }
/* ASSESSMENT LOGIN (ASM_LOGIN) and FINANCE LOGIN (FIN_LOGIN) - shown inside the app */
function moduleLogin(kind, msg) {
  var asm = kind === 'asm';
  $$('.nav[data-p]').forEach(function (b) { b.classList.toggle('on', b.dataset.p === PAGE); });
  var o = asm ? { big: 'ASSESSMENT', small: 'Student Assessment, Recording & Reporting System (SARRS)', c: C.asm, title: 'ASSESSMENT SIGN IN', user: AUTH ? AUTH.user : ls('thps_asm_last'),
      lead: 'Use your username and password to open the Assessment.', rules: [['Teachers', 'your own username and password – your class'], ['Senior Teachers', 'your class and the classes you supervise'], ['Administrator', 'every class, setup, ID cards and report cards']],
      foot: 'Marks entered online (THPS Marks Online) come into Excel with Download Online.' }
    : { big: 'FINANCE', small: 'School Financial Management System (SFMS)', c: C.fin, title: 'FINANCE SIGN IN', user: ls('thps_fin_last'),
      lead: 'Use your username and password to open the Finance.', rules: [['Administrator only', 'receipts, payments, cash book, returns and reports'], ['Finance login', 'use the Finance username and password (set on the Excel Finance SETUP)'], ['Printing', 'every report, receipt and invoice prints with the school heading']],
      foot: 'Finance stays signed in until you log out of Finance or sign out.' };
  o.msg = msg; o.back = true;
  var h = loginBox(o).replace('<div class="login">', '<div class="login inapp">');
  $('#page').innerHTML = h;
  bindLogin(function () {
    var u = $('#lU').value.trim(), p = $('#lP').value;
    if (!u || !p) return moduleLogin(kind, 'Type your username and password, then click Sign in.');
    $('#lGo').disabled = true; $('#lGo').innerHTML = 'Signing in…';
    var pr = asm ? call('apiAsmLogin', u, p) : call('apiFinLogin', MA(), u, p);
    pr.then(function (r) {
      if (asm) { AUTH = { user: u, pass: p }; ls('thpsm_auth', AUTH); ls('thps_asm_last', u); ls('thps_apw_' + u.toLowerCase(), hash(p)); AV.d = null; pageAssess(); }
      else { FIN = r.f; ls('thps_fin', FIN); ls('thps_fin_tok_last', FIN); ls('thps_fin_last', u); ls('thps_fpw', hash(u.toLowerCase() + '|' + p)); FV.F = null; pageFinance(); }
    }).catch(function (e) {
      var t = errText(e);
      if (t === 'No network') {   // offline: the same password as last time opens the copy on this device
        if (asm && ls('thps_apw_' + u.toLowerCase()) === hash(p)) { AUTH = { user: u, pass: p }; ls('thpsm_auth', AUTH); return pageAssess(); }
        if (!asm && ls('thps_fpw') === hash(u.toLowerCase() + '|' + p) && ls('thps_fin_tok_last')) { FIN = ls('thps_fin_tok_last'); ls('thps_fin', FIN); return pageFinance(); }
        return moduleLogin(kind, 'No network. Connect to the internet to sign in.');
      }
      if (isAuth(e)) return signOut(t);
      moduleLogin(kind, t);
    });
  });
}
function moduleLogout(kind) {
  if (kind === 'fin') { ls('thps_fin_tok_last', FIN); FIN = null; ls('thps_fin', null); FV.F = null; toast('Logged out of Finance'); }
  else { AUTH = null; ls('thpsm_auth', null); AV.d = null; toast('Logged out of Assessment'); }
  PAGE = 'home'; ls('thps_page', 'home'); render();
}
function signOut(msg) {
  if (OUTBOX.length && !msg && !confirm(OUTBOX.length + ' change(s) are still waiting for the network. They stay on this device. Sign out?')) return;
  if (MAIN) ls('thps_main_' + String(MAIN.user || '').toLowerCase(), MAIN);
  if (FIN) ls('thps_fin_tok_last', FIN);
  ls('thpsm_main', null); ls('thpsm_auth', null); ls('thps_fin', null); MAIN = null; AUTH = null; FIN = null; ME = null; AV.d = null; FV.F = null; showLogin(msg);
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
    '<span class="sp"></span><span class="pill" id="pill"></span><span class="pill">' + esc(MAIN.name || MAIN.user) + ' · ' + roleText() + '</span>' +
    '<img src="img/province.png" alt="" style="height:38px"></div><div class="content" id="page"></div></div></div>';
  $$('.nav[data-p]').forEach(function (b) { b.onclick = function () { go(b.dataset.p); }; });
  $('#bOut').onclick = function () { signOut(); };
  if (!window._modout) { window._modout = 1; document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-modout]'); if (b) moduleLogout(b.dataset.modout); }); }
  $('#bSync').onclick = function () { flush().then(function () { render(); toast(OUTBOX.length ? OUTBOX.length + ' change(s) still waiting' : 'Up to date'); }); };
  $('#burger').onclick = function () { $('#side').classList.toggle('open'); };
  setOnline(!d._offline);
  flush();
  startMessages();
  render(d);
}
function go(p) {
  var m = MODS.filter(function (x) { return x.id === p; })[0];
  if (m && !can(m.need)) return toast('This part of the School Manager is not available for your login (' + roleText() + '). Ask the Administrator if you need it.', 1);
  if (m && m.href) { location.href = m.href; return; }
  PAGE = p; ls('thps_page', p); $('#side').classList.remove('open'); render();
}
function render(dash) {
  $$('.nav[data-p]').forEach(function (b) { b.classList.toggle('on', b.dataset.p === PAGE); });
  var mm = MODS.filter(function (x) { return x.id === PAGE; })[0]; if ($('.top')) $('.top').style.borderBottomColor = mm ? mm.c : C.home;
  var el = $('#page'); el.innerHTML = '<div class="muted">Loading…</div>';
  if (PAGE === 'home') return pageHome(dash);
  if (PAGE === 'students') return pageStudents();
  if (PAGE === 'assess') return pageAssess();
  if (PAGE === 'messages') return pageMessages();
  if (PAGE === 'Finance') return pageFinance();
  if (PAGE === 'Inventory') return pageInventory();
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
  for (var k = 0; k <= 4; k++) { var y = T + (H - T - B) * (1 - k / 4), v = max * k / 4; g += '<line x1="' + L + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#d6dae0"/><text x="' + (L - 4) + '" y="' + (y + 4) + '" text-anchor="end">' + (opt.k ? (v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)) : Math.round(v)) + '</text>'; }
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

/* ------------------------------------------------------------------ STUDENTS (same list the Excel database and the marks app use) */
var SV = { cc: '', q: '', list: null };
function stuAuth() { return PAGE === 'assess' ? AUTH : MA(); }
function pageStudents(pre) {
  load(PAGE === 'assess' ? 'asm_students' : 'students', 'apiStudents', stuAuth()).then(function (d) {
    SV.list = d.students; var cls = d.classes || ME.classes;
    if (!SV.cc || cls.indexOf(SV.cc) < 0) SV.cc = 'ALL';
    var h = head('student', 'Students ' + d.year, 'Students', 'Every change reaches the class teacher at once, and goes into the Excel database with <b>Download Online</b>.' + (d._offline ? ' <span style="color:#b35c00">Offline copy – adding needs the internet.</span>' : ''));
    var act = d.students.filter(function (s) { return !/left|withdraw|expel/i.test(s.status); });
    h += '<div class="kpis"><div class="kpi" style="--c:' + C.stu + '"><small>ACTIVE STUDENTS</small><b>' + act.length + '</b><span>' + act.filter(function (s) { return /^m/i.test(s.sex); }).length + ' boys · ' + act.filter(function (s) { return /^f/i.test(s.sex); }).length + ' girls</span>' + ico('busts_in_silhouette') + '</div>' +
      '<div class="kpi" style="--c:' + C.asm + '"><small>CLASSES</small><b>' + cls.length + '</b><span>' + esc(cls.join(', ')) + '</span>' + ico('school') + '</div>' +
      '<div class="kpi" style="--c:' + C.home + '"><small>ADDED ONLINE</small><b>' + d.students.filter(function (s) { return s.pending; }).length + '</b><span>waiting for Excel</span>' + ico('outbox_tray') + '</div></div>';
    h += '<div class="bar"><select id="sCc"><option value="ALL">All my classes</option>' + cls.map(function (c) { return '<option' + (c === SV.cc ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<input id="sQ" placeholder="Search name or ID" value="' + esc(SV.q) + '"><button class="btn pri" id="sAdd">' + ico('plus') + 'Add student</button><button class="btn" onclick="print()">' + ico('printer') + 'Print list</button></div><div id="sList"></div>';
    $('#page').innerHTML = (pre ? pre.html : '') + h;
    if (pre) pre.bind();
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
    call('apiSaveStudent', stuAuth(), st).then(function (d) { setOnline(true); m.remove(); SV.list = d.students; ls(ckey(PAGE === 'assess' ? 'asm_students' : 'students'), { year: YEAR, students: d.students, classes: cls }); toast('Saved ' + d.id); drawStudents(cls); })
      .catch(function (e) { $('#fS', m).disabled = false; toast(errText(e) === 'No network' ? 'Adding students needs the internet. Try again when the network is back.' : 'Not saved: ' + errText(e), 1); });
  };
}

/* ------------------------------------------------------------------ TABLE PAGES (Finance, Reports, Events, Inventory, Staff, Forms) */
var TV = {};
function pageTable(name) {
  var S = SCHEMA[name], st = TV[name] = TV[name] || { q: '', year: YEAR, f: '' };
  load('t_' + name + '_' + (S.year ? st.year : ''), 'apiTable', MA(), name, S.year ? st.year : '').then(function (d) {
    // show what is still waiting in the outbox
    var rows = d.rows.slice();
    OUTBOX.filter(function (o) { return o.name === name; }).forEach(function (o) {
      rows = rows.filter(function (r) { return r.Key !== o.rec.Key; });
      if (!o.del) { var r = JSON.parse(JSON.stringify(o.rec)); r._wait = true; rows.push(r); }
    });
    st.rows = rows; st.canWrite = d.canWrite;
    var m = MODS.filter(function (x) { return x.id === name; })[0];
    var h = head(S.icon, S.title + (S.year ? '  ' + st.year : '') + (st.cat ? ' – ' + st.cat : ''), m.label, (d._offline ? '<span style="color:#b35c00">Offline copy – new entries are kept on this device and upload when the network returns.</span>' : (d.canWrite ? 'Add, change or delete entries. Everything saves to the school database.' : 'You can read this page.')));
    h += summaryFor(name, rows);
    h += '<div class="bar">' + (S.year ? '<select id="tY">' + opts([YEAR - 2, YEAR - 1, YEAR, YEAR + 1], st.year) + '</select>' : '') +
      '<input id="tQ" placeholder="Search" value="' + esc(st.q) + '">' + (d.canWrite ? '<button class="btn pri" id="tAdd">' + ico('plus') + 'Add</button>' : '') +
      '<button class="btn" onclick="print()">' + ico('printer') + 'Print</button><button class="btn" id="tCsv">' + ico('outbox_tray') + 'Export (CSV)</button></div><div id="tList"></div>';
    $('#page').innerHTML = h;
    if ($('#tY')) $('#tY').onchange = function () { st.year = Number(this.value); pageTable(name); };
    $('#tQ').oninput = function () { st.q = this.value; drawTable(name); };
    if ($('#tAdd')) $('#tAdd').onclick = function () { rowForm(name, null); };
    $('#tCsv').onclick = function () { csv(name); };
    $$('[data-cat]').forEach(function (k) { k.onclick = function () { st.cat = st.cat === k.dataset.cat ? '' : k.dataset.cat; pageTable(name); }; });
    if ($('#catAll')) $('#catAll').onclick = function (e) { e.preventDefault(); st.cat = ''; pageTable(name); };
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
  if (name === 'Inventory') {
    var CATS = [['Building', 'school', '#138D8D'], ['Furniture', 'building_construction', '#7A4E2D'], ['Stationery', 'pencil', '#E46C0A'],
                ['Curriculum books', 'books', '#2F80ED'], ['Equipment', 'gear', '#5B4A9E'], ['Other', 'label', '#3A4250']];
    var st = TV[name] || {};
    return '<div class="kpis">' + CATS.map(function (c) {
      var rs = rows.filter(function (r) { return (r.Category || 'Other') === c[0]; });
      var qty = rs.reduce(function (t, r) { return t + (Number(r.Qty) || 0); }, 0);
      var bad = rs.filter(function (r) { return /repair|low|out/i.test(r.Condition || ''); }).length;
      return '<div class="kpi" data-cat="' + c[0] + '" style="--c:' + c[2] + ';cursor:pointer' + (st.cat === c[0] ? ';outline:2px solid ' + c[2] : '') + '"><small>' + c[0].toUpperCase() + '</small><b>' + rs.length + '</b><span>' +
        qty + ' in stock' + (bad ? ' · <span style="color:#c0392b">' + bad + ' need attention</span>' : ' · all fine') + '</span>' + ico(c[1]) + '</div>';
    }).join('') + '</div><p class="muted noprint" style="margin:-6px 0 12px">Click a card to show only that group' + (st.cat ? ' · showing <b>' + esc(st.cat) + '</b> – <a href="#" id="catAll" style="color:var(--gold)">show all</a>' : '') + '.</p>';
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
  var rows = st.rows.filter(function (r) { return !(name === 'Inventory' && st.cat && (r.Category || 'Other') !== st.cat); }).filter(function (r) { return !q || S.cols.map(function (c) { return r[c[0]]; }).join(' ').toLowerCase().indexOf(q) >= 0; })
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
  if (isNew && name === 'Inventory' && st.cat) r.Category = st.cat;
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
  if (!ro) attachPeople(m);
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

/* ================================================================== v12: modules that work like the Excel sheets */
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function N(v) { var x = Number(v); return isNaN(x) ? 0 : x; }
function amt(v, keep0) { v = Math.round(N(v) * 100) / 100; if (!v && !keep0) return ''; return v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(a, b) { return b ? (Math.round(a / b * 1000) / 10) + '%' : '0%'; }
function td(v, cls) { return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</td>'; }
function tdn(v, keep0) { return '<td class="n' + (N(v) < 0 ? ' neg' : '') + '">' + amt(v, keep0) + '</td>'; }
function kvTable(rows) { return '<table class="kv">' + rows.map(function (r) { return '<tr><td class="muted">' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>'; }
function subnav(views, cur, color, attr) {
  return '<div class="subnav noprint" style="--c:' + color + '">' + views.map(function (v) { return '<button data-' + attr + '="' + v[0] + '"' + (v[0] === cur ? ' class="on"' : '') + '>' + ico(v[2]) + esc(v[1]) + '</button>'; }).join('') + '</div>';
}
function bindNav(attr, fn) { $$('[data-' + attr + ']').forEach(function (b) { b.onclick = function () { fn(b.getAttribute('data-' + attr)); }; }); }
function lay(side, main) { return '<div class="lay"><aside class="noprint">' + side + '</aside><div>' + main + '</div></div>'; }
function shortcuts(list, color) {
  return '<div class="panel" style="--c:' + color + '"><h3>' + ico('link') + 'Shortcuts</h3>' + list.map(function (b) { return '<button class="btn" ' + b[0] + '>' + ico(b[1]) + esc(b[2]) + '</button>'; }).join('') + '</div>';
}
function ownerPanel() {
  return '<div class="panel" style="--c:' + C.home + '"><h3>' + ico('teacher') + 'Owner information</h3><div style="font-size:13px"><b>Mr Saun Aloksep</b><br><span class="muted">Head Teacher – System Owner<br>Tom Hoey Primary School<br>Mougulu, Middle Fly District, W/P<br>☎ 74621880<br>saun.aloksep115@gmail.com</span></div></div>';
}
/* overlay the rows still waiting in the outbox on rows from the server */
function withOutbox(name, rows, prep) {
  rows = rows.slice();
  OUTBOX.filter(function (o) { return o.name === name; }).forEach(function (o) {
    rows = rows.filter(function (r) { return r.Key !== o.rec.Key; });
    if (!o.del) { var r = JSON.parse(JSON.stringify(o.rec)); if (prep) prep(r); r._wait = true; rows.push(r); }
  });
  return rows;
}
function lineCsv(name, head, rows) {
  var out = [head.join(',')].concat(rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }));
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/csv' })); a.download = name + '.csv'; a.click();
}
/* generic modal form. fields: [key, label, type|list, required, extra] */
function formModal(title, icon, fields, r, opt) {
  var m = document.createElement('div'); m.className = 'modal'; var ro = !opt.canWrite;
  m.innerHTML = '<div class="box"><h2>' + ico(icon) + esc(title) + '</h2>' + (opt.note ? '<p class="muted" style="margin:-6px 0 10px">' + opt.note + '</p>' : '') + '<div class="form">' +
    fields.map(function (f) {
      var v = r[f[0]] == null ? '' : r[f[0]], dis = (ro || (f[4] && f[4].lock && r.Key)) ? ' disabled' : '', lab = esc(f[1]) + (f[3] ? ' *' : '');
      var list = typeof f[2] === 'function' ? f[2](r) : f[2];
      if (Array.isArray(list)) return '<label>' + lab + '<select data-f="' + f[0] + '"' + dis + '><option></option>' + opts(list.indexOf(String(v)) < 0 && v !== '' ? list.concat([String(v)]) : list, v) + '</select></label>';
      if (list === 'area') return '<label class="wide">' + lab + '<textarea data-f="' + f[0] + '"' + dis + '>' + esc(v) + '</textarea></label>';
      if (list === 'show') return '<label>' + lab + '<input value="' + esc(v) + '" disabled></label>';
      return '<label>' + lab + '<input data-f="' + f[0] + '" type="' + (list === 'number' ? 'number" step="any' : list) + '" value="' + esc(String(v).slice(0, list === 'date' ? 10 : 999)) + '"' + dis + (f[4] && f[4].ph ? ' placeholder="' + esc(f[4].ph) + '"' : '') + '></label>';
    }).join('') + '</div><div class="acts">' +
    (r.Key && opt.canWrite && opt.onDelete ? '<button class="btn bad" id="mDel">' + ico('wastebasket') + 'Delete</button>' : '') + (opt.extra || '') +
    '<button class="btn" id="mX">Close</button>' + (opt.canWrite ? '<button class="btn ok" id="mS">' + ico('floppy_disk') + 'Save</button>' : '') + '</div></div>';
  document.body.appendChild(m);
  if (opt.canWrite) attachPeople(m);
  var val = function () { var o = {}; $$('[data-f]', m).forEach(function (el) { o[el.dataset.f] = el.value; }); return o; };
  $('#mX', m).onclick = function () { m.remove(); };
  if (opt.onChange) $$('[data-f]', m).forEach(function (el) { el.onchange = function () { opt.onChange(el.dataset.f, val(), m); }; });
  if ($('#mDel', m)) $('#mDel', m).onclick = function () { if (confirm('Delete this entry?')) { m.remove(); opt.onDelete(); } };
  if ($('#mS', m)) $('#mS', m).onclick = function () {
    var o = val(), miss = fields.filter(function (f) { return f[3] && !String(o[f[0]] || '').trim(); }).map(function (f) { return f[1]; });
    if (miss.length) return toast('Please fill: ' + miss.join(', '), 1);
    var err = opt.check ? opt.check(o) : ''; if (err) return toast(err, 1);
    m.remove(); opt.onSave(o);
  };
  if (opt.after) opt.after(m);
  return m;
}
/* save through the outbox, then redraw */
function sendRow(name, rec, del, redraw) {
  queueSave(name, rec);
  redraw(true);
  flush().then(function () {
    var still = OUTBOX.some(function (o) { return o.name === name && o.rec.Key === rec.Key; });
    toast(still ? 'Saved on this device – it uploads when the network returns' : (del ? 'Deleted' : 'Saved'));
    redraw(false);
  });
}
function newKey() { return 'W' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

/* ------------------------------------------------------------------ INFRASTRUCTURE / INVENTORY (INV_HOME, INV_INFRA, INV_STATIONERY, INV_CURRICULUM) */
var INFRA_CAT = ['Classroom', 'Teacher House', 'Office / Admin', 'Library', 'Dormitory', 'Toilet / Ablution', 'Water Tank / Supply', 'Kitchen / Mess', 'Solar / Power', 'Furniture', 'Equipment', 'Land / Fence', 'Other'];
var CONDITION = ['Good', 'Fair', 'Poor', 'Needs Repair', 'Condemned'];
var FUNDING = ['TFF', 'PSF', 'Provincial Grant', 'District (DSIP)', 'LLG', 'Donor / NGO', 'Church Agency', 'Community', 'Other'];
var STN_CAT = ['Exercise Books', 'Pens & Pencils', 'Paper & Cards', 'Chalk & Boards', 'Art & Craft', 'Office Supplies', 'Cleaning', 'Sports', 'Other'];
var UNITS = ['Each', 'Box', 'Packet', 'Ream', 'Carton', 'Set', 'Dozen', 'Bottle', 'Roll'];
var SUBJECTS = ['English', 'Mathematics', 'Science', 'Social Science', 'Making a Living (MAL)', 'Health & PE', 'Arts', 'CCVE', 'Language & Culture', 'All Subjects'];
var GRADES = ['Prep', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];
var RTYPES = ['Syllabus', 'Teacher Guide', 'Student Book', 'Reader', 'Reference Book', 'Chart / Poster', 'Kit / Equipment', 'Other'];
function stnCalc(r) { if (!String(r.Item || '').trim()) return r; r.Balance = N(r.Opening) + N(r.Received) - N(r.Issued); r.Status = r.Balance <= 0 ? 'OUT' : r.Balance <= N(r.ReorderLevel) ? 'LOW' : 'OK'; r.StockValue = r.Balance * N(r.UnitCost); return r; }
function curCalc(r) { r.Available = N(r.Received) - N(r.Issued) - N(r.Damaged); return r; }
var INV = {
  InvInfra: { v: 'infra', label: 'Infrastructure', title: 'INFRASTRUCTURE REGISTER', icon: 'school', code: 'AssetID', cat: 'Category', cats: INFRA_CAT,
    fields: [['AssetID', 'Asset ID', 'text', 0, { lock: 1, ph: 'given automatically (INF-001)' }], ['Category', 'Category', INFRA_CAT, 1], ['Description', 'Description', 'text', 1], ['Location', 'Location', 'text'],
             ['Material', 'Material / Type', 'text'], ['YearBuilt', 'Year built / acquired', 'number'], ['Qty', 'Qty', 'number'], ['Condition', 'Condition', CONDITION],
             ['Value', 'Est. value (K)', 'number'], ['Funding', 'Funding source', FUNDING], ['LastInspected', 'Last inspected', 'date'], ['Remarks', 'Remarks', 'area']],
    cols: [['AssetID', 'Asset ID'], ['Category', 'Category'], ['Description', 'Description'], ['Location', 'Location'], ['Material', 'Material/Type'], ['YearBuilt', 'Year Built/Acquired', 'c'],
           ['Qty', 'Qty', 'n0'], ['Condition', 'Condition'], ['Value', 'Est. Value (K)', 'k'], ['Funding', 'Funding Source'], ['LastInspected', 'Last Inspected', 'd'], ['Remarks', 'Remarks']] },
  InvStationery: { v: 'stat', label: 'Stationery', title: 'SCHOOL BASIC STATIONERIES REGISTER', icon: 'pencil', code: 'ItemCode', cat: 'Category', cats: STN_CAT, calc: stnCalc,
    fields: [['ItemCode', 'Item code', 'text', 0, { lock: 1, ph: 'given automatically (STN-001)' }], ['Item', 'Item', 'text', 1], ['Category', 'Category', STN_CAT, 1], ['Unit', 'Unit', UNITS],
             ['Opening', 'Opening stock', 'number'], ['Received', 'Received', 'number'], ['Issued', 'Issued', 'number'], ['ReorderLevel', 'Reorder level', 'number'],
             ['UnitCost', 'Unit cost (K)', 'number'], ['Supplier', 'Supplier', 'text'], ['Remarks', 'Remarks', 'area']],
    cols: [['ItemCode', 'Item Code'], ['Item', 'Item'], ['Category', 'Category'], ['Unit', 'Unit'], ['Opening', 'Opening Stock', 'n0'], ['Received', 'Received', 'n0'], ['Issued', 'Issued', 'n0'],
           ['Balance', 'Balance', 'n0'], ['ReorderLevel', 'Reorder Level', 'n0'], ['Status', 'Stock Status', 'st'], ['UnitCost', 'Unit Cost (K)', 'k'], ['StockValue', 'Stock Value (K)', 'k'], ['Supplier', 'Supplier']] },
  InvCurriculum: { v: 'curr', label: 'Curriculum', title: 'CURRICULUM MATERIALS REGISTER', icon: 'books', code: 'Code', cat: 'Subject', cats: SUBJECTS, calc: curCalc,
    fields: [['Code', 'Code', 'text', 0, { lock: 1, ph: 'given automatically (CUR-001)' }], ['Title', 'Title', 'text', 1], ['Subject', 'Subject', SUBJECTS, 1], ['Grade', 'Grade', GRADES.concat(['All Grades'])],
             ['ResourceType', 'Resource type', RTYPES], ['Received', 'Qty received', 'number'], ['Issued', 'Qty issued / in use', 'number'], ['Damaged', 'Damaged / lost', 'number'],
             ['Condition', 'Condition', CONDITION], ['Source', 'Source / supplier', 'text'], ['Remarks', 'Remarks', 'area']],
    cols: [['Code', 'Code'], ['Title', 'Title'], ['Subject', 'Subject'], ['Grade', 'Grade'], ['ResourceType', 'Resource Type'], ['Received', 'Qty Received', 'n0'], ['Issued', 'Qty Issued/In Use', 'n0'],
           ['Damaged', 'Damaged/Lost', 'n0'], ['Available', 'Available', 'n0'], ['Condition', 'Condition'], ['Source', 'Source/Supplier'], ['Remarks', 'Remarks']] }
};
var IV = { year: null, view: 'home', q: '', cat: '', d: null };
function invName(v) { return Object.keys(INV).filter(function (k) { return INV[k].v === v; })[0]; }
function pageInventory(keep) {
  if (!IV.year) IV.year = YEAR;
  var draw = function (d) {
    IV.d = d;
    Object.keys(INV).forEach(function (n) { d[n] = withOutbox(n, d[n] || [], null).filter(function (r) { return Number(r.Year) === IV.year; }).map(function (r) { return INV[n].calc ? INV[n].calc(r) : r; }); });
    var views = [['home', 'Summary', 'building_construction']].concat(Object.keys(INV).map(function (n) { return [INV[n].v, INV[n].label, INV[n].icon]; }));
    var h = head('building_construction', 'School Infrastructure / Inventory  ' + IV.year, 'Infrastructure', 'Three registers – Infrastructure, School Basic Stationeries and Curriculum – the same as the Excel sheets. ' +
      (d._offline ? '<span style="color:#b35c00">Offline copy – new entries upload when the network returns.</span>' : d.canWrite ? 'Each record is saved to the school database and goes into Excel with <b>Download Online</b>.' : 'You can read these registers.'));
    h += subnav(views, IV.view, C.inv, 'iv');
    h += IV.view === 'home' ? invHome(d) : invReg(invName(IV.view), d);
    $('#page').innerHTML = h;
    bindNav('iv', function (v) { IV.view = v; IV.q = ''; IV.cat = ''; pageInventory(true); });
    bindNav('ivgo', function (v) { IV.view = v; IV.q = ''; IV.cat = ''; pageInventory(true); });
    if ($('#ivY')) $('#ivY').onchange = function () { IV.year = Number(this.value); pageInventory(); };
    if (IV.view !== 'home') bindReg(invName(IV.view), d);
  };
  if (keep && IV.d && IV.d.year === IV.year) return draw(JSON.parse(JSON.stringify(IV.d0)));
  load('inv_' + IV.year, 'apiInventory', MA(), IV.year).then(function (d) { IV.d0 = JSON.parse(JSON.stringify(d)); draw(d); })
    .catch(function (e) { $('#page').innerHTML = '<div class="note bad">' + esc(errText(e)) + '</div>'; });
}
function yearSel(id, years, cur) { var ys = (years || []).slice(); [YEAR - 1, YEAR, YEAR + 1, cur].forEach(function (y) { if (ys.indexOf(y) < 0) ys.push(y); }); ys.sort(); return '<select id="' + id + '">' + opts(ys, cur) + '</select>'; }
function invHome(d) {
  var I = d.InvInfra, S = d.InvStationery, Cu = d.InvCurriculum;
  var qty = I.reduce(function (t, r) { return t + N(r.Qty); }, 0), bad = I.filter(function (r) { return /^(poor|needs repair|condemned)$/i.test(r.Condition || ''); }).reduce(function (t, r) { return t + N(r.Qty); }, 0);
  var val = I.reduce(function (t, r) { return t + N(r.Value); }, 0), lines = S.filter(function (r) { return String(r.Item || '').trim(); }).length;
  var lowout = S.filter(function (r) { return r.Status === 'LOW' || r.Status === 'OUT'; }).length, avail = Cu.reduce(function (t, r) { return t + N(r.Available); }, 0);
  var k = [['INFRASTRUCTURE ITEMS (QTY)', qty, I.length + ' records', '#138D8D', 'school'], ['NEEDING REPAIR', bad, 'Poor, needs repair or condemned', '#C0392B', 'warning'],
           ['ASSET VALUE', money(val), 'Estimated value', '#2E8B57', 'coin'], ['STATIONERY LINES', lines, S.reduce(function (t, r) { return t + N(r.Balance); }, 0) + ' items in balance', '#E46C0A', 'pencil'],
           ['LOW / OUT OF STOCK', lowout, 'Reorder these lines', '#B8860B', 'triangular_flag'], ['CURRICULUM BOOKS AVAILABLE', avail, Cu.length + ' titles', '#2F80ED', 'books']];
  var main = '<div class="kpis">' + k.map(function (x) { return '<div class="kpi" style="--c:' + x[3] + '"><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b><span>' + esc(x[2]) + '</span>' + ico(x[4]) + '</div>'; }).join('') + '</div>';
  // Infrastructure by category and condition
  var tq = [0, 0, 0, 0, 0, 0];
  main += '<div class="panel" style="--c:#138D8D"><div class="sh">Infrastructure by category and condition</div><div class="wrap" style="max-height:none"><table class="tbl x"><thead><tr><th>Category</th><th style="text-align:right">Qty</th><th style="text-align:right">Good</th><th style="text-align:right">Fair</th><th style="text-align:right">Poor</th><th style="text-align:right">Needs repair</th><th style="text-align:right">Value (K)</th></tr></thead><tbody>' +
    INFRA_CAT.map(function (c) {
      var rs = I.filter(function (r) { return r.Category === c; }), q = function (cond) { return rs.filter(function (r) { return !cond || String(r.Condition).toLowerCase() === cond.toLowerCase(); }).reduce(function (t, r) { return t + N(r.Qty); }, 0); };
      var v = [q(''), q('Good'), q('Fair'), q('Poor'), q('Needs Repair'), rs.reduce(function (t, r) { return t + N(r.Value); }, 0)];
      v.forEach(function (x, i) { tq[i] += x; });
      return '<tr><td>' + esc(c) + '</td>' + v.slice(0, 5).map(function (x) { return '<td class="n">' + (x || '') + '</td>'; }).join('') + tdn(v[5]) + '</tr>';
    }).join('') + '<tr class="tot"><td>Total</td>' + tq.slice(0, 5).map(function (x) { return '<td class="n">' + x + '</td>'; }).join('') + tdn(tq[5], 1) + '</tr></tbody></table></div></div>';
  // stationery by category
  var ts = [0, 0, 0, 0];
  main += '<div class="panel" style="--c:#E46C0A"><div class="sh">School basic stationeries by category</div><table class="tbl x"><thead><tr><th>Category</th><th style="text-align:right">Lines</th><th style="text-align:right">Balance qty</th><th style="text-align:right">Low / out</th><th style="text-align:right">Value (K)</th></tr></thead><tbody>' +
    STN_CAT.map(function (c) {
      var rs = S.filter(function (r) { return r.Category === c && String(r.Item || '').trim(); });
      var v = [rs.length, rs.reduce(function (t, r) { return t + N(r.Balance); }, 0), rs.filter(function (r) { return r.Status === 'LOW' || r.Status === 'OUT'; }).length, rs.reduce(function (t, r) { return t + N(r.StockValue); }, 0)];
      v.forEach(function (x, i) { ts[i] += x; });
      return '<tr><td>' + esc(c) + '</td><td class="n">' + (v[0] || '') + '</td><td class="n">' + (v[1] || '') + '</td><td class="n">' + (v[2] || '') + '</td>' + tdn(v[3]) + '</tr>';
    }).join('') + '<tr class="tot"><td>Total</td><td class="n">' + ts[0] + '</td><td class="n">' + ts[1] + '</td><td class="n">' + ts[2] + '</td>' + tdn(ts[3], 1) + '</tr></tbody></table></div>';
  // curriculum by subject
  var tc = [0, 0, 0, 0, 0];
  main += '<div class="panel" style="--c:#2F80ED"><div class="sh">Curriculum materials by subject</div><table class="tbl x"><thead><tr><th>Subject</th><th style="text-align:right">Titles</th><th style="text-align:right">Received</th><th style="text-align:right">Issued</th><th style="text-align:right">Damaged / lost</th><th style="text-align:right">Available</th></tr></thead><tbody>' +
    SUBJECTS.map(function (c) {
      var rs = Cu.filter(function (r) { return r.Subject === c; }), sm = function (f) { return rs.reduce(function (t, r) { return t + N(r[f]); }, 0); };
      var v = [rs.length, sm('Received'), sm('Issued'), sm('Damaged'), sm('Available')];
      v.forEach(function (x, i) { tc[i] += x; });
      return '<tr><td>' + esc(c) + '</td>' + v.map(function (x) { return '<td class="n">' + (x || '') + '</td>'; }).join('') + '</tr>';
    }).join('') + '<tr class="tot"><td>Total</td>' + tc.map(function (x) { return '<td class="n">' + x + '</td>'; }).join('') + '</tr></tbody></table></div>';
  var byCond = CONDITION.slice(0, 4).map(function (c, i) { return { name: c, color: ['#2E8B57', '#E9B949', '#E46C0A', '#C0392B'][i], data: INFRA_CAT.map(function (cat) { return I.filter(function (r) { return r.Category === cat && String(r.Condition).toLowerCase() === c.toLowerCase(); }).reduce(function (t, r) { return t + N(r.Qty); }, 0); }) }; });
  main += '<div class="panel noprint" style="--c:#138D8D"><h3>' + ico('bar_chart') + 'Infrastructure condition by category</h3>' + bars(INFRA_CAT.map(function (c) { return c.split(/[ /]/)[0].slice(0, 6); }), byCond, { stacked: true }) + '</div>';
  var side = '<div class="panel" style="--c:' + C.inv + '"><h3>' + ico('clipboard') + 'Summary</h3>' + kvTable([['Year shown', yearSel('ivY', d.years, IV.year)], ['Items needing repair', bad], ['Stationery low / out', lowout], ['Curriculum available', avail], ['Asset value', money(val)]]) + '</div>' +
    shortcuts([['data-ivgo="infra"', 'school', 'Infrastructure register'], ['data-ivgo="stat"', 'pencil', 'Stationery register'], ['data-ivgo="curr"', 'books', 'Curriculum register'], ['onclick="print()"', 'printer', 'Print summary']], C.inv) + ownerPanel();
  return lay(side, main);
}
function invCell(r, c) {
  var v = r[c[0]];
  if (c[2] === 'k') return tdn(v);
  if (c[2] === 'n0') return '<td class="n">' + (v === '' || v == null ? '' : N(v)) + '</td>';
  if (c[2] === 'd') return td(fmtDate(v));
  if (c[2] === 'c') return td(esc(v), 'c');
  if (c[2] === 'st') return td(v ? '<span class="st ' + String(v).toLowerCase() + '">' + v + '</span>' : '');
  return td(esc(v));
}
function invReg(name, d) {
  var S = INV[name], rows = d[name];
  var shown = rows.filter(function (r) { return (!IV.cat || r[S.cat] === IV.cat) && (!IV.q || S.cols.map(function (c) { return r[c[0]]; }).join(' ').toLowerCase().indexOf(IV.q.toLowerCase()) >= 0); })
    .sort(function (a, b) { return String(a[S.code] || 'ZZZ' + a.Key).localeCompare(String(b[S.code] || 'ZZZ' + b.Key), undefined, { numeric: true }); });
  var main = '<div class="bar">' + yearSel('ivY', d.years, IV.year) + '<select id="ivC"><option value="">All ' + (S.cat === 'Subject' ? 'subjects' : 'categories') + '</option>' + opts(S.cats, IV.cat) + '</select><input id="ivQ" placeholder="Search" value="' + esc(IV.q) + '">' +
    (d.canWrite ? '<button class="btn pri" id="ivAdd">' + ico('plus') + 'Add record</button>' : '') + '<button class="btn" onclick="print()">' + ico('printer') + 'Print</button><button class="btn" id="ivCsv">' + ico('outbox_tray') + 'Export (CSV)</button></div>';
  main += '<div class="sh" style="--c:' + C.inv + '">' + S.title + '  –  ' + IV.year + (IV.cat ? '  –  ' + esc(IV.cat) : '') + '</div><div class="wrap"><table class="tbl x"><thead><tr><th>No</th>' +
    S.cols.map(function (c) { return '<th' + (/^(k|n0)$/.test(c[2] || '') ? ' style="text-align:right"' : '') + '>' + esc(c[1]) + '</th>'; }).join('') + '<th class="noprint"></th></tr></thead><tbody>' +
    shown.map(function (r, i) { return '<tr><td>' + (i + 1) + '</td>' + S.cols.map(function (c) { return invCell(r, c); }).join('') + '<td class="noprint" style="white-space:nowrap">' + (r._wait ? '<span class="tag new">waiting</span> ' : r.Pending === 'Y' ? '<span class="tag new" title="Waiting for Download Online in Excel">online</span> ' : '') +
      '<button class="btn" data-ik="' + esc(r.Key) + '">' + ico(d.canWrite ? 'pencil' : 'magnifying_glass_tilted_left') + (d.canWrite ? 'Open' : 'View') + '</button></td></tr>'; }).join('') +
    (shown.length ? '' : '<tr><td colspan="' + (S.cols.length + 2) + '" class="muted">No records yet' + (d.canWrite ? ' – click Add record.' : '.') + '</td></tr>') + '</tbody></table></div><p class="muted">' + shown.length + ' records</p>';
  var side, sum = function (f) { return rows.reduce(function (t, r) { return t + N(r[f]); }, 0); };
  if (name === 'InvInfra') side = kvTable([['Records', rows.length], ['Total qty', sum('Qty')], ['Needing repair', rows.filter(function (r) { return /^(poor|needs repair|condemned)$/i.test(r.Condition || ''); }).length + ' records'], ['Asset value', money(sum('Value'))]]);
  else if (name === 'InvStationery') side = kvTable([['Lines', rows.length], ['Balance qty', sum('Balance')], ['LOW', rows.filter(function (r) { return r.Status === 'LOW'; }).length], ['OUT', rows.filter(function (r) { return r.Status === 'OUT'; }).length], ['Stock value', money(sum('StockValue'))]]) +
    '<p class="muted" style="font-size:12px;margin:8px 0 0">Balance = Opening + Received − Issued. Status: OUT when balance is 0, LOW at or below the reorder level.</p>';
  else side = kvTable([['Titles', rows.length], ['Received', sum('Received')], ['Issued / in use', sum('Issued')], ['Damaged / lost', sum('Damaged')], ['Available', sum('Available')]]) +
    '<p class="muted" style="font-size:12px;margin:8px 0 0">Available = Received − Issued − Damaged / lost.</p>';
  side = '<div class="panel" style="--c:' + C.inv + '"><h3>' + ico('clipboard') + 'Summary ' + IV.year + '</h3>' + side + '</div>' +
    '<div class="panel" style="--c:' + C.inv + '"><h3>' + ico('label') + 'By ' + (S.cat === 'Subject' ? 'subject' : 'category') + '</h3>' + kvTable(S.cats.map(function (c) { var n = rows.filter(function (r) { return r[S.cat] === c; }).length; return [n ? '<a href="#" data-icat="' + esc(c) + '" style="color:var(--gold)">' + esc(c) + '</a>' : esc(c), n || '–']; })) + '</div>' +
    shortcuts([['data-ivgo="home"', 'building_construction', 'Inventory summary']].concat(Object.keys(INV).filter(function (n) { return n !== name; }).map(function (n) { return ['data-ivgo="' + INV[n].v + '"', INV[n].icon, INV[n].label + ' register']; })), C.inv);
  return lay(side, main);
}
function bindReg(name, d) {
  var S = INV[name];
  $('#ivC').onchange = function () { IV.cat = this.value; pageInventory(true); };
  $('#ivQ').oninput = function () { IV.q = this.value; var p = this.selectionStart; pageInventory(true); var q = $('#ivQ'); q.focus(); q.setSelectionRange(p, p); };
  $$('[data-icat]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); IV.cat = a.dataset.icat; pageInventory(true); }; });
  $('#ivCsv').onclick = function () { lineCsv('THPS_' + name + '_' + IV.year, ['Year'].concat(S.cols.map(function (c) { return c[1]; })), d[name].map(function (r) { return [r.Year].concat(S.cols.map(function (c) { return r[c[0]]; })); })); };
  var open = function (r) {
    var isNew = !r; r = r ? JSON.parse(JSON.stringify(r)) : { Year: IV.year };
    if (isNew && IV.cat) r[S.cat] = IV.cat;
    var redraw = function (first) { pageInventory(!!first); };
    formModal(isNew ? 'New ' + S.label.toLowerCase() + ' record – ' + IV.year : (r[S.code] || '') + '  ' + (r.Description || r.Item || r.Title || ''), S.icon, S.fields, r, {
      canWrite: d.canWrite,
      note: name === 'InvStationery' ? 'Balance, stock status and stock value are worked out like the Excel sheet.' : name === 'InvCurriculum' ? 'Available is worked out: received − issued − damaged / lost.' : '',
      onDelete: function () { sendRow(name, { Key: r.Key, _del: true }, true, redraw); },
      onSave: function (o) {
        var rec = { Key: r.Key || newKey(), Ms: Date.now(), Year: IV.year };
        Object.keys(o).forEach(function (k) { rec[k] = o[k]; });
        if (r[S.code]) rec[S.code] = r[S.code];
        sendRow(name, rec, false, redraw);
      }
    });
  };
  if ($('#ivAdd')) $('#ivAdd').onclick = function () { open(null); };
  $$('[data-ik]').forEach(function (b) { b.onclick = function () { open(d[name].filter(function (r) { return r.Key === b.dataset.ik; })[0]); }; });
}

/* ------------------------------------------------------------------ FINANCE (SFMS: FIN_HOMEPAGE, CCB entry, returns, registers, setup) */
var FV = { year: null, view: 'home', month: null, q: '', quarter: 1, mf: 0, psf: '' };
var TRANSFERS = ['Withdrawal (Bank to Cash)', 'Deposit (Cash to Bank)', 'Bank Charges'];
/* the same calculation engine as the Excel modCalc */
function finAgg(F) {
  var A = { M: [], In: {}, Out: {}, rows: [], open: { c: F.openCash, b: F.openBank }, bud: F.budget };
  for (var m = 0; m < 12; m++) A.M.push([0, 0, 0, 0, 0, 0]);
  F.rows.forEach(function (o) {
    var mo = N(o.Month); if (mo < 1 || mo > 12) return;
    var g = A.M[mo - 1]; g[0] += N(o.CashRec); g[1] += N(o.CashPay); g[2] += N(o.Withdraw); g[3] += N(o.BankRec); g[4] += N(o.BankPay); g[5] += N(o.Deposit);
    var k = String(o.Area || '').trim().toLowerCase() + '|' + mo;
    if (N(o.CashRec) || N(o.BankRec)) { A.In[k] = A.In[k] || [0, 0]; A.In[k][0] += N(o.CashRec); A.In[k][1] += N(o.BankRec); }
    if (N(o.CashPay) || N(o.BankPay)) { A.Out[k] = A.Out[k] || [0, 0]; A.Out[k][0] += N(o.CashPay); A.Out[k][1] += N(o.BankPay); }
  });
  A.rows = F.rows.slice().sort(function (x, y) { return (N(x.Month) * 100 + N(x.Day)) - (N(y.Month) * 100 + N(y.Day)) || (N(x.ID) || 1e9) - (N(y.ID) || 1e9) || String(x.Key).localeCompare(String(y.Key)); });
  A.msum = function (f, m1, m2) { var s = 0; for (var m = Math.max(1, m1); m <= Math.min(12, m2); m++) s += A.M[m - 1][f]; return s; };
  var pair = function (D, area, m1, m2) { var s = 0; area = String(area || '').trim().toLowerCase(); if (!area) return 0; for (var m = Math.max(1, m1); m <= Math.min(12, m2); m++) { var a = D[area + '|' + m]; if (a) s += a[0] + a[1]; } return s; };
  A.areaIn = function (a, m1, m2) { return pair(A.In, a, m1, m2); };
  A.areaOut = function (a, m1, m2) { return pair(A.Out, a, m1, m2); };
  A.incAct = function (t, m1, m2) { return t === 1 ? (m1 <= 1 && m2 >= 1 ? A.open.c + A.open.b : 0) : A.areaIn(A.bud.rev[t - 1].name, m1, m2); };
  A.itemAct = function (p, i, m1, m2) { var it = A.bud.parts[p - 1].items[i - 1]; return it && it.name ? A.areaOut(it.name, m1, m2) : 0; };
  A.partAct = function (p, m1, m2) { if (p > 6) return 0; var s = 0; for (var i = 1; i <= 5; i++) s += A.itemAct(p, i, m1, m2); return s; };
  A.bankChg = function (m1, m2) { return A.areaOut('Bank Charges', m1, m2); };
  A.totRec = function (m1, m2) { return A.msum(0, m1, m2) + A.msum(3, m1, m2); };
  A.totPay = function (m1, m2) { return A.msum(1, m1, m2) + A.msum(4, m1, m2); };
  A.totIncome = function (m1, m2) { return A.totRec(m1, m2) + A.incAct(1, m1, m2); };
  A.otherInc = function (m1, m2) { var s = A.totRec(m1, m2); for (var t = 2; t <= 6; t++) s -= A.incAct(t, m1, m2); return Math.abs(s) < 0.005 ? 0 : s; };
  A.otherExp = function (m1, m2) { var s = A.totPay(m1, m2) - A.bankChg(m1, m2); for (var p = 1; p <= 6; p++) s -= A.partAct(p, m1, m2); return Math.abs(s) < 0.005 ? 0 : s; };
  A.cashEnd = function (m) { var s = A.open.c; for (var k = 1; k <= Math.min(12, m); k++) { var g = A.M[k - 1]; s += g[0] - g[1] + g[2] - g[5]; } return s; };
  A.bankEnd = function (m) { var s = A.open.b; for (var k = 1; k <= Math.min(12, m); k++) { var g = A.M[k - 1]; s += g[3] - g[4] - g[2] + g[5]; } return s; };
  A.expBudget = function () { var s = 0; for (var p = 0; p < 6; p++) s += A.bud.parts[p].amt; return s; };
  return A;
}
function ccbPrep(r) {   // a row still in the outbox: work out its columns like the server will
  var d = String(r.Date || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (d) { r.Year = Number(d[1]); r.Month = Number(d[2]); r.Day = Number(d[3]); }
  var ft = r.FolioType, a = String(r.Area || '').toLowerCase(), c = N(r.CashAmt), b = N(r.BankAmt);
  ['CashRec', 'CashPay', 'Withdraw', 'BankRec', 'BankPay', 'Deposit'].forEach(function (f) { r[f] = ''; });
  if (ft === 'I#') { r.CashRec = c; r.BankRec = b; } else if (ft === 'E#') { r.CashPay = c; r.BankPay = b; }
  else if (a === TRANSFERS[0].toLowerCase()) r.Withdraw = c + b; else if (a === TRANSFERS[1].toLowerCase()) r.Deposit = c + b; else { r.CashPay = c; r.BankPay = b; }
}
function finLists(F) {
  var inc = F.budget.rev.slice(1).map(function (r) { return r.name; }), exp = [];
  F.budget.parts.slice(0, 6).forEach(function (p) { p.items.forEach(function (i) { if (i.name) exp.push(i.name); }); });
  var used = {}; F.rows.forEach(function (o) { if (o.Area) used[o.Area] = o.FolioType; });
  Object.keys(used).forEach(function (a) { if (inc.indexOf(a) < 0 && exp.indexOf(a) < 0 && TRANSFERS.indexOf(a) < 0) (used[a] === 'I#' ? inc : exp).push(a); });
  return { 'I#': inc, 'E#': exp, 'T#': TRANSFERS };
}
function pageFinance(keep) {
  if (!FIN) return moduleLogin('fin');
  var draw = function (F) {
    FV.F = F;
    F.rows = withOutbox('CCB', F.rows0 || F.rows, ccbPrep).filter(function (r) { return Number(r.Year) === FV.year; });
    var A = finAgg(F);
    if (!FV.month) FV.month = (FV.year === new Date().getFullYear()) ? new Date().getMonth() + 1 : 12;
    var views = [['home', 'Dashboard', 'money_bag'], ['ccb', 'CCB Entry', 'ledger'], ['monthly', 'Monthly Summary', 'calendar'], ['quarter', 'Quarterly Report', 'bar_chart'],
                 ['annual', 'Annual Report', 'page_facing_up'], ['receipts', 'Receipts', 'receipt'], ['invoices', 'Invoices', 'inbox_tray'], ['psf', 'Parent Support Fee', 'busts_in_silhouette'], ['setup', 'Setup & Budget', 'gear']];
    var h = head('money_bag', 'School Finance (SFMS)  ' + FV.year, 'Finance', 'Combined Cash Book based on the School SLIP – the same entries, balances and reports as the Excel Finance. ' +
      (F._offline ? '<span style="color:#b35c00">Offline copy – new entries upload when the network returns.</span>' : 'New entries go into Excel with <b>Download Online</b>.'));
    h += subnav(views, FV.view, C.fin, 'fv');
    var fn = { home: finHome, ccb: finCCB, monthly: finMonthly, quarter: finQuarter, annual: finAnnual, receipts: finReceipts, invoices: finInvoices, psf: finPSF, setup: finSetup }[FV.view] || finHome;
    h += fn(F, A);
    $('#page').innerHTML = h;
    bindNav('fv', function (v) { FV.view = v; FV.q = ''; pageFinance(true); });
    bindNav('fvgo', function (v) { FV.view = v; FV.q = ''; pageFinance(true); });
    if ($('#fY')) $('#fY').onchange = function () { FV.year = Number(this.value); FV.month = null; pageFinance(); };
    if ($('#fM')) $('#fM').onchange = function () { FV.month = Number(this.value); pageFinance(true); };
    if ($('#fMF')) $('#fMF').onchange = function () { FV.mf = Number(this.value); pageFinance(true); };
    if ($('#fQt')) $('#fQt').onchange = function () { FV.quarter = Number(this.value); pageFinance(true); };
    if ($('#fPs')) $('#fPs').onchange = function () { FV.psf = this.value; pageFinance(true); };
    if ($('#fQ')) $('#fQ').oninput = function () { FV.q = this.value; var p = this.selectionStart; pageFinance(true); var q = $('#fQ'); q.focus(); q.setSelectionRange(p, p); };
    if ($('#fAdd')) $('#fAdd').onclick = function () { ccbForm(F, null); };
    $$('[data-ck]').forEach(function (b) { b.onclick = function () { ccbForm(F, F.rows.filter(function (r) { return r.Key === b.dataset.ck; })[0]); }; });
    if ($('#fSave')) $('#fSave').onclick = function () { saveSetup(F); };
    if ($('#fCsv')) $('#fCsv').onclick = function () { ccbCsv(A); };
  };
  if (keep && FV.F && FV.F.year === FV.year) return draw(FV.F);
  load('fin_' + (FV.year || ''), 'apiFinance', FA(), FV.year || '').then(function (F) {
    FV.year = F.year; F.rows0 = F.rows.slice(); draw(F);
  }).catch(function (e) { if (isFinAuth(e)) return moduleLogin('fin', errText(e)); $('#page').innerHTML = '<div class="note bad">' + esc(errText(e)) + '</div>'; });
}
function finSide(F, A, extra) {
  var m = FV.month || 12;
  return '<div class="panel" style="--c:' + C.fin + '"><h3>' + ico('clipboard') + 'Summary</h3>' + kvTable([['Finance year', yearSel('fY', F.years, FV.year)], ['This month in (' + MON3[m - 1] + ')', money(A.totRec(m, m))], ['This month out', money(A.totPay(m, m))],
    ['Cash on hand', money(A.cashEnd(12))], ['Cash at bank', money(A.bankEnd(12))], ['Cash + bank now', money(A.cashEnd(12) + A.bankEnd(12))], ['Waiting for Excel', (F.pending || 0) + OUTBOX.filter(function (o) { return o.name === 'CCB'; }).length]]) + '</div>' +
    (extra || '') +
    shortcuts([['data-fvgo="ccb"', 'ledger', 'CCB entry sheet'], ['data-fvgo="monthly"', 'calendar', 'Monthly summary'], ['data-fvgo="receipts"', 'receipt', 'Receipts register'], ['data-fvgo="setup"', 'gear', 'Setup & budget'], ['onclick="print()"', 'printer', 'Print this page'], ['data-modout="fin"', 'locked', 'Log out of Finance']], C.fin);
}
function finHome(F, A) {
  var k = [['TOTAL REVENUE (INCL. BBF)', money(A.totIncome(1, 12)), 'Receipts + brought forward', '#2E8B57', 'inbox_tray'], ['TOTAL EXPENDITURE', money(A.totPay(1, 12)), 'All payments this year', '#C0392B', 'outbox_tray'],
           ['CASH ON HAND', money(A.cashEnd(12)), 'Closing cash, December', '#E9B949', 'coin'], ['CASH AT BANK', money(A.bankEnd(12)), 'Closing bank, December', '#2F80ED', 'bank']];
  var main = '<div class="kpis">' + k.map(function (x) { return '<div class="kpi" style="--c:' + x[3] + '"><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b><span>' + esc(x[2]) + '</span>' + ico(x[4]) + '</div>'; }).join('') + '</div>';
  var groups = [['SETUP & ENTRIES', [['ccb', 'ledger', 'CCB Entry Sheet', 'Combined cash book – add, change, delete'], ['setup', 'gear', 'Setup & Budget', 'School, bank, opening balances, SLIP budget']]],
                ['RETURNS & REPORTS', [['monthly', 'calendar', 'Monthly Summary', 'Monthly financial return'], ['quarter', 'bar_chart', 'Quarterly Report', 'Termly financial report'], ['annual', 'page_facing_up', 'Annual Report', 'School annual financial report']]],
                ['CASH BOOKS & REGISTERS', [['ccb', 'ledger', 'Annual Cash Book', 'Cash & bank with running balances'], ['receipts', 'receipt', 'Receipts', 'Summary of receipts (RCT)'], ['invoices', 'inbox_tray', 'Invoices', 'Summary of invoices (INV)'], ['psf', 'busts_in_silhouette', 'Parent Support Fee', 'Paid, charged and balance']]]];
  main += groups.map(function (g) { return '<div class="group" style="--c:' + C.fin + '"><h4>' + ico('money_bag') + g[0] + '</h4><div class="tiles">' + g[1].map(function (t) { return '<button class="tile" data-fvgo="' + t[0] + '" style="--c:' + C.fin + '"><span class="sq">' + ico(t[1]) + '</span><span><b>' + esc(t[2]) + '</b><small>' + esc(t[3]) + '</small></span></button>'; }).join('') + '</div></div>'; }).join('');
  var rin = [], rout = [], cb = [], bb = [];
  for (var m = 1; m <= 12; m++) { rin.push(A.totRec(m, m)); rout.push(A.totPay(m, m)); cb.push(A.cashEnd(m)); bb.push(A.bankEnd(m)); }
  main += '<div class="panel" style="--c:#2E8B57"><h3>' + ico('chart_increasing') + 'Receipts vs payments by month</h3>' + bars(MON3.map(function (x) { return x.charAt(0); }), [{ name: 'Receipts', color: '#2E8B57', data: rin }, { name: 'Payments', color: '#E46C0A', data: rout }], { k: true, h: 190 }) + '</div>';
  main += '<div class="panel" style="--c:#2F80ED"><h3>' + ico('bank') + 'Cash and bank balance by month</h3>' + bars(MON3.map(function (x) { return x.charAt(0); }), [{ name: 'Cash', color: '#E9B949', data: cb.map(function (v) { return Math.max(0, v); }) }, { name: 'Bank', color: '#2F80ED', data: bb.map(function (v) { return Math.max(0, v); }) }], { k: true, h: 190 }) + '</div>';
  return lay(finSide(F, A) + ownerPanel(), main);
}
function finCCB(F, A) {
  var cash = A.open.c, bank = A.open.b, q = FV.q.toLowerCase();
  var body = '<tr class="bbf"><td colspan="11">Previous Balance (BBF)  ===></td>' + tdn(cash, 1) + '<td colspan="3"></td>' + tdn(bank, 1) + '<td></td>' + tdn(cash + bank, 1) + '<td class="noprint"></td></tr>', n = 0, tot = [0, 0, 0, 0, 0, 0];
  A.rows.forEach(function (o) {
    cash += N(o.CashRec) - N(o.CashPay) + N(o.Withdraw) - N(o.Deposit); bank += N(o.BankRec) - N(o.BankPay) - N(o.Withdraw) + N(o.Deposit);
    if (FV.mf && N(o.Month) !== FV.mf) return;
    if (q && [o.Payee, o.Details, o.RefNo, o.Area, o.ReceiptNo, o.InvoiceNo, o.FolioType + o.FolioNo].join(' ').toLowerCase().indexOf(q) < 0) return;
    n++; ['CashRec', 'CashPay', 'Withdraw', 'BankRec', 'BankPay', 'Deposit'].forEach(function (f, i) { tot[i] += N(o[f]); });
    body += '<tr>' + td(MONTHS[N(o.Month) - 1] || '') + td(N(o.Day), 'c') + td(esc(o.Payee)) + td(esc(o.Details)) + td(esc(o.FolioType), 'c') + td(o._wait ? '…' : esc(o.FolioNo), 'c') + td(esc(o.RefNo || (o.FolioType === 'I#' ? o.ReceiptNo : o.FolioType === 'E#' ? o.InvoiceNo : '') || '')) + td(esc(o.Area)) +
      tdn(o.CashRec) + tdn(o.CashPay) + tdn(o.Withdraw) + tdn(cash, 1) + tdn(o.BankRec) + tdn(o.BankPay) + tdn(o.Deposit) + tdn(bank, 1) + td(esc(o.Recon), 'c') + tdn(cash + bank, 1) +
      '<td class="noprint" style="white-space:nowrap">' + (o._wait ? '<span class="tag new">waiting</span> ' : o.Pending === 'Y' ? '<span class="tag new" title="Waiting for Download Online in Excel">online</span> ' : '') + '<button class="btn" data-ck="' + esc(o.Key) + '">' + ico('pencil') + 'Open</button></td></tr>';
  });
  body += '<tr class="tot"><td colspan="8">Totals' + (FV.mf ? ' – ' + MONTHS[FV.mf - 1] : '') + '</td>' + tdn(tot[0], 1) + tdn(tot[1], 1) + tdn(tot[2], 1) + '<td></td>' + tdn(tot[3], 1) + tdn(tot[4], 1) + tdn(tot[5], 1) + '<td colspan="4"></td></tr>';
  var main = '<div class="kpis"><div class="kpi" style="--c:#E9B949"><small>CASH ON HAND</small><b>' + money(A.cashEnd(12)) + '</b><span>after every entry of ' + FV.year + '</span>' + ico('coin') + '</div>' +
    '<div class="kpi" style="--c:#2F80ED"><small>CASH IN BANK</small><b>' + money(A.bankEnd(12)) + '</b><span>after every entry of ' + FV.year + '</span>' + ico('bank') + '</div>' +
    '<div class="kpi" style="--c:#2E8B57"><small>TOTAL</small><b>' + money(A.cashEnd(12) + A.bankEnd(12)) + '</b><span>cash on hand + cash in bank</span>' + ico('money_bag') + '</div></div>';
  main += '<div class="bar">' + yearSel('fY', F.years, FV.year) + '<select id="fMF"><option value="0">All months</option>' + MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (FV.mf === i + 1 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
    '<input id="fQ" placeholder="Search payee, details, ref, area" value="' + esc(FV.q) + '"><button class="btn pri" id="fAdd">' + ico('plus') + 'New entry</button><button class="btn" onclick="print()">' + ico('printer') + 'Print cash book</button><button class="btn" id="fCsv">' + ico('outbox_tray') + 'Export (CSV)</button></div>';
  main += '<div class="sh" style="--c:' + C.fin + '">CCB ENTRY SHEET – COMBINE CASH BOOK – ' + FV.year + '</div><div class="wrap" style="max-height:70vh"><table class="tbl x"><thead><tr><th colspan="8" class="grp" style="--c:#3A4250">Cash Journal</th><th colspan="4" class="grp" style="--c:#B8860B">Cash on hand Transaction</th><th colspan="4" class="grp" style="--c:#2F80ED">Cash in Bank Transaction</th><th></th><th class="grp" style="--c:#2E8B57">Total</th><th class="noprint"></th></tr><tr>' +
    ['Month', 'Date', 'Service Provider or Payee', 'Details or Description', 'Folio', 'No.', 'Reference Number', 'Area of Expenditure, Type of Income, Transfers & Bank Charge', 'Receipts', 'Payments', 'Withdraw (Bank to Cash)', 'Cash Balance', 'Receipts', 'Payments', 'Deposit (Cash to Bank)', 'Bank Balance', 'Bank Recon. (Y/N)', 'Running Balance']
      .map(function (x, i) { return '<th' + (i >= 8 && i !== 16 ? ' style="text-align:right"' : '') + '>' + x + '</th>'; }).join('') + '<th class="noprint"></th></tr></thead><tbody>' + body + '</tbody></table></div><p class="muted">' + n + ' entries shown · Folio I# = income, E# = expenditure, T# = transfer / bank charge.</p>';
  return main;
}
function ccbCsv(A) {
  var cash = A.open.c, bank = A.open.b;
  lineCsv('THPS_CCB_' + FV.year, ['Month', 'Date', 'Payee', 'Details', 'Folio', 'No', 'RefNo', 'Area', 'CashReceipts', 'CashPayments', 'Withdraw', 'CashBalance', 'BankReceipts', 'BankPayments', 'Deposit', 'BankBalance', 'Recon', 'ReceiptNo', 'InvoiceNo'],
    A.rows.map(function (o) { cash += N(o.CashRec) - N(o.CashPay) + N(o.Withdraw) - N(o.Deposit); bank += N(o.BankRec) - N(o.BankPay) - N(o.Withdraw) + N(o.Deposit);
      return [MONTHS[N(o.Month) - 1], o.Day, o.Payee, o.Details, o.FolioType, o.FolioNo, o.RefNo, o.Area, o.CashRec, o.CashPay, o.Withdraw, cash.toFixed(2), o.BankRec, o.BankPay, o.Deposit, bank.toFixed(2), o.Recon, o.ReceiptNo, o.InvoiceNo]; }));
}
function ccbForm(F, r) {
  var L = finLists(F), isNew = !r;
  r = r ? JSON.parse(JSON.stringify(r)) : { FolioType: 'I#', Date: (String(FV.year) === today().slice(0, 4) ? today() : FV.year + '-' + String(FV.mf || 1).padStart(2, '0') + '-01'), Recon: 'N' };
  if (!isNew) { r.CashAmt = N(r.CashRec) + N(r.CashPay); r.BankAmt = N(r.BankRec) + N(r.BankPay); if (N(r.Withdraw) || N(r.Deposit)) r.BankAmt = N(r.Withdraw) + N(r.Deposit); if (!r.Date && r.Month) r.Date = FV.year + '-' + String(r.Month).padStart(2, '0') + '-' + String(r.Day || 1).padStart(2, '0'); }
  var fields = [['Date', 'Date', 'date', 1], ['FolioType', 'Entry type (Folio)', ['I#', 'E#', 'T#'], 1], ['Payee', 'Service provider or payee', 'text', 1], ['Details', 'Details or description', 'text'],
                ['Area', 'Area of expenditure / type of income', function (x) { return L[x.FolioType] || L['E#']; }, 1], ['RefNo', 'Reference number', 'text'], ['Recon', 'Bank recon. (Y/N)', ['Y', 'N']],
                ['CashAmt', 'Cash amount (K)', 'number'], ['BankAmt', 'Bank amount (K)', 'number']];
  if (!isNew) fields.splice(2, 0, ['FolioShow', 'Folio no. / receipt / invoice', 'show']);
  r.FolioShow = r.FolioType + (r.FolioNo || '') + (r.ReceiptNo ? '  ·  ' + r.ReceiptNo : '') + (r.InvoiceNo ? '  ·  ' + r.InvoiceNo : '');
  var redraw = function (first) { pageFinance(!!first); };
  formModal(isNew ? 'CCB entry form – new entry ' + FV.year : 'CCB entry ' + (r.FolioType || '') + (r.FolioNo || ''), 'ledger', fields, r, {
    canWrite: true,
    note: 'I# income: the amount goes to Receipts. E# expenditure: to Payments. T# Withdrawal moves bank to cash; Deposit moves cash to bank; Bank Charges are a bank payment. Folio, receipt and invoice numbers are given when saved.',
    onChange: function (f, o, m) {
      if (f !== 'FolioType') return;
      var sel = $('[data-f="Area"]', m); sel.innerHTML = '<option></option>' + opts(L[o.FolioType] || [], '');
    },
    check: function (o) {
      if (String(o.Date).slice(0, 4) !== String(FV.year)) return 'The date must be in ' + FV.year + ' (change the finance year to enter another year).';
      if (!N(o.CashAmt) && !N(o.BankAmt)) return 'Type a Cash and/or Bank amount.';
      if (N(o.CashAmt) < 0 || N(o.BankAmt) < 0) return 'Amounts must be positive.';
      return '';
    },
    onDelete: function () { sendRow('CCB', { Key: r.Key, _del: true }, true, redraw); },
    onSave: function (o) {
      var rec = { Key: r.Key || newKey(), Ms: Date.now() };
      ['Date', 'FolioType', 'Payee', 'Details', 'Area', 'RefNo', 'Recon', 'CashAmt', 'BankAmt'].forEach(function (k) { rec[k] = o[k]; });
      if (r.FolioType === o.FolioType) { rec.FolioNo = r.FolioNo; rec.ReceiptNo = r.ReceiptNo; rec.InvoiceNo = r.InvoiceNo; }
      if (r.ID) rec.ID = r.ID;
      sendRow('CCB', rec, false, redraw);
    }
  });
}
function finSchool(F, title, period, extra) {
  var I = F.info;
  return '<div class="panel" style="--c:' + C.fin + ';text-align:center"><b>DEPARTMENT OF EDUCATION</b><br><span class="muted">Supervision and Management Reform</span><br><b>' + esc(I.SCHOOL_NAME) + '</b><br><b>' + title + '</b></div>' +
    '<div class="sh" style="--c:' + C.fin + '">SECTION 1: SCHOOL DETAILS</div><table class="tbl x"><tr><td class="muted">Province</td><td>' + esc(I.PROVINCE) + '</td><td class="muted">' + period[0] + '</td><td>' + esc(period[1]) + '</td></tr>' +
    '<tr><td class="muted">School name</td><td>' + esc(I.SCHOOL_NAME) + '</td><td class="muted">Report no.</td><td>' + esc(period[2]) + '</td></tr><tr><td class="muted">School code</td><td>' + esc(I.SCHOOL_CODE || '') + '</td><td class="muted">Sector / District</td><td>' + esc(I.SECTOR + ' · ' + I.DISTRICT) + '</td></tr>' + (extra || '') + '</table>';
}
function revTable(A, m1, m2, label) {
  var rows = '', T = [0, 0, 0, 0];
  for (var t = 1; t <= 6; t++) {
    var pr = A.incAct(t, 1, m1 - 1), th = A.incAct(t, m1, m2), bud = A.bud.rev[t - 1].amt;
    T[0] += pr; T[1] += th; T[2] += pr + th; T[3] += bud;
    rows += '<tr>' + td(t) + td(esc(A.bud.rev[t - 1].name)) + tdn(pr, 1) + tdn(th, 1) + tdn(pr + th, 1) + tdn(bud, 1) + td(pct(pr + th, bud), 'n') + '</tr>';
  }
  var op = A.otherInc(1, m1 - 1), ot = A.otherInc(m1, m2); T[0] += op; T[1] += ot; T[2] += op + ot;
  rows += '<tr>' + td(7) + td('Other income (area not in budget)') + tdn(op, 1) + tdn(ot, 1) + tdn(op + ot, 1) + '<td></td><td></td></tr>';
  rows += '<tr class="tot"><td></td><td>Total</td>' + tdn(T[0], 1) + tdn(T[1], 1) + tdn(T[2], 1) + tdn(T[3], 1) + td(pct(T[2], T[3]), 'n') + '</tr>';
  return '<div class="sh" style="--c:' + C.fin + '">SECTION 2: REVENUE</div><table class="tbl x"><thead><tr><th>Item #</th><th>Type of Income</th><th style="text-align:right">Progressive</th><th style="text-align:right">' + label + '</th><th style="text-align:right">Total Receipts</th><th style="text-align:right">Annual Revenue</th><th style="text-align:right">Total Receipt (%)</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<table class="tbl x" style="margin:6px 0 14px"><tr class="bbf"><td>' + MON3[m2 - 1] + ':</td><td>Bank Balance  =></td>' + tdn(A.bankEnd(m2), 1) + '<td>Cash Balance  =></td>' + tdn(A.cashEnd(m2), 1) + '<td>Total  =></td>' + tdn(A.bankEnd(m2) + A.cashEnd(m2), 1) + '</tr></table>';
}
function expTable(A, m1, m2, label, items) {
  var rows = '', T = [0, 0, 0, 0];
  for (var p = 1; p <= 6; p++) {
    var P = A.bud.parts[p - 1], pr = A.partAct(p, 1, m1 - 1), th = A.partAct(p, m1, m2);
    T[0] += pr; T[1] += th; T[2] += pr + th; T[3] += P.amt;
    rows += '<tr' + (items ? ' style="font-weight:700"' : '') + '>' + td(p) + td(esc(P.name)) + tdn(pr, 1) + tdn(th, 1) + tdn(pr + th, 1) + tdn(P.amt, 1) + td(pct(pr + th, P.amt), 'n') + '</tr>';
    if (items) P.items.forEach(function (it, i) { if (!it.name) return; var a = A.itemAct(p, i + 1, 1, m1 - 1), b = A.itemAct(p, i + 1, m1, m2); rows += '<tr class="muted">' + td('') + td('&nbsp;&nbsp;' + esc(it.name)) + tdn(a) + tdn(b) + tdn(a + b) + tdn(it.amt) + td(pct(a + b, it.amt), 'n') + '</tr>'; });
  }
  rows += '<tr class="tot"><td></td><td>Total</td>' + tdn(T[0], 1) + tdn(T[1], 1) + tdn(T[2], 1) + tdn(T[3], 1) + td(pct(T[2], T[3]), 'n') + '</tr>';
  var bc = A.bankChg(1, m2), oe = A.otherExp(1, m2);
  return '<div class="sh" style="--c:' + C.fin + '">SECTION 3: EXPENDITURE</div><table class="tbl x"><thead><tr><th>Item #</th><th>Budget Item</th><th style="text-align:right">Progressive</th><th style="text-align:right">' + label + '</th><th style="text-align:right">Total Expense</th><th style="text-align:right">Annual Budget</th><th style="text-align:right">Total Spent (%)</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    ((bc || oe) ? '<p class="muted" style="font-size:12px">Not in the budget items (to date): bank charges ' + money(bc) + ' · other / unallocated payments ' + money(oe) + '.</p>' : '');
}
function signBlock() { return '<p class="muted" style="font-size:12px;margin-top:14px">NB: Budget items must conform to the approved School Learning Improvement Plan (SLIP).</p><div class="sig"><div>Head Teacher</div><div>BOM Chairman</div><div>BOM Treasurer</div></div>'; }
function finMonthly(F, A) {
  var m = FV.month;
  var main = '<div class="bar">' + yearSel('fY', F.years, FV.year) + '<select id="fM">' + MONTHS.map(function (x, i) { return '<option value="' + (i + 1) + '"' + (m === i + 1 ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select><button class="btn" onclick="print()">' + ico('printer') + 'Print return</button></div>';
  main += finSchool(F, 'MONTHLY FINANCIAL RETURN – BUDGET vs ACTUAL', ['Month', MONTHS[m - 1] + ' ' + FV.year, m]) + revTable(A, m, m, 'This Month') + expTable(A, m, m, 'This Month', false) + signBlock();
  return lay(finSide(F, A), main);
}
function finQuarter(F, A) {
  var q = FV.quarter, m1 = q * 3 - 2, m2 = q * 3, nm = ['First', 'Second', 'Third', 'Fourth'][q - 1];
  var main = '<div class="bar">' + yearSel('fY', F.years, FV.year) + '<select id="fQt">' + [1, 2, 3, 4].map(function (i) { return '<option value="' + i + '"' + (q === i ? ' selected' : '') + '>' + ['First', 'Second', 'Third', 'Fourth'][i - 1] + ' (' + MON3[i * 3 - 3] + ' – ' + MON3[i * 3 - 1] + ')</option>'; }).join('') + '</select><button class="btn" onclick="print()">' + ico('printer') + 'Print report</button></div>';
  main += finSchool(F, 'QUARTERLY [TERMLY] FINANCIAL REPORT', ['Quarter / term', nm + ' (' + MON3[m1 - 1] + ' - ' + MON3[m2 - 1] + ')', q]) + revTable(A, m1, m2, nm + ' Quarter') + expTable(A, m1, m2, nm + ' Quarter', true);
  var ob = A.bankEnd(m1 - 1), oc = A.cashEnd(m1 - 1), inc = A.totRec(m1, m2), exp = A.totPay(m1, m2);
  main += '<div class="sh" style="--c:' + C.fin + '">SECTION 4: SUMMARY OF CASH POSITION</div><table class="tbl x">' +
    [['CCB cash at bank – beginning of quarter', ob], ['Add: CCB cash at school (cash on hand) – beginning', oc], ['Add: summary of income for the quarter', inc], ['Less: summary of expenditure for the quarter', -exp],
     ['Closing balance (bank ' + money(A.bankEnd(m2)) + ' + cash ' + money(A.cashEnd(m2)) + ')', ob + oc + inc - exp]].map(function (r, i) { return '<tr' + (i === 4 ? ' class="tot"' : '') + '>' + td(r[0]) + tdn(r[1], 1) + '</tr>'; }).join('') + '</table>' + signBlock();
  return lay(finSide(F, A), main);
}
function finAnnual(F, A) {
  var Q = [[1, 3], [4, 6], [7, 9], [10, 12]], ri = '', T = [0, 0, 0, 0, 0, 0];
  for (var t = 1; t <= 6; t++) {
    var v = Q.map(function (q) { return A.incAct(t, q[0], q[1]); }), b = A.bud.rev[t - 1].amt, s = v.reduce(function (x, y) { return x + y; }, 0);
    T[0] += b; v.forEach(function (x, i) { T[i + 1] += x; }); T[5] += s;
    ri += '<tr>' + td(t) + td(esc(A.bud.rev[t - 1].name)) + tdn(b, 1) + v.map(function (x) { return tdn(x, 1); }).join('') + tdn(s, 1) + '</tr>';
  }
  var ov = Q.map(function (q) { return A.otherInc(q[0], q[1]); }), os = ov.reduce(function (x, y) { return x + y; }, 0); ov.forEach(function (x, i) { T[i + 1] += x; }); T[5] += os;
  ri += '<tr>' + td(7) + td('Other income (area not in budget)') + '<td></td>' + ov.map(function (x) { return tdn(x, 1); }).join('') + tdn(os, 1) + '</tr><tr class="tot"><td></td><td>Total Income</td>' + T.map(function (x) { return tdn(x, 1); }).join('') + '</tr>';
  var re = '', E = [0, 0, 0, 0, 0, 0];
  for (var p = 1; p <= 8; p++) {
    var nm, bud, vv;
    if (p <= 6) { nm = A.bud.parts[p - 1].name; bud = A.bud.parts[p - 1].amt; vv = Q.map(function (q) { return A.partAct(p, q[0], q[1]); }); }
    else if (p === 7) { nm = 'BANK CHARGES'; bud = 0; vv = Q.map(function (q) { return A.bankChg(q[0], q[1]); }); }
    else { nm = 'OTHER / UNALLOCATED'; bud = 0; vv = Q.map(function (q) { return A.otherExp(q[0], q[1]); }); }
    var ss = vv.reduce(function (x, y) { return x + y; }, 0); E[0] += bud; vv.forEach(function (x, i) { E[i + 1] += x; }); E[5] += ss;
    re += '<tr>' + td(p) + td(esc(nm)) + tdn(bud, 1) + vv.map(function (x) { return tdn(x, 1); }).join('') + tdn(ss, 1) + '</tr>';
  }
  re += '<tr class="tot"><td></td><td>Total Expenditure</td>' + E.map(function (x) { return tdn(x, 1); }).join('') + '</tr>';
  var hd = function (a) { return '<thead><tr><th>#</th><th>' + a + '</th><th style="text-align:right">Yearly Budget</th><th style="text-align:right">1st Quarter</th><th style="text-align:right">2nd Quarter</th><th style="text-align:right">3rd Quarter</th><th style="text-align:right">4th Quarter</th><th style="text-align:right">Total</th></tr></thead>'; };
  var main = '<div class="bar">' + yearSel('fY', F.years, FV.year) + '<button class="btn" onclick="print()">' + ico('printer') + 'Print annual report</button></div>' + finSchool(F, 'SCHOOL ANNUAL FINANCIAL REPORT', ['Year', FV.year, FV.year]) +
    '<div class="sh" style="--c:' + C.fin + '">2: BUDGET – PART A: INCOME</div><table class="tbl x">' + hd('Type of Income') + '<tbody>' + ri + '</tbody></table>' +
    '<div class="sh" style="--c:' + C.fin + ';margin-top:12px">PART B: EXPENDITURE</div><table class="tbl x">' + hd('Focus Area of Expenses') + '<tbody>' + re + '</tbody></table>' +
    '<div class="cols" style="margin-top:12px"><div><div class="sh" style="--c:' + C.fin + '">PART C: INCOME SUMMARY</div><table class="tbl x">' + [['Amount budgeted', T[0]], ['Amount received (incl. BBF)', T[5]], ['Amount yet to be received', T[0] - T[5]]].map(function (r) { return '<tr>' + td(r[0]) + tdn(r[1], 1) + '</tr>'; }).join('') + '</table></div>' +
    '<div><div class="sh" style="--c:' + C.fin + '">PART D: EXPENDITURE SUMMARY</div><table class="tbl x">' + [['Amount budgeted', E[0]], ['Amount spent', E[5]], ['Balance of budget', E[0] - E[5]], ['Closing cash + bank (31 Dec)', A.cashEnd(12) + A.bankEnd(12)]].map(function (r) { return '<tr>' + td(r[0]) + tdn(r[1], 1) + '</tr>'; }).join('') + '</table></div></div>' + signBlock();
  return lay(finSide(F, A), main);
}
function finList(F, A, kind) {
  var q = FV.q.toLowerCase(), rows = A.rows.filter(function (o) {
    if (FV.mf && N(o.Month) !== FV.mf) return false;
    if (kind === 'receipts' && !(o.ReceiptNo && (N(o.CashRec) + N(o.BankRec)) > 0)) return false;
    if (kind === 'invoices' && !o.InvoiceNo) return false;
    return !q || [o.Payee, o.Details, o.Area, o.ReceiptNo, o.InvoiceNo].join(' ').toLowerCase().indexOf(q) >= 0;
  });
  var tot = 0, body = rows.map(function (o) {
    var dt = FV.year + '-' + String(o.Month).padStart(2, '0') + '-' + String(o.Day).padStart(2, '0');
    if (kind === 'receipts') { var v = N(o.CashRec) + N(o.BankRec); tot += v; return '<tr>' + td(FV.year) + td(esc(o.ReceiptNo)) + td(MONTHS[N(o.Month) - 1]) + td(fmtDate(dt)) + td(esc(o.Payee)) + td(esc(o.Area + (o.Details ? ' – ' + o.Details : ''))) + tdn(v, 1) + '</tr>'; }
    var c = N(o.CashPay), b = N(o.BankPay); tot += c + b;
    return '<tr>' + td(FV.year) + td(esc(o.InvoiceNo)) + td(MONTHS[N(o.Month) - 1]) + td(fmtDate(dt)) + td(esc(o.Payee)) + td(esc(o.Area + (o.Details ? ' – ' + o.Details : ''))) + tdn(c) + tdn(b) + tdn(c + b, 1) + '</tr>';
  }).join('');
  var hd = kind === 'receipts' ? ['Year', 'Receipt No', 'Month', 'Date', 'Received From', 'Particulars', 'Amount (K)'] : ['Year', 'Invoice No', 'Month', 'Date', 'Customer / Payee', 'Description', 'Cash Payment (K)', 'Bank Payment (K)', 'Total (K)'];
  var main = '<div class="bar">' + yearSel('fY', F.years, FV.year) + '<select id="fMF"><option value="0">All months</option>' + MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (FV.mf === i + 1 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select><input id="fQ" placeholder="Search" value="' + esc(FV.q) + '"><button class="btn" onclick="print()">' + ico('printer') + 'Print</button></div>' +
    '<div class="sh" style="--c:' + C.fin + '">SUMMARY OF ' + (kind === 'receipts' ? 'RECEIPTS' : 'INVOICES') + ' – ' + FV.year + '  ·  TOTAL ' + (kind === 'receipts' ? 'RECEIPTS' : 'INVOICES') + ': ' + money(tot) + '</div><div class="wrap"><table class="tbl x"><thead><tr>' + hd.map(function (x, i) { return '<th' + (i >= 6 ? ' style="text-align:right"' : '') + '>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' + (body || '<tr><td colspan="9" class="muted">Nothing for this period.</td></tr>') + '</tbody></table></div><p class="muted">' + rows.length + ' ' + kind + '</p>';
  return lay(finSide(F, A), main);
}
function finReceipts(F, A) { return finList(F, A, 'receipts'); }
function finInvoices(F, A) { return finList(F, A, 'invoices'); }
function finPSF(F, A) {
  var fee = N(F.info.FEE_RATE), q = FV.q.toLowerCase(), paid = 0, n = 0;
  var rows = A.rows.filter(function (o) { return /parent support fee/i.test(o.Area || '') && (N(o.CashRec) + N(o.BankRec)) > 0; });
  var body = rows.map(function (o) {
    var v = N(o.CashRec) + N(o.BankRec), st = fee && v >= fee ? 'Completed' : 'Incomplete';
    if (FV.mf && N(o.Month) !== FV.mf) return ''; if (FV.psf && st !== FV.psf) return ''; if (q && (o.Payee + ' ' + o.ReceiptNo).toLowerCase().indexOf(q) < 0) return '';
    paid += v; n++;
    return '<tr>' + td(FV.year) + td(esc(o.ReceiptNo || o.RefNo || '')) + td(MONTHS[N(o.Month) - 1]) + td(fmtDate(FV.year + '-' + String(o.Month).padStart(2, '0') + '-' + String(o.Day).padStart(2, '0'))) + td(esc(o.Payee)) + tdn(v, 1) + tdn(fee, 1) + tdn(Math.max(0, fee - v), 1) + td('<span class="st ' + (st === 'Completed' ? 'ok' : 'low') + '">' + st + '</span>') + '</tr>';
  }).join('');
  var main = '<div class="bar">' + yearSel('fY', F.years, FV.year) + '<select id="fMF"><option value="0">All months</option>' + MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (FV.mf === i + 1 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
    '<select id="fPs"><option value="">All status</option>' + opts(['Completed', 'Incomplete'], FV.psf) + '</select><input id="fQ" placeholder="Search student" value="' + esc(FV.q) + '"><button class="btn" onclick="print()">' + ico('printer') + 'Print</button></div>' +
    '<div class="sh" style="--c:' + C.fin + '">PARENT SUPPORT FEE – ' + FV.year + '  ·  GRAND TOTAL PAID: ' + money(paid) + '</div>' + (fee ? '' : '<div class="note">Set the Project Fee Rate (K per student) on Setup & Budget to see balances.</div>') +
    '<div class="wrap"><table class="tbl x"><thead><tr><th>Year</th><th>Ref / Receipt</th><th>Month</th><th>Date</th><th>Student Name</th><th style="text-align:right">Amount Paid (K)</th><th style="text-align:right">Fee Charged (K)</th><th style="text-align:right">Balance (K)</th><th>Status</th></tr></thead><tbody>' + (body || '<tr><td colspan="9" class="muted">No payments for this choice.</td></tr>') + '</tbody></table></div><p class="muted">' + n + ' payments · enter PSF in the CCB as I# with area Parent Support Fee (PSF) and the student name as payee.</p>';
  return lay(finSide(F, A, '<div class="panel" style="--c:' + C.fin + '"><h3>' + ico('busts_in_silhouette') + 'PSF this year</h3>' + kvTable([['Fee rate', money(fee)], ['Students (setup)', F.info.STUDENTS], ['Expected', money(N(F.info.STUDENTS) * fee)], ['Paid', money(A.areaIn('Parent Support Fee (PSF)', 1, 12))]]) + '</div>'), main);
}
function finSetup(F, A) {
  var I = F.info, inp = function (k, v, t) { return '<input data-s="' + k + '" value="' + esc(v) + '"' + (t ? ' type="' + t + '" step="any"' : '') + ' style="width:100%">'; };
  var main = '<div class="bar">' + yearSel('fY', F.years, FV.year) + '<button class="btn ok" id="fSave">' + ico('floppy_disk') + 'Save setup</button><button class="btn" onclick="print()">' + ico('printer') + 'Print</button></div>' +
    '<div class="note">These are the Excel <b>FIN_SETUP</b> values for ' + FV.year + '. If you also use Excel Finance, change them there – <b>Upload Online</b> from Excel replaces what is typed here.</div>';
  main += '<div class="sh" style="--c:' + C.fin + '">School details & bank details (Format 01)</div><div class="form" style="margin-bottom:12px">' +
    [['SCHOOL_NAME', 'School name'], ['SCHOOL_CODE', 'School code'], ['PROVINCE', 'Province'], ['DISTRICT', 'District'], ['SECTOR', 'Sector'], ['ACC_NAME', 'Account name'], ['ACC_NO', 'Account number'], ['BANK', 'Bank'], ['BRANCH', 'Branch'], ['BOM_CHAIR', 'BOM chairman'], ['BOM_TREAS', 'BOM treasurer'], ['BOM_HEAD', 'Head teacher']]
      .map(function (k) { return '<label>' + k[1] + inp(k[0], I[k[0]]) + '</label>'; }).join('') + '</div>';
  main += '<div class="sh" style="--c:' + C.fin + '">Enrolment, project fee rate & opening balances</div><div class="form" style="margin-bottom:12px">' +
    '<label>Total number of students' + inp('STUDENTS', I.STUDENTS, 'number') + '</label><label>Project fee rate (K per student)' + inp('FEE_RATE', I.FEE_RATE, 'number') + '</label>' +
    '<label>Opening cash on hand (BBF) – blank = last year\'s closing' + inp('OPEN_CASH', I.OPEN_CASH_SET, 'number') + '</label><label>Opening cash at bank (BBF) – blank = last year\'s closing' + inp('OPEN_BANK', I.OPEN_BANK_SET, 'number') + '</label></div>' +
    '<p class="muted" style="margin:-4px 0 12px">Balance brought forward used now: cash ' + money(A.open.c) + ' · bank ' + money(A.open.b) + ' · total ' + money(A.open.c + A.open.b) + '</p>';
  var rr = A.bud.rev.map(function (r, i) {
    var act = A.incAct(i + 1, 1, 12), cell = i === 0 ? amt(r.amt, 1) : inp('REV_' + (i + 1), I['REV_' + (i + 1)]);
    return '<tr>' + td(i + 1) + td(esc(r.name)) + '<td class="n">' + cell + '</td>' + tdn(act, 1) + tdn(r.amt - act, 1) + '</tr>';
  }).join('');
  main += '<div class="sh" style="--c:' + C.fin + '">Annual revenue budget (Format 02)</div><table class="tbl x"><thead><tr><th>Item #</th><th>Type of Income</th><th style="text-align:right">Annual Revenue</th><th style="text-align:right">Actual Revenue</th><th style="text-align:right">Outstanding Amount</th></tr></thead><tbody>' + rr +
    '<tr class="tot"><td></td><td>Total Annual Expected Revenue</td>' + tdn(A.bud.total, 1) + tdn(A.totIncome(1, 12) - A.otherInc(1, 12), 1) + tdn(A.bud.total - (A.totIncome(1, 12) - A.otherInc(1, 12)), 1) + '</tr></tbody></table><p class="muted" style="font-size:12px">Parent Support Fee: type AUTO to use students × fee rate.</p>';
  var er = A.bud.parts.map(function (P, p) {
    var act = A.partAct(p + 1, 1, 12);
    var s = '<tr style="font-weight:800">' + td('<input data-s="PART_' + (p + 1) + '_PCT" value="' + P.pct + '" type="number" step="any" style="width:60px">') + td('<input data-s="PART_' + (p + 1) + '_NAME" value="' + esc(P.name) + '" style="width:100%">') + td('') + tdn(P.amt, 1) + (p < 6 ? tdn(act, 1) + tdn(P.amt - act, 1) : '<td></td><td></td>') + '</tr>';
    if (p < 6) s += P.items.map(function (it, i) { var a = A.itemAct(p + 1, i + 1, 1, 12); return '<tr>' + td('') + td('<input data-s="ITEM_' + (p + 1) + '_' + (i + 1) + '_NAME" value="' + esc(it.name) + '" style="width:100%">') + td('<input data-s="ITEM_' + (p + 1) + '_' + (i + 1) + '_PCT" value="' + it.pct + '" type="number" step="any" style="width:60px">') + tdn(it.amt, 1) + tdn(a, 1) + tdn(it.amt - a, 1) + '</tr>'; }).join('');
    return s;
  }).join('');
  main += '<div class="sh" style="--c:' + C.fin + ';margin-top:12px">Annual expenditure budget – School SLIP (Format 03)</div><div class="wrap" style="max-height:none"><table class="tbl x"><thead><tr><th>%</th><th>Budget Item</th><th>% of Part</th><th style="text-align:right">Annual Budget Amount</th><th style="text-align:right">Actual Spendings</th><th style="text-align:right">Remaining Balance</th></tr></thead><tbody>' + er + '</tbody></table></div>';
  return lay(finSide(F, A), main);
}
function saveSetup(F) {
  var vals = {}; $$('[data-s]').forEach(function (el) { vals[el.dataset.s] = el.value; });
  $('#fSave').disabled = true;
  call('apiSaveFinSetup', FA(), FV.year, vals).then(function (d) { setOnline(true); d.rows0 = d.rows.slice(); ls(ckey('fin_' + FV.year), d); FV.F = null; toast('Setup saved'); pageFinance(); })
    .catch(function (e) { $('#fSave').disabled = false; toast(errText(e) === 'No network' ? 'Saving the setup needs the internet.' : 'Not saved: ' + errText(e), 1); });
}

/* ------------------------------------------------------------------ ASSESSMENT (SARRS): own sign-in, ASM_HOME, SAPS, SASS, checklists, report cards, yearly lists */
var AV = { year: null, view: 'home', cc: 'ALL', q: '', sid: '', ap: 1 };
var ASM_VIEWS = [['home', 'Dashboard', 'bar_chart'], ['students', 'Student Entry', 'student'], ['studentdb', 'Student Database', 'card_index'], ['saps', 'SAPS', 'trophy'], ['sass', 'SASS', 'chart_increasing'],
                 ['checks', 'Checklists', 'check_mark_button'], ['cards', 'Report Cards', 'page_facing_up'], ['transcript', 'Transcript', 'memo'], ['results', 'Class Results', 'bar_chart'],
                 ['next', 'Next Grade', 'graduation_cap'], ['repeat', 'Repeat', 'counterclockwise_arrows_button'], ['left', 'Left', 'door'], ['withdrawn', 'Withdrawn', 'triangular_flag']];
function p1(v) { return v == null || isNaN(v) ? '–' : (Math.round(v * 10) / 10) + '%'; }
function asmTop(d) {
  var y = d ? d.year : YEAR;
  return head('bar_chart', 'Assessment (SARRS)  ' + y, 'Assessment', 'Signed in to Assessment as <b>' + esc(AUTH ? AUTH.user : '') + '</b>. Results are worked out by SARRS in Excel and sent with <b>Upload Online</b>' +
    (d && d.resultsAt ? ' (last upload ' + esc(d.resultsAt) + ')' : '') + '. Marks are typed in <b>Marks Entry</b>.' + (d && d._offline ? ' <span style="color:#b35c00">Offline copy.</span>' : '')) + subnav(ASM_VIEWS, AV.view, C.asm, 'av');
}
function asmBind() {
  bindNav('av', function (v) { AV.view = v; AV.q = ''; pageAssess(true); });
  bindNav('avgo', function (v) { AV.view = v; AV.q = ''; pageAssess(true); });
  $$('[data-href]').forEach(function (b) { b.onclick = function () { location.href = b.dataset.href; }; });
  if ($('#aY')) $('#aY').onchange = function () { AV.year = Number(this.value); AV.d = null; pageAssess(); };
  if ($('#aC')) $('#aC').onchange = function () { AV.cc = this.value; pageAssess(true); };
  if ($('#aS')) $('#aS').onchange = function () { AV.sid = this.value; pageAssess(true); };
  if ($('#aAP')) $('#aAP').onchange = function () { AV.ap = Number(this.value); if (AV.view !== 'cards') pageAssess(true); };
  if ($('#aSub')) $('#aSub').onchange = function () { AV.subj = Number(this.value); pageAssess(true); };
  $$('[data-rc]').forEach(function (b) { b.onclick = function (e) { e.preventDefault(); openReportCards(AV.cc === 'ALL' ? ((AV.d.students.filter(function (x) { return x.id === b.dataset.rc; })[0] || {}).cc) : AV.cc, AV.ap, b.dataset.rc); }; });
  $$('[data-rcall]').forEach(function (b) { b.onclick = function () { openReportCards(AV.cc, AV.ap, ''); }; });
  if ($('#aQ')) $('#aQ').oninput = function () { AV.q = this.value; var p = this.selectionStart; pageAssess(true); setTimeout(function () { var x = $('#aQ'); if (x) { x.focus(); x.setSelectionRange(p, p); } }, 0); };
}
function cardUrl(d, s) { return (apiUrl() || d.appUrl) + '?id=' + encodeURIComponent(s.id) + '&k=' + encodeURIComponent(s.k); }
function pageAssess(keep) {
  if (!AUTH) return moduleLogin('asm');
  if (AV.view === 'students') return pageStudents({ html: asmTop(AV.d), bind: asmBind });
  var p = keep && AV.d && (!AV.year || AV.d.year === AV.year) ? Promise.resolve(AV.d) : load('asm_' + AUTH.user + '_' + (AV.year || ''), 'apiAssess', AUTH, AV.year || '');
  p.then(function (d) {
    AV.d = d; AV.year = d.year; d.reports = d.reports || {}; d.checks = d.checks || {}; d.subjects = d.subjects || {};
    var S = d.students, act = S.filter(function (s) { return /^active$/i.test(s.status || 'Active'); });
    var avg = function (f, list) { var v = list.filter(function (s) { return s[f] != null && !isNaN(s[f]); }); return v.length ? v.reduce(function (t, s) { return t + s[f]; }, 0) / v.length : 0; };
    var side = '<div class="panel" style="--c:' + C.asm + '"><h3>' + ico('clipboard') + 'Summary</h3>' + kvTable([['Working year', yearSel('aY', d.years, d.year)], ['Students', S.length], ['Results ready', S.filter(function (s) { return s.result; }).length],
      ['Left / withdrawn', S.filter(function (s) { return /left|withdraw/i.test(s.status); }).length], ['Pass mark', d.passMark <= 1 ? Math.round(d.passMark * 100) + '%' : d.passMark], ['My classes', esc(d.classes.join(', ') || '–')]]) + '</div>' +
      shortcuts([['data-href="marks.html"', 'pencil', 'Marks entry'], ['data-avgo="saps"', 'trophy', 'SAPS – marks summary'], ['data-avgo="cards"', 'page_facing_up', 'Report cards'], ['data-avgo="students"', 'student', 'Students'],
                 ['onclick="print()"', 'printer', 'Print this page'], ['data-modout="asm"', 'locked', 'Log out of Assessment']], C.asm);
    var main = '', q = AV.q.toLowerCase();
    if (XLV[AV.view]) { $('#page').innerHTML = asmTop(d) + lay(side, XLV[AV.view](d)); asmBind(); if (AV.view === 'saps') loadSaps(d); return; }
    var inCls = function (s) { return (AV.cc === 'ALL' || s.cc === AV.cc) && (!q || (s.sur + ' ' + s.name + ' ' + s.id).toLowerCase().indexOf(q) >= 0); };
    var byClass = function (a, b) { return (d.classes.indexOf(a.cc) - d.classes.indexOf(b.cc)) || a.sur.localeCompare(b.sur); };
    var filt = '<div class="bar">' + yearSel('aY', d.years, d.year) + '<select id="aC"><option value="ALL">All ' + (d.admin ? 'classes' : 'my classes') + '</option>' + opts(d.classes, AV.cc) + '</select><input id="aQ" placeholder="Search name or ID" value="' + esc(AV.q) + '"><button class="btn" onclick="print()">' + ico('printer') + 'Print</button></div>';
    var shTitle = function (t) { return '<div class="sh" style="--c:' + C.asm + '">' + t + ' – ' + d.year + (AV.cc !== 'ALL' ? ' – ' + esc(AV.cc) + (d.teachers[AV.cc] ? ' (' + esc(d.teachers[AV.cc]) + ')' : '') : '') + '</div>'; };
    var resTag = function (s) { return s.result ? '<span class="st ' + (/promote/i.test(s.result) ? 'ok' : /repeat/i.test(s.result) ? 'out' : 'low') + '">' + esc(s.result) + '</span>' : ''; };
    if (AV.view === 'home') {
      var k = [['STUDENTS (ACTIVE)', act.length, act.filter(function (s) { return /^m/i.test(s.sex); }).length + ' boys · ' + act.filter(function (s) { return /^f/i.test(s.sex); }).length + ' girls', C.stu, 'busts_in_silhouette'],
               ['AVERAGE YEAR %', p1(avg('yr', S)), S.filter(function (s) { return /promote/i.test(s.result); }).length + ' promote · ' + S.filter(function (s) { return /repeat/i.test(s.result); }).length + ' repeat', C.asm, 'trophy'],
               ['AP1  |  AP2  AVERAGE', p1(avg('ap1', S)) + '  |  ' + p1(avg('ap2', S)), 'Assessment periods 1 and 2 · ' + d.year, '#2E8B57', 'chart_increasing'],
               ['TEACHERS & CLASSES', Object.keys(d.teachers).length, d.classes.length + ' classes', C.tch, 'teacher']];
      main += '<div class="kpis">' + k.map(function (x) { return '<div class="kpi" style="--c:' + x[3] + '"><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b><span>' + esc(x[2]) + '</span>' + ico(x[4]) + '</div>'; }).join('') + '</div>';
      var groups = [['MARKS & ASSESSMENT', [['marks.html', 'pencil', 'Marks Entry', 'Type marks for your class (works offline)'], ['@students', 'student', 'Student Entry', 'Add or correct students'], ['@studentdb', 'card_index', 'Student Database', 'Every student and their details'], ['@saps', 'trophy', 'SAPS', 'Subject assessment periodic sheet'], ['@sass', 'chart_increasing', 'SASS', 'Subject averages by class']]],
                    ['CHECKLISTS – ATTITUDES, SKILLS & WORK HABITS', [['@checks', 'check_mark_button', 'Checklists', 'AWH (G4-6), KSA (G1-3), Skills (Prep)']]],
                    ['REPORT CARDS, ID CARDS & CERTIFICATES', [['@cards', 'page_facing_up', 'Report Cards', 'Open and print each student\'s report card'], ['marks.html', 'identification_card', 'ID Cards', 'Student and teacher ID cards with QR']]],
                    ['YEARLY SUMMARY', [['@transcript', 'memo', 'Transcript', 'One student, every subject'], ['@next', 'graduation_cap', 'Next Grade', 'Students who promote'], ['@repeat', 'counterclockwise_arrows_button', 'Repeat', 'Students who repeat'], ['@left', 'door', 'Left', 'Students who left'], ['@withdrawn', 'triangular_flag', 'Withdrawn', 'Students withdrawn']]]];
      main += groups.map(function (g) { return '<div class="group" style="--c:' + C.asm + '"><h4>' + ico('bar_chart') + g[0] + '</h4><div class="tiles">' + g[1].map(function (t) { return '<button class="tile" ' + (t[0].charAt(0) === '@' ? 'data-avgo="' + t[0].slice(1) + '"' : 'data-href="' + t[0] + '"') + ' style="--c:' + C.asm + '"><span class="sq">' + ico(t[1]) + '</span><span><b>' + esc(t[2]) + '</b><small>' + esc(t[3]) + '</small></span></button>'; }).join('') + '</div></div>'; }).join('');
      main += '<div class="panel" style="--c:' + C.stu + '"><h3>' + ico('busts_in_silhouette') + 'Students by class (working year)</h3>' + bars(d.classes, [{ name: 'Boys', color: '#2F80ED', data: d.classes.map(function (c) { return act.filter(function (s) { return s.cc === c && /^m/i.test(s.sex); }).length; }) }, { name: 'Girls', color: '#E46C0A', data: d.classes.map(function (c) { return act.filter(function (s) { return s.cc === c && /^f/i.test(s.sex); }).length; }) }], { stacked: true }) + '</div>';
      main += '<div class="panel" style="--c:' + C.asm + '"><h3>' + ico('chart_increasing') + 'Average % by grade – AP1 and AP2</h3>' + bars(GRADES.map(function (g) { return g.replace('Grade ', 'G'); }), [{ name: 'AP1 %', color: '#2F80ED', data: GRADES.map(function (g) { return avg('ap1', S.filter(function (s) { return s.grade === g; })); }) }, { name: 'AP2 %', color: '#2E8B57', data: GRADES.map(function (g) { return avg('ap2', S.filter(function (s) { return s.grade === g; })); }) }], { max: 100 }) + '</div>';
    } else if (AV.view === 'sass') {
      var cls = AV.cc === 'ALL' ? d.classes : [AV.cc];
      main += filt + shTitle('STUDENT ACADEMIC SUBJECT SUMMARY (SASS)');
      cls.forEach(function (c) {
        var list = S.filter(function (s) { return s.cc === c && !/left|withdraw/i.test(s.status); }), g = (list[0] || {}).grade || '';
        var names = d.subjects[g] || [];
        if (!names.length) { main += '<div class="panel"><b>' + esc(c) + '</b> <span class="muted">– no subject results (' + (g === 'Prep' ? 'Prep is reported with skills checklists' : 'upload results from Excel') + ').</span></div>'; return; }
        var row = function (ap) { return names.map(function (n, i) { var v = list.map(function (s) { var r = (d.reports[s.id] || {})[i + 1]; return r ? r[ap] : null; }).filter(function (x) { return x != null && !isNaN(x); }); return v.length ? v.reduce(function (t, x) { return t + x; }, 0) / v.length : null; }); };
        var a1 = row(0), a2 = row(1);
        main += '<div class="panel" style="--c:' + C.asm + '"><h3>' + ico('school') + esc(c) + (d.teachers[c] ? ' – ' + esc(d.teachers[c]) : '') + ' · ' + list.length + ' students</h3><div class="wrap" style="max-height:none"><table class="tbl x"><thead><tr><th>Subject</th><th style="text-align:right">AP1 average</th><th style="text-align:right">AP2 average</th><th style="text-align:right">Passed AP2</th></tr></thead><tbody>' +
          names.map(function (n, i) { if (!n) return ''; var pass = list.filter(function (s) { var r = (d.reports[s.id] || {})[i + 1]; return r && r[1] != null && r[1] >= (d.passMark <= 1 ? d.passMark * 100 : d.passMark); }).length;
            return '<tr>' + td(esc(n)) + td(p1(a1[i]), 'n') + td(p1(a2[i]), 'n') + td(pass + ' / ' + list.length, 'n') + '</tr>'; }).join('') + '</tbody></table></div>' +
          bars(names.map(function (n) { return String(n).slice(0, 6); }), [{ name: 'AP1 %', color: '#2F80ED', data: a1.map(function (x) { return x || 0; }) }, { name: 'AP2 %', color: '#2E8B57', data: a2.map(function (x) { return x || 0; }) }], { max: 100, h: 170 }) + '</div>';
      });
    } else if (AV.view === 'checks') {
      var cl = S.filter(inCls).sort(byClass);
      var T = { AWH: 'Attitudes & Work Habits (G4-6)', KSA: 'Knowledge, Skills & Attitudes (G1-3)', SKL: 'Skills (Prep / G1)' };
      main += filt + shTitle('CHECKLISTS – ATTITUDES, SKILLS & WORK HABITS') + '<div class="wrap"><table class="tbl x"><thead><tr><th>ID</th><th>Name</th><th>Class</th><th>AP</th><th>Checklist</th><th style="text-align:right">Days absent</th><th style="text-align:right">Average points</th><th>Teacher\'s comment</th></tr></thead><tbody>' +
        cl.map(function (s) { return (d.checks[s.id] || []).sort(function (a, b) { return a.ap - b.ap; }).map(function (c) { return '<tr>' + td(esc(s.id)) + td('<b>' + esc(s.sur) + '</b> ' + esc(s.name)) + td(esc(s.cc)) + td('AP' + c.ap) + td(esc(T[c.type] || c.type)) + td(esc(c.days), 'n') + td(c.avg === '' || c.avg == null ? '' : Math.round(N(c.avg) * 100) / 100, 'n') + td(esc(c.comment)) + '</tr>'; }).join(''); }).join('') +
        '</tbody></table></div><p class="muted">Checklists are filled in the Excel workbook (ASM checklist sheets) and come here with Upload Online.</p>';
    } else if (AV.view === 'transcript') {
      var pool = S.filter(function (s) { return AV.cc === 'ALL' || s.cc === AV.cc; }).sort(byClass);
      if (!AV.sid || !pool.some(function (s) { return s.id === AV.sid; })) AV.sid = pool.length ? pool[0].id : '';
      var st = pool.filter(function (s) { return s.id === AV.sid; })[0];
      main += '<div class="bar">' + yearSel('aY', d.years, d.year) + '<select id="aC"><option value="ALL">All ' + (d.admin ? 'classes' : 'my classes') + '</option>' + opts(d.classes, AV.cc) + '</select><select id="aS">' + pool.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === AV.sid ? ' selected' : '') + '>' + esc(s.cc + ' · ' + s.sur + ' ' + s.name) + '</option>'; }).join('') + '</select><button class="btn" onclick="print()">' + ico('printer') + 'Print</button></div>';
      if (st) {
        var names2 = d.subjects[st.grade] || [], rep = d.reports[st.id] || {};
        main += '<div class="sh" style="--c:' + C.asm + '">YEARLY TRANSCRIPT – ' + d.year + '</div><div class="panel" style="--c:' + C.asm + '">' + kvTable([['Student', '<b>' + esc(st.sur) + '</b> ' + esc(st.name) + ' (' + esc(st.id) + ')'], ['Class / grade', esc(st.cc + ' · ' + st.grade)], ['Sex', esc(st.sex)], ['Status', esc(st.status)], ['Class teacher', esc(d.teachers[st.cc] || '')]]) + '</div>' +
          '<table class="tbl x"><thead><tr><th>#</th><th>Subject</th><th style="text-align:right">AP1 %</th><th style="text-align:right">AP2 %</th></tr></thead><tbody>' +
          (names2.length ? names2.map(function (n, i) { var r = rep[i + 1] || [null, null]; return n ? '<tr>' + td(i + 1) + td(esc(n)) + td(p1(r[0]), 'n') + td(p1(r[1]), 'n') + '</tr>' : ''; }).join('') : '<tr><td colspan="4" class="muted">No subject results for this grade.</td></tr>') +
          '<tr class="tot"><td></td><td>Total marks · AP1 ' + esc(st.t1 == null ? '' : st.t1) + ' · AP2 ' + esc(st.t2 == null ? '' : st.t2) + ' · Year ' + esc(st.ty == null ? '' : st.ty) + '</td>' + td(p1(st.ap1), 'n') + td(p1(st.ap2), 'n') + '</tr></tbody></table>' +
          '<div class="kpis" style="margin-top:12px"><div class="kpi" style="--c:' + C.asm + '"><small>YEAR %</small><b>' + p1(st.yr) + '</b><span>Days absent AP1 ' + esc(st.abs1 || 0) + ' · AP2 ' + esc(st.abs2 || 0) + '</span></div><div class="kpi" style="--c:#2E8B57"><small>RESULT</small><b>' + esc(st.result || '–') + '</b><span>' + '<a href="#" data-rc="' + esc(st.id) + '" style="color:var(--gold)">Open report card</a>' + '</span></div></div>';
      } else main += '<p class="muted">No students.</p>';
    } else {
      var list = S, title = '';
      if (AV.view === 'results') { title = 'CLASS RESULTS – RANKED BY YEAR %'; list = S.filter(function (s) { return !/left|withdraw/i.test(s.status); }); }
      if (AV.view === 'cards') { title = 'REPORT CARDS'; list = S.filter(function (s) { return !/left|withdraw/i.test(s.status); }); }
      if (AV.view === 'next') { title = 'STUDENTS PROMOTED TO THE NEXT GRADE'; list = S.filter(function (s) { return /promote/i.test(s.result); }); }
      if (AV.view === 'repeat') { title = 'STUDENTS TO REPEAT'; list = S.filter(function (s) { return /repeat/i.test(s.result); }); }
      if (AV.view === 'left') { title = 'STUDENTS WHO LEFT'; list = S.filter(function (s) { return /left/i.test(s.status); }); }
      if (AV.view === 'withdrawn') { title = 'STUDENTS WITHDRAWN'; list = S.filter(function (s) { return /withdraw/i.test(s.status); }); }
      list = list.filter(inCls).sort(function (a, b) { return AV.view === 'results' ? (a.cc === b.cc ? (b.yr == null ? -1 : b.yr) - (a.yr == null ? -1 : a.yr) : d.classes.indexOf(a.cc) - d.classes.indexOf(b.cc)) : byClass(a, b); });
      var pos = {}, rank = {};
      list.forEach(function (s) { pos[s.cc] = (pos[s.cc] || 0) + 1; rank[s.id] = s.yr == null ? '' : pos[s.cc]; });
      if (AV.view === 'cards') {
        if (AV.cc === 'ALL' && d.classes.length) AV.cc = d.classes[0];
        list = list.filter(function (s) { return s.cc === AV.cc; });
        filt = '<div class="bar">' + yearSel('aY', d.years, d.year) + '<select id="aC">' + opts(d.classes, AV.cc) + '</select><select id="aAP"><option value="1"' + (AV.ap === 1 ? ' selected' : '') + '>AP1 (Terms 1 & 2)</option><option value="2"' + (AV.ap === 2 ? ' selected' : '') + '>AP2 (Terms 3 & 4)</option></select>' +
          '<input id="aQ" placeholder="Search name or ID" value="' + esc(AV.q) + '"><button class="btn pri" data-rcall="1">' + ico('printer') + 'Report cards – whole class</button></div>' +
          '<p class="muted" style="margin:-6px 0 10px">The same design as the Excel report cards (Grades 4–6, Grades 1–3, Prep & Grade 1 AP1). Each card prints on one A4 page – choose <b>Save as PDF</b> in the print box to keep a copy.</p>';
      }
      main += filt + shTitle(title) + '<div class="wrap"><table class="tbl x"><thead><tr>' +
        (AV.view === 'results' ? '<th>Pos</th>' : '<th>#</th>') + '<th>ID</th><th>Surname</th><th>Name</th><th>Sex</th><th>Class</th><th style="text-align:right">AP1 %</th><th style="text-align:right">AP2 %</th><th style="text-align:right">Year %</th><th>Result</th><th>Status</th>' + (d.admin || AV.view === 'cards' ? '<th class="noprint">Report card</th>' : '') + '</tr></thead><tbody>' +
        list.map(function (s, i) { return '<tr>' + td(AV.view === 'results' ? rank[s.id] : i + 1) + td(esc(s.id)) + td('<b>' + esc(s.sur) + '</b>') + td(esc(s.name)) + td(esc(s.sex)) + td(esc(s.cc)) + td(p1(s.ap1), 'n') + td(p1(s.ap2), 'n') + td('<b>' + p1(s.yr) + '</b>', 'n') + td(resTag(s)) + td(esc(s.status)) +
          (AV.view === 'cards' ? '<td class="noprint"><button class="btn" data-rc="' + esc(s.id) + '">' + ico('page_facing_up') + 'Report card</button></td>' : d.admin ? '<td class="noprint">' + (s.k ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(cardUrl(d, s)) + '">' + ico('page_facing_up') + 'Open</a>' : '') + '</td>' : '') + '</tr>'; }).join('') +
        (list.length ? '' : '<tr><td colspan="12" class="muted">No students in this list. Results come from Excel: work out the SARRS results, then Upload Online.</td></tr>') + '</tbody></table></div><p class="muted">' + list.length + ' students</p>';
    }
    $('#page').innerHTML = asmTop(d) + lay(side, main);
    asmBind();
  }).catch(function (e) { if (/Wrong UserName or Password|AUTH/.test(String(e && e.message))) return moduleLogin('asm', errText(e)); $('#page').innerHTML = '<div class="note bad">' + esc(errText(e)) + '</div>'; });
}

/* ------------------------------------------------------------------ MAIN HOMEPAGE (Excel sheet HOME) */
function pageHome(d) {
  var p = d && d.year ? Promise.resolve(d) : load('dash', 'apiDashboard', MA());
  p.then(function (d) {
    YEAR = d.year; ME = d.me || ME;
    var fin = d.finance, admin = MAIN.role === 'Admin';
    var k = [['TEACHERS ON RECORD', d.teachers, 'Teachers database', C.tch, 'teacher'],
             ['STUDENTS ENROLLED', d.students, d.enrol.reduce(function (t, g) { return t + g.m; }, 0) + ' male · ' + d.enrol.reduce(function (t, g) { return t + g.f; }, 0) + ' female', C.stu, 'busts_in_silhouette'],
             ['AVERAGE YEAR %', (Math.round(d.avgYear * 10) / 10) + '%', d.promote + ' promote · ' + d.repeat + ' repeat', C.asm, 'trophy']];
    k.push(fin ? ['FINANCE BALANCE (YEAR)', money(fin.cash + fin.bank), 'Receipts less payments · ' + fin.year, C.fin, 'bank'] : ['SCHOOL REPORTS', d.reports, 'Saved this year', C.rpt, 'page_facing_up']);
    var h = head('house', 'Dashboard', 'Overview', 'Welcome <b>' + esc(MAIN.name) + '</b> (' + roleText() + ') – choose a module to begin · Active year <b>' + d.year + '</b>' + (d._offline ? ' · <span style="color:#b35c00">offline copy</span>' : ''));
    h += '<div class="kpis">' + k.map(function (x) { return '<div class="kpi" style="--c:' + x[3] + '"><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b><span>' + esc(x[2]) + '</span>' + ico(x[4]) + '</div>'; }).join('') + '</div>';
    var groups = [['STUDENTS & ASSESSMENT', C.asm, 'bar_chart', ['assess', 'students']], ['TEACHERS & ADMINISTRATION', C.tch, 'teacher', ['Staff', 'Events', 'FormsLog']],
                  ['FINANCE, REPORTS & INFRASTRUCTURE', C.fin, 'money_bag', ['Finance', 'SchoolReports', 'Inventory']]];
    var nextEv = d.events[0], days = nextEv ? Math.round((new Date(nextEv.date) - new Date(today())) / 864e5) : null;
    var main = '<div class="sh" style="--c:' + C.home + '">MODULES</div>' + groups.map(function (g) {
      return '<div class="group" style="--c:' + g[1] + '"><h4>' + ico(g[2]) + g[0] + '</h4><div class="tiles">' + g[3].map(function (id) {
        var m = MODS.filter(function (x) { return x.id === id; })[0], ok = can(m.need);
        return '<button class="tile' + (ok ? '' : ' lockd') + '" data-go="' + id + '" style="--c:' + m.c + '"><span class="sq">' + ico(m.icon) + '</span><span><b>' + esc(m.label) + '</b><small>' + esc(ok ? m.sub : 'Locked for your login') + '</small></span>' + (ok ? '' : ico('locked', 'lk')) + '</button>';
      }).join('') + '</div></div>';
    }).join('');
    if (admin) main += '<div class="panel" style="--c:' + C.home + '"><div class="sh" style="--c:' + C.home + '">SCHOOL AT A GLANCE   (live from every module)</div><table class="tbl x"><thead><tr><th>Module</th><th>Key figure</th><th style="text-align:right">Value</th><th>Linked with</th></tr></thead><tbody>' +
      [['Teachers Database', 'Teachers on record', d.teachers, 'Assessment (class allocation)'], ['Student Database', 'Students enrolled in active year', d.students, 'Assessment (two-way)'],
       ['Assessment', 'Average year % (active year)', (Math.round(d.avgYear * 10) / 10) + '%', 'Assessment (SARRS)'], ['Assessment', 'Students to promote', d.promote, 'Assessment (SARRS)'],
       ['Finance', 'Total receipts (finance year)', fin ? money(fin.rin) : '–', 'Finance (SFMS)'], ['Finance', 'Total payments (finance year)', fin ? money(fin.rout) : '–', 'Finance (SFMS)'],
       ['Infrastructure / Inventory', 'Items needing repair', d.invRepair || 0, '—'], ['Infrastructure / Inventory', 'Stationery lines low / out', d.invLow || 0, '—'],
       ['Other Forms', 'Forms registered this year', d.forms || 0, 'Staff & students'], ['School Reports', 'Reports saved in active year', d.reports, 'All modules']]
        .map(function (r) { return '<tr>' + td(esc(r[0])) + td(esc(r[1])) + td('<b>' + esc(r[2]) + '</b>', 'n') + td('<span class="muted">' + esc(r[3]) + '</span>') + '</tr>'; }).join('') + '</tbody></table></div>';
    main += '<div class="panel" style="--c:' + C.stu + '"><h3>' + ico('busts_in_silhouette') + 'Students by grade</h3>' +
      bars(d.enrol.map(function (g) { return g.grade.replace('Grade ', 'G'); }), [{ name: 'Boys', color: '#2F80ED', data: d.enrol.map(function (g) { return g.m; }) }, { name: 'Girls', color: '#E46C0A', data: d.enrol.map(function (g) { return g.f; }) }], { stacked: true }) + '</div>';
    main += '<div class="panel" style="--c:' + C.asm + '"><h3>' + ico('chart_increasing') + 'Average % by grade – AP1 and AP2</h3>' +
      bars(d.gradeAvg.map(function (g) { return g.grade.replace('Grade ', 'G'); }), [{ name: 'AP1 %', color: '#2F80ED', data: d.gradeAvg.map(function (g) { return g.ap1; }) }, { name: 'AP2 %', color: '#2E8B57', data: d.gradeAvg.map(function (g) { return g.ap2; }) }], { max: 100 }) + '</div>';
    if (fin) main += '<div class="panel" style="--c:' + C.fin + '"><h3>' + ico('money_bag') + 'Receipts vs payments ' + fin.year + '</h3>' +
      bars(['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], [{ name: 'Receipts', color: '#2E8B57', data: fin.months.map(function (m) { return m.rin; }) }, { name: 'Payments', color: '#E46C0A', data: fin.months.map(function (m) { return m.rout; }) }], { k: true, h: 190 }) + '</div>';
    var side = '<div id="homeMsg">' + homeMsgPanel() + '</div><div class="panel" style="--c:' + C.home + '"><h3>' + ico('spiral_calendar') + 'Today</h3>' + kvTable([['Date', new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
        ['Next event', nextEv ? esc(nextEv.title) + '<br><small class="muted">' + fmtDate(nextEv.date) + '</small>' : 'No upcoming events listed'], ['Days to go', days === null ? '' : days === 0 ? 'Today!' : days], ['Reports saved this year', d.reports], ['Waiting to upload', OUTBOX.length]]) + '</div>' +
      '<div class="panel" style="--c:' + C.home + '"><h3>' + ico('light_bulb') + 'Quick launch</h3>' +
      [['assess', 'pencil', 'Assessment'], ['Finance', 'money_bag', 'Finance'], ['Events', 'spiral_calendar', 'Admin Routines'], ['SchoolReports', 'warning', 'Write a report'], ['FormsLog', 'card_index', 'Other Forms']]
        .filter(function (b) { var m = MODS.filter(function (x) { return x.id === b[0]; })[0]; return can(m.need); })
        .map(function (b) { return '<button class="btn" data-go="' + b[0] + '">' + ico(b[1]) + esc(b[2]) + '</button>'; }).join('') + '<button class="btn" onclick="print()">' + ico('printer') + 'Print</button></div>' +
      (d.events.length > 1 ? '<div class="panel" style="--c:' + C.adm + '"><h3>' + ico('calendar') + 'Coming up</h3>' + kvTable(d.events.slice(0, 5).map(function (e) { return [fmtDate(e.date), esc(e.title)]; })) + '</div>' : '') + ownerPanel();
    $('#page').innerHTML = h + lay(side, main) + '<p class="muted" style="font-size:12px;margin-top:10px">● Ready  |  Active year ' + d.year + '  |  Finance (SFMS) and Assessment (SARRS) built in  |  THPS School Manager v' + VERSION + '  |  Property of TOM HOEY P/SCHL</p>';
    $$('[data-go]').forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; });
  }).catch(function (e) { $('#page').innerHTML = '<div class="note bad">Cannot open the dashboard: ' + esc(errText(e)) + '</div>'; });
}

/* ------------------------------------------------------------------ REPORT CARDS: the same three designs as Excel (ASM_RC_G4_6, ASM_RC_G1_3, ASM_RC_PREP) */
var RC_LISTS = {
  AWH_A: ['Social Relationship', 'Punctuality', 'Attendance', 'Neatness', 'Discipline', 'Behaviour', '', ''],
  AWH_H: ['Completes homework', 'Listens attentively', 'Begins work quickly', 'Follows given instructions', 'Reads confidently', 'Completes all assessable tasks', 'Participates well in group work', 'Tackles difficult tasks and situations', 'Works independently', 'Keeps books tidy'],
  KSA_K: ['Recalling facts', 'Ability to respond', 'Contributing ideas', 'Sharing own ideas', 'Implementing ideas', 'Understanding concepts', 'Counting', ''],
  KSA_S: ['Solving problems', 'Speaking & listening', 'Comprehension', 'Reading', 'Writing', 'Psychomotor skills', 'Acquiring life skills', 'Competency'],
  KSA_A: ['Punctuality', 'Responsibility', 'General behaviour', 'Leadership', 'Hygiene', 'Attendance', 'Use of manners', 'Use of resources', 'Christian moral', ''],
  KSA_H: ['Completes homework', 'Begins work quickly', 'Follows given instructions', 'Completes all assessable tasks', 'Participates well in group work', 'Tackles difficult tasks and situations', 'Works independently', ''],
  PRE_E: ['Recalling facts', 'Ability to respond', 'Contributing ideas', 'Sharing own ideas', 'Implementing ideas', 'Understanding concepts', 'Counting', '', '', ''],
  PRE_M: ['Solving problems', 'Speaking & listening', 'Comprehension', 'Reading', 'Writing', 'Psychomotor skills', 'Acquiring life skills', 'Competency', '', ''],
  PRE_P: ['Punctuality', 'Responsibility', 'General behaviour', 'Leadership', 'Hygiene', 'Attendance', 'Use of manners', 'Use of resources', 'Christian moral', '']
};
var RC_CSS = '@page{size:A4;margin:8mm}*{box-sizing:border-box}body{margin:0;font:11px Arial,Helvetica,sans-serif;color:#000;background:#777}' +
  '.card{width:194mm;min-height:279mm;margin:10px auto;background:#fff;border:2px solid #000;padding:5mm;page-break-after:always;position:relative}' +
  '.hd{display:grid;grid-template-columns:44mm 1fr;gap:4mm;align-items:start}.hd img{width:44mm}.sch{font:700 22px Georgia,"Times New Roman",serif;text-align:center;letter-spacing:.5px;margin:2px 0}' +
  '.sub{text-align:center;font-style:italic;font-size:10px;margin-bottom:3px}.ttl{text-align:center;font-weight:700;font-size:12px;background:#e6e6e6;border:1px solid #999;padding:4px;margin:3px 0}' +
  'table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:2px 4px;font-size:10.5px;height:17px}th{font-size:9.5px}.blk th,tr.blk th{background:#262626;color:#fff;text-align:left;font-weight:700}' +
  '.g th{background:#d9d9d9;color:#000;text-align:left}.c{text-align:center!important}.b{font-weight:700}.big{font-size:15px;font-weight:700}.nm{font-size:17px;font-weight:700;text-align:center;background:#e6e6e6}' +
  '.nml{font:700 15px Georgia,serif;text-align:right;border:0}.tot td{background:#262626;color:#fff;font-weight:700;font-size:13px}.rate td{background:#bfbfbf;font-weight:700;font-style:italic}' +
  '.vert{writing-mode:vertical-rl;transform:rotate(180deg);font-size:8.5px;text-align:center}.cm{background:#efefef;font-style:italic;font-size:11px;height:60px;vertical-align:top;padding:4px}' +
  '.foot{margin-top:8mm;font-size:11px}.foot td{border:0;padding:3px 2px}.line{border-bottom:1px solid #000!important;text-align:center;font-weight:700}.ap{font-style:italic;font-weight:700;margin-top:6mm}' +
  '.two{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.gap{height:3mm}.bar{display:flex;align-items:flex-end;gap:6px;height:28mm;border-left:1px solid #999;border-bottom:1px solid #999;padding:0 4px;margin-top:14px}' +
  '.bar div{flex:1;background:#555;position:relative}.bar span{position:absolute;top:-12px;left:-4px;right:-4px;text-align:center;font-size:8px}.bl{display:flex;gap:6px;padding:0 4px}.bl div{flex:1;font-size:7px;text-align:right;transform:rotate(-35deg);transform-origin:top right;white-space:nowrap}' +
  '.tools{position:sticky;top:0;background:#222;color:#fff;padding:8px;text-align:center;z-index:5;font:700 14px Arial}.tools button{font:700 14px Arial;padding:8px 16px;margin:0 4px;border-radius:8px;border:0;cursor:pointer}' +
  '@media print{body{background:#fff}.tools{display:none}.card{margin:0;border:2px solid #000}}';
function rcCalc(D) {
  var S = D.setup || {}, bands = S.bands && S.bands.length ? S.bands : [], rates = S.rates && S.rates.length ? S.rates : [];
  if (!bands.length) bands = [{ min: 75, max: 100, grade: 'A', level: 'Excellent', comment: '' }, { min: 60, max: 74, grade: 'B', level: 'Very Good', comment: '' }, { min: 45, max: 59, grade: 'C', level: 'Satisfactory', comment: '' }, { min: 30, max: 44, grade: 'D', level: 'Needs Improvement', comment: '' }, { min: 0, max: 29, grade: 'E', level: 'Unsatisfactory', comment: '' }];
  if (!rates.length) rates = [{ code: 'A', level: 'Very Good', comment: '' }, { code: 'B', level: 'Good', comment: '' }, { code: 'C', level: 'Satisfactory', comment: '' }, { code: 'D', level: 'Needs Improvement', comment: '' }];
  var band = function (pct) { var n = bands.filter(function (b) { return b.min > pct * 100; }).length; return bands[Math.min(n, bands.length - 1)]; };
  var lists = {}; Object.keys(RC_LISTS).forEach(function (k) { lists[k] = (S.lists && S.lists[k] && S.lists[k].some(function (x) { return x; })) ? S.lists[k] : RC_LISTS[k]; });
  return { bands: bands, rates: rates, band: band, lists: lists };
}
function rcKind(grade, ap) { var g = grade === 'Prep' ? 0 : Number(String(grade).replace(/\D/g, '')) || 0; return g === 0 || (g === 1 && ap === 1) ? 'PREP' : g <= 3 ? 'G13' : 'G46'; }
function rcOne(D, s, R) {
  var ap = D.ap, max = D.gm ? (ap === 1 ? D.gm.max1 : D.gm.max2) : 0, kind = rcKind(D.grade, ap), ck = s.check, rr = ck ? ck.r : null;
  var rate = function (i) { return !rr ? '' : (rr[i] ? esc(rr[i]) : '–'); };
  var score = function (st, i) { var x = (st.subj || {})[i + 1]; if (!x) return null; var v = ap === 1 ? x.s1 : x.s2; return v === '' || v == null ? null : Number(v); };
  var subjRows = [];
  for (var si = 0; si < Math.max(8, D.subjects.length); si++) {
    var nm = D.subjects[si] || '', sc = score(s, si), pc = sc == null || !max ? null : sc / max, pos = '';
    if (sc != null) { var all = D.students.map(function (o) { return score(o, si); }).filter(function (v) { return v != null; }); pos = (all.filter(function (v) { return v > sc; }).length + 1) + '/' + all.length; }
    subjRows.push({ no: si + 1, nm: nm, sc: sc, pc: pc, gr: pc == null ? '' : R.band(pc).grade, pos: pos });
  }
  var totSc = subjRows.some(function (x) { return x.sc != null; }) ? subjRows.reduce(function (t, x) { return t + (x.sc || 0); }, 0) : null;
  var tp = ap === 1 ? s.p1 : s.p2, tpc = tp == null ? null : tp / 100, tpos = '';
  if (tpc != null) { var act = D.students.filter(function (o) { return /^active$/i.test(o.status) && (ap === 1 ? o.p1 : o.p2) != null; }); tpos = (act.filter(function (o) { return (ap === 1 ? o.p1 : o.p2) > tp; }).length + 1) + '/' + act.length; }
  var tb = tpc == null ? null : R.band(tpc);
  var pctTxt = function (v) { return v == null ? '' : Math.round(v * 100) + '%'; };
  var name = esc(String(s.sur).toUpperCase() + ' ' + s.name), apWord = ap === 1 ? 'ONE' : 'TWO', terms = ap === 1 ? 'Terms 1 & 2' : 'Terms 3 & 4';
  var logo = '<img src="' + location.href.replace(/[^/]*$/, '') + 'img/school.png" alt="">';
  var comment = ck && ck.comment ? ck.comment : (kind === 'PREP' ? '' : (tb ? tb.comment : ''));
  var days = ck ? esc(ck.days === '' || ck.days == null ? 0 : ck.days) : '–';
  var foot = function (who) { return '<table class="foot"><tr><td style="width:30%" class="b">Class Teacher:</td><td class="line">' + esc(D.teacher) + '</td><td style="width:20%"></td></tr><tr><td class="b">Signature:</td><td class="line">&nbsp;</td><td></td></tr><tr><td class="b">Date:</td><td class="line" style="font-weight:400">' + esc(D.today) + '</td><td></td></tr></table><div class="ap">' + who + '</div>'; };
  var listRows = function (arr, off, n) { var h = ''; for (var i = 0; i < n; i++) h += '<tr><td class="c" style="width:7mm">' + (arr[i] ? i + 1 : '') + '</td><td>' + esc(arr[i] || '') + '</td><td class="c b" style="width:22mm">' + (arr[i] ? rate(off + i) : '') + '</td></tr>'; return h; };
  var crit = R.rates.map(function (r) { return r.code + ' = ' + String(r.level).toUpperCase(); }).join(',  ');
  var grey = 'background:#d9d9d9;color:#000';
  var h = '<div class="card">';
  if (kind === 'G46') {
    h += '<div class="hd">' + logo + '<div><div class="sch">' + esc(D.school) + '</div><div class="ttl">ASSESSMENT PERIOD ' + apWord + ' (0' + ap + ')  –  STUDENT REPORT SHEET (' + terms + ')</div>' +
      '<table><tr class="blk"><th class="c">No.</th><th class="c">GRADE</th><th class="c">YEAR</th><th class="c">Sex</th><th class="c" colspan="2">Class</th><th class="c">ID No#</th></tr>' +
      '<tr class="big"><td class="c">' + esc(s.no) + '</td><td class="c">' + esc(String(D.grade).replace(/\D/g, '')) + '</td><td class="c">' + D.year + '</td><td class="c">' + esc(s.sex) + '</td><td class="c" colspan="2">' + esc(D.cc) + '</td><td class="c" style="font-size:11px">' + esc(s.id) + '</td></tr>' +
      '<tr><td colspan="2" class="nml">Name:</td><td colspan="4" class="nm">' + name + '</td><td class="c b" style="font-size:9px;text-decoration:underline">SENIOR<br>PRIMARY</td></tr></table></div></div><div class="gap"></div>';
    var partC = '<table class="blk"><tr><th colspan="2">PART C: PUPIL\'S PERSONAL ATTITUDE ASSESSMENT</th><th class="c" style="' + grey + '">GRADING</th></tr>' + listRows(R.lists.AWH_A, 0, 8) + '</table><div class="gap"></div>' +
      '<table class="blk"><tr><th colspan="2">PART D: PUPIL\'S LEARNING &amp; WORKING HABITS</th><th class="c" style="' + grey + '">GRADING</th></tr>' + listRows(R.lists.AWH_H, 8, 10) + '</table><div class="gap"></div>' +
      '<table><tr><td class="b" style="background:#d9d9d9;font-size:9px">NUMBER OF DAYS ABSENT WITHOUT GOOD REASON</td><td class="c big" style="width:20mm">' + days + '</td></tr></table><div class="gap"></div>' +
      '<table class="blk"><tr><th class="c">PERSONAL ATTITUDE, LEARNING AND WORKING HABITS CRITERIA</th></tr><tr><td class="c b" style="background:#e6e6e6;height:34px">' + esc(crit) + '</td></tr></table>';
    var partA = '<table><tr class="blk"><th colspan="4">PART A: ACADEMIC ASSESSMENT REPORT</th><th rowspan="3" class="vert" style="' + grey + '">GRADING</th><th rowspan="3" class="vert" style="' + grey + '">POSITION</th></tr>' +
      '<tr class="g"><th colspan="2">SUBJECT</th><th class="c">SCORE</th><th class="c">PERCENT</th></tr><tr class="g"><th colspan="2">ASSESSMENT AREA</th><th class="c">' + (max || '') + '</th><th class="c">%</th></tr>' +
      subjRows.map(function (x) { return '<tr style="height:23px"><td class="c b" style="width:7mm">' + x.no + '</td><td class="b">' + esc(String(x.nm).toUpperCase()) + '</td><td class="c b">' + (x.sc == null ? '' : x.sc) + '</td><td class="c">' + pctTxt(x.pc) + '</td><td class="c b">' + x.gr + '</td><td class="c">' + x.pos + '</td></tr>'; }).join('') +
      '<tr class="tot"><td colspan="2">TOTAL SCORE</td><td class="c">' + (totSc == null ? '' : totSc) + '</td><td class="c">' + pctTxt(tpc) + '</td><td class="c">' + (tb ? tb.grade : '') + '</td><td class="c" style="font-size:11px">' + tpos + '</td></tr>' +
      '<tr class="rate"><td colspan="3" style="font-size:9px;font-style:normal">ACADEMIC PERFORMANCE RATING:</td><td colspan="3" class="c">' + (tb ? esc(tb.level) : '') + '</td></tr></table>';
    var gr = subjRows.filter(function (x) { return x.nm; });
    var graph = '<div style="border:1px solid #ccc;margin-top:3mm;padding:3mm"><div class="c b" style="font-size:13px">Academic Performance Graph</div><div class="bar">' +
      gr.map(function (x) { var v = x.pc == null ? 0 : Math.max(0, Math.min(1, x.pc)); return '<div style="height:' + (v * 100) + '%"><span>' + pctTxt(x.pc) + '</span></div>'; }).join('') + '</div><div class="bl" style="height:16mm">' +
      gr.map(function (x) { return '<div>' + esc(String(x.nm).toUpperCase()) + '</div>'; }).join('') + '</div></div>';
    h += '<div class="two"><div>' + partA + graph + '</div><div>' + partC + '</div></div><div class="gap"></div>' +
      '<table class="blk"><tr><th class="c">TOTAL ACADEMIC RESULTS EVALUATIVE COMMENT</th></tr><tr><td class="cm">' + esc(comment) + '</td></tr></table><div class="gap"></div>' +
      '<table><tr class="blk"><th class="c" colspan="4">ACADEMIC &amp; SKILLS ASSESSMENT CRITERIA</th></tr><tr class="g"><th class="c">Percentage</th><th class="c">Key</th><th class="c">Grading</th><th class="c">Comment</th></tr>' +
      R.bands.map(function (b) { return '<tr><td class="c b">' + b.min + ' – ' + b.max + '</td><td class="c b">' + esc(b.grade) + '</td><td class="c">' + esc(b.level) + '</td><td style="font-size:9px">' + esc(b.comment) + '</td></tr>'; }).join('') + '</table>' +
      foot('Sighted &amp; Approved for reporting by: _________________________________');
  } else if (kind === 'G13') {
    h += '<div class="hd">' + logo + '<div><div class="sch">' + esc(D.school) + '</div><div class="sub">' + esc((D.setup && D.setup.schoolLine) || 'Middle Fly District, Western Province') + '</div>' +
      '<div class="ttl">ASSESSMENT PERIOD ' + apWord + '  –  JUNIOR PRIMARY STUDENT REPORT</div>' +
      '<table><tr class="blk"><th class="c">No.</th><th class="c" colspan="2">ID#</th><th class="c">GRADE</th><th class="c">YEAR</th><th class="c">Sex</th><th class="c">Class</th></tr>' +
      '<tr class="big"><td class="c">' + esc(s.no) + '</td><td class="c" colspan="2">' + esc(s.id) + '</td><td class="c">' + esc(String(D.grade).replace(/\D/g, '')) + '</td><td class="c">' + D.year + '</td><td class="c">' + esc(s.sex) + '</td><td class="c">' + esc(D.cc) + '</td></tr></table></div></div>' +
      '<table style="margin-top:2mm"><tr><td class="nml" style="width:60mm">Name:</td><td class="nm">' + name + '</td></tr></table><div class="gap"></div>';
    var sec = function (title, arr, off, n) { var t = title ? '<tr class="g"><th colspan="2">' + title + '</th></tr>' : ''; for (var i = 0; i < n; i++) t += '<tr><td>' + esc(arr[i] || '') + '</td><td class="c b" style="width:20mm">' + (arr[i] ? rate(off + i) : '') + '</td></tr>'; return t; };
    var left = '<table><tr class="blk"><th colspan="2">PART A: KNOWLEDGE, SKILLS, ATTITUDE</th></tr>' + sec('KNOWLEDGE', R.lists.KSA_K, 0, 8) + sec('SKILLS', R.lists.KSA_S, 8, 8) + sec('ATTITUDE', R.lists.KSA_A, 16, 10) + '</table><div class="gap"></div>' +
      '<table><tr class="blk"><th colspan="2">PART B: LEARNING &amp; WORKING HABITS</th></tr>' + sec('', R.lists.KSA_H, 26, 8) + '</table>';
    var right = '<table><tr class="blk"><th colspan="4">PART C: ACADEMIC ASSESSMENT REPORT</th><th rowspan="3" class="vert" style="' + grey + '">GRADING</th><th rowspan="3" class="vert" style="' + grey + '">POSITION</th></tr>' +
      '<tr class="g"><th colspan="2">SUBJECT</th><th class="c">SCORE</th><th class="c">PERCENT</th></tr><tr class="g"><th colspan="2">ASSESSMENT AREA</th><th class="c">' + (max || '') + '</th><th class="c">%</th></tr>' +
      subjRows.map(function (x) { return '<tr style="height:30px"><td class="c b" style="width:7mm">' + x.no + '</td><td class="b" style="font-size:9.5px">' + esc(String(x.nm).toUpperCase()) + '</td><td class="c big">' + (x.sc == null ? '' : x.sc) + '</td><td class="c">' + pctTxt(x.pc) + '</td><td class="c big">' + x.gr + '</td><td class="c">' + x.pos + '</td></tr>'; }).join('') +
      '<tr class="tot"><td colspan="2">TOTAL SCORE</td><td class="c">' + (totSc == null ? '' : totSc) + '</td><td class="c">' + pctTxt(tpc) + '</td><td class="c">' + (tb ? tb.grade : '') + '</td><td class="c" style="font-size:11px">' + tpos + '</td></tr>' +
      '<tr class="rate"><td colspan="4" style="font-size:9px;font-style:normal">ACADEMIC PERFORMANCE RATING:</td><td colspan="2" class="c">' + (tb ? esc(tb.level) : '') + '</td></tr></table><div class="gap"></div>' +
      '<table><tr class="blk"><th class="c">GENERAL COMMENTS (Academic Performance &amp; Behaviour)</th></tr><tr class="g"><th>Academic Performance:</th></tr><tr><td class="cm" style="height:70px">' + esc(comment) + '</td></tr></table>' +
      '<table><tr><td class="b" style="text-align:right;background:#e6e6e6">NO# OF DAYS ABSENT:</td><td class="c big" style="width:18mm">' + days + '</td></tr></table><div class="gap"></div>' +
      '<table><tr class="blk"><th>ACADEMIC RESULTS CRITERIA (% &amp; Grading)</th></tr>' + R.bands.map(function (b) { return '<tr><td style="background:#efefef">' + esc(b.grade + ' = ' + String(b.level).toUpperCase() + '   (' + b.min + ' – ' + b.max + '%)') + '</td></tr>'; }).join('') +
      '<tr class="blk"><th style="font-size:8.5px">PERSONAL ATTITUDE, LEARNING &amp; WORKING HABITS PLUS SKILLS CRITERIA</th></tr><tr><td class="b" style="background:#efefef;height:30px">' + esc(crit) + '</td></tr></table>';
    h += '<div class="two"><div>' + left + '</div><div>' + right + '</div></div>' + foot('Sighted &amp; Approved for Parent Conferencing by: ______________________   (HM, DHM, SSM, ST)');
  } else {
    var allR = rr ? rr.slice(0, 30) : [], cnt = function (code) { return allR.filter(function (x) { return x === code; }).length; };
    var ov = '', ovl = '';
    if (ck && ck.avg !== '' && ck.avg != null) { var k = Math.min(4, Math.max(1, 5 - Math.round(Number(ck.avg)))); ov = (R.rates[k - 1] || {}).code || ''; ovl = (R.rates[k - 1] || {}).level || ''; }
    if (!comment && ov) comment = (R.rates.filter(function (r) { return r.code === ov; })[0] || {}).comment || '';
    var g1 = D.grade !== 'Prep';
    h += '<div class="hd">' + logo + '<div><div class="sch">' + esc(D.school) + '</div><div class="ttl">' + (g1 ? 'GRADE 1' : 'PREPARATORY') + ' SKILLS REPORT CARD  –  ASSESSMENT PERIOD ' + apWord + ' (' + terms + ')</div>' +
      '<table><tr class="blk"><th class="c" style="width:20%">No.</th><th class="c">ID#</th><th class="c" style="width:20%">Class</th></tr><tr class="big"><td class="c">' + esc(s.no) + '</td><td class="c">' + esc(s.id) + '</td><td class="c">' + esc(D.cc) + '</td></tr></table>' +
      '<table style="margin-top:2mm"><tr><td class="nml" style="width:30mm">Name:</td><td class="nm">' + name + '</td></tr></table></div></div><div class="gap"></div><div class="gap"></div>';
    var part = function (t, arr, off) { return '<table><tr class="blk"><th colspan="2">' + t + '</th><th class="c" style="' + grey + ';width:20mm">RATING</th></tr>' + listRows(arr, off, 10) + '</table>'; };
    var sum = '<table><tr class="blk"><th colspan="2">SUMMARY OF ACHIEVEMENT</th></tr>' + R.rates.map(function (r) { return '<tr><td>Number of ' + esc(r.code) + ' ratings  (' + esc(r.level) + ')</td><td class="c big" style="width:20mm">' + (ck ? cnt(r.code) : '') + '</td></tr>'; }).join('') +
      '<tr style="background:#e6e6e6"><td class="b">Overall rating</td><td class="c big">' + ov + '</td></tr><tr style="background:#e6e6e6"><td class="b">Overall level</td><td class="c b" style="font-size:9px">' + esc(ovl) + '</td></tr>' +
      '<tr style="background:#e6e6e6"><td class="b">Number of days absent</td><td class="c big">' + days + '</td></tr><tr style="background:#e6e6e6"><td class="b">Year progress (skills average, all APs)</td><td class="c b">' + (s.yp == null ? '' : Math.round(s.yp) + '%') + '</td></tr>' +
      '<tr><td colspan="2" class="b" style="background:#efefef">' + esc(R.rates.map(function (r) { return r.code + ' = ' + r.level; }).join(',  ')) + '</td></tr></table>';
    h += '<div class="two"><div>' + part('PART A: ENGLISH', R.lists.PRE_E, 0) + '</div><div>' + part('PART B: MATHEMATICS', R.lists.PRE_M, 10) + '</div></div><div class="gap"></div><div class="gap"></div>' +
      '<div class="two"><div>' + part('PART C: PERSONAL &amp; SOCIAL (PSY)', R.lists.PRE_P, 20) + '</div><div>' + sum + '</div></div><div class="gap"></div>' +
      '<table class="blk"><tr><th class="c">TEACHER\'S COMMENT</th></tr><tr><td class="cm">' + esc(comment) + '</td></tr></table>' + foot('Sighted &amp; Approved for reporting by: ____________________________________');
  }
  return h + '</div>';
}
function openReportCards(cc, ap, onlyId) {
  var w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to open the report cards.', 1);
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report cards ' + esc(cc) + '</title><style>' + RC_CSS + '</style></head><body><div class="tools">Loading report cards…</div></body></html>'); w.document.close();
  call('apiReportCards', AUTH, AV.year || YEAR, cc, ap).then(function (D) {
    var R = rcCalc(D), list = D.students.filter(function (s) { return onlyId ? s.id === onlyId : /^active$/i.test(s.status); });
    w.document.body.innerHTML = '<div class="tools">' + esc(D.cc) + ' · AP' + D.ap + ' · ' + list.length + ' report card' + (list.length === 1 ? '' : 's') + '  <button onclick="print()">Print / Save as PDF</button><button onclick="close()">Close</button></div>' +
      (list.length ? list.map(function (s) { return rcOne(D, s, R); }).join('') : '<div class="card"><p>No students in ' + esc(cc) + '.</p></div>');
    w.document.title = 'Report cards ' + D.cc + ' AP' + D.ap + ' ' + D.year;
  }).catch(function (e) { w.document.body.innerHTML = '<div class="tools">Cannot open the report cards: ' + esc(errText(e)) + '</div>'; });
}

/* ================================================================== v13: sheets drawn like the Excel workbook (white sheet, grey lines, dark title bars) */
function xlFrame(icon, title, color, picks, lines) {
  return '<div class="xl" style="--c:' + color + '"><div class="xlh"><img src="img/province.png" alt=""><div>' +
    '<div class="xb1">WESTERN PROVINCIAL ADMINISTRATION</div><div class="xb2">DIVISION OF EDUCATION – Middle Fly District</div>' +
    '<div class="xb3">' + esc(lines && lines.sys || 'SCHOOL ASSESSMENT, RECORDING & REPORTING SYSTEM – Based on SBC') + '</div><div class="xb2 b">TOM HOEY PRIMARY SCHOOL</div>' +
    '<div class="xt">' + ico(icon) + esc(title) + '</div></div><img src="img/school.png" alt=""></div>' + (picks ? '<div class="xp noprint">' + picks + '</div>' : '') + '</div>';
}
function xlPick(label, inner) { return '<label><span>' + label + '</span>' + inner + '</label>'; }
function xlBar(t) { return '<div class="xbar">' + t + '</div>'; }
function bandOf(bands, pct) { if (pct == null || isNaN(pct)) return null; var n = bands.filter(function (b) { return b.min > pct * 100; }).length; return bands[Math.min(n, bands.length - 1)]; }
function asmBands(d) { return d.setup && d.setup.bands && d.setup.bands.length ? d.setup.bands : rcCalc({}).bands; }
function xlClassPick(d, allowAll) { return '<select id="aC">' + (allowAll ? '<option value="ALL">All</option>' : '') + opts(d.classes, AV.cc) + '</select>'; }
function xlApPick() { return '<select id="aAP"><option value="1"' + (AV.ap === 1 ? ' selected' : '') + '>AP1</option><option value="2"' + (AV.ap === 2 ? ' selected' : '') + '>AP2</option></select>'; }
function needClass(d) { if (AV.cc === 'ALL' || d.classes.indexOf(AV.cc) < 0) AV.cc = d.classes[0] || 'ALL'; }
function gradeOfCc(cc) { return /^prep/i.test(cc) ? 'Prep' : 'Grade ' + String(cc).charAt(0); }

/* ---------------- SAPS ---------------- */
function xlSaps(d) {
  needClass(d);
  var g = gradeOfCc(AV.cc), names = d.subjects[g] || [];
  if (!AV.subj || AV.subj > Math.max(1, names.length)) AV.subj = 1;
  var picks = xlPick('Subject', '<select id="aSub">' + (names.length ? names.map(function (n, i) { return '<option value="' + (i + 1) + '"' + (AV.subj === i + 1 ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') : '<option>Skills (no subjects)</option>') + '</select>') +
    xlPick('Year', yearSel('aY', d.years, d.year)) + xlPick('Class', xlClassPick(d)) + xlPick('Term', '<b>' + (AV.ap === 1 ? 'Term 1 & 2' : 'Term 3 & 4') + '</b>') + xlPick('AP No#', xlApPick()) +
    '<button class="btn" onclick="print()">' + ico('printer') + 'Print</button>';
  return xlFrame('trophy', 'SUBJECT ASSESSMENT PERIODIC SHEET (SAPS) – MARKS SUMMARY', C.asm, picks) + '<div id="sapsBody"><p class="muted">Loading the marks…</p></div>';
}
function loadSaps(d) {
  var el = $('#sapsBody'); if (!el) return;
  call('apiSaps', AUTH, d.year, AV.cc, AV.subj, AV.ap).then(function (S) {
    var bands = S.bands && S.bands.length ? S.bands : asmBands(d), max = S.gm ? (S.ap === 1 ? S.gm.max1 : S.gm.max2) : 0, mode = S.gm ? (S.ap === 1 ? S.gm.mode1 : S.gm.mode2) : '';
    var base = (S.ap - 1) * 16, wIdx = [1, 2, 3, 4, 9, 10, 11, 12].map(function (i) { return base + i - 1; }), tIdx = [5, 6, 7, 8, 13, 14, 15, 16].map(function (i) { return base + i - 1; });
    var tm = S.task ? S.task.max : [], wp = S.weeklyPct * 100, tp = S.testPct * 100, subjName = S.subjects[S.subj - 1] || '';
    var hdr = '<div class="xinfo"><span><b>' + esc(subjName) + '</b></span><span>Year <b>' + S.year + '</b></span><span>Grade <b>' + esc(S.grade) + '</b></span><span>Class <b>' + esc(S.cc) + '</b></span><span>Term <b>' + (S.ap === 1 ? 'Term 1 & 2' : 'Term 3 & 4') + '</b></span><span>AP <b>AP' + S.ap + '</b></span>' +
      '<span>Teacher <b>' + esc(S.teacher) + '</b></span><span>Supervisor <b>' + esc(S.supervisor || '') + '</b></span></div>';
    if (mode && mode !== 'Marks') { el.innerHTML = hdr + xlBar('SUBJECT ASSESSMENT PERIODIC SHEET – ' + esc(S.grade) + ' – AP' + S.ap + ' is a SKILLS period') + '<p class="muted">This class is assessed with the skills checklist this period. Open <b>Checklists</b>.</p>'; return; }
    var sum = function (arr, idx) { var s = 0, n = 0; idx.forEach(function (i) { if (arr[i] != null) { s += arr[i]; n++; } }); return n ? s : null; };
    var wMax = sum(tm, wIdx), tMax = sum(tm, tIdx);
    var rows = S.students.map(function (st, k) {
      var w = sum(st.m, wIdx), t = sum(st.m, tIdx), wk = w != null && wMax ? w / wMax * wp : null, ts = t != null && tMax ? t / tMax * tp : null, tot = null;
      if (wk != null || ts != null) tot = ((wk != null ? w / wMax * S.weeklyPct : 0) + (ts != null ? t / tMax * S.testPct : 0)) / ((wk != null ? S.weeklyPct : 0) + (ts != null ? S.testPct : 0)) * 100;
      var b = tot == null ? null : bandOf(bands, tot / 100);
      return '<tr><td class="c">' + (st.no || k + 1) + '</td><td>' + esc(st.id) + '</td><td>' + esc(String(st.sur).toUpperCase()) + '</td><td>' + esc(st.name) + '</td><td class="c">' + esc(st.sex) + '</td><td class="c">' + esc(S.cc) + '</td>' +
        '<td class="c b">' + (b ? b.grade : '') + '</td><td class="c b xg">' + (tot == null ? '' : Math.round(tot)) + '</td><td class="c">' + (wk == null ? '' : Math.round(wk)) + '</td><td class="c">' + (ts == null ? '' : Math.round(ts)) + '</td>' +
        '<td class="c b xg">' + (tot == null || !max ? '' : Math.round(tot / 100 * max)) + '</td>' +
        wIdx.concat(tIdx).map(function (i) { return '<td class="c">' + (st.m[i] == null ? '' : st.m[i]) + '</td>'; }).join('') + '</tr>';
    }).join('');
    el.innerHTML = hdr + xlBar('SUBJECT ASSESSMENT PERIODIC SHEET  –  ' + esc(String(subjName).toUpperCase()) + '  –  ' + esc(S.grade) + ' ' + esc(String(S.cc).replace(/^\d/, '')) + '  –  ' + (S.ap === 1 ? 'Term 1 & 2' : 'Term 3 & 4') + ' (AP' + S.ap + ')  –  ' + S.year) +
      '<div class="wrap xw"><table class="xt2"><thead><tr><th colspan="11" class="xi">Weekly = (W1+…+Wn) ÷ Weekly Total × ' + wp + '    Test = (T1+…+Tn) ÷ Test Total × ' + tp + '    Total = Weekly + Test</th><th colspan="8" class="xd">WEEKLY MARKS (W1 – W8)</th><th colspan="8" class="xd">END-OF-TERM TESTS (T1 – T8)</th></tr>' +
      '<tr>' + ['No', 'ID#', 'Surname', 'Name', 'Sex', 'Class', 'Achieve-ment Grade', 'TOTAL (100)', 'WEEKLY (' + wp + ')', 'TESTS (' + tp + ')', 'SCORE /' + max].map(function (x) { return '<th>' + x + '</th>'; }).join('') +
      ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'].map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr>' +
      '<tr class="xmax"><td colspan="7" style="text-align:right">Maximum marks for each task ▶</td><td class="c">100</td><td class="c">' + wp + '</td><td class="c">' + tp + '</td><td class="c">' + max + '</td>' +
      wIdx.concat(tIdx).map(function (i) { return '<td class="c">' + (tm[i] == null ? '' : tm[i]) + '</td>'; }).join('') + '</tr></thead><tbody>' + rows +
      (S.students.length ? '' : '<tr><td colspan="27" class="muted">No students.</td></tr>') + '</tbody></table></div><p class="muted">Marks come from Marks Entry (online) and Excel. ' + S.students.length + ' students.</p>';
  }).catch(function (e) { el.innerHTML = '<div class="note bad">' + esc(errText(e)) + '</div>'; });
}

/* ---------------- SASS ---------------- */
function xlSass(d) {
  needClass(d);
  var g = gradeOfCc(AV.cc), names = d.subjects[g] || [], bands = asmBands(d), gm = (d.gradeMax || {})[g] || {}, max = AV.ap === 1 ? gm.max1 : gm.max2, mode = AV.ap === 1 ? gm.mode1 : gm.mode2;
  var picks = xlPick('Year', yearSel('aY', d.years, d.year)) + xlPick('Grade', '<b>' + esc(g) + '</b>') + xlPick('Class', xlClassPick(d)) + xlPick('Term', '<b>' + (AV.ap === 1 ? 'Term 1 & 2' : 'Term 3 & 4') + '</b>') + xlPick('AP No#', xlApPick()) +
    '<button class="btn" onclick="print()">' + ico('printer') + 'Print</button>';
  var h = xlFrame('chart_increasing', 'SASS – SUBJECTS ASSESSMENT SUMMARY SHEET', C.asm, picks);
  h += '<div class="xinfo"><span>Assessment Co-ordinator <b>' + esc(d.coord || '') + '</b></span><span>Class Teacher <b>' + esc(d.teachers[AV.cc] || '') + '</b></span><span>Supervisor <b>' + esc((d.supervisors || {})[AV.cc] || '') + '</b></span></div>';
  h += xlBar(esc(String(g).toUpperCase()) + ' ASSESSMENT PERIOD ' + (AV.ap === 1 ? 'ONE' : 'TWO') + '  –  ' + d.year + '  (Class ' + esc(AV.cc) + ')');
  if (!names.length || (mode && mode !== 'Marks')) return h + '<div class="xsub">SKILLS ASSESSMENT – no subject marks this period. Open Checklists.</div>';
  var list = d.students.filter(function (s) { return s.cc === AV.cc && /^active$/i.test(s.status || 'Active'); }).sort(function (a, b) { return (Number(a.no) || 999) - (Number(b.no) || 999) || a.sur.localeCompare(b.sur); });
  var sc = function (s, i) { var r = (d.reports[s.id] || {})[i + 1]; return r ? r[AV.ap - 1] : null; };   // percent per subject
  var score = function (s, i) { var p = sc(s, i); return p == null || p === '' ? null : Math.round(Number(p) / 100 * (max || 0)); };
  var tot = function (s) { var p = AV.ap === 1 ? s.ap1 : s.ap2; return p; };
  var act = list.filter(function (s) { return tot(s) != null; });
  var subTot = (max || 0) * names.length;
  var rows = list.map(function (s, k) {
    var o = '<tr><td class="c">' + (s.no || k + 1) + '</td><td>' + esc(s.id) + '</td><td>' + esc(String(s.sur).toUpperCase()) + '</td><td>' + esc(s.name) + '</td><td class="c">' + esc(s.sex) + '</td><td class="c">' + esc(String(s.cc).replace(/^\d/, '')) + '</td>';
    names.forEach(function (n, i) { var v = score(s, i), p = sc(s, i), b = p == null || p === '' ? null : bandOf(bands, Number(p) / 100); o += '<td class="c b">' + (v == null ? '' : v) + '</td><td class="c">' + (p == null || p === '' ? '' : Math.round(p) + '%') + '</td><td class="c b' + (b && b.grade === 'E' ? ' red' : '') + '">' + (b ? b.grade : '') + '</td>'; });
    var tp = tot(s), tb = tp == null ? null : bandOf(bands, tp / 100), pos = tp == null ? '' : act.filter(function (o2) { return tot(o2) > tp; }).length + 1;
    return o + '<td class="c b xdk">' + (tp == null ? '' : Math.round(tp / 100 * subTot)) + '</td><td class="c xdk">' + (tp == null ? '' : Math.round(tp) + '%') + '</td><td class="c b xdk">' + (tb ? tb.grade : '') + '</td><td class="c b xdk">' + pos + '</td></tr>';
  }).join('');
  var avgRow = '<tr class="xmax"><td colspan="6" style="text-align:right">CLASS AVERAGE</td>' + names.map(function (n, i) { var v = list.map(function (s) { return sc(s, i); }).filter(function (x) { return x != null && x !== ''; }).map(Number); var a = v.length ? v.reduce(function (p, q) { return p + q; }, 0) / v.length : null; return '<td class="c b">' + (a == null ? '' : Math.round(a / 100 * max)) + '</td><td class="c">' + (a == null ? '' : Math.round(a) + '%') + '</td><td></td>'; }).join('') +
    (function () { var v = act.map(tot); var a = v.length ? v.reduce(function (p, q) { return p + q; }, 0) / v.length : null; return '<td class="c b">' + (a == null ? '' : Math.round(a / 100 * subTot)) + '</td><td class="c">' + (a == null ? '' : Math.round(a) + '%') + '</td><td></td><td></td>'; })() + '</tr>';
  var cnt = bands.map(function (b) { return '<tr class="xcnt"><td colspan="6">No. of grade ' + esc(b.grade) + '  (' + esc(b.level) + ')</td>' + names.map(function (n, i) { return '<td colspan="3" class="c">' + list.filter(function (s) { var p = sc(s, i); var bb = p == null || p === '' ? null : bandOf(bands, Number(p) / 100); return bb && bb.grade === b.grade; }).length + '</td>'; }).join('') + '<td colspan="4" class="c b">' + act.filter(function (s) { var bb = bandOf(bands, tot(s) / 100); return bb && bb.grade === b.grade; }).length + '</td></tr>'; }).join('');
  h += '<div class="xsub">SUBJECT ASSESSMENT SUMMARY SHEET FOR ' + (AV.ap === 1 ? 'TERMS 1 AND 2' : 'TERMS 3 AND 4') + '</div><div class="wrap xw"><table class="xt2"><thead><tr><th rowspan="3">No</th><th rowspan="3">ID#</th><th rowspan="3">Surname</th><th rowspan="3">Name</th><th rowspan="3" class="xv">Sex</th><th rowspan="3" class="xv">Class</th>' +
    names.map(function (n) { return '<th colspan="3">' + esc(String(n).toUpperCase()) + '</th>'; }).join('') + '<th colspan="4" class="xdh">OVERALL</th></tr><tr>' +
    names.map(function () { return '<th class="xv">TOTAL</th><th class="xv">PERCENT</th><th class="xv">GRADING</th>'; }).join('') + '<th class="xv xdh">TOTAL</th><th class="xv xdh">PERCENT</th><th class="xv xdh">GRADE</th><th class="xv xdh">POSITION</th></tr><tr class="xmax">' +
    names.map(function () { return '<td class="c">' + (max || '') + '</td><td class="c">100%</td><td class="c">–</td>'; }).join('') + '<td class="c">' + subTot + '</td><td class="c">100%</td><td></td><td></td></tr></thead><tbody>' + rows + avgRow + cnt + '</tbody></table></div>';
  return h;
}

/* ---------------- Checklists (AWH G4–6, KSA G1–3, Skills Prep / G1 AP1) ---------------- */
function xlChecks(d) {
  needClass(d);
  var g = gradeOfCc(AV.cc), gi = g === 'Prep' ? 0 : Number(g.slice(-1)), kind = gi === 0 || (gi === 1 && AV.ap === 1) ? 'SKL' : gi <= 3 ? 'KSA' : 'AWH';
  var R = rcCalc({ setup: d.setup }), L = R.lists, groups;
  if (kind === 'AWH') groups = [['ATTITUDES', L.AWH_A, 0, 8], ['*NOTDONE'], ['LEARNING & WORKING HABITS', L.AWH_H, 8, 10]];
  else if (kind === 'KSA') groups = [['KNOWLEDGE', L.KSA_K, 0, 8], ['SKILLS', L.KSA_S, 8, 8], ['ATTITUDE', L.KSA_A, 16, 10], ['*NOTDONE'], ['LEARNING & WORKING HABITS', L.KSA_H, 26, 8]];
  else groups = [['ENGLISH', L.PRE_E, 0, 10], ['MATHEMATICS', L.PRE_M, 10, 10], ['PERSONAL & SOCIAL (PSY)', L.PRE_P, 20, 10]];
  var title = kind === 'AWH' ? 'ATTITUDES & WORK HABITS (Grades 4–6)' : kind === 'KSA' ? 'KNOWLEDGE, SKILLS & ATTITUDE (Grades 1–3)' : 'SKILLS REPORT ENTRY (Prep all year, Grade 1 AP1)';
  var picks = xlPick('Year', yearSel('aY', d.years, d.year)) + xlPick('Grade', '<b>' + esc(g) + '</b>') + xlPick('Class', xlClassPick(d)) + xlPick('Term', '<b>' + (AV.ap === 1 ? 'Term 1 & 2' : 'Term 3 & 4') + '</b>') + xlPick('AP No#', xlApPick()) +
    '<button class="btn" onclick="print()">' + ico('printer') + 'Print</button>';
  var h = xlFrame('check_mark_button', title, C.asm, picks);
  var rates = R.rates.map(function (r) { return r.code + ' = ' + r.level; }).join(',  ');
  h += '<div class="xinfo"><span>Supervisor <b>' + esc((d.supervisors || {})[AV.cc] || '') + '</b></span><span>Class/Subject Teacher <b>' + esc(d.teachers[AV.cc] || '') + '</b></span><span>Grading: <b>' + esc(rates) + '</b></span></div>';
  h += xlBar((kind === 'AWH' ? 'CHECKLIST FOR ATTENDANCE, ATTITUDES AND LEARNING/WORKING HABITS' : kind === 'KSA' ? 'CHECKLIST FOR KNOWLEDGE, SKILLS, ATTITUDE AND HABITS' : 'SKILLS REPORT') + '  –  ' + esc(g) + ' ' + esc(String(AV.cc).replace(/^\d/, '')) + '  –  ' + (AV.ap === 1 ? 'Term 1 & 2' : 'Term 3 & 4') + ' (AP' + AV.ap + ')  –  ' + d.year);
  h += '<p class="muted" style="font-style:italic;margin:4px 0">Ratings A, B, C or D are entered in the Excel checklist sheets and come here with Upload Online. Teacher comments are used on the report card.</p>';
  var list = d.students.filter(function (s) { return s.cc === AV.cc; }).sort(function (a, b) { return (Number(a.no) || 999) - (Number(b.no) || 999) || a.sur.localeCompare(b.sur); });
  var head1 = '<th rowspan="2">No</th><th rowspan="2">ID#</th><th rowspan="2">Surname</th><th rowspan="2">Name</th><th rowspan="2" class="xv">Sex</th><th rowspan="2" class="xv">Class</th><th rowspan="2" class="xv">DAYS ABSENT</th>', head2 = '';
  groups.forEach(function (gp) {
    if (gp[0] === '*NOTDONE') { head1 += '<th rowspan="2" class="xv">TOTAL ASSESSABLE TASKS NOT DONE</th>'; return; }
    head1 += '<th colspan="' + gp[3] + '" class="xd">' + gp[0] + '</th>';
    for (var i = 0; i < gp[3]; i++) head2 += '<th class="xv">' + esc(gp[1][i] || '') + '</th>';
  });
  head1 += '<th rowspan="2">Teacher comment (optional – used on report card)</th>';
  var rows = list.map(function (s, k) {
    var ck = (d.checks[s.id] || []).filter(function (c) { return c.ap === AV.ap; })[0], r = ck ? ck.r || [] : [];
    var o = '<tr><td class="c">' + (s.no || k + 1) + '</td><td>' + esc(s.id) + '</td><td>' + esc(String(s.sur).toUpperCase()) + '</td><td>' + esc(s.name) + '</td><td class="c">' + esc(s.sex) + '</td><td class="c">' + esc(String(s.cc).replace(/^\d/, '')) + '</td><td class="c">' + (ck ? esc(ck.days === '' ? 0 : ck.days) : '') + '</td>';
    groups.forEach(function (gp) {
      if (gp[0] === '*NOTDONE') { o += '<td class="c">' + (ck ? esc(ck.notDone === '' || ck.notDone == null ? 0 : ck.notDone) : '') + '</td>'; return; }
      for (var i = 0; i < gp[3]; i++) o += '<td class="c b">' + esc(gp[1][i] ? r[gp[2] + i] || '' : '') + '</td>';
    });
    return o + '<td style="font-size:11px">' + esc(ck ? ck.comment : '') + '</td></tr>';
  }).join('');
  return h + '<div class="wrap xw"><table class="xt2 xck"><thead><tr>' + head1 + '</tr><tr>' + head2 + '</tr></thead><tbody>' + rows + (list.length ? '' : '<tr><td colspan="40" class="muted">No students.</td></tr>') + '</tbody></table></div>';
}

/* ---------------- Student database ---------------- */
function xlStudentDb(d) {
  var picks = xlPick('Year', yearSel('aY', d.years, d.year)) + xlPick('Class', xlClassPick(d, true)) + xlPick('Search', '<input id="aQ" value="' + esc(AV.q) + '" placeholder="Name or ID">') + '<button class="btn" onclick="print()">' + ico('printer') + 'Print</button>';
  var q = AV.q.toLowerCase(), list = d.students.filter(function (s) { return (AV.cc === 'ALL' || s.cc === AV.cc) && (!q || (s.sur + ' ' + s.name + ' ' + s.id).toLowerCase().indexOf(q) >= 0); })
    .sort(function (a, b) { return (d.classes.indexOf(a.cc) - d.classes.indexOf(b.cc)) || a.sur.localeCompare(b.sur); });
  return xlFrame('card_index', 'STUDENT DATABASE', C.asm, picks) + xlBar('STUDENT DATABASE  –  ' + d.year + (AV.cc !== 'ALL' ? '  –  ' + esc(AV.cc) : '  –  ALL CLASSES') + '  (' + list.length + ' students)') +
    '<div class="wrap xw"><table class="xt2"><thead><tr>' + ['No', 'ID#', 'Surname', 'Name', 'Sex', 'Grade', 'Class', 'Date of Birth', 'Age', 'Church', 'Province', 'District', 'Village', 'Residence', 'Living with', 'Medical History', 'Status'].map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
    list.map(function (s, i) { var f = s.info || {}; return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(s.id) + '</td><td>' + esc(String(s.sur).toUpperCase()) + '</td><td>' + esc(s.name) + '</td><td class="c">' + esc(s.sex) + '</td><td>' + esc(s.grade) + '</td><td class="c">' + esc(String(s.cc).replace(/^\d/, '')) + '</td><td class="c">' + esc(s.dob || '') + '</td><td class="c">' + esc(f.age == null ? '' : f.age) + '</td>' +
      [f.church, f.province, f.district, f.village, f.residence, f.living, f.medical].map(function (v) { return '<td>' + esc(v || '') + '</td>'; }).join('') + '<td>' + esc(s.status) + '</td></tr>'; }).join('') + '</tbody></table></div>';
}

/* ---------------- yearly lists: Next grade, Repeat, Left, Withdrawn ---------------- */
function xlYearList(d, kind) {
  var bands = asmBands(d), T = { next: ['NEXT GRADE SELECTION LIST', 'graduation_cap'], repeat: ['REPEAT STUDENTS LIST', 'counterclockwise_arrows_button'], left: ['STUDENTS WHO LEFT SCHOOL', 'door'], withdrawn: ['STUDENTS WHO WITHDREW FROM SCHOOL', 'triangular_flag'] }[kind];
  var picks = xlPick('Year', yearSel('aY', d.years, d.year)) + xlPick('Class', xlClassPick(d, true)) + '<button class="btn" onclick="print()">' + ico('printer') + 'Print</button>';
  var list = d.students.filter(function (s) {
    if (AV.cc !== 'ALL' && s.cc !== AV.cc) return false;
    if (kind === 'next') return /promote/i.test(s.result); if (kind === 'repeat') return /repeat/i.test(s.result);
    if (kind === 'left') return /left/i.test(s.status); return /withdraw/i.test(s.status);
  }).sort(function (a, b) { return (d.classes.indexOf(a.cc) - d.classes.indexOf(b.cc)) || a.sur.localeCompare(b.sur); });
  var pm = d.passMark <= 1 ? Math.round(d.passMark * 100) + '%' : d.passMark;
  var nextG = function (g) { if (g === 'Prep') return 'Grade 1'; var n = Number(String(g).slice(-1)); return n >= 6 ? 'Grade 7 (Secondary)' : 'Grade ' + (n + 1); };
  var cols = kind === 'next' || kind === 'repeat' ? ['No', 'ID#', 'Surname', 'Name', 'Sex', 'Grade', 'Class', 'Yearly Total', 'Cum. Max', 'Year %', 'Grade', 'Result'].concat(kind === 'next' ? ['Next Grade'] : []) : ['No', 'ID#', 'Surname', 'Name', 'Sex', 'Grade', 'Class', 'Date of Birth', 'AP1 %', 'AP2 %', 'Year %', 'Status'];
  return xlFrame(T[1], T[0], C.asm, picks) + '<div class="xinfo"><span>Pass mark / benchmark from SETUP: <b>' + pm + '</b></span></div>' + xlBar(T[0] + '  –  ' + d.year + (AV.cc !== 'ALL' ? '  –  ' + esc(AV.cc) : '')) +
    '<div class="wrap xw"><table class="xt2"><thead><tr>' + cols.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
    list.map(function (s, i) {
      var gm = (d.gradeMax || {})[s.grade] || {}, b = s.yr == null ? null : bandOf(bands, s.yr / 100);
      var base = '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(s.id) + '</td><td>' + esc(String(s.sur).toUpperCase()) + '</td><td>' + esc(s.name) + '</td><td class="c">' + esc(s.sex) + '</td><td>' + esc(s.grade) + '</td><td class="c">' + esc(String(s.cc).replace(/^\d/, '')) + '</td>';
      if (kind === 'next' || kind === 'repeat') return base + '<td class="c b">' + esc(s.ty == null ? '' : s.ty) + '</td><td class="c">' + (gm.cum || '') + '</td><td class="c">' + p1(s.yr) + '</td><td class="c b">' + (b ? b.grade : '') + '</td><td class="c b">' + esc(s.result) + '</td>' + (kind === 'next' ? '<td class="c">' + nextG(s.grade) + '</td>' : '') + '</tr>';
      return base + '<td class="c">' + esc(s.dob || '') + '</td><td class="c">' + p1(s.ap1) + '</td><td class="c">' + p1(s.ap2) + '</td><td class="c">' + p1(s.yr) + '</td><td>' + esc(s.status) + '</td></tr>';
    }).join('') + (list.length ? '' : '<tr><td colspan="13" class="muted">No students in this list.</td></tr>') + '</tbody></table></div><p class="muted">' + list.length + ' students</p>';
}

/* ---------------- Yearly transcript ---------------- */
function xlTranscript(d) {
  var pool = d.students.filter(function (s) { return AV.cc === 'ALL' || s.cc === AV.cc; }).sort(function (a, b) { return (d.classes.indexOf(a.cc) - d.classes.indexOf(b.cc)) || (Number(a.no) || 999) - (Number(b.no) || 999); });
  if (!AV.sid || !pool.some(function (s) { return s.id === AV.sid; })) AV.sid = pool.length ? pool[0].id : '';
  var st = pool.filter(function (s) { return s.id === AV.sid; })[0], bands = asmBands(d);
  var picks = xlPick('Year', yearSel('aY', d.years, d.year)) + xlPick('Class', xlClassPick(d, true)) + xlPick('Student', '<select id="aS">' + pool.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === AV.sid ? ' selected' : '') + '>' + esc(s.cc + ' · ' + (s.no ? s.no + '. ' : '') + s.sur + ' ' + s.name) + '</option>'; }).join('') + '</select>') +
    '<button class="btn" onclick="print()">' + ico('printer') + 'Print</button>';
  var h = xlFrame('memo', 'YEARLY ACADEMIC STUDENT TRANSCRIPT', C.asm, picks);
  if (!st) return h + '<p class="muted">No students.</p>';
  var gm = (d.gradeMax || {})[st.grade] || {}, names = d.subjects[st.grade] || [], rep = d.reports[st.id] || {}, f = st.info || {};
  var m1 = gm.max1 || 0, m2 = gm.max2 || 0, mt = (gm.total || (m1 + m2));
  var gr = function (v, m) { return v == null || !m ? '' : (bandOf(bands, v / m) || {}).grade; };
  var pos = function (k) { var me = st[k]; if (me == null) return '–'; var cl = d.students.filter(function (s) { return s.cc === st.cc && s[k] != null; }); return (cl.filter(function (s) { return s[k] > me; }).length + 1) + ' of ' + cl.length; };
  var T = [0, 0, 0], any = [false, false, false];
  var rows = names.map(function (n, i) {
    var r = rep[i + 1] || [null, null], a = r[0] == null || r[0] === '' ? null : Math.round(Number(r[0]) / 100 * m1), b = r[1] == null || r[1] === '' ? null : Math.round(Number(r[1]) / 100 * m2), y = a == null && b == null ? null : (a || 0) + (b || 0);
    if (a != null) { T[0] += a; any[0] = true; } if (b != null) { T[1] += b; any[1] = true; } if (y != null) { T[2] += y; any[2] = true; }
    return n ? '<tr><td class="b">' + esc(n) + '</td><td class="c">' + (a == null ? '' : a) + '</td><td class="c">' + (a == null ? '' : Math.round(a / m1 * 100) + '%') + '</td><td class="c b">' + gr(a, m1) + '</td><td class="c">' + (b == null ? '' : b) + '</td><td class="c">' + (b == null ? '' : Math.round(b / m2 * 100) + '%') + '</td><td class="c b">' + gr(b, m2) + '</td>' +
      '<td class="c">' + (y == null ? '' : y) + '</td><td class="c">' + (y == null ? '' : Math.round(y / mt * 100) + '%') + '</td><td class="c b">' + gr(y, mt) + '</td></tr>' : '';
  }).join('');
  var bg = function (p) { return p == null ? '' : (bandOf(bands, p / 100) || {}).grade; };
  h += '<div class="xsheet"><div class="xsub">' + esc(d.setup && d.setup.schoolName || 'TOM HOEY PRIMARY SCHOOL') + '<br>YEARLY ACADEMIC STUDENT TRANSCRIPT  –  ' + d.year + '</div>' +
    '<table class="xt2 xkv"><tr><td class="xl1">Student Name</td><td class="b">' + esc(String(st.sur).toUpperCase() + ' ' + st.name) + '</td><td class="xl1">ID No#</td><td>' + esc(st.id) + '</td></tr>' +
    '<tr><td class="xl1">Date of Birth</td><td>' + esc(st.dob || '') + '</td><td class="xl1">Sex</td><td>' + esc(st.sex) + '</td></tr>' +
    '<tr><td class="xl1">Grade / Class</td><td>' + esc(st.grade + '  /  ' + st.cc) + '</td><td class="xl1">Status</td><td>' + esc(st.status) + '</td></tr>' +
    '<tr><td class="xl1">Village / District</td><td>' + esc((f.village || '') + (f.district ? ', ' + f.district : '')) + '</td><td class="xl1">Living with</td><td>' + esc(f.living || '') + '</td></tr></table><div class="gap"></div>' +
    '<table class="xt2"><thead><tr><th rowspan="2">SUBJECT</th><th colspan="3" class="xd">ASSESSMENT PERIOD ONE (T1 &amp; T2)</th><th colspan="3" class="xd">ASSESSMENT PERIOD TWO (T3 &amp; T4)</th><th colspan="3" class="xdh">YEARLY RESULT</th></tr>' +
    '<tr><th>Score</th><th>%</th><th>Grade</th><th>Score</th><th>%</th><th>Grade</th><th>Score</th><th>%</th><th>Grade</th></tr><tr class="xmax"><td>Maximum</td><td class="c">' + m1 + '</td><td></td><td></td><td class="c">' + m2 + '</td><td></td><td></td><td class="c">' + mt + '</td><td></td><td></td></tr></thead><tbody>' + rows +
    '<tr class="xtot"><td>TOTAL</td><td class="c">' + (any[0] ? T[0] : '') + '</td><td class="c">' + p1(st.ap1) + '</td><td class="c">' + bg(st.ap1) + '</td><td class="c">' + (any[1] ? T[1] : '') + '</td><td class="c">' + p1(st.ap2) + '</td><td class="c">' + bg(st.ap2) + '</td><td class="c">' + (any[2] ? T[2] : '') + '</td><td class="c">' + p1(st.yr) + '</td><td class="c">' + bg(st.yr) + '</td></tr>' +
    '<tr><td class="b">Position in class</td><td colspan="3" class="c">' + pos('ap1') + '</td><td colspan="3" class="c">' + pos('ap2') + '</td><td colspan="3" class="c">' + pos('yr') + '</td></tr>' +
    '<tr><td class="b">Days absent</td><td colspan="3" class="c">' + esc(st.abs1 == null ? '' : st.abs1) + '</td><td colspan="3" class="c">' + esc(st.abs2 == null ? '' : st.abs2) + '</td><td colspan="3" class="c">' + ((Number(st.abs1) || 0) + (Number(st.abs2) || 0)) + '</td></tr></tbody></table>' +
    xlBar('YEARLY RESULT') + '<div class="xres">' + esc(st.result ? st.result + (/promote/i.test(st.result) ? ' – to ' + (st.grade === 'Prep' ? 'Grade 1' : 'Grade ' + (Number(st.grade.slice(-1)) + 1)) : '') : '–') + '</div>' +
    '<p style="margin-top:14px">Remarks: ______________________________________________________________</p>' +
    '<table class="foot2"><tr><td>Class Teacher:</td><td class="b">' + esc(d.teachers[st.cc] || '') + '</td><td>Signature:</td><td class="ln"></td></tr><tr><td>Head Teacher:</td><td class="b">' + esc(d.headTeacher || 'Mr Saun Aloksep') + '</td><td>Signature:</td><td class="ln"></td></tr>' +
    '<tr><td>Date issued:</td><td>' + new Date().toLocaleDateString('en-AU') + '</td><td>School stamp:</td><td class="ln"></td></tr></table></div>';
  return h;
}
var XLV = { saps: xlSaps, sass: xlSass, checks: xlChecks, studentdb: xlStudentDb, transcript: xlTranscript,
  next: function (d) { return xlYearList(d, 'next'); }, repeat: function (d) { return xlYearList(d, 'repeat'); }, left: function (d) { return xlYearList(d, 'left'); }, withdrawn: function (d) { return xlYearList(d, 'withdrawn'); } };

/* ------------------------------------------------------------------ MESSAGES & THIS WEEK'S SCHEDULE (notifications) */
var MSG = { d: null, unread: 0, timer: null };
function msgAuth() { return AUTH && AUTH.user ? AUTH : MA(); }
function weekGrid(w) {
  if (!w) return '';
  var start = new Date(w.from + 'T00:00:00'), t = today(), out = '';
  for (var k = 0; k < 2; k++) {
    out += '<div class="muted" style="font-size:12px;font-weight:700;margin:6px 0 3px">' + (k === 0 ? 'THIS WEEK' : 'NEXT WEEK') + '</div><div class="wk">';
    for (var i = 0; i < 7; i++) {
      var d = new Date(start.getTime() + (k * 7 + i) * 864e5), ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      var ev = w.events.filter(function (e) { return e.date <= ds && (e.end || e.date) >= ds; });
      out += '<div class="' + (ds === t ? 'today' : '') + '"><b>' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] + ' ' + d.getDate() + '/' + (d.getMonth() + 1) + '</b>' + ev.map(function (e) { return '<span title="' + esc(e.notes) + '">' + esc(e.title) + '</span>'; }).join('') + '</div>';
    }
    out += '</div>';
  }
  return out;
}
function msgCard(m) {
  return '<div class="msg' + (m.read ? '' : ' unread') + '" style="--c:' + (m.mine ? '#7A4E2D' : '#2F5597') + '"><h4>' + ico('envelope_with_arrow') + esc(m.title) + (m.read ? '' : ' <span class="tag new">new</span>') + '</h4>' +
    '<div class="meta">From <b>' + esc(m.fromName || m.from) + '</b> to <b>' + esc(m.to) + '</b> · ' + fmtDate(m.date) + '</div><p>' + esc(m.body) + '</p>' +
    (m.mine || (ME && ME.admin) ? '<div style="text-align:right"><button class="btn" data-mdel="' + esc(m.key) + '" style="padding:4px 10px;font-size:12px">' + ico('wastebasket') + 'Delete</button></div>' : '') + '</div>';
}
function setBadge(n) {
  MSG.unread = n;
  var b = $('.nav[data-p="messages"]');
  if (b) { var x = $('.badge', b); if (x) x.remove(); if (n) b.insertAdjacentHTML('beforeend', '<span class="badge">' + n + '</span>'); }
}
function checkMessages(first) {
  if (!MAIN) return Promise.resolve();
  return call('apiMessages', msgAuth()).then(function (d) {
    var before = MSG.d ? MSG.d.messages.filter(function (m) { return !m.read; }).map(function (m) { return m.key; }) : null;
    MSG.d = d; ls(ckey('msgs'), d); setBadge(d.unread);
    if ($('#homeMsg')) { $('#homeMsg').innerHTML = homeMsgPanel(); $$('#homeMsg [data-go]').forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; }); }
    var fresh = d.messages.filter(function (m) { return !m.read && (!before || before.indexOf(m.key) < 0); });
    if (fresh.length && (first || before)) {
      toast(fresh.length === 1 ? 'New message: ' + fresh[0].title : 'You have ' + fresh.length + ' new messages');
      try { if (!first && window.Notification && Notification.permission === 'granted') new Notification('THPS School Manager', { body: fresh.map(function (m) { return m.title; }).join('\n'), icon: 'img/app-192.png' }); } catch (e) {}
    }
  }).catch(function () { var c = ls(ckey('msgs')); if (c) { MSG.d = c; setBadge(c.unread); } });
}
function startMessages() { if (MSG.timer) clearInterval(MSG.timer); checkMessages(true); MSG.timer = setInterval(function () { checkMessages(false); }, 4 * 60000); }
function pageMessages() {
  var draw = function (d) {
    var unread = d.messages.filter(function (m) { return !m.read; }).map(function (m) { return m.key; });
    var h = head('envelope_with_arrow', 'Messages & This Week', 'Messages', 'Messages from the Head Teacher and staff, and the term dates, events and duties for this week and next. ' + (d._offline ? '<span style="color:#b35c00">Offline copy.</span>' : ''));
    var main = '<div class="panel" style="--c:#2F5597"><h3>' + ico('spiral_calendar') + 'This week\'s schedule</h3>' + weekGrid(d.week) + '<p class="muted" style="font-size:12px;margin:6px 0 0">Add term dates, events and duties in <b>Admin Routines</b>.</p></div>';
    main += '<div class="bar"><button class="btn pri" id="mNew">' + ico('plus') + 'New message</button><button class="btn" id="mBell">' + ico('warning') + 'Notifications on this device</button><span class="muted">' + d.messages.length + ' messages · ' + unread.length + ' new</span></div>';
    main += d.messages.length ? d.messages.map(msgCard).join('') : '<p class="muted">No messages yet.</p>';
    var side = '<div class="panel" style="--c:#2F5597"><h3>' + ico('clipboard') + 'Summary</h3>' + kvTable([['Signed in as', esc(d.name || d.user)], ['New messages', unread.length], ['All messages', d.messages.length], ['Events this week', d.week ? d.week.events.filter(function (e) { return e.date < new Date(new Date(d.week.from).getTime() + 7 * 864e5).toISOString().slice(0, 10); }).length : 0]]) + '</div>' +
      shortcuts([['data-go="Events"', 'spiral_calendar', 'Admin Routines'], ['data-go="home"', 'house', 'Main Home'], ['onclick="print()"', 'printer', 'Print']], '#2F5597');
    $('#page').innerHTML = h + lay(side, main);
    $$('[data-go]').forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; });
    $('#mNew').onclick = function () { msgForm(d); };
    $('#mBell').onclick = function () {
      if (!window.Notification) return toast('This browser cannot show notifications. Messages still show here with a red number.', 1);
      Notification.requestPermission().then(function (p) { toast(p === 'granted' ? 'Notifications are on for this device.' : 'Notifications are off. Messages still show here.'); });
    };
    $$('[data-mdel]').forEach(function (b) { b.onclick = function () { if (!confirm('Delete this message for everyone?')) return; call('apiDeleteMessage', msgAuth(), b.dataset.mdel).then(function () { toast('Deleted'); pageMessages(); }).catch(function (e) { toast(errText(e), 1); }); }; });
    if (unread.length && !d._offline) call('apiReadMessages', msgAuth(), unread).then(function () { setBadge(0); if (MSG.d) MSG.d.messages.forEach(function (m) { m.read = true; }); }).catch(function () {});
  };
  load('msgs', 'apiMessages', msgAuth()).then(function (d) { MSG.d = d; draw(d); }).catch(function (e) { $('#page').innerHTML = '<div class="note bad">' + esc(errText(e)) + '</div>'; });
}
function msgForm(d) {
  formModal('New message', 'envelope_with_arrow', [['to', 'Send to', d.to, 1], ['title', 'Title', 'text', 1], ['body', 'Message', 'area', 1], ['email', 'Also send by email', ['No', 'Yes']]], { to: 'Teachers', email: 'Yes' }, {
    canWrite: true, note: 'Everyone it is sent to sees it with a red number when they open the School Manager. Email goes to staff who have an email address in Teachers › Staff details.',
    onSave: function (o) {
      call('apiPostMessage', msgAuth(), { to: o.to, title: o.title, body: o.body, email: o.email === 'Yes', key: 'M' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) })
        .then(function (r) { toast('Message sent' + (r.emailed ? ' – emailed to ' + r.emailed : '')); pageMessages(); })
        .catch(function (e) { toast(errText(e) === 'No network' ? 'Sending a message needs the internet.' : 'Not sent: ' + errText(e), 1); });
    }
  });
}
function homeMsgPanel() {
  var d = MSG.d || ls(ckey('msgs'));
  if (!d) return '<div class="panel" style="--c:#2F5597"><h3>' + ico('envelope_with_arrow') + 'Messages &amp; this week</h3><p class="muted">Loading…</p></div>';
  var t = today(), wk = d.week ? d.week.events.filter(function (e) { return (e.end || e.date) >= t; }).slice(0, 4) : [];
  return '<div class="panel" style="--c:#2F5597"><h3>' + ico('envelope_with_arrow') + 'Messages &amp; this week' + (d.unread ? '<span class="badge">' + d.unread + '</span>' : '') + '</h3>' +
    (d.messages.slice(0, 3).map(function (m) { return '<div style="border-bottom:1px solid #e1e4e8;padding:5px 0' + (m.read ? '' : ';font-weight:700') + '">' + esc(m.title) + '<br><small class="muted">' + esc(m.fromName || m.from) + ' · ' + fmtDate(m.date) + '</small></div>'; }).join('') || '<p class="muted">No messages.</p>') +
    '<div class="muted" style="font-size:12px;font-weight:700;margin-top:8px">THIS WEEK</div>' + (wk.length ? wk.map(function (e) { return '<div style="font-size:13px">' + fmtDate(e.date) + ' – <b>' + esc(e.title) + '</b></div>'; }).join('') : '<p class="muted" style="margin:2px 0">Nothing listed.</p>') +
    '<button class="btn" data-go="messages" style="margin-top:8px">' + ico('envelope_with_arrow') + 'Open messages</button></div>';
}

/* ------------------------------------------------------------------ type an ID (or a name) and the rest fills in */
var PEOPLE = null;
function loadPeople() {
  if (PEOPLE) return Promise.resolve(PEOPLE);
  return load('people', 'apiPeople', MA()).then(function (d) { PEOPLE = d.people || []; return PEOPLE; }).catch(function () { return []; });
}
function personText(p) { return p.t === 'S' ? p.name + ' - ' + p.cc + ' (' + p.id + ')' : p.name + (p.cc ? ' - ' + p.cc : '') + (p.id ? ' (' + p.id + ')' : ''); }
function attachPeople(root) {
  var inputs = $$('[data-f="Person"],[data-f="People"],[data-f="ReportedBy"],[data-f="Payee"],[data-f="Name"]', root).filter(function (el) { return el.tagName === 'INPUT'; });
  if (!inputs.length) return;
  loadPeople().then(function (list) {
    if (!list.length) return;
    if (!$('#peopleList')) { var dl = document.createElement('datalist'); dl.id = 'peopleList'; document.body.appendChild(dl); }
    $('#peopleList').innerHTML = list.map(function (p) { return '<option value="' + esc(p.id + ' — ' + p.name + (p.cc ? ' (' + p.cc + ')' : '')) + '">' + (p.t === 'S' ? 'Student' : 'Teacher') + '</option>'; }).join('');
    inputs.forEach(function (el) {
      el.setAttribute('list', 'peopleList'); el.setAttribute('autocomplete', 'off');
      if (!el.placeholder) el.placeholder = 'Type an ID or a name';
      el.addEventListener('change', function () {
        var v = el.value.trim(), id = v.split(' — ')[0].toUpperCase();
        var p = list.filter(function (x) { return String(x.id).toUpperCase() === id; })[0] || list.filter(function (x) { return x.name.toLowerCase() === v.toLowerCase(); })[0];
        if (p) { el.value = personText(p); el.style.background = '#eef8f1'; }
      });
    });
  });
}

/* ------------------------------------------------------------------ boot */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
if (MAIN && MAIN.t) {
  var cached = ls(ckey('dash'));
  call('apiDashboard', MA()).then(function (d) { ls(ckey('dash'), d); start(d); })
    .catch(function (e) { if (isAuth(e)) return signOut(errText(e)); if (cached) { cached._offline = true; start(cached); } else showLogin('Cannot reach the school database (' + errText(e) + ').'); });
} else showLogin();
window.THPS = { version: VERSION, go: go };
})();
