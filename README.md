# Macvista Pharmaceuticals Pvt Ltd

A rich, premium-looking medicine availability and inventory starter project for VS Code.

## Run

1. Extract the ZIP.
2. Open the extracted project folder in VS Code.
3. Open a terminal.
4. Run:

```bash
npm install
```

5. Add the local hostname in Windows so it resolves to this computer. Open Notepad **as Administrator**, open `%SystemRoot%\System32\drivers\etc\hosts` (select **All files** in the file picker), and add:

```text
127.0.0.1 medicinestock.local
```

6. In VS Code, open **Run and Debug**, select **Run Macvista Pharmaceuticals Pvt Ltd**, and press **Ctrl+F5** (Run Without Debugging). VS Code asks for administrator credentials to configure the server, starts on port 3000, and opens `http://medicinestock.local:3000` automatically. The website itself opens without signing in; sign in when using inventory management.

Alternatively, start the server directly from PowerShell:

```powershell
$env:MEDICINESTOCK_ADMIN_USERNAME = "your-admin-username"
$env:MEDICINESTOCK_ADMIN_PASSWORD = "your-long-unique-password"
npm start
```

Then open `http://medicinestock.local:3000`. The default port is 3000; set `$env:PORT` before `npm start` to choose another port. Keep the server running while using the site.

## Included

- Premium responsive website
- Medicine catalog
- Dedicated Products page with search and category filtering
- Search and category filtering
- Stock availability badges
- Medicine details
- Request/cart workflow
- Admin sign-in protecting inventory changes, image uploads, saved request viewing, and JSON exports
- Add/update/delete medicine
- Low-stock and out-of-stock alerts in the inventory desk
- Local JSON persistence for medicines (`data/medicines.json`) and requests (`data/orders.json`)
- Saved request viewer and JSON export from the inventory desk
- Medicine image assets
- Medicine image upload from the inventory desk
- No Docker or containers required

## Important

The public catalog and customer request submission work without signing in. Inventory changes, image uploads, saved request viewing, and JSON exports require administrator credentials. Set these through the VS Code launch prompts or environment variables; they are not stored in source files. The local administrator session expires after eight hours or when signed out. The custom `.local` hostname is local to this computer and requires the Windows hosts-file entry above; other devices will need their own hostname/DNS configuration.

This is a local/demo starter. Before real pharmacy operations, use HTTPS, a production database, audit logs, secure prescription storage, validation, backups, rate limiting, and compliance controls appropriate to your jurisdiction.
