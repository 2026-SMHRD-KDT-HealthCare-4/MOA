import pytest
from datetime import date, time
from unittest.mock import MagicMock, patch
from uuid import uuid4
from fastapi import HTTPException

from app.routes.medication import create_medication
from app.schemas.notification import MedicationCreateRequest
from app.models.models import Medication

def test_create_medication_single_time():
    """Test creating a medication with a single intake_time."""
    db_mock = MagicMock()
    senior_id = uuid4()
    guardian_id = uuid4()
    
    req = MedicationCreateRequest(
        senior_id=senior_id,
        guardian_id=guardian_id,
        medicine_name="혈압약",
        intake_time=time(8, 0),
        start_date=date(2026, 6, 25),
        end_date=None,
        is_active=True
    )
    
    guardian_mock = MagicMock()
    guardian_mock.guardian_id = guardian_id
    
    with patch("app.routes.medication.verify_guardian_senior_link") as mock_verify:
        res = create_medication(req=req, db=db_mock, guardian=guardian_mock)
        
        # Verify senior-guardian link verification is called
        mock_verify.assert_called_once_with(guardian_id, senior_id, db_mock)
        
        # Verify db.add is called once for the single time
        assert db_mock.add.call_count == 1
        added_med = db_mock.add.call_args[0][0]
        assert isinstance(added_med, Medication)
        assert added_med.medicine_name == "혈압약"
        assert added_med.intake_time == time(8, 0)
        assert added_med.senior_id == senior_id
        assert added_med.guardian_id == guardian_id
        
        # Verify commit and refresh are called
        db_mock.commit.assert_called_once()
        db_mock.refresh.assert_called_once_with(added_med)
        
        # Check that single object (not list) is returned since intake_times was not provided
        assert res == added_med

def test_create_medication_multiple_times():
    """Test creating medication with multiple intake_times (e.g. 2 times)."""
    db_mock = MagicMock()
    senior_id = uuid4()
    guardian_id = uuid4()
    
    req = MedicationCreateRequest(
        senior_id=senior_id,
        guardian_id=guardian_id,
        medicine_name="당뇨약",
        intake_times=[time(12, 20), time(16, 11)],
        start_date=date(2026, 6, 25),
        end_date=None,
        is_active=True
    )
    
    guardian_mock = MagicMock()
    guardian_mock.guardian_id = guardian_id
    
    with patch("app.routes.medication.verify_guardian_senior_link") as mock_verify:
        res = create_medication(req=req, db=db_mock, guardian=guardian_mock)
        
        # Verify verification call
        mock_verify.assert_called_once_with(guardian_id, senior_id, db_mock)
        
        # Verify db.add is called twice (for 12:20 and 16:11)
        assert db_mock.add.call_count == 2
        
        added_meds = [call[0][0] for call in db_mock.add.call_args_list]
        assert len(added_meds) == 2
        assert all(isinstance(med, Medication) for med in added_meds)
        assert all(med.medicine_name == "당뇨약" for med in added_meds)
        assert added_meds[0].intake_time == time(12, 20)
        assert added_meds[1].intake_time == time(16, 11)
        
        # Verify commit and refresh are called
        db_mock.commit.assert_called_once()
        assert db_mock.refresh.call_count == 2
        
        # Check that list of objects is returned
        assert isinstance(res, list)
        assert len(res) == 2
        assert res[0] == added_meds[0]
        assert res[1] == added_meds[1]

def test_create_medication_invalid_date_range():
    """Test creating medication raises HTTPException when end_date < start_date."""
    db_mock = MagicMock()
    req = MedicationCreateRequest(
        senior_id=uuid4(),
        guardian_id=uuid4(),
        medicine_name="종합비타민",
        intake_time=time(19, 0),
        start_date=date(2026, 6, 25),
        end_date=date(2026, 6, 24), # invalid
        is_active=True
    )
    
    guardian_mock = MagicMock()
    guardian_mock.guardian_id = req.guardian_id
    
    with patch("app.routes.medication.verify_guardian_senior_link"), \
         pytest.raises(HTTPException) as exc_info:
        create_medication(req=req, db=db_mock, guardian=guardian_mock)
        
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "종료일은 시작일보다 빠를 수 없습니다."

def test_create_medication_no_times_provided():
    """Test creating medication raises HTTPException when both intake_time and intake_times are missing."""
    db_mock = MagicMock()
    req = MedicationCreateRequest(
        senior_id=uuid4(),
        guardian_id=uuid4(),
        medicine_name="종합비타민",
        intake_time=None,
        intake_times=None,
        start_date=date(2026, 6, 25),
        end_date=None,
        is_active=True
    )
    
    guardian_mock = MagicMock()
    guardian_mock.guardian_id = req.guardian_id
    
    with patch("app.routes.medication.verify_guardian_senior_link"), \
         pytest.raises(HTTPException) as exc_info:
        create_medication(req=req, db=db_mock, guardian=guardian_mock)
        
    assert exc_info.value.status_code == 400
    assert "복용 시간을 입력해 주세요" in exc_info.value.detail
