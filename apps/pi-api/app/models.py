from pydantic import BaseModel


class Detection(BaseModel):
    rowid: int
    sci_name: str
    com_name: str
    confidence: float
    date: str
    time: str
    timestamp: str  # ISO 8601, "YYYY-MM-DDTHH:MM:SS"
    recording_url: str  # relative to this API, e.g. /api/recordings/123


class SpeciesListItem(BaseModel):
    sci_name: str
    com_name: str
    count: int  # all-time
    last_heard: str  # ISO 8601


class RecentDetection(BaseModel):
    rowid: int
    timestamp: str
    confidence: float
    recording_url: str


class SpeciesDetail(BaseModel):
    sci_name: str
    com_name: str
    genus: str
    all_time_count: int
    window_count: int
    first_heard: str
    last_heard: str
    recent: list[RecentDetection]


class TopSpecies(BaseModel):
    sci_name: str
    com_name: str
    count: int


class FirstDetection(BaseModel):
    sci_name: str
    com_name: str
    first_heard: str  # ISO 8601 of the earliest detection for this species


class PeriodBucket(BaseModel):
    bucket: str  # ISO 8601 start of the bucket
    count: int


class SpeciesListEntry(BaseModel):
    sci_name: str
    com_name: str
