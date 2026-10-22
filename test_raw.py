"""독립 경로: 원문 XML을 receipt_poc 파서 없이 정규식으로 읽어 10건 인용문이 조문 원문에 글자 그대로 있는지."""
import json, re
from pathlib import Path
H = Path(__file__).parent
exp = json.loads((H / "expected.json").read_text(encoding="utf-8"))
AM = re.compile(r"<(?:개정|신설|삭제|본조신설|전문개정|종전|제목개정)[^>]*>")
def units(fn):
    x = (H / "law" / fn).read_text(encoding="utf-8")
    out = {}
    for u in re.findall(r"<조문단위[^>]*>.*?</조문단위>", x, flags=re.S):
        if "<조문여부>조문</조문여부>" not in u: continue
        n = re.search(r"<조문번호>(\d+)</조문번호>", u).group(1)
        g = re.search(r"<조문가지번호>(\d+)</조문가지번호>", u)
        key = "제%s조" % n + ("의" + g.group(1) if g else "")
        parts = re.findall(r"<(?:조문내용|항내용|호내용|목내용)>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</(?:조문내용|항내용|호내용|목내용)>", u, flags=re.S)
        out[key] = re.sub(r"\s+", "", AM.sub("", " ".join(parts)))
    return out
laws = {"법": units("act.xml"), "령": units("decree.xml"), "칙": units("rule.xml")}
bad = 0
for r in exp["rows"]:
    law, no = r["top1"].split(" ", 1)
    q = re.sub(r"\s+", "", AM.sub("", r["quote"]))
    ok = q in laws[law][no]
    bad += not ok
    print("OK " if ok else "BAD", r["top1"], q[:30])
print("일치", len(exp["rows"]) - bad, "/", len(exp["rows"]))
raise SystemExit(1 if bad else 0)
