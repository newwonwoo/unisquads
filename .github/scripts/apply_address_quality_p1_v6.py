from pathlib import Path

source_path = Path('.github/scripts/apply_address_quality_p1.py')
source = source_path.read_text(encoding='utf-8')


def replace_labeled_call(text, label, old, new):
    marker = f'    "{label}"'
    idx = text.index(marker)
    start = text.rfind('app = replace_once(', 0, idx)
    end = text.index('\n)\n', idx) + 3
    replacement = (
        'app = replace_once(\n'
        '    app,\n'
        f'    {old!r},\n'
        f'    {new!r},\n'
        f'    {label!r}\n'
        ')\n'
    )
    return text[:start] + replacement + text[end:]

source = replace_labeled_call(
    source,
    'preserve unit on not found',
    'return { status: "FAILED", reason: "NOT_FOUND", message:',
    'return { status: "FAILED", reason: "NOT_FOUND", unit, message:'
)
source = replace_labeled_call(
    source,
    'preserve unit on system error',
    '      status: "SYSTEM_ERROR",\n      reason: "SYSTEM_ERROR",',
    '      status: "SYSTEM_ERROR",\n      reason: "SYSTEM_ERROR",\n      unit: pre.unit,'
)
source = replace_labeled_call(
    source,
    'preserve unit on no-result',
    '      status: "HUMAN_INPUT_ERROR",\n      reason: "HUMAN_INPUT_ERROR",',
    '      status: "HUMAN_INPUT_ERROR",\n      reason: "HUMAN_INPUT_ERROR",\n      unit: pre.unit,'
)
source = replace_labeled_call(
    source,
    'building propagation export source',
    '        : r.source === "naver" ? "\\uB124\\uC774\\uBC84L3"',
    '        : r.source === "건물주소군전파" ? "건물주소군전파"\n        : r.source === "naver" ? "\\uB124\\uC774\\uBC84L3"'
)

exec(compile(source, str(source_path), 'exec'))
