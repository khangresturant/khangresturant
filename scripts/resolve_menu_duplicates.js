const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function resolveDuplicates() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    console.log("Starting menu duplicates resolution transaction...");

    // 1. Delete 5 duplicate Naan/Roti from KHAN G SPECIAL NASHTA
    const nashtaCatRes = await client.query("SELECT id FROM categories WHERE name = 'KHAN G SPECIAL NASHTA' LIMIT 1");
    if (nashtaCatRes.rows.length > 0) {
      const nashtaCatId = nashtaCatRes.rows[0].id;
      const deleteNaanRes = await client.query(`
        DELETE FROM products
        WHERE category_id = $1
          AND name IN ('Sada Naan', 'Sada Roti', 'Khamiri Roti', 'Kalonji Naan', 'Roghani Naan')
        RETURNING id, name;
      `, [nashtaCatId]);
      console.log(`Deleted ${deleteNaanRes.rows.length} duplicate Naan/Roti from KHAN G SPECIAL NASHTA:`, deleteNaanRes.rows.map(r => r.name));
    }

    // 2. Prefix Karahis by their meat category
    const categoriesToPrefix = [
      { catName: 'KHAN G CHICKEN KARAHI (Half / Full)', prefix: 'Chicken ' },
      { catName: 'KHAN G BEEF KARAHI (Half / Full)', prefix: 'Beef ' },
      { catName: 'KHAN G MUTTON KARAHI (Half / Full)', prefix: 'Mutton ' },
      { catName: 'KHAN G DASI MURAG KARAHI', prefix: 'Desi Murgh ' }
    ];

    for (const c of categoriesToPrefix) {
      const catRes = await client.query("SELECT id FROM categories WHERE name = $1 LIMIT 1", [c.catName]);
      if (catRes.rows.length === 0) continue;
      const catId = catRes.rows[0].id;

      const prodsRes = await client.query("SELECT id, name FROM products WHERE category_id = $1", [catId]);
      for (const p of prodsRes.rows) {
        if (!p.name.startsWith(c.prefix)) {
          const newName = `${c.prefix}${p.name}`;
          await client.query("UPDATE products SET name = $1, updated_at = now() WHERE id = $2", [newName, p.id]);
          console.log(`Renamed [${c.catName}] "${p.name}" -> "${newName}"`);
        }
      }
    }

    await client.query("COMMIT;");
    console.log("Transaction committed successfully!");

    // Verification
    const dupCheck = await client.query(`
      SELECT LOWER(TRIM(name)) as name, count(*) as cnt
      FROM products
      GROUP BY LOWER(TRIM(name))
      HAVING count(*) > 1
    `);
    console.log("\n--- Verification: Duplicate Product Names in DB ---");
    console.log("Remaining duplicates count:", dupCheck.rows.length);
    if (dupCheck.rows.length > 0) {
      console.log("Duplicates:", dupCheck.rows);
    } else {
      console.log("ALL DUPLICATES RESOLVED! Every single dish in the menu is now 100% unique.");
    }

    const totalProds = await client.query("SELECT count(*) as cnt FROM products");
    const totalSizes = await client.query("SELECT count(*) as cnt FROM restaurant_menu_sizes");
    console.log(`Total Products in DB: ${totalProds.rows[0].cnt}`);
    console.log(`Total Menu Sizes in DB: ${totalSizes.rows[0].cnt}`);

  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Error during duplicate resolution, rolled back:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

resolveDuplicates().catch(e => {
  console.error(e);
  process.exit(1);
});
