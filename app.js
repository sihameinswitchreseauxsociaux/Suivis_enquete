'use strict';
/* =====================================================================
   Enquêtes – carnet d'indices. 100 % local : aucune requête réseau.
   Données : IndexedDB du navigateur (PDF + progression).
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
  return e;
}
const IC = {
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
  hl: '<path d="M14.5 4.5l5 5-8.5 8.5H6v-5z"/><path d="M4 21h16"/>',
  cross: '<path d="M5 5l14 14M19 5L5 19"/>',
  brush: '<path d="M4 20l1-5L16 4l4 4L9 19z"/>',
  erase: '<path d="M3 17l8-10 8 8-4 4H7z"/><path d="M12 19h8"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  check: '<path d="M5 12l5 5 9-10"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  more: '<path d="M12 5h.01M12 12h.01M12 19h.01" stroke-width="3"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  half: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8 8l12 10M8 16L20 6"/>',
  merge: '<path d="M12 4v10M7 9l5-5 5 5M5 20h14"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  spin: '<path d="M12 3a9 9 0 019 9"/>',
  pencil: '<path d="M4 20l1-5L16 4l4 4L9 19z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>'
};
const ic = (n, s) => { const e = h('span', { html: `<svg class="i" viewBox="0 0 24 24"${s ? ` style="width:${s}px;height:${s}px"` : ''}>${IC[n]}</svg>` }); e.style.display = 'contents'; return e; };
IC.grip = '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3.5"/>';
IC.pgoff = '<path d="M6 3h9l4 4v14H6z"/><path d="M3 3l18 18"/>';
IC.note = '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>';
const PALETTE = ['#e6194b', '#4363d8', '#3cb44b', '#f58231', '#911eb4', '#46d2e6', '#ffe119', '#f032e6', '#9a6324', '#a8d81f'];
const DEF = { autosave: true, backupDays: 7, exportMode: 'download', sort: { k: 'import', dir: 'asc' }, eraseMode: 'el', eraseR: 16, shape: 'cross', custom: null, hlOp: 0.5, sens: 1, scroll: 'v', thick: 0.012, brushW: 0.006, hide: { hl: false, col: false, cross: false, brush: false, erase: false, undo: false, save: false, page: false, notes: false, pgoff: false }, seenVer: '', showPend: true, hidePend: [], remind: true, wizAsked: false, ui: { order: ['clue', 'vp', 'tools', 'nav'], scale: 1, cmh: 112, ctlLeft: false, sideRight: false, compact: false }, welcome: { name: 'enquêteur', sub: 'Sauras-tu trouver qui est le coupable ?' } };

const S = { db: null, books: [], cur: null, doc: null, settings: null, tool: null, undo: [], sel: null, optsOpen: false, lastCol: PALETTE[0] };

/* ---------------------------------------------------------------- toasts & modales */
let toastT;
function toast(msg, ms = 2200) {
  let t = $('#toast'); if (!t) { t = h('div', { id: 'toast' }); document.body.append(t); }
  t.textContent = msg; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', ms);
}
function openModal(title, body, btns, opts = {}) {
  const ov = h('div', { class: 'modal' + (opts.full ? ' full' : '') });
  const api = { el: ov, close: v => { ov.remove(); api.res && api.res(v); opts.onclose && opts.onclose(); } }; ov._api = api; ov._noclose = !!opts.noclose;
  api.promise = new Promise(r => api.res = r);
  ov.append(h('div', { class: 'box' },
    h('div', { class: 'mh' }, h('b', {}, title), opts.noclose ? h('span') : h('button', { onclick: () => api.close(null), 'aria-label': 'Fermer' }, ic('close'))),
    h('div', { class: 'mb' }, body),
    btns && btns.length ? h('div', { class: 'mf' }, btns.map(b => h('button', { class: 'btn ' + (b.cls || ''), onclick: async () => { if (b.fn) { const r = await b.fn(api); if (r === false) return; } api.close(b.value); } }, b.label))) : null));
  if (!opts.full) ov.addEventListener('pointerdown', e => { if (e.target === ov) api.close(null); });
  document.body.append(ov);
  return api;
}
const ask = (title, text, btns) => openModal(title, h('div', {}, text), btns).promise;
const confirmBox = (title, text, yes = 'Confirmer', cls = 'pri') => ask(title, text, [{ label: 'Annuler', value: false }, { label: yes, value: true, cls }]);

/* ---------------------------------------------------------------- IndexedDB */
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('enquetes', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('books', { keyPath: 'id' }); d.createObjectStore('files'); d.createObjectStore('kv'); d.createObjectStore('pending'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function tx(store, mode, fn) {
  return new Promise((res, rej) => {
    const t = S.db.transaction(store, mode); let out;
    const rq = fn(t.objectStore(store)); if (rq) rq.onsuccess = () => out = rq.result;
    t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error);
  });
}
const dbGet = (s, k) => tx(s, 'readonly', st => st.get(k));
const dbPut = (s, v, k) => tx(s, 'readwrite', st => k === undefined ? st.put(v) : st.put(v, k));
const dbDel = (s, k) => tx(s, 'readwrite', st => st.delete(k));
const dbAll = s => tx(s, 'readonly', st => st.getAll());

async function loadSettings() {
  const s = await dbGet('kv', 'settings');
  S.settings = Object.assign(structuredClone(DEF), s || {});
  S.settings.hide = Object.assign({}, DEF.hide, (s && s.hide) || {});
  applyHide();
}
const saveSettings = () => dbPut('kv', JSON.parse(JSON.stringify(S.settings)), 'settings').catch(console.error);
const HIDE_ITEMS = [['hl', 'Surligner', ''], ['col', 'Couleur', 'Bouton de changement de couleur'], ['cross', 'Barrer', ''], ['brush', 'Pinceau', ''], ['erase', 'Gomme', ''], ['undo', 'Annuler', ''],
  ['save', 'Enregistrer', 'Icône d’enregistrement (le mode automatique continue de fonctionner)'], ['page', 'Page', 'Flèches et numéro de page (on peut toujours faire défiler)'],
  ['notes', 'Notes', 'Bouton notes et affichage des notes sous l’indice'], ['pgoff', 'Masquer des pages', 'Désactivé : toutes les pages s’affichent']];
const HIDE_KEYS = ['hl', 'col', 'cross', 'brush', 'erase', 'undo', 'save', 'page', 'notes', 'pgoff'];
const UI_KEYS = ['clue', 'vp', 'tools', 'nav'];
function normUI() {
  const u = Object.assign({}, DEF.ui, S.settings.ui || {});
  if (!Array.isArray(u.order) || u.order.length !== 4 || UI_KEYS.some(k => !u.order.includes(k))) u.order = [...DEF.ui.order];
  u.scale = clamp(+u.scale || 1, 0.8, 1.6); u.cmh = clamp(+u.cmh || 112, 70, 320); S.settings.ui = u; return u;
}
function applyUI() {
  const u = normUI(), root = document.documentElement.style; document.body.classList.toggle('compact', !!u.compact);
  root.setProperty('--ctxs', u.scale); root.setProperty('--cmh', u.cmh + 'px');
  const r = document.querySelector('#reader'); if (!r || !r.querySelector('#bar')) return;
  const map = { clue: '#cluebar', vp: '#vp', tools: '#bar .row.a', nav: '#bar .row.b' }, def = u.order.join() === UI_KEYS.join();
  r.classList.toggle('ui-custom', !def);
  ['#cluebar', '#vp', '#opts', '#bar .row.a', '#bar .row.b'].forEach(s => { const e = r.querySelector(s); if (e) e.style.order = ''; });
  if (!def) { u.order.forEach((k, i) => { const e = r.querySelector(map[k]); if (e) e.style.order = (i + 1) * 10; }); const o = r.querySelector('#opts'); if (o) o.style.order = (u.order.indexOf('tools') + 1) * 10 + 1; }
  const cb = r.querySelector('#cluebar'); if (cb) { cb.classList.toggle('ctl-left', !!u.ctlLeft); cb.classList.toggle('side-right', !!u.sideRight); }
}
function applyHide() {
  applyUI();
  const hd = S.settings.hide, cl = document.body.classList;
  for (const k of HIDE_KEYS) cl.toggle('h-' + k, !!hd[k]);
  cl.toggle('h-tools', ['hl', 'col', 'cross', 'brush', 'erase', 'undo'].every(k => hd[k]));
  cl.toggle('h-side', !!hd.notes && !!hd.pgoff);
  const bar = document.querySelector('#bar'); if (!bar) return;
  /* si la rangée du bas se vide (page masquée), Menu et Enregistrer montent sur la rangée des outils quand il y a la place */
  const ra = bar.querySelector('.row.a'), rb = bar.querySelector('.row.b'), mb = document.querySelector('#mbtn'), sv = document.querySelector('#sv');
  const nT = ['hl', 'col', 'cross', 'brush', 'erase', 'undo'].filter(k => !hd[k]).length;
  const merge = !!hd.page && nT > 0 && nT + (hd.save ? 0 : 1) + 1 <= 6;
  if (mb && sv && ra && rb) { if (merge) ra.append(sv, mb); else { rb.prepend(sv); rb.append(mb); } mb.classList.toggle('tb', merge); rb.style.display = merge ? 'none' : ''; }
  if (S.cur) {
    if (S.tool && hd[S.tool]) { S.tool = null; S.optsOpen = false; S.sel = null; V.redrawAll(); updateToolUI(); }
    V.refreshHidden(); pagesUI();
  }
}

/* ---------------------------------------------------------------- sauvegarde */
const SV = { state: 'saved', timer: null };
function setSave(st) {
  SV.state = st; const e = $('#sv'); if (!e) return;
  e.className = st; const lab = { saved: 'Enregistré', saving: 'Enregistrement…', error: 'Échec – toucher', dirty: 'Non enregistré' }[st];
  const icon = { saved: 'check', saving: 'spin', error: 'warn', dirty: 'more' }[st];
  e.innerHTML = ''; const w = h('span', { html: `<svg class="i ${st === 'saving' ? 'spin' : ''}" viewBox="0 0 24 24">${IC[icon]}</svg>` }); w.style.display = 'contents';
  e.append(w, h('span', {}, lab));
}
function changed(silent) {
  if (!S.cur) return;
  if (S.settings.autosave) { if (!silent) setSave('saving'); clearTimeout(SV.timer); SV.timer = setTimeout(() => doSave(silent), silent ? 1200 : 300); }
  else setSave('dirty');
}
async function doSave(silent) {
  clearTimeout(SV.timer); if (!S.cur) return true;
  if (!silent) setSave('saving');
  try { S.cur.updatedAt = Date.now(); await dbPut('books', JSON.parse(JSON.stringify(S.cur))); if (SV.state !== 'dirty' || !silent) setSave('saved'); return true; }
  catch (e) { console.error(e); setSave('error'); return false; }
}
async function manualSave() { const ok = await doSave(); toast(ok ? 'Progression enregistrée ✓' : 'Échec de l’enregistrement – réessayez ou exportez une sauvegarde'); }
function flushNow() { if (S.cur && S.settings && S.settings.autosave && (SV.state === 'saving' || SV.timer)) doSave(true); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { V.savePos(); flushNow(); } });
addEventListener('pagehide', () => { V.savePos(); flushNow(); });

/* ---------------------------------------------------------------- utilitaires PDF */
async function hashBuf(buf) {
  if (crypto.subtle) { const d = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(d)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(''); }
  let a = 5381, v = new Uint8Array(buf); for (let i = 0; i < v.length; i += 7) a = ((a << 5) + a + v[i]) | 0; return 'h' + (a >>> 0).toString(16) + v.length;
}
async function renderThumb(doc, n, width) {
  const pg = await doc.getPage(n); const b = pg.getViewport({ scale: 1 }); const vp = pg.getViewport({ scale: width / b.width });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; return c;
}
const cleanTitle = n => n.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim() || 'Enquête';

/* ---------------------------------------------------------------- accueil */
function statusIcon(st) { return h('div', { class: 'st ' + st }, ic(st === 'done' ? 'check' : st === 'doing' ? 'half' : 'circle')); }
const STORD = { new: 0, doing: 1, done: 2 };
const monthYear = ts => { if (!ts) return ''; try { return new Date(ts).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
function sortedBooks() {
  const { k, dir } = S.settings.sort || DEF.sort; const m = dir === 'desc' ? -1 : 1;
  const cmp = { name: (a, b) => a.title.localeCompare(b.title, 'fr', { numeric: true, sensitivity: 'base' }), import: (a, b) => (a.addedAt || 0) - (b.addedAt || 0), state: (a, b) => (STORD[a.status] ?? 0) - (STORD[b.status] ?? 0) || (a.addedAt || 0) - (b.addedAt || 0) }[k] || (() => 0);
  return [...S.books].sort((a, b) => m * cmp(a, b));
}
const welcomeName = () => ((S.settings.welcome && S.settings.welcome.name) || '').trim() || DEF.welcome.name;
function renderHome() {
  const home = $('#home'); home.innerHTML = '';
  const last = [...S.books].sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))[0];
  const so = S.settings.sort || DEF.sort;
  const chip = (k, label) => h('button', { class: 'chip' + (so.k === k ? ' on' : ''), onclick: () => { S.settings.sort = { k, dir: so.k === k ? (so.dir === 'asc' ? 'desc' : 'asc') : 'asc' }; saveSettings(); renderHome(); } }, label, so.k === k ? h('span', { class: 'arr' }, so.dir === 'asc' ? ' ↑' : ' ↓') : null);
  const grid = h('div', { class: 'grid' },
    h('div', { class: 'tile add', onclick: () => { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { } $('#file').click(); } },
      h('div', { class: 'plus' }, '+'), h('span', {}, 'Ouvrir un nouveau dossier')),
    sortedBooks().map(b => h('div', { class: 'tile', onclick: () => openBook(b.id) },
      b.cover ? h('img', { src: b.cover, alt: '' }) : null,
      b.addedAt ? h('div', { class: 'dt' }, monthYear(b.addedAt)) : null,
      h('div', { class: 'more', onclick: e => { e.stopPropagation(); bookMenu(b); } }, ic('more', 18)),
      h('div', { class: 'cap' }, h('div', { class: 't' }, h('b', {}, b.title), b.status === 'done' && b.culprit ? h('small', {}, 'Coupable : ' + b.culprit) : h('small', {}, { new: 'Pas commencée', doing: 'En cours', done: 'Terminée' }[b.status])), statusIcon(b.status)))),
    pendTiles(),
    S.books.length ? null : h('div', { class: 'empty' }, 'Aucun dossier pour l’instant. Touchez « + » pour ouvrir le PDF d’une enquête.'));
  home.append(...[h('div', { class: 'top' }, h('h1', {}, S.firstRun ? `Bienvenue ${welcomeName()} 🔎` : `Bon retour ${welcomeName()} 🕵️`), (S.settings.welcome.sub || '').trim() ? h('p', { class: 'sub' }, S.settings.welcome.sub.trim()) : null),
    ...homeBanners(),
    S.books.length > 1 ? h('div', { class: 'sortbar' }, h('span', {}, 'Trier :'), chip('name', 'Nom'), chip('import', 'Import'), chip('state', 'État')) : null, grid,
    h('div', { class: 'bbar' },
      h('button', { class: 'nb on' }, ic('home'), h('span', {}, 'Accueil')),
      h('button', { class: 'nb', onclick: () => last ? openBook(last.id) : toast('Aucune enquête à reprendre') }, ic('play'), h('span', {}, last ? 'Reprendre : ' + last.title : 'Reprendre')),
      h('button', { class: 'nb', onclick: openSettings }, ic('gear'), h('span', {}, 'Paramètres')))].filter(Boolean));
}
function bookMenu(b) {
  const m = openModal(b.title, h('div', {}), [
    { label: 'Renommer', fn: async () => { const i = h('input', { type: 'text', value: b.title }); const r = await openModal('Renommer', i, [{ label: 'Annuler', value: false }, { label: 'OK', value: true, cls: 'pri' }]).promise; if (r && i.value.trim()) { b.title = i.value.trim(); await dbPut('books', JSON.parse(JSON.stringify(b))); renderHome(); } } },
    { label: 'Recommencer', fn: async () => { if (await confirmBox('Recommencer ?', 'Surlignages, croix et avancement de cette enquête seront effacés (les indices détectés sont conservés).', 'Recommencer', 'bad')) { resetBook(b); await dbPut('books', JSON.parse(JSON.stringify(b))); renderHome(); } } },
    { label: 'Supprimer', cls: 'bad', fn: async () => { if (await confirmBox('Supprimer ?', 'Le PDF et la progression seront supprimés de cet appareil.', 'Supprimer', 'bad')) { await dbDel('books', b.id); await dbDel('files', b.id); S.books = S.books.filter(x => x.id !== b.id); renderHome(); } } }]);
}
function normNotes(b) {
  if (typeof b.notes === 'string') b.notes = b.notes.trim() ? [{ id: uid(), text: b.notes }] : []; if (!Array.isArray(b.notes)) b.notes = [];
  b.pinNote = null; b.notes = b.notes.filter(n => n && typeof n.text === 'string'); if (!Array.isArray(b.disabled)) b.disabled = [];
}
function resetBook(b) { b.ann = []; b.clueIdx = 0; b.status = 'new'; b.culprit = ''; b.pos = null; b.attempts = []; }

async function addBooks(files) {
  for (const f of files) {
    try {
      toast('Chargement de « ' + f.name + ' »…', 8000);
      const buf = await f.arrayBuffer(); const id = await hashBuf(buf);
      if (S.books.find(b => b.id === id)) { toast('Cette enquête est déjà dans la bibliothèque'); continue; }
      const doc = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      const c = await renderThumb(doc, 1, 420); const cover = c.toDataURL('image/jpeg', 0.8);
      const url = '';
      const book = { id, title: cleanTitle(f.name), addedAt: Date.now(), lastOpened: 0, status: 'new', culprit: '', officialUrl: url, numPages: doc.numPages, cover, clues: [], clueIdx: 0, cluePage: null, clueRect: null, notes: [], pinNote: null, disabled: [], linkDone: false, ann: [], crossSize: null, crossTh: null, pos: null, attempts: [] };
      const pend = await dbGet('pending', id); if (pend) { Object.assign(book, pend, { id, cover, numPages: doc.numPages }); normNotes(book); await dbDel('pending', id); }
      await dbPut('files', new Blob([buf], { type: 'application/pdf' }), id);
      await dbPut('books', JSON.parse(JSON.stringify(book))); S.books.push(book);
      doc.destroy(); toast('Enquête ajoutée ✓');
    } catch (e) { console.error(e); toast('Impossible de lire ce PDF'); }
  }
  await refreshPend(); renderHome();
}

/* ---------------------------------------------------------------- ouverture d'une enquête */
async function openBook(id) {
  const book = S.books.find(b => b.id === id); if (!book) return;
  try {
    toast('Ouverture…', 6000);
    const blob = await dbGet('files', id); if (!blob) { toast('PDF introuvable sur cet appareil'); return; }
    const doc = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
    if (S.doc) { try { S.doc.destroy(); } catch (e) { } }
    normNotes(book); S.cur = book; S.doc = doc; S.undo = []; S.sel = null; S.tool = null; S.showAllPages = false; S.optsOpen = false;
    book.lastOpened = Date.now(); book.numPages = doc.numPages;
    $('#home').classList.add('hidden'); $('#reader').classList.remove('hidden');
    buildReader(); await V.load(doc, book); setClue(book.clueIdx || 0, true); setSave('saved'); changed(true);
    $('#toast') && ($('#toast').style.display = 'none');
    if (!S.settings.tutoReader) { await startTuto('reader'); S.settings.tutoReader = true; saveSettings(); }
    if (!book.clues.length) openClueSetup({ wizard: true }); else if (!book.linkDone) openLinkSetup({ wizard: true }); else if (!book.cardAsked && !book.crossSize) setTimeout(askCards, 400);
  } catch (e) { console.error(e); toast('Erreur à l’ouverture du PDF'); goHome(); }
}
async function goHome() {
  V.savePos(); if (S.cur) await doSave(true);
  S.cur = null; $('#reader').classList.add('hidden'); $('#home').classList.remove('hidden'); V.unload(); renderHome(); homeChecks();
}

/* ---------------------------------------------------------------- lecteur : interface */
const colorOf = a => { const c = S.cur.clues.find(c => c.id === a.clue); return c ? c.color : (a.color || PALETTE[0]); };
const curClue = () => S.cur && S.cur.clues[S.cur.clueIdx];
const curColor = () => (curClue() || {}).color || S.lastCol;

function longBtn(btn, onTap, onLong) {
  let t = null, fired = false;
  btn.addEventListener('pointerdown', () => { fired = false; clearTimeout(t); t = setTimeout(() => { fired = true; navigator.vibrate && navigator.vibrate(12); onLong(); }, 450); });
  btn.addEventListener('pointerup', () => { clearTimeout(t); if (!fired) onTap(); });
  btn.addEventListener('pointerleave', () => clearTimeout(t)); btn.addEventListener('pointercancel', () => clearTimeout(t));
  btn.addEventListener('contextmenu', e => e.preventDefault());
}
function buildReader() {
  const r = $('#reader'); r.innerHTML = '';
  const tool = (k, icon, label) => { const b = h('button', { class: 'tb', 'data-k': k }, ic(icon), h('span', {}, label)); longBtn(b, () => setTool(k), () => longTool(k)); return b; };
  const nb = h('button', { id: 'nbtn', 'aria-label': 'Notes' }, ic('note')); longBtn(nb, openClueNote, openNotesOverview);
  const pgb = h('button', { id: 'pgbtn', 'aria-label': 'Pages masquées' }, ic('pgoff'), h('span', { id: 'pgbadge' })); longBtn(pgb, togglePagesAll, toggleCurPage);
  r.append(
    h('div', { id: 'cluebar' },
      h('div', { id: 'cleft' }, h('span', { id: 'cdot' }), nb, pgb),
      h('div', { id: 'cwrap' }, h('div', { id: 'cmain' }, h('div', { id: 'ccount' }), h('div', { id: 'ctext' }))),
      h('div', { id: 'cctl' },
        h('button', { onclick: openClueList, 'aria-label': 'Liste des indices' }, ic('list')),
        h('button', { onclick: () => stepClue(-1), 'aria-label': 'Indice précédent' }, ic('up')),
        h('button', { onclick: () => stepClue(1), 'aria-label': 'Indice suivant' }, ic('down')))),
    h('div', { id: 'vp' }, h('div', { id: 'stage' })),
    h('div', { id: 'opts', class: 'hidden' }),
    h('div', { id: 'bar' },
      h('div', { class: 'row a' },
        tool('hl', 'hl', 'Surligner'),
        h('button', { class: 'tb', id: 'colbtn', onclick: () => pickColor(curClue() ? curClue().color : S.lastCol, c => setCurColor(c)) }, h('span', { class: 'sw', id: 'colsw' }), h('span', {}, 'Couleur')),
        tool('cross', 'cross', 'Barrer'), tool('brush', 'brush', 'Pinceau'), tool('erase', 'erase', 'Gomme'),
        h('button', { class: 'tb', 'data-k': 'undo', onclick: doUndo }, ic('undo'), h('span', {}, 'Annuler'))),
      h('div', { class: 'row b' },
        h('button', { id: 'sv', onclick: manualSave }),
        h('div', { id: 'pnav' }, h('button', { class: 'ar', onclick: () => V.step(-1), 'aria-label': 'Page précédente' }, ic('left')),
          h('div', { id: 'pbox' },
            h('input', { id: 'pin', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', enterkeyhint: 'go', 'aria-label': 'Numéro de page',
              onfocus: e => { e.target.placeholder = e.target.value; e.target.value = ''; }, onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
              onblur: e => { const n = parseInt(e.target.value); if (n) V.goTo(clamp(n - 1, 0, S.cur.numPages - 1)); V.refreshNum(); } }),
            h('span', { id: 'ptot' }, '/ ' + S.cur.numPages)),
          h('button', { class: 'ar', onclick: () => V.step(1), 'aria-label': 'Page suivante' }, ic('right'))),
        h('button', { id: 'mbtn', onclick: openDrawer }, ic('menu'), h('span', {}, 'Menu')))));
  setSave(SV.state); updateToolUI(); V.init(); pagesUI(); applyHide();
}
function longTool(k) {
  if (S.tool !== k) { S.tool = k; S.sel = null; S.optsOpen = true; } else S.optsOpen = !S.optsOpen;
  V.redrawAll(); updateToolUI();
}
/* pages masquées */
function pagesUI() {
  const b = S.cur, btn = $('#pgbtn'); if (!btn) return; const n = (b.disabled || []).length;
  btn.classList.toggle('on', !!S.showAllPages && n > 0); const bd = $('#pgbadge'); bd.textContent = n || ''; bd.style.display = n ? 'flex' : 'none';
}
function toggleCurPage() {
  const b = S.cur; b.disabled = b.disabled || []; const i = V.curPage, k = b.disabled.indexOf(i);
  if (k >= 0) { b.disabled.splice(k, 1); toast(`Page ${i + 1} réactivée`); }
  else { if (b.disabled.length + 1 >= b.numPages) return toast('Impossible de masquer toutes les pages'); b.disabled.push(i); toast(`Page ${i + 1} masquée – appui simple pour revoir les pages masquées`, 3000); }
  V.refreshHidden(); V.goTo(i); pagesUI(); changed();
}
function togglePagesAll() {
  const n = (S.cur.disabled || []).length; if (!n) return toast('Aucune page masquée. Appui long = masquer la page en cours.', 2800);
  S.showAllPages = !S.showAllPages; const i = V.curPage; V.refreshHidden(); V.goTo(i); pagesUI();
  toast(S.showAllPages ? 'Toutes les pages affichées (les masquées sont estompées)' : 'Pages masquées de nouveau cachées', 2400);
}
/* notes : une note par indice (sous l'indice) + notes libres */
const autoGrow = ta => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 260) + 'px'; };
function openClueNote() {
  const b = S.cur; if (!b.clues.length) return openNotesOverview();
  const c = curClue(); const idx = b.clueIdx;
  const ta = h('textarea', { class: 'nta', placeholder: 'Votre note pour cet indice…', oninput: e => { c.note = e.target.value; setClue(idx, true); changed(true); } }); ta.value = c.note || '';
  const ctx = h('div', { class: 'qn-ctx' }, h('span', { class: 'd', style: 'background:' + c.color }), h('div', {}, `Indice ${idx + 1} : ${c.text.length > 90 ? c.text.slice(0, 90) + '…' : c.text}`));
  openModal('Note de l’indice', h('div', {}, ctx, ta),
    [{ label: 'Effacer la note', value: 0, fn: () => { c.note = ''; ta.value = ''; setClue(idx, true); changed(true); return false; } }, { label: 'OK', cls: 'pri', value: 1 }], { onclose: () => { c.note = (c.note || '').trim(); setClue(idx, true); doSave(true); } });
  setTimeout(() => ta.focus(), 120);
}
function openNotesOverview() {
  const b = S.cur; const root = h('div', {});
  const mkTa = (get, set, ph) => { const ta = h('textarea', { class: 'nta', placeholder: ph, rows: 2, oninput: e => { set(e.target.value); changed(true); autoGrow(ta); } }); ta.value = get(); setTimeout(() => autoGrow(ta), 30); return ta; };
  const free = h('div', { id: 'freelist' });
  const buildFree = () => {
    free.innerHTML = '';
    if (!b.notes.length) free.append(h('div', { class: 'hint' }, 'Aucune note libre. Utile pour une idée qui ne dépend d’aucun indice.'));
    b.notes.forEach(n => {
      const row = h('div', { class: 'ncard', 'data-id': n.id }, h('div', { class: 'grip', 'aria-label': 'Déplacer' }, ic('grip')), mkTa(() => n.text, v => n.text = v, 'Note libre…'),
        h('button', { class: 'ntrash', 'aria-label': 'Supprimer', onclick: async () => { if (!n.text.trim() || await confirmBox('Supprimer cette note ?', 'Cette note sera définitivement supprimée.', 'Supprimer', 'bad')) { b.notes = b.notes.filter(x => x !== n); changed(true); buildFree(); } } }, ic('trash')));
      row.querySelector('.grip').addEventListener('pointerdown', e => sortDrag(e, row, free, ids => { if (ids.join() !== b.notes.map(x => x.id).join()) { b.notes.sort((a, c) => ids.indexOf(a.id) - ids.indexOf(c.id)); changed(true); } buildFree(); }));
      free.append(row);
    });
  };
  root.append(h('h4', { class: 'nsec' }, 'Notes des indices'));
  if (!b.clues.length) root.append(h('div', { class: 'hint' }, 'Aucun indice défini.'));
  b.clues.forEach((c, i) => root.append(h('div', { class: 'ncard col' }, h('div', { class: 'qn-ctx' }, h('span', { class: 'd', style: 'background:' + c.color }), h('div', {}, `Indice ${i + 1}${c.done ? ' · validé' : ''} : ${c.text.length > 80 ? c.text.slice(0, 80) + '…' : c.text}`)), mkTa(() => c.note || '', v => c.note = v, 'Aucune note'))));
  root.append(h('h4', { class: 'nsec' }, 'Notes libres'), free); buildFree();
  openModal('Notes', root, [{ label: '+ Note libre', fn: () => { const n = { id: uid(), text: '' }; b.notes.push(n); buildFree(); changed(true); const t = free.querySelectorAll('textarea'); if (t.length) t[t.length - 1].focus(); return false; } }, { label: 'Fermer', cls: 'pri', value: 1 }],
    { full: true, onclose: () => { b.notes = b.notes.filter(n => n.text.trim()); b.clues.forEach(c => { if (c.note) c.note = c.note.trim(); }); setClue(b.clueIdx, true); doSave(true); } });
}
/* tri par glisser des lignes (indices, notes) */
function sortDrag(e, row, list, onCommit) {
  e.preventDefault(); e.stopPropagation(); const grip = e.currentTarget; try { grip.setPointerCapture(e.pointerId); } catch (_) { }
  const scroller = list.closest('.mb'); const rows = [...list.children].filter(r => r.dataset.id); const idx0 = rows.indexOf(row);
  const mids = rows.map(r => r.offsetTop + r.offsetHeight / 2), rowH = row.offsetHeight; const startY = e.clientY, st0 = scroller.scrollTop; let t = idx0, lastY = startY;
  row.classList.add('drag'); rows.forEach(r => { if (r !== row) r.style.transition = 'transform .12s'; });
  const layout = () => {
    const dy = lastY - startY + (scroller.scrollTop - st0); row.style.transform = `translateY(${dy}px)`;
    const yc = mids[idx0] + dy; const others = rows.filter(r => r !== row); t = others.filter(r => mids[rows.indexOf(r)] < yc).length;
    others.forEach((r, j) => { const i0 = rows.indexOf(r); const fin = j + (j >= t ? 1 : 0); r.style.transform = fin === i0 ? '' : `translateY(${i0 > idx0 ? -rowH : rowH}px)`; });
  };
  const move = ev => { lastY = ev.clientY; const r = scroller.getBoundingClientRect(); if (lastY < r.top + 50) scroller.scrollTop -= 14; else if (lastY > r.bottom - 50) scroller.scrollTop += 14; layout(); };
  const up = () => {
    grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
    const ids = rows.filter(r => r !== row).map(r => r.dataset.id); ids.splice(t, 0, row.dataset.id); onCommit(ids);
  };
  grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
}
/* ---------------------------------------------------------------- images liées aux indices */
function toggleClueImg(i) { const c = S.cur.clues[i]; c.imgOn = !c.imgOn; setClue(i, true); changed(); }
function openImgViewer(c) {
  let big = false; const img = h('img', { src: c.img, alt: '', style: 'display:block;width:100%;background:#fff;border-radius:6px' });
  const box = h('div', { style: 'overflow:auto;max-height:68vh;-webkit-overflow-scrolling:touch' }, img);
  openModal('Image de l’indice', box, [{ label: 'Agrandir / réduire', fn: () => { big = !big; img.style.width = big ? '230%' : '100%'; return false; } }, { label: 'Fermer', cls: 'pri', value: 1 }]);
}
function pickImageRegion(startPage, o = {}) {
  return new Promise(resolve => {
    const doc = S.doc, N = doc.numPages; let pg = clamp(startPage != null ? startPage : 0, 0, N - 1), rect = o.rect ? { ...o.rect } : { x: 0.08, y: 0.3, w: 0.84, h: 0.2 }, vpt = null, lt = 0, result = null;
    const stageEl = h('div', { id: 'sst' }), pnum = h('b', {});
    const rectEl = h('div', { id: 'sr' }, ['tl', 'tr', 'br', 'bl'].map(k => h('i', { 'data-h': k, style: (k[0] === 't' ? 'top:0;' : 'top:100%;') + (k[1] === 'l' ? 'left:0' : 'left:100%') })));
    const nav = h('div', { style: 'display:flex;align-items:center;justify-content:center;gap:12px;margin:6px 0' }, h('button', { class: 'btn sm', onclick: () => go(-1) }, '◀'), h('span', {}, 'Page ', pnum), h('button', { class: 'btn sm', onclick: () => go(1) }, '▶'));
    const info = h('div', { style: 'text-align:center;font-size:13px;color:var(--mut);margin:6px 0' }, o.info || 'Allez à la page de l’image, puis placez le cadre rouge autour (coins = taille, intérieur = déplacer).');
    const drawRect = () => Object.assign(rectEl.style, { left: rect.x * 100 + '%', top: rect.y * 100 + '%', width: rect.w * 100 + '%', height: rect.h * 100 + '%' });
    async function load() {
      const my = ++lt; pnum.textContent = `${pg + 1} / ${N}`; stageEl.innerHTML = '';
      const p = await doc.getPage(pg + 1); if (my !== lt) return; const base = p.getViewport({ scale: 1 }); const w = fitW(base.height / base.width, 330);
      vpt = p.getViewport({ scale: Math.min(w * (devicePixelRatio || 1), 1600) / base.width }); const c = document.createElement('canvas'); c.width = Math.round(vpt.width); c.height = Math.round(vpt.height);
      stageEl.style.width = w + 'px'; stageEl.append(c, rectEl); drawRect(); await p.render({ canvasContext: c.getContext('2d'), viewport: vpt }).promise;
    }
    function go(d) { pg = clamp(pg + d, 0, N - 1); load(); }
    let drag = null;
    rectEl.addEventListener('pointerdown', e => { e.preventDefault(); rectEl.setPointerCapture(e.pointerId); drag = { k: e.target.dataset.h || 'move', r: stageEl.getBoundingClientRect(), rect: { ...rect }, x: e.clientX, y: e.clientY }; });
    rectEl.addEventListener('pointermove', e => {
      if (!drag) return; const dx = (e.clientX - drag.x) / drag.r.width, dy = (e.clientY - drag.y) / drag.r.height, o = drag.rect; let { x, y, w, h: hh } = o;
      if (drag.k === 'move') { x = clamp(o.x + dx, 0, 1 - o.w); y = clamp(o.y + dy, 0, 1 - o.h); }
      else { if (drag.k[1] === 'l') { x = clamp(o.x + dx, 0, o.x + o.w - 0.03); w = o.x + o.w - x; } else w = clamp(o.w + dx, 0.03, 1 - o.x); if (drag.k[0] === 't') { y = clamp(o.y + dy, 0, o.y + o.h - 0.02); hh = o.y + o.h - y; } else hh = clamp(o.h + dy, 0.02, 1 - o.y); }
      rect = { x, y, w, h: hh }; drawRect();
    });
    const end = () => { drag = null; }; rectEl.addEventListener('pointerup', end); rectEl.addEventListener('pointercancel', end);
    async function crop() {
      const p = await doc.getPage(pg + 1), base = p.getViewport({ scale: 1 }), fullW = clamp(1100 / rect.w, 600, 2600), v = p.getViewport({ scale: fullW / base.width });
      const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height); await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
      const sx = Math.round(rect.x * c.width), sy = Math.round(rect.y * c.height), sw = Math.max(8, Math.round(rect.w * c.width)), sh = Math.max(8, Math.round(rect.h * c.height));
      const o = document.createElement('canvas'); o.width = sw; o.height = sh; o.getContext('2d').drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
      const url = o.toDataURL('image/jpeg', 0.86); c.width = c.height = 0; return url;
    }
    const m = openModal(o.title || 'Choisir l’image de l’indice', h('div', {}, o.intro ? h('div', { class: 'note', style: 'margin:0 0 4px;font-size:14px' }, o.intro) : null, nav, stageEl, info),
      [{ label: o.cancel || 'Annuler', value: 0 }, { label: o.ok || 'Utiliser cette zone', cls: 'pri', value: 1, fn: async () => { try { if (o.raw) { result = { pg, rect: { ...rect }, ratio: vpt.height / vpt.width }; return; } result = await crop(); } catch (e) { console.error(e); toast('Impossible de découper cette zone'); return false; } } }], { full: true });
    m.promise.then(v => resolve(v === 1 ? result : null)); load();
  });
}

/* indices */
const lum = hx => { const n = parseInt((hx || '#888888').slice(1, 7), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
function renderClueText(el, c, onTap) {
  el.innerHTML = ''; let wi = 0; const hl = c.hl || [];
  for (const tok of c.text.split(/(\s+)/)) {
    if (!tok) continue; if (/^\s+$/.test(tok)) { el.append(tok); continue; }
    const i = wi++; const sp = h('span', { class: 'w' }, tok); if (hl.includes(i)) { sp.style.background = c.color + 'c0'; sp.style.color = lum(c.color) > 0.55 ? '#111' : '#fff'; }
    if (onTap) {
      let tm = null, x0 = 0, y0 = 0; const stop = () => clearTimeout(tm);
      sp.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; stop(); tm = setTimeout(() => { navigator.vibrate && navigator.vibrate(15); onTap(i); }, 500); });
      sp.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) stop(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => sp.addEventListener(ev, stop)); sp.addEventListener('contextmenu', e => e.preventDefault());
    }
    el.append(sp);
  }
}
function setClue(i, silent) {
  const b = S.cur, n = b.clues.length; const dot = $('#cdot'), tx = $('#ctext'), ct = $('#ccount'), cm = $('#cmain');
  const st0 = tx.scrollTop, sameIdx = n && b.clueIdx === clamp(i, 0, Math.max(0, n - 1)); ct.innerHTML = '';
  if (!n) { dot.style.background = '#ccc'; tx.className = 'none'; tx.textContent = 'Aucun indice défini – touchez ici'; cm.onclick = () => openClueSetup({}); updateToolUI(); V.layout(); return; }
  cm.onclick = null; b.clueIdx = clamp(i, 0, n - 1); const c = b.clues[b.clueIdx]; cm.style.setProperty('--cc', c.color);
  dot.style.background = c.color; tx.className = c.done ? 'isdone' : '';
  const nAct = b.clues.filter(x => !x.done).length;
  ct.append(h('span', { class: 'ctl' }, `Indice ${b.clueIdx + 1} / ${n}`, c.done ? ' · validé' : (nAct < n ? ` · ${nAct} actif${nAct > 1 ? 's' : ''}` : '')), h('span', { style: 'flex:1' }),
    ...(c.img ? [h('button', { id: 'cimg', class: 'cvalid' + (c.imgOn ? ' on' : ''), 'aria-label': c.imgOn ? 'Masquer l’image de l’indice' : 'Afficher l’image de l’indice', onclick: () => toggleClueImg(b.clueIdx) }, ic('img', 14), 'Image')] : []),
    h('button', { id: 'cvalid', class: 'cvalid' + (c.done ? ' on' : ''), 'aria-label': c.done ? 'Réactiver l’indice' : 'Marquer l’indice comme validé', onclick: () => toggleDone(b.clueIdx) }, ic('check', 14), c.done ? 'Validé' : 'Valider'));
  const showImg = !!(c.img && c.imgOn); cm.classList.toggle('showimg', showImg);
  if (showImg && c.imgReplace) tx.innerHTML = ''; else renderClueText(tx, c, wi => { c.hl = c.hl || []; const k = c.hl.indexOf(wi); if (k < 0) c.hl.push(wi); else c.hl.splice(k, 1); const st = tx.scrollTop; setClue(b.clueIdx, true); tx.scrollTop = st; changed(true); });
  if (showImg) tx.append(h('img', { class: 'cimg', src: c.img, alt: 'Image de l’indice', onclick: () => openImgViewer(c) }));
  if (c.note && c.note.trim()) tx.append(h('div', { class: 'cnote', onclick: openClueNote }, c.note));
  tx.scrollTop = sameIdx ? st0 : 0; updateToolUI(); V.layout(); if (!silent) changed(true);
}
function toggleDone(i) {
  const c = S.cur.clues[i]; c.done = !c.done; setClue(i, true); changed();
  toast(c.done ? 'Indice validé – les flèches le sautent. Retouchez le bouton pour le réactiver.' : 'Indice réactivé', 2400);
}
function stepClue(d) {
  const b = S.cur, n = b.clues.length; if (!n) return toast('Définissez d’abord les indices');
  const i0 = b.clueIdx; let j = -1;
  for (let k = 1; k <= n; k++) { const t = ((i0 + d * k) % n + n) % n; if (!b.clues[t].done) { j = t; break; } }
  if (j < 0) return toast('Tous les indices sont validés', 1800);
  if (j === i0) return toast('Un seul indice actif', 1600);
  const wrapped = d > 0 ? j < i0 : j > i0; setClue(j);
  if (wrapped) { toast(d > 0 ? 'Retour au premier indice' : 'Retour au dernier indice', 1100); navigator.vibrate && navigator.vibrate(10); }
}
function setCurColor(c) { const cl = curClue(); S.lastCol = c; if (cl) { cl.color = c; setClue(S.cur.clueIdx, true); V.redrawAll(); changed(); } else updateToolUI(); }
function pickColor(cur, cb) {
  const m = openModal('Couleur', h('div', {}, h('div', { class: 'pal' }, PALETTE.map(c => h('button', { class: c.toLowerCase() === (cur || '').toLowerCase() ? 'on' : '', style: 'background:' + c, onclick: () => { cb(c); m.close(); } }))),
    h('div', { class: 'line' }, h('span', {}, 'Autre couleur'), h('input', { type: 'color', value: cur || '#e6194b', onchange: e => { cb(e.target.value); m.close(); } }))));
}
function openClueList() {
  const b = S.cur; if (!b.clues.length) return openClueSetup({});
  const list = h('div', { id: 'cllist' });
  const dragRow = (e, row) => sortDrag(e, row, list, ids => {
    const cur = b.clues[b.clueIdx];
    if (ids.join() !== b.clues.map(c => c.id).join()) { b.clues.sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id)); b.clueIdx = Math.max(0, b.clues.indexOf(cur)); setClue(b.clueIdx, true); changed(); }
    build();
  });
  const build = () => {
    list.innerHTML = '';
    b.clues.forEach((c, i) => {
      const tx = h('div', { class: 'tx' }); renderClueText(tx, c, null); if (c.note && c.note.trim()) tx.append(h('div', { class: 'cnote' }, c.note));
      const row = h('div', { class: 'clrow' + (i === b.clueIdx ? ' cur' : '') + (c.done ? ' done' : ''), 'data-id': c.id, onclick: () => { setClue(i); m.close(); } },
        h('div', { class: 'grip', 'aria-label': 'Déplacer l’indice', onclick: e => e.stopPropagation() }, ic('grip')),
        h('button', { class: 'd', style: 'background:' + c.color, onclick: e => { e.stopPropagation(); pickColor(c.color, col => { c.color = col; if (i === b.clueIdx) setClue(i, true); V.redrawAll(); changed(); build(); }); } }),
        tx, h('button', { class: 'dn' + (c.done ? ' on' : ''), 'aria-label': c.done ? 'Réactiver' : 'Valider', onclick: e => { e.stopPropagation(); c.done = !c.done; setClue(b.clueIdx, true); changed(); build(); } }, ic('check')), h('div', { class: 'ck' }, ic('check')));
      row.querySelector('.grip').addEventListener('pointerdown', e => dragRow(e, row)); list.append(row);
    });
  };
  build();
  const m = openModal(`Indices (${b.clues.length})`, h('div', {}, h('div', { class: 'hint' }, 'Poignée ⋮⋮ : changer l’ordre · rond ✓ : indice validé (sauté par les flèches, retouchez pour réactiver) · carré : indice affiché.'), list), [{ label: 'Modifier les indices', fn: () => { setTimeout(() => openClueSetup({}), 50); } }, { label: 'Fermer', cls: 'pri', value: 1 }], { full: true });
}

/* outils : tap = activer / désactiver, appui long = options */
function setTool(t) { S.tool = S.tool === t ? null : t; S.sel = null; S.optsOpen = false; V.redrawAll(); updateToolUI(); }
function updateToolUI() {
  document.querySelectorAll('#bar .tb[data-k]').forEach(b => { if (['hl', 'cross', 'brush', 'erase'].includes(b.dataset.k)) b.classList.toggle('on', S.tool === b.dataset.k); });
  const sw = $('#colsw'); if (sw) sw.style.background = curColor();
  const o = $('#opts'); if (!o) return; o.innerHTML = '';
  const t = S.tool, a = S.sel && S.cur.ann.find(x => x.id === S.sel);
  const show = (t === 'cross' && a) || (S.optsOpen && (t === 'cross' || t === 'brush' || t === 'hl' || t === 'erase'));
  o.classList.toggle('hidden', !show);
  if (show) {
    const ok = h('button', { class: 'ob go', onclick: () => { S.optsOpen = false; S.sel = null; V.redrawAll(); updateToolUI(); } }, ic('check', 16), 'OK');
    if (t === 'cross') {
      const val = a ? a.th : (S.cur.crossTh || S.settings.thick);
      o.append(h('span', {}, 'Épaisseur'), h('input', { type: 'range', min: 0.003, max: 0.04, step: 0.001, value: val, oninput: e => setThick(parseFloat(e.target.value), false), onchange: e => setThick(parseFloat(e.target.value), true) }));
      if (a) o.append(h('button', { class: 'ob', onclick: () => removeAnn(a.id) }, ic('trash', 16), 'Suppr.'));
      else o.append(h('button', { class: 'ob', onclick: () => openCardSetup() }, 'Fiches ⚙'));
      o.append(ok);
    } else if (t === 'brush') {
      o.append(h('span', {}, 'Épaisseur'), h('input', { type: 'range', min: 0.002, max: 0.02, step: 0.001, value: S.settings.brushW, onchange: e => { S.settings.brushW = parseFloat(e.target.value); saveSettings(); } }), ok);
    } else if (t === 'erase') {
      const md = S.settings.eraseMode; const mb = (k, l) => h('button', { class: 'ob' + (md === k ? ' go' : ''), onclick: () => { S.settings.eraseMode = k; saveSettings(); updateToolUI(); } }, l);
      o.append(mb('el', 'Élément entier'), mb('part', 'Au trait'));
      if (md === 'part') o.append(h('input', { type: 'range', min: 6, max: 40, step: 1, value: S.settings.eraseR, onchange: e => { S.settings.eraseR = parseInt(e.target.value); saveSettings(); } }));
      o.append(ok);
    } else if (t === 'hl') {
      o.append(h('span', {}, 'Opacité'), h('input', { type: 'range', min: 0.2, max: 0.9, step: 0.05, value: S.settings.hlOp, oninput: e => { S.settings.hlOp = parseFloat(e.target.value); V.redrawAll(); }, onchange: () => saveSettings() }), ok);
    }
  }
  V.layout();
}
function setThick(v, commit) {
  const a = S.sel && S.cur.ann.find(x => x.id === S.sel);
  if (a) a.th = v; S.cur.crossTh = v; V.redrawAll(); if (commit) changed();
}

/* annotations & annulation */
const snap = () => JSON.stringify(S.cur.ann);
function pushUndo(before) { if (before !== snap()) { S.undo.push(before); if (S.undo.length > 50) S.undo.shift(); return true; } return false; }
function doUndo() {
  if (!S.undo.length) return toast('Rien à annuler');
  S.cur.ann = JSON.parse(S.undo.pop()); if (S.sel && !S.cur.ann.find(a => a.id === S.sel)) S.sel = null;
  V.redrawAll(); updateToolUI(); changed();
}
function addAnn(a) {
  const before = snap(); a.id = uid(); a.clue = (curClue() || {}).id || null; if (!a.clue) a.color = S.lastCol;
  S.cur.ann.push(a); pushUndo(before);
  if (S.cur.status === 'new') S.cur.status = 'doing';
  V.drawPage(a.page); changed(); return a;
}
function removeAnn(id) { const before = snap(); const a = S.cur.ann.find(x => x.id === id); S.cur.ann = S.cur.ann.filter(x => x.id !== id); pushUndo(before); if (S.sel === id) S.sel = null; if (a) V.drawPage(a.page); updateToolUI(); changed(); }

/* tiroir */
function openDrawer() {
  const bg = h('div', { class: 'drawer-bg' }); const close = () => { bg.remove(); d.remove(); };
  const it = (icon, label, fn) => h('button', { class: 'it', onclick: () => { close(); setTimeout(fn, 30); } }, ic(icon), label);
  const d = h('div', { class: 'drawer' }, h('div', { class: 't' }, S.cur.title),
    it('home', 'Accueil', goHome), it('flag', 'Valider le suspect', openValidate),
    it('list', 'Liste des indices', openClueList), it('pencil', 'Page / détection des indices', () => openClueSetup({})),
    it('flag', 'Lien officiel (QR code)', () => openLinkSetup({})),
    it('right', 'Aller à la page d’indices', () => S.cur.cluePage != null ? V.goTo(S.cur.cluePage) : toast('Page d’indices non définie')),
    it('pencil', 'Fiches à barrer (taille)', openCardSetup), it('pencil', 'Personnaliser l’interface', openUiPanel), it('down', 'Exporter le PDF annoté', openExportPdf), it('gear', 'Paramètres', openSettings), it('play', 'Tutoriel du lecteur', () => startTuto('reader')), h('div', { class: 'sp' }));
  bg.addEventListener('pointerdown', close); document.body.append(bg, d);
}

/* valider le suspect */
async function openValidate() {
  const b = S.cur;
  if (b.status === 'done') {
    const r = await ask('Enquête terminée', `Coupable trouvé : ${b.culprit || '—'}`, [{ label: 'Fermer', value: 0 }, { label: 'Recommencer l’enquête', cls: 'bad', value: 1 }]);
    if (r === 1 && await confirmBox('Recommencer ?', 'Surlignages, croix et avancement seront effacés (indices conservés).', 'Recommencer', 'bad')) { resetBook(b); S.undo = []; setClue(0, true); V.redrawAll(); await doSave(); toast('Enquête remise à zéro'); }
    return;
  }
  const url = h('input', { type: 'url', placeholder: 'https://… (lien du site officiel)', value: b.officialUrl || '' });
  const name = h('input', { type: 'text', placeholder: 'Prénom du suspect', value: '' });
  const m = openModal('Valider le suspect', h('div', {},
    h('p', {}, '1. Ouvrez le site officiel et vérifiez votre suspect :'), url,
    h('div', { style: 'margin:8px 0 16px' }, h('button', { class: 'btn pri', onclick: () => { let u = url.value.trim(); if (/^(?!https?:)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|$)/i.test(u)) { u = 'https://' + u; url.value = u; } if (!/^https?:\/\//i.test(u)) return toast('Collez un lien valide'); b.officialUrl = u; changed(true); window.open(u, '_blank', 'noopener'); } }, 'Ouvrir le site officiel')),
    h('p', {}, '2. De retour ici, indiquez le suspect et le résultat :'), name),
    [{ label: 'Pas le bon', value: 'no', fn: () => { if (name.value.trim()) { (b.attempts = b.attempts || []).push({ name: name.value.trim(), ok: false, at: Date.now() }); changed(); } } },
    { label: 'C’était le bon ✓', cls: 'ok', value: 'yes', fn: () => { if (!name.value.trim()) { toast('Indiquez le nom du suspect'); return false; } b.culprit = name.value.trim(); b.status = 'done'; (b.attempts = b.attempts || []).push({ name: b.culprit, ok: true, at: Date.now() }); doSave(); toast('Enquête terminée 🎉'); if (S.settings.backupDays) setTimeout(() => backupPrompt('end'), 900); } }]);
}

/* ---------------------------------------------------------------- détection mots (pixels) */
function detectWord(g, w, hgt, px, py, sens) {
  const T = 115; const gapRows = Math.max(2, Math.round(w / 600));
  px = Math.round(px); py = Math.round(py); if (px < 0 || py < 0 || px >= w || py >= hgt) return null;
  const x0 = Math.max(0, Math.round(px - w * 0.17)), x1 = Math.min(w - 1, Math.round(px + w * 0.17));
  /* colonnes « barre » (bord sombre, trait vertical) : ignorées */
  const bc = new Map(), yA = Math.max(0, py - Math.round(w * 0.1)), yB = Math.min(hgt - 1, py + Math.round(w * 0.1));
  const isBar = x => { let v = bc.get(x); if (v === undefined) { let n = 0; for (let y = yA; y <= yB; y++) if (g[y * w + x] < T) n++; v = n > 0.9 * (yB - yA + 1); bc.set(x, v); } return v; };
  const rowInk = y => { let c = 0; for (let x = x0; x <= x1; x++) if (g[y * w + x] < T && !isBar(x) && ++c >= 2) return true; return false; };
  const tol = Math.round(w * 0.012); let y = -1;
  for (let d = 0; d <= tol; d++) { if (py - d >= 0 && rowInk(py - d)) { y = py - d; break; } if (py + d < hgt && rowInk(py + d)) { y = py + d; break; } }
  if (y < 0) return null;
  let ya = y, yb = y, miss = 0;
  for (let yy = y - 1; yy >= 0; yy--) { if (rowInk(yy)) { ya = yy; miss = 0; } else if (++miss > gapRows) break; }
  miss = 0; for (let yy = y + 1; yy < hgt; yy++) { if (rowInk(yy)) { yb = yy; miss = 0; } else if (++miss > gapRows) break; }
  const bandH = yb - ya + 1; if (bandH > w * 0.12) return null;
  const colInk = x => { if (isBar(x)) return false; let c = 0; for (let yy = ya; yy <= yb; yy++) if (g[yy * w + x] < T && ++c >= 2) return true; return false; };
  let x = -1; for (let d = 0; d <= tol * 2; d++) { if (px - d >= 0 && colInk(px - d)) { x = px - d; break; } if (px + d < w && colInk(px + d)) { x = px + d; break; } }
  if (x < 0) return null;
  const thr = Math.max(3, Math.round(bandH * 0.2 * sens));
  let xa = x, xb = x; miss = 0;
  for (let xx = x - 1; xx >= 0; xx--) { if (colInk(xx)) { xa = xx; miss = 0; } else if (++miss > thr) break; }
  miss = 0; for (let xx = x + 1; xx < w; xx++) { if (colInk(xx)) { xb = xx; miss = 0; } else if (++miss > thr) break; }
  let ya2 = yb, yb2 = ya; for (let yy = ya; yy <= yb; yy++) for (let xx = xa; xx <= xb; xx++) if (g[yy * w + xx] < T && !isBar(xx)) { if (yy < ya2) ya2 = yy; if (yy > yb2) yb2 = yy; break; }
  const padx = Math.max(2, bandH * 0.1), pady = Math.max(2, bandH * 0.08);
  return { x: (xa - padx) / w, y: (ya2 - pady) / w, w: (xb - xa + 1 + padx * 2) / w, h: (yb2 - ya2 + 1 + pady * 2) / w };
}
const grayCache = new Map();
async function getGray(i) {
  if (grayCache.has(i)) return grayCache.get(i);
  const c = await renderThumb(S.doc, i + 1, 1800); const ctx = c.getContext('2d'); const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const g = new Uint8Array(c.width * c.height); for (let k = 0, j = 0; k < d.length; k += 4, j++) g[j] = (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11);
  const o = { data: g, w: c.width, h: c.height }; grayCache.set(i, o); if (grayCache.size > 3) grayCache.delete(grayCache.keys().next().value); return o;
}

/* ---------------------------------------------------------------- visionneuse */
const V = (() => {
  let vp, stage, doc, book, pages = [], TW = 0, TH = 0, s = 1, tx = 0, ty = 0, GAP = 8, M = 8, MAXZ = 6;
  let ready = false, laid = false, userMoved = false;
  let ptrs = new Map(), gest = null, raf = 0, vis = 0, hiT = 0, posT = 0, lastTap = { t: 0, x: 0, y: 0 }, docGen = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const api = { curPage: 0 };
  const NS = 'http://www.w3.org/2000/svg';
  const horiz = () => S.settings.scroll === 'h';

  api.init = () => {
    vp = $('#vp'); stage = $('#stage');
    vp.addEventListener('pointerdown', onDown); vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerup', onUp); vp.addEventListener('pointercancel', onUp);
    vp.addEventListener('scroll', () => { vp.scrollTop = 0; vp.scrollLeft = 0; });
    vp.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey) { const r = vp.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, s * Math.exp(-e.deltaY * 0.01)); } else { tx -= e.deltaX; ty -= e.deltaY; clampT(); applyT(); } }, { passive: false });
    new ResizeObserver(() => api.layout()).observe(vp);
  };
  api.unload = () => { ready = false; docGen++; pages = []; if (stage) stage.innerHTML = ''; doc = null; grayCache.clear(); };
  api.refreshNum = () => { const pin = $('#pin'); if (pin && document.activeElement !== pin) pin.value = api.curPage + 1; const pt = $('#ptot'); if (pt) pt.textContent = '/ ' + pages.length; };

  api.load = async (d, b) => {
    ready = false; laid = false; docGen++; doc = d; book = b; pages = []; stage.innerHTML = ''; grayCache.clear(); api.curPage = 0;
    for (let i = 1; i <= d.numPages; i++) {
      const pg = await d.getPage(i); const v = pg.getViewport({ scale: 1 }); const ratio = v.height / v.width;
      const el = h('div', { class: 'pg' }); const cv = document.createElement('canvas'); cv.width = 2; cv.height = 2;
      const mk = cls => { const e = document.createElementNS(NS, 'svg'); e.setAttribute('class', cls); e.setAttribute('viewBox', `0 0 1 ${ratio}`); e.setAttribute('preserveAspectRatio', 'none'); return e; };
      const hl = mk('hl'), dr = mk('dr'), tmp = mk('tmp'); el.append(cv, hl, dr, tmp); stage.append(el);
      pages.push({ el, cv, hl, dr, tmp, ratio, rw: 0, want: 0, gen: 0, task: null, top: 0, left: 0, w: 1, h: 1, hidden: false });
    }
    s = 1; tx = 0; ty = 0; api.refreshHidden(false); doLayout();
    const p0 = b.pos;
    if (p0 && p0.v === 2 && pages[p0.page]) {
      s = clamp(p0.zoom || 1, 1, MAXZ); const pg = pages[p0.page];
      if (horiz() || pg.hidden) api.goTo(p0.page);
      else { const ref = pg.top + p0.frac * pg.h; ty = -(ref - vp.clientHeight * 0.3 / s) * s; tx = (p0.txn || 0) * vp.clientWidth; }
    } else api.goTo(0);
    clampT(); ready = true; applyT(); api.redrawAll(); vp.scrollTop = 0; vp.scrollLeft = 0;
    if (!(p0 && p0.v === 2)) { setTimeout(() => { if (ready && !userMoved) api.goTo(0); }, 400); }
  };

  api.layout = () => { if (ready) doLayout(); };
  function doLayout() {
    if (!doc || !vp) return; const vw = vp.clientWidth, vh = vp.clientHeight; if (!vw || !vh) return;
    const hz = horiz(); let pos = M;
    let anchor = null; if (laid) { const ref = refLine(), i = pageAt(ref), pp = pages[i]; anchor = { i, f: clamp((ref - (hz ? pp.left : pp.top)) / (hz ? pp.w : pp.h), 0, 1) }; }
    for (const p of pages) {
      if (p.hidden) { p.el.style.display = 'none'; continue; }
      let w, hh;
      if (hz) { hh = vh - 2 * M; w = hh / p.ratio; if (w > vw - 2 * M) { w = vw - 2 * M; hh = w * p.ratio; } p.left = pos; p.top = (vh - hh) / 2; pos += w + GAP; }
      else { w = vw - 2 * M; hh = w * p.ratio; p.left = M; p.top = pos; pos += hh + GAP; }
      p.w = w; p.h = hh; p.el.style.cssText = `display:block;left:${p.left}px;top:${p.top}px;width:${w}px;height:${hh}px`;
    }
    if (hz) { TW = pos - GAP + M; TH = vh; } else { TW = vw; TH = pos - GAP + M; }
    stage.style.width = TW + 'px'; stage.style.height = TH + 'px';
    if (anchor) { const pp = pages[anchor.i]; if (hz) tx = vp.clientWidth * 0.5 - (pp.left + anchor.f * pp.w) * s; else ty = vp.clientHeight * 0.3 - (pp.top + anchor.f * pp.h) * s; }
    laid = true; clampT(); applyT();
  }
  function clampT() {
    const vw = vp.clientWidth, vh = vp.clientHeight, cw = TW * s, ch = TH * s;
    tx = cw <= vw + 0.5 ? (vw - cw) / 2 : clamp(tx, vw - cw, 0); ty = ch <= vh ? (horiz() ? (vh - ch) / 2 : 0) : clamp(ty, vh - ch, 0);
  }
  function applyT() {
    stage.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
    if (!vis) vis = requestAnimationFrame(() => { vis = 0; updateVisible(); });
    clearTimeout(hiT); hiT = setTimeout(() => { updateVisible(true); if (S.sel) api.redrawAll(); }, 160);
    if (ready) { clearTimeout(posT); posT = setTimeout(() => { api.savePos(); changed(true); }, 900); }
  }
  function refLine() { return horiz() ? (-tx + vp.clientWidth * 0.5) / s : (-ty + vp.clientHeight * 0.3) / s; }
  function pageAt(v) { const hz = horiz(); let lastV = 0; for (let i = 0; i < pages.length; i++) { const p = pages[i]; if (p.hidden) continue; lastV = i; if (v < (hz ? p.left + p.w : p.top + p.h) + GAP / 2) return i; } return lastV; }
  api.refreshHidden = (relayout = true) => { const dis = (book && book.disabled) || []; pages.forEach((p, i) => { const d = dis.includes(i); const off = S.settings.hide.pgoff; p.hidden = d && !S.showAllPages && !off; p.el.classList.toggle('dim', d && !!S.showAllPages && !off); }); if (relayout) doLayout(); };
  const visIdx = i => { if (!pages[i] || !pages[i].hidden) return i; for (let k = i + 1; k < pages.length; k++) if (!pages[k].hidden) return k; for (let k = i - 1; k >= 0; k--) if (!pages[k].hidden) return k; return i; };
  function updateVisible(force) {
    if (!doc || !pages.length) return; const vw = vp.clientWidth, vh = vp.clientHeight;
    const L = -tx / s, T = -ty / s, R = L + vw / s, B = T + vh / s, mx = (R - L) * 0.5, my = (B - T) * 0.5;
    const cp = pageAt(refLine()); if (cp !== api.curPage || force === undefined) { api.curPage = cp; api.refreshNum(); }
    pages.forEach((p, i) => {
      const v = !p.hidden && p.left < R + mx && p.left + p.w > L - mx && p.top < B + my && p.top + p.h > T - my;
      const far = p.hidden || p.left > R + mx * 3 || p.left + p.w < L - mx * 3 || p.top > B + my * 3 || p.top + p.h < T - my * 3;
      if (v) { const Q = clamp(Math.ceil(s - 0.05), 1, 4); const maxW = Math.sqrt(9e6 / p.ratio); const pxW = Math.round(Math.min(p.w * dpr * Q, maxW)); if (force || !p.rw) renderPage(i, pxW); else if (pxW > p.rw * 1.15 && force !== undefined) renderPage(i, pxW); }
      else if (far && p.rw) { if (p.task) { try { p.task.cancel(); } catch (e) { } } p.gen++; const c = document.createElement('canvas'); c.width = 2; c.height = 2; p.cv.replaceWith(c); p.cv = c; p.rw = 0; p.want = 0; }
    });
  }
  async function renderPage(i, pxW) {
    const p = pages[i]; if (!p || p.rw === pxW || p.want === pxW) return; p.want = pxW; if (p.task) { try { p.task.cancel(); } catch (e) { } }
    const gen = ++p.gen, dg = docGen;
    try {
      const pg = await doc.getPage(i + 1); const base = pg.getViewport({ scale: 1 }); const v = pg.getViewport({ scale: pxW / base.width });
      const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
      const task = pg.render({ canvasContext: c.getContext('2d'), viewport: v }); p.task = task; await task.promise;
      if (gen !== p.gen || dg !== docGen) return; p.cv.replaceWith(c); p.cv = c; p.rw = pxW;
    } catch (e) { if (!(e && e.name === 'RenderingCancelledException')) console.error(e); }
    finally { if (p.gen === gen) p.want = 0; }
  }
  function zoomAt(cx, cy, ns) { ns = clamp(ns, 1, MAXZ); const sx = (cx - tx) / s, sy = (cy - ty) / s; s = ns; tx = cx - sx * s; ty = cy - sy * s; clampT(); applyT(); }

  api.goTo = i => {
    if (!pages.length) return; i = visIdx(clamp(i, 0, pages.length - 1)); const p = pages[i];
    if (horiz()) tx = (vp.clientWidth - p.w * s) / 2 - p.left * s; else ty = -(p.top - M) * s;
    clampT(); applyT(); updateVisible(true);
  };
  api.step = d => { let i = api.curPage + d; while (i >= 0 && i < pages.length && pages[i].hidden) i += d; if (i < 0 || i >= pages.length) return; api.goTo(i); };
  api.savePos = () => {
    if (!book || !pages.length || !doc || !vp || !ready) return; const ref = refLine(), i = pageAt(ref), p = pages[i], hz = horiz();
    book.pos = { v: 2, page: i, frac: clamp((ref - (hz ? p.left : p.top)) / (hz ? p.w : p.h), 0, 1), zoom: s, txn: tx / (vp.clientWidth || 1) };
  };

  /* --- dessin des annotations --- */
  const esc = n => +n.toFixed(5);
  function crossPath(a) {
    const sh = a.shape || S.settings.shape;
    if (sh === 'square') return `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="0.004"/>`;
    if (sh === 'custom' && S.settings.custom && S.settings.custom.length) return '<path d="' + S.settings.custom.map(st => st.map((p, k) => (k ? 'L' : 'M') + esc(a.x + p[0] * a.w) + ' ' + esc(a.y + p[1] * a.h)).join('')).join('') + '"/>';
    return `<path d="M${a.x} ${a.y}L${a.x + a.w} ${a.y + a.h}M${a.x + a.w} ${a.y}L${a.x} ${a.y + a.h}"/>`;
  }
  const ptsD = pts => pts.map((q, k) => (k ? 'L' : 'M') + q[0] + ' ' + q[1]).join('') + (pts.length === 1 ? `L${pts[0][0] + 0.0001} ${pts[0][1]}` : '');
  api.annMarkup = (i, withSel) => {
    const p = pages[i]; let hl = '', dr = ''; if (!p || !book) return { hl, dr };
    const op = S.settings.hlOp, hr = 13 / (p.w * s || 1);
    for (const a of book.ann) {
      if (a.page !== i) continue; const c = colorOf(a);
      if (a.t === 'h') hl += `<rect x="${esc(a.x)}" y="${esc(a.y)}" width="${esc(a.w)}" height="${esc(a.h)}" rx="0.003" fill="${c}" fill-opacity="${op}"/>`;
      else if (a.t === 'x') {
        dr += `<g fill="none" stroke="${c}" stroke-width="${a.th}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.92">${crossPath(a)}</g>`;
        if (withSel && S.sel === a.id) { dr += `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="none" stroke="#2563eb" stroke-width="${hr * 0.15}" stroke-dasharray="${hr * 0.5} ${hr * 0.4}"/>`; for (const [cx, cy] of [[a.x, a.y], [a.x + a.w, a.y], [a.x + a.w, a.y + a.h], [a.x, a.y + a.h]]) dr += `<circle cx="${cx}" cy="${cy}" r="${hr}" fill="#fff" stroke="#2563eb" stroke-width="${hr * 0.2}"/>`; }
      } else if (a.t === 'b') dr += `<path d="${ptsD(a.pts)}" fill="none" stroke="${c}" stroke-width="${a.w}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.9"/>`;
    }
    return { hl, dr };
  };
  api.drawPage = i => { const p = pages[i]; if (!p || !book) return; const m = api.annMarkup(i, true); p.hl.innerHTML = m.hl; p.dr.innerHTML = m.dr; };
  api.redrawAll = () => { for (let i = 0; i < pages.length; i++) api.drawPage(i); };
  const tmpDraw = (i, html) => { if (pages[i]) pages[i].tmp.innerHTML = html; };
  const clearTmp = () => pages.forEach(p => { if (p.tmp.innerHTML) p.tmp.innerHTML = ''; });

  /* --- gestes --- */
  const P = e => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function toPage(x, y, fixed) {
    const sy = (y - ty) / s, sx = (x - tx) / s; const i = fixed != null ? fixed : pageAt(horiz() ? sx : sy); const p = pages[i];
    return { i, x: (sx - p.left) / p.w, y: (sy - p.top) / p.w };
  }
  const toScreen = (i, ux, uy) => { const p = pages[i]; return { x: tx + (p.left + ux * p.w) * s, y: ty + (p.top + uy * p.w) * s }; };
  const segDist = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy; let t = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0; t = clamp(t, 0, 1); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); };
  const hitAnn = (i, ux, uy, tolPx) => {
    const tol = tolPx / (pages[i].w * s); const A = book.ann;
    for (let k = A.length - 1; k >= 0; k--) {
      const a = A[k]; if (a.page !== i) continue;
      if (a.t === 'h' || a.t === 'x') { if (ux >= a.x - tol && ux <= a.x + a.w + tol && uy >= a.y - tol && uy <= a.y + a.h + tol) return a; }
      else if (a.t === 'b') { const pts = a.pts; for (let j = 0; j < pts.length; j++) { const q = pts[j], q2 = pts[j + 1] || q; if (segDist(ux, uy, q[0], q[1], q2[0], q2[1]) < tol + a.w) return a; } }
    }
    return null;
  };

  function onDown(e) {
    if (!doc) return; userMoved = true; cancelAnimationFrame(raf); try { vp.setPointerCapture(e.pointerId); } catch (_) { }
    const q = P(e); ptrs.set(e.pointerId, { x: q.x, y: q.y });
    if (ptrs.size === 2) { gest && gest.cancel && gest.cancel(); const [a, b] = [...ptrs.values()]; const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; gest = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: s, sx: (c.x - tx) / s, sy: (c.y - ty) / s }; return; }
    if (ptrs.size > 2) { gest = { type: 'none' }; return; }
    startSingle(q, e);
  }
  function startSingle(q, e) {
    const t = S.tool;
    if (!t) { gest = { type: 'pan', lx: q.x, ly: q.y, lt: performance.now(), vx: 0, vy: 0, moved: false, x0: q.x, y0: q.y }; return; }
    const pp = toPage(q.x, q.y); const base = { x0: q.x, y0: q.y, p0: pp, moved: false };
    if (t === 'hl') gest = { type: 'hl', ...base, cancel: clearTmp };
    else if (t === 'brush') { gest = { type: 'brush', ...base, pts: [[esc(pp.x), esc(pp.y)]], cancel: clearTmp }; tmpDraw(pp.i, brushTmp(pp.i, gest.pts)); }
    else if (t === 'erase') { gest = { type: 'erase', ...base, before: snap(), prev: null }; eraseAt(q); }
    else if (t === 'cross') {
      const sel = S.sel && book.ann.find(a => a.id === S.sel);
      if (sel) {
        const cs = [[sel.x, sel.y], [sel.x + sel.w, sel.y], [sel.x + sel.w, sel.y + sel.h], [sel.x, sel.y + sel.h]];
        for (let k = 0; k < 4; k++) { const sp = toScreen(sel.page, cs[k][0], cs[k][1]); if (Math.hypot(sp.x - q.x, sp.y - q.y) < 26) { gest = { type: 'resize', ...base, a: sel, k, opp: cs[(k + 2) % 4], before: snap() }; return; } }
        const hit = pp.i === sel.page && pp.x >= sel.x && pp.x <= sel.x + sel.w && pp.y >= sel.y && pp.y <= sel.y + sel.h;
        if (hit) { gest = { type: 'move', ...base, a: sel, ox: pp.x - sel.x, oy: pp.y - sel.y, before: snap() }; return; }
        gest = { type: 'desel', ...base }; return;
      }
      const hit = hitAnn(pp.i, pp.x, pp.y, 8);
      if (hit && hit.t === 'x') {
        /* appui long sur une croix posée : la sélectionner pour la modifier */
        const g = { type: 'cpress', ...base }; g.timer = setTimeout(() => { if (gest === g && !g.moved) { S.sel = hit.id; api.redrawAll(); updateToolUI(); navigator.vibrate && navigator.vibrate(15); gest = { type: 'none' }; } }, 450);
        g.cancel = () => clearTimeout(g.timer); gest = g; return;
      }
      gest = { type: 'cdraw', ...base, cancel: clearTmp };
    }
  }
  const brushTmp = (i, pts) => `<path d="${ptsD(pts)}" fill="none" stroke="${curColor()}" stroke-width="${S.settings.brushW}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.9"/>`;
  function eraseAt(q) {
    const pp = toPage(q.x, q.y), pr = gest.prev && gest.prev.i === pp.i ? gest.prev : null; gest.prev = pp; const part = S.settings.eraseMode === 'part';
    const r = (part ? (S.settings.eraseR || 16) : 14) / (pages[pp.i].w * s); const samples = [pp];
    if (pr) { const d = Math.hypot(pp.x - pr.x, pp.y - pr.y), n = Math.min(60, Math.ceil(d / (r * 0.5))); for (let k = 1; k < n; k++) samples.push({ x: pr.x + (pp.x - pr.x) * k / n, y: pr.y + (pp.y - pr.y) * k / n }); }
    let did = false;
    for (const e of samples) {
      if (!part) { const a = hitAnn(pp.i, e.x, e.y, 14); if (a) { book.ann = book.ann.filter(x => x.id !== a.id); if (S.sel === a.id) S.sel = null; did = true; } continue; }
      for (let k = book.ann.length - 1; k >= 0; k--) {
        const a = book.ann[k]; if (a.page !== pp.i) continue;
        if (a.t === 'b') {
          const dense = []; a.pts.forEach((q, j) => { dense.push(q); const n2 = a.pts[j + 1]; if (n2) { const d = Math.hypot(n2[0] - q[0], n2[1] - q[1]), m = Math.ceil(d / (r * 0.4)); for (let u = 1; u < m; u++) dense.push([q[0] + (n2[0] - q[0]) * u / m, q[1] + (n2[1] - q[1]) * u / m]); } });
          const keep = dense.map(q => Math.hypot(q[0] - e.x, q[1] - e.y) >= r + a.w / 2); if (keep.every(Boolean)) continue;
          const runs = []; let cur = []; dense.forEach((q, j) => { if (keep[j]) cur.push(q); else { if (cur.length) runs.push(cur); cur = []; } }); if (cur.length) runs.push(cur);
          book.ann.splice(k, 1, ...runs.map(rn => ({ ...a, id: uid(), pts: rn.map(q => [esc(q[0]), esc(q[1])]) }))); did = true;
        } else if (e.x >= a.x - r && e.x <= a.x + a.w + r && e.y >= a.y - r && e.y <= a.y + a.h + r) { if (a.t === 'x' && S.sel !== a.id && false) continue; book.ann.splice(k, 1); did = true; }
      }
    }
    if (did) { api.drawPage(pp.i); gest.did = true; }
  }
  const rectOf = (p0, p1) => ({ x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y), w: Math.abs(p1.x - p0.x), h: Math.abs(p1.y - p0.y) });

  function onMove(e) {
    if (!ptrs.has(e.pointerId)) return; const q = P(e); ptrs.set(e.pointerId, { x: q.x, y: q.y });
    if (!gest) return;
    if (gest.type === 'pinch') {
      if (ptrs.size < 2) return; const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1; const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const ns = clamp(gest.s0 * d / gest.d0, 1, MAXZ); s = ns; tx = c.x - gest.sx * ns; ty = c.y - gest.sy * ns; clampT(); applyT(); return;
    }
    const moved = Math.hypot(q.x - (gest.x0 ?? q.x), q.y - (gest.y0 ?? q.y)) > 8; if (moved) { gest.moved = true; if (gest.type === 'cpress') clearTimeout(gest.timer); }
    switch (gest.type) {
      case 'pan': {
        const now = performance.now(), dt = Math.max(1, now - gest.lt); const dx = q.x - gest.lx, dy = q.y - gest.ly;
        tx += dx; ty += dy; gest.vx = 0.8 * (dx / dt) + 0.2 * gest.vx; gest.vy = 0.8 * (dy / dt) + 0.2 * gest.vy; gest.lx = q.x; gest.ly = q.y; gest.lt = now; clampT(); applyT(); break;
      }
      case 'hl': case 'cdraw': if (gest.moved) { const p1 = toPage(q.x, q.y, gest.p0.i); const r = rectOf(gest.p0, p1); tmpDraw(gest.p0.i, gest.type === 'hl' ? `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${curColor()}" fill-opacity="0.35" stroke="${curColor()}" stroke-width="0.002"/>` : `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${curColor()}" stroke-width="0.004" stroke-dasharray="0.01 0.01"/>`); } break;
      case 'brush': { const p1 = toPage(q.x, q.y, gest.p0.i); const l = gest.pts[gest.pts.length - 1]; if (Math.hypot(p1.x - l[0], p1.y - l[1]) > 0.0012) { gest.pts.push([esc(p1.x), esc(p1.y)]); tmpDraw(gest.p0.i, brushTmp(gest.p0.i, gest.pts)); } break; }
      case 'erase': eraseAt(q); break;
      case 'move': { const p1 = toPage(q.x, q.y, gest.a.page); gest.a.x = p1.x - gest.ox; gest.a.y = p1.y - gest.oy; api.drawPage(gest.a.page); break; }
      case 'resize': { const p1 = toPage(q.x, q.y, gest.a.page); const r = rectOf({ x: gest.opp[0], y: gest.opp[1] }, p1); if (r.w > 0.02 && r.h > 0.02) { Object.assign(gest.a, r); api.drawPage(gest.a.page); } break; }
    }
  }
  function onUp(e) {
    if (!ptrs.has(e.pointerId)) return; const q = P(e); ptrs.delete(e.pointerId); const g = gest;
    if (g && g.type === 'pinch') { if (ptrs.size < 2) gest = ptrs.size ? { type: 'none' } : null; return; }
    if (ptrs.size) return; gest = null; if (!g || g.type === 'none') return;
    switch (g.type) {
      case 'cpress': clearTimeout(g.timer); break;
      case 'pan': {
        if (!g.moved) { const now = performance.now(); if (now - lastTap.t < 320 && Math.hypot(q.x - lastTap.x, q.y - lastTap.y) < 30) { zoomAt(q.x, q.y, s > 1.3 ? 1 : 2.5); lastTap.t = 0; } else lastTap = { t: now, x: q.x, y: q.y }; }
        else if (Math.hypot(g.vx, g.vy) > 0.15 && performance.now() - g.lt < 80) inertia(g.vx, g.vy); break;
      }
      case 'hl': {
        clearTmp();
        if (g.moved) { const p1 = toPage(q.x, q.y, g.p0.i); const r = rectOf(g.p0, p1); if (r.w > 0.01 && r.h > 0.004) addAnn({ t: 'h', page: g.p0.i, ...r }); }
        else tapWord(g.p0); break;
      }
      case 'cdraw': {
        clearTmp();
        if (g.moved) { const p1 = toPage(q.x, q.y, g.p0.i); const r = rectOf(g.p0, p1); if (r.w > 0.02 && r.h > 0.02) newCross(g.p0.i, r); }
        else if (!book.crossSize) toast('Première croix : faites glisser du doigt pour tracer la taille d’une fiche (ou Menu ≡ > Fiches à barrer). Ensuite un simple tap suffira.', 4500);
        else newCross(g.p0.i, cardRect(g.p0)); break;
      }
      case 'brush': { clearTmp(); if (g.pts.length) addAnn({ t: 'b', page: g.p0.i, pts: g.pts, w: S.settings.brushW }); break; }
      case 'erase': if (g.did) { pushUndo(g.before); if (S.cur.status === 'new') S.cur.status = 'doing'; updateToolUI(); changed(); } break;
      case 'move': case 'resize': if (g.a) { book.crossSize = { w: g.a.w, h: g.a.h }; if (pushUndo(g.before)) changed(); } break;
      case 'desel': if (!g.moved) { S.sel = null; api.redrawAll(); updateToolUI(); } break;
    }
  }
  function cardRect(p) {
    const sz = book.crossSize, g = book.cardGrid, R = pages[p.i].ratio; let cx = p.x, cy = p.y;
    if (g) {
      const gx = g.x + g.w / 2, gy = g.y + g.h / 2; let sx = cx, sy = cy;
      if (g.px) sx = gx + Math.round((p.x - gx) / g.px) * g.px;
      if (g.py) sy = gy + Math.round((p.y - gy) / g.py) * g.py;
      if (Math.abs(p.x - sx) <= sz.w / 2 && Math.abs(p.y - sy) <= sz.h / 2) { cx = sx; cy = sy; }
    }
    return { x: clamp(cx - sz.w / 2, 0, Math.max(0, 1 - sz.w)), y: clamp(cy - sz.h / 2, 0, Math.max(0, R - sz.h)), w: sz.w, h: sz.h };
  }
  function newCross(i, r) { addAnn({ t: 'x', page: i, ...r, th: book.crossTh || S.settings.thick, shape: S.settings.shape }); book.crossSize = { w: r.w, h: r.h }; }
  async function tapWord(p0) {
    try {
      const g = await getGray(p0.i); const r = detectWord(g.data, g.w, g.h, p0.x * g.w, p0.y * g.w, S.settings.sens);
      if (r) addAnn({ t: 'h', page: p0.i, ...r });
    } catch (e) { console.error(e); }
  }
  function inertia(vx, vy) {
    let last = performance.now();
    const step = now => { const dt = Math.min(40, now - last); last = now; tx += vx * dt; ty += vy * dt; vx *= Math.pow(0.94, dt / 16); vy *= Math.pow(0.94, dt / 16); clampT(); applyT(); if (Math.hypot(vx, vy) > 0.03) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }
  return api;
})();

/* ---------------------------------------------------------------- détection des indices */
const fitW = (ratio, reserve) => Math.max(170, Math.min(document.body.clientWidth - 28, 620, (innerHeight - reserve) / ratio));
async function openClueSetup(opts = {}) {
  const b = S.cur, doc = S.doc, N = doc.numPages, wiz = !!opts.wizard;
  let pg = b.cluePage != null ? b.cluePage : Math.min(1, N - 1), rect = b.clueRect ? { ...b.clueRect } : null, vpt = null, items = [];
  const stageEl = h('div', { id: 'sst' }); const info = h('div', { style: 'text-align:center;font-size:13px;color:var(--mut);margin:6px 0' });
  const pnum = h('b', {}); const rectEl = h('div', { id: 'sr' }, ['tl', 'tr', 'br', 'bl'].map(k => h('i', { 'data-h': k, style: (k[0] === 't' ? 'top:0;' : 'top:100%;') + (k[1] === 'l' ? 'left:0' : 'left:100%') })));
  const nav = h('div', { style: 'display:flex;align-items:center;justify-content:center;gap:12px;margin:6px 0' },
    h('button', { class: 'btn sm', onclick: () => go(-1) }, '◀'), h('span', {}, 'Page ', pnum), h('button', { class: 'btn sm', onclick: () => go(1) }, '▶'));
  const intro = wiz ? h('div', { class: 'note', style: 'font-size:15px;margin:0 0 4px' }, h('b', {}, 'Étape 1 sur 2 – Les indices. '), 'Allez à la page qui liste les indices, puis ajustez le cadre rouge autour du texte des indices uniquement.')
    : h('p', { style: 'margin:0 0 4px;font-size:13px' }, 'Choisissez la page des indices et ajustez le cadre rouge (coins = taille, intérieur = déplacer).');
  const afterSave = wiz ? () => { if (!b.linkDone) openLinkSetup({ wizard: true }); } : null;
  const detect = { label: 'Détecter les indices', cls: 'pri', value: 1, fn: async () => { const txt = extract(); if (!txt) return false; b.cluePage = pg; b.clueRect = { ...rect }; setTimeout(() => editClues(txt, true, afterSave), 30); } };
  const left = wiz ? { label: 'Passer', value: 0, fn: async () => { if (!await confirmBox('Passer cette étape ?', 'Sans les indices, l’indice épinglé en haut ne fonctionnera pas. Vous pourrez les définir plus tard depuis le menu.', 'Passer', 'bad')) return false; setTimeout(() => { if (!b.linkDone) openLinkSetup({ wizard: true }); }, 50); } }
    : { label: b.clues.length ? 'Modifier sans détecter' : 'Annuler', value: 0, fn: () => { if (b.clues.length) setTimeout(() => editClues(b.clues.map(c => c.text), false), 30); } };
  openModal(wiz ? 'Étape 1/2 – Page des indices' : 'Page des indices', h('div', {}, intro, nav, stageEl, info), [left, detect], { full: true, noclose: wiz });
  let lt = 0;
  async function load() {
    const my = ++lt; pnum.textContent = `${pg + 1} / ${N}`; stageEl.innerHTML = ''; info.textContent = 'Chargement…';
    const p = await doc.getPage(pg + 1); if (my !== lt) return; const base = p.getViewport({ scale: 1 }); const w = fitW(base.height / base.width, 330);
    vpt = p.getViewport({ scale: Math.min(w * (devicePixelRatio || 1), 1600) / base.width });
    const c = document.createElement('canvas'); c.width = Math.round(vpt.width); c.height = Math.round(vpt.height); stageEl.style.width = w + 'px'; stageEl.append(c, rectEl);
    await p.render({ canvasContext: c.getContext('2d'), viewport: vpt }).promise; if (my !== lt) return;
    const tc = await p.getTextContent(); if (my !== lt) return; items = tc.items.filter(i => i.str && i.str.trim()).map(i => { const t = pdfjsLib.Util.transform(vpt.transform, i.transform); return { str: i.str, x: t[4], y: t[5], w: i.width * vpt.scale, fs: Math.hypot(t[2], t[3]) || 10 }; });
    if (!rect || b.cluePage !== pg) autoRect(); drawRect(); info.textContent = items.length ? `${items.length} morceaux de texte trouvés sur cette page.` : 'Aucun texte sélectionnable sur cette page.';
  }
  function autoRect() {
    const cw = vpt.width, ch = vpt.height;
    if (!items.length) { rect = { x: 0.1, y: 0.3, w: 0.8, h: 0.3 }; return; }
    const x0 = Math.min(...items.map(i => i.x)), x1 = Math.max(...items.map(i => i.x + i.w)), y0 = Math.min(...items.map(i => i.y - i.fs)), y1 = Math.max(...items.map(i => i.y + i.fs * 0.3));
    rect = { x: clamp(x0 / cw - 0.02, 0, 1), y: clamp(y0 / ch - 0.01, 0, 1), w: 0, h: 0 }; rect.w = clamp(x1 / cw + 0.02, 0, 1) - rect.x; rect.h = clamp(y1 / ch + 0.01, 0, 1) - rect.y;
  }
  function drawRect() { Object.assign(rectEl.style, { left: rect.x * 100 + '%', top: rect.y * 100 + '%', width: rect.w * 100 + '%', height: rect.h * 100 + '%' }); }
  function go(d) { pg = clamp(pg + d, 0, N - 1); rect = null; load(); }
  let drag = null;
  rectEl.addEventListener('pointerdown', e => { e.preventDefault(); rectEl.setPointerCapture(e.pointerId); const r = stageEl.getBoundingClientRect(); drag = { k: e.target.dataset.h || 'move', r, rect: { ...rect }, x: e.clientX, y: e.clientY }; });
  rectEl.addEventListener('pointermove', e => {
    if (!drag) return; const dx = (e.clientX - drag.x) / drag.r.width, dy = (e.clientY - drag.y) / drag.r.height, o = drag.rect; let { x, y, w, h: hh } = o;
    if (drag.k === 'move') { x = clamp(o.x + dx, 0, 1 - o.w); y = clamp(o.y + dy, 0, 1 - o.h); }
    else { if (drag.k[1] === 'l') { x = clamp(o.x + dx, 0, o.x + o.w - 0.03); w = o.x + o.w - x; } else w = clamp(o.w + dx, 0.03, 1 - o.x); if (drag.k[0] === 't') { y = clamp(o.y + dy, 0, o.y + o.h - 0.02); hh = o.y + o.h - y; } else hh = clamp(o.h + dy, 0.02, 1 - o.y); }
    rect = { x, y, w, h: hh }; drawRect();
  });
  const end = () => { drag = null; }; rectEl.addEventListener('pointerup', end); rectEl.addEventListener('pointercancel', end);
  function extract() {
    const cw = vpt.width, ch = vpt.height, x0 = rect.x * cw, x1 = (rect.x + rect.w) * cw, y0 = rect.y * ch, y1 = (rect.y + rect.h) * ch;
    const it = items.filter(i => { const cx = i.x + i.w / 2; return cx >= x0 && cx <= x1 && i.y >= y0 && i.y <= y1 + 2; }).sort((a, c) => a.y - c.y || a.x - c.x);
    if (!it.length) { toast('Aucun texte dans le cadre – agrandissez-le'); return null; }
    const lines = []; for (const i of it) { const L = lines[lines.length - 1]; if (L && Math.abs(i.y - L.y) < Math.max(i.fs, L.fs) * 0.5) { L.items.push(i); L.fs = Math.max(L.fs, i.fs); } else lines.push({ y: i.y, fs: i.fs, items: [i] }); }
    for (const L of lines) { L.items.sort((a, c) => a.x - c.x); let t = '', end = null; for (const i of L.items) { if (end != null && i.x - end > i.fs * 0.15 && !/\s$/.test(t) && !/^\s/.test(i.str)) t += ' '; t += i.str; end = i.x + i.w; } L.text = t.replace(/\s+/g, ' ').trim(); }
    const gaps = lines.slice(1).map((L, k) => L.y - lines[k].y); const fsSorted = lines.map(L => L.fs).sort((a, c) => a - c); const fs = fsSorted[Math.floor(fsSorted.length / 2)];
    const minGap = gaps.length ? Math.min(...gaps) : 0, maxGap = gaps.length ? Math.max(...gaps) : 0; const thr = minGap && maxGap / minGap > 1.5 ? Math.sqrt(minGap * maxGap) : 1.9 * fs;
    const out = [lines[0].text]; gaps.forEach((g, k) => { if (g > thr) out.push(lines[k + 1].text); else out[out.length - 1] += ' ' + lines[k + 1].text; });
    return out.filter(t => t.trim());
  }
  load();
}
function editClues(texts, fresh, after) {
  const b = S.cur; const old = fresh ? [] : b.clues; const prev = b.clues;
  let rows = texts.map((t, i) => ({ id: (old[i] && old[i].id) || uid(), text: t, color: (old[i] && old[i].color) || PALETTE[i % PALETTE.length], hl: old[i] && old[i].text === t ? (old[i].hl || []) : [], note: (old[i] && old[i].note) || '', done: !!(old[i] && old[i].done), ...(() => { const p = old[i] || prev.find(q => q.text === t) || {}; return p.img ? { img: p.img, imgReplace: !!p.imgReplace, imgOn: !!p.imgOn } : {}; })() }));
  const list = h('div', {});
  const imgRow = r => {
    const pick = async () => { const u = await pickImageRegion(b.cluePage != null ? b.cluePage : 0); if (u) { r.img = u; build(); } };
    if (!r.img) return h('div', { style: 'margin:6px 0' }, h('button', { class: 'btn sm', onclick: pick }, ic('img', 16), ' Ajouter une image à cet indice'));
    return h('div', { style: 'margin:6px 0;display:flex;flex-direction:column;gap:6px' },
      h('img', { src: r.img, alt: '', style: 'max-width:100%;max-height:90px;object-fit:contain;align-self:flex-start;border:1px solid #ccc;border-radius:6px;background:#fff' }),
      h('label', { style: 'display:flex;gap:8px;align-items:center;font-size:13px' }, h('input', { type: 'checkbox', checked: !!r.imgReplace, onchange: e => { r.imgReplace = e.target.checked; } }), 'Quand l’image est affichée, elle remplace le texte de l’indice'),
      h('div', { class: 'ac' }, h('button', { class: 'btn sm', onclick: pick }, 'Changer l’image'), h('button', { class: 'btn sm bad', onclick: () => { delete r.img; delete r.imgReplace; delete r.imgOn; build(); } }, 'Retirer l’image')));
  };
  function build() {
    list.innerHTML = '';
    rows.forEach((r, i) => {
      const ta = h('textarea', { oninput: e => { r.text = e.target.value; r.hl = []; } }); ta.value = r.text;
      list.append(h('div', { class: 'edcl' }, h('div', { class: 'hd' }, h('span', { class: 'd', style: 'background:' + r.color }), `Indice ${i + 1}`),
        ta, imgRow(r), h('div', { class: 'ac' },
          i > 0 ? h('button', { class: 'btn sm', onclick: () => { rows[i - 1].text = (rows[i - 1].text + ' ' + r.text).trim(); rows[i - 1].hl = []; rows[i - 1].note = ((rows[i - 1].note || '') + ' ' + (r.note || '')).trim(); rows.splice(i, 1); build(); } }, '⤴ Fusionner avec le précédent') : null,
          h('button', { class: 'btn sm', onclick: () => { const p = ta.selectionStart; if (!p || p >= r.text.length) return toast('Placez le curseur dans le texte à l’endroit à scinder'); const a = r.text.slice(0, p).trim(), c = r.text.slice(p).trim(); r.text = a; r.hl = []; rows.splice(i + 1, 0, { id: uid(), text: c, color: PALETTE[rows.length % PALETTE.length], hl: [] }); build(); } }, '✂ Scinder au curseur'),
          h('button', { class: 'btn sm bad', onclick: () => { rows.splice(i, 1); build(); } }, 'Supprimer'))));
    });
    list.append(h('button', { class: 'btn', style: 'width:100%;margin-top:4px', onclick: () => { rows.push({ id: uid(), text: '', color: PALETTE[rows.length % PALETTE.length], hl: [] }); build(); const t = list.querySelectorAll('textarea'); t[t.length - 1].focus(); } }, '+ Ajouter un indice'));
  }
  build();
  openModal(`Vérifier les indices`, h('div', {}, h('div', { class: 'note' }, 'Corrigez si besoin : fusionnez deux morceaux d’un même indice, ou scindez-les. Chaque indice reçoit une couleur différente.'), list),
    [{ label: 'Annuler', value: 0 }, { label: 'Enregistrer', cls: 'pri', value: 1, fn: () => { const clean = rows.filter(r => r.text.trim()); if (!clean.length) { toast('Aucun indice'); return false; } b.clues = clean.map(r => ({ ...r, text: r.text.trim() })); if (b.status === 'new') b.status = 'doing'; b.clueIdx = clamp(b.clueIdx, 0, b.clues.length - 1); if (fresh) b.clueIdx = 0; setClue(b.clueIdx, true); V.redrawAll(); doSave(); toast(`${b.clues.length} indices enregistrés ✓`); if (after) setTimeout(after, 60); } }], { full: true });
}


/* ---------------------------------------------------------------- fiches à barrer (carrés avec visages) */
async function askCards() {
  const b = S.cur; if (!b || b.cardAsked || b.crossSize) return;
  const r = await ask('Fiches à barrer ?', h('div', {}, h('p', { style: 'margin:0 0 8px' }, 'Cette enquête a-t-elle des pages de fiches (carrés avec visage, nom, infos…) que vous voulez barrer d’un seul tap ?'), h('p', { style: 'margin:0;font-size:13px;color:var(--mut)' }, 'Il suffit de montrer une fiche à l’app : ensuite, un tap dans une fiche la barre en entier. Réglable plus tard dans Menu ≡ > « Fiches à barrer ».')),
    [{ label: 'Non', value: 'no' }, { label: 'Plus tard', value: 'later' }, { label: 'Oui, régler', cls: 'pri', value: 'yes' }]);
  if (r === 'yes') { await openCardSetup(); return; }
  if (r === 'no' || r === 'later') { b.cardAsked = true; doSave(true); }
}
async function openCardSetup() {
  const b = S.cur, N = S.doc.numPages; if (!b) return; let page = clamp(V.curPage || 0, 0, N - 1);
  const step = async (n, rect, extra) => pickImageRegion(page, { raw: true, rect, title: `Fiches à barrer – ${n}/3`, ...extra });
  const r1 = await step(1, { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, { intro: 'Placez le cadre rouge sur UNE fiche entière : du haut du visage jusqu’à la dernière ligne d’infos, sans dépasser. Coins = taille, intérieur = déplacer.', info: 'Allez à une page de fiches, puis encadrez une fiche.', ok: 'Suivant', cancel: 'Annuler' });
  if (!r1) return; page = r1.pg;
  const R = r1.ratio, a = r1.rect, c0 = { x: a.x, y: a.y * R, w: a.w, h: a.h * R };
  const r2 = await step(2, { x: Math.min(a.x + a.w * 1.04, 1 - a.w), y: a.y, w: a.w, h: a.h }, { intro: 'Placez maintenant le cadre sur la fiche juste À DROITE de la première (même ligne). Cela permet à l’app de retrouver chaque fiche.', info: 'Si votre page n’a qu’une colonne, touchez « Passer ».', ok: 'Suivant', cancel: 'Passer' });
  let px = null, py = null; if (r2 && r2.pg === page) px = r2.rect.x - a.x;
  const r3 = await step(3, { x: a.x, y: Math.min(a.y + a.h * 1.04, 1 - a.h), w: a.w, h: a.h }, { intro: 'Dernière étape : le cadre sur la fiche juste EN DESSOUS de la première (même colonne).', info: 'Si votre page n’a qu’une ligne, touchez « Passer ».', ok: 'Terminer', cancel: 'Passer' });
  if (r3 && r3.pg === page) py = (r3.rect.y - a.y) * R;
  b.crossSize = { w: c0.w, h: c0.h }; b.cardGrid = { x: c0.x, y: c0.y, w: c0.w, h: c0.h, px: px && Math.abs(px) > c0.w * 0.5 ? px : null, py: py && Math.abs(py) > c0.h * 0.5 ? py : null, page };
  b.cardAsked = true; await doSave(true);
  if (S.tool !== 'cross') { S.tool = 'cross'; updateToolUI(); }
  toast('Taille enregistrée ✓ Choisissez l’outil « Barrer » : un tap dans une fiche la barre.', 4500);
}

/* ---------------------------------------------------------------- lien officiel (QR code ou texte) */
async function openLinkSetup(opts = {}) {
  const b = S.cur, doc = S.doc, N = doc.numPages, wiz = !!opts.wizard; let pg = Math.min(1, N - 1), token = 0;
  const url = h('input', { type: 'text', inputmode: 'url', autocapitalize: 'off', autocorrect: 'off', placeholder: 'lecoupablenestpaslea.fr/… ou https://…', value: b.linkDone ? (b.officialUrl || '') : '', style: 'font-size:16px' });
  const info = h('div', { style: 'font-size:14px;color:var(--mut);margin:8px 0;min-height:1.4em;text-align:center' });
  const cands = h('div', {}); const box = h('div', { style: 'text-align:center;margin:8px 0' }); const pnum = h('b');
  const clean = u => { u = (u || '').trim().replace(/[.,;:)\]]+$/, ''); if (/^www\./i.test(u) || /^(?!https?:)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|$)/i.test(u)) u = 'https://' + u; return u; };
  const isSite = u => /lecoupablenestpaslea/i.test(u);
  const found = new Map(); /* url -> { qr:boolean, pages:Set, how:Set } */
  const add = (u, how, i) => { u = clean(u); if (!/^https?:\/\/\S+\.\S+/i.test(u)) return; const e = found.get(u) || { qr: false, pages: new Set(), how: new Set() }; if (how === 'QR code') e.qr = true; e.pages.add(i); e.how.add(how); found.set(u, e); };
  async function scanPage(i) {
    const p = await doc.getPage(i + 1);
    try { (await p.getAnnotations()).forEach(x => x.url && add(x.url, 'lien cliquable', i)); } catch (e) { }
    try { const tc = await p.getTextContent(); const RX = /(https?:\/\/|www\.|(?<![\w.@-])lecoupablenestpaslea\.[a-z]{2,})[^\s"<>]*/gi; const T = tc.items.map(x => x.str); let m = T.join(' ').match(RX) || []; const m2 = T.join('').match(RX) || []; m2.forEach(u => { if (!m.some(v => u.startsWith(v.replace(/\s/g, '')))) m.push(u); }); m.forEach(u => add(u, 'texte', i)); } catch (e) { }
    try {
      if (typeof jsQR === 'function') {
        const base = p.getViewport({ scale: 1 }); const c = await renderThumb(doc, i + 1, Math.round(Math.min(2200, base.width * 3)));
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height); const q = jsQR(d.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
        if (q && q.data) add(q.data, 'QR code', i);
      }
    } catch (e) { console.error(e); }
  }
  function renderCands() {
    cands.innerHTML = ''; const list = [...found.entries()].sort((a, c) => (isSite(c[0]) - isSite(a[0])) || (c[1].qr - a[1].qr) || (a[1].pages.size - c[1].pages.size));
    if (!list.length) return;
    cands.append(h('div', { style: 'font-size:13px;color:var(--mut);margin:4px 0' }, 'Liens trouvés dans le PDF – touchez celui de la solution :'));
    list.forEach(([u, e]) => { const pgs = [...e.pages].sort((a, c) => a - c); cands.append(h('button', { class: 'clrow' + (url.value === u ? ' cur' : ''), style: 'width:100%;text-align:left', onclick: () => { url.value = u; pg = pgs[0]; load(); renderCands(); } },
      h('div', { class: 'tx', style: 'font-size:13px;word-break:break-all' }, u, h('div', { style: 'font-size:12px;color:var(--mut)' }, [...e.how].join(' + ') + ' · page' + (pgs.length > 1 ? 's ' : ' ') + pgs.slice(0, 4).map(x => x + 1).join(', ') + (pgs.length > 4 ? '…' : ''))))); });
  }
  async function load() {
    pnum.textContent = `${pg + 1} / ${N}`; box.innerHTML = '';
    const p = await doc.getPage(pg + 1); const base = p.getViewport({ scale: 1 }); const w = fitW(base.height / base.width, 560);
    const v = p.getViewport({ scale: Math.min(w * (devicePixelRatio || 1), 1200) / base.width }); const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height); c.style.width = w + 'px'; c.style.border = '1px solid #ccc';
    box.innerHTML = ''; box.append(c); await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
  }
  async function scanAll() {
    const my = ++token;
    for (let i = 0; i < Math.min(N, 20); i++) { if (my !== token) return; info.textContent = `Recherche des liens… page ${i + 1}/${Math.min(N, 20)}`; await scanPage(i); if (my !== token) return; renderCands(); }
    const site = [...found.entries()].filter(([u]) => isSite(u)); const siteQr = site.filter(([, e]) => e.qr);
    const pick = siteQr.length === 1 ? siteQr[0] : (site.length === 1 ? site[0] : null);
    if (!url.value && pick) { url.value = pick[0]; pg = [...pick[1].pages][0]; load(); renderCands(); info.textContent = `Lien du site officiel reconnu (page ${pg + 1}). Vérifiez-le puis validez.`; return; }
    const qrs = [...found.entries()].filter(([, e]) => e.qr && e.pages.size === 1);
    if (!url.value && qrs.length === 1) { url.value = qrs[0][0]; pg = [...qrs[0][1].pages][0]; load(); renderCands(); info.textContent = `QR code trouvé page ${pg + 1}. Vérifiez-le puis validez.`; }
    else if (!found.size) info.textContent = 'Aucun lien trouvé automatiquement. Allez à la page du QR code, touchez « Chercher », ou collez le lien ci-dessous.';
    else info.textContent = url.value ? 'Vérifiez le lien puis validez.' : 'Plusieurs liens trouvés : choisissez celui de la solution (souvent le QR code).';
  }
  const go = d => { pg = clamp(pg + d, 0, N - 1); load(); };
  const intro = wiz ? h('div', { class: 'note', style: 'font-size:15px;margin:0' }, h('b', {}, 'Étape 2 sur 2 – Lien de la solution. '), 'Le QR code (ou le lien écrit) qui permet de vérifier le coupable. Plusieurs liens existent dans le PDF : choisissez le bon dans la liste.')
    : h('p', { style: 'margin:0;font-size:13px' }, 'Choisissez le lien qui permet de vérifier le coupable.');
  const body = h('div', {}, intro,
    h('div', { style: 'display:flex;align-items:center;justify-content:center;gap:12px;margin:10px 0 0' }, h('button', { class: 'btn sm', onclick: () => go(-1) }, '◀'), h('span', {}, 'Page ', pnum), h('button', { class: 'btn sm', onclick: () => go(1) }, '▶'),
      h('button', { class: 'btn sm', onclick: async () => { info.textContent = 'Recherche sur cette page…'; const n0 = found.size; await scanPage(pg); renderCands(); info.textContent = found.size > n0 ? 'Lien(s) ajouté(s) à la liste.' : 'Rien de nouveau sur cette page.'; } }, 'Chercher')),
    box, info, cands, h('div', { style: 'margin-top:8px;font-size:13px;color:var(--mut)' }, 'Lien retenu :'), url);
  const ok = { label: 'Valider le lien', cls: 'pri', value: 1, fn: async () => { const u = clean(url.value); if (!/^https?:\/\/\S+\.\S+/.test(u)) { toast('Collez un lien valide (ex. lecoupablenestpaslea.fr/…)'); return false; } b.officialUrl = u; b.linkDone = true; await doSave(); toast('Lien enregistré ✓'); if (wiz) setTimeout(askCards, 300); } };
  const left = wiz ? { label: 'Passer', value: 0, fn: async () => { if (!await confirmBox('Passer cette étape ?', 'Vous ne pourrez pas ouvrir le site officiel pour valider le suspect tant que le lien n’est pas défini (menu ≡ → Lien officiel).', 'Passer', 'bad')) return false; b.linkDone = true; doSave(true); setTimeout(askCards, 300); } } : { label: 'Annuler', value: 0 };
  openModal(wiz ? 'Étape 2/2 – Lien officiel' : 'Lien officiel', body, [left, ok], { full: true, noclose: wiz, onclose: () => token++ });
  load(); scanAll();
}

/* ---------------------------------------------------------------- paramètres */
function openSettings() {
  let sm; const st = S.settings; const body = h('div', {});
  const toggle = (label, sub, val, fn) => h('div', { class: 'line' }, h('div', {}, label, sub ? h('small', {}, sub) : null), h('label', { class: 'sw2' }, h('input', { type: 'checkbox', checked: !!val, onchange: e => fn(e.target.checked) }), h('i')));
  const shapeBtn = (k, label, svg) => h('button', { class: st.shape === k ? 'on' : '', onclick: () => { if (k === 'custom' && !st.custom) { drawShape(() => { st.shape = 'custom'; saveSettings(); V.redrawAll(); render(); }); return; } st.shape = k; saveSettings(); V.redrawAll(); render(); } }, h('span', { html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">${svg}</svg>` }), label);
  function customSvg() { return st.custom && st.custom.length ? st.custom.map(s => '<path d="' + s.map((p, k) => (k ? 'L' : 'M') + (3 + p[0] * 18).toFixed(1) + ' ' + (3 + p[1] * 18).toFixed(1)).join('') + '"/>').join('') : '<path d="M5 17c3-8 5 4 8-4s4-2 6-6"/>'; }
  function render() {
    body.innerHTML = '';
    if (!st.welcome) st.welcome = { ...DEF.welcome };
    const inpStyle = 'width:100%;min-height:42px;border-radius:10px;border:1px solid #3d4559;background:#1c1f29;color:#eef0f6;padding:0 12px;font:inherit;margin-top:6px';
    const prev = h('div', { class: 'note', id: 'wprev' });
    const prevTxt = () => 'Aperçu : ' + (S.firstRun ? 'Bienvenue ' : 'Bon retour ') + welcomeName() + (S.firstRun ? ' 🔎' : ' 🕵️') + ((st.welcome.sub || '').trim() ? ' — ' + st.welcome.sub.trim() : '');
    prev.textContent = prevTxt(); const updPrev = () => { prev.textContent = prevTxt(); renderHome(); };
    body.append(
      h('div', { class: 'sec' }, h('h3', {}, 'Message d’accueil'),
        h('div', { style: 'padding:4px 0' }, h('div', {}, 'Comment vous appeler', h('small', { style: 'display:block' }, 'Apparaît après « Bienvenue » (première fois) puis « Bon retour »')), h('input', { type: 'text', value: st.welcome.name, maxlength: 30, placeholder: DEF.welcome.name, style: inpStyle, oninput: e => { st.welcome.name = e.target.value; saveSettings(); updPrev(); } })),
        h('div', { style: 'padding:8px 0 4px' }, h('div', {}, 'Phrase sous le titre', h('small', { style: 'display:block' }, 'Laissez vide pour ne rien afficher')), h('input', { type: 'text', value: st.welcome.sub, maxlength: 90, style: inpStyle, oninput: e => { st.welcome.sub = e.target.value; saveSettings(); updPrev(); } })),
        prev,
        h('div', { class: 'line' }, h('div', {}, 'Remettre le message par défaut'), h('button', { class: 'btn sm', onclick: () => { st.welcome = { ...DEF.welcome }; saveSettings(); render(); renderHome(); } }, 'Réinitialiser'))),
      h('div', { class: 'sec' }, h('h3', {}, 'Sauvegarde'),
        toggle('Enregistrement automatique', 'Après chaque modification, dans la mémoire de l’appareil', st.autosave, v => { st.autosave = v; saveSettings(); if (!v) toast('Attention : pensez à enregistrer à la main (icône en bas à gauche)', 3500); else if (S.cur) changed(); render(); }),
        !st.autosave ? h('div', { class: 'warn' }, 'Enregistrement automatique désactivé : vous devez toucher l’icône d’enregistrement du lecteur pour sauvegarder votre progression.') : null,
        h('div', { class: 'line' }, h('div', {}, 'Enregistrer maintenant'), h('button', { class: 'btn sm', onclick: () => S.cur ? manualSave() : toast('Ouvrez une enquête') }, 'Enregistrer')),
        h('div', { class: 'line' }, h('div', {}, 'Copie de secours', h('small', {}, 'Fichier .json (indices, surlignages, croix, notes, avancement – sans les PDF). 2 sauvegardes en alternance.')), h('div', { style: 'display:flex;gap:6px' }, h('button', { class: 'btn sm', onclick: () => exportData().then(render) }, 'Exporter'), h('button', { class: 'btn sm', onclick: () => $('#importfile').click() }, 'Importer'))),
        h('div', { class: 'line' }, h('div', {}, 'Rappel de sauvegarde'), h('select', { onchange: e => { st.backupDays = parseInt(e.target.value); saveSettings(); } }, [[0, 'Jamais'], [3, 'Tous les 3 jours'], [7, 'Tous les 7 jours'], [14, 'Tous les 14 jours']].map(([v, l]) => h('option', { value: v, selected: st.backupDays === v }, l)))),
        h('div', { class: 'line' }, h('div', {}, 'Méthode d’export', h('small', {}, 'Téléchargement : un seul tap, fichier dans « Téléchargements ». Partage : choisir Drive, etc.')), h('select', { onchange: e => { st.exportMode = e.target.value; saveSettings(); } }, [['download', 'Téléchargement direct'], ['share', 'Partager…']].map(([v, l]) => h('option', { value: v, selected: st.exportMode === v }, l)))),
        hasDirPicker() ? h('div', { class: 'line' }, h('div', {}, 'Dossier d’export', h('small', { id: 'dirn' }, '…')), h('button', { class: 'btn sm', onclick: async () => { if (await pickExportDir()) render(); } }, 'Choisir')) : null,
        h('div', { id: 'snaps' }),
        h('div', { class: 'line' }, h('div', {}, 'Boîte de sécurité', h('small', {}, 'Copies automatiques gardées dans l’app : chaque jour et avant chaque mise à jour'))),
        h('div', { id: 'boxl' }),
        toggle('Rappel d’export avant une mise à jour annoncée', '10 minutes avant l’heure annoncée', st.remind !== false, v => { st.remind = v; saveSettings(); }),
        toggle('Afficher les enquêtes en attente de leur PDF', 'Tuiles grises à la fin de l’accueil (venant d’une sauvegarde importée)', st.showPend !== false, v => { st.showPend = v; saveSettings(); renderHome(); }),
        (st.hidePend || []).length ? h('div', { class: 'line' }, h('div', {}, (st.hidePend || []).length + ' tuile(s) masquée(s)'), h('button', { class: 'btn sm', onclick: () => { st.hidePend = []; saveSettings(); renderHome(); render(); } }, 'Réafficher')) : null,
        h('div', { class: 'line' }, h('div', {}, 'Mise à jour', h('small', {}, 'Version installée : v' + APP_VER + '. Vos données ne sont jamais touchées.')), h('div', { style: 'display:flex;gap:6px' }, h('button', { class: 'btn sm', onclick: () => { sm && sm.close(); setTimeout(checkUpdateNow, 60); } }, 'Rechercher'), h('button', { class: 'btn sm', onclick: () => { sm && sm.close(); setTimeout(repairApp, 60); } }, 'Réparer'))),
        h('div', { class: 'line' }, h('div', {}, 'Assistant de restauration', h('small', {}, 'Retrouver ses enquêtes : choisir les PDF puis le fichier de sauvegarde')), h('button', { class: 'btn sm', onclick: () => { sm && sm.close(); setTimeout(startRestoreWizard, 60); } }, 'Lancer')),
        h('div', { class: 'line', id: 'persist' }, h('div', {}, 'Stockage protégé', h('small', { id: 'pst' }, '…')), h('button', { class: 'btn sm', onclick: askPersist }, 'Demander')),
        h('div', { class: 'note' }, 'Les données sont stockées dans le navigateur de cet appareil. Installez l’app sur l’écran d’accueil et faites une copie de secours de temps en temps.')),
      h('div', { class: 'sec' }, h('h3', {}, 'Forme du barrement'),
        h('div', { class: 'shapes' }, shapeBtn('cross', 'Croix', '<path d="M5 5l14 14M19 5L5 19"/>'), shapeBtn('square', 'Cadre', '<rect x="4" y="4" width="16" height="16" rx="2"/>'), shapeBtn('custom', 'Ma forme', customSvg())),
        h('div', { class: 'line' }, h('div', {}, 'Dessiner ma forme', h('small', {}, 'Tracez au doigt le barrement de votre choix')), h('div', { style: 'display:flex;gap:6px' }, h('button', { class: 'btn sm', onclick: () => drawShape(() => { st.shape = 'custom'; saveSettings(); V.redrawAll(); render(); }) }, 'Dessiner'), h('button', { class: 'btn sm', onclick: () => { st.custom = null; if (st.shape === 'custom') st.shape = 'cross'; saveSettings(); V.redrawAll(); render(); } }, 'Réinit.')))),
      h('div', { class: 'sec' }, h('h3', {}, 'Défilement des pages'), h('div', { class: 'shapes' }, [['v', 'Vertical'], ['h', 'Horizontal']].map(([k, l]) => h('button', { class: st.scroll === k ? 'on' : '', onclick: () => { st.scroll = k; saveSettings(); if (S.cur) { const p = V.curPage; V.layout(); V.goTo(p); } render(); } }, l)))),
      h('div', { class: 'sec' }, h('h3', {}, 'Surlignage'),
        h('div', { class: 'line' }, h('div', {}, 'Opacité'), h('input', { type: 'range', min: 0.2, max: 0.9, step: 0.05, value: st.hlOp, onchange: e => { st.hlOp = parseFloat(e.target.value); saveSettings(); V.redrawAll(); } })),
        h('div', { class: 'line' }, h('div', {}, 'Séparation des mots', h('small', {}, 'Plus haut = regroupe davantage (prénoms composés)')), h('input', { type: 'range', min: 0.5, max: 2.5, step: 0.1, value: st.sens, onchange: e => { st.sens = parseFloat(e.target.value); saveSettings(); } }))),
      h('div', { class: 'sec' }, h('h3', {}, 'Interface du lecteur'),
        h('div', { class: 'line' }, h('div', {}, 'Personnaliser l’interface', h('small', {}, 'Ordre des blocs, taille de l’indice, outils à afficher ou retirer')), h('button', { class: 'btn sm', onclick: () => { sm && sm.close(); setTimeout(openUiPanel, 60); } }, 'Ouvrir'))),
      h('div', { class: 'sec' }, h('h3', {}, 'Aide'), h('div', { class: 'line' }, h('div', {}, 'Nouveautés', h('small', {}, 'Version ' + APP_VER)), h('button', { class: 'btn sm', onclick: () => maybeShowNews(true) }, 'Voir')), h('div', { class: 'line' }, h('div', {}, 'Tutoriel', h('small', {}, S.cur ? 'Visite guidée du lecteur' : 'Visite guidée de l’accueil')), h('button', { class: 'btn sm', onclick: () => { sm && sm.close(); setTimeout(() => startTuto(S.cur ? 'reader' : 'home'), 200); } }, 'Revoir'))),
      h('div', { class: 'sec' }, h('button', { class: 'btn bad', style: 'width:100%', onclick: async () => { if (await confirmBox('Réinitialiser les paramètres ?', 'Tous les paramètres reviennent à leurs valeurs par défaut. Vos enquêtes ne sont pas touchées.', 'Réinitialiser', 'bad')) { S.settings = structuredClone(DEF); applyHide(); saveSettings(); V.redrawAll(); render(); } } }, 'Tout réinitialiser aux valeurs par défaut')),
      h('p', { style: 'font-size:12px;color:var(--mut);text-align:center' }, 'Cette application ne contacte aucun serveur : vos PDF et vos annotations ne quittent jamais votre appareil.'));
    updPersist(); updSnaps(); updDir(); fillBox();
  }
  async function updDir() { const e = $('#dirn'); if (!e) return; try { const dh = await dbGet('kv', 'dirHandle'); e.textContent = dh ? dh.name + ' (les fichiers n°1 et n°2 y sont remplacés)' : 'Non choisi'; } catch (_) { e.textContent = 'Non choisi'; } }
  async function updSnaps() {
    const box = $('#snaps'); if (!box) return; box.innerHTML = '';
    for (const n of [1, 2]) { const sn = await dbGet('kv', 'snap' + n); if (!sn) continue; const when = new Date(sn.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      box.append(h('div', { class: 'line' }, h('div', {}, 'Copie interne n°' + n, h('small', {}, when)), h('button', { class: 'btn sm', onclick: async () => { try { await applyBackup(JSON.parse(sn.json)); } catch (e) { toast('Copie illisible'); } } }, 'Restaurer'))); }
  }
  async function updPersist() { const e = $('#pst'); if (!e) return; try { const p = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; e.textContent = p ? 'Oui : le navigateur ne devrait pas effacer vos données' : 'Non accordé : faites des copies de secours'; } catch (_) { e.textContent = 'Indisponible'; } }
  async function askPersist() { try { const ok = await navigator.storage.persist(); toast(ok ? 'Stockage protégé ✓' : 'Refusé par le navigateur (essayez après installation sur l’écran d’accueil)', 3500); } catch (_) { toast('Indisponible'); } updPersist(); }
  render(); sm = openModal('Paramètres', body, [{ label: 'Fermer', cls: 'pri', value: 1 }], { full: true });
}
function drawShape(done) {
  const c = h('canvas', { id: 'pad', width: 520, height: 520 }); const ctx = c.getContext('2d'); let strokes = [], cur = null;
  const redraw = () => { ctx.clearRect(0, 0, 520, 520); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 518, 518); ctx.strokeStyle = '#e6194b'; ctx.lineWidth = 12; ctx.lineCap = ctx.lineJoin = 'round'; for (const s of strokes) { ctx.beginPath(); s.forEach((p, k) => k ? ctx.lineTo(p[0] * 520, p[1] * 520) : ctx.moveTo(p[0] * 520, p[1] * 520)); if (s.length === 1) ctx.lineTo(s[0][0] * 520 + 0.1, s[0][1] * 520); ctx.stroke(); } };
  const pt = e => { const r = c.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
  c.onpointerdown = e => { c.setPointerCapture(e.pointerId); cur = [pt(e)]; strokes.push(cur); redraw(); }; c.onpointermove = e => { if (cur) { cur.push(pt(e)); redraw(); } }; c.onpointerup = () => cur = null;
  redraw();
  openModal('Dessinez votre barrement', h('div', {}, h('p', { style: 'margin-top:0' }, 'Le dessin sera étiré pour couvrir chaque fiche barrée.'), c), [
    { label: 'Effacer', fn: () => { strokes = []; redraw(); return false; } }, { label: 'Annuler', value: 0 },
    { label: 'Enregistrer', cls: 'pri', value: 1, fn: () => { if (!strokes.length) { toast('Dessinez quelque chose'); return false; } S.settings.custom = strokes.map(s => s.filter((p, k) => k % 2 === 0 || k === s.length - 1).map(p => [+p[0].toFixed(3), +p[1].toFixed(3)])); saveSettings(); done(); } }]);
}

/* ---------------------------------------------------------------- export / import */
function bookState(b) { const { id, title, status, culprit, officialUrl, notes, pinNote, disabled, linkDone, clues, clueIdx, cluePage, clueRect, ann, crossSize, crossTh, pos, attempts, cardGrid, cardAsked } = b; return { id, title, status, culprit, officialUrl, notes, pinNote, disabled, linkDone, clues, clueIdx, cluePage, clueRect, ann, crossSize, crossTh, pos, attempts, cardGrid, cardAsked }; }
const hasDirPicker = () => 'showDirectoryPicker' in window;
async function getDirHandle(ask) {
  if (!hasDirPicker()) return null;
  try { const dh = await dbGet('kv', 'dirHandle'); if (!dh) return null; let p = await dh.queryPermission({ mode: 'readwrite' }); if (p !== 'granted' && ask) p = await dh.requestPermission({ mode: 'readwrite' }); return p === 'granted' ? dh : null; } catch (e) { return null; }
}
async function pickExportDir() {
  try { const dh = await window.showDirectoryPicker({ mode: 'readwrite' }); await dbPut('kv', dh, 'dirHandle'); toast('Dossier d’export choisi : ' + dh.name); return true; } catch (e) { return false; }
}
async function exportData() {
  if (S.cur) await doSave(true);
  const meta = (await dbGet('kv', 'backupMeta')) || {}; const slot = meta.slot === 1 ? 2 : 1;
  const data = { format: 'enquetes-backup', v: 1, at: new Date().toISOString(), settings: S.settings, books: S.books.map(bookState) };
  const json = JSON.stringify(data), blob = new Blob([json], { type: 'application/json' });
  const day = new Date().toISOString().slice(0, 10); let ok = false, where = '';
  try { const dh = await getDirHandle(true); if (dh) { const fh = await dh.getFileHandle(`enquetes-sauvegarde-${slot}.json`, { create: true }); const w = await fh.createWritable(); await w.write(blob); await w.close(); ok = true; where = 'dans le dossier « ' + dh.name + ' » (remplace l’ancien fichier n°' + slot + ')'; } } catch (e) { console.error(e); }
  if (!ok) {
    const name = `enquetes-sauvegarde-${slot}-${day}.json`; const f = new File([blob], name, { type: 'application/json' });
    if (S.settings.exportMode === 'share' && navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: name }); ok = true; where = 'via le partage'; } catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    if (!ok) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); ok = true; where = 'dans « Téléchargements » : ' + name; }
  }
  if (ok) {
    meta.last = Date.now(); meta.slot = slot; S.bk = meta; try { await dbPut('kv', meta, 'backupMeta'); await dbPut('kv', { at: meta.last, json }, 'snap' + slot); } catch (e) { console.error(e); }
    toast('Sauvegarde n°' + slot + ' enregistrée ' + where, 4500);
  }
  return ok;
}
function backupPrompt(reason) {
  const txt = reason === 'end' ? 'Bravo, enquête terminée ! C’est un bon moment pour sauvegarder votre progression.' : 'Pensez à sauvegarder vos enquêtes (indices, surlignages, croix, notes). Un fichier de secours, rangé sur votre téléphone ou dans votre Drive, évite de tout perdre.';
  return openModal('Sauvegarde', h('div', {}, h('p', { style: 'margin:0' }, txt), h('p', { style: 'color:var(--mut);font-size:13px' }, 'Deux sauvegardes sont conservées en alternance : la 3ᵉ remplace la 1ʳᵉ, et ainsi de suite.')),
    [{ label: 'Plus tard', value: 0, fn: async () => { const m = (await dbGet('kv', 'backupMeta')) || {}; m.snooze = Date.now() - (S.settings.backupDays || 7) * 864e5 + 864e5; await dbPut('kv', m, 'backupMeta'); } },
     { label: 'Sauvegarder maintenant', cls: 'pri', value: 1, fn: async () => { const ok = await exportData(); if (!ok) return false; } }]).promise;
}
async function checkBackupReminder() {
  const d = S.settings.backupDays; if (!d || !S.books.length || document.querySelector('.modal')) return;
  const m = (await dbGet('kv', 'backupMeta')) || {}; if (!m.since) { m.since = Date.now(); await dbPut('kv', m, 'backupMeta'); }
  if (Date.now() - Math.max(m.last || 0, m.since, m.snooze || 0) < d * 864e5) return;
  backupPrompt('launch');
}
async function applyBackup(d, ask = true) {
  if (!d || d.format !== 'enquetes-backup' || !Array.isArray(d.books)) throw 0;
  if (ask && !await confirmBox('Importer la sauvegarde ?', `${d.books.length} enquête(s). Pour celles déjà présentes, la progression actuelle sera remplacée. Les autres seront appliquées quand vous rechargerez le même PDF.`, 'Importer')) return false;
  for (const st of d.books) {
    const b = S.books.find(x => x.id === st.id);
    if (b) { Object.assign(b, st); normNotes(b); await dbPut('books', JSON.parse(JSON.stringify(b))); } else await dbPut('pending', st, st.id);
  }
  if (d.settings) { S.settings = Object.assign(structuredClone(DEF), d.settings); applyHide(); saveSettings(); }
  toast('Sauvegarde importée ✓'); if (S.cur) { const id = S.cur.id; S.cur = S.books.find(x => x.id === id); setClue(S.cur.clueIdx, true); V.redrawAll(); } await refreshPend(); renderHome();
  const miss = d.books.filter(st => !S.books.find(b => b.id === st.id)); if (miss.length) setTimeout(() => offerMissing(miss), 150); return true;
}
async function importData(file) { let d; try { d = JSON.parse(await file.text()); } catch (e) { toast('Ce fichier n’est pas une sauvegarde (« ' + (file.name || '?') + ' » illisible)'); return false; } try { return (await applyBackup(d, !S.wiz)) !== false; } catch (e) { console.error(e); toast('Ce fichier JSON n’est pas une sauvegarde de l’app Enquêtes'); return false; } }



/* ---------------------------------------------------------------- personnalisation de l'interface */
const UI_BLOCKS = { clue: ['Indice', 'Le bandeau avec le texte de l’indice'], vp: ['Pages', 'La zone où on lit et on annote'], tools: ['Outils', 'Surligner, couleur, barrer, gomme…'], nav: ['Navigation', 'Flèches de page, enregistrer, menu'] };
function openUiPanel() {
  const st = S.settings; const body = h('div', {});
  const save = full => { full ? applyHide() : applyUI(); saveSettings(); };
  const seg = (cur, opts, fn) => h('div', { class: 'shapes' }, opts.map(([v, l]) => h('button', { class: cur === v ? 'on' : '', onclick: () => { fn(v); save(); draw(); } }, l)));
  const tog = (label, sub, val, fn, full) => h('div', { class: 'line' }, h('div', {}, label, sub ? h('small', {}, sub) : null), h('label', { class: 'sw2' }, h('input', { type: 'checkbox', checked: !!val, onchange: e => { fn(e.target.checked); save(full); } }), h('i')));
  const draw = () => {
    body.innerHTML = ''; const u = normUI();
    const move = (i, d) => { const j = i + d; if (j < 0 || j > 3) return; [u.order[i], u.order[j]] = [u.order[j], u.order[i]]; save(); draw(); };
    const pct = h('b', {}, Math.round(u.scale * 100) + ' %');
    body.append(
      h('h4', { class: 'nsec' }, 'Ordre des blocs, de haut en bas'),
      h('div', { class: 'hint' }, 'Touchez ▲ ▼ pour déplacer un bloc. Les changements sont enregistrés tout de suite : fermez cette fenêtre pour voir le résultat.'),
      ...u.order.map((k, i) => h('div', { class: 'line' }, h('div', {}, (i + 1) + '. ' + UI_BLOCKS[k][0], h('small', {}, UI_BLOCKS[k][1])),
        h('div', { style: 'display:flex;gap:6px' },
          h('button', { class: 'btn sm', 'aria-label': 'Monter', disabled: i === 0, onclick: () => move(i, -1) }, ic('up', 16)),
          h('button', { class: 'btn sm', 'aria-label': 'Descendre', disabled: i === 3, onclick: () => move(i, 1) }, ic('down', 16))))),
      h('h4', { class: 'nsec' }, 'Indice'),
      h('div', { class: 'line' }, h('div', {}, 'Taille du texte', h('small', {}, 'Tout l’indice et sa note')), pct),
      h('input', { type: 'range', min: 0.8, max: 1.6, step: 0.1, value: u.scale, style: 'width:100%', oninput: e => { u.scale = parseFloat(e.target.value); pct.textContent = Math.round(u.scale * 100) + ' %'; applyUI(); }, onchange: () => save() }),
      h('div', { class: 'line' }, h('div', {}, 'Hauteur maximale du bandeau', h('small', {}, 'Au-delà, le texte défile'))),
      seg(u.cmh, [[70, 'Compacte'], [112, 'Normale'], [170, 'Grande'], [240, 'Très grande']], v => { u.cmh = v; }),
      h('div', { class: 'line' }, h('div', {}, 'Liste et flèches d’indice')),
      seg(u.ctlLeft ? 'l' : 'r', [['l', 'À gauche'], ['r', 'À droite']], v => { u.ctlLeft = v === 'l'; }),
      h('div', { class: 'line' }, h('div', {}, 'Colonne notes / pages masquées')),
      seg(u.sideRight ? 'r' : 'l', [['l', 'À gauche'], ['r', 'À droite']], v => { u.sideRight = v === 'r'; }),
      h('h4', { class: 'nsec' }, 'Outils et fonctionnalités'),
      h('div', { class: 'hint' }, 'Désactivez ce que vous n’utilisez pas : l’interface se réorganise et gagne de la place. Rien n’est supprimé, vous pouvez tout réactiver.'),
      ...HIDE_ITEMS.map(([k, l, sub]) => tog(l, sub, !st.hide[k], v => { st.hide[k] = !v; }, true)),
      h('div', { class: 'line' }, h('div', {}, 'Tout réactiver'), h('button', { class: 'btn sm', onclick: () => { st.hide = { ...DEF.hide }; save(true); draw(); } }, 'Réactiver')),
      h('h4', { class: 'nsec' }, 'Affichage'),
      tog('Affichage compact', 'Boutons sans texte, bandeau plus serré', u.compact, v => { u.compact = v; }));
  };
  draw();
  const m = openModal('Personnaliser l’interface', body, [{ label: 'Tout remettre', value: 0, fn: () => { st.ui = structuredClone(DEF.ui); save(); draw(); return false; } }, { label: 'Fermer', cls: 'pri', value: 1 }], { full: true });
}

/* ---------------------------------------------------------------- boîte de sécurité (copies automatiques) */
const boxDB = () => new Promise((res, rej) => { const r = indexedDB.open('enquetes-box', 1); r.onupgradeneeded = () => r.result.createObjectStore('snaps', { keyPath: 'at' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const boxTx = (mode, fn) => boxDB().then(d => new Promise((res, rej) => { const t = d.transaction('snaps', mode), rq = fn(t.objectStore('snaps')); t.oncomplete = () => { d.close(); res(rq && rq.result); }; t.onerror = t.onabort = () => { d.close(); rej(t.error); }; }));
const boxList = async () => ((await boxTx('readonly', st => st.getAll())) || []).sort((x, y) => y.at - x.at);
async function boxSnapshot(reason) {
  const books = await dbAll('books'), pend = await dbAll('pending'); if (!books.length && !pend.length) return null;
  const data = { format: 'enquetes-backup', v: 1, at: new Date().toISOString(), settings: S.settings, books: [...books.map(bookState), ...pend] };
  const snap = { at: Date.now(), reason, ver: APP_VER, n: books.length, json: JSON.stringify(data) };
  await boxTx('readwrite', st => st.put(snap));
  const all = await boxList(); for (const s of all.slice(6)) await boxTx('readwrite', st => st.delete(s.at));
  return snap;
}
async function boxAuto() {
  try {
    const lv = await dbGet('kv', 'lastVer');
    if (lv !== APP_VER) { if (S.books.length) await boxSnapshot(lv ? `avant la mise à jour v${lv} → v${APP_VER}` : `avant la mise à jour v${APP_VER}`); await dbPut('kv', APP_VER, 'lastVer'); }
    else if (S.books.length) { const l = await boxList(); if (!l[0] || Date.now() - l[0].at > 864e5) await boxSnapshot('copie automatique'); }
  } catch (e) { console.error(e); }
}
async function fillBox() {
  const el = $('#boxl'); if (!el) return; let list = []; try { list = await boxList(); } catch (e) { }
  el.innerHTML = ''; if (!list.length) { el.append(h('div', { class: 'note' }, 'Aucune copie automatique pour le moment.')); return; }
  list.forEach(s => el.append(h('div', { class: 'line' }, h('div', {}, new Date(s.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), h('small', {}, `${s.reason} · ${s.n} enquête${s.n > 1 ? 's' : ''}`)),
    h('button', { class: 'btn sm', onclick: async () => { try { await applyBackup(JSON.parse(s.json)); } catch (e) { console.error(e); toast('Copie illisible'); } } }, 'Restaurer'))));
}

/* ---------------------------------------------------------------- rappels, annonces et mises à jour */
let lastChk = 0;
async function homeChecks(force) {
  if (!force && Date.now() - lastChk < 3 * 3600e3) return;
  if (S.cur || document.querySelector('.modal')) return;
  lastChk = Date.now(); try { S.reg && S.reg.update().catch(() => { }); } catch (e) { }
  await annTick(true); await checkBackupReminder();
}
async function fetchAnn() { try { const r = await fetch('annonce.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return null; const j = await r.json(); return j && j.version ? j : null; } catch (e) { return null; } }
async function annTick(refetch) {
  if (refetch || !S.annAt || Date.now() - S.annAt > 5 * 60e3) { const had = JSON.stringify(S.ann || null); S.ann = await fetchAnn(); S.annAt = Date.now(); if (!S.cur && had !== JSON.stringify(S.ann || null) && !document.querySelector('.modal')) renderHome(); }
  const a = S.ann; if (!a || !(+a.version > +APP_VER) || document.querySelector('.modal')) return;
  const at = new Date(a.date).getTime(); if (!at || isNaN(at)) return;
  const mins = (at - Date.now()) / 60000, before = +a.avant || 30, rem = +a.rappel || 10, key = a.version + '|' + a.date, inWin = mins > -10;
  const shown = (await dbGet('kv', 'annShown')) || {}; const mark = async k => { shown[key + k] = Date.now(); await dbPut('kv', shown, 'annShown'); };
  const hhmm = new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const ask = (title, text) => openModal(title, h('div', {}, h('p', { style: 'margin:0 0 8px' }, text), a.message ? h('p', { class: 'hint' }, a.message) : null), [{ label: 'Plus tard', value: 0 }, { label: 'Sauvegarder maintenant', cls: 'pri', value: 1, fn: () => exportData() }]);
  if (S.settings.remind !== false && inWin && mins <= rem && !shown[key + 'b']) { await mark('b'); await mark('a'); ask('Sauvegarde avant la mise à jour', `La mise à jour est prévue à ${hhmm}${mins > 1 ? ' (dans ' + Math.round(mins) + ' min)' : ''}. Faites un export de sécurité maintenant : c’est rapide.`); return; }
  if (inWin && mins <= before && !shown[key + 'a']) { await mark('a'); ask('Mise à jour bientôt', `Une mise à jour est prévue à ${hhmm}. Pensez à faire une sauvegarde avant, par sécurité.`); }
}
function registerSW() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => { S.reg = reg; }).catch(() => { });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had || S.applyingUpdate) return; S.updateReady = true; if (!S.cur) renderHome(); else toast('Nouvelle version prête : touchez « Redémarrer » sur l’accueil', 5000); });
}

async function swVersion() {
  try { const r = await fetch('sw.js?t=' + Date.now(), { cache: 'no-store' }); const m = (await r.text()).match(/enquetes-v(\d+)/); return m ? +m[1] : null; } catch (e) { return null; }
}
async function checkUpdateNow() {
  if (!navigator.onLine) { toast('Pas de connexion internet', 2500); return; }
  toast('Recherche en cours…', 4000);
  const v = await swVersion();
  if (v == null) { toast('Impossible de joindre le serveur', 3000); return; }
  if (v <= +APP_VER) { toast('Vous avez la dernière version (v' + APP_VER + ') ✓', 3000); return; }
  if (S.reg) { try { await S.reg.update(); } catch (e) { } }
  const ok = await confirmBox('Nouvelle version disponible', 'La version ' + v + ' est disponible (vous avez la ' + APP_VER + '). Une copie de sécurité est faite avant. Installer maintenant ?', 'Installer');
  if (ok) applyUpdate();
}
async function repairApp() {
  const ok = await confirmBox('Réparer l’app ?', 'L’app va se recharger depuis internet (utile si quelque chose semble bloqué ou pas à jour). Vos enquêtes, notes, surlignages et sauvegardes ne sont PAS touchés. Une copie de sécurité est faite avant.', 'Réparer');
  if (!ok) return;
  try { await boxSnapshot('avant réparation'); } catch (e) { console.error(e); }
  if (S.cur) await doSave(true);
  S.applyingUpdate = true;
  try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch (e) { }
  try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } catch (e) { }
  location.reload();
}
async function applyUpdate() {
  try { await boxSnapshot('avant la mise à jour'); } catch (e) { console.error(e); }
  if (S.cur) await doSave(true);
  S.applyingUpdate = true; location.reload();
}
function homeBanners() {
  const out = [];
  if (S.updateReady) out.push(h('div', { class: 'hbanner ok' }, h('div', {}, h('b', {}, '✅ Nouvelle version prête'), h('small', {}, 'Une copie de sécurité est faite avant de redémarrer.')), h('button', { class: 'btn sm pri', onclick: applyUpdate }, 'Redémarrer')));
  const a = S.ann; if (a && +a.version > +APP_VER) {
    const at = new Date(a.date), ok = !isNaN(at.getTime()), fut = ok && at.getTime() > Date.now();
    const when = ok ? at.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
    out.push(h('div', { class: 'hbanner' }, h('div', {}, h('b', {}, fut ? '🛠️ Mise à jour prévue' : '🛠️ Mise à jour disponible'), h('small', {}, (fut ? when : 'Fermez complètement puis rouvrez l’app pour l’installer') + (a.message ? ' · ' + a.message : ''))), h('button', { class: 'btn sm', onclick: () => exportData().then(() => renderHome()) }, 'Sauvegarder')));
  }
  const d = S.settings.backupDays;
  if (d && S.books.length && S.bk) { const ref = Math.max(S.bk.last || 0, S.bk.since || 0), days = ref ? Math.floor((Date.now() - ref) / 864e5) : 0;
    if (ref && days >= d) out.push(h('div', { class: 'hbanner warn' }, h('div', {}, h('b', {}, '💾 Pensez à sauvegarder'), h('small', {}, S.bk.last ? `Dernière sauvegarde : il y a ${days} jour${days > 1 ? 's' : ''}` : `Aucune sauvegarde depuis ${days} jours`)), h('button', { class: 'btn sm pri', onclick: () => exportData().then(() => renderHome()) }, 'Sauvegarder'))); }
  return out;
}

/* ---------------------------------------------------------------- enquêtes en attente de leur PDF + assistant de restauration */
async function refreshPend() { try { S.pend = await dbAll('pending'); } catch (e) { S.pend = []; } }
function pendTiles() {
  const st = S.settings; if (st.showPend === false) return [];
  return (S.pend || []).filter(p => !(st.hidePend || []).includes(p.id) && !S.books.find(b => b.id === p.id)).map(p => h('div', { class: 'tile pend', onclick: () => pendAsk(p) },
    h('div', { class: 'pn' }, h('span', { class: 'pe' }, '📄'), h('b', {}, p.title || 'Enquête'), h('small', {}, 'PDF à rajouter')),
    h('div', { class: 'more', onclick: e => { e.stopPropagation(); pendMenu(p); } }, ic('more', 18))));
}
function pendAsk(p) {
  openModal(p.title || 'Enquête', h('p', { style: 'margin:0' }, 'Cette enquête est dans votre sauvegarde, mais son PDF n’est pas sur cet appareil. Choisissez-le pour retrouver votre progression.'),
    [{ label: 'Plus tard', value: 0 }, { label: 'Choisir le PDF', cls: 'pri', value: 1, fn: () => { $('#file').click(); } }]);
}
function pendMenu(p) {
  openModal(p.title || 'Enquête', h('p', { style: 'margin:0' }, 'Masquer cette tuile grise ? Votre sauvegarde et votre progression ne sont pas touchées. Vous pourrez la réafficher dans Paramètres > Sauvegarde.'),
    [{ label: 'Annuler', value: 0 }, { label: 'Masquer', cls: 'pri', value: 1, fn: async () => { const st = S.settings; st.hidePend = [...(st.hidePend || []), p.id]; await saveSettings(); renderHome(); } }]);
}
function offerMissing(miss) {
  const names = miss.map(m => '« ' + (m.title || 'Enquête') + ' »').join(', ');
  openModal('Des PDF manquent', h('div', {}, h('p', { style: 'margin:0 0 8px' }, miss.length + ' enquête' + (miss.length > 1 ? 's' : '') + ' de la sauvegarde ' + (miss.length > 1 ? 'n’ont' : 'n’a') + ' pas encore leur PDF : ' + names + '.'), h('p', { class: 'hint' }, 'Voulez-vous les ajouter maintenant ? Sinon elles resteront en tuiles grises à la fin de l’accueil, que vous pourrez masquer.')),
    [{ label: 'Plus tard', value: 0 }, { label: 'Choisir les PDF', cls: 'pri', value: 1, fn: () => { $('#file').click(); } }]);
}
function startRestoreWizard() {
  S.wiz = { step: 1 };
  S.wiz.m = openModal('Retrouver mes enquêtes', h('div', {}, h('p', { style: 'margin:0 0 8px' }, h('b', {}, 'Étape 1 sur 2. '), 'Choisissez les PDF de vos enquêtes (vous pouvez en sélectionner plusieurs d’un coup).'), h('p', { class: 'hint' }, 'Ce sont les mêmes PDF que ceux que vous aviez chargés dans l’ancienne version.')),
    [{ label: 'Annuler', value: 0, fn: () => { S.wiz = null; } }, { label: 'Choisir les PDF', cls: 'pri', fn: () => { $('#file').click(); return false; } }], { noclose: true });
}
function wizStep2() {
  S.wiz.m = openModal('Retrouver mes enquêtes', h('div', {}, h('p', { style: 'margin:0 0 8px' }, h('b', {}, 'Étape 2 sur 2. '), 'Choisissez maintenant votre fichier de sauvegarde (.json).'), h('p', { class: 'hint' }, 'C’est le fichier créé par « Copie de secours > Exporter » dans l’ancienne version.')),
    [{ label: 'Passer', value: 0, fn: () => { S.wiz = null; } }, { label: 'Choisir la sauvegarde', cls: 'pri', fn: () => { $('#importfile').click(); return false; } }], { noclose: true });
}
function welcomeAsk() {
  const done = restore => { S.settings.wizAsked = true; if (restore) S.settings.tutoHome = S.settings.tutoReader = true; saveSettings(); if (restore) setTimeout(startRestoreWizard, 60); else if (!S.settings.tutoHome) setTimeout(async () => { if (!S.cur) { await startTuto('home'); S.settings.tutoHome = true; saveSettings(); } }, 200); };
  openModal('Bienvenue 🔎', h('p', { style: 'margin:0' }, 'Avez-vous déjà utilisé cette application avant (par exemple sur une ancienne adresse) et gardé un fichier de sauvegarde ?'),
    [{ label: 'Non, première fois', value: 0, fn: () => done(false) }, { label: 'Oui, j’ai une sauvegarde', cls: 'pri', value: 1, fn: () => done(true) }], { noclose: true });
}

/* ---------------------------------------------------------------- export du PDF annoté */
const loadJsPDF = () => window.jspdf ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'jspdf.umd.min.js'; s.onload = res; s.onerror = () => rej(new Error('jspdf')); document.head.append(s); });
async function deliverFile(blob, name) {
  const f = new File([blob], name, { type: blob.type });
  if (S.settings.exportMode === 'share' && navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: name }); return 'share'; } catch (e) { if (e && e.name === 'AbortError') return false; } }
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); return 'download';
}
function openExportPdf() {
  const b = S.cur; let scope = 'all', q = 'n'; const dis = b.disabled || [];
  const count = s => s === 'all' ? b.numPages : s === 'ann' ? new Set(b.ann.map(x => x.page)).size : b.numPages - dis.length;
  const body = h('div', {});
  const draw = () => {
    body.innerHTML = '';
    body.append(h('p', { style: 'margin:0 0 10px' }, 'Crée un PDF où vos surlignages, croix et traits sont intégrés à chaque page, pratique pour le partager.'),
      h('div', { class: 'line' }, h('b', {}, 'Pages à inclure')),
      h('div', { class: 'shapes' }, [['all', 'Toutes'], ['ann', 'Annotées'], ['vis', 'Sans les masquées']].map(([k, l]) => h('button', { class: scope === k ? 'on' : '', onclick: () => { scope = k; draw(); } }, l, h('small', {}, count(k) + ' page' + (count(k) > 1 ? 's' : ''))))),
      h('div', { class: 'line' }, h('b', {}, 'Qualité')),
      h('div', { class: 'shapes' }, [['n', 'Normale', 'fichier plus léger'], ['h', 'Haute', 'plus lourd, plus long']].map(([k, l, s]) => h('button', { class: q === k ? 'on' : '', onclick: () => { q = k; draw(); } }, l, h('small', {}, s)))),
      h('p', { class: 'hint' }, 'Les pages sont converties en images : le PDF n’a pas besoin d’Internet. Gardez l’application ouverte pendant l’export (quelques minutes pour une enquête complète).'));
  };
  draw();
  openModal('Exporter le PDF annoté', body, [{ label: 'Annuler', value: 0 }, { label: 'Exporter', cls: 'pri', value: 1, fn: () => { setTimeout(() => runExportPdf(scope, q), 60); } }]);
}
async function runExportPdf(scope, q) {
  const b = S.cur; await doSave(true);
  const dis = b.disabled || []; let idxs = [...Array(b.numPages).keys()];
  if (scope === 'ann') { const s = new Set(b.ann.map(x => x.page)); idxs = idxs.filter(i => s.has(i)); } else if (scope === 'vis') idxs = idxs.filter(i => !dis.includes(i));
  if (!idxs.length) { toast('Aucune page à exporter avec ce choix'); return; }
  try { await loadJsPDF(); } catch (e) { toast('Module d’export introuvable'); return; }
  let stop = false; const txt = h('div', {}, 'Préparation…');
  const fill = h('i', { style: 'display:block;height:100%;width:0;background:var(--accent);transition:width .2s' });
  const pm = openModal('Export du PDF', h('div', {}, txt, h('div', { style: 'height:12px;border-radius:6px;background:#10121a;border:1px solid #343a4b;overflow:hidden;margin-top:10px' }, fill), h('p', { class: 'hint' }, 'Gardez l’application ouverte pendant l’export.')),
    [{ label: 'Annuler', value: 0, fn: () => { stop = true; } }], { noclose: true });
  const W = q === 'h' ? 1600 : 1100, Q = q === 'h' ? 0.86 : 0.78; let pdf = null;
  try {
    for (let k = 0; k < idxs.length && !stop; k++) {
      const i = idxs[k]; txt.textContent = `Page ${i + 1} (${k + 1} / ${idxs.length})`; fill.style.width = (k / idxs.length * 100) + '%';
      const pg = await S.doc.getPage(i + 1); const base = pg.getViewport({ scale: 1 }); const c = await renderThumb(S.doc, i + 1, W);
      const ratio = base.height / base.width, ctx = c.getContext('2d'), m = V.annMarkup(i, false);
      const lay = async (inner, blend) => {
        if (!inner) return; const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 ${ratio}" width="${c.width}" height="${c.height}" preserveAspectRatio="none">${inner}</svg>`;
        const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
        ctx.globalCompositeOperation = blend; ctx.drawImage(img, 0, 0, c.width, c.height); ctx.globalCompositeOperation = 'source-over';
      };
      await lay(m.hl, 'multiply'); await lay(m.dr, 'source-over');
      const w = base.width, hh = base.height, o = w > hh ? 'l' : 'p';
      if (!pdf) pdf = new window.jspdf.jsPDF({ unit: 'pt', format: [w, hh], orientation: o, compress: true }); else pdf.addPage([w, hh], o);
      pdf.addImage(c.toDataURL('image/jpeg', Q), 'JPEG', 0, 0, w, hh, undefined, 'FAST'); c.width = c.height = 0;
      await new Promise(r => setTimeout(r, 0));
    }
    if (stop) { pm.close(); toast('Export annulé'); return; }
    fill.style.width = '100%'; txt.textContent = 'Finalisation…'; await new Promise(r => setTimeout(r, 40));
    const blob = pdf.output('blob'); pm.close();
    const name = (b.title || 'enquete').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) + ' - annoté.pdf';
    const r = await deliverFile(blob, name); if (r) toast(`PDF prêt (${(blob.size / 1048576).toFixed(1)} Mo) ` + (r === 'share' ? 'via le partage' : 'dans « Téléchargements »'), 4500);
  } catch (e) { console.error(e); pm.close(); toast('Échec de l’export (mémoire insuffisante ?). Essayez « Normale » ou « Annotées ».', 5500); }
}

/* ---------------------------------------------------------------- nouveautés */

/* ---------------------------------------------------------------- bouton « retour » du téléphone */
const NAV = { guard: false, skip: 0, t: 0 };
const hasLayer = () => !!document.querySelector('.modal,.drawer-bg,#tuto') || (!!$('#reader') && !$('#reader').classList.contains('hidden'));
function navSync() {
  clearTimeout(NAV.t);
  NAV.t = setTimeout(() => {
    const need = hasLayer();
    if (need && !NAV.guard) { try { history.pushState({ g: 1 }, ''); NAV.guard = true; } catch (e) { } }
    else if (!need && NAV.guard) { NAV.guard = false; NAV.skip++; history.back(); }
  }, 60);
}
function onBack() {
  const tuto = $('#tuto'); if (tuto) { const b = tuto.querySelector('.tskip'); b && b.click(); return; }
  const ms = [...document.querySelectorAll('.modal')]; const top = ms[ms.length - 1];
  if (top) { if (top._noclose) { toast('Terminez cette étape (ou touchez « Passer »)', 2200); return; } top._api ? top._api.close(null) : top.remove(); return; }
  const bg = document.querySelector('.drawer-bg'); if (bg) { bg.dispatchEvent(new Event('pointerdown')); return; }
  if (S.cur && !$('#reader').classList.contains('hidden')) goHome();
}
function initNav() {
  window.addEventListener('popstate', () => { if (NAV.skip > 0) { NAV.skip--; return; } NAV.guard = false; onBack(); navSync(); });
  const mo = new MutationObserver(navSync); mo.observe(document.body, { childList: true });
  if ($('#reader')) mo.observe($('#reader'), { attributes: true, attributeFilter: ['class'] });
  navSync();
}

const APP_VER = '20';
const NEWS = [
  [17, '🔁', 'Les flèches d’indices font la boucle : après le dernier indice, on revient au premier (et inversement). Les indices validés restent sautés.'],
  [17, '🎛️', 'Un interrupteur pour chaque outil (surligner, couleur, barrer, pinceau, gomme, annuler, enregistrer, page, notes, masquer des pages) dans Menu ≡ > « Personnaliser l’interface ». L’interface se réorganise toute seule.'],
  [17, '📄', 'Menu ≡ > « Exporter le PDF annoté » : un PDF avec vos surlignages, croix et traits, à garder ou à partager.'],
  [18, '🧩', 'Menu ≡ > « Personnaliser l’interface » : choisissez l’ordre des blocs (indice, pages, outils, navigation), par exemple l’indice entre les outils et la navigation.'],
  [18, '🔎', 'Réglages fins de l’indice : taille du texte, hauteur du bandeau, liste et flèches à gauche ou à droite, colonne notes à gauche ou à droite, et affichage compact.'],
  [19, '🖼️', 'Images dans les indices : en modifiant les indices, ajoutez l’image liée à un indice. Un bouton « Image » apparaît à côté de l’indice pour l’afficher, en plus ou à la place du texte.'],
  [19, '🛡️', 'Boîte de sécurité : l’app garde des copies automatiques (chaque jour et avant chaque mise à jour), restaurables dans Paramètres > Sauvegarde.'],
  [19, '📣', 'Annonces de mise à jour : bandeau à l’accueil, avertissement 30 minutes avant, rappel d’export 10 minutes avant (désactivable), et bouton pour redémarrer quand la nouvelle version est prête.'],
  [19, '💾', 'Le rappel de sauvegarde est plus fiable : bandeau à l’accueil et vérification à chaque retour dans l’app.'],
  [19, '👋', 'Premier lancement : l’app demande si vous avez déjà une sauvegarde et vous guide. Les enquêtes de la sauvegarde sans PDF apparaissent en tuiles grises à la fin de l’accueil (masquables sans toucher à la sauvegarde).'],
  [19, '🔒', 'Vos enquêtes, votre progression et vos sauvegardes ne sont pas touchées par ces mises à jour.'],
  [20, '❌', 'Fiches à barrer : pendant la préparation d’une enquête (ou Menu ≡ > « Fiches à barrer »), montrez une fiche à l’app. Ensuite, avec l’outil Barrer, un tap dans une fiche la barre en entier, sans dépasser. Les enquêtes d’une sauvegarde vous le demanderont à l’ouverture.'],
  [20, '◀', 'Le bouton « retour » du téléphone ferme d’abord la fenêtre ouverte (indices, notes, paramètres…), puis ramène à l’accueil.'],
  [20, '🔗', 'Les liens de solution écrits sans « https » (lecoupablenestpaslea.fr/…) sont maintenant reconnus.'],
  [20, '🔄', 'Paramètres > Mise à jour : bouton « Rechercher une mise à jour » et bouton « Réparer l’app » (vos données ne sont pas touchées).']
];
async function maybeShowNews(force) {
  const st = S.settings, seen = parseInt(st.seenVer) || 0;
  if (!force) { if (seen >= +APP_VER) return; if (S.firstRun) { st.seenVer = APP_VER; saveSettings(); return; } }
  const items = force ? NEWS : NEWS.filter(n => n[0] > seen);
  const body = h('div', {}, items.map(([v, e, t]) => h('div', { style: 'display:flex;gap:10px;margin:0 0 12px' }, h('span', { style: 'font-size:20px;line-height:1.3' }, e), h('div', {}, t))));
  await openModal('Nouveautés', body, [{ label: 'Compris', cls: 'pri', value: 1 }]).promise;
  if (st.seenVer !== APP_VER) { st.seenVer = APP_VER; saveSettings(); }
}

/* ---------------------------------------------------------------- tutoriel */
const TUTO = {
  home: [
    { t: 'Bienvenue 🔎', d: 'Ce carnet vous aide à mener vos enquêtes jusqu’au coupable. Tout reste sur votre téléphone : rien n’est envoyé sur Internet. Ce petit tour dure une minute et vous pouvez le passer à tout moment.' },
    { sel: '.tile.add', t: 'Ajouter une enquête', d: 'Touchez « + » et choisissez le PDF de l’enquête. Il est conservé dans l’app et reste disponible hors connexion.' },
    { sel: '.sortbar', t: 'Trier vos enquêtes', d: 'Par nom, par date d’import ou par état (pas commencée, en cours, terminée). Touchez deux fois pour inverser l’ordre.' },
    { sel: '.bbar .nb:nth-child(2)', t: 'Reprendre', d: 'Un tap pour rouvrir la dernière enquête, exactement là où vous vous étiez arrêté.' },
    { sel: '.bbar .nb:nth-child(3)', t: 'Paramètres', d: 'Sauvegardes et rappels, forme du barrement, défilement vertical ou horizontal, et ce tutoriel (« Revoir le tutoriel »).' }
  ],
  reader: [
    { t: 'Le lecteur', d: 'Voici un tour rapide des commandes. Ouvrez une enquête à tout moment pour les essayer. Vous pouvez passer ce tutoriel quand vous voulez.' },
    { sel: '#cluebar', t: 'L’indice en cours', d: 'L’indice sur lequel vous travaillez reste toujours en haut, avec sa couleur. Appui long sur un mot pour le surligner (pas de surlignage par accident).' },
    { sel: '#cctl', t: 'Changer d’indice', d: 'Liste de tous les indices (poignée ⋮⋮ pour les réordonner), puis flèches haut / bas pour passer à l’indice précédent ou suivant.' },
    { sel: '#nbtn', t: 'Notes', d: 'Appui simple : écrire la note de l’indice affiché (elle apparaît en petit italique sous l’indice). Appui long : toutes les notes – les modifier, et ajouter des notes libres non liées à un indice.' },
    { sel: '#cvalid', t: 'Valider un indice', d: 'Une fois un indice exploité, touchez « Valider » : les flèches le sauteront et il sera marqué comme terminé dans la liste. Retouchez le bouton (ou le rond ✓ dans la liste) pour le réactiver.' },
    { sel: '#pgbtn', t: 'Pages masquées', d: 'Appui long : masquer la page où vous êtes. Appui simple : afficher ou re-masquer les pages masquées. Elles ne sont jamais supprimées.' },
    { sel: '#vp', t: 'Lire les pages', d: 'Un doigt pour faire défiler. Pincez pour zoomer, deux doigts pour déplacer, double tap pour zoomer vite.' },
    { sel: '#bar [data-k=hl]', t: 'Surligner', d: 'Activez l’outil puis touchez un prénom : il est surligné dans la couleur de l’indice. Faites glisser pour tracer une zone. Appui long sur l’outil : ses réglages.' },
    { sel: '#colbtn', t: 'Couleur', d: 'Chaque indice a sa couleur, choisie automatiquement. Touchez ici pour la changer : elle change aussi pour tout ce que vous avez déjà marqué avec cet indice.' },
    { sel: '#bar [data-k=cross]', t: 'Barrer', d: 'La première fois, faites glisser sur une fiche pour donner la taille ; ensuite un tap suffit. Appui long sur une croix : la redimensionner ou l’effacer.' },
    { sel: '#bar [data-k=erase]', t: 'Gomme, pinceau, annuler', d: 'Appui long sur la gomme : effacer l’élément entier ou seulement le trait touché. « Annuler » revient en arrière.' },
    { sel: '#sv', t: 'Enregistrement', d: 'Votre progression est enregistrée automatiquement. Si l’icône devient rouge, touchez-la pour réessayer.' },
    { sel: '#pbox', t: 'Aller à une page', d: 'Touchez le numéro, tapez la page voulue et validez.' },
    { sel: '#mbtn', t: 'Menu', d: 'Accueil, validation du suspect (lien officiel), liste des indices, paramètres et ce tutoriel.' }
  ]
};
function startTuto(kind) {
  return new Promise(resolve => {
    const ok = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const steps = TUTO[kind].filter(st => !st.sel || ok(document.querySelector(st.sel))); if (!steps.length) return resolve();
    let i = 0; const ov = h('div', { id: 'tuto' }), ring = h('div', { class: 'tring' }), card = h('div', { class: 'tcard' }); ov.append(ring, card); document.body.append(ov);
    const end = () => { ov.remove(); resolve(); };
    function show() {
      const st = steps[i], el = st.sel && document.querySelector(st.sel); card.innerHTML = '';
      if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest' }); } catch (_) { } }
      const r = el && ok(el) ? el.getBoundingClientRect() : null; ov.classList.toggle('dim', !r);
      if (r) { const p = 6; Object.assign(ring.style, { display: 'block', left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px' }); } else ring.style.display = 'none';
      card.style.top = card.style.bottom = '';
      if (!r) card.style.top = '22%'; else if (r.top + r.height / 2 > innerHeight / 2) card.style.top = 'calc(env(safe-area-inset-top) + 16px)'; else card.style.bottom = 'calc(env(safe-area-inset-bottom) + 16px)';
      card.append(h('div', { class: 'tcount' }, `${i + 1} / ${steps.length}`), h('h3', {}, st.t), h('p', {}, st.d),
        h('div', { class: 'tnav' }, h('button', { class: 'tskip', onclick: end }, 'Passer le tutoriel'), h('div', { style: 'flex:1' }),
          i > 0 ? h('button', { class: 'btn sm', onclick: () => { i--; show(); } }, '◀') : null,
          h('button', { class: 'btn sm pri', onclick: () => { if (i < steps.length - 1) { i++; show(); } else end(); } }, i < steps.length - 1 ? 'Suivant ▶' : 'Terminer')));
    }
    show();
  });
}

/* ---------------------------------------------------------------- démarrage */
(async function main() {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
  try { S.db = await openDB(); } catch (e) { document.body.innerHTML = '<p style="padding:30px;color:#fff">Le stockage local est indisponible dans ce navigateur (navigation privée ?).</p>'; return; }
  await loadSettings(); S.books = await dbAll('books'); await boxAuto(); await refreshPend();
  S.bk = (await dbGet('kv', 'backupMeta')) || {}; if (!S.bk.since && S.books.length) { S.bk.since = Date.now(); await dbPut('kv', S.bk, 'backupMeta'); }
  $('#file').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) addBooks(f).then(() => { if (S.wiz && S.wiz.step === 1) { S.wiz.m.close(); S.wiz.step = 2; wizStep2(); } }); });
  $('#importfile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importData(f).then(ok => { if (ok && S.wiz && S.wiz.step === 2) { S.wiz.m.close(); S.wiz = null; } }); });
  S.firstRun = !S.settings.welcomed && !S.books.length; if (!S.settings.welcomed) { S.settings.welcomed = true; saveSettings(); }
  if (!S.settings.tutoInit) { S.settings.tutoInit = true; if (S.books.length) S.settings.tutoHome = S.settings.tutoReader = true; saveSettings(); }
  const askFirst = S.firstRun && !S.settings.wizAsked;
  renderHome(); setTimeout(async () => { await maybeShowNews(); if (askFirst) welcomeAsk(); await homeChecks(true); }, 600);
  if (!S.settings.tutoHome && !askFirst) setTimeout(async () => { if (!S.cur && !document.querySelector('.modal')) { await startTuto('home'); S.settings.tutoHome = true; saveSettings(); } }, 500);
  registerSW(); initNav();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { homeChecks(); annTick(); } });
  setInterval(() => { if (document.visibilityState === 'visible' && !document.querySelector('.modal')) annTick(); }, 30000);
  window.__S = S; window.__V = V;
})();
