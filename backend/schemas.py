from typing import List

from pydantic import BaseModel


class Observation(BaseModel):
    tag_id: str
    rssi: int
    count: int
    last_seen: int


class Payload(BaseModel):
    reader_id: str
    ts: int
    observations: List[Observation]


class LoginRequest(BaseModel):
    username: str
    password: str
    role: str


class RegisterRequest(BaseModel):
    username: str
    display_name: str
    password: str
    position: str | None = None
    role: str = "staff"
    department: str | None = None
    is_active: bool = True


class NfcMappingUpsertRequest(BaseModel):
    tag_id: str
    nfc_token: str


class NfcUsageActionRequest(BaseModel):
    nfc_token: str
