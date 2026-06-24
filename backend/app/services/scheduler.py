import logging
import datetime
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.models.models import Medication, HospitalVisit, Senior, Notification
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
        # SQLite와 PostgreSQL 간의 호환성을 위해 우선 전체 활성 일정을 받아와 시/분 비교를 수행합니다.
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

                # Notification 이력 남기기
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


def check_tomorrow_hospital_visits():
    """매일 12:00 PM(정오)에 실행되며 내일 예정된 병원 방문 리마인더를 전송한다."""
    db: Session = SessionLocal()
    try:
        tomorrow = datetime.date.today() + datetime.timedelta(days=1)
        
        visits = db.query(HospitalVisit).filter(
            HospitalVisit.is_active == True,
            HospitalVisit.visit_datetime >= datetime.datetime.combine(tomorrow, datetime.time.min),
            HospitalVisit.visit_datetime <= datetime.datetime.combine(tomorrow, datetime.time.max)
        ).all()

        for visit in visits:
            senior = db.query(Senior).filter(Senior.senior_id == visit.senior_id).first()
            if not senior:
                continue

            time_str = visit.visit_datetime.strftime("%H:%M")
            title = "[병원 방문 알림] 내일 병원 방문 일정이 있습니다."
            body = f"{senior.name}님, 내일 {time_str}에 '{visit.hospital_name}' 방문이 예정되어 있습니다. 잊지 말고 방문해 주세요."

            success = False
            if senior.fcm_token:
                success = send_fcm_push(
                    token=senior.fcm_token,
                    title=title,
                    body=body,
                    data={
                        "notification_type": "HOSPITAL",
                        "visit_id": str(visit.visit_id)
                    }
                )
            else:
                logger.warning(f"Senior {senior.name} has no fcm_token for hospital reminder. Simulated push logged.")
                success = True

            notif = Notification(
                guardian_id=visit.guardian_id,
                senior_id=visit.senior_id,
                visit_id=visit.visit_id,
                notification_type="HOSPITAL",
                status="SENT" if success else "FAILED",
                sent_at=datetime.datetime.utcnow()
            )
            db.add(notif)
            db.commit()
            logger.info(f"Tomorrow hospital alarm sent/logged for senior {senior.name} (Hospital: {visit.hospital_name})")

    except Exception as e:
        logger.error(f"Error in check_tomorrow_hospital_visits: {e}")
        db.rollback()
    finally:
        db.close()


def check_today_hospital_visits():
    """매일 07:00 AM에 실행되며 오늘 예정된 병원 방문 리마인더를 전송한다."""
    db: Session = SessionLocal()
    try:
        today = datetime.date.today()
        
        visits = db.query(HospitalVisit).filter(
            HospitalVisit.is_active == True,
            HospitalVisit.visit_datetime >= datetime.datetime.combine(today, datetime.time.min),
            HospitalVisit.visit_datetime <= datetime.datetime.combine(today, datetime.time.max)
        ).all()

        for visit in visits:
            senior = db.query(Senior).filter(Senior.senior_id == visit.senior_id).first()
            if not senior:
                continue

            time_str = visit.visit_datetime.strftime("%H:%M")
            title = "[병원 방문 알림] 오늘 병원 방문 일정이 있습니다."
            body = f"{senior.name}님, 오늘 {time_str}에 '{visit.hospital_name}' 방문이 예정되어 있습니다. 시간 맞춰 안전히 방문해 주세요."

            success = False
            if senior.fcm_token:
                success = send_fcm_push(
                    token=senior.fcm_token,
                    title=title,
                    body=body,
                    data={
                        "notification_type": "HOSPITAL",
                        "visit_id": str(visit.visit_id)
                    }
                )
            else:
                logger.warning(f"Senior {senior.name} has no fcm_token for hospital reminder. Simulated push logged.")
                success = True

            notif = Notification(
                guardian_id=visit.guardian_id,
                senior_id=visit.senior_id,
                visit_id=visit.visit_id,
                notification_type="HOSPITAL",
                status="SENT" if success else "FAILED",
                sent_at=datetime.datetime.utcnow()
            )
            db.add(notif)
            db.commit()
            logger.info(f"Today hospital alarm sent/logged for senior {senior.name} (Hospital: {visit.hospital_name})")

    except Exception as e:
        logger.error(f"Error in check_today_hospital_visits: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """배경 스케줄러를 시작하고 작업을 등록한다."""
    # 복약 알림: 매 분마다 체크
    scheduler.add_job(check_medication_alarms, "cron", second=0, id="medication_alarm")
    
    # 병원 방문 알림: 매일 12:00 PM (내일 일정 전송)
    scheduler.add_job(check_tomorrow_hospital_visits, "cron", hour=12, minute=0, id="hospital_alarm_tomorrow")
    
    # 병원 방문 알림: 매일 07:00 AM (오늘 일정 전송)
    scheduler.add_job(check_today_hospital_visits, "cron", hour=7, minute=0, id="hospital_alarm_today")
    
    scheduler.start()
    logger.info("Background Scheduler started successfully.")


def shutdown_scheduler():
    """배경 스케줄러를 종료한다."""
    scheduler.shutdown()
    logger.info("Background Scheduler shut down.")
