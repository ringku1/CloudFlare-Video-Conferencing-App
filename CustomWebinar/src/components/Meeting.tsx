import { setFullScreenToggleTargetElement } from "../utils";
import { useRealtimeKitMeeting } from "@cloudflare/realtimekit-react";
import { useEffect, useState } from "react";
import { CustomStates } from "../types";
import CustomRtkMeeting from "./custom-rtk-meeting";
import {
  defaultConfig,
  generateConfig,
} from "@cloudflare/realtimekit-react-ui";
import { RtkStateListenersUtils } from "../rtk-state-listeners";

function Meeting() {
  const { meeting } = useRealtimeKitMeeting();
  const [config, setConfig] = useState(defaultConfig);
  const [states, setStates] = useState<CustomStates>({
    meeting: "setup",
    sidebar: "chat",
  });

  useEffect(() => {
    async function setupMeetingConfigs() {
      const theme = meeting!.self.config;
      const { config } = generateConfig(theme, meeting!);

      /**
       * NOTE:
       * Full screen by default requests rtk-meeting/RtkMeeting element to be in full screen.
       * Since RtkMeeting element is not here,
       *  we need to pass rtk-fullscreen-toggle, an targetElementId through config.
       */
      setFullScreenToggleTargetElement({ config, targetElementId: "root" });

      setConfig({ ...config });

      /**
       * NOTE:
       * Add listeners on meeting & self to monitor leave meeting, join meeting and so on.
       * This work was earlier done by RtkMeeting component internally.
       */
      const stateListenersUtils = new RtkStateListenersUtils(
        () => meeting,
        () => states,
        () => setStates
      );
      stateListenersUtils.addRtkEventListeners();
    }
    if (meeting) {
      /**
       * NOTE:
       * During development phase, make sure to expose meeting object to window,
       * for debugging purposes.
       */
      Object.assign(window, {
        meeting,
      });
      setupMeetingConfigs();
    }
  }, [meeting]);

  return (
    <CustomRtkMeeting
      meeting={meeting}
      config={config}
      states={states}
      setStates={setStates}
    />
  );
}

export default Meeting;
