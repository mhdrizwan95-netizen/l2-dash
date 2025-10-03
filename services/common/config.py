"""Service-level configuration helpers.

This module centralizes environment variable parsing so each service can
share consistent defaults (ports, topics, feature settings, etc.).
"""
from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Optional


@dataclass(frozen=True)
class RedisConfig:
    url: str = "redis://localhost:6379/0"


@dataclass(frozen=True)
class KafkaConfig:
    enabled: bool = False
    brokers: Optional[str] = None
    topic_prefix: str = "l2dash"


@dataclass(frozen=True)
class AppConfig:
    env: str = os.getenv("L2_ENV", "dev")
    redis: RedisConfig = RedisConfig(url=os.getenv("L2_REDIS_URL", RedisConfig.url))
    kafka: KafkaConfig = KafkaConfig(
        enabled=os.getenv("L2_KAFKA_ENABLED", "0") == "1",
        brokers=os.getenv("L2_KAFKA_BROKERS"),
        topic_prefix=os.getenv("L2_KAFKA_TOPIC_PREFIX", KafkaConfig.topic_prefix),
    )
    ingest_key: str = os.getenv("INGEST_KEY", "")
    log_level: str = os.getenv("L2_LOG_LEVEL", "INFO")


CONFIG = AppConfig()

