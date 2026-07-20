from pathlib import Path

app_path = Path("public/app.js")
test_path = Path("tests/test_address_recovery_integration.mjs")

source = app_path.read_text(encoding="utf-8")
old_title = r'''["\uBD80\uB3D9\uC0B0 \uB4F1\uAE30\uACE0\uC720\uBC88\uD638 \uC815\uC81C\xB7\uC911\uBCF5\uC81C\uAC70 \uACB0\uACFC"]'''
new_title = '''["주소정제·등기조회 결과"]'''
if old_title in source:
    source = source.replace(old_title, new_title, 1)
elif new_title not in source:
    raise AssertionError("summary title anchor not found")

old_button_gate = "bridgeUp && (stat.CONFIRMED || 0) > 0 && !batchRegBusy &&"
new_button_gate = "bridgeUp && irosOutcome.target > 0 && !batchRegBusy &&"
if old_button_gate in source:
    source = source.replace(old_button_gate, new_button_gate, 1)
elif new_button_gate not in source:
    raise AssertionError("IROS button gate anchor not found")

app_path.write_text(source, encoding="utf-8")

test = test_path.read_text(encoding="utf-8")
marker = '    "주소정제결과",\n'
replacement = '    "주소정제결과",\n    "주소정제·등기조회 결과",\n'
if replacement not in test:
    if marker not in test:
        raise AssertionError("integration marker anchor not found")
    test = test.replace(marker, replacement, 1)
test_path.write_text(test, encoding="utf-8")
