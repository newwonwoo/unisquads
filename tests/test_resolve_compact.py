import unittest
from types import SimpleNamespace

from api.resolve import _compact_result


class CompactResolveTests(unittest.TestCase):
    def test_compact_response_limits_and_prioritizes_near_candidates(self):
        result = SimpleNamespace(
            status="REG_UNIT_NOT_FOUND",
            unique_no=None,
            message="일치 세대 없음",
            complete=True,
            total_count=260,
            query_scope="EXACT_LOT",
            strategy="FULL_COLLECT",
            candidates=[
                {"unique_no": str(index), "dong": "101", "ho": str(index)}
                for index in range(10)
            ] + [
                {
                    "unique_no": "target",
                    "dong": "에이,비,상가",
                    "ho": "비-101",
                    "unit_source": {"dong": "buld_no_buld", "ho": "buld_no_room"},
                }
            ],
        )

        compact = _compact_result(result, dong="비", ho="101")

        self.assertEqual(3, len(compact["near_candidates"]))
        self.assertEqual("target", compact["near_candidates"][0]["unique_no"])
        self.assertNotIn("candidates", compact)
        self.assertNotIn("all_candidates", compact)


if __name__ == "__main__":
    unittest.main()
