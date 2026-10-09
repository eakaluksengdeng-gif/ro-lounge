import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") targetX = 0;
  @type("number") targetY = 0;
  @type("number") color = 0xffffff;
}

export class TownState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
