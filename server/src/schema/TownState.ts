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
  @type("uint8") gender = 0;
  @type("string") fishing = "";
  @type("number") fishingBobberX = 0;
  @type("number") fishingBobberY = 0;
}

export class Wildlife extends Schema {
  @type("string") kind = "cat";
  @type("uint8") variant = 0;
  @type("number") x = 0;
  @type("number") y = 0;
  @type("int8") facing = 1;
  @type("boolean") moving = false;
}

export class TownState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Wildlife }) wildlife = new MapSchema<Wildlife>();
  @type("string") weather = "sunny";
  @type("number") weatherNextChangeAt = 0;
}
