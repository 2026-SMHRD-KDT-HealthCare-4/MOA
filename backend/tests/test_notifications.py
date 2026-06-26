import pytest
import datetime
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.models.models import RiskPrediction
from app.services.risk_trigger import (
    _LEVEL_RANK,
    check_amber_accumulation,
    check_yellow_accumulation,
    check_amber,
    evaluate_risk_trigger
)
from app.services.fcm_service import send_fcm_push

# Mock RiskPrediction rows
def create_mock_prediction(senior_id, date, level):
    pred = MagicMock(spec=RiskPrediction)
    pred.senior_id = senior_id
    pred.parkinson_level = level
    pred.dementia_level = "GREEN"
    pred.depression_level = "GREEN"
    pred.diabetes_level = "GREEN"
    
    # We mock created_at to be a datetime on that date
    pred.created_at = datetime.datetime.combine(date, datetime.time(10, 0))
    return pred


def test_amber_accumulation_consecutive():
    """Test AMBER triggers after 3 consecutive days."""
    db_mock = MagicMock()
    senior_id = uuid4()
    today = datetime.date(2026, 6, 24)
    
    # 3 consecutive days: today (AMBER), today-1 (AMBER), today-2 (AMBER)
    predictions = [
        create_mock_prediction(senior_id, today, "AMBER"),
        create_mock_prediction(senior_id, today - datetime.timedelta(days=1), "AMBER"),
        create_mock_prediction(senior_id, today - datetime.timedelta(days=2), "AMBER"),
    ]
    
    db_mock.query.return_value.filter.return_value.all.return_value = predictions
    
    assert check_amber_accumulation(db_mock, senior_id, today=today) is True


def test_amber_accumulation_not_consecutive_less():
    """Test AMBER does not trigger with only 2 consecutive days."""
    db_mock = MagicMock()
    senior_id = uuid4()
    today = datetime.date(2026, 6, 24)
    
    # 2 consecutive days: today (AMBER), today-1 (AMBER)
    predictions = [
        create_mock_prediction(senior_id, today, "AMBER"),
        create_mock_prediction(senior_id, today - datetime.timedelta(days=1), "AMBER"),
        create_mock_prediction(senior_id, today - datetime.timedelta(days=3), "AMBER"), # gap day today-2
    ]
    
    db_mock.query.return_value.filter.return_value.all.return_value = predictions
    
    # Total count = 3 out of 7 days, and max streak = 2 days -> Should be False
    assert check_amber_accumulation(db_mock, senior_id, today=today) is False


def test_amber_accumulation_total_window():
    """Test AMBER triggers with 4 separate days out of 7 days."""
    db_mock = MagicMock()
    senior_id = uuid4()
    today = datetime.date(2026, 6, 24)
    
    # 4 days of AMBER in 7 days: today, today-2, today-4, today-6
    predictions = [
        create_mock_prediction(senior_id, today, "AMBER"),
        create_mock_prediction(senior_id, today - datetime.timedelta(days=2), "AMBER"),
        create_mock_prediction(senior_id, today - datetime.timedelta(days=4), "AMBER"),
        create_mock_prediction(senior_id, today - datetime.timedelta(days=6), "AMBER"),
    ]
    
    db_mock.query.return_value.filter.return_value.all.return_value = predictions
    
    assert check_amber_accumulation(db_mock, senior_id, today=today) is True


def test_yellow_accumulation_consecutive():
    """Test YELLOW triggers after 3 consecutive days."""
    db_mock = MagicMock()
    senior_id = uuid4()
    today = datetime.date(2026, 6, 24)
    
    predictions = [
        create_mock_prediction(senior_id, today, "YELLOW"),
        create_mock_prediction(senior_id, today - datetime.timedelta(days=1), "YELLOW"),
        create_mock_prediction(senior_id, today - datetime.timedelta(days=2), "YELLOW"),
    ]
    
    db_mock.query.return_value.filter.return_value.all.return_value = predictions
    
    assert check_yellow_accumulation(db_mock, senior_id, today=today) is True


def test_evaluate_risk_trigger_amber_accumulation():
    """Test evaluate_risk_trigger returns AMBER_ACCUMULATION when applicable."""
    db_mock = MagicMock()
    senior_id = uuid4()
    pred_mock = create_mock_prediction(senior_id, datetime.date(2026, 6, 24), "GREEN")
    
    # Mock check_amber_accumulation to return True
    with patch("app.services.risk_trigger.check_amber_accumulation", return_value=True):
        res = evaluate_risk_trigger(db_mock, senior_id, pred_mock)
        assert res == {"should_notify": True, "reason": "AMBER_ACCUMULATION"}


def test_evaluate_risk_trigger_amber_single():
    """Test evaluate_risk_trigger returns AMBER when a single prediction is AMBER."""
    db_mock = MagicMock()
    senior_id = uuid4()
    pred_mock = create_mock_prediction(senior_id, datetime.date(2026, 6, 24), "AMBER")
    
    with patch("app.services.risk_trigger.check_amber_accumulation", return_value=False), \
         patch("app.services.risk_trigger.check_yellow_accumulation", return_value=False):
        res = evaluate_risk_trigger(db_mock, senior_id, pred_mock)
        assert res == {"should_notify": True, "reason": "AMBER"}


@patch("app.services.fcm_service.initialize_firebase")
def test_fcm_fallback(mock_init):
    """Test send_fcm_push falls back to Mock Send Mode gracefully when credentials are not configured."""
    mock_init.return_value = False
    result = send_fcm_push(
        token="test_fcm_token",
        title="Test Notification Title",
        body="Test Notification Body Message"
    )
    assert result is True


@patch("app.services.fcm_service.initialize_firebase")
@patch("app.services.fcm_service.messaging.send")
def test_fcm_success(mock_send, mock_init):
    """Test send_fcm_push returns True when Firebase successfully sends push."""
    mock_init.return_value = True
    mock_send.return_value = "mock_message_id"
    result = send_fcm_push(
        token="test_fcm_token",
        title="Test Notification Title",
        body="Test Notification Body Message"
    )
    assert result is True
    mock_send.assert_called_once()
