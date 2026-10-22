const R = require("./core.js"), d = require("./data.json"), exp = require("./expected.json");
const ix = R.makeIndex(d); let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
exp.rows.forEach((r) => {
  const keys = ix.top(r.q, 3).map((x) => x[0]);
  ok(JSON.stringify(keys) === JSON.stringify(r.top3), "top3 " + r.q + " " + keys);
  const art = ix.byKey.get(keys[0]);
  ok(ix.chainStatus(art).closed === r.chain_closed, "chain " + r.q);
  const s = ix.bestSentence(art, r.q);
  ok(R.quoteInArticle(s, art), "quote " + r.q);
  ok(s.slice(0, 90) === r.quote, "sentence " + r.q);
});
const a = ix.byKey.get("법 제13조"), s = a.text.slice(0, 60);
ok(R.quoteInArticle(s, a) && !R.quoteInArticle(s.slice(0, 30) + "가" + s.slice(31), a), "one-char flip");
ok(!R.supportCheck("신고는 90일 이내에 하여야 한다", "신고는 30일 이내에 하여야 한다").supported, "number swap");
console.log(fail ? "FAILED " + fail : "OK " + exp.rows.length + " queries");
process.exit(fail ? 1 : 0);
