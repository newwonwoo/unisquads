from pathlib import Path

path = Path("public/app.js")
source = path.read_text(encoding="utf-8")
old = "const addressEvidence = [...addressEvidence];"
new = "const addressEvidence = [...addressNarrowing.evidence];"
count = source.count(old)
if count != 1:
    raise RuntimeError(f"expected one self-reference, found {count}")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
print("sub-building evidence initialization fixed")
