from datetime import datetime, timezone


def humanize_timestamp(timestamp: datetime) -> str:
    now = datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    delta = now - timestamp
    seconds = max(int(delta.total_seconds()), 0)

    if seconds < 60:
        return "just now"
    if seconds < 3600:
        minutes = seconds // 60
        return f"{minutes}m ago"
    if seconds < 86400:
        hours = seconds // 3600
        return f"{hours}h ago"
    if seconds < 86400 * 30:
        days = seconds // 86400
        return f"{days}d ago"

    return timestamp.strftime("%Y-%m-%d")
