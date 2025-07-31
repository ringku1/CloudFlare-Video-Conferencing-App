import { useEffect } from "react";
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from "@cloudflare/realtimekit-react";
import "./global.css";
import Meeting from "./components/Meeting";

function App() {
  const [meeting, initMeeting] = useRealtimeKitClient();

  useEffect(() => {
    async function initalizeMeeting() {
      const searchParams = new URL(window.location.href).searchParams;

      const authToken = searchParams.get("authToken");

      if (!authToken) {
        alert(
          "An authToken wasn't passed, please pass an authToken in the URL query to join a meeting."
        );
        return;
      }

      const meeting = await initMeeting({
        authToken,
        defaults: {
          audio: false,
          video: false,
        },
        modules: { devTools: { logs: true } },
      });

      // await meeting!.joinRoom();
    }

    if (!meeting) {
      initalizeMeeting();
    }
  }, [meeting]);

  // By default this component will cover the entire viewport.
  // To avoid that and to make it fill a parent container, pass the prop:
  // `mode="fill"` to the component.
  return (
    <RealtimeKitProvider value={meeting}>
      <Meeting />
    </RealtimeKitProvider>
  );
}

export default App;
