"""
Redis helpers: a small JSON cache and a per-user rate limiter.

Redis is optional. If it is not running, the cache simply misses and the rate
limiter lets requests through, so the app keeps working without it.
"""
import json
import os
import time
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException

from backend.auth import CurrentUser, get_current_user

dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# After a failed connection, wait this long before trying Redis again
RETRY_AFTER_SECONDS = 30

_client = None
_unavailable_until = 0.0


def get_redis():
    global _client, _unavailable_until
    if _client is not None:
        return _client
    if time.time() < _unavailable_until:
        return None
    try:
        import redis

        client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=0.5, socket_timeout=0.5)
        client.ping()
        _client = client
        return _client
    except Exception as error:
        print(f"Redis unavailable, continuing without it: {error}")
        _unavailable_until = time.time() + RETRY_AFTER_SECONDS
        return None


def _mark_failed(error: Exception) -> None:
    """Drop the connection after an error so the next call reconnects (after a pause)."""
    global _client, _unavailable_until
    print(f"Redis error, continuing without it: {error}")
    _client = None
    _unavailable_until = time.time() + RETRY_AFTER_SECONDS


def cache_get(key: str) -> Optional[Any]:
    client = get_redis()
    if not client:
        return None
    try:
        value = client.get(key)
        return json.loads(value) if value is not None else None
    except Exception as error:
        _mark_failed(error)
        return None


def cache_set(key: str, value: Any, ttl_seconds: int) -> None:
    client = get_redis()
    if not client:
        return
    try:
        client.set(key, json.dumps(value), ex=ttl_seconds)
    except Exception as error:
        _mark_failed(error)


def check_rate_limit(name: str, user_id: str, limit: int, window_seconds: int) -> Optional[int]:
    """
    Count this request against the user's allowance for the current time window.

    Returns None when the request is allowed, or the number of seconds until the
    window resets when the user is over the limit. Allows the request if Redis is down.
    """
    client = get_redis()
    if not client:
        return None

    now = time.time()
    window = int(now // window_seconds)
    key = f"rate:{name}:{user_id}:{window}"
    try:
        pipe = client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        count, _ = pipe.execute()
    except Exception as error:
        _mark_failed(error)
        return None

    if count > limit:
        return max(1, int(window_seconds - now % window_seconds))
    return None


def rate_limit(name: str, limit: int, window_seconds: int = 60):
    """FastAPI dependency: at most `limit` requests per user in each window, else 429."""
    def dependency(user: CurrentUser = Depends(get_current_user)) -> None:
        retry_after = check_rate_limit(name, user.uid, limit, window_seconds)
        if retry_after is not None:
            raise HTTPException(
                status_code=429,
                detail=f"You're sending requests too quickly. Please wait {retry_after} seconds and try again.",
                headers={"Retry-After": str(retry_after)},
            )
    return dependency
