import logging
# APScheduler가 매분 잡 실행 때마다 남기는 INFO 로그를 끈다 (WARNING 이상만 표시).
logging.getLogger("apscheduler.executors.default").setLevel(logging.WARNING)
import datetime
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.models.models import Medication, Senior, Notification, HospitalVisit, Guardian, GuardianSenior, LinkStatus
from app.services.fcm_service import send_fcm_push

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
    """매 분마다 병원 알림 조건(방문 3일 전·1일 전·당일)을 체크해 아침 7시에 전송한다.

    세 알림 모두 해당 날짜 아침 7:00 에 발송한다(당일 아침 7시 포함). 스케줄러는 매 분
    돌지만 07:00~07:10 창에서만 처리하고, 같은 날 같은 방문에 중복 발송하지 않는다.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.datetime.now()
        today = now.date()

        # 아침 7:00~7:10 창에서만 발송(그 외 시간엔 아무것도 안 함).
        if not (now.hour == 7 and 0 <= now.minute <= 10):
            return

        active_visits = db.query(HospitalVisit).filter(
            HospitalVisit.is_active == True,
            HospitalVisit.visit_date >= today
        ).all()

        for visit in active_visits:
            days_left = (visit.visit_date - today).days
            visit_hm = visit.visit_time.strftime('%H:%M')

            if days_left == 3:
                label = "방문 3일 전"
                body = f"{visit.hospital_name} 방문이 3일 남았어요. 일정을 확인해 주세요 ({visit_hm})."
            elif days_left == 1:
                label = "방문 1일 전"
                body = f"{visit.hospital_name} 방문이 내일이에요. 일정을 확인해 주세요 ({visit_hm})."
            elif days_left == 0:
                label = "당일 방문 안내"
                body = f"오늘 {visit.hospital_name} 방문 일정이 있어요. 방문 시간을 확인해 주세요 ({visit_hm})."
            else:
                continue

            # 오늘 이 방문에 대해 이미 HOSPITAL 알림이 나갔으면 중복 방지(하루 1건).
            already_sent = db.query(Notification).filter(
                Notification.hospital_visit_id == visit.visit_id,
                Notification.notification_type == "HOSPITAL",
                Notification.sent_at >= datetime.datetime.combine(today, datetime.time(0, 0)),
            ).first()

            if not already_sent:
                send_hospital_notification(db, visit, label, body)

    except Exception as e:
        logger.error(f"Error in check_hospital_alarms: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """배경 스케줄러를 시작하고 작업을 등록한다."""
    # 복약 알림: 매 분마다 체크
    scheduler.add_job(check_medication_alarms, "cron", second=0, id="medication_alarm")
    # 병원 방문 알림: 매 분마다 체크
    scheduler.add_job(check_hospital_alarms, "cron", second=0, id="hospital_alarm")
    scheduler.start()
    logger.info("Background Scheduler started successfully.")


def shutdown_scheduler():
    """배경 스케줄러를 종료한다."""
    scheduler.shutdown()
    logger.info("Background Scheduler shut down.")
