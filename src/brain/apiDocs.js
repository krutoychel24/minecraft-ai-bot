// src/brain/apiDocs.js
export const API_DOCS = `
Mineflayer API Cheat Sheet for WRITE_SKILL:
- Access the bot instance via 'bot'.
- 'bot.entity.position': Get bot's current {x, y, z}.
- 'bot.chat(message)': Send a chat message.
- 'bot.findBlock({ matching: [ids], maxDistance: 32 })': Returns a Block object.
- 'bot.blockAt(vec3)': Returns Block object.
- 'bot.collectBlock.collect(block)': Async, mines and collects the dropped item.
- 'bot.pathfinder.goto(new goals.GoalNear(x, y, z, range))': Async, moves bot to location.
- 'bot.pathfinder.goto(new goals.GoalGetToBlock(x, y, z))': Async.
- 'bot.recipesFor(item.id, null, 1, craftingTable)': Returns array of recipes.
- 'bot.craft(recipe, 1, craftingTable)': Async, crafts the item.
- 'bot.inventory.items()': Returns array of items in inventory.
- 'bot.equip(item, "hand")': Async, equips item.
- 'bot.placeBlock(referenceBlock, faceVector)': Async, places a block.

Important Dependencies passed as variables:
- 'goals': mineflayer-pathfinder goals (e.g. goals.GoalNear)
- 'log', 'error': logger functions.

Write clean async code. The skill is the body of an async function.
You must return true on success, and false on failure.

Example:
const dirtId = bot.registry.blocksByName['dirt'].id;
const targets = bot.findBlocks({ matching: dirtId, maxDistance: 5, count: 1 });
if (targets.length > 0) {
  const targetPos = targets[0];
  await bot.pathfinder.goto(new goals.GoalLookAtBlock(targetPos, bot.world));
  await bot.dig(bot.blockAt(targetPos));
  return true;
}
return false;
`.trim();
