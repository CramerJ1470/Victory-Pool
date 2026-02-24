import { Redis } from "@upstash/redis";
import { ethers } from "ethers";

const REDIS_URL = import.meta.env.REDIS_URL;
const REDIS_TOKEN = import.meta.env.REDIS_TOKEN;
const ADMIN_WALLET = import.meta.env.ADMIN_WALLET;

const redis = new Redis({
  url: REDIS_URL,
  token: REDIS_TOKEN,
});

/* =========================
   ADMIN SIGNATURE
========================= */

async function verifyAdmin(req) {
  const { message, signature } = req.body;
  if (!message || !signature) return false;

  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === ADMIN_WALLET.toLowerCase();
  } catch {
    return false;
  }
}

/* =========================
   HELPERS
========================= */

function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidTxHash(hash) {
  return /^0x([A-Fa-f0-9]{64})$/.test(hash);
}

/* =========================
   HANDLER
========================= */

export default async function handler(req, res) {
  try {
    if (req.method === "POST") return createMatch(req, res);
    if (req.method === "GET") return getMatches(req, res);
    if (req.method === "PATCH") return updateSettlement(req, res);
    if (req.method === "DELETE") return deleteMatch(req, res);

    return res.status(405).json({ message: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   CREATE MATCH
========================= */

async function createMatch(req, res) {
  if (!(await verifyAdmin(req)))
    return res.status(401).json({ message: "Unauthorized" });

  const { matchId, matchAddress, teams } = req.body;
  if (!matchId || !matchAddress || !teams || teams.length !== 2)
    return res.status(400).json({ message: "Invalid input" });

  if (!isValidAddress(matchAddress))
    return res.status(400).json({ message: "Invalid match address" });

  const key = `match:${matchId}`;
  const exists = await redis.exists(key);
  if (exists) return res.status(409).json({ message: "Match exists" });

  const match = {
    matchId,
    matchAddress,
    requestSettlementHash: null,
    teams,
    settled: false,
    createdAt: Date.now(),
  };

  await redis.set(key, match);
  await redis.zadd("matches:index", {
    score: match.createdAt,
    member: matchId,
  });
  await redis.zadd("matches:unsettled:index", {
    score: match.createdAt,
    member: matchId,
  });

  return res.status(201).json(match);
}

/* =========================
   GET MATCHES
========================= */

async function getMatches(req, res) {
  const { status, page = 1, limit = 20 } = req.query;
  const start = (page - 1) * limit;
  const end = start + Number(limit) - 1;

  let index = "matches:index";
  if (status === "settled") index = "matches:settled:index";
  if (status === "unsettled") index = "matches:unsettled:index";

  const ids = await redis.zrange(index, start, end, { rev: true });
  const matches = await Promise.all(ids.map((id) => redis.get(`match:${id}`)));
  return res.status(200).json(matches);
}

/* =========================
   UPDATE SETTLEMENT
========================= */

async function updateSettlement(req, res) {
  if (!(await verifyAdmin(req)))
    return res.status(401).json({ message: "Unauthorized" });

  const { matchId, requestSettlementHash } = req.body;
  if (!matchId || !requestSettlementHash)
    return res.status(400).json({ message: "Missing fields" });

  if (!isValidTxHash(requestSettlementHash))
    return res.status(400).json({ message: "Invalid tx hash" });

  const key = `match:${matchId}`;
  const match = await redis.get(key);
  if (!match) return res.status(404).json({ message: "Match not found" });
  if (match.settled)
    return res.status(400).json({ message: "Already settled" });

  match.requestSettlementHash = requestSettlementHash;
  match.settled = true;
  match.updatedAt = Date.now();

  await redis.set(key, match);
  await redis.zrem("matches:unsettled:index", matchId);
  await redis.zadd("matches:settled:index", {
    score: match.updatedAt,
    member: matchId,
  });

  return res.status(200).json(match);
}

/* =========================
   DELETE MATCH
========================= */

async function deleteMatch(req, res) {
  if (!(await verifyAdmin(req)))
    return res.status(401).json({ message: "Unauthorized" });

  const { matchId } = req.body;
  if (!matchId) return res.status(400).json({ message: "Missing matchId" });

  const key = `match:${matchId}`;
  const match = await redis.get(key);
  if (!match) return res.status(404).json({ message: "Match not found" });

  await redis.del(key);
  await redis.zrem("matches:index", matchId);
  await redis.zrem("matches:unsettled:index", matchId);
  await redis.zrem("matches:settled:index", matchId);

  return res.status(200).json({ message: "Deleted" });
}
