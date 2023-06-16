import { request as httpRequest, Agent } from "http";
import { IncomingMessage, ServerResponse } from "http";

// this is exactly what the firebase-tools do:
export function realSimpleProxy(nextServerHost: string) {
  const agent = new Agent({ keepAlive: true });
  // If the path is a the auth token sync URL pass through to Cloud Functions
  const firebaseDefaultsJSON = process.env.__FIREBASE_DEFAULTS__;
  const authTokenSyncURL: string | undefined =
    firebaseDefaultsJSON && JSON.parse(firebaseDefaultsJSON)._authTokenSyncURL;
  return async (originalReq: IncomingMessage, originalRes: ServerResponse, next: () => void) => {
    const { method, headers, url: path } = originalReq;
    if (!method || !path) {
      originalRes.end();
      return;
    }
    if (path === authTokenSyncURL) {
      return next();
    }

    const { hostname, port, protocol, username, password } = new URL(nextServerHost);
    const host = `${hostname}:${port}`;
    const auth = username || password ? `${username}:${password}` : undefined;
    const opts = {
      agent,
      auth,
      protocol,
      hostname,
      port,
      path,
      method,
      headers: {
        ...headers,
        host,
        "X-Forwarded-Host": headers.host,
      },
    };
    const req = httpRequest(opts, (response) => {
      const { statusCode, statusMessage, headers } = response;
      if (statusCode === 404) {
        next();
      } else {
        originalRes.writeHead(statusCode!, statusMessage, headers);
        response.pipe(originalRes);
      }
    });
    originalReq.pipe(req);
    req.on("error", (err) => {
      console.log("Error encountered while proxying request:", method, path, err);
      originalRes.end();
    });
  };
}
