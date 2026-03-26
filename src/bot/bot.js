// src/bot/bot.js
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder } = pathfinderPkg;
import collectBlockPkg from 'mineflayer-collectblock';
const { plugin: collectBlock } = collectBlockPkg;
import { log, error } from '../utils/logger.js';
import { recordImportantEvent, recordDamage } from '../memory/memory.js';

let bot = null;

export const createBot = () => {
    return new Promise((resolve) => {
        log('bot', 'Connecting to Minecraft server...');
        bot = mineflayer.createBot({
            host: 'localhost',
            port: 25565,
            username: 'AIAgent',
            version: false // Auto-detect version
        });

        bot.loadPlugin(pathfinder);
        bot.loadPlugin(collectBlock);

        let prevHealth = 20;

        bot.once('spawn', () => {
            log('bot', 'Bot spawned into the world!');
            recordImportantEvent('Spawned into the world');
            prevHealth = bot.health;
            resolve(bot);
        });

        bot.on('health', () => {
            if (bot.health < prevHealth) {
                const damage = prevHealth - bot.health;
                recordDamage(damage);
                log('bot', `Took ${damage} damage! Current health: ${bot.health}`);
            }
            prevHealth = bot.health;
        });

        bot.on('error', (err) => {
            error('bot', 'Connection error', err);
        });

        bot.on('kicked', (reason) => {
            log('bot', `Kicked from server: ${reason}`);
            recordImportantEvent(`Kicked from server: ${reason}`);
        });
        
        bot.on('death', () => {
            log('bot', 'Bot died!');
            recordImportantEvent('Bot died');
        });
    });
};

export const getBot = () => {
    if (!bot) {
        throw new Error('Bot is not initialized yet.');
    }
    return bot;
};
