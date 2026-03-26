// src/actions/explore.js
import { log } from '../utils/logger.js';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;

export const explore = async (bot) => {
    log('action', 'Executing EXPLORE...');
    
    try {
        const x = bot.entity.position.x + (Math.random() * 40 - 20);
        const z = bot.entity.position.z + (Math.random() * 40 - 20);
        
        log('action', `Exploring to X:${Math.round(x)} Z:${Math.round(z)}`);
        
        await bot.pathfinder.goto(new goals.GoalNearXZ(x, z, 2));
        log('action', 'Exploration reached target.');
        return true;
    } catch (err) {
        log('action', `Failed to explore: ${err.message}`);
        return false;
    }
};
