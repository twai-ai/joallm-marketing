const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

// ==========================================
// Auto Reply Function
// ==========================================
async function sendWhatsAppReply(to, message) {
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

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;

          // Incoming messages
          if (value.messages) {
            for (const msg of value.messages) {
              const from = msg.from;
              const text = msg.text?.body || "";

              console.log(`Message from ${from}: ${text}`);

              // Auto-reply
              await sendWhatsAppReply(
                from,
                "Hi! Thanks for reaching out to ATRISI. We will get back to you shortly. 🙏"
              );
            }
          }

          // Message status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              console.log(`Message ${status.id} status: ${status.status}`);
            }
          }
        }
      }
    }

    // Future:
    // Save to database
    // Forward to ATRISI CRM
    // Trigger AI assistant
    // Analytics

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
});
