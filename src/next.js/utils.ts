import { request as httpRequest, Agent } from "https";
import { RequestHandler } from "next/dist/server/next.js";
import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";

export function simpleProxy(requestHandler: RequestHandler) {
  return async (originalReq: Request, originalRes: Response, next: () => void) => {
    console.log("in simple proxy callback");
    const agent = new Agent({ keepAlive: true });
    const { method, url: path, headers } = originalReq;
    if (!method || !path) {
      console.log("!method || !path");
      originalRes.end();
      return;
    }
    const { hostname, protocol } = originalReq;
    const port = protocol === "https" ? 443 : 80;

    const host = `${hostname}:${port}`;
    const opts = {
      agent,
      protocol: `${protocol}:`,
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
      console.error("Error encountered while proxying request:", method, path, err);
      originalRes.end();
    });

    await Promise.resolve(requestHandler(originalReq, originalRes));
  };
}

// export function proxyResponse(originalResponse: ServerResponse, next: () => void) {
//   console.log("in proxyResponse body");

//   return (response: IncomingMessage | ServerResponse) => {
//     console.log("in proxyResponse callback");

//     const { statusCode, statusMessage } = response;
//     if (!statusCode) {
//       console.log("no status code!");

//       originalResponse.end();
//       return;
//     }
//     if (statusCode === 404) {
//       console.log("proxy response 404!, next()");

//       return next();
//     }
//     const headers = "getHeaders" in response ? response.getHeaders() : response.headers;
//     originalResponse.writeHead(statusCode, statusMessage, headers);
//     console.log("pipe response");

//     response.pipe(originalResponse);
//   };
// }

// export function simpleProxyWIP(requestHandler: RequestHandler) {
//   // If the path is a the auth token sync URL pass through to Cloud Functions
//   const firebaseDefaultsJSON = process.env.__FIREBASE_DEFAULTS__;

//   const authTokenSyncURL: string | undefined =
//     firebaseDefaultsJSON && JSON.parse(firebaseDefaultsJSON)._authTokenSyncURL;

//   return async (originalReq: IncomingMessage, originalRes: ServerResponse, next: () => void) => {
//     console.log("in simple proxy callback");
//     const agent = new Agent({ keepAlive: true });

//     const { method, url: path, headers } = originalReq;
//     if (!method || !path) {
//       console.log("!method || !path");

//       originalRes.end();
//       return;
//     }
//     if (path === authTokenSyncURL) {
//       console.log("path === authTokenSyncURL");

//       return next();
//     }

//     const { hostname, port, protocol, username, password } = new URL(originalReq.url!);
//     const host = `${hostname}:${port}`;
//     const auth = username || password ? `${username}:${password}` : undefined;
//     const opts = {
//       agent,
//       auth,
//       protocol,
//       hostname,
//       port,
//       path,
//       method,
//       headers: {
//         ...headers,
//         host,
//         "X-Forwarded-Host": headers.host,
//       },
//     };
//     const req = httpRequest(opts, (response) => {
//       const { statusCode, statusMessage, headers } = response;
//       if (statusCode === 404) {
//         next();
//       } else {
//         originalRes.writeHead(statusCode!, statusMessage, headers);
//         response.pipe(originalRes);
//       }
//     });
//     originalReq.pipe(req);
//     req.on("error", (err) => {
//       console.error("Error encountered while proxying request:", method, path, err);
//       originalRes.end();
//     });

//     console.log("before await Promise.resolve(requestHandler(originalReq, originalRes, next))");

//     // TODO: figure out where to get next() from
//     await Promise.resolve(requestHandler(originalReq, originalRes));
//     console.log("getting proxied response");

//     const proxiedRes = new ServerResponse(originalReq);

//     console.log("before proxyResponse");
//     proxyResponse(originalRes, next)(proxiedRes);
//     console.log("after proxyResponse");
//   };
// }
