"""
Automated DB backup — pg_dump → gzip → Cloudflare R2, with retention cleanup.

Scheduled nightly at 3am Cairo time via APScheduler in main.py.
Can also be triggered manually via POST /internal/backup.
"""
import os
import gzip
import logging
import subprocess
from datetime import datetime, timedelta

import boto3
from botocore.client import Config

logger = logging.getLogger("backup")

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET = os.getenv("R2_BUCKET", "wallet-backups")
DATABASE_URL = os.getenv("DATABASE_URL", "")
BACKUP_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))


def _r2_configured() -> bool:
    """Check if R2 credentials are set."""
    return bool(R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY)


def get_r2_client():
    """Create an S3-compatible client for Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def run_backup() -> dict:
    """
    Dump the PostgreSQL database, compress it, upload to R2, and clean old backups.
    Returns a status dict: {"status": "success"|"failed"|"skipped", ...}
    """
    if not _r2_configured():
        logger.warning("R2 credentials not configured — skipping backup")
        return {"status": "skipped", "reason": "R2 credentials not set"}

    if not DATABASE_URL:
        logger.warning("DATABASE_URL not set — skipping backup")
        return {"status": "skipped", "reason": "DATABASE_URL not set"}

    try:
        logger.info("Starting DB backup...")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.sql.gz"
        local_path = f"/tmp/{filename}"

        # ── Dump database ────────────────────────────────────────────
        dump = subprocess.run(
            ["pg_dump", DATABASE_URL, "--no-owner", "--no-privileges"],
            capture_output=True,
            timeout=300,  # 5 min max
        )
        if dump.returncode != 0:
            err_msg = dump.stderr.decode(errors="replace")
            raise RuntimeError(f"pg_dump failed (code {dump.returncode}): {err_msg}")

        # Don't upload empty dumps
        if len(dump.stdout) < 100:
            raise RuntimeError("pg_dump produced suspiciously small output — aborting")

        # ── Compress ─────────────────────────────────────────────────
        with gzip.open(local_path, "wb") as f:
            f.write(dump.stdout)

        file_size = os.path.getsize(local_path)
        logger.info(f"Dump compressed: {file_size / 1024:.1f} KB → {filename}")

        # ── Upload to R2 ────────────────────────────────────────────
        client = get_r2_client()
        client.upload_file(local_path, R2_BUCKET, filename)
        logger.info(f"Backup uploaded to R2: {filename}")

        # ── Cleanup local file ──────────────────────────────────────
        try:
            os.remove(local_path)
        except OSError:
            pass

        # ── Delete old backups ──────────────────────────────────────
        deleted = _delete_old_backups(client)

        return {
            "status": "success",
            "file": filename,
            "size_kb": round(file_size / 1024, 1),
            "old_deleted": deleted,
        }

    except Exception as e:
        logger.error(f"Backup failed: {e}", exc_info=True)
        # Clean up local file on failure
        try:
            if "local_path" in dir() and os.path.exists(local_path):
                os.remove(local_path)
        except OSError:
            pass
        return {"status": "failed", "error": str(e)}


def _delete_old_backups(client) -> int:
    """Delete backups older than BACKUP_RETENTION_DAYS. Returns count deleted."""
    cutoff = datetime.now() - timedelta(days=BACKUP_RETENTION_DAYS)
    deleted = 0
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=R2_BUCKET):
            for obj in page.get("Contents", []):
                last_modified = obj["LastModified"].replace(tzinfo=None)
                if last_modified < cutoff:
                    client.delete_object(Bucket=R2_BUCKET, Key=obj["Key"])
                    logger.info(f"Deleted old backup: {obj['Key']}")
                    deleted += 1
    except Exception as e:
        logger.warning(f"Failed to clean old backups: {e}")
    return deleted


def get_last_backup_time() -> str:
    """Query R2 for the most recent backup file's timestamp."""
    if not _r2_configured():
        return "not_configured"
    try:
        client = get_r2_client()
        response = client.list_objects_v2(Bucket=R2_BUCKET)
        objects = response.get("Contents", [])
        if not objects:
            return "never"
        latest = max(objects, key=lambda x: x["LastModified"])
        return latest["LastModified"].isoformat()
    except Exception:
        return "unknown"


def list_backups() -> list[dict]:
    """List all backups in R2 with metadata."""
    if not _r2_configured():
        return []
    try:
        client = get_r2_client()
        all_objects = []
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=R2_BUCKET):
            for obj in page.get("Contents", []):
                all_objects.append({
                    "key": obj["Key"],
                    "size_kb": round(obj["Size"] / 1024, 1),
                    "last_modified": obj["LastModified"].isoformat(),
                })
        return sorted(all_objects, key=lambda x: x["last_modified"], reverse=True)
    except Exception as e:
        logger.error(f"Failed to list backups: {e}")
        return []
