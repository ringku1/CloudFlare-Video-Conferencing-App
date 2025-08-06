// src/App.tsx - Enhanced version with custom meeting component
import axios from "axios";
import { useEffect, useState } from "react";
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
  useRealtimeKitMeeting,
  useRealtimeKitSelector,
} from "@cloudflare/realtimekit-react";
import "./global.css";
//import CustomMeeting from "./components/CustomMeeting";
//import "./components/CustomMeeting.css";
// import { CustomParticipantMenu } from './components/CustomParticipantMenu';
import { defaultConfig, RtkMeeting } from "@cloudflare/realtimekit-react-ui";
import "./App.css";

// Enhanced interfaces
interface UserSession {
  email: string;
  name: string;
  role: "host" | "participant";
  permissions: string[];
}

interface MeetingConfig {
  id: string;
  title: string;
  hostEmail: string;
  maxParticipants: number;
  recordingEnabled: boolean;
  chatEnabled: boolean;
  createdAt: string;
}

function App() {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [meetingId, setMeetingId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [joined, setJoined] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Enhanced user authentication states
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);

  // Enhanced meeting states
  const [createdMeetingId, setCreatedMeetingId] = useState("");
  const [hostEmail, setHostEmail] = useState("");
  const [meetingConfig, setMeetingConfig] = useState<MeetingConfig | null>(
    null
  );
  const [connectionQuality, setConnectionQuality] = useState<
    "good" | "fair" | "poor"
  >("good");

  // Extract meetingId and hostEmail from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("meetingId");
    const hostEmailFromUrl = params.get("hostEmail");

    if (id) {
      setMeetingId(id);
      // Try to load meeting config from your database
      loadMeetingConfig(id);
    }
    if (hostEmailFromUrl) setHostEmail(decodeURIComponent(hostEmailFromUrl));
  }, []);

  // Enhanced session management
  useEffect(() => {
    const storedSession = localStorage.getItem("realtimekit_user_session");

    if (storedSession) {
      try {
        const session: UserSession = JSON.parse(storedSession);
        setUserEmail(session.email);
        setUserName(session.name);
        setUserSession(session);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Invalid stored session:", error);
        localStorage.removeItem("realtimekit_user_session");
      }
    }
  }, []);

  // update meeting config
  // useEffect(() => {
  //   if (meetingId) {
  //     loadMeetingConfig(meetingId);
  //   }
  //   const config: MeetingConfig = { ...meetingConfig };
  //   setMeetingConfig(config);
  // }, [meetingId]);

  // Load meeting configuration (you can implement this with your database)
  const loadMeetingConfig = async (meetingId: string) => {
    try {
      // This would be your API call to load meeting details
      // const response = await axios.get(`/api/meetings/${meetingId}`);
      // setMeetingConfig(response.data);

      // For now, using localStorage as demo
      const storedConfig = localStorage.getItem(`meeting_config_${meetingId}`);
      if (storedConfig) {
        setMeetingConfig(JSON.parse(storedConfig));
      }
    } catch (error) {
      console.error("Error loading meeting config:", error);
    }
  };

  // Enhanced login with role detection
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!userEmail.trim() || !userName.trim()) {
      setError("Please enter both email and name");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    // Determine user role based on meeting context
    const isHost =
      hostEmail === userEmail.trim() ||
      (meetingId &&
        localStorage.getItem(`meeting_host_${meetingId}`) === userEmail.trim());

    const session: UserSession = {
      email: userEmail.trim(),
      name: userName.trim(),
      role: isHost ? "host" : "participant",
      permissions: isHost
        ? ["present", "record", "moderate", "kick"]
        : ["chat", "view"],
    };

    // Store enhanced session
    localStorage.setItem("realtimekit_user_session", JSON.stringify(session));
    setUserSession(session);
    setIsAuthenticated(true);

    // Track user login
    trackAnalytics("user_login", {
      email: session.email,
      role: session.role,
      meetingId: meetingId || "none",
    });
  }

  function handleLogout() {
    localStorage.removeItem("realtimekit_user_session");
    setIsAuthenticated(false);
    setUserSession(null);
    setUserEmail("");
    setUserName("");
    setJoined(false);
    setAuthToken("");
    setCreatedMeetingId("");
    setInviteLink("");
    setError("");

    // Clear meeting-specific data
    if (meeting) {
      meeting.leave();
    }
  }

  // Enhanced meeting creation with custom configuration
  async function createMeeting() {
    if (!userSession) return;

    setLoading(true);
    setError("");

    try {
      // Create meeting with custom configuration
      const meetingData = {
        title: `${userName}'s Webinar`,
        preferred_region: "ap-south-1",
      };

      const { data: response } = await axios.post(
        "https://192.168.0.128:3001/api/create-meeting",
        meetingData
      );

      const newMeetingId = response.data.id;
      setCreatedMeetingId(newMeetingId);
      setMeetingId(newMeetingId);

      // Store enhanced meeting configuration
      const config: MeetingConfig = {
        id: newMeetingId,
        title: meetingData.title,
        hostEmail: userEmail,
        maxParticipants: 500,
        recordingEnabled: true,
        chatEnabled: true,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(`meeting_host_${newMeetingId}`, userEmail);
      localStorage.setItem(
        `meeting_config_${newMeetingId}`,
        JSON.stringify(config)
      );
      setMeetingConfig(config);

      // Create enhanced invite link
      const encodedEmail = encodeURIComponent(userEmail);
      const url = `${window.location.origin}/?meetingId=${newMeetingId}&hostEmail=${encodedEmail}`;
      setInviteLink(url);

      // Track meeting creation
      trackAnalytics("meeting_created", {
        meetingId: newMeetingId,
        hostEmail: userEmail,
        maxParticipants: config.maxParticipants,
      });

      console.log("Enhanced meeting created:", config);
    } catch (err: any) {
      console.error("Error creating meeting:", err);
      setError(
        err.response?.data?.message ||
          "Failed to create meeting. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // Enhanced meeting joining with better error handling
  async function joinMeeting() {
    if (!meetingId || !userSession) {
      setError("Please enter a meeting ID or create a meeting first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const storedHostEmail = localStorage.getItem(`meeting_host_${meetingId}`);
      const isHost =
        hostEmail === userSession.email ||
        storedHostEmail === userSession.email ||
        createdMeetingId === meetingId;

      const preset = isHost ? "webinar_presenter" : "webinar_viewer";
      const participantName = isHost ? `${userName} (Host)` : userName;

      const participantData = {
        name: participantName,
        preset_name: preset,
        custom_participant_id: `${userSession.email}_${Date.now()}`,
      };

      console.log("Joining with config:", {
        isHost,
        preset,
        participantName,
        userEmail: userSession.email,
        permissions: userSession.permissions,
      });

      const { data: response } = await axios.post(
        `https://192.168.0.128:3001/api/meetings/${meetingId}/participants`,
        participantData
      );

      console.log("Response: ", response);

      setAuthToken(response.data.data.token);
      console.log("AuthToken is: ", authToken);

      trackAnalytics("meeting_joined", {
        meetingId,
        userEmail: userSession.email,
        role: userSession.role,
        isHost,
      });
    } catch (err: any) {
      console.error("Error joining meeting:", err);
      setError(
        err.response?.data?.message ||
          "Failed to join meeting. Please check the meeting ID."
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    async function initializeMeeting() {
      console.log("🔄 Initializing meeting with:", {
        authToken,
        joined,
      });

      // if (!authToken || !userSession || joined) {
      if (!authToken || joined || !userSession) {
        console.log(
          "⛔ Skipping init. Missing prerequisites or already joined."
        );
        return;
      }

      setLoading(true);

      try {
        await initMeeting({
          authToken,
          defaults: {
            audio: false,
            video: false,
          },
        });

        console.log("✅ Meeting initialized, setting joined = true");
        setJoined(true);

        // Track successful initialization
        trackAnalytics("meeting_initialized", {
          meetingId,
          userEmail: userSession.email,
          role: userSession.role,
        });
      } catch (err) {
        console.error("❌ Error initializing meeting:", err);
        setError("Failed to initialize meeting. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    initializeMeeting();
  }, [authToken, joined, initMeeting]);

  // Connection quality monitoring
  useEffect(() => {
    console.log("Quality monitoring...");

    if (!meeting || !joined) return;

    const monitorConnection = () => {
      // Monitor connection quality (you can enhance this with actual metrics)
      const checkQuality = () => {
        // This is a simplified example - you'd implement actual network monitoring
        const connection = (navigator as any).connection;
        if (connection) {
          const { effectiveType, downlink } = connection;
          if (effectiveType === "4g" && downlink > 10) {
            setConnectionQuality("good");
          } else if (effectiveType === "3g" || downlink > 2) {
            setConnectionQuality("fair");
          } else {
            setConnectionQuality("poor");
          }
        }
      };

      checkQuality();
      const interval = setInterval(checkQuality, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    };

    const cleanup = monitorConnection();
    return cleanup;
  }, [meeting, joined]);

  // Analytics helper function
  const trackAnalytics = (eventName: string, data: any) => {
    console.log(`Analytics: ${eventName}`, data);
    // Here you would send to your analytics service
    // analytics.track(eventName, data);
  };

  // Check if current user is the creator/host
  const isCreator =
    (createdMeetingId && createdMeetingId === meetingId) ||
    (meetingId &&
      localStorage.getItem(`meeting_host_${meetingId}`) === userEmail) ||
    hostEmail === userEmail;
  console.log("isCreator: ", isCreator);

  // Enhanced loading states
  if (loading) {
    console.log("Loading...");

    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Please wait...</p>
      </div>
    );
  }

  console.log("isAuthenticated: ", isAuthenticated);

  // Login screen with enhanced error handling
  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Sign In to Join Webinar</h2>

          {error && <div className="error-message">{error}</div>}

          {meetingConfig && (
            <div className="meeting-preview">
              <h3>You're joining:</h3>
              <p>
                <strong>{meetingConfig.title}</strong>
              </p>
              <p>Host: {meetingConfig.hostEmail}</p>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Enter your email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              required
              disabled={loading}
              className="auth-input"
            />

            <input
              type="text"
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              disabled={loading}
              className="auth-input"
            />

            <button type="submit" disabled={loading} className="auth-button">
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <p className="auth-help">
            Your email will be used to identify you as the meeting host
          </p>
        </div>
      </div>
    );
  }
  console.log("Returning main meeting interface.");
  console.log("Joined: ", joined);
  console.log("Meeting: ", meeting);

  function stopScreenShare() {
    if (!meeting) return;
    meeting.self.disableScreenShare();
  }

  // Main meeting interface with enhanced features
  return (
    <div className="app-container">
      {!joined && (
        <div className="meeting-setup">
          <div className="setup-card">
            {/* Enhanced user info header */}
            <div className="user-header">
              <div className="user-info">
                <p className="user-name">{userName}</p>
                <p className="user-email">{userEmail}</p>
                <span className={`user-role ${userSession?.role}`}>
                  {userSession?.role === "host" ? "👑 Presenter" : "👤 viewer"}
                </span>
              </div>
              <div className="header-actions">
                <div className={`connection-indicator ${connectionQuality}`}>
                  Connection: {connectionQuality}
                </div>
                <button onClick={handleLogout} className="logout-button">
                  Sign Out
                </button>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <h2>Appifylab Webinar Platform</h2>

            {/* Enhanced Create Meeting Section */}
            <div className="section">
              {/* <h3>Create New Webinar</h3> */}
              <button
                onClick={createMeeting}
                disabled={loading}
                className="primary-button"
              >
                {loading ? "Creating..." : "Create Webinar"}
              </button>

              {inviteLink && (
                <div className="success-panel">
                  <p className="success-title">
                    Webinar Created Successfully! 🎉
                  </p>
                  <div className="meeting-details">
                    <p>
                      <strong>Meeting ID:</strong> {createdMeetingId}
                    </p>
                    <p>
                      <strong>Host:</strong> {userEmail}
                    </p>
                    <p>
                      <strong>Recording:</strong>{" "}
                      {meetingConfig?.recordingEnabled ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <div className="invite-section">
                    <p>
                      <strong>Invite Link:</strong>
                    </p>
                    <div className="invite-link">
                      <a
                        href={inviteLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {inviteLink}
                      </a>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(inviteLink)}
                      className="copy-button"
                    >
                      📋 Copy Link
                    </button>
                  </div>
                  <p className="invite-help">
                    Share this link with participants. Only you ({userEmail})
                    will join as the host.
                  </p>
                </div>
              )}
            </div>

            <hr className="divider" />

            {/* Enhanced Join Meeting Section */}
            <div className="section">
              {/* <h3>Join Existing Webinar</h3> */}
              <input
                placeholder="Enter Meeting ID"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                disabled={loading}
                className="meeting-input"
              />

              <button
                onClick={joinMeeting}
                disabled={!meetingId || loading}
                className="secondary-button"
              >
                {loading ? "Joining..." : "Join Existing Webinar"}
              </button>

              {meetingId && (
                <div className="join-preview">
                  {isCreator ? (
                    <p className="host-indicator">
                      ✓ You will join as the <strong>host/presenter</strong>{" "}
                      (your webinar)
                    </p>
                  ) : (
                    <div className="participant-indicator">
                      <p>
                        You will join as a <strong>viewer</strong>
                      </p>
                      {hostEmail && (
                        <p className="host-info">Meeting host: {hostEmail}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {joined && meeting && (
        <RealtimeKitProvider value={meeting}>
          <RtkMeeting
            meeting={meeting}
            config={defaultConfig}
            // mode='fill'
          />
          <button onClick={stopScreenShare}>Stop Screen Share</button>
        </RealtimeKitProvider>
      )}
    </div>
  );
}

export default App;
