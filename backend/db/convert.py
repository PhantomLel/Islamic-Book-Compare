import json
from tinydb import TinyDB, Query


def convert(file: str):
    essential = ["URL", "Author", "Title", "Price", "Image"]
    data = json.load(file)
    new_books = []

    for book in data:
        if not all(key in book.keys() for key in essential):
            continue

        new_book = {}
        new_book["url"] = book["URL"]
        new_book["author"] = book["Author"]
        new_book["title"] = book["Title"]
        # convert price from pounds to dollars
        new_book["price"] = float(book["Price"].replace("\u00a3", "")) * 1.31
        new_book["source"] = "Zakariyya Books"

        new_book["img"] = book["Image"]
        if "In Stock" in book.keys():
            new_book["instock"] = book["In Stock"]

        if "Year Published" in book.keys():
            new_book["year"] = book["Year Published"]
        
        if "Pages" in book.keys():
            new_book["pages"] = book["Pages"]
        
        if "Publisher" in book.keys():
            new_book["publisher"] = book["Publisher"]
        
        if "Editor" in book.keys():
            new_book["editor"] = book["Editor"]
        
        if "Binding" in book.keys():
            new_book["binding"] = book["Binding"]
        
        if "Weight" in book.keys():
            new_book["weight"] = book["Weight"]
        
        new_books.append(new_book)
    
    return new_books


TinyDB("db.json").insert_multiple(convert(open("zakariyyabooks.json", "r")))