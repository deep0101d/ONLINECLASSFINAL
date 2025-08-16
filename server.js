import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const app = express();
app.use(express.json());

/* ------------------ CORS ------------------ */
const allow = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allow.length === 0 || allow.includes(origin)) return cb(null, true);
    return cb(null, false); // block unknown origins in prod
  }
}));

/* ------------------ TWILIO TOKEN ------------------ */
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  PORT = 4000,
} = process.env;

const AccessToken = twilio.jwt.AccessToken;
const { VideoGrant } = AccessToken;

app.get("/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.get("/token", (req, res) => {
  const identity = (req.query.identity || "guest").toString().slice(0, 64);
  const room = (req.query.room || "lobby").toString().slice(0, 128);

  const token = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET,
    { ttl: 3600, identity }   // ✅ identity passed here
  );

  token.addGrant(new VideoGrant({ room }));

  res.json({ token: token.toJwt(), identity, room });
});
/* ------------------ SIMPLE CLASS SCHEDULING ------------------ */
// In-memory store for demo. Replace with DB in prod.
let classes = [
  { id: 1, title: "Algebra 101", roomName: "algebra-101", when: new Date(Date.now() + 3600_000).toISOString(), createdBy: "teacher@example.com" }
];
let nextId = 2;

app.get("/classes", (_req, res) => {
  res.json(classes.sort((a, b) => new Date(a.when) - new Date(b.when)));
});

app.post("/classes", (req, res) => {
  const { title, roomName, when, createdBy } = req.body || {};
  if (!title || !roomName || !when) {
    return res.status(400).json({ error: "Missing title, roomName or when" });
  }
  const item = { id: nextId++, title, roomName, when, createdBy: createdBy || "unknown" };
  classes.push(item);
  res.json(item);
});

/* ------------------ ATTENDANCE LOGGING ------------------ */


/* ------------------ ATTENDANCE LOGGING ------------------ */
// Instead of free-text username, use STD_ID from EDU_STUDENT_DETAILS
const attendance = []; // for now still in-memory (replace with DB INSERT in real Oracle APEX)

app.post("/attendance", (req, res) => {
  const { classId, roomName, stdId, event } = req.body || {};

  if (!stdId) {
    return res.status(400).json({ error: "STD_ID is required" });
  }

  attendance.push({
    ts: new Date().toISOString(),
    classId: Number(classId) || null,
    roomName: roomName || null,
    stdId: Number(stdId),
    event: event || "join"
  });

  res.json({ ok: true });
});

app.get("/attendance", (_req, res) => {
  res.json(attendance.slice(-500));
});

/* ------------------ OPTIONAL: Twilio Webhooks ------------------ */
// app.post("/twilio/webhook", (req, res) => {
//   console.log("Twilio webhook event:", req.body);
//   res.sendStatus(204);
// });

/* ------------------ START SERVER ------------------ */
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
