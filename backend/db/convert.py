import json
from tinydb import TinyDB, Query


def convert(file: str):
    data = json.load(file)
    new = []
    for i in data:
        i["price"] = float(i["price"]) * 1.31
        i["img"] = i["image"]

        del i["image"]

        new.append(i)
    return new

TinyDB("db.json").insert_multiple(convert(open("co.json", "r")))