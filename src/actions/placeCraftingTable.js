import { log } from '../utils/logger.js';
import vec3Pkg from 'vec3';
// Support both ES module and CommonJS exports for vec3
const vec3 = vec3Pkg.vec3 || vec3Pkg;

export const placeCraftingTable = async (bot) => {
    log('action', 'Executing PLACE_CRAFTING_TABLE...');
    
    const tableItem = bot.inventory.items().find(item => item.name === 'crafting_table');
    if (!tableItem) {
        log('action', 'Failed: No crafting_table found in inventory.');
        return 'Failed: No crafting_table found in inventory.';
    }

    try {
        await bot.equip(tableItem, 'hand');
    } catch (err) {
        return `Failed to equip crafting table: ${err.message}`;
    }

    // Find a solid block we can place it on
    const referenceBlock = bot.findBlock({
        matching: (block) => {
            if (block.name === 'air' || block.name === 'cave_air' || block.name === 'water' || block.name === 'lava') return false;
            if (block.boundingBox !== 'block') return false;
            
            const blockAbove = bot.blockAt(block.position.offset(0, 1, 0));
            // We need 1 block of air above it so we can put the table down
            if (!blockAbove || (blockAbove.name !== 'air' && blockAbove.name !== 'cave_air')) return false;

            // Also ensure the bot isn't literally standing inside that block space
            const dist = bot.entity.position.distanceTo(blockAbove.position);
            return dist > 1.0; 
        },
        maxDistance: 4
    });

    if (!referenceBlock) {
        log('action', 'Failed: No suitable location found to place table.');
        return 'Failed: No suitable location found to place the table. Move to a flat open area.';
    }

    try {
        await bot.placeBlock(referenceBlock, vec3(0, 1, 0));
        log('action', 'Successfully placed crafting table.');
        return true;
    } catch (err) {
        log('action', `Failed to place crafting table: ${err.message}`);
        return `Failed to place crafting table: ${err.message}`;
    }
};
