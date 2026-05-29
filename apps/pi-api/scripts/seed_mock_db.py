#!/usr/bin/env python3
"""Create a synthetic birds.db (and dummy clips) for local dry-runs.

The real BirdNET-Pi DB is empty until detections occur, so this mirrors the
exact schema and lets us exercise every endpoint on the Mac before deploy.

Usage:
    python scripts/seed_mock_db.py [--db PATH] [--songs DIR] [--clips]
"""
import argparse
import os
import random
import sqlite3
from datetime import datetime, timedelta

SPECIES = [
    ("Cyanistes caeruleus", "Eurasian Blue Tit"),
    ("Parus major", "Great Tit"),
    ("Erithacus rubecula", "European Robin"),
    ("Turdus merula", "Eurasian Blackbird"),
    ("Passer domesticus", "House Sparrow"),
    ("Columba palumbus", "Common Wood-Pigeon"),
    ("Fringilla coelebs", "Common Chaffinch"),
    ("Sturnus vulgaris", "European Starling"),
    ("Pica pica", "Eurasian Magpie"),
    ("Carduelis carduelis", "European Goldfinch"),
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS detections (
  Date DATE,
  Time TIME,
  Sci_Name VARCHAR(100) NOT NULL,
  Com_Name VARCHAR(100) NOT NULL,
  Confidence FLOAT,
  Lat FLOAT,
  Lon FLOAT,
  Cutoff FLOAT,
  Week INT,
  Sens FLOAT,
  Overlap FLOAT,
  File_Name VARCHAR(100) NOT NULL);
"""
INDEX = "CREATE INDEX IF NOT EXISTS idx_dt ON detections (Date DESC, Time DESC);"


def main() -> None:
    ap = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("--db", default=os.path.join(here, "mock-birds.db"))
    ap.add_argument("--songs", default=os.path.join(here, "mock-songs"))
    ap.add_argument("--clips", action="store_true", help="also write dummy mp3 files")
    ap.add_argument("--count", type=int, default=600)
    args = ap.parse_args()

    if os.path.exists(args.db):
        os.remove(args.db)
    conn = sqlite3.connect(args.db)
    conn.execute(SCHEMA)
    conn.execute(INDEX)

    now = datetime.now()
    rng = random.Random(42)
    rows = []
    for _ in range(args.count):
        sci, com = rng.choice(SPECIES)
        # Skew toward recent timestamps so 1h/12h windows have data.
        minutes_ago = int(rng.expovariate(1 / 1800)) % (8 * 24 * 60)
        ts = now - timedelta(minutes=minutes_ago)
        date = ts.strftime("%Y-%m-%d")
        time = ts.strftime("%H:%M:%S")
        conf = round(rng.uniform(0.6, 0.99), 4)
        week = int(ts.strftime("%W"))
        fname = f"{com.replace(' ', '_')}-{conf:.2f}-{date}-birdnet-{time.replace(':', '')}.mp3"
        rows.append(
            (date, time, sci, com, conf, 52.1, 5.1, 0.7, week, 1.25, 0.0, fname)
        )

        if args.clips:
            clip_dir = os.path.join(args.songs, date, com.replace(" ", "_"))
            os.makedirs(clip_dir, exist_ok=True)
            clip_path = os.path.join(clip_dir, fname)
            if not os.path.exists(clip_path):
                # 1-byte placeholder; enough for FileResponse + content-type.
                with open(clip_path, "wb") as fh:
                    fh.write(b"\x00")

    conn.executemany(
        "INSERT INTO detections VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", rows
    )
    conn.commit()
    conn.close()
    print(f"wrote {len(rows)} detections to {args.db}")
    if args.clips:
        print(f"wrote dummy clips under {args.songs}")


if __name__ == "__main__":
    main()
