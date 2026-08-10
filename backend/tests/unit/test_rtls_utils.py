import pytest
from fastapi import HTTPException

from backend.rtls_utils import load_readers_with_status, normalize_nfc_token


class TestNormalizeNfcToken:
    def test_trims_whitespace(self):
        assert normalize_nfc_token("  ABC123  ") == "ABC123"

    def test_rejects_empty(self):
        with pytest.raises(HTTPException) as exc:
            normalize_nfc_token("   ")
        assert exc.value.status_code == 400

    @pytest.mark.parametrize("bad_token", ["a b", "a/b", "a?b", "a#b", "a\tb"])
    def test_rejects_forbidden_characters(self, bad_token):
        with pytest.raises(HTTPException) as exc:
            normalize_nfc_token(bad_token)
        assert exc.value.status_code == 400


class TestLoadReadersWithStatus:
    def test_raises_instead_of_returning_empty_when_the_query_fails(self, monkeypatch):
        # 예전엔 DB 오류를 삼키고 []를 돌려줘, 프론트에 "배치된 구역이 없습니다"라는
        # 정상 메시지로 둔갑했다(실제로 map_x/map_y 컬럼 드롭 후 이 증상이 났다).
        def boom(*args, **kwargs):
            raise RuntimeError('column "map_x" does not exist')

        monkeypatch.setattr("backend.rtls_utils.psycopg.connect", boom)

        with pytest.raises(HTTPException) as exc:
            load_readers_with_status(0, 10)
        assert exc.value.status_code == 500
