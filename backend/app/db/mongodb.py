"""
Single Motor client for the whole app. Every repository pulls its
collection from here — nothing outside this file talks to Mongo directly.
"""
import motor.motor_asyncio

from app.core.config import settings

client = motor.motor_asyncio.AsyncIOMotorClient(settings.mongo_uri)
db = client.get_database("jobplatform")


def get_collection(name: str):
    return db.get_collection(name)
