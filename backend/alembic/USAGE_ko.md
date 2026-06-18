# 데이터베이스 마이그레이션 (Alembic) 안내

DB 스키마(테이블/컬럼 구조)는 Alembic으로 버전 관리합니다.
더 이상 `main.py`의 `create_all`로 테이블을 만들지 않습니다.

## 사전 준비

`.env`에 실제 PostgreSQL 접속 정보가 있어야 합니다.

```
DATABASE_URL=postgresql://postgres:[비밀번호]@db.[프로젝트].supabase.co:5432/postgres
```

Alembic은 이 `DATABASE_URL`을 읽어 해당 DB에 마이그레이션을 적용합니다.
(접속 정보는 `alembic.ini`에 적지 않고 `.env`에서만 읽습니다.)

## 처음 한 번: 테이블 생성

빈 DB(또는 새 환경)에서 전체 스키마를 만들 때:

```bash
alembic upgrade head
```

이 명령이 13개 테이블을 모두 생성합니다.

> ⚠️ 이미 Supabase에 테이블이 직접 만들어져 있다면, 그 상태를 "초기 버전"으로
> 인식시켜야 충돌이 없습니다. 그 경우 `alembic upgrade head` 대신 아래로 한 번만 표시:
> ```bash
> alembic stamp head
> ```
> (테이블을 다시 만들지 않고 "현재 DB가 최신 버전"이라고 기록만 함)

## 이후: 모델을 바꿀 때마다

1. `app/models/models.py`에서 컬럼/테이블을 추가·수정한다.
2. 변경을 감지해 마이그레이션 파일을 생성한다:
   ```bash
   alembic revision --autogenerate -m "변경 내용 설명"
   ```
3. **생성된 파일을 반드시 눈으로 확인한다** (`alembic/versions/` 안).
   autogenerate가 완벽하지 않으므로, 의도한 변경만 들어갔는지 검토 후 커밋한다.
4. DB에 적용한다:
   ```bash
   alembic upgrade head
   ```

## 되돌리기

```bash
alembic downgrade -1      # 한 단계 뒤로
alembic downgrade base    # 전부 되돌리기 (모든 테이블 삭제)
```

## 자주 쓰는 확인 명령

```bash
alembic current    # 현재 DB가 어느 버전인지
alembic history    # 마이그레이션 이력 전체
```

## 주의사항

- **PostgreSQL에서 실행하세요.** UUID/JSONB는 PostgreSQL 전용 타입이라,
  SQLite 등 다른 DB로 autogenerate를 돌리면 엉뚱한 타입 변경이 잔뜩 잡힙니다(노이즈).
  실제 작업은 항상 Supabase(PostgreSQL) 기준으로 합니다.
- autogenerate가 만든 파일에 `Text` 등 import가 빠지는 경우가 있으니,
  생성 직후 파일 상단 import를 확인하세요.
- 마이그레이션 파일(`alembic/versions/`)은 **git에 커밋**합니다. 팀원이 같은 DB 구조를
  공유하는 핵심이 이 파일들입니다.
