import random
import typing
from typing import Annotated
from tinydb import TinyDB, Query
from fastapi import FastAPI
from fastapi import Query as fQuery
import re
import time

app = FastAPI()

fake_book_data = [
    {
        "id": 1,
        "img": "https://s.turbifycdn.com/aah/islamicbookstore-com/explanation-of-chapters-on-knowledge-righteousness-and-good-manners-from-sharah-riyadh-al-saaliheen-47.gif",
        "title": "Explanation of Chapters on Knowledge, Righteousness, and Good Manners from Sharah Riyadh al-Saaliheen",
        "author": "Imam Nawawi",
        "price": 20.00,
        "link": "https://www.islamicbookstore.com/explanation-of-chapters-on-knowledge-righteousness-and-good-manners-from-sharah-riyadh-al-saaliheen/",
        "source": "Islamic Bookstore"
    },
    {
        "id": 2,
        "img": "https://s.turbifycdn.com/aah/islamicbookstore-com/learning-about-iman-shaykh-siddiq-hasan-khan-al-qarnuji-4.gif",
        "title": "Learning About Iman",
        "author": "Shaykh Siddiq Hasan Khan al-Qarnuji",
        "price": 15.82,
        "link": "https://www.islamicbookstore.com/learning-about-iman-shaykh-siddiq-hasan-khan-al-qarnuji/",
        
        "source": "Islamic Bookstore"
    },
    {
        "id": 3,
        "img": "https://s.turbifycdn.com/aah/islamicbookstore-com/the-tracing-qur-an-word-for-word-translation-juz-30-ibn-daud-softcover-34.gif",
        "title": "The Tracing Qur'an Word-for-Word Translation Juz 30",
        "author": "Ibn Daud",
        "price": 12.32,
        "link": "https://www.islamicbookstore.com/the-tracing-qur-an-word-for-word-translation-juz-30-ibn-daud-softcover/",
        "source": "Islamic Bookstore"
    },
    {
        "id": 4,
        "img": "https://s.turbifycdn.com/aah/islamicbookstore-com/the-four-imams-their-lives-works-and-their-schools-of-thought-268.gif",
        "author": "Muhammad Abu Zahra",
        "title": "The Four Imams: Their Lives, Works, and Their Schools of Thought",
        "price": 18.10,
        "link": "https://www.islamicbookstore.com/the-four-imams-their-lives-works-and-their-schools-of-thought/",
        "source": "Islamic Bookstore"
    }
]

fake_class_lists = [
    {
        "id": 1,
        "school": "Darul Qasim",
        "img": "https://media.licdn.com/dms/image/C4D0BAQFuwp3ZaBSNUw/company-logo_200_200/0/1631242502709/darul_qasim_logo?e=2147483647&v=beta&t=DmmZg_wJEYv9PtqBSxcYpYaM5Spt4uh6TFs5dxXgrvEA",
        "books": []
    },
    {
        "id": 2,
        "school": "Qalam Institute",
        "img": "https://pbs.twimg.com/profile_images/1037358629190594562/MrMU5VSX_400x400.jpg",
        "books": []
    },
    {
        "id": 3,
        "school": "Bayyinah Institute",
        "img": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMUvyt7gut8kLMSfVQhdCnmz2AZV1A7N0UaQ&s",
        "books": []
    },
    {
        "id": 4,
        "school": "Al-Maghrib Institute",
        "img": "https://pbs.twimg.com/profile_images/1131181643058436096/7xJy8x6G_400x400.png",
        "books": []
    }

]


app.db = TinyDB("backend/db/db.json")
@app.on_event("startup")
def get_db():
    pass

@app.get("/search")
async def search_books(search: str, exclude: Annotated[list | None, fQuery()] = None, sort: str = "low", instock: bool = False):
    result = app.db.search(Query().title.search(search, flags=re.IGNORECASE) | Query().author.search(search, flags=re.IGNORECASE))

    if sort == "low":
        result = sorted(result, key=lambda x: x["price"])
    elif sort == "high":
        result = sorted(result, key=lambda x: x["price"], reverse=True)

    if instock:
        result = [book for book in result if book["instock"]]

    if exclude:
        result = [book for book in result if book["source"] not in exclude]
            

    return result

@app.get("/featured")
def get_books():
    return fake_book_data

@app.get("/")
def read_root():
    return {"Hello": "World"}