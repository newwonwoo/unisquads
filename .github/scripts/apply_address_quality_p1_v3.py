from pathlib import Path

source_path = Path('.github/scripts/apply_address_quality_p1.py')
source = source_path.read_text(encoding='utf-8')


def replace_labeled_call(text, label, replacement):
    marker = f'    "{label}"'
    idx = text.index(marker)
    start = text.rfind('app = replace_once(', 0, idx)
    end = text.index('\n)\n', idx) + 3
    return text[:start] + replacement.rstrip() + '\n' + text[end:]

source = replace_labeled_call(source, 'preserve unit on not found', '''app = replace_once(
    app,
    'return { status: "FAILED", reason: "NOT_FOUND", message:',
    'return { status: "FAILED", reason: "NOT_FOUND", unit, message:',
    "preserve unit on not found"
)''')

source = replace_labeled_call(source, 'preserve unit on system error', '''app = replace_once(
    app,
    """      status: "SYSTEM_ERROR",
      reason: "SYSTEM_ERROR",""",
    """      status: "SYSTEM_ERROR",
      reason: "SYSTEM_ERROR",
      unit: pre.unit,""",
    "preserve unit on system error"
)''')

source = replace_labeled_call(source, 'preserve unit on no-result', '''app = replace_once(
    app,
    """      status: "HUMAN_INPUT_ERROR",
      reason: "HUMAN_INPUT_ERROR",""",
    """      status: "HUMAN_INPUT_ERROR",
      reason: "HUMAN_INPUT_ERROR",
      unit: pre.unit,""",
    "preserve unit on no-result"
)''')

exec(compile(source, str(source_path), 'exec'))
