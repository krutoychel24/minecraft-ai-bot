import { log } from '../utils/logger.js';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;

export const flee = async (bot) => {
    log('action', 'Executing FLEE...');
    const entity = bot.nearestEntity(e => e.type === 'hostile' || e.type === 'mob');
    
    const p = bot.entity.position;
    let targetX = p.x;
    let targetZ = p.z;
    
    if (!entity) {
        log('action', 'No enemies visible, running randomly to escape danger.');
        const offset = 20;
        targetX += (Math.random() - 0.5) * offset * 2;
        targetZ += (Math.random() - 0.5) * offset * 2;
    } else {
        log('action', `Fleeing directly away from ${entity.name}!`);
        const ePos = entity.position;
        const dx = p.x - ePos.x;
        const dz = p.z - ePos.z;
        const dist = Math.sqrt(dx*dx + dz*dz) || 1;
        targetX += (dx/dist) * 20;
        targetZ += (dz/dist) * 20;
    }

    try {
        bot.pathfinder.setGoal(new goals.GoalNearXZ(targetX, targetZ, 1), true);
        // Wait 4 seconds for running away
        await new Promise(r => setTimeout(r, 4000));
        bot.pathfinder.stop();
        log('action', 'Finished fleeing.');
        return true;
    } catch (e) {
        log('action', `Flee failed: ${e.message}`);
        bot.pathfinder.stop();
        return false;
    }
};
