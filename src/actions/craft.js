import { log } from '../utils/logger.js';

export const craftItem = async (bot, itemName) => {
    log('action', `Attempting to craft: ${itemName}`);
    
    // Find the item ID in the registry
    const itemStr = itemName.toLowerCase().replace('_', '');
    
    // First try exact match
    let targetRegistryItem = bot.registry.itemsByName[itemName.toLowerCase()];
    
    if (!targetRegistryItem) {
        // Fallback: search loosely
        const possibleItems = bot.registry.itemsArray.filter(i => i.name.replace('_', '').includes(itemStr));
        if (possibleItems.length > 0) {
            targetRegistryItem = possibleItems[0];
            log('action', `Exact item not found, guessing you meant: ${targetRegistryItem.name}`);
        }
    }

    if (!targetRegistryItem) {
        log('action', `Failed to craft: Unknown item ${itemName}`);
        return 'Failed: Unknown item ' + itemName;
    }

    // First check if it's even craftable in a 2x2 grid regardless of inventory
    const possible2x2 = bot.recipesAll(targetRegistryItem.id, null, null);
    const requiresTable = possible2x2.length === 0;

    let recipes = bot.recipesFor(targetRegistryItem.id, null, 1, null);
    let usedTable = false;
    let craftingTableBlock = null;

    if (!recipes || recipes.length === 0) {
        if (requiresTable) {
            // We need a 3x3 grid, find a nearby crafting table
            craftingTableBlock = bot.findBlock({
                matching: bot.registry.blocksByName['crafting_table']?.id,
                maxDistance: 6
            });

            if (!craftingTableBlock) {
                return `Failed: Crafting ${targetRegistryItem.name} REQUIRES a Crafting Table nearby, but none was found.`;
            }

            recipes = bot.recipesFor(targetRegistryItem.id, null, 1, craftingTableBlock);
            usedTable = true;
        } else {
            // It DOES NOT require a table, so the only reason it failed is missing ingredients!
            return `Failed: You do not have the required ingredients in your inventory to craft ${targetRegistryItem.name}.`;
        }
    }

    if (!recipes || recipes.length === 0) {
        return `Failed: You do not have the required ingredients to craft ${targetRegistryItem.name}.`;
    }

    try {
        await bot.craft(recipes[0], 1, craftingTableBlock);
        log('action', `Successfully crafted ${targetRegistryItem.name}${usedTable ? ' using a Crafting Table' : ' in inventory'}.`);
        return true;
    } catch (err) {
        return `Failed to craft ${targetRegistryItem.name} during execution: ${err.message}`;
    }
};
