/* Voleybol Hakem Sınavı — saf iş mantığı (tarayıcı + Node testleri). */
(function (root) {
  'use strict';

  var DAY = 86400000;
  var SN_PER_SORU = 72;
  var TEKRAR_GUN = [1, 3, 7]; // yanlıştan sonra: 1 gün; 1. doğrudan sonra 3; 2. doğrudan sonra 7; 3. doğru = öğrenildi
  var OGRENILDI_SERI = 3;

  var KONULAR = [
    { id: 1, ad: 'Tesisler ve Donanım', kural: '1-3' },
    { id: 2, ad: 'Katılımcılar / Takım Liderleri', kural: '4-5' },
    { id: 3, ad: 'Sayı, Set, Maç', kural: '6' },
    { id: 4, ad: 'Oyunun Yapısı', kural: '7' },
    { id: 5, ad: 'Oyun Hareketleri / Topla Oynama', kural: '8-10' },
    { id: 6, ad: 'Filedeki Oyuncu', kural: '11' },
    { id: 7, ad: 'Servis', kural: '12' },
    { id: 8, ad: 'Hücum Vuruşu', kural: '13' },
    { id: 9, ad: 'Blok', kural: '14' },
    { id: 10, ad: 'Duraklamalar', kural: '15' },
    { id: 11, ad: 'Geciktirmeler', kural: '16' },
    { id: 12, ad: 'İstisnai Duraklamalar ve Fasılalar', kural: '17-18' },
    { id: 13, ad: 'Libero', kural: '19' },
    { id: 14, ad: 'Davranış ve Yaptırımlar', kural: '20-21' },
    { id: 15, ad: 'Hakemler ve Görevleri', kural: '22-29' },
    { id: 16, ad: 'Resmi İşaretler', kural: '30' },
    { id: 17, ad: 'Yazı Hakemi / Müsabaka Cetveli', kural: '27-28' },
    { id: 18, ad: 'Hakemlik Rehberi', kural: 'Rehber' },
    { id: 19, ad: 'Hakem ve Gözlemci El Kitabı', kural: 'El Kitabı' },
    { id: 20, ad: 'Challenge / GDS', kural: 'GDS' },
    { id: 21, ad: 'Seyirci Davranışları Uygulaması', kural: 'Seyirci' },
  ];

  var KAYNAK_ADI = {
    kurallar: 'Kurallar 2025-2028',
    casebook: 'Casebook 2025',
    rehber: 'Hakemlik Rehberi 2025',
    elkitabi: 'Hakem ve Gözlemci El Kitabı',
    gds: 'GDS Uygulama Esasları 2026',
    seyirci: 'Seyirci Uygulaması',
    isaret: 'Kurallar, Şema D11-D12',
    uretilmis: 'Yapay zekâ (bankaya eklendi)',
  };

  var TIP_ADI = {
    coktan_secmeli: 'Çoktan seçmeli',
    dogru_yanlis: 'Doğru / Yanlış',
    vaka: 'Vaka',
    bosluk: 'Boşluk doldurma',
    isaret: 'İşaret',
  };

  var TUM_TIPLER = ['coktan_secmeli', 'dogru_yanlis', 'vaka', 'isaret', 'bosluk'];
  var VARSAYILAN_TIPLER = ['coktan_secmeli', 'dogru_yanlis', 'vaka', 'isaret'];

  // Zorluk: 1 temel, 2 orta, 3 klasman (detaylı kural bilgisi)
  var ZORLUK_ADI = { 1: 'Temel', 2: 'Orta', 3: 'Klasman' };
  // karma: soruların bir kısmı (zincirPay) maç senaryosu adımlarından seçilir (q.zincir = senaryo adımı)
  var ZORLUK_SECENEK = [
    { id: 'karma', ad: 'Karma (%40 senaryo adımı)', z: null, zincirPay: 0.4, sinav: true },
    { id: 'hepsi', ad: 'Tümü', z: null },
    { id: 'klasman', ad: 'Yalnız klasman', z: [3] },
    { id: 'zincir', ad: 'Yalnız senaryo adımları', z: null, zincir: true },
  ];
  function zorlukFiltre(id) {
    for (var i = 0; i < ZORLUK_SECENEK.length; i++) {
      var o = ZORLUK_SECENEK[i];
      if (o.id === id) return { zorluk: o.z, zincir: !!o.zincir, zincirPay: o.zincirPay || 0 };
    }
    return { zorluk: null, zincir: false, zincirPay: 0 };
  }
  function zorlukSecimi(id) { return zorlukFiltre(id).zorluk; }

  // Konu havuzu özeti: zorluk, tip ve kaynak dağılımı
  function havuzOzet(bank, konu) {
    var o = { toplam: 0, zorluk: { 1: 0, 2: 0, 3: 0 }, tip: {}, kaynak: {} };
    bank.forEach(function (q) {
      if (!q.dogrulandi || q.konu !== konu) return;
      o.toplam++;
      o.zorluk[q.zorluk] = (o.zorluk[q.zorluk] || 0) + 1;
      o.tip[q.tip] = (o.tip[q.tip] || 0) + 1;
      o.kaynak[q.kaynak] = (o.kaynak[q.kaynak] || 0) + 1;
    });
    return o;
  }

  function konuAdi(id) {
    for (var i = 0; i < KONULAR.length; i++) if (KONULAR[i].id === id) return KONULAR[i].ad;
    return 'Konu ' + id;
  }

  // ---------- Rastgelelik ----------
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    rnd = rnd || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- Süre ----------
  function examDurationSec(n) { return Math.max(0, Math.round(n)) * SN_PER_SORU; }
  function formatDuration(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ---------- Aralıklı tekrar ----------
  function emptyStat() { return { a: 0, c: 0, w: 0, s: 0, last: 0, next: null, learned: false }; }

  function applyAnswer(stat, correct, now) {
    var s = Object.assign(emptyStat(), stat || {});
    s.a += 1;
    s.last = now;
    if (correct) {
      s.c += 1;
      if (s.w > 0 && !s.learned) {
        s.s += 1;
        if (s.s >= OGRENILDI_SERI) { s.learned = true; s.next = null; }
        else s.next = now + TEKRAR_GUN[s.s] * DAY;
      } else {
        s.s += 1;
      }
    } else {
      s.w += 1;
      s.s = 0;
      s.learned = false;
      s.next = now + TEKRAR_GUN[0] * DAY;
    }
    return s;
  }

  function inReview(stat) { return !!stat && stat.w > 0 && !stat.learned && stat.next != null; }
  function endOfDay(now) { var d = new Date(now); d.setHours(23, 59, 59, 999); return d.getTime(); }
  function isDue(stat, now) { return inReview(stat) && stat.next <= now; }
  function isDueToday(stat, now) { return inReview(stat) && stat.next <= endOfDay(now); }

  function dueList(bank, stats, now, untilEndOfDay) {
    var out = [];
    for (var i = 0; i < bank.length; i++) {
      var st = stats[bank[i].id];
      if (untilEndOfDay ? isDueToday(st, now) : isDue(st, now)) out.push(bank[i]);
    }
    out.sort(function (x, y) { return stats[x.id].next - stats[y.id].next; });
    return out;
  }

  // ---------- Cevap kontrolü ----------
  function normalizeAnswer(s, birim) {
    var t = String(s == null ? '' : s).toLocaleLowerCase('tr').trim();
    t = t.replace(/\s+/g, ' ').replace(/[.!]+$/, '').trim();
    t = t.replace(/['’](dir|dır|dur|dür|tir|tır|tur|tür|de|da|te|ta)$/u, '').trim();
    if (birim) {
      var b = String(birim).toLocaleLowerCase('tr');
      if (t.endsWith(b) && t.length > b.length) t = t.slice(0, -b.length).trim();
    }
    t = t.replace(/(\d),(\d)/g, '$1.$2').replace(/\s/g, '');
    return t;
  }
  function checkBosluk(q, input) {
    var got = normalizeAnswer(input, q.birim);
    if (!got) return false;
    var gotNum = /^-?\d+(\.\d+)?$/.test(got) ? parseFloat(got) : null;
    for (var i = 0; i < q.cevap.length; i++) {
      var exp = normalizeAnswer(q.cevap[i], q.birim);
      if (exp === got) return true;
      if (gotNum != null && /^-?\d+(\.\d+)?$/.test(exp) && Math.abs(parseFloat(exp) - gotNum) < 1e-9) return true;
    }
    return false;
  }
  function checkAnswer(q, answer) {
    if (answer === null || answer === undefined || answer === '') return false;
    if (q.tip === 'dogru_yanlis') return answer === q.cevap;
    if (q.tip === 'bosluk') return checkBosluk(q, answer);
    return answer === q.cevap;
  }
  function correctAnswerText(q) {
    if (q.tip === 'dogru_yanlis') return q.cevap ? 'Doğru' : 'Yanlış';
    if (q.tip === 'bosluk') return q.cevap[0] + (q.birim ? ' ' + q.birim : '');
    return q.secenekler[q.cevap];
  }

  // ---------- İstatistik ----------
  function topicStats(bank, stats) {
    var by = {};
    KONULAR.forEach(function (k) { by[k.id] = { konu: k.id, ad: k.ad, a: 0, c: 0, seen: 0, total: 0, rate: null }; });
    for (var i = 0; i < bank.length; i++) {
      var q = bank[i];
      if (!q.dogrulandi) continue;
      var t = by[q.konu]; if (!t) continue;
      t.total++;
      var st = stats[q.id];
      if (st && st.a > 0) { t.a += st.a; t.c += st.c; t.seen++; }
    }
    return KONULAR.map(function (k) {
      var t = by[k.id];
      t.rate = t.a > 0 ? t.c / t.a : null;
      return t;
    });
  }

  function overallStats(bank, stats) {
    var a = 0, c = 0, seen = 0, total = 0;
    for (var i = 0; i < bank.length; i++) {
      if (!bank[i].dogrulandi) continue;
      total++;
      var st = stats[bank[i].id];
      if (st && st.a > 0) { a += st.a; c += st.c; seen++; }
    }
    return { a: a, c: c, seen: seen, total: total, rate: a > 0 ? c / a : null };
  }

  function weakestTopics(bank, stats, n, minAttempts) {
    n = n || 3; minAttempts = minAttempts || 3;
    return topicStats(bank, stats)
      .filter(function (t) { return t.a >= minAttempts; })
      .sort(function (x, y) { return (x.rate - y.rate) || (y.a - x.a) || (x.konu - y.konu); })
      .slice(0, n);
  }

  function ruleErrors(bank, stats) {
    var by = {};
    for (var i = 0; i < bank.length; i++) {
      var q = bank[i];
      if (!q.dogrulandi) continue;
      var st = stats[q.id];
      if (!st || !st.a) continue;
      var key = q.kural;
      var r = by[key] || (by[key] = { kural: key, konu: q.konu, wrong: 0, attempts: 0, qids: [] });
      r.wrong += st.a - st.c;
      r.attempts += st.a;
      r.qids.push(q.id);
    }
    return Object.keys(by).map(function (k) { return by[k]; })
      .filter(function (r) { return r.wrong > 0; })
      .sort(function (x, y) {
        return (y.wrong - x.wrong) || ((y.wrong / y.attempts) - (x.wrong / x.attempts)) || compareRule(x.kural, y.kural);
      });
  }

  function compareRule(a, b) {
    var pa = String(a).split(/[.\-]/), pb = String(b).split(/[.\-]/);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var x = pa[i], y = pb[i];
      if (x === undefined) return -1; if (y === undefined) return 1;
      var nx = parseInt(x, 10), ny = parseInt(y, 10);
      if (!isNaN(nx) && !isNaN(ny) && nx !== ny) return nx - ny;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }

  // ---------- Soru seçimi ----------
  function filterBank(bank, opts) {
    opts = opts || {};
    var types = opts.types, reported = opts.reported || {};
    return bank.filter(function (q) {
      if (!q.dogrulandi) return false;
      if (types && types.indexOf(q.tip) < 0) return false;
      if (opts.zorluk && opts.zorluk.indexOf(q.zorluk) < 0) return false;
      if (opts.zincir && !q.zincir) return false;
      if (opts.excludeReported && reported[q.id]) return false;
      return true;
    });
  }

  // Deneme sınavı: konular arasında dönüşümlü seçim (tüm konular karışık)
  function selectExam(bank, opts) {
    var rnd = opts.rnd || Math.random;
    var pool = filterBank(bank, { types: opts.types, zorluk: opts.zorluk, zincir: opts.zincir, reported: opts.reported, excludeReported: true });
    var count = Math.min(opts.count, pool.length);
    // Konular arasında dönüşümlü seçim
    function dagit(list, n) {
      var byTopic = {}, out = [];
      shuffle(list, rnd).forEach(function (q) { (byTopic[q.konu] = byTopic[q.konu] || []).push(q); });
      var topics = shuffle(Object.keys(byTopic), rnd);
      while (out.length < n) {
        var progressed = false;
        for (var i = 0; i < topics.length && out.length < n; i++) {
          var l = byTopic[topics[i]];
          if (l.length) { out.push(l.shift()); progressed = true; }
        }
        if (!progressed) break;
      }
      return out;
    }
    var out;
    if (opts.zincirPay > 0 && !opts.zincir) {
      // Aynı senaryodan en fazla bir soru: sonraki sorular önceki sorunun sonucunu anlattığı için cevabı ele verir
      var bySen = {};
      shuffle(pool.filter(function (q) { return q.zincir; }), rnd).forEach(function (q) { var k = q.senaryo || q.id; if (!bySen[k]) bySen[k] = q; });
      var zin = Object.keys(bySen).map(function (k) { return bySen[k]; });
      var diger = pool.filter(function (q) { return !q.zincir; });
      var nz = Math.min(zin.length, Math.round(count * opts.zincirPay));
      out = dagit(zin, nz);
      out = out.concat(dagit(diger, count - out.length));
      if (out.length < count) {
        var secili = {}; out.forEach(function (q) { secili[q.id] = 1; });
        out = out.concat(dagit(zin.filter(function (q) { return !secili[q.id]; }), count - out.length));
      }
    } else {
      out = dagit(pool, count);
    }
    if (opts.zincir) {
      // Yalnız senaryo soruları: senaryolar karışık sırada, her senaryonun soruları maç sırasıyla
      var sira = {};
      shuffle(out.map(function (q) { return q.senaryo || q.id; }), rnd).forEach(function (k, i) { if (!(k in sira)) sira[k] = i; });
      return out.slice().sort(function (a, b) { return (sira[a.senaryo || a.id] - sira[b.senaryo || b.id]) || ((a.adim || 0) - (b.adim || 0)); });
    }
    return shuffle(out, rnd);
  }

  // Maç senaryosu: adımlar her zaman senaryodaki sırayla gelir (karıştırılmaz)
  function senaryoAdimlari(bank, sen) {
    var byId = {};
    bank.forEach(function (q) { byId[q.id] = q; });
    return ((sen && sen.adimlar) || []).map(function (id) { return byId[id]; }).filter(Boolean);
  }
  // Senaryo listesi: adım sayısı, çözülen adım ve son cevapları doğru olan adım sayısı
  function senaryoOzet(bank, senaryolar, stats) {
    return (senaryolar || []).map(function (s) {
      var adim = senaryoAdimlari(bank, s), cozulen = 0, dogru = 0;
      adim.forEach(function (q) {
        var st = stats && stats[q.id];
        if (st && st.a > 0) { cozulen++; if (st.s > 0) dogru++; }
      });
      return { id: s.id, baslik: s.baslik, giris: s.giris, konular: s.konular || [], n: adim.length, cozulen: cozulen, dogru: dogru };
    });
  }

  // Konu çalışması: önce görülmemiş, sonra tekrar listesindekiler, sonra diğerleri
  function selectTopic(bank, stats, konu, count, rnd, opts) {
    rnd = rnd || Math.random;
    var pool = filterBank(bank, { zorluk: opts && opts.zorluk, zincir: opts && opts.zincir }).filter(function (q) { return q.konu === konu; });
    var unseen = [], review = [], rest = [];
    pool.forEach(function (q) {
      var st = stats[q.id];
      if (!st || !st.a) unseen.push(q);
      else if (inReview(st)) review.push(q);
      else rest.push(q);
    });
    var out = shuffle(unseen, rnd).concat(shuffle(review, rnd), shuffle(rest, rnd));
    return count ? out.slice(0, count) : out;
  }

  // Zayıf konu: en düşük başarılı konulardan ağırlıklı seçim
  function selectWeak(bank, stats, count, rnd) {
    rnd = rnd || Math.random;
    var ts = topicStats(bank, stats);
    var attempted = ts.filter(function (t) { return t.a > 0; }).sort(function (x, y) { return x.rate - y.rate; });
    var focus = attempted.slice(0, 4);
    if (focus.length < 3) {
      var unexplored = shuffle(ts.filter(function (t) { return t.a === 0 && t.total > 0; }), rnd);
      focus = focus.concat(unexplored.slice(0, 3 - focus.length));
    }
    var weights = focus.map(function (t) { return t.rate == null ? 0.5 : Math.max(0.05, 1 - t.rate); });
    var pools = focus.map(function (t) {
      var list = filterBank(bank).filter(function (q) { return q.konu === t.konu; });
      var wrong = [], unseen = [], ok = [];
      list.forEach(function (q) {
        var st = stats[q.id];
        if (st && st.a > st.c && !st.learned) wrong.push(q);
        else if (!st || !st.a) unseen.push(q);
        else ok.push(q);
      });
      return shuffle(wrong, rnd).concat(shuffle(unseen, rnd), shuffle(ok, rnd));
    });
    var out = [];
    var total = weights.reduce(function (s, w) { return s + w; }, 0);
    var guard = 0;
    while (out.length < count && guard++ < count * 20) {
      var r = rnd() * total, idx = 0;
      for (; idx < weights.length - 1; idx++) { r -= weights[idx]; if (r <= 0) break; }
      var p = pools[idx];
      if (p && p.length) out.push(p.shift());
      else if (pools.every(function (x) { return !x.length; })) break;
    }
    return { questions: out, topics: focus.map(function (t) { return t.konu; }) };
  }

  // Yanlışlarım: önce tekrar zamanı gelenler, sonra tekrar listesindeki diğerleri
  function selectReview(bank, stats, now, count) {
    var due = [], waiting = [];
    filterBank(bank).forEach(function (q) {
      var st = stats[q.id];
      if (!inReview(st)) return;
      if (st.next <= endOfDay(now)) due.push(q); else waiting.push(q);
    });
    due.sort(function (x, y) { return stats[x.id].next - stats[y.id].next; });
    waiting.sort(function (x, y) { return stats[x.id].next - stats[y.id].next; });
    var out = due.concat(waiting);
    return { questions: count ? out.slice(0, Math.max(count, due.length)) : out, dueCount: due.length };
  }

  // ---------- Yapay zekâ ----------
  var KURAL_NOTLARI = [
    'Servis vuruşu anında dönüş sırasına göre pozisyon yalnızca servis karşılayan takım için zorunludur; servis atan takımın oyuncuları herhangi bir pozisyonda olabilir (7.4).',
    'Libero takım kaptanı veya oyundaki kaptan olabilir (5).',
    'Servis sırasında top fileyi geçene kadar servis atan takımın oyuncuları ellerini başlarının üzerine kaldıramaz (12.5.3).',
    'Hakem bölümü: 22 hakem takımı, 23 başhakem, 24 yardımcı hakem, 25 challenge hakemi, 26 yedek hakem, 27 yazı hakemi, 28 skor hakemi, 29 çizgi hakemleri, 30 resmi işaretler.',
    'Mola 30 sn, sette 2 mola ve 6 oyuncu değişikliği; servis için 8 sn; fasıla 3 dk.',
  ];

  function buildGenPrompt(targets, count) {
    var lines = [];
    lines.push('Sen FIVB Resmi Voleybol Oyun Kuralları 2025-2028 konusunda uzman bir ulusal hakem eğitmenisin. Bir hakem adayı aşağıdaki kurallarla ilgili sorularda hata yaptı. Her kural için adayın yanlış yaptığı sorudan FARKLI bir yönü soran yeni sınav soruları üret.');
    lines.push('');
    lines.push('Kesin kurallar:');
    lines.push('- Yalnızca 2025-2028 kurallarına göre kesin doğru bilgiyi kullan. Emin olmadığın sayı, süre veya istisnayı sorma.');
    lines.push('- Türkçe yaz ve resmi kural terimlerini kullan (ihtar, oyundan çıkarma, diskalifiye, geciktirme uyarısı, geçiş boşluğu, oyundaki kaptan vb.).');
    lines.push('- Sorular ulusal hakem klasman düzeyinde olsun: ezber bilgi değil, gerçekçi bir maç vakası (skor, servis atan takım, oyuncu numaraları, önceki yaptırımlar gibi ayrıntılarla) kur ve çözümü yorum gerektirsin. Mümkünse soru en az iki kuralın birlikte uygulanmasını gerektirsin; bu ek kuralları "ilgili" alanında listele.');
    lines.push('- Her soruda tam olarak bir doğru cevap olsun. "coktan_secmeli" ve "vaka" sorularında 4 ayırt edici şık olsun; şıklar karar ve gerekçe/sonuç içersin, "hepsi" veya "hiçbiri" şıkkı kullanma.');
    lines.push('- Şık uzunlukları birbirine yakın olsun; doğru şık sistematik olarak en uzun şık OLMASIN (en az bir yanlış şık doğru şıktan uzun olsun).');
    lines.push('- "aciklama" alanında doğru cevabı ilgili tüm kural numaralarıyla 1-3 cümlede gerekçelendir.');
    lines.push('- 2025-2028 notları: ' + KURAL_NOTLARI.join(' '));
    lines.push('');
    lines.push('Hata yapılan kurallar ve bankadaki ilgili sorular (bağlam):');
    targets.forEach(function (t, i) {
      lines.push('[' + (i + 1) + '] Kural ' + t.kural + ' (Konu: ' + konuAdi(t.konu) + ')');
      (t.ornekler || []).slice(0, 2).forEach(function (q) {
        lines.push('  Soru: ' + q.soru);
        lines.push('  Doğru cevap: ' + correctAnswerText(q));
        lines.push('  Açıklama: ' + q.aciklama);
      });
    });
    lines.push('');
    lines.push('Toplam ' + count + ' soru üret ve kurallara dengeli dağıt. "tip" olarak "coktan_secmeli", "vaka" (kısa maç senaryosu) veya "dogru_yanlis" kullan.');
    lines.push('Yalnızca şu biçimde bir JSON dizisi döndür, başka metin yazma:');
    lines.push('[{"kural":"15.2.3","ilgili":["6.1.3"],"tip":"vaka","soru":"...","secenekler":["...","...","...","..."],"cevap":2,"aciklama":"..."},{"kural":"7.4","ilgili":["7.5"],"tip":"dogru_yanlis","soru":"...","cevap":true,"aciklama":"..."}]');
    return lines.join('\n');
  }

  function validateGenerated(arr, targets, idPrefix) {
    if (!Array.isArray(arr)) return [];
    var kuralKonu = {};
    (targets || []).forEach(function (t) { kuralKonu[t.kural] = t.konu; });
    var fallback = targets && targets[0];
    var out = [];
    arr.forEach(function (it, i) {
      if (!it || typeof it !== 'object') return;
      var tip = it.tip;
      if (['coktan_secmeli', 'vaka', 'dogru_yanlis'].indexOf(tip) < 0) return;
      var soru = typeof it.soru === 'string' ? it.soru.trim() : '';
      var aciklama = typeof it.aciklama === 'string' ? it.aciklama.trim() : '';
      if (soru.length < 12 || !aciklama) return;
      var kural = typeof it.kural === 'string' && kuralKonu[it.kural.trim()] !== undefined ? it.kural.trim() : (fallback ? fallback.kural : String(it.kural || ''));
      var q = {
        id: (idPrefix || 'u') + '-' + i,
        kaynak: 'uretilmis', kural: kural, konu: kuralKonu[kural] || (fallback ? fallback.konu : 1),
        zorluk: 2, tip: tip, soru: soru, aciklama: aciklama, dogrulandi: false, uretilmis: true,
      };
      if (Array.isArray(it.ilgili)) {
        var ilg = it.ilgili.filter(function (x) { return typeof x === 'string' && /^[0-9A-Za-z.\-]{1,20}$/.test(x.trim()) && x.trim() !== kural; })
          .map(function (x) { return x.trim(); }).slice(0, 4);
        if (ilg.length) q.ilgili = ilg;
      }
      if (tip === 'dogru_yanlis') {
        if (typeof it.cevap !== 'boolean') return;
        q.cevap = it.cevap;
      } else {
        var s = it.secenekler;
        if (!Array.isArray(s) || s.length !== 4) return;
        s = s.map(function (x) { return typeof x === 'string' ? x.trim() : ''; });
        if (s.some(function (x) { return !x; })) return;
        var uniq = {}; for (var k = 0; k < s.length; k++) uniq[s[k].toLocaleLowerCase('tr')] = 1;
        if (Object.keys(uniq).length !== 4) return;
        var c = it.cevap;
        if (typeof c !== 'number' || c % 1 !== 0 || c < 0 || c > 3) return;
        q.secenekler = s; q.cevap = c;
      }
      out.push(q);
    });
    return out;
  }

  // Yanlış yapılan kurallar → üretim hedefleri
  function genTargets(bank, stats, opts) {
    opts = opts || {};
    var konular = opts.konular, limit = opts.limit || 4;
    var errs = ruleErrors(bank, stats).filter(function (r) { return !konular || konular.indexOf(r.konu) >= 0; });
    if (opts.qids) {
      var set = {}; opts.qids.forEach(function (id) { set[id] = 1; });
      errs = errs.filter(function (r) { return r.qids.some(function (id) { return set[id]; }); });
    }
    var byId = {}; bank.forEach(function (q) { byId[q.id] = q; });
    return errs.slice(0, limit).map(function (r) {
      var ornek = r.qids.map(function (id) { return byId[id]; }).filter(function (q) {
        var st = stats[q.id]; return q && st && st.a > st.c;
      });
      return { kural: r.kural, konu: r.konu, ornekler: ornek.slice(0, 2) };
    });
  }

  // ---------- Sunum ----------
  function optionOrder(q, rnd) {
    if (!q.secenekler) return null;
    var idx = q.secenekler.map(function (_, i) { return i; });
    return shuffle(idx, rnd || Math.random);
  }

  var API = {
    DAY: DAY, SN_PER_SORU: SN_PER_SORU, TEKRAR_GUN: TEKRAR_GUN, OGRENILDI_SERI: OGRENILDI_SERI,
    KONULAR: KONULAR, KAYNAK_ADI: KAYNAK_ADI, TIP_ADI: TIP_ADI, TUM_TIPLER: TUM_TIPLER, VARSAYILAN_TIPLER: VARSAYILAN_TIPLER,
    ZORLUK_ADI: ZORLUK_ADI, ZORLUK_SECENEK: ZORLUK_SECENEK, zorlukSecimi: zorlukSecimi, zorlukFiltre: zorlukFiltre, havuzOzet: havuzOzet,
    konuAdi: konuAdi, rng: rng, shuffle: shuffle,
    examDurationSec: examDurationSec, formatDuration: formatDuration,
    emptyStat: emptyStat, applyAnswer: applyAnswer, inReview: inReview, isDue: isDue, isDueToday: isDueToday,
    endOfDay: endOfDay, dueList: dueList,
    normalizeAnswer: normalizeAnswer, checkBosluk: checkBosluk, checkAnswer: checkAnswer, correctAnswerText: correctAnswerText,
    topicStats: topicStats, overallStats: overallStats, weakestTopics: weakestTopics, ruleErrors: ruleErrors, compareRule: compareRule,
    filterBank: filterBank, selectExam: selectExam, selectTopic: selectTopic, selectWeak: selectWeak, selectReview: selectReview,
    senaryoAdimlari: senaryoAdimlari, senaryoOzet: senaryoOzet,
    buildGenPrompt: buildGenPrompt, validateGenerated: validateGenerated, genTargets: genTargets, KURAL_NOTLARI: KURAL_NOTLARI,
    optionOrder: optionOrder,
  };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.HKM = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
