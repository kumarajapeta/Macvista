const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const parsedPort = Number.parseInt(process.env.PORT || "", 10);
const PORT = Number.isInteger(parsedPort) ? parsedPort : 3000;
const PUBLIC_HOST = process.env.PUBLIC_HOST || "medicinestock.local";
const ADMIN_USERNAME = process.env.MEDICINESTOCK_ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.MEDICINESTOCK_ADMIN_PASSWORD || "";
const ADMIN_SESSION_TTL = 8 * 60 * 60 * 1000;
const adminSessions = new Map();
const ADMIN_COOKIE = "medicinestock_admin";
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const dbFile = path.join(DATA_DIR, "medicines.json");

const starter = [
  {id:1,name:"Paracetamol 500mg",generic:"Paracetamol",brand:"Calpol",category:"Pain Relief",form:"Tablet",pack:"10 tablets",stock:124,price:32.50,status:"In Stock",prescription:false,image:"/assets/medicine-1.svg"},
  {id:2,name:"Amoxicillin 500mg",generic:"Amoxicillin",brand:"Mox",category:"Antibiotic",form:"Capsule",pack:"10 capsules",stock:38,price:86.00,status:"In Stock",prescription:true,image:"/assets/medicine-2.svg"},
  {id:3,name:"Metformin 500mg",generic:"Metformin",brand:"Glycomet",category:"Diabetes",form:"Tablet",pack:"20 tablets",stock:72,price:48.00,status:"In Stock",prescription:true,image:"/assets/medicine-3.svg"},
  {id:4,name:"Cetirizine 10mg",generic:"Cetirizine",brand:"Cetcip",category:"Allergy",form:"Tablet",pack:"10 tablets",stock:19,price:28.00,status:"Low Stock",prescription:false,image:"/assets/medicine-4.svg"},
  {id:5,name:"Pantoprazole 40mg",generic:"Pantoprazole",brand:"Pantocid",category:"Gastro",form:"Tablet",pack:"15 tablets",stock:56,price:74.00,status:"In Stock",prescription:true,image:"/assets/medicine-5.svg"},
  {id:6,name:"Vitamin D3 60K",generic:"Cholecalciferol",brand:"Uprise-D3",category:"Vitamins",form:"Capsule",pack:"4 capsules",stock:91,price:112.00,status:"In Stock",prescription:false,image:"/assets/medicine-6.svg"},
  {id:7,name:"Azithromycin 500mg",generic:"Azithromycin",brand:"Azithral",category:"Antibiotic",form:"Tablet",pack:"5 tablets",stock:14,price:118.00,status:"Low Stock",prescription:true,image:"/assets/medicine-7.svg"},
  {id:8,name:"ORS Orange",generic:"Oral Rehydration Salts",brand:"Electral",category:"Wellness",form:"Sachet",pack:"21g",stock:210,price:24.00,status:"In Stock",prescription:false,image:"/assets/medicine-8.svg"}
];

if (!fs.existsSync(dbFile)) writeJsonFile(dbFile, starter);

function readMedicines() {
  return readJsonFile(dbFile, starter);
}
function writeMedicines(items) {
  writeJsonFile(dbFile, items);
}

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));

function safeCompare(actual, expected) {
  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function getAdminSession(req) {
  const cookie = String(req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(ADMIN_COOKIE + "="));
  if (!cookie) return null;
  let sessionId;
  try {
    sessionId = decodeURIComponent(cookie.slice(ADMIN_COOKIE.length + 1));
  } catch {
    return null;
  }
  const expiresAt = adminSessions.get(sessionId);
  if (!expiresAt || expiresAt <= Date.now()) {
    adminSessions.delete(sessionId);
    return null;
  }
  return sessionId;
}

function requireAdmin(req, res, next) {
  if (!getAdminSession(req)) return res.status(401).json({error:"Administrator sign-in required"});
  next();
}

function setAdminCookie(req, res, sessionId) {
  const secure = req.secure ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ADMIN_SESSION_TTL / 1000}${secure}`);
}

app.get("/api/admin/session", (req, res) => {
  res.json({authenticated:Boolean(getAdminSession(req)), configured:Boolean(ADMIN_USERNAME && ADMIN_PASSWORD)});
});

app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return res.status(503).json({error:"Admin sign-in is not configured. Set MEDICINESTOCK_ADMIN_USERNAME and MEDICINESTOCK_ADMIN_PASSWORD, then restart the server."});
  }
  const {username, password} = req.body || {};
  if (!safeCompare(username || "", ADMIN_USERNAME) || !safeCompare(password || "", ADMIN_PASSWORD)) {
    return res.status(401).json({error:"Invalid administrator username or password"});
  }
  const sessionId = crypto.randomBytes(32).toString("hex");
  adminSessions.set(sessionId, Date.now() + ADMIN_SESSION_TTL);
  setAdminCookie(req, res, sessionId);
  res.json({ok:true});
});

app.post("/api/admin/logout", (req, res) => {
  const sessionId = getAdminSession(req);
  if (sessionId) adminSessions.delete(sessionId);
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${req.secure ? "; Secure" : ""}`);
  res.json({ok:true});
});

app.use("/data", (_, res) => res.sendStatus(404));
app.use(express.static(__dirname));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"))
  }),
  limits: {fileSize: 5 * 1024 * 1024}
});

app.get("/api/medicines", (req,res) => {
  let items = readMedicines();
  const q = String(req.query.q || "").toLowerCase().trim();
  const category = String(req.query.category || "").toLowerCase().trim();
  if (q) items = items.filter(x => [x.name,x.generic,x.brand,x.category].some(v => String(v).toLowerCase().includes(q)));
  if (category && category !== "all") items = items.filter(x => x.category.toLowerCase() === category);
  res.json(items);
});

app.get("/api/stats", (_,res) => {
  const items = readMedicines();
  res.json({
    totalMedicines: items.length,
    totalUnits: items.reduce((s,x)=>s + Number(x.stock||0),0),
    lowStock: items.filter(x => x.stock > 0 && x.stock <= 20).length,
    outOfStock: items.filter(x => x.stock <= 0).length,
    categories: [...new Set(items.map(x=>x.category))].length
  });
});

app.post("/api/medicines", requireAdmin, (req,res) => {
  const items = readMedicines();
  const body = req.body || {};
  const id = Date.now();
  const stock = Number(body.stock || 0);
  const item = {
    id, name: body.name || "Unnamed Medicine", generic: body.generic || "",
    brand: body.brand || "", category: body.category || "Other",
    form: body.form || "Tablet", pack: body.pack || "", stock,
    price: Number(body.price || 0),
    status: stock <= 0 ? "Out of Stock" : stock <= 20 ? "Low Stock" : "In Stock",
    prescription: Boolean(body.prescription),
    image: body.image || "/assets/medicine-default.svg"
  };
  items.push(item);
  writeMedicines(items);
  res.status(201).json(item);
});

app.patch("/api/medicines/:id", requireAdmin, (req,res) => {
  const items = readMedicines();
  const i = items.findIndex(x => String(x.id) === String(req.params.id));
  if (i < 0) return res.status(404).json({error:"Medicine not found"});
  const next = {...items[i], ...req.body};
  if (req.body.stock !== undefined) {
    const stock = Number(req.body.stock);
    next.stock = stock;
    next.status = stock <= 0 ? "Out of Stock" : stock <= 20 ? "Low Stock" : "In Stock";
  }
  items[i] = next;
  writeMedicines(items);
  res.json(next);
});

app.delete("/api/medicines/:id", requireAdmin, (req,res) => {
  const items = readMedicines().filter(x => String(x.id) !== String(req.params.id));
  writeMedicines(items);
  res.json({ok:true});
});

app.post("/api/upload", requireAdmin, upload.single("image"), (req,res) => {
  if (!req.file) return res.status(400).json({error:"No image uploaded"});
  res.json({url:"/uploads/" + req.file.filename});
});

app.post("/api/orders", (req,res) => {
  const orderId = "MS-" + Math.random().toString(36).slice(2,8).toUpperCase();
  const order = {orderId, createdAt:new Date().toISOString(), ...req.body};
  const ordersFile = path.join(DATA_DIR, "orders.json");
  const orders = readJsonFile(ordersFile, []);
  orders.unshift(order);
  writeJsonFile(ordersFile, orders);
  res.status(201).json(order);
});

app.get("/api/orders", requireAdmin, (_,res) => {
  const file = path.join(DATA_DIR, "orders.json");
  res.json(readJsonFile(file, []));
});

if (require.main === module) {
  const url = `http://${PUBLIC_HOST}${PORT === 80 ? "" : `:${PORT}`}`;
  app.listen(PORT, () => console.log(`Macvista Pharmaceuticals Pvt Ltd running at ${url}`));
}

module.exports = { app, readJsonFile, readMedicines, writeMedicines };
