import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "node:http";
import { TownRoom } from "./rooms/TownRoom";
import { PokDengRoom } from "./rooms/PokDengRoom";

const port = Number(process.env.PORT ?? 2567);

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200).end("ok");
    return;
  }
  res.writeHead(404).end();
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("town", TownRoom);
gameServer.define("pok_deng", PokDengRoom);

gameServer.listen(port).then(() => {
  console.log(`[ro-lounge] server listening on ws://localhost:${port}`);
});
