import * as net from "net";

export const checkPrinterConnection = (ipAddress: string, port: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    // Check if ipAddress and port are valid
    if (!ipAddress || !port) {
      reject("Invalid ipAddress or port");
      return;
    }

    const client = new net.Socket();
    client.setTimeout(1000); // Timeout after 1 second

    client.connect(port, ipAddress, () => {
      client.destroy(); // Destroy socket after successful connection
      resolve(true); // Printer is connected
    });

    client.on("error", (err) => {
      client.destroy();
      resolve(false); // Printer is not connected
    });

    client.on("timeout", () => {
      client.destroy();
      resolve(false); // Printer is not connected due to timeout
    });
  });
};