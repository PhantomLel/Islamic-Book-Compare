import "dotenv/config";
import { MongoClient } from "mongodb";


let client: MongoClient;
async function getDb() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI || '');
    await client.connect();
    console.log("Connected to MongoDB");
  }
  return client.db('data');
}
getDb();

export default getDb;