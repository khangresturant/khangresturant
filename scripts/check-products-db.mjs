import Database from "better-sqlite3";
import path from "path";

const filePath = path.join(process.cwd(), "data", "flame9.sqlite");
const db = new Database(filePath);
const counts = db
  .prepare("SELECT table_name, COUNT(*) as c FROM app_rows GROUP BY table_name")
  .all();
console.log("tables:", counts);
const prods = db
  .prepare("SELECT data FROM app_rows WHERE table_name = 'products'")
  .all();
console.log("products:", prods.length);
for (const r of prods) {
  const p = JSON.parse(r.data);
  console.log("-", p.name, p.shop_id, "ingredient:", p.is_ingredient);
}
