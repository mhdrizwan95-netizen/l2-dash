"""Logging helpers shared across services."""
from __future__ import annotations

import logging
import sys
from typing import Iterable


def configure(service_name: str, level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger(service_name)
    if logger.handlers:
        return logger
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(level)
    _quiet_third_party(
        [
            "httpx",
            "httpcore",
            "ib_insync.client",
            "ib_insync.wrapper",
        ]
    )
    return logger


def _quiet_third_party(names: Iterable[str]) -> None:
    for name in names:
        logging.getLogger(name).setLevel(logging.WARNING)

