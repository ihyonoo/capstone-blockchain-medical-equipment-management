"""SDM 미러 플레이스홀더가 박힌 NDEF 파일을 만들고, 미러 오프셋을 실제 바이트에서 찾아낸다.

오프셋을 상수로 적어두면 URL이나 토큰 길이가 바뀔 때 조용히 어긋나고, 그 사실은
태그를 비가역으로 구운 뒤에야 드러난다. 그래서 항상 만들어진 바이트열에서 찾는다.
"""

UID_PLACEHOLDER_LEN = 14  # 7바이트 UID를 ASCII hex로
CTR_PLACEHOLDER_LEN = 6  # 3바이트 카운터
CMAC_PLACEHOLDER_LEN = 16  # 8바이트 절단 CMAC

# NDEF URI 레코드의 스킴 축약 코드. 스킴은 이 한 바이트가 대신하므로 URL에서 뺀다.
URI_ABBREVIATIONS = {"https://": 0x04, "http://": 0x03}

# NTAG 424 DNA의 NDEF 파일(File 02) 크기.
NDEF_FILE_SIZE = 256


def build_sdm_ndef_file(base_url: str, token: str) -> tuple[bytes, dict[str, int]]:
    """(파일 바이트, 미러 오프셋)을 돌려준다.

    오프셋은 파일 선두(NLEN 2바이트 포함) 기준이다 — 태그가 미러를 채울 때 쓰는 기준과 같다.
    """
    scheme = next((s for s in URI_ABBREVIATIONS if base_url.startswith(s)), None)
    if scheme is None:
        raise ValueError(f"지원하지 않는 스킴이다(https:// 또는 http://): {base_url}")

    rest = base_url[len(scheme) :].rstrip("/")
    query = f"?uid={'0' * UID_PLACEHOLDER_LEN}&ctr={'0' * CTR_PLACEHOLDER_LEN}&cmac={'0' * CMAC_PLACEHOLDER_LEN}"
    payload = bytes([URI_ABBREVIATIONS[scheme]]) + f"{rest}/nfc/{token}{query}".encode()

    record = bytes([0xD1, 0x01, len(payload), 0x55]) + payload
    if len(record) > 0xFF:
        raise ValueError("NDEF 레코드가 짧은 레코드 형식(1바이트 길이)에 담기지 않는다")

    data = len(record).to_bytes(2, "big") + record
    if len(data) > NDEF_FILE_SIZE:
        raise ValueError(f"NDEF 파일 크기({NDEF_FILE_SIZE}바이트)를 넘는다: {len(data)}바이트")

    offsets = {
        "uid": data.index(b"uid=") + 4,
        "ctr": data.index(b"ctr=") + 4,
        "cmac": data.index(b"cmac=") + 5,
    }
    return data, offsets
