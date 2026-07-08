import logging
# APScheduler가 매분 잡 실행 때마다 남기는 INFO 로그를 끈다 (WARNING 이상만 표시).
logging.getLogger("apscheduler.executors.default").setLevel(logging.WARNING)
import datetime
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.models.models import (
    Medication, Senior, Notification, HospitalVisit, Guardian, GuardianSenior, LinkStatus,
    ChatSession,
)
from app.services.fcm_service import send_fcm_push
# 보관 기간(30일)은 장기 기억 조회 로직과 반드시 동일해야 하므로 단일 소스에서 가져온다.
# (long_term_memory.get_recent_memory 가 started_at >= now-RETENTION_DAYS 만 읽으므로,
#  삭제 기준도 같은 값을 써야 "안 읽는 데이터만 지운다"는 정합성이 유지된다.)
from app.services.long_term_memory import RETENTION_DAYS

logger = logging.getLogger(__name__)

# Initialize background scheduler
scheduler = BackgroundScheduler()


def check_medication_alarms():
    """매 분마다 실행되며 해당 시간의 복약 리마인더를 조회하여 전송한다."""
    db: Session = SessionLocal()
    try:
        now = datetime.datetime.now()
        current_date = now.date()

        # 현재 시/분 매칭 복약 조회
        active_meds = db.query(Medication).filter(
            Medication.is_active == True,
            Medication.start_date <= current_date,
            (Medication.end_date == None) | (Medication.end_date >= current_date)
        ).all()

        for med in active_meds:
            if med.intake_time.hour == now.hour and med.intake_time.minute == now.minute:
                senior = db.query(Senior).filter(Senior.senior_id == med.senior_id).first()
                if not senior:
                    continue

                # 알림 설정 정책 필터링 (전체 push_enabled 활성화 여부만 체크)
                if not senior.push_enabled:
                    logger.info(f"Skipping medication push for senior {senior.name} (Disabled in settings)")
                    continue

                title = "[복약 알림] 약 복용 시간입니다."
                body = f"{senior.name}님, 설정해놓은 복약 시간({med.intake_time.strftime('%H:%M')})입니다. '{med.medicine_name}'을(를) 복용해 주세요."
                
                success = False
                if senior.fcm_token:
                    success = send_fcm_push(
                        token=senior.fcm_token,
                        title=title,
                        body=body,
                        data={
                            "notification_type": "MEDICATION",
                            "medication_id": str(med.medication_id)
                        }
                    )
                else:
                    logger.warning(f"Senior {senior.name} ({senior.senior_id}) has no fcm_token. Simulated push notification logged.")
                    success = True

                # Notification 이력 남기기 (보호자용)
                notif = Notification(
                    guardian_id=med.guardian_id,
                    senior_id=med.senior_id,
                    medication_id=med.medication_id,
                    notification_type="MEDICATION",
                    status="SENT" if success else "FAILED",
                    sent_at=datetime.datetime.utcnow()
                )
                db.add(notif)
                db.commit()
                logger.info(f"Medication alarm sent/logged for senior {senior.name} (Medication: {med.medicine_name})")

    except Exception as e:
        logger.error(f"Error in check_medication_alarms: {e}")
        db.rollback()
    finally:
        db.close()


def send_hospital_notification(db: Session, visit: HospitalVisit, alarm_type: str, body_text: str):
    """병원 알림 발송 헬퍼"""
    senior = db.query(Senior).filter(Senior.senior_id == visit.senior_id).first()
    if not senior:
        return

    title = f"[병원 방문 알림] {alarm_type}"

    # 1. 고령자 본인 발송
    if senior.push_enabled:
        if senior.fcm_token:
            send_fcm_push(
                token=senior.fcm_token,
                title=title,
                body=body_text,
                data={
                    "notification_type": "HOSPITAL",
                    "hospital_visit_id": str(visit.visit_id)
                }
            )

    # 2. 연동 보호자 발송 (ACTIVE 멤버)
    active_links = db.query(GuardianSenior).filter(
        GuardianSenior.senior_id == senior.senior_id,
        GuardianSenior.link_status == LinkStatus.ACTIVE.value
    ).all()

    for link in active_links:
        guardian = db.query(Guardian).filter(Guardian.guardian_id == link.guardian_id).first()
        if not guardian:
            continue

        success = False
        if guardian.push_enabled:
            if guardian.fcm_token:
                success = send_fcm_push(
                    token=guardian.fcm_token,
                    title=title,
                    body=body_text,
                    data={
                        "notification_type": "HOSPITAL",
                        "hospital_visit_id": str(visit.visit_id)
                    }
                )
            else:
                success = True

            # 알림 이력 기록
            notif = Notification(
                guardian_id=guardian.guardian_id,
                senior_id=senior.senior_id,
                hospital_visit_id=visit.visit_id,
                notification_type="HOSPITAL",
                status="SENT" if success else "FAILED",
                sent_at=datetime.datetime.utcnow()
            )
            db.add(notif)
    db.commit()


def check_hospital_alarms():
    """매 분마다 병원 알림 조건(12시간 전, 당일 아침 7시)을 체크해 전송한다."""
    db: Session = SessionLocal()
    try:
        now = datetime.datetime.now()
        today = now.date()

        active_visits = db.query(HospitalVisit).filter(
            HospitalVisit.is_active == True,
            HospitalVisit.visit_date >= today
        ).all()

        for visit in active_visits:
            visit_datetime = datetime.datetime.combine(visit.visit_date, visit.visit_time)

            # 1. 12시간 전 알림 체크
            time_12h_ago = visit_datetime - datetime.timedelta(hours=12)
            is_12h_window = time_12h_ago <= now <= (time_12h_ago + datetime.timedelta(minutes=10))

            # 2. 당일 아침 7시 알림 체크
            is_morning_window = (visit.visit_date == today) and (now.hour == 7 and 0 <= now.minute <= 10)

            # 12시간 전 발송 처리
            if is_12h_window:
                sent_12h = db.query(Notification).filter(
                    Notification.hospital_visit_id == visit.visit_id,
                    Notification.notification_type == "HOSPITAL",
                    Notification.sent_at >= visit_datetime - datetime.timedelta(hours=13),
                    Notification.sent_at <= visit_datetime - datetime.timedelta(hours=11)
                ).first()

                if not sent_12h:
                    send_hospital_notification(
                        db,
                        visit,
                        "방문 12시간 전",
                        f"방문 12시간 전입니다. {visit.hospital_name}에 방문할 일정이 있으니 확인해 주세요 ({visit.visit_time.strftime('%H:%M')})."
                    )

            # 당일 아침 7시 발송 처리
            if is_morning_window:
                sent_morning = db.query(Notification).filter(
                    Notification.hospital_visit_id == visit.visit_id,
                    Notification.notification_type == "HOSPITAL",
                    Notification.sent_at >= datetime.datetime.combine(today, datetime.time(6, 0)),
                    Notification.sent_at <= datetime.datetime.combine(today, datetime.time(8, 0))
                ).first()

                if not sent_morning:
                    send_hospital_notification(
                        db,
                        visit,
                        "당일 방문 안내",
                        f"오늘 {visit.hospital_name} 방문 일정이 있습니다. 방문 시간을 확인해 주세요 ({visit.visit_time.strftime('%H:%M')})."
                    )

    except Exception as e:
        logger.error(f"Error in check_hospital_alarms: {e}")
        db.rollback()
    finally:
        db.close()


def cleanup_expired_chat_data():
    """정책2(보관) 이행 — 30일(RETENTION_DAYS) 경과한 챗봇 대화 세션을 자동 삭제한다.

    챗봇 대화는 전부 chat_session(JSONB messages)에 저장된다. 조회 로직
    (long_term_memory.get_recent_memory)이 started_at 기준 30일 이내 세션만 기억으로
    사용하므로, cutoff 이전 세션은 이미 "읽지 않는" 데이터다. 따라서 삭제해도
    챗봇 동작/장기 기억에 영향이 없다.

    [설계 원칙 준수]
    - senior_id FK 미설정(물리 분리 대비) 정책 그대로 유지 — DB cascade 가 아니라
      여기서 애플리케이션 코드로 삭제한다(탈퇴 시 delete_sessions_for_senior 와 동일 방식).
    - VOICE_FEATURE / RISK_PREDICTION 과 JOIN 하지 않는다. 이 잡도 chat_session 만 건드린다.
    - 저장 시각이 UTC(datetime.utcnow)로 기록되므로 cutoff 도 utcnow 로 계산한다.
      (복약/병원 잡의 now() 는 벽시계 알람 매칭용이라 목적이 다르다.)
    """
    db: Session = SessionLocal()
    try:
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=RETENTION_DAYS)

        # 30일 경과 대화 세션 삭제 (bulk delete — delete_sessions_for_senior 와 동일 패턴)
        deleted_sessions = (
            db.query(ChatSession)
            .filter(ChatSession.started_at < cutoff)
            .delete(synchronize_session=False)
        )

        db.commit()
        if deleted_sessions:
            logger.info(
                f"Expired chat sessions cleaned up (cutoff={cutoff.isoformat()}): "
                f"chat_session={deleted_sessions}"
            )
    except Exception as e:
        logger.error(f"Error in cleanup_expired_chat_data: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """배경 스케줄러를 시작하고 작업을 등록한다."""
    # 복약 알림: 매 분마다 체크
    scheduler.add_job(check_medication_alarms, "cron", second=0, id="medication_alarm")
    # 병원 방문 알림: 매 분마다 체크
    scheduler.add_job(check_hospital_alarms, "cron", second=0, id="hospital_alarm")
    # 챗봇 대화 데이터 보관정책(30일) 정리: 매일 새벽 4시 1회 실행 (트래픽 적은 시간대)
    scheduler.add_job(cleanup_expired_chat_data, "cron", hour=4, minute=0, id="chat_data_cleanup")
    scheduler.start()
    logger.info("Background Scheduler started successfully.")


def shutdown_scheduler():
    """배경 스케줄러를 종료한다."""
    scheduler.shutdown()
    logger.info("Background Scheduler shut down.")