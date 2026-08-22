"""Request/response DTOs for the jobs endpoints."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class JobCreateRequest(BaseModel):
    company_name: str
    role_title: str
    description: str
    tech_stack: List[str] = []


class JobResponse(BaseModel):
    id: str
    company_name: str
    role_title: str
    description: str
    tech_stack: List[str]
    posted_at: Optional[datetime] = None


class ApplicationRequest(BaseModel):
    job_id: str
    user_id: str
    quiz_score_id: Optional[str] = None
