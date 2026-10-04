const { MongoClient } = require('mongodb');

async function test() {
  const uri = process.env.DATABASE_URL;
  console.log("Connecting to", uri.replace(/:([^:@]{3,})@/, ':***@'));
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected successfully!");
  } catch (err) {
    console.error("Connection error:", err);
  } finally {
    await client.close();
  }
}
test();
