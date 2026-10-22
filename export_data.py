"""법령 XML(국가법령정보센터 DRF 전문) -> data.json. 사용: python3 export_data.py <receipt_poc.py가 있는 폴더>"""
import json, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import receipt_poc as R
U = R.load_all()
out = [{"key": a.key, "law": a.law, "no": a.no, "title": a.title, "text": a.text} for a in U.values()]
Path(__file__).with_name("data.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(len(out), "조문")
