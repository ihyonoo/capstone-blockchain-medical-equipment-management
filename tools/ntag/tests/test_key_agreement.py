"""개인화 도구와 서버가 같은 태그 키를 만들어야 한다.

두 쪽이 한 바이트라도 어긋나면 태그는 물리적으로 멀쩡한 채 영원히 인증에 실패한다.
키 회전이 비가역이라 되돌릴 방법도 없다. 그래서 파생 로직을 복제하지 않고 공유한다.
"""

from backend.ntag424 import derive_tag_key as backend_derive
from tools.ntag.personalise import derive_key_for


class TestKeyAgreement:
    def test_the_tool_and_the_backend_derive_the_same_key(self):
        master = bytes(range(16))
        uid_hex = "04B07F1A8F1E90"

        assert derive_key_for(master, uid_hex) == backend_derive(master, bytes.fromhex(uid_hex))

    def test_the_uid_is_read_case_insensitively(self):
        master = bytes(range(16))
        assert derive_key_for(master, "04b07f1a8f1e90") == derive_key_for(master, "04B07F1A8F1E90")

    def test_different_tags_get_different_keys(self):
        master = bytes(range(16))
        assert derive_key_for(master, "04B07F1A8F1E90") != derive_key_for(master, "04DE5F1EACC040")
