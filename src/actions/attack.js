import { log } from '../utils/logger.js';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;

export const attack = async (bot) => {
    log('action', 'Executing ATTACK...');
    const entity = bot.nearestEntity(e => e.type === 'hostile' || e.type === 'mob' || e.type === 'animal');
    
    if (!entity) {
        log('action', 'No targets found to attack nearby.');
        return false;
    }

    log('action', `Attacking nearest entity: ${entity.name}!`);
    
    try {
        const weapons = bot.inventory.items().filter(item => item.name.includes('sword') || item.name.includes('axe'));
        if (weapons.length > 0) {
            await bot.equip(weapons[0], 'hand');
            log('action', `Equipped ${weapons[0].name} for battle.`);
        }
    } catch(e) {}

    bot.pathfinder.setGoal(new goals.GoalFollow(entity, 2), true);
    
    const end = Date.now() + 6000;
    let killed = false;
    
    while (Date.now() < end) {
        if (!entity.isValid) {
            killed = true;
            break;
        }
        const dist = bot.entity.position.distanceTo(entity.position);
        if (dist < 4) {
            bot.lookAt(entity.position.offset(0, entity.height / 2, 0));
            bot.attack(entity);
        }
        await new Promise(r => setTimeout(r, 600));
    }
    
    bot.pathfinder.stop();
    if (killed) {
        log('action', `Successfully killed ${entity.name}!`);
        return true;
    } else {
        log('action', `Attack sequence finished, ${entity.name} might still be alive.`);
        return true; // Still a successful intent
    }
};
