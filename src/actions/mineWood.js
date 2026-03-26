// src/actions/mineWood.js
import { log } from '../utils/logger.js';

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

    const targetBlock = bot.findBlock({
        matching: (block) => {
            if (!block || !block.position || !matchingIds.includes(block.type)) return false;
            // Check if it's in the badBlocks list
            const isBad = badBlocks.some(b => b && b.x === block.position.x && b.y === block.position.y && b.z === block.position.z);
            return !isBad;
        },
        maxDistance: 64
    });

    if (!targetBlock) {
        log('action', 'No wood found nearby! Must EXPLORE first.');
        return false;
    }

    log('action', `Found wood at ${targetBlock.position.x}, ${targetBlock.position.y}, ${targetBlock.position.z}. Collecting...`);
    
    try {
        const collectReq = bot.collectBlock.collect(targetBlock);
        
        const timeoutReq = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT: Bot is stuck staring at a wall! Use EXPLORE to get unstuck!')), 12000);
        });

        await Promise.race([collectReq, timeoutReq]);

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
