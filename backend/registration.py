# registration.py

import os
from contextlib import contextmanager

import psycopg
from fastapi import FastAPI, HTTPException
from passlib.context import CryptContext
from pydantic import BaseModel
import traceback

DATABASE_URL = "postgresql://postgres:9124@localhost:5432/rtls"             # Database URL

app = FastAPI(title="Register API (readers/tags/users)")                    # FastAPI 애플리케이션 인스턴스 생성
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")                   # password Hash를 만들기 위한 설정


# Database Connection Function
@contextmanager
def get_conn():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL Error")    # raise: error interrupt
    with psycopg.connect(DATABASE_URL) as conn:     # A as B: A를 B라는 이름으로 쓰겠다. with: 이 블록 안에서만 쓰고 끝나면 close
        yield conn                                  # yield: 제너레이터 기능, corn을 쓰는 동안만 열어 둘 수 있음


# ---------- 요청 바디 모델----------
class ReaderCreate(BaseModel):
    reader_id: str
    location_name: str
    is_active: bool = True


class TagCreate(BaseModel):
    tag_id: str
    equipment_name: str
    equipment_type: str
    serial_number: str | None = None
    is_active: bool = True


class UserCreate(BaseModel):
    username: str
    display_name: str
    role: str  # admin / staff
    department: str | None = None
    password: str
    is_active: bool = True



# 리더기 등록
@app.post("/readers")
def create_reader(body: ReaderCreate):
    sql = """
    INSERT INTO readers (reader_id, location_name, is_active, created_at)
    VALUES (%s, %s, %s, now())
    """
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(sql, (body.reader_id, body.location_name, body.is_active))  # 실제 Query에 인자값 넣어서 실행
        return {"ok": True, "reader_id": body.reader_id}                            # JSON으로 성공 여부와 등록된 Reader ID 반환
    # 예외처리
    except psycopg.errors.UniqueViolation:  # 만약 중복되는 리더기를 등록한다면
        raise HTTPException(409, "이미 존재하는 reader_id")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))
    

# 등록된 리더기 조회
@app.get("/readers")
def list_readers():
    sql = """
    SELECT reader_id, location_name, is_active, created_at
    FROM readers
    ORDER BY reader_id
    """

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()   # SELECT 결과를 rows 변수에 담음

    # 결과 반환
    return [
        {
            "reader_id": r[0],
            "location_name": r[1],
            "is_active": r[2],
            "created_at": r[3],
        }
        for r in rows
    ]



# 태그(장비) 등록
@app.post("/tags")
def create_tag(body: TagCreate):
    sql = """
    INSERT INTO tags (tag_id, equipment_name, equipment_type, serial_number, is_active, created_at)
    VALUES (%s, %s, %s, %s, %s, now())
    """
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                sql,
                (body.tag_id, body.equipment_name, body.equipment_type, body.serial_number, body.is_active),
            )
        return {"ok": True, "tag_id": body.tag_id}
    
    # 예외 처리
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "이미 존재하는 tag_id 또는 serial_number")
    except Exception as e:
        raise HTTPException(500, str(e))
    

# 등록된 태그(장비) 조회    
@app.get("/tags")
def list_tags(q: str | None = None):    # 예시: /tags?q=pump 일수도 있고 /tags 일수도 있음
    if q:   # q가 있다면 특정 장비 검색
        sql = """
        SELECT tag_id, equipment_name, equipment_type, serial_number, is_active, created_at
        FROM tags
        WHERE equipment_name ILIKE %s OR tag_id ILIKE %s
        ORDER BY created_at DESC
        LIMIT 100
        """
        params = (f"%{q}%", f"%{q}%")

    else:   # q가 없다면 전체 검색
        sql = """
        SELECT tag_id, equipment_name, equipment_type, serial_number, is_active, created_at
        FROM tags
        ORDER BY created_at DESC
        LIMIT 100
        """
        params = ()


    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    return [
        {
            "tag_id": r[0],
            "equipment_name": r[1],
            "equipment_type": r[2],
            "serial_number": r[3],
            "is_active": r[4],
            "created_at": r[5],
        }
        for r in rows
    ]



# # 유저 등록
# @app.post("/users")
# def create_user(body: UserCreate):
#     if body.role not in ("admin", "staff"):
#         raise HTTPException(400, "role은 admin 또는 staff")

#     password_hash = pwd.hash(body.password)

#     sql = """
#     INSERT INTO users (username, display_name, role, department, password_hash, is_active, created_at)
#     VALUES (%s, %s, %s, %s, %s, %s, now())
#     """
#     try:
#         with get_conn() as conn, conn.cursor() as cur:
#             cur.execute(
#                 sql,
#                 (body.username, body.display_name, body.role, body.department, password_hash, body.is_active),
#             )
#         return {"ok": True, "username": body.username}
#     except psycopg.errors.UniqueViolation:
#         raise HTTPException(409, "이미 존재하는 username")
#     except Exception as e:
#         raise HTTPException(500, str(e))
    
# # 등록된 유저 조회
# @app.get("/users")
# def list_users():
#     sql = """
#     SELECT user_id, username, display_name, role, department, is_active, created_at
#     FROM users
#     ORDER BY user_id DESC
#     LIMIT 100
#     """
#     with get_conn() as conn, conn.cursor() as cur:
#         cur.execute(sql)
#         rows = cur.fetchall()

#     return [
#         {
#             "user_id": r[0],
#             "username": r[1],
#             "display_name": r[2],
#             "role": r[3],
#             "department": r[4],
#             "is_active": r[5],
#             "created_at": r[6],
#         }
#         for r in rows
#     ]
