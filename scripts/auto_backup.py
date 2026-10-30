#!/usr/bin/env python3
"""
HisabX Auto-Backup Cron Script
Runs every minute via crontab. Finds shops due for backup and uploads
directly to their Google Drive — zero VPS disk space used.
"""
import subprocess
import json
import datetime
import os
import urllib.request
import urllib.parse

CLIENT_ID = "33744104728-c436hkgjls21oadr6skjbg9d19p1e539.apps.googleusercontent.com"
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")

# If not in env, read from .env.local on VPS
if not CLIENT_SECRET:
    env_path = "/var/www/theaccounts.cloud/.env.local"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("GOOGLE_CLIENT_SECRET="):
                    CLIENT_SECRET = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

# Calculate Pakistan time (UTC+5)
pkt_now = datetime.datetime.utcnow() + datetime.timedelta(hours=5)
current_time_str = pkt_now.strftime("%H:%M")
date_str = pkt_now.strftime("%Y-%m-%dT%H-%M-%SZ")

print(f"[{pkt_now.strftime('%Y-%m-%d %H:%M')} PKT] Cron check started")

if not CLIENT_SECRET:
    print("ERROR: GOOGLE_CLIENT_SECRET not configured. Exiting.")
    exit(1)


def run_psql(query):
    """Run a psql query inside the supabase-db container."""
    cmd = ["docker", "exec", "supabase-db", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-c", query]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return res.stdout.strip(), res.returncode


def get_access_token(refresh_token):
    """Exchange refresh token for a fresh access token via Google OAuth."""
    data = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()

    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            return result.get("access_token")
    except Exception as e:
        print(f"  ERROR getting access token: {e}")
        return None


def upload_to_gdrive(access_token, folder_id, filename, content_bytes):
    """Upload a file to Google Drive using multipart upload."""
    boundary = "hisabx_backup_boundary_314159"
    metadata = json.dumps({"name": filename, "parents": [folder_id]})

    body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{metadata}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: application/json\r\n\r\n"
    ).encode() + content_bytes + f"\r\n--{boundary}--".encode()

    req = urllib.request.Request(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        data=body,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": f"multipart/related; boundary={boundary}",
            "Content-Length": str(len(body)),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
            return result.get("id")
    except Exception as e:
        print(f"  ERROR uploading to Drive: {e}")
        return None


def delete_old_drive_files(access_token, folder_id, current_filename):
    """Delete backups older than 7 days from the Drive folder."""
    url = (
        f"https://www.googleapis.com/drive/v3/files"
        f"?q=%27{folder_id}%27+in+parents+and+trashed%3Dfalse"
        f"&orderBy=createdTime+desc"
        f"&fields=files(id,name,createdTime)"
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"  WARNING: Could not list Drive files for cleanup: {e}")
        return

    now = datetime.datetime.utcnow()
    for file in data.get("files", []):
        if file["name"] == current_filename:
            continue  # Keep the just-uploaded file
        created = datetime.datetime.fromisoformat(file["createdTime"].replace("Z", "+00:00"))
        # Make both offset-aware for comparison
        age_days = (now.replace(tzinfo=datetime.timezone.utc) - created).days
        if age_days > 7:
            del_req = urllib.request.Request(
                f"https://www.googleapis.com/drive/v3/files/{file['id']}",
                headers={"Authorization": f"Bearer {access_token}"},
                method="DELETE",
            )
            try:
                urllib.request.urlopen(del_req, timeout=10)
                print(f"  Deleted old Drive backup: {file['name']} (age: {age_days}d)")
            except Exception as e:
                print(f"  WARNING: Could not delete {file['name']}: {e}")


# ── Fetch shops due for backup ──────────────────────────────────────────────
shops_query = (
    "SELECT id, name, backup_time, gdrive_refresh_token, gdrive_folder_id "
    "FROM shops WHERE backup_enabled = true "
    "AND gdrive_refresh_token IS NOT NULL AND gdrive_refresh_token != ''"
)
output, code = run_psql(shops_query)

if code != 0:
    print(f"ERROR querying database. Exiting.")
    exit(1)

shops = []
for line in output.split("\n"):
    if not line:
        continue
    parts = line.split("|")
    if len(parts) >= 5:
        shops.append({
            "id": parts[0],
            "name": parts[1],
            "time": parts[2],
            "refresh_token": parts[3],
            "folder_id": parts[4],
        })

print(f"Found {len(shops)} shops with auto-backup + Drive linked.")

# ── Table queries ────────────────────────────────────────────────────────────
QUERIES = {
    "brands": "SELECT * FROM brands WHERE shop_id = '{sid}'",
    "categories": "SELECT * FROM categories WHERE shop_id = '{sid}'",
    "units": "SELECT * FROM units WHERE shop_id = '{sid}'",
    "shelves": "SELECT * FROM shelves WHERE shop_id = '{sid}'",
    "formulations": "SELECT * FROM formulations WHERE shop_id = '{sid}'",
    "products": "SELECT * FROM products WHERE shop_id = '{sid}'",
    "product_variants": "SELECT * FROM product_variants WHERE shop_id = '{sid}'",
    "product_barcodes": "SELECT * FROM product_barcodes WHERE shop_id = '{sid}'",
    "parties": "SELECT * FROM parties WHERE shop_id = '{sid}'",
    "cash_accounts": "SELECT * FROM cash_accounts WHERE shop_id = '{sid}'",
    "expenses": "SELECT * FROM expenses WHERE shop_id = '{sid}'",
    "invoices": "SELECT * FROM invoices WHERE shop_id = '{sid}'",
    "returns": "SELECT * FROM returns WHERE shop_id = '{sid}'",
    "purchase_orders": "SELECT * FROM purchase_orders WHERE shop_id = '{sid}'",
    "sales": "SELECT * FROM sales WHERE shop_id = '{sid}'",
    "credit_transactions": "SELECT * FROM credit_transactions WHERE shop_id = '{sid}'",
    "account_transactions": "SELECT * FROM account_transactions WHERE shop_id = '{sid}'",
    "stitching_orders": "SELECT * FROM stitching_orders WHERE shop_id = '{sid}'",
    "repair_tickets": "SELECT * FROM repair_tickets WHERE shop_id = '{sid}'",
    "fuel_tanks": "SELECT * FROM fuel_tanks WHERE shop_id = '{sid}'",
    "fuel_pumps": "SELECT * FROM fuel_pumps WHERE shop_id = '{sid}'",
    "register_sessions": "SELECT * FROM register_sessions WHERE shop_id = '{sid}'",
    "installment_plans": "SELECT * FROM installment_plans WHERE shop_id = '{sid}'",
    "customers": "SELECT * FROM customers WHERE shop_id = '{sid}'",
    "company_details": "SELECT * FROM company_details WHERE shop_id = '{sid}'",
    "print_settings": "SELECT * FROM print_settings WHERE shop_id = '{sid}'",
    "warehouses": "SELECT * FROM warehouses WHERE shop_id = '{sid}'",
    "stock": "SELECT * FROM stock WHERE shop_id = '{sid}'",
    "stock_adjustments": "SELECT * FROM stock_adjustments WHERE shop_id = '{sid}'",
    "gift_cards": "SELECT * FROM gift_cards WHERE shop_id = '{sid}'",
    "invoice_items": "SELECT * FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE shop_id = '{sid}')",
    "emi_schedules": "SELECT * FROM emi_schedules WHERE invoice_id IN (SELECT id FROM invoices WHERE shop_id = '{sid}')",
    "tailor_measurements": "SELECT * FROM tailor_measurements WHERE invoice_id IN (SELECT id FROM invoices WHERE shop_id = '{sid}')",
    "return_items": "SELECT * FROM return_items WHERE return_id IN (SELECT id FROM returns WHERE shop_id = '{sid}')",
    "purchase_order_items": "SELECT * FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE shop_id = '{sid}')",
    "sale_items": "SELECT * FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE shop_id = '{sid}')",
    "shift_meter_readings": "SELECT * FROM shift_meter_readings WHERE register_session_id IN (SELECT id FROM register_sessions WHERE shop_id = '{sid}')",
    "installment_payments": "SELECT * FROM installment_payments WHERE plan_id IN (SELECT id FROM installment_plans WHERE shop_id = '{sid}')",
    "gift_card_transactions": "SELECT * FROM gift_card_transactions WHERE gift_card_id IN (SELECT id FROM gift_cards WHERE shop_id = '{sid}')",
}

# ── Process each shop ────────────────────────────────────────────────────────
for shop in shops:
    if shop["time"] != current_time_str:
        print(f"  Skipping {shop['name']} (scheduled {shop['time']}, now {current_time_str})")
        continue

    print(f"  ► Backing up shop: {shop['name']} → Google Drive")

    # Get fresh access token
    access_token = get_access_token(shop["refresh_token"])
    if not access_token:
        print(f"  ERROR: Could not get access token for {shop['name']}. Skipping.")
        continue

    # Generate backup JSON
    backup_data = {
        "version": "1.0",
        "timestamp": pkt_now.isoformat() + "+05:00",
        "shopName": shop["name"],
        "shopId": shop["id"],
        "data": {},
    }

    for table, query_tpl in QUERIES.items():
        q = query_tpl.format(sid=shop["id"])
        agg_sql = f"SELECT json_agg(t) FROM ({q}) t"
        out, rc = run_psql(agg_sql)
        table_data = []
        if rc == 0 and out and out.lower() != "null":
            try:
                table_data = json.loads(out)
            except Exception as e:
                print(f"  WARNING: JSON parse error for {table}: {e}")
        backup_data["data"][table] = table_data or []

    # Serialize
    content = json.dumps(backup_data, ensure_ascii=False).encode("utf-8")
    filename = f"hisabx_auto_backup_{date_str}.json"

    # Upload to Google Drive
    file_id = upload_to_gdrive(access_token, shop["folder_id"], filename, content)
    if file_id:
        print(f"  ✓ Uploaded to Drive: {filename} (id={file_id}) — NO VPS disk used")
        # Cleanup old backups
        delete_old_drive_files(access_token, shop["folder_id"], filename)
    else:
        print(f"  ERROR: Upload failed for {shop['name']}")

print("Cron check completed.")
