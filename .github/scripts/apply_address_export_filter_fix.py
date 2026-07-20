from pathlib import Path

app = Path("public/app.js")
source = app.read_text(encoding="utf-8")

old = r'''    const detailRecords = recordsForMode(recs, mode2);
'''
new = r'''    const detailRecords = mode2 === "fail" && !hasIrosResults
      ? recs.filter((rec) => rec.status !== "\uD655\uC815" && rec.status !== "CONFIRMED")
      : recordsForMode(recs, mode2);
'''
if old in source:
    source = source.replace(old, new, 1)
elif 'mode2 === "fail" && !hasIrosResults' not in source:
    raise AssertionError("detail record filter anchor not found")

old_sheet = '''    XLSX.utils.book_append_sheet(wb, makeSheet(recs, mode2), sheetName);
'''
new_sheet = '''    XLSX.utils.book_append_sheet(wb, makeSheet(detailRecords, "all"), sheetName);
'''
if old_sheet in source:
    source = source.replace(old_sheet, new_sheet, 1)
elif 'makeSheet(detailRecords, "all")' not in source:
    raise AssertionError("detail sheet anchor not found")

app.write_text(source, encoding="utf-8")

test = Path("tests/test_address_recovery_integration.mjs")
text = test.read_text(encoding="utf-8")
marker = '    "등기고유번호 추출"\n'
replacement = '    "등기고유번호 추출",\n    "mode2 === \\"fail\\" && !hasIrosResults",\n    "makeSheet(detailRecords, \\"all\\")"\n'
if marker in text:
    text = text.replace(marker, replacement, 1)
elif 'makeSheet(detailRecords, "all")' not in text:
    raise AssertionError("integration test marker not found")
test.write_text(text, encoding="utf-8")
