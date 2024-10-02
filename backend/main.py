import pymongo
from typing import Annotated
from tinydb import TinyDB, Query
from fastapi import FastAPI
from fastapi import Query as fQuery
from db.db import get_db
import re


app = FastAPI()
db = get_db()


@app.get("/totalBooks")
async def total_books():
    return {
        "total" : db.books.count_documents({})
    }

@app.get("/search")
async def search_books(
    search: str,
    page: int = 1,
    show: int = 15,
    exclude: Annotated[list | None, fQuery()] = None,
    sort: str = "low",
    instock: bool = True,
    searchDesc: bool = True,
):

    search = re.escape(search.strip())
    if search == "":
        return []

    queries = [
        {
            "$or": [
                {"title": {"$regex": search, "$options": "i"}},
                {"author": {"$regex": search, "$options": "i"}},
            ]
        }
    ]

    print(searchDesc)
    if searchDesc:
        queries[0]["$or"].append({"description": {"$regex": search, "$options": "i"}})

    if instock:
        queries.append({"instock": True})

    result = (
        db.books.find({"$and": queries}, {"_id": 0}).skip((page - 1) * show).limit(show)
    )

    total = db.books.count_documents({"$and": queries})

    if sort == "low":
        # result = sorted(result, key=lambda x: x["price"] if "price" in x else 0)
        result = result.sort("price", pymongo.ASCENDING)
    elif sort == "high":
        result = result.sort("price", pymongo.DESCENDING)

    if exclude:
        result = [book for book in result if book["source"] not in exclude]

    start = (page - 1) * show
    end = page * show if page * show <= total else total

    return {
        "results": list(result),
        "total": total,
        "end": end,
        "start": start,
    }


@app.get("/featured")
def get_books():
    pass


@app.get("/")
def read_root():
    return {"Hello": "World"}
