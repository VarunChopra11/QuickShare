import time
import threading
from typing import Dict, List, Tuple
from fastapi import HTTPException, Request, status
from app.config import settings


class RateLimiter:
    """
    Lightweight, thread-safe, in-memory rate limiter with sliding window
    and failed-attempt lockout protection.
    Optimized for minimal RAM usage.
    """

    def __init__(self):
        self._lock = threading.Lock()
        # ip -> list of request timestamps in seconds
        self._lookup_requests: Dict[str, List[float]] = {}
        self._create_requests: Dict[str, List[float]] = {}
        # ip -> (failed_count, lockout_until_timestamp)
        self._failed_attempts: Dict[str, Tuple[int, float]] = {}
        self._last_cleanup = time.time()

    def _cleanup_old_records(self, now: float) -> None:
        """Prune records older than 5 minutes to prevent memory growth."""
        if now - self._last_cleanup < 60:
            return
        self._last_cleanup = now
        cutoff = now - 300

        for mapping in (self._lookup_requests, self._create_requests):
            stale_keys = [ip for ip, timestamps in mapping.items() if not timestamps or timestamps[-1] < cutoff]
            for ip in stale_keys:
                mapping.pop(ip, None)

        stale_failed = [
            ip for ip, (count, lockout_until) in self._failed_attempts.items()
            if lockout_until < cutoff and count == 0
        ]
        for ip in stale_failed:
            self._failed_attempts.pop(ip, None)

    def check_lookup_rate(self, client_ip: str) -> None:
        now = time.time()
        with self._lock:
            self._cleanup_old_records(now)

            # Check if client IP is currently locked out due to failed attempts
            if client_ip in self._failed_attempts:
                count, lockout_until = self._failed_attempts[client_ip]
                if now < lockout_until:
                    retry_after = int(lockout_until - now) + 1
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Too many failed code attempts. Try again in {retry_after} seconds.",
                        headers={"Retry-After": str(retry_after)}
                    )
                elif lockout_until > 0 and now >= lockout_until:
                    # Lockout expired, reset failed counter
                    self._failed_attempts[client_ip] = (0, 0.0)

            # Sliding window check
            timestamps = self._lookup_requests.setdefault(client_ip, [])
            # Filter timestamps within the last 60 seconds
            cutoff = now - 60
            timestamps = [t for t in timestamps if t > cutoff]
            self._lookup_requests[client_ip] = timestamps

            if len(timestamps) >= settings.RATE_LIMIT_LOOKUP_PER_MINUTE:
                retry_after = int(60 - (now - timestamps[0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many lookup requests. Please slow down.",
                    headers={"Retry-After": str(max(1, retry_after))}
                )

            timestamps.append(now)

    def record_failed_lookup(self, client_ip: str) -> None:
        """Record an invalid or expired code lookup attempt."""
        now = time.time()
        with self._lock:
            count, lockout_until = self._failed_attempts.get(client_ip, (0, 0.0))
            count += 1
            if count >= settings.MAX_FAILED_ATTEMPTS:
                lockout_until = now + settings.FAILED_ATTEMPT_LOCKOUT_SECONDS
            self._failed_attempts[client_ip] = (count, lockout_until)

    def record_successful_lookup(self, client_ip: str) -> None:
        """Reset failed attempt count on a valid lookup."""
        with self._lock:
            if client_ip in self._failed_attempts:
                # keep count at 0
                self._failed_attempts[client_ip] = (0, 0.0)

    def check_create_rate(self, client_ip: str) -> None:
        now = time.time()
        with self._lock:
            self._cleanup_old_records(now)

            timestamps = self._create_requests.setdefault(client_ip, [])
            cutoff = now - 60
            timestamps = [t for t in timestamps if t > cutoff]
            self._create_requests[client_ip] = timestamps

            if len(timestamps) >= settings.RATE_LIMIT_CREATE_PER_MINUTE:
                retry_after = int(60 - (now - timestamps[0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many share creation requests. Please wait a moment.",
                    headers={"Retry-After": str(max(1, retry_after))}
                )

            timestamps.append(now)


rate_limiter = RateLimiter()


def get_client_ip(request: Request) -> str:
    """Extract client IP safely from request headers or direct client."""
    # Check X-Forwarded-For if behind reverse proxy
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP
        parts = [p.strip() for p in forwarded.split(",")]
        if parts:
            return parts[0]
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"
