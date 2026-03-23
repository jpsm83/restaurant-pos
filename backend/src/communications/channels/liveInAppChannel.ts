import type { FastifyBaseLogger } from "fastify";
import liveConnectionRegistry from "../live/connectionRegistry.ts";
import type { CommunicationsChannelResult, LiveInAppSendInput } from "../types.ts";

const send = async (
  payload: LiveInAppSendInput,
  logger?: FastifyBaseLogger
): Promise<CommunicationsChannelResult> => {
  try {
    const { deliveredSockets, targetUsers } = liveConnectionRegistry.pushToUserIds(
      payload,
      logger
    );

    return {
      channel: "liveInApp",
      success: true,
      sentCount: deliveredSockets,
      deliveryMode: "livePush",
      error:
        deliveredSockets === 0 && targetUsers > 0
          ? "No active WebSocket connections for recipients"
          : undefined,
    };
  } catch (error) {
    return {
      channel: "liveInApp",
      success: false,
      sentCount: 0,
      deliveryMode: "livePush",
      error: error instanceof Error ? error.message : "Unknown live push error",
    };
  }
};

const liveInAppChannel = { send };

export default liveInAppChannel;

