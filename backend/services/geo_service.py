"""Distance helpers used to route pickup requests to nearby collectors."""
from math import radians, sin, cos, asin, sqrt
from typing import List, Optional

from sqlalchemy.orm import Session

from backend import models

EARTH_RADIUS_KM = 6371.0
# Used when a collector has not set their own radius.
DEFAULT_RADIUS_KM = 5.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points, in kilometres."""
    lat1, lon1, lat2, lon2 = map(radians, (lat1, lon1, lat2, lon2))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))


def distance_between(a_lat, a_lon, b_lat, b_lon) -> Optional[float]:
    """Distance, or None if either point is missing coordinates."""
    if None in (a_lat, a_lon, b_lat, b_lon):
        return None
    return haversine_km(a_lat, a_lon, b_lat, b_lon)


def find_nearby_collectors(db: Session, latitude: Optional[float], longitude: Optional[float]) -> List[models.User]:
    """
    Collectors whose service radius covers this point, nearest first.

    Collectors who have not set coordinates are always included: excluding them
    would silently drop requests on the floor, which is worse than over-notifying.
    """
    collectors = db.query(models.User).filter(models.User.role == models.ROLE_COLLECTOR).all()

    if latitude is None or longitude is None:
        return collectors

    in_range = []
    for collector in collectors:
        if collector.latitude is None or collector.longitude is None:
            in_range.append((float("inf"), collector))
            continue

        distance = haversine_km(latitude, longitude, collector.latitude, collector.longitude)
        if distance <= (collector.service_radius_km or DEFAULT_RADIUS_KM):
            in_range.append((distance, collector))

    in_range.sort(key=lambda pair: pair[0])
    return [collector for _, collector in in_range]
