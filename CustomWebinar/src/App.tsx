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
      //const searchParams = new URL(window.location.href).searchParams;
      //const authToken = searchParams.get("authToken");
      //use the Auth token directly rather extracting from the URL

      const authToken =
        "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdJZCI6IjRkMzhjZWRkLWVkZjItNDk3Ny04ZWFjLWI3MzNjZmI2OThiMCIsIm1lZXRpbmdJZCI6ImJiYmQyOTlmLWEwYjQtNDAwOC04MTQ5LTQxOGJjMDViZDUyMiIsInBhcnRpY2lwYW50SWQiOiJhYWFiY2NjYy04MzQ3LTQ3YWQtOWIyNC0yOWIyMmMwOWM5MzciLCJwcmVzZXRJZCI6IjBjZmZhYWQ5LWYwZjYtNDMzYS05Zjg5LTRjYTE0ZTUxNDRhNiIsImlhdCI6MTc1MzQyMTMzOSwiZXhwIjoxNzYyMDYxMzM5fQ.kM3sTZVDrcDtsUn2RW4p5qI6qTXxoJ3Qj-2m2SBRZmdx8QW8giqqcZ9VrMJgq0U3PcSJ6ylEu6npH-GRKsqzui5q2o-M8WejYAHy1gc0LIkbzFDOH9U_0l8-XG2lPmkwJ4c5b-qxSRR8jzNdBtowP14ZTXZKshLAJ9s3lLC1LbOskv9W4U6OgFVgqLtvHB3ltDz4foGns0PEhKDjcn0N64K-fHgeFIKfaydubhZZKThqDTVk1jcOZAvIyXdaC9TNJnjBY51nYhb2lOF6UxrmOmId7qOjp5CXKVaJR92t-17wYKP2QhtgMsqnj6lidD1bAOiqGE1J_FArkpaN_L3PdQ";

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
