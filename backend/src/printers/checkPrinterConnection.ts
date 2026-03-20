import * as net from "net";

const checkPrinterConnection = (
  ipAddress: string,
  port: number
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!ipAddress || !port) {
      reject("Invalid ipAddress or port");
      return;
    }

    const client = new net.Socket();
    client.setTimeout(1000);

    client.connect(port, ipAddress, () => {
      client.destroy();
      resolve(true);
    });

    client.on("error", () => {
      client.destroy();
      resolve(false);
    });

    client.on("timeout", () => {
      client.destroy();
      resolve(false);
    });
  });
};

export default checkPrinterConnection;