import logging
import structlog


def configure_logging() -> None:
    """Configure structlog for JSON-formatted, levelled logging.

    Output format in production (JSON, one object per line):
        {"event": "login_success", "user_id": 3, "role": "admin", "level": "info", ...}

    In development the ConsoleRenderer produces readable coloured output instead.
    Set LOG_FORMAT=json in .env to force JSON regardless of environment.
    """
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Also configure stdlib logging so uvicorn / SQLAlchemy logs flow through
    logging.basicConfig(
        format="%(message)s",
        level=logging.INFO,
    )


def get_logger(name: str = __name__):
    return structlog.get_logger(name)
