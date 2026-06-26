import os
import json
import logging
import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)

# Firebase Admin App initialization status
_firebase_initialized = False

def initialize_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return True

    # 1. Try to load credentials from environment variable JSON
    cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    if cred_json:
        try:
            cred_dict = json.loads(cred_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info("Firebase Admin SDK initialized successfully via FIREBASE_CREDENTIALS_JSON.")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Firebase with FIREBASE_CREDENTIALS_JSON: {e}")

    # 2. Try to load credentials from file path
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-adminsdk.json")
    if os.path.exists(cred_path):
        try:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info(f"Firebase Admin SDK initialized successfully via path: {cred_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Firebase via path {cred_path}: {e}")

    # 3. Fallback to default credentials (only if explicitly enabled)
    if os.getenv("FIREBASE_USE_DEFAULT") == "true":
        try:
            firebase_admin.initialize_app()
            _firebase_initialized = True
            logger.info("Firebase Admin SDK initialized successfully via Default Credentials.")
            return True
        except Exception as e:
            logger.warning(
                f"Firebase Admin SDK could not be initialized via Default Credentials: {e}"
            )
    
    return False


def send_fcm_push(token: str, title: str, body: str, data: dict = None) -> bool:
    """
    Sends a push notification to a specific FCM token.
    If Firebase is not initialized, it prints to log (Mock mode) and returns True.
    """
    if not token:
        logger.warning("FCM push skipped: No token provided.")
        return False

    # Ensure Firebase is initialized
    initialized = initialize_firebase()

    if not initialized:
        # Mock Mode
        logger.info(
            f"[FCM MOCK PUSH] Sent successfully!\n"
            f"  - Token: {token}\n"
            f"  - Title: {title}\n"
            f"  - Body:  {body}\n"
            f"  - Data:  {data}"
        )
        return True

    try:
        # Construct message payload
        msg_data = {k: str(v) for k, v in (data or {}).items()}
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=msg_data,
            token=token,
        )
        # Send a message to the device corresponding to the provided registration token.
        response = messaging.send(message)
        logger.info(f"Successfully sent FCM message: {response}")
        return True
    except Exception as e:
        logger.error(f"Failed to send FCM push notification: {e}")
        return False
