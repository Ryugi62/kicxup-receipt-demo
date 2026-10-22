/* 영수증형 규제 상담 측정기 — receipt_poc.py의 JS 이식 (검색 · 원문 일치 · 인용 사슬 · 어휘/수치 지지). 브라우저·node 공용. */
(function (root) {
  "use strict";
  const WS = /\s+/g;
  const AMEND = /<(?:개정|신설|삭제|본조신설|전문개정|종전|제목개정)[^>]*>/g;
  const norm = (s) => s.replace(AMEND, "").replace(WS, " ").trim();
  const DELEG = /(대통령령|총리령|산업통상부령|부령|국토교통부령|고시)(?:으로|로)\s*정하는|(대통령령|산업통상부령)으로 정한다/;
  const ONE = "제\\d+조(?:의\\d+)?(?:제\\d+항)?(?:제\\d+호)?";
  const OTHER_LAW = new RegExp("「[^」]+」\\s*(?:" + ONE + "(?:\\s*(?:,|ㆍ|및|또는)\\s*" + ONE + ")*)?", "g");
  const NUM = /\d[\d,.]*\s*(?:일|개월|월|년|명|㎡|퍼센트|%|만원|원|배|회|분의\s*\d+)/g;

  function bigrams(s) {
    const t = norm(s).replace(WS, "");
    const m = new Map();
    for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); }
    return m;
  }

  function quoteInArticle(quote, art) {
    const q = norm(quote);
    return q.length >= 8 && art.text.includes(q);
  }

  function supportCheck(claim, quote, minOverlap) {
    minOverlap = minOverlap == null ? 0.6 : minOverlap;
    const c = norm(claim), q = norm(quote);
    const nums = (c.match(NUM) || []).map((x) => x.replace(WS, ""));
    const qn = q.replace(WS, "");
    const numMissing = nums.filter((x) => !qn.includes(x));
    const grams = (s) => { const set = new Set(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); if (!g.includes(" ")) set.add(g); } return set; };
    const cb = grams(c), qb = grams(q);
    let inter = 0; cb.forEach((g) => { if (qb.has(g)) inter++; });
    const overlap = cb.size ? inter / cb.size : 0;
    return { supported: numMissing.length === 0 && overlap >= minOverlap, numMissing, overlap: Math.round(overlap * 1000) / 1000 };
  }

  function makeIndex(arts) {
    const byKey = new Map(arts.map((a) => [a.key, a]));
    const tf = new Map(), df = new Map();
    for (const a of arts) {
      const m = bigrams(a.title + a.title + a.title + " " + a.text);
      tf.set(a.key, m);
      m.forEach((_, g) => df.set(g, (df.get(g) || 0) + 1));
    }
    const n = arts.length, idf = new Map();
    df.forEach((d, g) => idf.set(g, Math.log((n + 1) / (d + 1)) + 1));
    const nrm = new Map();
    tf.forEach((m, k) => { let s = 0; m.forEach((c, g) => { s += (c * idf.get(g)) ** 2; }); nrm.set(k, Math.sqrt(s)); });
    function top(query, k, laws) {
      k = k || 3; laws = laws || ["법"];
      const q = bigrams(query);
      let qs = 0; q.forEach((c, g) => { qs += (c * (idf.get(g) || 1)) ** 2; });
      const qn = Math.sqrt(qs) || 1;
      const sc = [];
      for (const a of arts) {
        if (!laws.includes(a.law)) continue;
        const m = tf.get(a.key); let dot = 0;
        q.forEach((c, g) => { const w = idf.get(g) || 1; dot += c * w * (m.get(g) || 0) * w; });
        sc.push([a.key, dot / (qn * (nrm.get(a.key) || 1))]);
      }
      sc.sort((x, y) => y[1] - x[1]);
      return sc.slice(0, k);
    }
    function children(art) {
      if (art.law !== "법") return [];
      const m = /^제(\d+)조(?:의(\d+))?$/.exec(art.no);
      if (!m) return [];
      const pat = new RegExp("법 제" + m[1] + "조" + (m[2] ? "의" + m[2] : "(?!의\\d)") + "(?![0-9])");
      return arts.filter((a) => (a.law === "령" || a.law === "칙") && pat.test(a.text));
    }
    function chainStatus(art) {
      const delegates = DELEG.test(art.text);
      const kids = children(art);
      const internal = new Set();
      const stripped = art.text.replace(OTHER_LAW, " ");
      const re = /제(\d+)조(?:의(\d+))?/g; let mm;
      while ((mm = re.exec(stripped))) internal.add(art.law + " " + mm[0]);
      const missing = [...internal].filter((x) => !byKey.has(x) && !x.startsWith("령") && !x.startsWith("칙")).sort();
      return { closed: (!delegates || kids.length > 0) && missing.length === 0, delegates, children: kids.map((a) => a.key), missingInternal: missing };
    }
    function bestSentence(art, query) {
      const qb = bigrams(query);
      const sents = art.text.split(/(?<=[다.])\s/).filter((s) => s.length >= 20);
      if (!sents.length) return art.text.slice(0, 80);
      let best = sents[0], bs = -1;
      for (const s of sents) { let o = 0; bigrams(s).forEach((_, g) => { if (qb.has(g)) o++; }); if (o > bs) { bs = o; best = s; } }
      return best;
    }
    return { arts, byKey, top, chainStatus, bestSentence };
  }

  function verdict(claim, quote, art, idx) {
    const r = { quoteOk: quoteInArticle(quote, art), chain: idx.chainStatus(art), support: supportCheck(claim, quote) };
    const why = [];
    if (!r.quoteOk) why.push("인용문이 원문에 없음");
    if (!r.chain.closed) why.push("인용 사슬 열림");
    if (!r.support.supported) why.push("근거가 주장을 지지하지 않음");
    r.answer = why.length === 0; r.holdReasons = why;
    return r;
  }

  const api = { norm, bigrams, quoteInArticle, supportCheck, makeIndex, verdict };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Receipt = api;
})(typeof self !== "undefined" ? self : this);
