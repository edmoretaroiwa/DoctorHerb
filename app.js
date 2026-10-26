import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, TRANSLATE_URL, TRANSLATE_KEY, BLUR_MIN } from './config.js';

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById('app');
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LANGS = { sn: 'Shona', nd: 'Ndebele', en: 'English', xx: 'Other language' };
let user = null;

const input = 'w-full rounded-lg border border-ink/20 bg-white px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-leaf';
const btn = 'rounded-lg px-4 py-3 font-semibold min-h-[44px]';
const primary = `${btn} bg-leaf text-white hover:bg-ink`;
const ghost = `${btn} border border-ink/20 bg-white hover:bg-moss`;

function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `fixed bottom-4 inset-x-4 max-w-md mx-auto rounded-lg px-4 py-3 text-white text-sm ${bad ? 'bg-red-700' : 'bg-leaf'}`;
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 4500);
}
const needLogin = () => { toast('Please sign in first.', true); location.hash = '#/auth'; };

/* ---------- Photo check: size, resolution, blur ---------- */
async function preparePhoto(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP photo.');
  if (file.size > 12e6) throw new Error('Photo is over 12 MB. Take it again at a lower quality.');
  const bmp = await createImageBitmap(file);
  if (Math.min(bmp.width, bmp.height) < 400) throw new Error('Photo is too small. Move closer to the plant and retake it.');
  const s = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  // Sharpness: variance of the Laplacian on a small grayscale copy. Low variance = blurry.
  const k = 256 / Math.max(c.width, c.height);
  const w = Math.round(c.width * k), h = Math.round(c.height * k);
  const t = document.createElement('canvas'); t.width = w; t.height = h;
  const tc = t.getContext('2d', { willReadFrequently: true });
  tc.drawImage(c, 0, 0, w, h);
  const px = tc.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  let sum = 0, sq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i];
    sum += l; sq += l * l; n++;
  }
  const variance = sq / n - (sum / n) ** 2;
  if (variance < BLUR_MIN) throw new Error('This photo looks blurry. Hold the phone steady, use daylight, and retake it.');
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
}

/* ---------- Translation (LibreTranslate) ---------- */
async function translateToEnglish(text, lang) {
  if (lang === 'en') return text;
  try {
    const res = await fetch(TRANSLATE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'auto', target: 'en', format: 'text', api_key: TRANSLATE_KEY || undefined })
    });
    if (!res.ok) throw new Error(res.status);
    return (await res.json()).translatedText || null;
  } catch { return null; } // post still saves; English shows as "not available yet"
}

/* ---------- Navigation ---------- */
function renderNav() {
  const about = '<a class="px-3 py-2 hover:underline" href="#/about">About</a>';
  $('#nav').innerHTML = about + (user
    ? `<a class="px-3 py-2 rounded-lg bg-sun text-ink font-semibold" href="#/new">Post herb</a><button id="out" class="px-3 py-2 underline">Sign out</button>`
    : `<a class="px-3 py-2 rounded-lg bg-sun text-ink font-semibold" href="#/auth">Sign in</a>`);
  $('#out')?.addEventListener('click', async () => { await db.auth.signOut(); location.hash = '#/'; });
}

/* ---------- Views ---------- */
const hero = () => `<section class="relative -mx-4 -mt-6 mb-8 overflow-hidden bg-ink text-white">
  <img src="images/hero.jpg" alt="" class="absolute inset-0 w-full h-full object-cover opacity-50" onerror="this.remove()">
  <div class="relative px-5 py-12 sm:py-16"><h1 class="text-3xl sm:text-4xl font-extrabold leading-tight max-w-lg">Herbal knowledge from our communities, checked by our communities.</h1>
  <p class="mt-3 max-w-md text-white/85">Share a herb in Shona, Ndebele or English. If something is wrong, anyone can correct it and the community votes on the right version.</p>
  <div class="mt-6 flex flex-wrap gap-3"><a href="#/new" class="${primary} !bg-sun !text-ink hover:!bg-white">Share a herb</a><a href="#/about" class="${btn} border border-white/40 hover:bg-white/10">How it works</a></div></div></section>
<section class="grid gap-3 sm:grid-cols-3 mb-8 text-sm" aria-label="How DoctorHerb works">
  <div class="bg-white rounded-xl p-4 border border-ink/10"><h2 class="font-bold">1. Share</h2><p>Post a clear photo, the local name, how to take it, and the side effects.</p></div>
  <div class="bg-white rounded-xl p-4 border border-ink/10"><h2 class="font-bold">2. Correct</h2><p>See a mistake? Fork the post and fix it. The original stays visible.</p></div>
  <div class="bg-white rounded-xl p-4 border border-ink/10"><h2 class="font-bold">3. Vote</h2><p>Readers choose which version is right, so the best knowledge rises.</p></div></section>`;

function aboutView() {
  app.innerHTML = `<h1 class="text-2xl font-extrabold mb-4">About DoctorHerb and staying safe</h1>
  <div class="grid gap-4 leading-relaxed">
  <p>DoctorHerb is a place to keep traditional herbal knowledge, in our own languages, and to make it more accurate over time. It was started by CREtech to help families share what they know.</p>
  <h2 class="text-lg font-bold">Please read before you use any herb</h2>
  <ul class="list-disc pl-5 grid gap-1"><li>Posts are community knowledge. They are not a diagnosis or a prescription.</li>
  <li>Do not use a herb for a baby, a pregnancy, a serious illness, or alongside other medicine without asking a nurse, doctor or pharmacist.</li>
  <li>If someone is very sick, go to the nearest clinic or hospital first.</li>
  <li>Plants can look alike and some are poisonous. Never use a plant you cannot identify with certainty.</li></ul>
  <h2 class="text-lg font-bold">Posting rules</h2>
  <ul class="list-disc pl-5 grid gap-1"><li>Use your own clear photo of the plant.</li><li>Always write the side effects and who should avoid it.</li>
  <li>Do not claim a herb cures cancer, HIV, diabetes or other serious disease.</li><li>Be respectful when you correct someone.</li></ul>
  <h2 class="text-lg font-bold">Your data</h2>
  <p>We keep your name, town, role, email and posts. Your email is never shown on the site.</p>
  <a href="#/" class="${primary} inline-block text-center">Back to herbs</a></div>`;
}

const stats = h => `<span>${h.likes} like${h.likes == 1 ? '' : 's'}</span> · <span>${h.dislikes} dislike${h.dislikes == 1 ? '' : 's'}</span>`;

async function feedView() {
  app.innerHTML = hero() + '<p>Loading herbs…</p>';
  const { data, error } = await db.from('herb_feed').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return app.innerHTML = hero() + `<p class="text-red-700">Could not load herbs. Check your Supabase keys in config.js.</p>`;
  if (!data.length) return app.innerHTML = hero() + `<div class="text-center py-8"><h2 class="text-2xl font-extrabold">No herbs yet</h2><p class="my-3">Be the first to share a herb you know well.</p><a class="${primary} inline-block" href="#/new">Post a herb</a></div>`;
  app.innerHTML = hero() + `<h2 class="text-2xl font-extrabold mb-4">Latest herbs from the community</h2><ul class="grid gap-4">` + data.map(h => `
    <li><a href="#/herb/${h.id}" class="block bg-white rounded-xl overflow-hidden border border-ink/10 hover:border-leaf">
      <img src="${esc(h.photo_url)}" alt="${esc(h.local_name)}" loading="lazy" class="w-full h-48 object-cover">
      <div class="p-4"><h2 class="text-lg font-bold">${esc(h.local_name)} ${h.forked_from ? '<span class="text-xs bg-sun/30 rounded px-2 py-1 ml-1">Corrected version</span>' : ''}</h2>
      <p class="text-sm text-ink/70">${esc(h.author)}${h.author_location ? ', ' + esc(h.author_location) : ''} · ${esc(h.author_role)}</p>
      <p class="text-sm mt-2">${stats(h)} · ${h.fork_count} correction${h.fork_count == 1 ? '' : 's'}</p></div></a></li>`).join('') + '</ul>';
}

function herbBody(h) {
  return `<img src="${esc(h.photo_url)}" alt="${esc(h.local_name)}" class="w-full max-h-80 object-cover rounded-lg">
    <h2 class="text-xl font-bold mt-3">${esc(h.local_name)}</h2>
    <p class="text-sm text-ink/70">By ${esc(h.author)}${h.author_location ? ', ' + esc(h.author_location) : ''}</p>
    <h3 class="font-semibold mt-3">In ${LANGS[h.language] || 'original language'}</h3><p class="whitespace-pre-line">${esc(h.original_text)}</p>
    <h3 class="font-semibold mt-3">In English</h3><p class="whitespace-pre-line">${h.english_text ? esc(h.english_text) : '<em>English translation not available yet.</em>'}</p>
    <h3 class="font-semibold mt-3">How to take it</h3><p class="whitespace-pre-line">${esc(h.dosage)}</p>
    <h3 class="font-semibold mt-3 text-red-800">Side effects</h3><p class="whitespace-pre-line">${esc(h.side_effects)}</p>`;
}

async function herbView(id) {
  app.innerHTML = '<p>Loading…</p>';
  const { data: h } = await db.from('herb_feed').select('*').eq('id', id).maybeSingle();
  if (!h) return app.innerHTML = '<p>This herb was not found. <a class="underline" href="#/">Back to herbs</a></p>';
  let mine = 0;
  if (user) { const { data } = await db.from('likes').select('value').eq('herb_id', id).eq('user_id', user.id).maybeSingle(); mine = data?.value || 0; }
  let compare = '';
  if (h.forked_from) {
    const { data: o } = await db.from('herb_feed').select('*').eq('id', h.forked_from).maybeSingle();
    const { data: v } = await db.from('fork_votes').select('choice,user_id').eq('fork_id', id);
    const vo = (v || []).filter(x => x.choice === 'original').length, vf = (v || []).length - vo;
    const my = (v || []).find(x => user && x.user_id === user.id)?.choice;
    compare = `<section class="mt-8"><h2 class="text-xl font-extrabold">Which version is right?</h2>
      <p class="text-sm mb-3">Read both, then vote. Votes: original ${vo}, correction ${vf}.</p>
      <div class="grid gap-4 sm:grid-cols-2"><article class="bg-white rounded-xl p-4 border border-ink/10"><h3 class="font-bold mb-2">Original</h3>${o ? herbBody(o) : '<p>The original was removed.</p>'}</article>
      <article class="bg-white rounded-xl p-4 border border-leaf"><h3 class="font-bold mb-2">Correction</h3>${herbBody(h)}</article></div>
      <div class="flex gap-3 mt-4"><button data-vote="original" class="${ghost} flex-1 ${my === 'original' ? 'ring-2 ring-leaf' : ''}">Original is right</button>
      <button data-vote="fork" class="${ghost} flex-1 ${my === 'fork' ? 'ring-2 ring-leaf' : ''}">Correction is right</button></div></section>`;
  }
  app.innerHTML = `<a href="#/" class="underline text-sm">← All herbs</a>
    <article class="bg-white rounded-xl p-4 border border-ink/10 mt-3 ${h.forked_from ? 'hidden' : ''}">${herbBody(h)}</article>
    <div class="flex flex-wrap gap-3 mt-4 ${h.forked_from ? 'hidden' : ''}">
      <button data-like="1" class="${ghost} ${mine === 1 ? 'ring-2 ring-leaf' : ''}">Like (${h.likes})</button>
      <button data-like="-1" class="${ghost} ${mine === -1 ? 'ring-2 ring-leaf' : ''}">Dislike (${h.dislikes})</button>
      <a href="#/fork/${h.id}" class="${primary}">Fork &amp; Correct</a></div>${compare}`;
  app.querySelectorAll('[data-like]').forEach(b => b.onclick = async () => {
    if (!user) return needLogin();
    const v = +b.dataset.like;
    const q = mine === v ? db.from('likes').delete().eq('herb_id', id).eq('user_id', user.id)
      : db.from('likes').upsert({ herb_id: id, user_id: user.id, value: v });
    const { error } = await q; error ? toast('Could not save your reaction.', true) : herbView(id);
  });
  app.querySelectorAll('[data-vote]').forEach(b => b.onclick = async () => {
    if (!user) return needLogin();
    const { error } = await db.from('fork_votes').upsert({ fork_id: id, user_id: user.id, choice: b.dataset.vote });
    error ? toast('Could not save your vote.', true) : herbView(id);
  });
}

async function formView(forkId) {
  if (!user) return needLogin();
  let src = null;
  if (forkId) { const r = await db.from('herbs').select('*').eq('id', forkId).maybeSingle(); src = r.data; }
  const v = k => esc(src?.[k] ?? '');
  app.innerHTML = `<h1 class="text-2xl font-extrabold mb-1">${src ? 'Fork & Correct' : 'Post a herb'}</h1>
    <p class="mb-4 text-sm">${src ? 'Change only what is wrong. Your version appears next to the original for the community to vote on.' : 'Share what you know. Side effects are required.'}</p>
    <form id="f" class="grid gap-4" novalidate>
      <label>Local name<input name="local_name" required maxlength="80" class="${input}" value="${v('local_name')}"></label>
      <label>Photo ${src ? '(optional: the original photo is kept if you skip)' : ''}<input type="file" name="photo" accept="image/*" ${src ? '' : 'required'} class="${input}"></label>
      <label>Language you will write in<select name="language" class="${input}">${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${src?.language === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Explain this herb and what it is used for<textarea name="original_text" required rows="5" class="${input}">${v('original_text')}</textarea></label>
      <label>How to take it (amount, how often, how long)<textarea name="dosage" required rows="3" class="${input}">${v('dosage')}</textarea></label>
      <label>Side effects and who should not take it<textarea name="side_effects" required rows="3" class="${input}">${v('side_effects')}</textarea></label>
      <p id="err" class="text-red-700 font-semibold" role="alert"></p>
      <button class="${primary}">${src ? 'Publish correction' : 'Publish herb'}</button></form>`;
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, d = Object.fromEntries(new FormData(f)), err = $('#err'), go = $('#f button');
    err.textContent = '';
    if (d.original_text.trim().length < 20) return err.textContent = 'Please explain the herb in more detail (at least 20 characters).';
    if (d.dosage.trim().length < 10) return err.textContent = 'Please explain dosage clearly.';
    if (d.side_effects.trim().length < 5) return err.textContent = 'Side effects are required. Write "none known" only if you are sure.';
    go.disabled = true; go.textContent = 'Checking…';
    try {
      let photo_url = src?.photo_url;
      const file = f.photo.files[0];
      if (file) {
        const blob = await preparePhoto(file);
        const path = `${user.id}/${Date.now()}.jpg`;
        const up = await db.storage.from('herb-photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) throw new Error('Photo upload failed. Check your connection and try again.');
        photo_url = db.storage.from('herb-photos').getPublicUrl(path).data.publicUrl;
      }
      if (!photo_url) throw new Error('A clear photo is required.');
      go.textContent = 'Translating…';
      const english_text = await translateToEnglish(d.original_text.trim(), d.language);
      const { data, error } = await db.from('herbs').insert({
        user_id: user.id, forked_from: src ? (src.forked_from || src.id) : null, photo_url, language: d.language,
        local_name: d.local_name.trim(), original_text: d.original_text.trim(), english_text,
        dosage: d.dosage.trim(), side_effects: d.side_effects.trim()
      }).select('id').single();
      if (error) throw new Error('Could not save. Please check every field and try again.');
      toast(english_text || d.language === 'en' ? 'Published.' : 'Published. English translation was not available.');
      location.hash = `#/herb/${data.id}`;
    } catch (ex) { err.textContent = ex.message; go.disabled = false; go.textContent = src ? 'Publish correction' : 'Publish herb'; }
  };
}

function authView() {
  app.innerHTML = `<h1 class="text-2xl font-extrabold mb-4">Join or sign in</h1>
    <div class="flex gap-2 mb-4"><button id="t-in" class="${primary} flex-1">Sign in</button><button id="t-up" class="${ghost} flex-1">Create account</button></div>
    <form id="a" class="grid gap-4" novalidate>
      <div id="extra" class="grid gap-4 hidden">
        <label>Your name<input name="name" class="${input}" autocomplete="name"></label>
        <label>Where you live (town or village)<input name="location" class="${input}"></label>
        <label>Your role<select name="role" class="${input}"><option>Community member</option><option>Traditional healer</option><option>Herbalist</option><option>Health worker</option><option>Student</option></select></label></div>
      <label>Email<input type="email" name="email" required class="${input}" autocomplete="email"></label>
      <label>Password (8+ characters)<input type="password" name="password" required minlength="8" class="${input}" autocomplete="current-password"></label>
      <p id="err" class="text-red-700 font-semibold" role="alert"></p><button class="${primary}">Sign in</button></form>`;
  let up = false;
  const mode = m => { up = m; $('#extra').classList.toggle('hidden', !m); $('#a button').textContent = m ? 'Create account' : 'Sign in'; $('#t-up').className = (m ? primary : ghost) + ' flex-1'; $('#t-in').className = (m ? ghost : primary) + ' flex-1'; };
  $('#t-in').onclick = () => mode(false); $('#t-up').onclick = () => mode(true);
  $('#a').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target)), err = $('#err');
    if (up && (d.name || '').trim().length < 2) return err.textContent = 'Please enter your name.';
    if (d.password.length < 8) return err.textContent = 'Password must be at least 8 characters.';
    const r = up ? await db.auth.signUp({ email: d.email, password: d.password, options: { data: { name: d.name.trim(), location: d.location.trim(), role: d.role } } })
      : await db.auth.signInWithPassword({ email: d.email, password: d.password });
    if (r.error) return err.textContent = r.error.message;
    if (up && !r.data.session) { toast('Check your email and tap the confirmation link, then sign in.'); return; }
    location.hash = '#/';
  };
}

/* ---------- Router ---------- */
function route() {
  renderNav();
  const [, page, id] = location.hash.split('/');
  if (page === 'herb' && id) herbView(id);
  else if (page === 'new') formView();
  else if (page === 'fork' && id) formView(id);
  else if (page === 'auth') authView();
  else if (page === 'about') aboutView();
  else feedView();
  window.scrollTo(0, 0);
}
db.auth.onAuthStateChange((_e, s) => { const was = user?.id; user = s?.user ?? null; if (was !== user?.id) route(); });
window.addEventListener('hashchange', route);
(async () => { user = (await db.auth.getSession()).data.session?.user ?? null; route(); })();
