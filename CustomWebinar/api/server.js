// api/enhanced-server.js
import express from "express";
import axios from "axios";
import cors from "cors";
import https from "https";
import fs from "fs";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import compression from "compression";

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://rtk.realtime.cloudflare.com",
          "wss://rtk.realtime.cloudflare.com",
        ],
        mediaSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseSrc: ["'self'"],
      },
    },
  })
);

// Compression for better performance
app.use(compression());

// Enhanced CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://yourdomain.com", "https://www.yourdomain.com"]
        : [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5173",
            "https://localhost:5173",
            "https://192.168.0.128:5173",
          ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;

// Environment variables (use .env file in production)
const CF_AUTH_HEADER =
  process.env.CF_AUTH_HEADER ||
  "Basic NGQzOGNlZGQtZWRmMi00OTc3LThlYWMtYjczM2NmYjY5OGIwOjY2ZjFlY2EzMTUyMmRiNzBiNmQ0";
const CF_API_BASE = "https://rtk.realtime.cloudflare.com/v2";
console.log("CF_AUTH_HEADER: ", CF_AUTH_HEADER);

// Rate limiting configuration
const createMeetingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 meeting creations per windowMs
  message: {
    error:
      "Too many meetings created from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const joinMeetingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 join attempts per minute
  message: {
    error:
      "Too many join attempts from this IP, please try again after 1 minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// HTTPS server options
const httpsOptions = {
  key: fs.readFileSync("./cert/key.pem"),
  cert: fs.readFileSync("./cert/cert.pem"),
};

// In-memory cache for meeting metadata (use Redis in production)
const meetingCache = new Map();

// Enhanced logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip}`);
  next();
});

// Validation middleware
const validateMeetingData = (req, res, next) => {
  const { title } = req.body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({
      error: "Meeting title is required and must be a non-empty string",
    });
  }

  if (title.length > 100) {
    return res.status(400).json({
      error: "Meeting title must be less than 100 characters",
    });
  }

  next();
};

const validateParticipantData = (req, res, next) => {
  const { name, preset_name } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      error: "Participant name is required and must be a non-empty string",
    });
  }

  if (name.length > 50) {
    return res.status(400).json({
      error: "Participant name must be less than 50 characters",
    });
  }

  const validPresets = ["webinar_presenter", "webinar_viewer"];
  if (!preset_name || !validPresets.includes(preset_name)) {
    return res.status(400).json({
      error:
        "Invalid preset. Must be either webinar_presenter or webinar_viewer",
    });
  }

  next();
};

// Enhanced meeting creation endpoint
app.post(
  "/api/create-meeting",
  createMeetingLimiter,
  validateMeetingData,
  async (req, res) => {
    try {
      const startTime = Date.now();

      // Enhanced meeting configuration
      const meetingData = {
        title: req.body.title.trim(),
        preferred_region: req.body.preferred_region || "ap-south-1",
      };

      const response = await axios.post(
        `${CF_API_BASE}/meetings`,
        meetingData,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: CF_AUTH_HEADER,
            "User-Agent": "Custom-Webinar-Platform/1.0",
          },
          timeout: 30000, // 30 second timeout
        }
      );

      const meeting = response.data;
      const endTime = Date.now();

      // Cache meeting metadata
      meetingCache.set(meeting.data.id, {
        ...meetingData,
        id: meeting.data.id,
        created_at: new Date().toISOString(),
        created_by_ip: req.ip,
        participants_count: 0,
      });

      // Log successful creation
      console.log(
        `Meeting created successfully: ${meeting.data.id} (${endTime - startTime}ms)`
      );

      // Enhanced response with additional metadata
      res.json({
        ...meeting,
        metadata: {
          creation_time_ms: endTime - startTime,
          cached: true,
          rate_limit_remaining: res.get("X-RateLimit-Remaining"),
        },
      });
    } catch (err) {
      console.error(
        "Meeting creation error:",
        err.response?.data || err.message
      );

      // Enhanced error handling
      if (err.code === "ECONNABORTED") {
        return res.status(408).json({
          error: "Request timeout. Please try again.",
          code: "TIMEOUT",
        });
      }

      if (err.response?.status === 429) {
        return res.status(429).json({
          error:
            "Rate limit exceeded on CloudFlare API. Please try again later.",
          code: "RATE_LIMITED",
        });
      }

      if (err.response?.status >= 400 && err.response?.status < 500) {
        return res.status(err.response.status).json({
          error:
            err.response.data?.message || "Invalid request to CloudFlare API",
          code: "CLIENT_ERROR",
        });
      }

      res.status(500).json({
        error: "Failed to create meeting. Please try again.",
        code: "SERVER_ERROR",
      });
    }
  }
);

// Enhanced participant joining endpoint
app.post("/api/meetings/:meetingId/participants", async (req, res) => {
  try {
    const { meetingId } = req.params;

    const participantData = {
      name: req.body.name.trim(),
      preset_name: req.body.preset_name,
      custom_participant_id:
        req.body.custom_participant_id || `participant_${Date.now()}`,
    };

    // Optional: log or store metadata separately (not sent to Cloudflare)
    const metadata = {
      join_time: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
      referrer: req.get("Referer"),
      session_id: req.body.session_id || null,
      role: req.body.preset_name === "webinar_presenter" ? "host" : "viewer",
    };

    console.log("Participant Metadata (not sent to API):", metadata);

    const cloudflareResponse = await axios.post(
      `${CF_API_BASE}/meetings/${meetingId}/participants`,
      participantData,
      {
        // headers: {
        //   Authorization: `Bearer ${process.env.CLOUDFLARE_RTK_API_TOKEN}`,
        //   'Content-Type': 'application/json'
        // }
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: CF_AUTH_HEADER,
        },
      }
    );

    res.json({ success: true, data: cloudflareResponse.data });
  } catch (err) {
    console.error("Participant join error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data?.message || "Internal Server Error",
    });
  }
});

app.post(
  "/api/meetings/:meetingId/participants",
  joinMeetingLimiter,
  validateParticipantData,
  async (req, res) => {
    const { meetingId } = req.params;
    const startTime = Date.now();

    // Validate meeting ID format
    if (!meetingId || typeof meetingId !== "string" || meetingId.length < 10) {
      return res.status(400).json({
        error: "Invalid meeting ID format",
        code: "INVALID_MEETING_ID",
      });
    }

    try {
      const name = req.body.name?.trim();
      const preset_name = req.body.preset_name;
      const custom_participant_id =
        req.body.custom_participant_id || `participant_${Date.now()}`;

      const picture = req.body.picture || null; // optional: e.g. gravatar or profile image

      const requestBody = {
        name,
        preset_name,
        custom_participant_id,
      };

      if (picture) requestBody.picture = picture;

      // Check meeting cache for additional validation
      const cachedMeeting = meetingCache.get(meetingId);
      if (cachedMeeting) {
        cachedMeeting.participants_count += 1;

        if (cachedMeeting.participants_count > cachedMeeting.max_participants) {
          return res.status(429).json({
            error: "Meeting has reached maximum participant limit",
            code: "PARTICIPANT_LIMIT_EXCEEDED",
            max_participants: cachedMeeting.max_participants,
          });
        }
      }

      // ⚠️ Only required fields sent, as Cloudflare rejects unknown fields like metadata
      const response = await axios.request({
        method: "POST",
        url: `${CF_API_BASE}/meetings/${meetingId}/participants`,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: CF_AUTH_HEADER,
          "User-Agent": "Custom-Webinar-Platform/1.0",
        },
        data: requestBody,
        timeout: 20000,
      });

      const endTime = Date.now();
      console.log(
        `✅ Participant joined: ${name} -> ${meetingId} (${endTime - startTime}ms)`
      );

      res.json({
        ...response.data,
        metadata: {
          join_time_ms: endTime - startTime,
          participant_count: cachedMeeting?.participants_count || null,
          rate_limit_remaining: res.get("X-RateLimit-Remaining"),
        },
      });
    } catch (error) {
      const cachedMeeting = meetingCache.get(meetingId);
      if (cachedMeeting) {
        cachedMeeting.participants_count = Math.max(
          0,
          cachedMeeting.participants_count - 1
        );
      }

      console.error(
        "❌ Participant join error:",
        error.response?.data || error.message
      );

      if (error.code === "ECONNABORTED") {
        return res.status(408).json({
          error: "Request timeout. Please try again.",
          code: "TIMEOUT",
        });
      }

      if (error.response?.status === 404) {
        return res.status(404).json({
          error: "Meeting not found. Please check the meeting ID.",
          code: "MEETING_NOT_FOUND",
        });
      }

      if (error.response?.status === 429) {
        return res.status(429).json({
          error: "Rate limit exceeded. Please try again later.",
          code: "RATE_LIMITED",
        });
      }

      if (error.response?.status >= 400 && error.response?.status < 500) {
        return res.status(error.response.status).json({
          error: error.response.data?.message || "Invalid request",
          code: "CLIENT_ERROR",
        });
      }

      res.status(500).json({
        error: "Failed to join meeting. Please try again.",
        code: "SERVER_ERROR",
      });
    }
  }
);
// Enhanced meeting info endpoint
app.get("/api/meetings/:meetingId", async (req, res) => {
  const { meetingId } = req.params;

  try {
    // First check cache
    const cachedMeeting = meetingCache.get(meetingId);
    if (cachedMeeting) {
      return res.json({
        meeting: cachedMeeting,
        cached: true,
      });
    }

    // Fetch from CloudFlare API if not cached
    const response = await axios.get(`${CF_API_BASE}/meetings/${meetingId}`, {
      headers: {
        Authorization: CF_AUTH_HEADER,
        Accept: "application/json",
      },
      timeout: 10000,
    });

    res.json({
      meeting: response.data,
      cached: false,
    });
  } catch (error) {
    console.error("Meeting info error:", error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({
        error: "Meeting not found",
        code: "MEETING_NOT_FOUND",
      });
    }

    res.status(500).json({
      error: "Failed to fetch meeting information",
      code: "SERVER_ERROR",
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cached_meetings: meetingCache.size,
  });
});

// Analytics endpoint (for your custom analytics)
app.post("/api/analytics", (req, res) => {
  const { event, data } = req.body;

  // Log analytics event (you can enhance this to send to your analytics service)
  console.log(`Analytics Event: ${event}`, {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    ...data,
  });

  res.json({ received: true });
});

// Webhook endpoint for CloudFlare callbacks
app.post(
  "/api/webhooks/cloudflare",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const event = JSON.parse(req.body);

      console.log("CloudFlare Webhook:", event);

      // Handle different webhook events
      switch (event.event) {
        case "meeting.started":
          console.log(`Meeting started: ${event.meetingId}`);
          break;
        case "meeting.ended":
          console.log(`Meeting ended: ${event.meetingId}`);
          // Clean up cache
          meetingCache.delete(event.meetingId);
          break;
        case "participant.joined":
          console.log(
            `Participant joined: ${event.participantName} in ${event.meetingId}`
          );
          break;
        case "participant.left":
          console.log(
            `Participant left: ${event.participantName} from ${event.meetingId}`
          );
          // Update participant count
          const meeting = meetingCache.get(event.meetingId);
          if (meeting) {
            meeting.participants_count = Math.max(
              0,
              meeting.participants_count - 1
            );
          }
          break;
        case "recording.started":
          console.log(`Recording started for meeting: ${event.meetingId}`);
          break;
        case "recording.stopped":
          console.log(`Recording stopped for meeting: ${event.meetingId}`);
          break;
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ error: "Invalid webhook payload" });
    }
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    code: "NOT_FOUND",
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Start HTTPS server
const server = https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`🔐 Enhanced HTTPS Server running at https://localhost:${PORT}`);
  console.log(`🛡️  Security: Helmet enabled`);
  console.log(`⚡ Compression: Enabled`);
  console.log(`🚦 Rate Limiting: Active`);
  console.log(`📊 Analytics: Enabled`);
  console.log(`🎯 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
