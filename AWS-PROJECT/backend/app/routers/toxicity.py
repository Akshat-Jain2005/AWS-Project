from fastapi import APIRouter, Query
from ..services import toxicity

router = APIRouter()


@router.get("/toxicity/assess")
def assess(ammonia_ppm: float = Query(ge=0, le=50), ph: float = Query(ge=0, le=14),
           temp_c: float = Query(ge=0, le=60)):
    """Public calculator: how toxic is this water at this temperature and pH?"""
    return toxicity.assess(ammonia_ppm, ph, temp_c)


@router.get("/toxicity/heat-curve")
def heat_curve(ammonia_ppm: float = Query(ge=0, le=50), ph: float = Query(ge=0, le=14)):
    """Same ammonia reading, different temperatures. Feeds the 'heat makes it deadlier' chart."""
    return {"ammonia_ppm": ammonia_ppm, "ph": ph, "points": toxicity.heat_curve(ammonia_ppm, ph)}
