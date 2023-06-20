import { parse } from "url";

import { default as next } from "next";
import type { Response } from "express";
import type { Request } from "firebase-functions/v2/https";
import LRU from "lru-cache";
import { NextServer } from "next/dist/server/next.js";

import { simpleProxy } from "./utils.js";

const nextAppsLRU = new LRU<string, NextServer>({
  // TODO tune this
  max: 3,
  allowStale: true,
  updateAgeOnGet: true,
  dispose: (server) => {
    server.close();
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
    nextApp = next({
      dev: false,
      dir: process.cwd(),
      hostname,
      port,
      customServer: false,
    });

    nextAppsLRU.set(key, nextApp!);
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
  await nextApp.prepare();
  const parsedUrl = parse(url, true);
  const nextHandler = nextApp.getRequestHandler();

  const proxied = simpleProxy(async (proxyReq, proxyRes) => {
    await nextHandler(proxyReq, proxyRes, parsedUrl);
  });
  proxied(req, res, req.next!);
  //
  // --- --- ----
};

// curl -X POST https://fb-tools-dev.web.app/api -H "Content-type: application/json" -d '{ "query": "dolphin" }'
// curl https://fb-tools-dev.web.app/api
