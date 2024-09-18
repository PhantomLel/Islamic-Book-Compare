from pymongo.mongo_client import MongoClient
from pymongo.database import Database
from pymongo.server_api import ServerApi

def get_db() -> Database:
    uri = open("mongourl.txt").read().strip()

    # Create a new client and connect to the server
    client = MongoClient(uri, server_api=ServerApi('1'))

    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")

    return client["data"]
