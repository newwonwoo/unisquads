import json
import sys
import types
import unittest
from pathlib import Path


class FakeSession:
    pass


class FakeConnectionError(Exception):
    pass


class FakeTimeout(Exception):
    pass


sys.modules.setdefault(
    "requests",
    types.SimpleNamespace(
        Session=FakeSession,
        ConnectionError=FakeConnectionError,
        Timeout=FakeTimeout,
    ),
)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import iros_api as iros  # noqa: E402


def complete_meta(total):
    return iros._collection_meta(
        1000,
        complete=True,
        total_count=total,
        received_count=total,
        raw_received_count=total,
        pages_fetched=1,
        expected_pages=1,
    )


class UnitContractTests(unittest.TestCase):
    def test_python_and_vercel_modules_are_identical(self):
        self.assertEqual(
            (ROOT / "iros_api.py").read_bytes(),
            (ROOT / "api" / "iros_api.py").read_bytes(),
        )
        self.assertEqual(
            (ROOT / "iros_resolver.py").read_bytes(),
            (ROOT / "api" / "iros_resolver.py").read_bytes(),
        )

    def test_shared_unit_vectors(self):
        vectors = json.loads(
            (ROOT / "tests" / "fixtures" / "unit-match-vectors.json").read_text()
        )
        for vector in vectors:
            with self.subTest(vector=vector):
                equal = (
                    iros._unit_key(vector["a"], vector["kind"])
                    == iros._unit_key(vector["b"], vector["kind"])
                )
                self.assertEqual(vector["equal"], equal)

    def test_direct_search_text_preserves_alpha_and_hyphen(self):
        swrd = iros._build_swrd(
            "서울특별시 서초구 서초동 967", dong="A동", ho="0204-01호"
        )
        self.assertIn("A동", swrd)
        self.assertIn("0204-01호", swrd)

    def test_detail_fallback_does_not_treat_legal_dong_as_building_dong(self):
        dong, ho = iros._extract_unit_from_text(
            {"real_indi_cont": "서울특별시 서초구 서초동 967", "detail": "A동 204-1호"}
        )
        self.assertEqual("A", dong)
        self.assertEqual("204-1", ho)

        dong, _ = iros._extract_unit_from_text(
            {"real_indi_cont": "서울특별시 서초구 서초동 967"}
        )
        self.assertEqual("", dong)

    def test_property_class_gate(self):
        candidates = [
            {"gubun": "토지"},
            {"real_cls_cd": "집합건물"},
            {"gubun": "건물"},
        ]
        matched, verified = iros._filter_expected_property_class(
            candidates, "집합건물"
        )
        self.assertTrue(verified)
        self.assertEqual(1, len(matched))


class CollectionSafetyTests(unittest.TestCase):
    def setUp(self):
        self.original_post = iros._post_search
        self.original_collect = iros._collect_search
        self.original_direct = iros._direct_search

    def tearDown(self):
        iros._post_search = self.original_post
        iros._collect_search = self.original_collect
        iros._direct_search = self.original_direct

    def test_full_collection_uses_exact_count(self):
        def post(_session, _payload, _timeout):
            return {
                "dataList": [{"pin_land": "1"}, {"pin_land": "2"}],
                "paginationInfo": {"totalRecordCount": 1},
            }, 200

        iros._post_search = post
        _, _, meta, _ = iros._collect_search("서초구 서초동 967", session=FakeSession())
        self.assertFalse(meta["complete"])
        self.assertEqual(2, meta["received_count"])
        self.assertEqual(1, meta["total_count"])

    def test_normal_pagination_matches_expected_page_count(self):
        calls = []

        def post(_session, payload, _timeout):
            calls.append((payload["pageUnit"], payload["pageIndex"]))
            if payload["pageIndex"] == "":
                rows = [{"pin_land": "1"}, {"pin_land": "2"}]
            else:
                rows = [{"pin_land": "3"}]
            return {
                "dataList": rows,
                "paginationInfo": {"totalRecordCount": 3},
            }, 200

        iros._post_search = post
        _, _, meta, _ = iros._collect_search("서초구 서초동 967", session=FakeSession())
        self.assertEqual([(1000, ""), (1000, "2")], calls)
        self.assertTrue(meta["complete"])
        self.assertEqual(meta["pages_fetched"], meta["expected_pages"])

    def test_unsupported_page_unit_falls_back_in_same_session(self):
        calls = []
        session = FakeSession()

        def post(got_session, payload, _timeout):
            self.assertIs(session, got_session)
            calls.append(payload["pageUnit"])
            if payload["pageUnit"] == 1000:
                return {"dataList": []}, 200
            return {
                "dataList": [{"pin_land": "1"}],
                "paginationInfo": {"totalRecordCount": 1},
            }, 200

        iros._post_search = post
        _, _, meta, _ = iros._collect_search("서초구 서초동 967", session=session)
        self.assertEqual([1000, 500], calls)
        self.assertTrue(meta["complete"])
        self.assertEqual(500, meta["effective_page_unit"])

    def test_large_silently_capped_collection_is_deferred(self):
        calls = []

        def post(_session, payload, _timeout):
            calls.append(payload["pageIndex"])
            return {
                "dataList": [{"pin_land": str(i)} for i in range(10)],
                "paginationInfo": {"totalRecordCount": 2000},
            }, 200

        iros._post_search = post
        _, _, meta, _ = iros._collect_search(
            "서초구 서초동 967", session=FakeSession(), page_unit=10
        )
        self.assertEqual([""], calls)
        self.assertTrue(meta["collection_deferred"])
        self.assertEqual(200, meta["expected_pages"])

    def test_parse_incomplete_never_resolves(self):
        data = {
            "dataList": [
                {
                    "pin_land": "110219961011400000",
                    "real_cls_cd": "집합건물",
                    "buld_no_buld": "101",
                    "buld_no_room": "1001",
                    "lot_no": "967",
                },
                {"real_cls_cd": "집합건물", "lot_no": "967"},
            ],
            "paginationInfo": {"totalRecordCount": 2},
        }

        def collect(*_args, **_kwargs):
            return data, 200, complete_meta(2), FakeSession()

        iros._collect_search = collect
        result = iros.resolve_one_api(
            "서울특별시 서초구 서초동 967",
            dong="101",
            ho="1001",
            strategy="full",
            session=FakeSession(),
        )
        self.assertEqual("REG_PARSE_INCOMPLETE", result.status)
        self.assertEqual(1, result.parse_error_count)

    def test_property_class_mismatch_never_resolves(self):
        data = {
            "dataList": [
                {
                    "pin_land": "110219961011400000",
                    "real_cls_cd": "토지",
                    "buld_no_buld": "101",
                    "buld_no_room": "1001",
                    "lot_no": "967",
                }
            ],
            "paginationInfo": {"totalRecordCount": 1},
        }

        def collect(*_args, **_kwargs):
            return data, 200, complete_meta(1), FakeSession()

        iros._collect_search = collect
        result = iros.resolve_one_api(
            "서울특별시 서초구 서초동 967",
            dong="101",
            ho="1001",
            strategy="full",
            session=FakeSession(),
        )
        self.assertEqual("REG_VALIDATION_FAILED", result.status)

    def test_incomplete_direct_result_falls_back_to_full(self):
        candidate = {
            "unique_no": "1102-1996-101140",
            "gubun": "집합건물",
            "real_cls_cd": "집합건물",
            "state": "현행",
            "sojae": "서울특별시 서초구 서초동 967",
            "lot_no": "967",
            "dong": "A",
            "ho": "204-1",
            "buldnm": "",
        }

        def direct(*_args, **_kwargs):
            meta = iros._collection_meta(
                10, complete=False, total_count=2, received_count=1
            )
            return [candidate], 200, FakeSession(), meta

        def collect(*_args, **_kwargs):
            data = {
                "dataList": [
                    {
                        "pin_land": "110219961011400000",
                        "real_cls_cd": "집합건물",
                        "buld_no_buld": "A",
                        "buld_no_room": "204-1",
                        "lot_no": "967",
                    }
                ],
                "paginationInfo": {"totalRecordCount": 1},
            }
            return data, 200, complete_meta(1), FakeSession()

        iros._direct_search = direct
        iros._collect_search = collect
        result = iros.resolve_one_api(
            "서울특별시 서초구 서초동 967",
            dong="A",
            ho="204-1",
            strategy="auto",
            session=FakeSession(),
        )
        self.assertEqual("RESOLVED", result.status)
        self.assertEqual("FULL_COLLECT", result.strategy)

    def test_candidate_order_and_repeated_runs_do_not_change_result(self):
        records = [
            {
                "pin_land": "110219961011400000",
                "real_cls_cd": "집합건물",
                "buld_no_buld": "A",
                "buld_no_room": "204-1",
                "lot_no": "967",
                "use_cls_cd": "현행",
            },
            {
                "pin_land": "110219961016590000",
                "real_cls_cd": "집합건물",
                "buld_no_buld": "B",
                "buld_no_room": "204-1",
                "lot_no": "967",
                "use_cls_cd": "현행",
            },
        ]

        def run(order):
            data = {
                "dataList": [records[i] for i in order],
                "paginationInfo": {"totalRecordCount": 2},
            }

            def collect(*_args, **_kwargs):
                return data, 200, complete_meta(2), FakeSession()

            iros._collect_search = collect
            result = iros.resolve_one_api(
                "서울특별시 서초구 서초동 967",
                dong="A",
                ho="204-1",
                strategy="full",
                session=FakeSession(),
            )
            return result.status, result.unique_no, result.message

        first = run([0, 1])
        repeated = run([0, 1])
        shuffled = run([1, 0])
        self.assertEqual(first, repeated)
        self.assertEqual(first, shuffled)

    def test_deferred_collection_is_not_reported_as_not_found(self):
        def collect(*_args, **_kwargs):
            meta = iros._collection_meta(
                10,
                total_count=2000,
                received_count=10,
                raw_received_count=10,
                pages_fetched=1,
                expected_pages=200,
                collection_deferred=True,
            )
            data = {
                "dataList": [],
                "paginationInfo": {"totalRecordCount": 2000},
            }
            return data, 200, meta, FakeSession()

        iros._collect_search = collect
        result = iros.resolve_one_api(
            "서울특별시 서초구 서초동 967",
            strategy="full",
            session=FakeSession(),
        )
        self.assertEqual("REG_COLLECTION_DEFERRED", result.status)


if __name__ == "__main__":
    unittest.main()
