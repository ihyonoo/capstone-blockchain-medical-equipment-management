# server.py

from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict
import time

app = FastAPI()     # FastAPI 애플리케이션 인스턴스 생성


# reader_id -> location string
# 출력해주기 위하여 Reader_ID를 정확한 구역의 이름으로 mapping
READER_LOCATION = {
    "M501": "M501호",
    "M502": "M502호",
}

# 서버 메모리 상태 저장소
tag_obs: Dict[str, Dict[str, dict]] = {}    # 태그별로, 리더별 관측값을 저장하는 딕셔너리 / tag_id -> reader_id -> observation
tag_state: Dict[str, dict] = {}             # 태그별로 위치 결정 상태를 저장하는 딕셔너리 / tag_id -> 결정된 현재 위치 상태

# 튐 방지 파라미터
HYST_DB = 8          # dB 이상 차이날 때만 변경
DWELL_SEC = 2        # 2초 연속이면 변경 확정
STALE_SEC = 5        # 5초 이상 안 들어온 reader 데이터는 무시

############# 요청 스키마 정리 ###########
class Observation(BaseModel):
    tag_id: str
    rssi: int
    count: int
    last_seen: int

class Payload(BaseModel):
    reader_id: str
    ts: int
    observations: List[Observation]
#######################################3

# 특정 태그에 대해, 현재 시각 가장 강한 RSSI를 가진 리더를 탐색
def pick_best_reader(tag_id: str, now: int):
    readers = tag_obs.get(tag_id, {})   # 해당 태그의 리더별 관측 딕셔너리

    candidates = []                     # 유효한 후보들만 모을 리스트

    for rid, ob in readers.items():
        if now - ob["recv_ts"] <= STALE_SEC:  # 관측이 너무 오래되지는 않았는지 검증
            candidates.append((rid, ob["rssi"], ob["recv_ts"]))   # 튜플로 리스트에 추가
   
    # 유효한 후보가 없으면 결정 불가능
    if not candidates:
        return None
    
    # RSSI가 큰 순으로 정렬
    candidates.sort(key=lambda x: x[1], reverse=True)

    # 가장 강한 리더기를 반환
    return candidates[0]  # 반환 형태: 튜플(reader_id, rssi, last_seen)

# 수집 엔드포인트
@app.post("/ingest")        # POST /ingest 라우트
def ingest(payload: Payload):
    now = int(time.time())      # 현재 시간
    rid = payload.reader_id     # reader_id 추출

    last_tag_id = None
    last_best = None

    for ob in payload.observations:
        tag_id = ob.tag_id
        last_tag_id = tag_id

        tag_obs.setdefault(tag_id, {})
        tag_obs[tag_id][rid] = {
            "rssi": ob.rssi,
            "count": ob.count,
            "last_seen": ob.last_seen,  # 기록용
            "recv_ts": now,             # 서버 수신 시각
        }

        best = pick_best_reader(tag_id, now)
        last_best = best

        if best is None:
            continue

        best_rid, best_rssi, _ = best

        state = tag_state.setdefault(tag_id, {
            "current_reader": None,
            "current_rssi": None,
            "candidate_reader": None,
            "candidate_since": None,
            "updated_at": None,
        })

        cur = state["current_reader"]

        # 최초 결정
        if cur is None:
            state["current_reader"] = best_rid
            state["current_rssi"] = best_rssi
            state["updated_at"] = now
            state["candidate_reader"] = None
            state["candidate_since"] = None
            continue

        # 현재 리더 RSSI 가져오기(없으면 매우 약하다고 간주)
        cur_ob = tag_obs[tag_id].get(cur)
        cur_rssi = cur_ob["rssi"] if cur_ob and (now - cur_ob["recv_ts"] <= STALE_SEC) else -999

        # 후보가 현재와 같으면 후보 초기화 + 현재 업데이트
        if best_rid == cur:
            state["current_rssi"] = best_rssi
            state["candidate_reader"] = None
            state["candidate_since"] = None
            state["updated_at"] = now
            continue

        # 히스테리시스: 후보가 현재보다 충분히 강해야 변경
        if best_rssi - cur_rssi < HYST_DB:
            state["candidate_reader"] = None
            state["candidate_since"] = None
            state["current_rssi"] = cur_rssi
            state["updated_at"] = now
            continue

        # 지속시간: 후보가 일정 시간 유지돼야 변경
        if state["candidate_reader"] != best_rid:
            state["candidate_reader"] = best_rid
            state["candidate_since"] = now
        else:
            if state["candidate_since"] and (now - state["candidate_since"] >= DWELL_SEC):
                state["current_reader"] = best_rid
                state["current_rssi"] = best_rssi
                state["updated_at"] = now
                state["candidate_reader"] = None
                state["candidate_since"] = None

    # 디버그 출력
    if last_tag_id is not None:
        print(f"[tag ID]\n{last_tag_id}")
        print("\n[readers]")

        readers = tag_obs.get(last_tag_id, {})
        for rid, ob in readers.items():
            print(
                f"{rid}: "
                f"rssi = {ob['rssi']} "
                #f"count={ob['count']}, "
                #f"last_seen={ob['last_seen']}"
            )

        print("\n[best]\n", last_best[0],": ", last_best[1])

    return {"ok": True}


# 결과
@app.get("/where/{tag_id}")
def where(tag_id: str):
    
    # 상태가없거나 current_reader가 없으면 응답을 다음과 같이.
    s = tag_state.get(tag_id)
    if not s or not s["current_reader"]:
        return {"ok": False, "reason": "unknown"}
    
    # 현재 확정된 Reader ID
    rid = s["current_reader"]

    # 결과 반환
    return {
        "ok": True,
        "tag_id": tag_id,
        "reader_id": rid,
        "location": READER_LOCATION.get(rid, rid),
        "rssi": s["current_rssi"],
        #"updated_at": s["updated_at"],
    }