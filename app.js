/*
 * app.js — לוגיקת הממשק
 * האפליקציה = קטלוג המוצרים שלי + איתור "איפה קונים" לכל פריט.
 */
(function () {
  'use strict';

  const CATEGORIES = [
    { id: 'face', label: 'פנים', emoji: '🧴' },
    { id: 'eyes', label: 'עיניים', emoji: '👁️' },
    { id: 'lips', label: 'שפתיים', emoji: '💋' },
    { id: 'nails', label: 'ציפורניים', emoji: '💅' },
    { id: 'hair', label: 'שיער', emoji: '💇‍♀️' },
    { id: 'body', label: 'גוף', emoji: '🧼' },
    { id: 'perfume', label: 'בושם', emoji: '🌸' },
    { id: 'other', label: 'אחר', emoji: '✨' },
  ];
  const catById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

  // ערים בישראל לאיתור "איפה קונים" — ערים גדולות ובינוניות (ניתן גם להקליד עיר חופשית)
  const ISRAELI_CITIES = [
    // מטרופולין ירושלים
    'ירושלים', 'בית שמש', 'מעלה אדומים', 'ביתר עילית', 'גבעת זאב',
    // גוש דן ומרכז
    'תל אביב-יפו', 'רמת גן', 'גבעתיים', 'בני ברק', 'חולון', 'בת ים',
    'אור יהודה', 'קריית אונו', 'גבעת שמואל', 'רמת השרון', 'יהוד-מונוסון',
    'אור עקיבא', 'גני תקווה', 'סביון',
    // השרון
    'נתניה', 'כפר סבא', 'רעננה', 'הוד השרון', 'הרצליה', 'אבן יהודה',
    'כפר יונה', 'טירה', 'טייבה', 'קלנסווה', 'כפר קאסם', 'פרדס חנה-כרכור',
    'זכרון יעקב', 'קדימה-צורן', 'תל מונד',
    // פתח תקווה והסביבה
    'פתח תקווה', 'ראש העין', 'אלעד', 'שוהם', 'באר יעקב',
    // שפלה ומרכז-דרום
    'ראשון לציון', 'רחובות', 'נס ציונה', 'יבנה', 'לוד', 'רמלה',
    'מודיעין-מכבים-רעות', 'מודיעין עילית', 'גדרה', 'גן יבנה',
    'קריית עקרון', 'מזכרת בתיה', 'נתיבות',
    // חיפה והצפון
    'חיפה', 'קריית אתא', 'קריית ביאליק', 'קריית מוצקין', 'קריית ים',
    'נשר', 'טירת כרמל', 'חדרה', 'עכו', 'נהריה', 'כרמיאל',
    'מעלות-תרשיחא', 'שפרעם', 'סח\'נין', 'טמרה', 'אום אל-פחם',
    'באקה אל-גרבייה', 'קריית שמונה', 'צפת', 'טבריה', 'קצרין',
    'נצרת', 'נוף הגליל', 'מגדל העמק', 'עפולה', 'בית שאן', 'יקנעם עילית',
    // הדרום
    'באר שבע', 'אשדוד', 'אשקלון', 'קריית גת', 'קריית מלאכי',
    'שדרות', 'אופקים', 'דימונה', 'ערד', 'אילת', 'רהט', 'ירוחם',
    'מצפה רמון', 'להבים', 'עומר', 'מיתר',
    // יהודה ושומרון
    'אריאל', 'קרני שומרון', 'אורנית', 'אפרת',
  ];

  // מותגי קוסמטיקה ידועים לבחירה מהירה. מותג שיתווסף — יישמר ויופיע בפעם הבאה.
  const KNOWN_BRANDS = [
    'MAC', 'Maybelline', "L'Oréal", 'Revlon', 'Max Factor', 'Rimmel', 'Bourjois',
    'NYX', 'Essence', 'Catrice', 'e.l.f.', 'Kiko', 'Pupa', 'Estée Lauder',
    'Clinique', 'Lancôme', 'Dior', 'Chanel', 'YSL', 'Charlotte Tilbury',
    'Fenty Beauty', 'Huda Beauty', 'Benefit', 'Urban Decay', 'Too Faced',
    'Sephora', 'Nivea', 'Neutrogena', 'Garnier', 'Vichy', 'La Roche-Posay',
    'Eucerin', 'Avène', 'CeraVe', 'The Ordinary', 'Yardley',
    'Careline', 'Lavido', 'Sea of Spa', 'Ahava', 'Laline',
  ];

  // ----- מצב -----
  let products = [];
  let query = '';
  let activeCategory = 'all';
  let editingId = null;
  let pendingPhoto = null;
  let pendingPhotoRemoved = false;
  let buyProduct = null;          // המוצר שעבורו פתחנו "איפה קונים"
  let buyMode = 'here';           // 'here' = המיקום שלי, 'city' = עיר נבחרת
  let buyCoords = null;           // { lat, lng } — נשמר לאחר איתור GPS
  const objectUrls = new Set();

  const $ = (sel) => document.querySelector(sel);
  const listEl = $('#list');
  const emptyShelfEl = $('#emptyShelf');
  const filtersEl = $('#filters');
  const searchEl = $('#search');
  const toastEl = $('#toast');

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    buildCategorySelect();
    buildFilters();
    bindEvents();
    registerSW();
    await refresh();
  }

  function bindEvents() {
    $('#addBtn').addEventListener('click', () => openEditor(null));
    $('#menuBtn').addEventListener('click', openBackup);

    // חיפוש במדף שלי
    searchEl.addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); render(); });
    $('#searchClear').addEventListener('click', () => { searchEl.value = ''; query = ''; searchEl.focus(); render(); });
    $('#clearFilters').addEventListener('click', clearFilters);

    // עורך
    $('#form').addEventListener('submit', onSave);
    document.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeEditor));
    $('#photoInput').addEventListener('change', onPhotoPicked);
    $('#ocrInput').addEventListener('change', onOcrPicked);
    $('#removePhoto').addEventListener('click', onRemovePhoto);
    $('#deleteBtn').addEventListener('click', onDelete);

    // פרטים
    document.querySelectorAll('[data-close-detail]').forEach((el) => el.addEventListener('click', closeDetail));
    $('#editFromDetail').addEventListener('click', () => {
      const id = $('#detail').dataset.id; closeDetail(); openEditor(id);
    });

    // גיבוי
    document.querySelectorAll('[data-close-backup]').forEach((el) => el.addEventListener('click', closeBackup));
    $('#exportBtn').addEventListener('click', onExport);
    $('#importInput').addEventListener('change', onImport);

    // איפה קונים (איתור)
    document.querySelectorAll('[data-close-buy]').forEach((el) => el.addEventListener('click', closeBuy));
    $('#buyHere').addEventListener('click', () => setBuyMode('here'));
    $('#buyCityBtn').addEventListener('click', () => setBuyMode('city'));
    $('#buyCity').addEventListener('input', updateBuyLinks);
    $('#buyCity').addEventListener('change', updateBuyLinks);
    $('#saveStore').addEventListener('click', onSaveStore);
    $('#storeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onSaveStore(); } });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeEditor(); closeDetail(); closeBackup(); closeBuy(); }
    });
  }

  async function refresh() {
    products = await Store.getAll();
    buildDatalists();
    render();
  }

  function filtered() {
    return products.filter((p) => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (!query) return true;
      const hay = [p.name, p.brand, p.shade, p.shadeNumber, p.model, p.supplierNumber, p.store, p.notes]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(query);
    });
  }

  // ============ רינדור מדף ============
  function render() {
    revokeUrls();
    const items = filtered();
    listEl.innerHTML = '';
    updateFilterBar(items.length);

    if (products.length === 0) {
      emptyShelfEl.classList.remove('hidden');
      listEl.classList.add('hidden');
      return;
    }
    emptyShelfEl.classList.add('hidden');
    listEl.classList.remove('hidden');

    if (items.length === 0) {
      listEl.innerHTML = '<p class="no-results">לא נמצאו מוצרים במדף שמתאימים לסינון.<br><button type="button" id="nrClear" class="link-btn">נקה סינון</button></p>';
      const b = listEl.querySelector('#nrClear');
      if (b) b.addEventListener('click', clearFilters);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const p of items) frag.appendChild(renderCard(p));
    listEl.appendChild(frag);
  }

  function updateFilterBar(shown) {
    const active = query !== '' || activeCategory !== 'all';
    $('#searchClear').classList.toggle('hidden', query === '');
    const bar = $('#filterBar');
    if (active && products.length) {
      bar.classList.remove('hidden');
      $('#filterCount').textContent = `מציג ${shown} מתוך ${products.length} מוצרים`;
    } else {
      bar.classList.add('hidden');
    }
  }

  function clearFilters() {
    query = '';
    activeCategory = 'all';
    searchEl.value = '';
    filtersEl.querySelectorAll('.chip').forEach((b) =>
      b.classList.toggle('chip--active', b.dataset.cat === 'all')
    );
    render();
  }

  function renderCard(p) {
    const cat = catById(p.category);
    const card = document.createElement('article');
    card.className = 'card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const thumb = document.createElement('div');
    thumb.className = 'card__thumb';
    if (p.photo instanceof Blob) {
      const url = URL.createObjectURL(p.photo);
      objectUrls.add(url);
      const img = document.createElement('img');
      img.src = url; img.alt = p.name || 'מוצר'; img.loading = 'lazy';
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = `<span class="card__thumb-emoji">${cat.emoji}</span>`;
    }
    // כפתור "איפה קונים" ישירות על המוצר
    const locate = document.createElement('button');
    locate.type = 'button';
    locate.className = 'card__locate';
    locate.title = 'איפה קונים';
    locate.setAttribute('aria-label', 'איפה קונים');
    locate.textContent = '📍';
    locate.addEventListener('click', (e) => { e.stopPropagation(); openBuy(p); });
    thumb.appendChild(locate);

    const body = document.createElement('div');
    body.className = 'card__body';
    const sub = [p.brand, p.shade || p.shadeNumber].filter(Boolean).join(' · ');
    body.innerHTML = `
      <div class="card__name">${esc(p.name || 'ללא שם')}</div>
      ${sub ? `<div class="card__sub">${esc(sub)}</div>` : ''}
      ${p.supplierNumber ? `<div class="card__supplier">מק״ט: <strong>${esc(p.supplierNumber)}</strong></div>` : ''}
      <span class="card__badge">${cat.emoji} ${cat.label}</span>
    `;

    card.appendChild(thumb);
    card.appendChild(body);
    const open = () => openDetail(p.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    return card;
  }

  // ============ פרטי מוצר ============
  function openDetail(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const cat = catById(p.category);
    const bodyEl = $('#detailBody');
    $('#detailName').textContent = p.name || 'פרטי מוצר';
    $('#detail').dataset.id = id;

    let photoHTML = '';
    if (p.photo instanceof Blob) {
      const url = URL.createObjectURL(p.photo);
      objectUrls.add(url);
      photoHTML = `<div class="detail-photo"><img src="${url}" alt="${esc(p.name || '')}" /></div>`;
    }

    const rows = [
      ['מותג', p.brand],
      ['גוון', p.shade],
      ['מספר גוון', p.shadeNumber],
      ['דגם', p.model],
      ['מספר ספק / מק״ט', p.supplierNumber, true],
      ['קטגוריה', `${cat.emoji} ${cat.label}`],
      ['איפה קונים', p.store],
      ['מחיר אחרון', p.price ? (isFinite(p.price) ? p.price + ' ₪' : p.price) : ''],
      ['הערות', p.notes],
    ].filter((r) => r[1]);

    bodyEl.innerHTML = photoHTML + '<dl class="detail-list">' + rows.map((r) => `
      <div class="detail-row ${r[2] ? 'detail-row--hi' : ''}">
        <dt>${r[0]}</dt><dd>${esc(String(r[1]))}</dd>
      </div>`).join('') + '</dl>' +
      '<button type="button" id="buyBtn" class="wide-btn buy-btn">📍 איפה קונים את זה?</button>';

    bodyEl.querySelector('#buyBtn').addEventListener('click', () => openBuy(p));
    show('#detail');
  }
  function closeDetail() { hide('#detail'); }

  // ============ עורך ============
  function openEditor(id) {
    editingId = id;
    pendingPhoto = null;
    pendingPhotoRemoved = false;
    const form = $('#form');
    form.reset();
    $('#ocrResult').classList.add('hidden');
    $('#ocrText').textContent = '';

    const p = id ? products.find((x) => x.id === id) : null;
    $('#sheetTitle').textContent = p ? 'עריכת מוצר' : 'מוצר חדש';
    $('#deleteBtn').classList.toggle('hidden', !p);

    if (p) {
      $('#f_name').value = p.name || '';
      $('#f_brand').value = p.brand || '';
      $('#f_category').value = p.category || 'other';
      $('#f_shade').value = p.shade || '';
      $('#f_shadeNumber').value = p.shadeNumber || '';
      $('#f_model').value = p.model || '';
      $('#f_supplier').value = p.supplierNumber || '';
      $('#f_store').value = p.store || '';
      $('#f_price').value = p.price || '';
      $('#f_notes').value = p.notes || '';
      setPhotoPreview(p.photo instanceof Blob ? p.photo : null);
    } else {
      // ירושת הקטגוריה מהסינון הפעיל — כדי לא לבחור פעמיים
      $('#f_category').value = activeCategory !== 'all' ? activeCategory : 'face';
      setPhotoPreview(null);
    }

    show('#sheet');
    setTimeout(() => $('#f_name').focus(), 250);
  }
  function closeEditor() { hide('#sheet'); }

  async function onSave(e) {
    e.preventDefault();
    const name = $('#f_name').value.trim();
    if (!name) { $('#f_name').focus(); return; }

    const base = editingId ? (products.find((x) => x.id === editingId) || {}) : {};
    const record = Object.assign({}, base, {
      id: editingId || undefined,
      name,
      brand: $('#f_brand').value.trim(),
      category: $('#f_category').value,
      shade: $('#f_shade').value.trim(),
      shadeNumber: $('#f_shadeNumber').value.trim(),
      model: $('#f_model').value.trim(),
      supplierNumber: $('#f_supplier').value.trim(),
      store: $('#f_store').value.trim(),
      price: $('#f_price').value.trim(),
      notes: $('#f_notes').value.trim(),
    });

    if (pendingPhoto) record.photo = pendingPhoto;
    else if (pendingPhotoRemoved) delete record.photo;

    try {
      await Store.put(record);
      closeEditor();
      await refresh();
      toast(editingId ? 'המוצר עודכן ✓' : 'המוצר נוסף ✓');
    } catch (err) {
      console.error(err);
      toast('שגיאה בשמירה');
    }
  }

  async function onDelete() {
    if (!editingId) return;
    if (!confirm('למחוק את המוצר לצמיתות?')) return;
    await Store.remove(editingId);
    closeEditor();
    await refresh();
    toast('המוצר נמחק');
  }

  // ============ תמונות ============
  async function onPhotoPicked(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const blob = await compressImage(file, 1000, 0.82);
      pendingPhoto = blob;
      pendingPhotoRemoved = false;
      setPhotoPreview(blob);
    } catch (err) {
      console.error(err);
      toast('לא הצלחתי לעבד את התמונה');
    }
  }
  function onRemovePhoto() {
    pendingPhoto = null;
    pendingPhotoRemoved = true;
    setPhotoPreview(null);
  }
  function setPhotoPreview(blob) {
    const box = $('#photoPreview');
    box.innerHTML = '';
    if (blob) {
      const url = URL.createObjectURL(blob);
      objectUrls.add(url);
      box.style.backgroundImage = `url(${url})`;
      box.classList.add('has-photo');
      $('#removePhoto').classList.remove('hidden');
    } else {
      box.style.backgroundImage = '';
      box.classList.remove('has-photo');
      box.innerHTML = '<span class="photo-preview__hint">📷 צילום המוצר</span>';
      $('#removePhoto').classList.add('hidden');
    }
  }

  function compressImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // ============ OCR — סריקת מדבקה (Tesseract.js, צד לקוח) ============
  let tesseractLoading = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (tesseractLoading) return tesseractLoading;
    tesseractLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = resolve;
      s.onerror = () => { tesseractLoading = null; reject(new Error('נכשלה טעינת מנוע OCR')); };
      document.head.appendChild(s);
    });
    return tesseractLoading;
  }

  function setOcrStatus(msg) { $('#ocrStatus').textContent = msg || ''; }

  async function onOcrPicked(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    // גם נשמור את התמונה כתמונת המוצר
    try {
      const blob = await compressImage(file, 1400, 0.85);
      pendingPhoto = blob; pendingPhotoRemoved = false; setPhotoPreview(blob);
    } catch (_) { /* לא קריטי */ }
    runOCR(file);
  }

  async function runOCR(file) {
    $('#ocrResult').classList.remove('hidden');
    $('#ocrText').textContent = '';
    setOcrStatus('טוען מנוע OCR (בפעם הראשונה עשוי לקחת רגע)...');
    try {
      await loadTesseract();
      setOcrStatus('סורק את המדבקה... 0%');
      const { data } = await window.Tesseract.recognize(file, 'eng+heb', {
        logger: (m) => {
          if (m.status === 'recognizing text') setOcrStatus(`סורק את המדבקה... ${Math.round((m.progress || 0) * 100)}%`);
        },
      });
      fillOcrResult(((data && data.text) || '').trim());
    } catch (err) {
      console.error(err);
      setOcrStatus('לא הצלחתי לסרוק (בדקי חיבור אינטרנט, או נסי תמונה ברורה יותר). אפשר גם למלא ידנית.');
    }
  }

  // ממלא אוטומטית את כל השדות שאפשר לזהות. ממלא רק שדות ריקים (לא דורס עריכות).
  function fillOcrResult(text) {
    const raw = text || '';
    $('#ocrText').textContent = raw;
    if (!raw) { setOcrStatus('לא זוהה טקסט. נסי תמונה ברורה, מוארת וממוקדת על הכיתוב.'); return; }

    const filled = [];
    const setIf = (sel, val, label) => {
      const el = $(sel);
      if (val && !el.value.trim()) { el.value = val; filled.push(label); }
    };

    // מותג — התאמה לרשימת המותגים הידועים
    const upper = raw.toUpperCase();
    const brand = KNOWN_BRANDS.find((b) => upper.includes(b.toUpperCase()));
    if (brand) setIf('#f_brand', brand, 'מותג');

    // קודים שמכילים ספרה
    const allCodes = [...new Set(raw.match(/[A-Za-z0-9][A-Za-z0-9\-\/]{2,}/g) || [])]
      .filter((c) => /\d/.test(c) && c.length <= 20);
    const shadeLike = allCodes.filter((c) => /^[A-Za-z]{0,3}\d{1,4}$/.test(c)); // NC20 / 120 / W7
    const longCodes = allCodes.filter((c) => !shadeLike.includes(c)).sort((a, b) => b.length - a.length);
    if (shadeLike[0]) setIf('#f_shadeNumber', shadeLike[0], 'מספר גוון');
    const pool = longCodes.concat(shadeLike.slice(1));
    if (pool[0]) setIf('#f_supplier', pool[0], 'מק״ט');
    if (pool[1]) setIf('#f_model', pool[1], 'דגם');

    // שם — השורה המשמעותית הראשונה שאינה המותג
    const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length >= 2 && /[A-Za-zא-ת]/.test(l));
    const nameLine = lines.find((l) => !brand || l.toUpperCase() !== brand.toUpperCase());
    if (nameLine) setIf('#f_name', nameLine.slice(0, 60), 'שם');

    if (filled.length) setOcrStatus('מולא אוטומטית: ' + filled.join(', ') + ' — בדקי ותקני אם צריך ✓');
    else setOcrStatus('זיהיתי טקסט אך לא הצלחתי לשייך שדות. פתחי את "הטקסט המלא" למטה.');
  }

  // ============ "איפה קונים" (איתור הפריט) ============
  function openBuy(p) {
    buyProduct = p;
    buyMode = 'here';
    const sel = $('#buyCity');
    const dl = $('#buyCityList');
    if (dl && !dl.dataset.built) {
      dl.innerHTML = ISRAELI_CITIES.map((c) => `<option value="${esc(c)}"></option>`).join('');
      dl.dataset.built = '1';
    }
    sel.value = '';
    sel.classList.add('hidden');
    $('#buyHere').classList.add('loc-btn--active');
    $('#buyCityBtn').classList.remove('loc-btn--active');
    $('#buyProduct').textContent = [p.brand, p.name, p.shade].filter(Boolean).join(' · ') || p.name || '';
    $('#storeInput').value = '';
    renderSavedStore();
    updateBuyLinks();
    requestLocation();   // מבקש GPS מראש כדי שהתוצאות יהיו לפי הקרבה אלייך
    show('#buy');
  }
  function closeBuy() { hide('#buy'); }

  function setBuyMode(mode) {
    buyMode = mode;
    $('#buyHere').classList.toggle('loc-btn--active', mode === 'here');
    $('#buyCityBtn').classList.toggle('loc-btn--active', mode === 'city');
    $('#buyCity').classList.toggle('hidden', mode !== 'city');
    if (mode === 'here') requestLocation();
    else setLocNote('');
    updateBuyLinks();
  }

  function setLocNote(msg) { $('#buyLocNote').textContent = msg || ''; }

  // מבקש את המיקום ה-GPS האמיתי (מתקן את הבאג: "המיקום שלי" נתן תוצאות כלליות)
  function requestLocation() {
    if (buyCoords) { setLocNote('📍 מחפש חנויות קרובות אלייך'); updateBuyLinks(); return; }
    if (!('geolocation' in navigator)) { setLocNote('הדפדפן לא תומך במיקום — נסי לפי עיר'); return; }
    setLocNote('📍 מאתר את המיקום שלך...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        buyCoords = { lat: (+pos.coords.latitude).toFixed(5), lng: (+pos.coords.longitude).toFixed(5) };
        setLocNote('📍 נמצא המיקום שלך — התוצאות יהיו לפי הקרבה אלייך');
        renderSavedStore();
        updateBuyLinks();
      },
      () => { setLocNote('לא ניתן לאתר מיקום (אולי חסמת הרשאה) — נסי לפי עיר'); updateBuyLinks(); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }
    );
  }

  // מילות חיפוש: מלא = כל הפרטים; רחב = בלי מספר דגם/גוון (למקרה של טעות או דגם שאזל)
  function buyTerms(broad) {
    const p = buyProduct;
    if (!p) return '';
    if (broad) {
      const cat = catById(p.category);
      return [p.brand, p.name, cat.id !== 'other' ? cat.label : '', p.shade].filter(Boolean).join(' ');
    }
    return [p.brand, p.name, p.shade, p.shadeNumber, p.model].filter(Boolean).join(' ');
  }

  // מפה לפי קואורדינטות אמיתיות (המיקום שלי) או לפי טקסט/עיר
  function mapsUrl(terms, city) {
    if (buyMode === 'here' && buyCoords) {
      return 'https://www.google.com/maps/search/' + encodeURIComponent(terms) +
        `/@${buyCoords.lat},${buyCoords.lng},14z`;
    }
    const q = city ? `${terms} ${city}` : terms;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }

  // מעדכן את הקישורים (anchor אמיתי — עובד גם כשחלונות קופצים חסומים)
  function updateBuyLinks() {
    if (!buyProduct) return;
    const city = buyMode === 'city' ? ($('#buyCity').value || '') : '';
    $('#buyGo').href = mapsUrl(buyTerms(false) || buyProduct.name || '', city);
    $('#buyGoBroad').href = mapsUrl(buyTerms(true) || buyProduct.name || '', city);
  }

  // חנות שמורה למוצר — כדי למצוא אותה שוב בקלות
  function renderSavedStore() {
    const el = $('#savedStore');
    const p = buyProduct;
    if (p && p.store) {
      const href = mapsUrl(p.store, buyMode === 'city' ? ($('#buyCity').value || '') : '');
      el.innerHTML = `⭐ חנות שמורה: <strong>${esc(p.store)}</strong> · <a href="${href}" target="_blank" rel="noopener">פתחי במפה</a>`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  async function onSaveStore() {
    if (!buyProduct) return;
    const name = $('#storeInput').value.trim();
    if (!name) { $('#storeInput').focus(); return; }
    const id = buyProduct.id;
    await Store.put(Object.assign({}, buyProduct, { store: name }));
    await refresh();
    buyProduct = products.find((x) => x.id === id) || Object.assign({}, buyProduct, { store: name });
    $('#storeInput').value = '';
    renderSavedStore();
    toast('החנות נשמרה ⭐');
  }

  // ============ גיבוי ============
  async function openBackup() {
    const n = await Store.count();
    $('#backupCount').textContent = n === 0 ? 'אין עדיין מוצרים לגיבוי.' : `כרגע שמורים ${n} מוצרים.`;
    show('#backup');
  }
  function closeBackup() { hide('#backup'); }

  async function onExport() {
    try {
      const data = await Store.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = `restock-cosmetics-${date}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('הגיבוי נוצר ✓');
    } catch (err) {
      console.error(err);
      toast('שגיאה בייצוא');
    }
  }

  async function onImport(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const merge = confirm('לשלב עם המוצרים הקיימים?\n\nאישור = הוספה לקיים\nביטול = החלפה מלאה של הכל');
      const n = await Store.importAll(data, merge);
      closeBackup();
      await refresh();
      toast(`שוחזרו ${n} מוצרים ✓`);
    } catch (err) {
      console.error(err);
      toast('קובץ הגיבוי אינו תקין');
    }
  }

  // ============ בונים UI ============
  function buildCategorySelect() {
    $('#f_category').innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
  }

  function buildFilters() {
    const all = [{ id: 'all', label: 'הכל', emoji: '🗂️' }].concat(CATEGORIES);
    filtersEl.innerHTML = all.map((c) =>
      `<button class="chip ${c.id === activeCategory ? 'chip--active' : ''}" data-cat="${c.id}" role="tab">${c.emoji} ${c.label}</button>`
    ).join('');
    filtersEl.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        filtersEl.querySelectorAll('.chip').forEach((b) => b.classList.toggle('chip--active', b === btn));
        render();
      });
    });
  }

  function buildDatalists() {
    const brands = [...new Set([...KNOWN_BRANDS, ...products.map((p) => p.brand).filter(Boolean)])]
      .sort((a, b) => a.localeCompare(b, 'he'));
    const stores = [...new Set(products.map((p) => p.store).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));
    $('#brandList').innerHTML = brands.map((b) => `<option value="${esc(b)}">`).join('');
    $('#storeList').innerHTML = stores.map((s) => `<option value="${esc(s)}">`).join('');
  }

  // ============ עוזרים ============
  function show(sel) {
    const el = $(sel);
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('open'));
    document.body.classList.add('sheet-open');
  }
  function hide(sel) {
    const el = $(sel);
    el.classList.remove('open');
    document.body.classList.remove('sheet-open');
    setTimeout(() => el.classList.add('hidden'), 220);
  }

  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.classList.add('hidden'), 250);
    }, 2200);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function revokeUrls() {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e));
      });
    }
  }
})();
