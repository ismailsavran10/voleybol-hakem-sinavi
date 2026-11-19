/* Voleybol Hakem Sınavı — arayüz ve akış */
(function () {
  'use strict';
  var H = window.HKM, SIG = window.HKM_SIGNALS, STUDY = window.HKM_STUDY;
  var BASE = (window.HKM_BANK || []).slice();
  var SIGBY = {}; (SIG ? SIG.signals : []).forEach(function (s) { SIGBY[s.id] = s; });

  function now() { return window.__HKM_NOW__ ? window.__HKM_NOW__() : Date.now(); }
  var rnd = H.rng(window.__HKM_SEED__ || (Date.now() & 0x7fffffff));
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pct(r) { return r == null ? '–' : '%' + Math.round(r * 100); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function safeId(s) { return String(s).replace(/[^A-Za-z0-9_.\-~:@+]/g, '_').slice(0, 180); }
  function $(sel) { return document.querySelector(sel); }

  var S = {
    bank: [], byId: {}, stats: {}, extra: [], reports: {},
    store: null, storeKind: 'yukleniyor', loaded: false,
    ai: null, aiState: 'bekleniyor',
    view: 'home', session: null, sheet: null, result: null,
    ui: { studyTab: 'ozet', reportOpen: null, confirmExit: false, confirmReset: false, examCount: 25, examTypes: H.VARSAYILAN_TIPLER.slice(), examZorluk: 'hepsi', topicSel: 1, topicCount: 20, topicZorluk: 'hepsi', havuzKonu: 1, havuzZorluk: 'hepsi', weakCount: 15, weakAI: true, reviewAI: true },
  };

  function rebuildBank() {
    S.bank = BASE.concat(S.extra);
    S.byId = {}; S.bank.forEach(function (q) { S.byId[q.id] = q; });
  }
  rebuildBank();

  // ============ Depolama ============
  function snapshot() { return { stats: S.stats, extra: S.extra, reports: S.reports }; }

  function localStore() {
    var KEY = 'hkm-v1', ok = true, data = null;
    try { var raw = localStorage.getItem(KEY); if (raw) data = JSON.parse(raw); } catch (e) { ok = false; }
    function persist() { try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (e) { /* tarayıcı depolaması kapalı */ } }
    return {
      kind: ok ? 'local' : 'gecici',
      load: function () { return Promise.resolve(data || { stats: {}, extra: [], reports: {} }); },
      saveStats: persist, addExtra: persist, setReport: persist, removeReport: persist,
      resetStats: function () { persist(); return Promise.resolve(); },
      flushNow: function () { return Promise.resolve(); },
    };
  }

  function dbStore(db) {
    var dirty = {}, timer = null, chain = Promise.resolve();
    function run(fn) { chain = chain.then(fn).catch(onWriteError); return chain; }
    function topicMap(k) {
      var m = {};
      Object.keys(S.stats).forEach(function (id) { var q = S.byId[id]; if (q && q.konu === k) m[id] = S.stats[id]; });
      return m;
    }
    function flush() {
      timer = null;
      var ks = Object.keys(dirty).map(Number); dirty = {};
      ks.forEach(function (k) { run(function () { return db.doc('stats/k' + pad2(k)).set({ q: topicMap(k), t: now() }); }); });
      return chain;
    }
    return {
      kind: 'db',
      load: function () {
        return Promise.all([
          db.collection('stats').limit(100).get(),
          db.collection('extra').limit(1000).get(),
          db.collection('reports').limit(1000).get(),
        ]).then(function (r) {
          var stats = {}, extra = [], reports = {};
          r[0].docs.forEach(function (d) { var v = d.data(); if (v && v.q) Object.assign(stats, v.q); });
          r[1].docs.forEach(function (d) { var v = d.data(); if (v && v.q && v.q.id) extra.push(v.q); });
          r[2].docs.forEach(function (d) { var v = d.data(); if (v && v.qid) reports[v.qid] = { note: v.note || '', ts: v.ts || 0 }; });
          return { stats: stats, extra: extra, reports: reports };
        });
      },
      saveStats: function (konular) {
        konular.forEach(function (k) { dirty[k] = 1; });
        if (!timer) timer = setTimeout(flush, 250);
      },
      addExtra: function (q) { run(function () { return db.doc('extra/' + safeId(q.id)).set({ q: q }); }); },
      setReport: function (qid, r) { run(function () { return db.doc('reports/' + safeId(qid)).set({ qid: qid, note: r.note, ts: r.ts }); }); },
      removeReport: function (qid) { run(function () { return db.doc('reports/' + safeId(qid)).delete(); }); },
      resetStats: function () {
        H.KONULAR.forEach(function (k) { run(function () { return db.doc('stats/k' + pad2(k.id)).delete(); }); });
        return chain;
      },
      flushNow: function () { if (timer) { clearTimeout(timer); return flush(); } return chain; },
    };
  }

  function onWriteError(e) {
    var code = e && e.code;
    if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked' || code === 'capability_disabled' || code === 'capability_removed') {
      if (S.storeKind === 'db') {
        S.store = localStore(); S.storeKind = S.store.kind;
        S.store.saveStats([]);
        toast('Bulut kaydına yazılamadı; ilerleme bu tarayıcıda saklanacak.');
        renderTopbar();
      }
    } else if (code === 'quota_exceeded') {
      toast('Kayıt alanı dolu: yeni kayıt yapılamadı.');
    } else {
      toast('Kayıt sırasında geçici bir sorun oluştu; bir sonraki cevapta yeniden denenecek.');
    }
  }

  function applyLoaded(d) {
    S.stats = d.stats || {};
    var baseIds = {}; BASE.forEach(function (q) { baseIds[q.id] = 1; });
    S.extra = (d.extra || []).filter(function (q) { return q && q.id && !baseIds[q.id]; });
    S.reports = d.reports || {};
    rebuildBank();
    S.loaded = true;
  }

  function initStore() {
    var settled = false;
    function useLocal() {
      if (settled) return; settled = true;
      S.store = localStore(); S.storeKind = S.store.kind;
      S.store.load().then(function (d) { applyLoaded(d); render(); });
    }
    if (!window.claude || typeof window.claude.use !== 'function') { useLocal(); return; }
    var t = setTimeout(useLocal, 12000);
    Promise.resolve().then(function () { return window.claude.use('db'); }).then(function (db) {
      if (settled) return;
      if (!db) { clearTimeout(t); useLocal(); return; }
      var st = dbStore(db);
      return st.load().then(function (d) {
        if (settled) return;
        clearTimeout(t); settled = true;
        S.store = st; S.storeKind = 'db';
        applyLoaded(d); render();
      });
    }).catch(function () { clearTimeout(t); useLocal(); });
  }

  function initAI() {
    if (!window.claude || typeof window.claude.use !== 'function') { S.aiState = 'yok'; return; }
    Promise.resolve().then(function () { return window.claude.use('sample'); }).then(function (s) {
      S.ai = s || null; S.aiState = s ? 'hazir' : 'yok'; render();
    }).catch(function () { S.aiState = 'yok'; render(); });
  }

  // ============ Kayıt işlemleri ============
  function recordAnswer(q, correct) {
    if (!q || !q.dogrulandi) return;
    S.stats[q.id] = H.applyAnswer(S.stats[q.id], correct, now());
    if (S.store) S.store.saveStats([q.konu]);
  }
  function setReport(qid, note) {
    S.reports[qid] = { note: note || '', ts: now() };
    if (S.store) S.store.setReport(qid, S.reports[qid]);
    toast('Soru bildirildi; düzeltilene kadar işaretli kalacak.');
  }
  function removeReport(qid) {
    delete S.reports[qid];
    if (S.store) S.store.removeReport(qid);
  }
  function addToBank(item) {
    var g = item.q;
    var q = {
      id: 'u-' + now().toString(36) + '-' + Math.floor(rnd() * 1e6).toString(36),
      kaynak: 'uretilmis', kural: g.kural, konu: g.konu, zorluk: g.zorluk || 2, tip: g.tip,
      soru: g.soru, aciklama: g.aciklama, dogrulandi: true, eklenme: now(),
    };
    if (g.secenekler) q.secenekler = g.secenekler.slice();
    q.cevap = g.cevap;
    S.extra.push(q); rebuildBank();
    if (S.store) S.store.addExtra(q);
    item.added = q.id;
    toast('Soru bankaya eklendi; artık tüm modlarda ve istatistiklerde yer alacak.');
  }

  // ============ Bildirim ============
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast'); if (!el) return;
    el.textContent = msg; el.hidden = false; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); el.hidden = true; }, 4200);
  }

  // ============ Oturum ============
  function makeItem(q, gen) { return { q: q, gen: !!gen, order: H.optionOrder(q, rnd), answer: null, checked: false, correct: null, added: null }; }

  function startSession(mode, questions, opts) {
    opts = opts || {};
    if (!questions.length) { toast('Bu seçimle sorulacak soru bulunamadı.'); return; }
    S.sheet = null;
    S.session = {
      mode: mode, title: opts.title, items: questions.map(function (q) { return makeItem(q, false); }), idx: 0,
      startedAt: now(), duration: opts.duration || 0, finished: false, ai: null, info: opts.info || '',
    };
    S.ui.confirmExit = false; S.ui.reportOpen = null;
    S.view = 'test';
    if (mode === 'exam') startTimer();
    render();
    if (opts.genTargets && opts.genTargets.length && S.ai) generate(S.session, opts.genTargets, opts.genCount || 5);
    window.scrollTo(0, 0);
  }

  var timerId = null;
  function startTimer() {
    stopTimer();
    timerId = setInterval(function () {
      var s = S.session; if (!s || s.mode !== 'exam' || s.finished) { stopTimer(); return; }
      var left = s.duration - Math.floor((now() - s.startedAt) / 1000);
      var el = $('#timer');
      if (el) { el.textContent = H.formatDuration(left); el.classList.toggle('low', left <= 60); }
      if (left <= 0) { finishSession(true); }
    }, 500);
  }
  function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }

  function generate(session, targets, count) {
    session.ai = { state: 'loading' };
    var prompt = H.buildGenPrompt(targets, count);
    S.ai.json(prompt, { modelTier: 'default', cache: false }).then(function (data) {
      var qs = H.validateGenerated(data, targets, 'g' + now().toString(36));
      if (S.session !== session || session.finished) return;
      var pos = Math.min(session.items.length, session.idx + 1);
      qs.forEach(function (q, i) { session.items.splice(Math.min(session.items.length, pos + i * 2 + 1), 0, makeItem(q, true)); });
      session.ai = { state: qs.length ? 'ok' : 'empty', n: qs.length };
      if (S.view === 'test') renderMain();
    }).catch(function (e) {
      var code = e && e.code;
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') { S.aiState = 'kapali'; }
      if (S.session !== session) return;
      session.ai = { state: 'error', code: code };
      if (S.view === 'test') renderMain();
    });
  }

  function currentItem() { var s = S.session; return s ? s.items[s.idx] : null; }

  function answerItem(item, answer) {
    var s = S.session; if (!s || !item) return;
    if (s.mode === 'exam') { item.answer = answer; renderMain(); return; }
    if (item.checked) return;
    item.answer = answer; item.checked = true;
    item.correct = H.checkAnswer(item.q, answer);
    if (!item.gen) recordAnswer(item.q, item.correct);
    renderMain();
    var fb = $('#feedback'); if (fb && fb.scrollIntoView && window.innerWidth < 700) fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function go(delta) {
    var s = S.session; if (!s) return;
    var n = s.idx + delta;
    if (n < 0) return;
    if (n >= s.items.length) { finishSession(false); return; }
    s.idx = n; S.ui.reportOpen = null; renderMain();
  }

  function finishSession(timeUp) {
    var s = S.session; if (!s || s.finished) return;
    s.finished = true; stopTimer();
    var touched = {};
    if (s.mode === 'exam') {
      s.items.forEach(function (it) {
        if (it.answer === null || it.answer === '' || it.answer === undefined) return;
        it.correct = H.checkAnswer(it.q, it.answer); it.checked = true;
        if (!it.gen && it.q.dogrulandi) { S.stats[it.q.id] = H.applyAnswer(S.stats[it.q.id], it.correct, now()); touched[it.q.konu] = 1; }
      });
      if (S.store) S.store.saveStats(Object.keys(touched).map(Number));
    }
    var bankItems = s.items.filter(function (it) { return !it.gen; });
    var genItems = s.items.filter(function (it) { return it.gen && it.checked; });
    var byTopic = {};
    bankItems.forEach(function (it) {
      var t = byTopic[it.q.konu] || (byTopic[it.q.konu] = { konu: it.q.konu, n: 0, c: 0 });
      t.n++; if (it.correct) t.c++;
    });
    S.result = {
      mode: s.mode, title: s.title, timeUp: !!timeUp,
      total: bankItems.length,
      correct: bankItems.filter(function (it) { return it.correct === true; }).length,
      wrong: bankItems.filter(function (it) { return it.checked && it.correct === false; }).length,
      blank: bankItems.filter(function (it) { return !it.checked; }).length,
      genTotal: genItems.length, genCorrect: genItems.filter(function (it) { return it.correct; }).length,
      elapsed: Math.round((now() - s.startedAt) / 1000), duration: s.duration,
      topics: Object.keys(byTopic).map(function (k) { return byTopic[k]; }).sort(function (a, b) { return a.konu - b.konu; }),
      wrongItems: s.items.filter(function (it) { return it.checked && it.correct === false; }),
      blankItems: bankItems.filter(function (it) { return !it.checked; }),
    };
    S.session = null; S.view = 'result'; S.ui.reportOpen = null;
    render(); window.scrollTo(0, 0);
  }

  // ============ Kurulum (mod seçimleri) ============
  function openSheet(kind) { if (!S.loaded) { toast('Kayıtlar yükleniyor, bir saniye.'); return; } S.sheet = kind; renderSheet(); }

  function startExam() {
    var n = Math.max(1, Math.min(200, parseInt(S.ui.examCount, 10) || 25));
    var types = S.ui.examTypes.length ? S.ui.examTypes : H.VARSAYILAN_TIPLER;
    var qs = H.selectExam(S.bank, { count: n, types: types, zorluk: H.zorlukSecimi(S.ui.examZorluk), reported: S.reports, rnd: rnd });
    startSession('exam', qs, { title: 'Deneme Sınavı', duration: H.examDurationSec(qs.length), info: zorlukBilgi(S.ui.examZorluk) });
  }
  function startTopic(konu, count, zorlukId) {
    var qs = H.selectTopic(S.bank, S.stats, konu, count === 'all' ? 0 : count, rnd, { zorluk: H.zorlukSecimi(zorlukId) });
    if (!qs.length) { toast('Bu seçime uyan soru yok.'); return; }
    startSession('topic', qs, { title: 'Konu Çalışması · ' + H.konuAdi(konu), info: zorlukBilgi(zorlukId) });
  }
  function zorlukBilgi(id) {
    var o = H.ZORLUK_SECENEK.filter(function (x) { return x.id === id; })[0];
    return o && o.z ? 'Zorluk: ' + o.ad : '';
  }
  function zorlukChips(act, cur) {
    return '<fieldset class="field"><legend>Zorluk</legend><div class="chips">' + H.ZORLUK_SECENEK.map(function (o) {
      return '<button class="chip' + (cur === o.id ? ' on' : '') + '" data-act="' + act + '" data-z="' + o.id + '" aria-pressed="' + (cur === o.id) + '">' + o.ad + '</button>';
    }).join('') + '</div></fieldset>';
  }
  function examAvail() {
    return H.filterBank(S.bank, { types: S.ui.examTypes, zorluk: H.zorlukSecimi(S.ui.examZorluk), reported: S.reports, excludeReported: true }).length;
  }
  function startWeak() {
    var sel = H.selectWeak(S.bank, S.stats, S.ui.weakCount, rnd);
    var targets = (S.ui.weakAI && S.ai && S.aiState === 'hazir') ? H.genTargets(S.bank, S.stats, { konular: sel.topics, limit: 4 }) : [];
    startSession('weak', sel.questions, { title: 'Zayıf Konu', genTargets: targets, genCount: 5, info: sel.topics.map(H.konuAdi).join(' · ') });
  }
  function startReview() {
    var sel = H.selectReview(S.bank, S.stats, now(), 20);
    var targets = (S.ui.reviewAI && S.ai && S.aiState === 'hazir') ? H.genTargets(S.bank, S.stats, { qids: sel.questions.map(function (q) { return q.id; }), limit: 4 }) : [];
    startSession('review', sel.questions, { title: 'Yanlışlarım', genTargets: targets, genCount: 5 });
  }
  function startRule(kural) {
    var qs = S.bank.filter(function (q) { return q.dogrulandi && q.kural === kural; });
    startSession('rule', H.shuffle(qs, rnd), { title: 'Kural ' + kural });
  }

  // ============ Görünüm parçaları ============
  var ICON = {
    ball: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.8c-1.7 3.6-1.6 7.4.6 10.6M21 13c-3.9-.6-7.3.5-9.9 3.1M4.3 17.3c2.1-3.4 2.6-7.2 1.2-10.9M12.6 13.4c3.4 1.4 5.8 3.9 6.8 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4m0 1h10l-2 3.5L16 12H6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11m0-11l-11 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  };

  function orb() { return '<span class="orb" aria-hidden="true"></span>'; }
  function rateClass(r) { return r == null ? 'na' : r >= 0.8 ? 'good' : r >= 0.6 ? 'mid' : 'low'; }
  function bar(r) { var w = r == null ? 0 : Math.round(r * 100); return '<span class="bar ' + rateClass(r) + '"><span style="width:' + w + '%"></span></span>'; }
  function kaynakText(q) {
    var t = H.KAYNAK_ADI[q.kaynak] || q.kaynak;
    if (q.ref) t += ' · Vaka ' + q.ref;
    return t;
  }
  function kuralLabel(k) { return /^[0-9D]/.test(k) ? 'Kural ' + k : k; }

  function renderTopbar() {
    var el = $('#topbar'); if (!el) return;
    var inTest = S.view === 'test';
    var kind = S.storeKind === 'db' ? ['Bulut kaydı', 'ok'] : S.storeKind === 'local' ? ['Bu tarayıcıda kayıtlı', 'warn'] : S.storeKind === 'gecici' ? ['Kayıt kapalı', 'bad'] : ['Kayıtlar yükleniyor', 'na'];
    el.innerHTML =
      '<div class="wrap topbar-in">' +
        '<button class="brand" data-act="nav" data-view="home">' + ICON.ball + '<span>Voleybol Hakem Sınavı</span></button>' +
        (inTest ? '' :
          '<nav class="tabs" aria-label="Bölümler">' +
            ['home:Ana sayfa', 'analiz:Analiz', 'calisma:Çalışma'].map(function (p) {
              var a = p.split(':');
              return '<button class="tab' + (S.view === a[0] || (a[0] === 'home' && S.view === 'result') ? ' on' : '') + '" data-act="nav" data-view="' + a[0] + '">' + a[1] + '</button>';
            }).join('') +
          '</nav>') +
        '<span class="sync ' + kind[1] + '" title="İlerlemenin nerede saklandığı">' + kind[0] + '</span>' +
      '</div>';
  }

  // ---------- Ana sayfa ----------
  function viewHome() {
    var o = H.overallStats(S.bank, S.stats);
    var due = H.dueList(S.bank, S.stats, now(), true).length;
    var inRev = S.bank.filter(function (q) { return H.inReview(S.stats[q.id]); }).length;
    var weak = H.weakestTopics(S.bank, S.stats, 3, 3);
    var aiOn = S.aiState === 'hazir';
    var dis = S.loaded ? '' : ' disabled';
    var h = '';
    h += '<section class="hero">' +
      '<div class="hero-text"><p class="eyebrow">FIVB 2025-2028 · TVF MHGK belgeleri</p><h1>Ulusal hakem sınavına hazırlık</h1>' +
      '<p class="lede">Doğrulanmış ' + o.total + ' soru, 21 konu. Eksik olduğun kuralları bul, aralıklı tekrarla pekiştir.</p></div>' +
      '<div class="stats3">' +
        '<div class="stat"><span class="k">Bugün tekrar</span><b class="num">' + due + '</b><span class="s">soru zamanı geldi</span></div>' +
        '<div class="stat"><span class="k">Genel başarı</span><b class="num">' + pct(o.rate) + '</b><span class="s">' + o.a + ' cevap</span></div>' +
        '<div class="stat"><span class="k">Görülen soru</span><b class="num">' + o.seen + '<small>/' + o.total + '</small></b><span class="s">' + inRev + ' tekrar listesinde</span></div>' +
      '</div></section>';

    h += '<section class="modes" aria-label="Test modları">' +
      modeCard('exam', 'Deneme Sınavı', 'Tüm konular karışık, süreli; sonuç en sonda.', '25 soru · ' + H.formatDuration(H.examDurationSec(25)) + ' dk', '', dis) +
      modeCard('topic', 'Konu Çalışması', 'Tek konu seç; her sorudan sonra doğru cevap ve kural açıklaması.', '21 konu', '', dis) +
      modeCard('weak', 'Zayıf Konu', 'En düşük başarılı konulardan ağırlıklı sorular.', weak.length ? weak.map(function (t) { return H.konuAdi(t.konu); }).slice(0, 2).join(', ') : 'Veri birikince odaklanır', aiOn ? orb() + 'Yapay zekâ' : '', dis) +
      modeCard('review', 'Yanlışlarım', 'Yanlış yaptığın sorular 1, 3 ve 7 gün sonra tekrar gelir.', due ? due + ' soru bugün bekliyor' : inRev + ' soru tekrar listesinde', due ? '<span class="pill due">' + due + '</span>' : (aiOn ? orb() + 'Yapay zekâ' : ''), dis) +
      '</section>';

    h += '<section class="card"><div class="card-head"><h2>En zayıf 3 konu</h2><span class="muted">En az 3 cevap verilmiş konular</span></div>';
    if (!weak.length) {
      h += '<p class="empty">Henüz yeterli veri yok. Bir deneme sınavı çöz; konu başarı oranların burada görünecek.</p>';
    } else {
      h += '<ul class="rows">' + weak.map(function (t) {
        return '<li class="row"><div class="row-main"><span class="row-title">' + esc(t.ad) + '</span><span class="row-sub">' + t.c + '/' + t.a + ' doğru cevap</span></div>' + bar(t.rate) +
          '<span class="row-val num ' + rateClass(t.rate) + '">' + pct(t.rate) + '</span><button class="btn soft sm" data-act="start-topic" data-konu="' + t.konu + '">Çalış</button></li>';
      }).join('') + '</ul>';
    }
    h += '</section>';
    return h;
  }
  function modeCard(kind, title, desc, meta, badge, dis) {
    return '<button class="mode" data-act="open" data-sheet="' + kind + '"' + dis + '>' +
      '<span class="mode-top"><span class="mode-title">' + title + '</span>' + (badge ? '<span class="mode-badge">' + badge + '</span>' : '') + '</span>' +
      '<span class="mode-desc">' + desc + '</span><span class="mode-meta">' + esc(meta) + '</span></button>';
  }

  // ---------- Kurulum penceresi ----------
  function renderSheet() {
    var el = $('#sheet'); if (!el) return;
    if (!S.sheet) { el.hidden = true; el.innerHTML = ''; return; }
    var h = '';
    if (S.sheet === 'exam') {
      var avail = examAvail();
      var n = Math.min(parseInt(S.ui.examCount, 10) || 0, avail);
      h += '<h2 id="sheet-title">Deneme Sınavı</h2><p class="muted">Tüm konulardan karışık sorular. Soru başına 72 saniye; sonuçlar sınav bitince gösterilir.</p>' +
        '<label class="field"><span>Soru sayısı</span><span class="stepper"><button class="btn ghost sm" data-act="exam-step" data-d="-5" aria-label="5 azalt">−</button>' +
        '<input id="exam-count" type="number" inputmode="numeric" min="1" max="' + avail + '" value="' + esc(S.ui.examCount) + '">' +
        '<button class="btn ghost sm" data-act="exam-step" data-d="5" aria-label="5 artır">+</button></span></label>' +
        '<div class="presets">' + [25, 50, 75, 100].map(function (p) { return '<button class="chip' + (+S.ui.examCount === p ? ' on' : '') + '" data-act="exam-preset" data-n="' + p + '">' + p + '</button>'; }).join('') + '</div>' +
        '<p class="duration">' + ICON.clock + '<span>Süre: <b class="num" id="exam-dur">' + H.formatDuration(H.examDurationSec(n)) + '</b> dakika</span></p>' +
        '<fieldset class="field"><legend>Soru tipleri</legend><div class="chips">' +
        H.TUM_TIPLER.map(function (t) {
          var on = S.ui.examTypes.indexOf(t) >= 0;
          return '<label class="check"><input type="checkbox" id="type-' + t + '" data-act="exam-type" value="' + t + '"' + (on ? ' checked' : '') + '><span>' + H.TIP_ADI[t] + (t === 'bosluk' ? ' <em>(isteğe bağlı)</em>' : '') + '</span></label>';
        }).join('') + '</div></fieldset>' +
        zorlukChips('exam-z', S.ui.examZorluk) +
        '<p class="muted small">Seçime uyan doğrulanmış soru: <b class="num">' + avail + '</b>. Bildirilen sorular sınava alınmaz.</p>' +
        '<div class="sheet-actions"><button class="btn ghost" data-act="close">Vazgeç</button><button class="btn primary" data-act="start-exam"' + (avail ? '' : ' disabled') + '>Sınavı başlat</button></div>';
    } else if (S.sheet === 'topic') {
      var ts = H.topicStats(S.bank, S.stats);
      h += '<h2 id="sheet-title">Konu Çalışması</h2><p class="muted">Her sorudan sonra doğru cevap, kural numarası ve açıklama gösterilir.</p>' +
        '<div class="topic-list" role="radiogroup" aria-label="Konu">' + ts.map(function (t) {
          var k = H.KONULAR[t.konu - 1];
          return '<label class="topic-opt' + (S.ui.topicSel === t.konu ? ' on' : '') + '"><input type="radio" name="topic" id="topic-' + t.konu + '" data-act="topic-sel" value="' + t.konu + '"' + (S.ui.topicSel === t.konu ? ' checked' : '') + '>' +
            '<span class="t-no num">' + t.konu + '</span><span class="t-name">' + esc(t.ad) + '<small>' + esc(/^\d/.test(k.kural) ? 'Kural ' + k.kural : k.kural) + ' · ' + t.total + ' soru</small></span>' +
            '<span class="t-rate num ' + rateClass(t.rate) + '">' + pct(t.rate) + '</span></label>';
        }).join('') + '</div>' +
        '<fieldset class="field"><legend>Soru sayısı</legend><div class="chips">' + [10, 20, 'all'].map(function (c) {
          return '<button class="chip' + (S.ui.topicCount === c ? ' on' : '') + '" data-act="topic-count" data-c="' + c + '">' + (c === 'all' ? 'Tümü' : c) + '</button>';
        }).join('') + '</div></fieldset>' +
        zorlukChips('topic-z', S.ui.topicZorluk) +
        '<div class="sheet-actions"><button class="btn ghost" data-act="close">Vazgeç</button><button class="btn primary" data-act="start-topic-sheet">Başlat</button></div>';
    } else if (S.sheet === 'weak') {
      var sel = H.selectWeak(S.bank, S.stats, S.ui.weakCount, H.rng(7));
      var targets = H.genTargets(S.bank, S.stats, { konular: sel.topics, limit: 4 });
      h += '<h2 id="sheet-title">Zayıf Konu</h2><p class="muted">En düşük başarılı konulardan ağırlıklı soru gelir; önce yanlış yaptıkların ve görmediklerin.</p>' +
        '<div class="focus">' + sel.topics.map(function (k) { var t = H.topicStats(S.bank, S.stats)[k - 1]; return '<span class="chip static">' + esc(H.konuAdi(k)) + ' <b class="num ' + rateClass(t.rate) + '">' + pct(t.rate) + '</b></span>'; }).join('') + '</div>' +
        '<fieldset class="field"><legend>Soru sayısı</legend><div class="chips">' + [10, 15, 25].map(function (c) {
          return '<button class="chip' + (S.ui.weakCount === c ? ' on' : '') + '" data-act="weak-count" data-c="' + c + '">' + c + '</button>';
        }).join('') + '</div></fieldset>' + aiToggle('weakAI', targets) +
        '<div class="sheet-actions"><button class="btn ghost" data-act="close">Vazgeç</button><button class="btn primary" data-act="start-weak">Başlat</button></div>';
    } else if (S.sheet === 'review') {
      var r = H.selectReview(S.bank, S.stats, now(), 20);
      var tg = H.genTargets(S.bank, S.stats, { qids: r.questions.map(function (q) { return q.id; }), limit: 4 });
      h += '<h2 id="sheet-title">Yanlışlarım</h2><p class="muted">Yanlış yapılan soru 1, 3 ve 7 gün sonra tekrar gelir; üst üste 3 doğru cevapta öğrenildi sayılıp listeden çıkar.</p>';
      if (!r.questions.length) {
        h += '<p class="empty">Tekrar listen boş. Yanlış yaptığın sorular burada birikir.</p><div class="sheet-actions"><button class="btn primary" data-act="close">Tamam</button></div>';
      } else {
        h += '<div class="stats2"><div class="stat"><span class="k">Bugün zamanı gelen</span><b class="num">' + r.dueCount + '</b></div><div class="stat"><span class="k">Bu oturumda</span><b class="num">' + r.questions.length + '</b><span class="s">soru</span></div></div>' +
          aiToggle('reviewAI', tg) +
          '<div class="sheet-actions"><button class="btn ghost" data-act="close">Vazgeç</button><button class="btn primary" data-act="start-review">Başlat</button></div>';
      }
    }
    el.innerHTML = '<div class="sheet-backdrop" data-act="close"></div><div class="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' + h + '</div>';
    el.hidden = false;
    var f = el.querySelector('.btn.primary'); if (f && f.focus) f.focus({ preventScroll: true });
  }
  function aiToggle(key, targets) {
    if (S.aiState !== 'hazir') {
      var why = S.aiState === 'kapali' ? 'Yapay zekâ bu görünümde kapalı (izin verilmedi).' : S.aiState === 'bekleniyor' ? 'Yapay zekâ bağlantısı kontrol ediliyor.' : 'Yapay zekâ yalnızca claude.ai üzerinde açıldığında çalışır.';
      return '<p class="ai-note">' + orb() + esc(why) + ' Sorular yalnızca bankadan gelir.</p>';
    }
    if (!targets.length) return '<p class="ai-note">' + orb() + 'Yapay zekâ, yanlış yaptığın kurallara yeni soru üretir. Bu seçimde henüz yanlış kural yok.</p>';
    return '<label class="check ai"><input type="checkbox" id="ai-' + key + '" data-act="ai-toggle" data-key="' + key + '"' + (S.ui[key] ? ' checked' : '') + '><span>' + orb() + 'Yapay zekâ ile 5 yeni soru üret <small>Odak: ' + targets.map(function (t) { return esc(kuralLabel(t.kural)); }).join(', ') + '</small></span></label>';
  }

  // ---------- Test ekranı ----------
  function viewTest() {
    var s = S.session, it = currentItem(); if (!s || !it) return '';
    var q = it.q, exam = s.mode === 'exam';
    var answered = s.items.filter(function (x) { return exam ? x.answer !== null && x.answer !== '' : x.checked; }).length;
    var h = '<div class="test">';
    h += '<div class="test-head"><button class="btn ghost sm" data-act="exit">' + ICON.back + 'Çık</button><div class="test-title"><b>' + esc(s.title) + '</b>' + (s.info ? '<span class="muted small">' + esc(s.info) + '</span>' : '') + '</div>' +
      (exam ? '<span class="timer num" id="timer">' + H.formatDuration(s.duration - Math.floor((now() - s.startedAt) / 1000)) + '</span>' : '<span class="counter num">' + answered + '/' + s.items.length + '</span>') + '</div>';
    if (S.ui.confirmExit) {
      h += '<div class="confirm" role="alertdialog" aria-label="Çıkış onayı"><p>' + (exam ? 'Sınavı şimdi bitirirsen boş sorular "boş" sayılır.' : 'Oturumu bitirmek istiyor musun? Verdiğin cevaplar kaydedildi.') + '</p>' +
        '<div class="row-actions"><button class="btn ghost sm" data-act="exit-cancel">Devam et</button>' + (exam ? '<button class="btn danger-soft sm" data-act="exit-discard">Kaydetmeden çık</button>' : '') + '<button class="btn primary sm" data-act="finish">' + (exam ? 'Sınavı bitir' : 'Bitir ve sonucu gör') + '</button></div></div>';
    }
    h += '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + s.items.length + '" aria-valuenow="' + (s.idx + 1) + '"><span style="width:' + ((s.idx + 1) / s.items.length * 100) + '%"></span></div>';
    h += '<div class="test-meta"><span class="num">Soru ' + (s.idx + 1) + ' / ' + s.items.length + '</span>' + aiStatus(s) + '</div>';

    h += '<article class="qcard" aria-live="polite">';
    h += '<div class="qchips"><span class="chip static">' + esc(H.konuAdi(q.konu)) + '</span><span class="chip static ghost">' + H.TIP_ADI[q.tip] + '</span>' +
      (it.gen ? '<span class="chip gen">' + orb() + 'Üretilmiş</span>' : '') +
      (S.reports[q.id] ? '<span class="chip warn">' + ICON.flag + 'Bildirildi</span>' : '') + '</div>';
    h += '<p class="qtext">' + esc(q.soru) + '</p>';
    if (q.gorsel) h += '<figure class="qimg"><img src="img/' + esc(q.gorsel) + '.webp" alt="Hakem işareti görseli" width="300" height="300"></figure>';
    h += answerArea(it, exam);
    if (!exam && it.checked) h += feedback(it);
    h += '</article>';

    h += '<div class="test-nav">';
    h += '<button class="btn ghost" data-act="prev"' + (s.idx === 0 ? ' disabled' : '') + '>' + ICON.back + 'Önceki</button>';
    if (exam) {
      h += s.idx === s.items.length - 1 ? '<button class="btn primary" data-act="ask-finish">Sınavı bitir</button>' : '<button class="btn primary" data-act="next">Sonraki' + ICON.next + '</button>';
    } else {
      var last = s.idx === s.items.length - 1;
      if (q.tip === 'bosluk' && !it.checked) h += '<button class="btn primary" data-act="check-bosluk">Kontrol et</button>';
      else h += '<button class="btn ' + (it.checked ? 'primary' : 'ghost') + '" data-act="next">' + (last ? 'Bitir' : (it.checked ? 'Sonraki' : 'Atla')) + ICON.next + '</button>';
    }
    h += '</div>';

    if (exam) {
      h += '<div class="palette" aria-label="Soru listesi">' + s.items.map(function (x, i) {
        var done = x.answer !== null && x.answer !== '';
        return '<button class="pal' + (i === s.idx ? ' cur' : '') + (done ? ' done' : '') + '" data-act="jump" data-i="' + i + '" aria-label="Soru ' + (i + 1) + (done ? ', cevaplandı' : '') + '">' + (i + 1) + '</button>';
      }).join('') + '</div><p class="muted small center">' + answered + ' / ' + s.items.length + ' cevaplandı · Kısayollar: 1-4 şık, ← → gezinme</p>';
    }
    h += '</div>';
    return h;
  }
  function aiStatus(s) {
    if (!s.ai) return '';
    if (s.ai.state === 'loading') return '<span class="ai-chip loading">' + orb() + 'Yapay zekâ soruları hazırlanıyor…</span>';
    if (s.ai.state === 'ok') return '<span class="ai-chip">' + orb() + s.ai.n + ' üretilmiş soru eklendi</span>';
    if (s.ai.state === 'empty') return '<span class="ai-chip off">' + orb() + 'Uygun üretilmiş soru çıkmadı</span>';
    var c = s.ai.code;
    var msg = c === 'not_granted' ? 'Yapay zekâya izin verilmedi' : c === 'rate_limited' ? 'Yapay zekâ kullanım sınırına ulaşıldı' : 'Yapay zekâ soruları alınamadı';
    return '<span class="ai-chip off">' + orb() + msg + '</span>';
  }
  function answerArea(it, exam) {
    var q = it.q, L = 'ABCD';
    function stateCls(val) {
      if (exam || !it.checked) return it.answer === val ? ' sel' : '';
      var isRight = q.tip === 'dogru_yanlis' ? val === q.cevap : val === q.cevap;
      if (isRight) return ' right';
      if (it.answer === val) return ' wrong';
      return ' dim';
    }
    if (q.tip === 'dogru_yanlis') {
      return '<div class="options tf">' + [[true, 'Doğru'], [false, 'Yanlış']].map(function (p, i) {
        return '<button class="opt' + stateCls(p[0]) + '" data-act="ans" data-v="' + p[0] + '"' + (!exam && it.checked ? ' disabled' : '') + '><span class="opt-key">' + (i + 1) + '</span><span class="opt-text">' + p[1] + '</span></button>';
      }).join('') + '</div>';
    }
    if (q.tip === 'bosluk') {
      var v = it.answer == null ? '' : it.answer;
      var cls = !exam && it.checked ? (it.correct ? ' right' : ' wrong') : '';
      return '<div class="blank' + cls + '"><label class="sr" for="blank-in">Cevabın</label><input id="blank-in" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="Cevabı yaz" value="' + esc(v) + '"' + (!exam && it.checked ? ' disabled' : '') + '>' + (q.birim ? '<span class="unit">' + esc(q.birim) + '</span>' : '') + '</div>';
    }
    var ters = q.ters || (q.secenekler[0] && q.secenekler[0].charAt(0) === '@');
    return '<div class="options' + (ters ? ' imgs' : '') + '">' + it.order.map(function (orig, i) {
      var txt = q.secenekler[orig];
      var inner = ters ? '<img src="img/' + esc(txt.slice(1)) + '.webp" alt="Seçenek ' + L[i] + '" loading="lazy">' : '<span class="opt-text">' + esc(txt) + '</span>';
      return '<button class="opt' + stateCls(orig) + '" data-act="ans" data-v="' + orig + '"' + (!exam && it.checked ? ' disabled' : '') + '><span class="opt-key">' + L[i] + '</span>' + inner + '</button>';
    }).join('') + '</div>';
  }
  function feedback(it) {
    var q = it.q;
    var h = '<div class="feedback ' + (it.correct ? 'ok' : 'bad') + '" id="feedback">';
    h += '<p class="fb-title">' + (it.correct ? ICON.check + 'Doğru' : ICON.x + 'Yanlış') + '</p>';
    if (!it.correct) h += '<p class="fb-answer">Doğru cevap: <b>' + answerDisplay(q) + '</b></p>';
    h += '<p class="fb-exp">' + esc(q.aciklama) + '</p>';
    h += '<p class="fb-src"><span class="chip rule">' + esc(kuralLabel(q.kural)) + '</span><span class="muted small">' + esc(kaynakText(q)) + '</span></p>';
    if (it.gen) {
      h += '<div class="gen-box"><p class="small">' + orb() + 'Bu soru yapay zekâ tarafından üretildi; istatistiklerini etkilemez. Doğruluğunu kontrol ettiysen kalıcı bankaya ekleyebilirsin.</p>' +
        (it.added ? '<span class="chip ok">' + ICON.check + 'Bankaya eklendi</span>' : '<button class="btn soft sm" data-act="add-bank">Bankaya ekle</button>') + '</div>';
    } else {
      h += reportBlock(q.id);
    }
    h += '</div>';
    return h;
  }
  function answerDisplay(q) {
    if (q.tip === 'isaret' && q.ters) { var s = SIGBY[q.secenekler[q.cevap].slice(1)]; return esc(s ? 'İşaret no. ' + s.no + ' – ' + s.ad : q.secenekler[q.cevap]); }
    return esc(H.correctAnswerText(q));
  }
  function reportBlock(qid) {
    if (S.reports[qid]) return '<p class="report-done small">' + ICON.flag + 'Bu soruyu bildirdin. <button class="link" data-act="unreport" data-q="' + esc(qid) + '">Bildirimi kaldır</button></p>';
    if (S.ui.reportOpen === qid) {
      return '<div class="report-form"><label for="report-note" class="small">Sorun nedir? (isteğe bağlı)</label><textarea id="report-note" rows="2" placeholder="Örn. şık B de doğru olabilir"></textarea>' +
        '<div class="row-actions"><button class="btn ghost sm" data-act="report-cancel">Vazgeç</button><button class="btn warn-soft sm" data-act="report-send" data-q="' + esc(qid) + '">Bildir</button></div></div>';
    }
    return '<button class="link report" data-act="report-open" data-q="' + esc(qid) + '">' + ICON.flag + 'Bu soru hatalı</button>';
  }

  // ---------- Sonuç ----------
  function viewResult() {
    var r = S.result; if (!r) return viewHome();
    var rate = r.total ? r.correct / r.total : 0;
    var C = 2 * Math.PI * 52;
    var h = '<section class="result-hero card">';
    h += '<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="Başarı yüzde ' + Math.round(rate * 100) + '"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg ' + rateClass(rate) + '" stroke-dasharray="' + (C * rate).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" class="ring-txt">%' + Math.round(rate * 100) + '</text></svg>';
    h += '<div class="result-text"><p class="eyebrow">' + esc(r.title) + (r.timeUp ? ' · Süre doldu' : '') + '</p><h1 class="num">' + r.correct + ' / ' + r.total + ' doğru</h1>' +
      '<p class="result-sub"><span class="good">' + r.correct + ' doğru</span> · <span class="low">' + r.wrong + ' yanlış</span>' + (r.blank ? ' · <span class="muted">' + r.blank + ' boş</span>' : '') + ' · Süre ' + H.formatDuration(r.elapsed) + (r.duration ? ' / ' + H.formatDuration(r.duration) : '') + '</p>' +
      (r.genTotal ? '<p class="small">' + orb() + 'Üretilmiş sorular: ' + r.genCorrect + '/' + r.genTotal + ' (istatistiğe katılmaz)</p>' : '') +
      '<div class="row-actions"><button class="btn primary" data-act="nav" data-view="home">Ana sayfa</button>' + (r.wrong ? '<button class="btn soft" data-act="open" data-sheet="review">Yanlışlarımı çalış</button>' : '') + '<button class="btn ghost" data-act="nav" data-view="analiz">Analiz</button></div></div>';
    h += '</section>';

    h += '<section class="card"><div class="card-head"><h2>Konu kırılımı</h2></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Konu</th><th class="r">Doğru</th><th class="r">Oran</th></tr></thead><tbody>' +
      r.topics.map(function (t) { var rr = t.c / t.n; return '<tr><td>' + esc(H.konuAdi(t.konu)) + '</td><td class="r num">' + t.c + '/' + t.n + '</td><td class="r num ' + rateClass(rr) + '">' + pct(rr) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>';

    var list = r.wrongItems.concat(r.blankItems);
    h += '<section class="card"><div class="card-head"><h2>Yanlışlar ve açıklamalar</h2><span class="muted">' + list.length + ' soru</span></div>';
    if (!list.length) h += '<p class="empty">Hepsi doğru. Tebrikler!</p>';
    else h += '<ol class="review-list">' + list.map(function (it) {
      var q = it.q;
      return '<li class="rv"><p class="rv-q">' + esc(q.soru) + '</p>' + (q.gorsel ? '<img class="rv-img" src="img/' + esc(q.gorsel) + '.webp" alt="Hakem işareti görseli" loading="lazy">' : '') +
        '<p class="rv-a">' + (it.checked ? '<span class="low">Senin cevabın: ' + esc(givenText(it)) + '</span> · ' : '<span class="muted">Boş bırakıldı</span> · ') + '<span class="good">Doğru: ' + answerDisplay(q) + '</span></p>' +
        '<p class="rv-e">' + esc(q.aciklama) + '</p><p class="fb-src"><span class="chip rule">' + esc(kuralLabel(q.kural)) + '</span><span class="muted small">' + esc(kaynakText(q)) + '</span>' + (it.gen ? '<span class="chip gen">' + orb() + 'Üretilmiş</span>' : '') + '</p>' +
        (it.gen ? '' : reportBlock(q.id)) + '</li>';
    }).join('') + '</ol>';
    h += '</section>';
    return h;
  }
  function givenText(it) {
    var q = it.q;
    if (q.tip === 'dogru_yanlis') return it.answer ? 'Doğru' : 'Yanlış';
    if (q.tip === 'bosluk') return String(it.answer);
    var t = q.secenekler[it.answer];
    if (t && t.charAt(0) === '@') { var s = SIGBY[t.slice(1)]; return s ? 'İşaret no. ' + s.no + ' – ' + s.ad : t; }
    return t;
  }

  // ---------- Analiz ----------
  function viewAnaliz() {
    var ts = H.topicStats(S.bank, S.stats);
    var errs = H.ruleErrors(S.bank, S.stats);
    var o = H.overallStats(S.bank, S.stats);
    var h = '<div class="page-head"><h1>Analiz</h1><p class="lede">Yalnızca doğrulanmış bankadaki sorulardan hesaplanır; üretilmiş sorular katılmaz.</p></div>';
    h += '<section class="card"><div class="card-head"><h2>Konu bazlı başarı</h2><span class="muted num">Genel ' + pct(o.rate) + ' · ' + o.a + ' cevap</span></div><ul class="rows topics">' + ts.map(function (t) {
      var k = H.KONULAR[t.konu - 1];
      return '<li class="row"><span class="t-no num">' + t.konu + '</span><div class="row-main"><span class="row-title">' + esc(t.ad) + '</span><span class="row-sub">' + esc(/^\d/.test(k.kural) ? 'Kural ' + k.kural : k.kural) + ' · ' + t.seen + '/' + t.total + ' soru görüldü · ' + t.c + '/' + t.a + ' doğru</span></div>' + bar(t.rate) +
        '<span class="row-val num ' + rateClass(t.rate) + '">' + pct(t.rate) + '</span><button class="btn ghost sm" data-act="start-topic" data-konu="' + t.konu + '" aria-label="' + esc(t.ad) + ' çalış">Çalış</button></li>';
    }).join('') + '</ul></section>';

    h += '<section class="card"><div class="card-head"><h2>Kural numarası bazlı hata listesi</h2><span class="muted">En çok hata en üstte</span></div>';
    if (!errs.length) h += '<p class="empty">Henüz yanlış cevap yok. Yanlış yaptığın kurallar burada "15.2.3: 3 yanlış / 4 deneme" biçiminde listelenir.</p>';
    else h += '<div class="rule-list">' + errs.map(function (r) {
      return '<details class="rule"><summary><span class="chip rule">' + esc(kuralLabel(r.kural)) + '</span><span class="rule-txt"><b class="num">' + r.wrong + ' yanlış / ' + r.attempts + ' deneme</b><small>' + esc(H.konuAdi(r.konu)) + '</small></span>' + bar(1 - r.wrong / r.attempts) + '</summary>' +
        '<ul class="rule-qs">' + r.qids.map(function (id) {
          var q = S.byId[id], st = S.stats[id];
          return '<li><p>' + esc(q.soru) + '</p><p class="small"><span class="good">Doğru: ' + answerDisplay(q) + '</span> · <span class="muted num">' + st.c + '/' + st.a + ' doğru' + (H.inReview(st) ? ' · tekrar: ' + new Date(st.next).toLocaleDateString('tr-TR') : st.learned ? ' · öğrenildi' : '') + '</span></p><p class="small muted">' + esc(q.aciklama) + '</p></li>';
        }).join('') + '</ul><button class="btn soft sm" data-act="start-rule" data-k="' + esc(r.kural) + '">Bu kuralı çalış</button></details>';
    }).join('') + '</div>';
    h += '</section>';

    var allRep = Object.keys(S.reports);
    var rep = allRep.filter(function (id) { return S.byId[id]; });
    var eski = allRep.length - rep.length; // soru bankası yenilendiğinde artık var olmayan sorulara ait bildirimler
    h += '<section class="card"><div class="card-head"><h2>Bildirilen sorular</h2><span class="muted">' + rep.length + '</span></div>';
    if (!rep.length) h += '<p class="empty">Hatalı bulduğun soruları "Bu soru hatalı" ile bildirebilirsin; düzeltilene kadar burada işaretli kalır ve deneme sınavına alınmaz.</p>';
    else h += '<ul class="rows">' + rep.map(function (id) {
      var q = S.byId[id]; var r = S.reports[id];
      return '<li class="row rep"><div class="row-main"><span class="row-title qline">' + esc(q.soru) + '</span><span class="row-sub">' + esc(kuralLabel(q.kural) + ' · ' + id) + (r.note ? ' · Not: ' + esc(r.note) : '') + '</span></div><button class="btn ghost sm" data-act="unreport" data-q="' + esc(id) + '">Düzeltildi</button></li>';
    }).join('') + '</ul>';
    if (eski) h += '<p class="muted small old-reps">Önceki soru bankasından kalan ' + eski + ' bildirim var; bu sorular yeni havuzda yok. <button class="link" data-act="clear-old-reports">Temizle</button></p>';
    h += '</section>';

    h += '<section class="card quiet"><div class="card-head"><h2>İlerlemeyi sıfırla</h2></div><p class="muted small">Tüm cevap istatistikleri ve tekrar listesi silinir. Bankaya eklediğin sorular ve bildirimler kalır.</p>' +
      (S.ui.confirmReset ? '<div class="row-actions"><button class="btn ghost sm" data-act="reset-cancel">Vazgeç</button><button class="btn danger-soft sm" data-act="reset-do">Evet, sıfırla</button></div>' : '<button class="btn ghost sm" data-act="reset-ask">Sıfırla…</button>') + '</section>';
    return h;
  }

  // ---------- Çalışma ----------
  function viewCalisma() {
    var tabs = [['ozet', 'Konu özetleri'], ['havuz', 'Soru havuzu'], ['sayi', 'Sayısal değerler'], ['degisen', 'Değişen kurallar'], ['isaret', 'İşaretler']];
    var h = '<div class="page-head"><h1>Çalışma</h1><p class="lede">Kural numaralarıyla kısa özetler, her konunun soru havuzu, tüm sayılar tek tabloda ve 2025-2028 değişiklikleri.</p></div>';
    h += '<div class="seg" role="tablist">' + tabs.map(function (t) { return '<button role="tab" aria-selected="' + (S.ui.studyTab === t[0]) + '" class="seg-btn' + (S.ui.studyTab === t[0] ? ' on' : '') + '" data-act="study-tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (S.ui.studyTab === 'ozet') {
      h += '<div class="sum-list">' + H.KONULAR.map(function (k) {
        var items = STUDY.ozetler[k.id] || [];
        return '<details class="sum"><summary><span class="t-no num">' + k.id + '</span><span class="sum-t">' + esc(k.ad) + '<small>' + esc(/^\d/.test(k.kural) ? 'Kural ' + k.kural : k.kural) + '</small></span></summary><ul>' +
          items.map(function (p) { return '<li><span class="chip rule">' + esc(p[0]) + '</span><span>' + esc(p[1]) + '</span></li>'; }).join('') +
          '</ul><button class="btn soft sm" data-act="start-topic" data-konu="' + k.id + '">Bu konuyu çalış</button></details>';
      }).join('') + '</div>';
    } else if (S.ui.studyTab === 'havuz') {
      h += viewHavuz();
    } else if (S.ui.studyTab === 'sayi') {
      h += STUDY.sayisal.map(function (g) {
        return '<section class="card"><div class="card-head"><h2>' + esc(g.grup) + '</h2></div><div class="table-wrap"><table class="tbl nums"><thead><tr><th>Konu</th><th>Değer</th><th class="r">Kaynak</th></tr></thead><tbody>' +
          g.satirlar.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td class="num strong">' + esc(r[1]) + '</td><td class="r"><span class="chip rule">' + esc(r[2]) + '</span></td></tr>'; }).join('') + '</tbody></table></div></section>';
      }).join('');
    } else if (S.ui.studyTab === 'degisen') {
      h += '<p class="muted small">Kaynak: Casebook 2025 "2024 ve 2025 versiyonları arasındaki ilgili değişiklikler" listesi, Kurallar 2025-2028 ve Hakemlik Rehberi 2025.</p><ul class="changes">' + STUDY.degisiklikler.map(function (c) {
        return '<li class="change card"><div class="change-head"><span class="chip rule">' + esc(c.kural) + '</span><h3>' + esc(c.baslik) + '</h3></div><p>' + esc(c.aciklama) + '</p><p class="muted small">' + esc(c.kaynak) + '</p></li>';
      }).join('') + '</ul>';
    } else {
      var groups = [['el', 'Hakemlerin resmi el işaretleri (Şema D11)'], ['bayrak', 'Çizgi hakemlerinin bayrak işaretleri (Şema D12)']];
      h += '<p class="muted small">F: başhakem · S: yardımcı hakem · parantez içi: yalnızca özel durumlarda.</p>' + groups.map(function (g) {
        return '<h2 class="sig-h">' + g[1] + '</h2><div class="sig-grid">' + SIG.signals.filter(function (s) { return s.grup === g[0]; }).map(function (s) {
          return '<figure class="sig"><div class="sig-img"><img src="img/' + s.id + '.webp" alt="' + esc(s.ad) + ' işareti" loading="lazy"></div><figcaption><span class="sig-no num">' + esc(s.no) + '</span><b>' + esc(s.ad) + '</b><span class="small muted">' + esc(s.tarif) + '</span>' + (s.kim ? '<span class="chip static ghost">' + esc(s.kim) + '</span>' : '') + '</figcaption></figure>';
        }).join('') + '</div>';
      }).join('');
    }
    return h;
  }

  // Konu soru havuzu: her konunun kendi havuzu, zorluk/tip dağılımı ve cevaplı liste
  function viewHavuz() {
    var k = S.ui.havuzKonu, ko = H.KONULAR[k - 1], oz = H.havuzOzet(S.bank, k);
    var zSec = H.zorlukSecimi(S.ui.havuzZorluk);
    var list = S.bank.filter(function (q) { return q.dogrulandi && q.konu === k && (!zSec || zSec.indexOf(q.zorluk) >= 0); })
      .sort(function (a, b) { return H.compareRule(a.kural, b.kural) || b.zorluk - a.zorluk; });
    var h = '<section class="card pool-head">' +
      '<label class="field"><span>Konu</span><select id="havuz-konu" data-act="havuz-konu">' + H.KONULAR.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === k ? ' selected' : '') + '>' + x.id + '. ' + esc(x.ad) + ' (' + H.havuzOzet(S.bank, x.id).toplam + ')</option>';
      }).join('') + '</select></label>' +
      '<p class="muted small">' + esc(/^\d/.test(ko.kural) ? 'Kural ' + ko.kural : ko.kural) + ' · <b class="num">' + oz.toplam + '</b> soru</p>' +
      '<div class="pool-dist">' +
        [3, 2, 1].map(function (z) { return '<span class="chip static' + (z === 3 ? ' strong' : '') + '">' + H.ZORLUK_ADI[z] + ' <b class="num">' + (oz.zorluk[z] || 0) + '</b></span>'; }).join('') +
        Object.keys(oz.tip).map(function (t) { return '<span class="chip static ghost">' + H.TIP_ADI[t] + ' <b class="num">' + oz.tip[t] + '</b></span>'; }).join('') +
      '</div>' +
      zorlukChips('havuz-z', S.ui.havuzZorluk) +
      '<div class="row-actions"><button class="btn primary" data-act="start-havuz"' + (list.length ? '' : ' disabled') + '>Bu havuzdan çalış (' + list.length + ' soru)</button></div>' +
      '</section>';
    if (!list.length) return h + '<p class="empty">Bu zorlukta soru yok.</p>';
    h += '<ol class="pool-list">' + list.map(function (q) {
      var opts = '';
      if (q.secenekler && !q.ters) {
        opts = '<ul class="pool-opts">' + q.secenekler.map(function (s, i) {
          return '<li class="' + (i === q.cevap ? 'right' : '') + '">' + (i === q.cevap ? ICON.check : '') + '<span>' + esc(s) + '</span></li>';
        }).join('') + '</ul>';
      } else {
        opts = '<p class="small"><span class="good">Doğru: ' + answerDisplay(q) + '</span></p>';
      }
      return '<li><details class="pool-q"><summary><span class="qline">' + esc(q.soru) + '</span><span class="pool-meta"><span class="chip rule">' + esc(kuralLabel(q.kural)) + '</span><span class="chip static ghost">' + H.TIP_ADI[q.tip] + '</span><span class="chip static' + (q.zorluk === 3 ? ' strong' : '') + '">' + H.ZORLUK_ADI[q.zorluk] + '</span></span></summary>' +
        (q.gorsel ? '<img class="rv-img" src="img/' + esc(q.gorsel) + '.webp" alt="Hakem işareti görseli" loading="lazy">' : '') +
        opts + '<p class="small muted">' + esc(q.aciklama) + '</p><p class="fb-src"><span class="muted small">' + esc(kaynakText(q)) + '</span></p></details></li>';
    }).join('') + '</ol>';
    return h;
  }

  // ============ Render ============
  function renderMain() {
    var m = $('#main'); if (!m) return;
    var v = S.view;
    m.className = 'wrap view-' + v;
    m.innerHTML = v === 'test' ? viewTest() : v === 'result' ? viewResult() : v === 'analiz' ? viewAnaliz() : v === 'calisma' ? viewCalisma() : viewHome();
    if (v === 'test') {
      var bi = $('#blank-in');
      if (bi && !bi.disabled) bi.focus({ preventScroll: true });
    }
  }
  function render() { renderTopbar(); renderMain(); renderSheet(); }

  // ============ Olaylar ============
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var act = t.getAttribute('data-act');
    if (t.tagName === 'INPUT') return; // change olayında işlenir
    var s = S.session;
    switch (act) {
      case 'nav': S.view = t.getAttribute('data-view'); S.sheet = null; S.ui.confirmReset = false; render(); window.scrollTo(0, 0); break;
      case 'open': openSheet(t.getAttribute('data-sheet')); break;
      case 'close': S.sheet = null; renderSheet(); break;
      case 'exam-step': S.ui.examCount = Math.max(1, (parseInt(S.ui.examCount, 10) || 25) + parseInt(t.getAttribute('data-d'), 10)); renderSheet(); break;
      case 'exam-preset': S.ui.examCount = parseInt(t.getAttribute('data-n'), 10); renderSheet(); break;
      case 'start-exam': startExam(); break;
      case 'topic-count': var c = t.getAttribute('data-c'); S.ui.topicCount = c === 'all' ? 'all' : parseInt(c, 10); renderSheet(); break;
      case 'start-topic-sheet': startTopic(S.ui.topicSel, S.ui.topicCount, S.ui.topicZorluk); break;
      case 'exam-z': S.ui.examZorluk = t.getAttribute('data-z'); renderSheet(); break;
      case 'topic-z': S.ui.topicZorluk = t.getAttribute('data-z'); renderSheet(); break;
      case 'havuz-z': S.ui.havuzZorluk = t.getAttribute('data-z'); renderMain(); break;
      case 'start-havuz': startTopic(S.ui.havuzKonu, 'all', S.ui.havuzZorluk); break;
      case 'clear-old-reports':
        Object.keys(S.reports).forEach(function (id) { if (!S.byId[id]) removeReport(id); });
        toast('Eski bildirimler temizlendi.'); renderMain(); break;
      case 'start-topic': startTopic(parseInt(t.getAttribute('data-konu'), 10), 20); break;
      case 'weak-count': S.ui.weakCount = parseInt(t.getAttribute('data-c'), 10); renderSheet(); break;
      case 'start-weak': startWeak(); break;
      case 'start-review': startReview(); break;
      case 'start-rule': startRule(t.getAttribute('data-k')); break;
      case 'ans':
        var it = currentItem(); if (!it) break;
        var raw = t.getAttribute('data-v');
        answerItem(it, raw === 'true' ? true : raw === 'false' ? false : parseInt(raw, 10));
        break;
      case 'check-bosluk': checkBlank(); break;
      case 'next': go(1); break;
      case 'prev': go(-1); break;
      case 'jump': if (s) { s.idx = parseInt(t.getAttribute('data-i'), 10); renderMain(); } break;
      case 'exit': S.ui.confirmExit = true; renderMain(); break;
      case 'ask-finish': S.ui.confirmExit = true; renderMain(); window.scrollTo(0, 0); break;
      case 'exit-cancel': S.ui.confirmExit = false; renderMain(); break;
      case 'exit-discard': stopTimer(); S.session = null; S.view = 'home'; S.ui.confirmExit = false; render(); break;
      case 'finish': S.ui.confirmExit = false; finishSession(false); break;
      case 'add-bank': var gi = currentItem(); if (gi && gi.gen && !gi.added) { addToBank(gi); renderMain(); } break;
      case 'report-open': S.ui.reportOpen = t.getAttribute('data-q'); renderMain(); var ta = $('#report-note'); if (ta) ta.focus(); break;
      case 'report-cancel': S.ui.reportOpen = null; renderMain(); break;
      case 'report-send': var note = ($('#report-note') || {}).value || ''; setReport(t.getAttribute('data-q'), note.trim()); S.ui.reportOpen = null; renderMain(); break;
      case 'unreport': removeReport(t.getAttribute('data-q')); renderMain(); break;
      case 'study-tab': S.ui.studyTab = t.getAttribute('data-t'); renderMain(); break;
      case 'reset-ask': S.ui.confirmReset = true; renderMain(); break;
      case 'reset-cancel': S.ui.confirmReset = false; renderMain(); break;
      case 'reset-do':
        S.stats = {}; S.ui.confirmReset = false;
        if (S.store) S.store.resetStats();
        toast('İlerleme sıfırlandı.'); render(); break;
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target, act = t.getAttribute && t.getAttribute('data-act');
    if (act === 'exam-type') {
      var set = S.ui.examTypes.filter(function (x) { return x !== t.value; });
      if (t.checked) set.push(t.value);
      S.ui.examTypes = H.TUM_TIPLER.filter(function (x) { return set.indexOf(x) >= 0; });
      renderSheet();
    } else if (act === 'topic-sel') {
      S.ui.topicSel = parseInt(t.value, 10); renderSheet();
    } else if (act === 'havuz-konu') {
      S.ui.havuzKonu = parseInt(t.value, 10); renderMain();
    } else if (act === 'ai-toggle') {
      S.ui[t.getAttribute('data-key')] = t.checked;
    }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'exam-count') {
      S.ui.examCount = t.value;
      var avail = examAvail();
      var d = $('#exam-dur'); if (d) d.textContent = H.formatDuration(H.examDurationSec(Math.min(parseInt(t.value, 10) || 0, avail)));
    } else if (t.id === 'blank-in') {
      var it = currentItem(); if (it && S.session && S.session.mode === 'exam') it.answer = t.value;
    }
  });

  function checkBlank() {
    var it = currentItem(), inp = $('#blank-in'); if (!it || !inp) return;
    if (!inp.value.trim()) { toast('Önce cevabı yaz.'); return; }
    answerItem(it, inp.value);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.sheet) { S.sheet = null; renderSheet(); return; }
    if (S.view !== 'test' || !S.session || S.sheet) return;
    var tag = (e.target.tagName || '').toLowerCase();
    var it = currentItem(), exam = S.session.mode === 'exam';
    if (tag === 'textarea') return;
    if (tag === 'input') {
      if (e.key === 'Enter') { e.preventDefault(); if (exam) go(1); else if (!it.checked) checkBlank(); else go(1); }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    var map = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
    if (k in map && it && it.q.tip !== 'bosluk') {
      var i = map[k];
      if (it.q.tip === 'dogru_yanlis') { if (i < 2) answerItem(it, i === 0); }
      else if (it.order && i < it.order.length) answerItem(it, it.order[i]);
      e.preventDefault();
    } else if (e.key === 'Enter' || (exam && e.key === 'ArrowRight')) {
      if (exam || it.checked) { e.preventDefault(); go(1); }
    } else if (e.key === 'ArrowLeft' && exam) { e.preventDefault(); go(-1); }
  });

  window.addEventListener('pagehide', function () { if (S.store && S.store.flushNow) S.store.flushNow(); });

  // Test ve hata ayıklama için okunur durum
  window.__HKM_APP__ = { state: S, render: render, finishSession: finishSession };

  render();
  initStore();
  initAI();
})();
