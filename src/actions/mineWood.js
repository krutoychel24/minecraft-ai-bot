// src/actions/mineWood.js
import { log } from '../utils/logger.js';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;

// Keep track of unreachable blocks so we don't get stuck on them
const badBlocks = [];

export const mineWood = async (bot) => {
    log('action', 'Executing MINE_WOOD...');
    
    const matchingIds = bot.registry.blocksArray
        .filter(b => b.name.endsWith('_log') || b.name.endsWith('_stem') || b.name === 'log' || b.name === 'log2')
        .map(b => b.id);
    
    if (matchingIds.length === 0) {
        log('action', 'No valid log types found in the registry for this version.');
        return 'Failed: No log types in registry.';
    }

    const blocks = bot.findBlocks({
        matching: matchingIds,
        maxDistance: 64,
        count: 10
    });

    const goodPositions = blocks.filter(pos => !badBlocks.some(b => b && b.x === pos.x && b.y === pos.y && b.z === pos.z));

    if (goodPositions.length === 0) {
        log('action', 'No wood found nearby! Must EXPLORE first.');
        return false;
    }

    // find nearest
    let targetBlockPos = goodPositions.sort((a, b) => bot.entity.position.distanceTo(a) - bot.entity.position.distanceTo(b))[0];
    const targetBlock = bot.blockAt(targetBlockPos);

    log('action', `Found wood at ${targetBlock.position.x}, ${targetBlock.position.y}, ${targetBlock.position.z}. Collecting...`);
    
    try {
        const p = targetBlock.position;
        await bot.pathfinder.goto(new goals.GoalGetToBlock(p.x, p.y, p.z));
        
        await bot.lookAt(targetBlock.position.offset(0.5, 0.5, 0.5));
        
        const axes = bot.inventory.items().filter(item => item.name.includes('_axe'));
        if (axes.length > 0) {
            await bot.equip(axes[0], 'hand');
        }

        await bot.dig(targetBlock);
        
        // Move into the dropped item to collect it
        try {
            await bot.pathfinder.goto(new goals.GoalBlock(p.x, p.y, p.z));
        } catch (e) {
            // It's ok if we can't step exactly inside the block, we might have picked it up anyway
        }

        log('action', 'Successfully mined and collected wood.');
        return true;
    } catch (err) {
        // Force stop all movements if stuck
        bot.pathfinder.stop();
        bot.clearControlStates();
        
        // Add to blacklist so we don't try this impossible tree again
        badBlocks.push({ x: targetBlock.position.x, y: targetBlock.position.y, z: targetBlock.position.z });
        
        // Keep blacklist small
        if (badBlocks.length > 20) badBlocks.shift();

        const errMessage = `Failed to mine wood: ${err.message}. Block at ${targetBlock.position.x}, ${targetBlock.position.y}, ${targetBlock.position.z} was unreachable and is now ignored.`;
        log('action', errMessage);
        return errMessage;
    }
};
