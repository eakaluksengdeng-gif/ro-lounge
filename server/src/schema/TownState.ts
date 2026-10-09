import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") playerId = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") targetX = 0;
  @type("number") targetY = 0;
  @type("number") color = 0xffffff;
  @type("uint8") hair = 0;
  @type("uint8") skin = 0;
  @type("uint8") pants = 0;
  @type("uint8") style = 0;
}

export class TownState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
