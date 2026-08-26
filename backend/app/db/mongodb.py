"""
Single Motor client for the whole app. Every repository pulls its
collection from here — nothing outside this file talks to Mongo directly.
"""
import logging
import motor.motor_asyncio
import mongomock_motor
from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None
_db = None


def _init_db():
    global _client, _db
    if _db is not None:
        return _db

    if not settings.mongo_uri or settings.mongo_uri.startswith("mongomock://"):
        logger.info("Using in-memory MongoDB client (mongomock).")
        _client = mongomock_motor.AsyncMongoMockClient()
        _db = _client.get_database("jobplatform")
        return _db

    try:
        import pymongo
        sync_client = pymongo.MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=1000)
        sync_client.admin.command("ping")
        sync_client.close()

        logger.info("Connected to MongoDB at %s", settings.mongo_uri)
        _client = motor.motor_asyncio.AsyncIOMotorClient(settings.mongo_uri)
        _db = _client.get_database("jobplatform")
    except Exception as exc:
        logger.warning(
            "Could not connect to MongoDB at %s (%s). Falling back to in-memory mongomock for local development.",
            settings.mongo_uri,
            exc,
        )
        _client = mongomock_motor.AsyncMongoMockClient()
        _db = _client.get_database("jobplatform")

    return _db


class CollectionProxy:
    def __init__(self, name: str):
        self._name = name

    def _coll(self):
        db = _init_db()
        return db.get_collection(self._name)

    def __getattr__(self, name: str):
        return getattr(self._coll(), name)


def get_collection(name: str):
    return CollectionProxy(name)

