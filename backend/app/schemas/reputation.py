"""Request/response DTOs for the reputation endpoint — what crosses the wire."""
from pydantic import BaseModel


class ReputationResponse(BaseModel):
    """
    The unified score and the components it came from.

    The components are part of the response, not an optional expansion of it: a
    single number here would be read as a measure of engineering ability, and it
    is not one. See services/reputation_service.compute_reputation.
    """

    user_id: str
    overall: int
    comprehension: int  # mean of every defended candidate quiz score, 0 with no quizzes
    day1_readiness: int = 0  # mean of every defended Day-1 readiness quiz score, 0 with no Day-1 quizzes
    quiz_count: int     # how many defended scores that mean is over
    rounds_reached: int  # applications that moved past the pile
