import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy Google GenAI instance
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// Gemini Grasp & Teleoperation Supervisor Endpoint
app.post("/api/gemini/analyze-grip", async (req, res) => {
  try {
    const { leftHand, rightHand, graspSummary, imageBase64 } = req.body;

    const ai = getAIClient();

    const prompt = `Act as an expert robotic teleoperation supervisor. Analyze the following real-time bimanual hand kinematic state and provide supervisory safety and grasp stability feedback.

Telemetry Data:
- Left Hand State: ${JSON.stringify(leftHand || "Not detected")}
- Right Hand State: ${JSON.stringify(rightHand || "Not detected")}
- Context Note: ${graspSummary || "General teleoperation active"}

Evaluate:
1. Grasp Stability: Is the grip firm, loose, or at slip risk?
2. Pinch Precision: Tip-to-tip pinch aperture rating.
3. Servo Strain / Overextension risk: Any joint nearing 100% mechanical strain?
4. Recommended Assistive Action: e.g. "Maintain grip", "Reduce index pressure", "Auto-lock pinch", "Emergency clamp".

Respond in JSON format conforming to this structure:
{
  "leftStatus": { "graspType": "string", "stabilityScore": 0-100, "overextensionRisk": false, "notes": "string" },
  "rightStatus": { "graspType": "string", "stabilityScore": 0-100, "overextensionRisk": false, "notes": "string" },
  "overallAssessment": "string",
  "recommendedAction": "string",
  "safetyWarning": null | "string"
}`;

    let contents: any = prompt;
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      contents = {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: prompt },
        ],
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        responseMimeType: "application/json",
      },
    });

    const rawText = response.text || "{}";
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { raw: rawText };
    }

    res.json({ success: true, analysis: parsed });
  } catch (error: any) {
    console.error("Error analyzing grip with Gemini:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze grip state with Gemini.",
    });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket Server for Real-Time Teleoperation
const wss = new WebSocketServer({ server, path: "/ws/telemetry" });
const clients = new Set<WebSocket>();

wss.on("connection", (ws, req) => {
  clients.add(ws);

  ws.send(
    JSON.stringify({
      type: "SYSTEM_CONNECTED",
      msg: "Connected to Bimanual Teleoperation WebSocket Hub",
      ts: Date.now() / 1000,
    })
  );

  ws.on("message", (data) => {
    try {
      const messageStr = data.toString();
      // Broadcast to other connected nodes (e.g. ESP32, Python test client, or web simulator)
      for (const client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      }
    } catch (err) {
      console.error("WS error handling message:", err);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error("WS Client error:", err);
    clients.delete(ws);
  });
});

// Setup Vite middleware or static serving
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Teleoperation Server] Running at http://0.0.0.0:${PORT}`);
  });
}

start();
