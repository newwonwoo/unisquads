from pathlib import Path

path = Path("public/address-multilot-rules.mjs")
text = path.read_text(encoding="utf-8")
old = '''    const zipSgg = String(zipSggRaw || "").replace(/\\s+/g, "");
    if (!zipSgg) return true;
    const compactResult = result.replace(/\\s+/g, "");
'''
new = '''    const zipSgg = String(zipSggRaw || "").replace(/\\s+/g, "");
    if (!zipSgg || canonSidoToken(zipSgg) === resultSido) return true;
    const compactResult = result.replace(/\\s+/g, "");
'''
if text.count(old) != 1:
    raise RuntimeError("zip alias patch target not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("zip alias fix applied")
