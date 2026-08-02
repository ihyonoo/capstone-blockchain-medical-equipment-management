import pytest
from fastapi import HTTPException

from backend.rtls_utils import normalize_nfc_token


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
