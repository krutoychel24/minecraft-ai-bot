// src/brain/goals.js
import { log } from '../utils/logger.js';
import { recordImportantEvent } from '../memory/memory.js';

let lastGoal = null;

export const getGoal = (memory, bot) => {
    // SURVIVAL OVERRIDE
    if (bot && bot.health < 20 && memory.recentDamage && memory.recentDamage.length > 0) {
        const goal = 'URGENT SURVIVAL: You are taking damage! IMMEDIATELY use "ACTION: FLEE" or "ACTION: ATTACK" to survive!';
        log('goals', `Current goal evaluated: ${goal}`);
        return goal;
    }

    // Dynamically update the goal based on memory/inventory
    const inventory = memory.inventory || {};
    
    const logsCount = (inventory['oak_log'] || 0) + (inventory['birch_log'] || 0) + (inventory['spruce_log'] || 0) + (inventory['jungle_log'] || 0) + (inventory['acacia_log'] || 0) + (inventory['dark_oak_log'] || 0);
    const planksCount = (inventory['oak_planks'] || 0) + (inventory['birch_planks'] || 0) + (inventory['spruce_planks'] || 0);
    const hasCraftingTable = inventory['crafting_table'] > 0;
    
    let currentGoal;

    if (logsCount < 5 && planksCount < 10) {
        currentGoal = 'Gather wood';
    } else if (!hasCraftingTable) {
        currentGoal = 'Craft a crafting table';
    } else {
        currentGoal = 'Build a shelter';
    }
    if (lastGoal !== currentGoal) {
        if (lastGoal !== null) {
            recordImportantEvent(`Completed previous goal! New Goal: ${currentGoal}`);
        } else {
            recordImportantEvent(`Initial Goal: ${currentGoal}`);
        }
        lastGoal = currentGoal;
    }

    log('goals', `Current goal evaluated: ${currentGoal}`);
    return currentGoal;
};
