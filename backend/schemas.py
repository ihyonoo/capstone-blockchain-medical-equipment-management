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
    email: str
    position: str | None = None
    role: str = "staff"
    department: str | None = None
    is_active: bool = True


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: str


class FindIdRequest(BaseModel):
    email: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class SessionExchangeRequest(BaseModel):
    code: str


class GoogleCompleteRequest(BaseModel):
    pending_token: str
    username: str
    display_name: str | None = None
    role: str = "staff"
    department: str | None = None
    position: str | None = None
    password: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ChangeEmailRequest(BaseModel):
    new_email: str
    current_password: str


class WithdrawRequest(BaseModel):
    current_password: str


class NfcMappingUpsertRequest(BaseModel):
    tag_id: str
    nfc_token: str


class NfcUsageActionRequest(BaseModel):
    nfc_token: str
