import pymongo
from typing import Annotated
from tinydb import TinyDB, Query
from fastapi import FastAPI
from fastapi import Query as fQuery
from db.db import get_db
import re


app = FastAPI()
db = get_db()

@app.get("/search")
async def search_books( search: str, page: int = 1, show: int = 15, exclude: Annotated[list | None, fQuery()] = None, sort: str = "low", instock: bool = False):

    search = re.escape(search.strip())
    if search == "":
        return []
    
    queries = [{"$or" : 
               [
        {"title": {"$regex": search, "$options": "i"}},
        {"author": {"$regex": search, "$options": "i"}},
        {"description": {"$regex": search, "$options": "i"}},
    ]}]

    if instock:
        queries.append({"instock": True})

    result = db.books.find(
        {
            "$and": queries
        },
        {'_id': 0}
   )

    if sort == "low":
        # result = sorted(result, key=lambda x: x["price"] if "price" in x else 0)
        result = result.sort("price", pymongo.ASCENDING)
    elif sort == "high":
        result = result.sort("price", pymongo.DESCENDING)

    if exclude:
        result = [book for book in result if book["source"] not in exclude]

    # using page and show slice the results to paginate it
    result = list(result)
    total = len(result)
    start = (page -1) * show
    end = page * show if page * show <= total else total

    result = result[start : end]


    return {
        "results": result,
        "total": total,
        "end" : end,
        "start": start,
    }

@app.get("/featured")
def get_books():
    pass

@app.get("/")
def read_root():
    return {"Hello": "World"}