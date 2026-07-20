const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const JOALLM_API_URL = (process.env.JOALLM_API_URL || "http://localhost:3001").replace(/\/$/, "");
const JOALLM_API_KEY = process.env.JOALLM_API_KEY;
const JOALLM_OWNER_USER_ID = process.env.JOALLM_OWNER_USER_ID;
const ENABLE_AUTO_REPLY = process.env.ENABLE_AUTO_REPLY !== "false";

// ==========================================
// Forward to JoaLLM Acquisition Intelligence
// ==========================================
async function forwardToJoaLLM(payload, headers = {}) {
  if (!JOALLM_API_KEY) {
    console.warn("JOALLM_API_KEY not set — skipping Acquisition Intelligence forward");
    return null;
  }

  try {
    const response = await fetch(`${JOALLM_API_URL}/api/acquisition/webhooks/meta`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": JOALLM_API_KEY,
      },
      body: JSON.stringify({
        payload,
        headers,
        ownerUserId: JOALLM_OWNER_USER_ID || undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("JoaLLM forward failed:", response.status, data);
      return null;
    }

    console.log("Forwarded to JoaLLM Acquisition Intelligence:", data);
    return data;
  } catch (error) {
    console.error("JoaLLM forward error:", error);
    return null;
  }
}

// ==========================================
// Auto Reply Function
// ==========================================
async function sendWhatsAppReply(to, message) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.warn("META_ACCESS_TOKEN / META_PHONE_NUMBER_ID missing — skip auto-reply");
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: {
            body: message,
          },
        }),
      }
    );
    const data = await response.json();
    console.log("Auto-reply sent:", data);
  } catch (error) {
    console.error("Auto-reply failed:", error);
  }
}

// ==========================================
// Health Check
// ==========================================
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    service: "ATRISI Meta Webhook Service",
    uptime: process.uptime(),
    joallmForwardConfigured: Boolean(JOALLM_API_KEY),
  });
});

// ==========================================
// Meta Webhook Verification
// ==========================================
app.get("/api/meta/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Webhook verification request received");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verification failed");
  return res.sendStatus(403);
});

// ==========================================
// Receive Meta Events
// ==========================================
app.post("/api/meta/webhook", async (req, res) => {
  try {
    console.log("=================================");
    console.log("META EVENT RECEIVED");
    console.log("=================================");
    console.log(JSON.stringify(req.body, null, 2));

    const body = req.body;

    // Always acknowledge Meta quickly, then process
    // (forward + optional auto-reply happen before response for simplicity in v1)

    await forwardToJoaLLM(body, {
      "user-agent": req.headers["user-agent"],
      "x-hub-signature-256": req.headers["x-hub-signature-256"],
    });

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;

          if (value.messages && ENABLE_AUTO_REPLY) {
            for (const msg of value.messages) {
              const from = msg.from;
              const text = msg.text?.body || "";

              console.log(`Message from ${from}: ${text}`);

              await sendWhatsAppReply(
                from,
                "Hi! Thanks for reaching out to ATRISI. We will get back to you shortly. 🙏"
              );
            }
          }

          if (value.statuses) {
            for (const status of value.statuses) {
              console.log(`Message ${status.id} status: ${status.status}`);
            }
          }
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
});

// ==========================================
// Start Server
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 ATRISI Meta Service running on port ${PORT}`);
  console.log(`   JoaLLM forward: ${JOALLM_API_URL}/api/acquisition/webhooks/meta`);
});
