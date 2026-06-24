import pytest
import datetime
from unittest.mock import MagicMock
from uuid import uuid4

from app.models.models import RiskPrediction
from app.services.risk_trigger import (
    _LEVEL_RANK,
    check_amber_accumulation,
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


def test_fcm_fallback():
    """Test send_fcm_push falls back to Mock Send Mode gracefully when credentials are not configured."""
    # Since credentials won't be set up in the test runner, it should log and return True.
    result = send_fcm_push(
        token="test_fcm_token",
        title="Test Notification Title",
        body="Test Notification Body Message"
    )
    assert result is True
