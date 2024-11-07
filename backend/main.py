import pymongo
from typing import Annotated
from tinydb import TinyDB, Query
from fastapi import FastAPI
import pprint
from fastapi import Query as fQuery
from db.db import get_db
import re


app = FastAPI()
db = get_db()


@app.get("/totalBooks")
async def total_books():
    return {"total": db.books.count_documents({})}


@app.get("/search")
def search_books(
    search: str = "",
    author: str = "",
    page: int = 1,
    show: int = 15,
    exclude: Annotated[list | None, fQuery()] = [],
    sort: str = "low",
    instock: bool = False,
    searchDesc: bool = True,
):
    if not search.strip() and not author.strip():
        return {"results": [], "total": 0, "end": 0, "start": 0}

    if search:
        search = re.escape(search.strip())

    if author:
        author = re.escape(author.strip())

    if author and search:
        queries = [
            {
                "$and": [
                    {
                        "$or": [
                            {
                                "author": {"$exists": False},
                                "title": {
                                    "$regex": f"(?=.*{search})(?=.*{author})",
                                    "$options": "i",
                                },
                            },
                            {
                                "author": {"$exists": True},
                                "title": {"$regex": search, "$options": "i"},
                                "author": {"$regex": author, "$options": "i"},
                            },
                        ]
                    }
                ]
            }
        ]
    elif search:
        queries = [
            {
                "$or": [
                    {
                        "title": {"$regex": search, "$options": "i"},
                    },
                    {
                        "author": {"$regex": search, "$options": "i"},
                    },
                ],
            }
        ]
    elif author:
        queries = [
            {
                "author": {"$regex": author, "$options": "i"},
            }
        ]

    # if searchDesc:
    #     queries[0]["$or"].append({"description": {"$regex": author, "$options": "i"}})

    if instock:
        queries.append({"instock": True})

    if exclude:
        queries.append({"source": {"$not": {"$in": exclude}}})   

    result = (
        db.books.find({"$and": queries}, {"_id": 0}).skip((page - 1) * show).limit(show)
    )

    total = db.books.count_documents({"$and": queries})

    if sort == "low":
        # result = sorted(result, key=lambda x: x["price"] if "price" in x else 0)
        result = result.sort("price", pymongo.ASCENDING)
    elif sort == "high":
        result = result.sort("price", pymongo.DESCENDING)

    # if exclude:
    #     result = [book for book in result if book["source"] not in exclude]

    start = (page - 1) * show
    end = page * show if page * show <= total else total

    return {
        "results": list(result),
        "total": total,
        "end": end,
        "start": start,
    }

@app.get("/status")
def get_status():
    return db.status.find_one({}, {"_id": 0})
    
@app.get("/")
def read_root():
    return {"Hello": "World"}
