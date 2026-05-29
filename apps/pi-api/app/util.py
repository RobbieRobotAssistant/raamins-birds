from datetime import datetime, timezone


def iso(date: str, time: str) -> str:
    """Combine BirdNET-Pi's separate Date and Time columns into ISO 8601."""
    return f"{date}T{time}"


def genus_of(sci_name: str) -> str:
    """Genus is the first token of a binomial scientific name."""
    return sci_name.split(" ", 1)[0] if sci_name else ""


def epoch_to_iso(epoch: int) -> str:
    """Convert a localtime epoch-second bucket back to a naive ISO string.

    Buckets are produced by strftime('%s', ...) which treats the stored
    localtime string as if it were UTC; we mirror that here so labels line
    up with the stored Date/Time rather than shifting by the TZ offset.
    """
    return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
