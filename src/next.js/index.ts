import type { Response } from "express";
import type { Request } from "firebase-functions/v2/https";
import LRU from "lru-cache";

import { realSimpleProxy } from "./utils.js";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";

type LRUCache = { host: string; spawnProcess: ChildProcessWithoutNullStreams };

const nextAppsLRU = new LRU<string, LRUCache>({
  // TODO tune this
  max: 3,
  allowStale: true,
  updateAgeOnGet: true,
  dispose: ({ spawnProcess }) => {
    console.log("Kill!");

    spawnProcess.kill();
  },
});

export const handle = async (req: Request, res: Response) => {
  const { hostname, protocol, url } = req;
  const port = protocol === "https" ? 443 : 80;
  const key = [hostname, port].join(":");

  // I wish there was a better way to do this, but it seems like this is the
  // way to go. Should investigate more if we can get hostname/port to be
  // dynamic for middleware.
  let nextApp = nextAppsLRU.get(key);
  if (!nextApp) {
    const promise = new Promise<LRUCache>((resolve, reject) => {
      const serve = spawn("node", ["node_modules/.bin/next", "start", "--port", "3000"], {
        cwd: process.cwd(),
      });

      serve.stdout.on("data", (data: any) => {
        process.stdout.write(data);
        const match = data.toString().match(/(http:\/\/.+:\d+)/);

        if (match) {
          resolve({
            host: match[1],
            spawnProcess: serve,
          });
        }
      });

      serve.stderr.on("data", (data: any) => {
        process.stderr.write(data);
      });

      serve.on("exit", reject);
    });

    const { host, spawnProcess } = await promise;
    const cached = {
      host,
      spawnProcess,
    };

    nextAppsLRU.set(key, cached);

    nextApp = cached;
  }

  // --- --- ----
  // Current implementation:
  //
  //
  // await nextApp.prepare();
  // const parsedUrl = parse(url, true);
  // nextApp.getRequestHandler()(req, res, parsedUrl);
  //
  // --- --- ----

  // --- --- ----
  // Trying to proxy the request:
  //
  // await nextApp.prepare();
  // const parsedUrl = parse(url, true);
  // const nextHandler = nextApp.getRequestHandler();

  // if (!req.headers.proxied) {
  //   const proxied = simpleProxy(async (req, res) => {
  //     await nextHandler(req, res, parsedUrl);
  //   });
  //   proxied(req, res, () => {});
  // }
  //
  realSimpleProxy(nextApp.host)(req, res, req.next!);

  // --- --- ----
};

// curl -X POST https://fb-tools-dev.web.app/api -H "Content-type: application/json" -d '{ "query": "dolphin"}'
// curl https://fb-tools-dev.web.app/api
