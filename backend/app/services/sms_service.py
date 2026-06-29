import os
import httpx
import logging

logger = logging.getLogger("moa.sms_service")

SMS_API_URL = os.getenv("SMS_API_URL", "https://api.sens.ncloud.com/v2/services") # 예시: Naver SENS 또는 비즈톡
SMS_API_KEY = os.getenv("SMS_PROVIDER_API_KEY")

def send_sms_fallback(phone_number: str, message: str) -> bool:
    """FCM 푸시 알림 실패 시 가동되는 카카오 알림톡 / SMS Multi-Channel Fallover 릴레이 발송기.

    SMS_PROVIDER_API_KEY 환경변수가 존재하면 실제 외부 REST API를 호출하고,
    그렇지 않은 개발/데모 상태에서는 로그로 발송 흐름을 완전 검증(Mocking)합니다.
    """
    if not phone_number:
        logger.warning("⚠️ [SMS Fallback] 전화번호가 유효하지 않아 발송을 스킵합니다.")
        return False

    cleaned_phone = phone_number.strip().replace("-", "")

    # API KEY가 제공된 경우 실제 외부 망 릴레이 호출
    if SMS_API_KEY:
        try:
            logger.info(f"🚀 [SMS Fallback] 외부 SMS 게이트웨이로 릴레이 발송 시도: {cleaned_phone}")
            # 실제 연동 시 HTTP 요청 구성
            payload = {
                "type": "SMS",
                "contentType": "COMM",
                "countryCode": "82",
                "from": os.getenv("SMS_SENDER_NUMBER", "01000000000"),
                "content": message,
                "messages": [{"to": cleaned_phone}]
            }
            headers = {
                "Content-Type": "application/json",
                "X-SMS-API-KEY": SMS_API_KEY
            }
            res = httpx.post(SMS_API_URL, json=payload, headers=headers, timeout=5.0)
            if res.status_code in (200, 202):
                logger.info(f"✅ [SMS Fallback] 릴레이 전송 완료! (To: {cleaned_phone})")
                return True
            else:
                logger.error(f"❌ [SMS Fallback] 게이트웨이 응답 실패 ({res.status_code}): {res.text}")
                return False
        except Exception as e:
            logger.error(f"❌ [SMS Fallback] 네트워크 릴레이 예외 발생: {e}")
            return False
    else:
        # 데모 및 로컬 개발용 가상 로그 출력 (Multi-Channel Fallover 로직 동작 보장)
        print("\n" + "="*60)
        print("📣 [MULTI-CHANNEL FALLOVER] 카카오 알림톡/SMS 릴레이 발송 시뮬레이션")
        print(f"📱 수신 번호: {cleaned_phone}")
        print(f"💬 전송 문구: {message}")
        print("💡 상태: FCM 푸시 알림 도달 실패에 따른 보조 채널 릴레이 전송 완료 (Mock)")
        print("="*60 + "\n")
        logger.info(f"✅ [SMS Fallback] Mock 전송 완료 (To: {cleaned_phone})")
        return True
