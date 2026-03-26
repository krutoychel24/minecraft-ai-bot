// src/index.js
import { createBot } from './bot/bot.js';
import { log, error } from './utils/logger.js';
import { loadMemory, updateInventory, recordAction, getMemory } from './memory/memory.js';
import { determineNextAction } from './brain/planner.js';
import { executeAction, loadCompositeSkills, getAvailableActions, createCompositeSkill, loadDynamicSkills, registerDynamicSkill } from './skills/skillManager.js';
import { loadRecipes } from './brain/recipeIndexer.js';
import { startDashboard, broadcastBrainNode, broadcastLog } from './server/dashboard.js';

const SLEEP_BETWEEN_ACTIONS_MS = 2000;

const analyzePatterns = () => {
    const memory = getMemory();
    const history = memory.previousActions;
    if (history.length < 4) return;
    
    const a1 = history[history.length - 4];
    const a2 = history[history.length - 3];
    const a3 = history[history.length - 2];
    const a4 = history[history.length - 1];
    
    // Look for repeating successful pairs, e.g., MINE_WOOD -> CRAFT -> MINE_WOOD -> CRAFT
    if (a1.success && a2.success && a3.success && a4.success) {
        if (a1.action === a3.action && a2.action === a4.action && a1.action !== a2.action) {
            const newSkillName = `${a1.action}_AND_${a2.action}`;
            const available = getAvailableActions();
            
            if (!available.includes(newSkillName)) {
                log('main', `🌟 Pattern recognized! Auto-generating new skill: ${newSkillName}`);
                createCompositeSkill(newSkillName, [a1.action, a2.action]);
            }
        }
    }
};

// Syncs the Mineflayer bot's current inventory into our memory structure
const syncInventory = (bot) => {
    const items = bot.inventory.items();
    const inventoryData = {};
    for (const item of items) {
        if (inventoryData[item.name]) {
            inventoryData[item.name] += item.count;
        } else {
            inventoryData[item.name] = item.count;
        }
    }
    updateInventory(inventoryData);
};

const mainLoop = async (bot) => {
    log('main', 'Starting bot autonomous loop...');

    while (true) {
        try {
            // 1. Sync current state (inventory) to memory
            syncInventory(bot);

            // 2. Ask LLM for the next action based on memory and goals
            const response = await determineNextAction(bot);

            if (!response || (!response.action && !response.reflection)) {
                log('main', 'LLM did not provide a valid response. Waiting before retrying...');
                await new Promise(resolve => setTimeout(resolve, SLEEP_BETWEEN_ACTIONS_MS));
                continue;
            }

            const { reflection, thought, action, skillName, code } = response;
            
            if (reflection) {
                log('brain', `🧠 REFLECTION: "${reflection}"`);
                broadcastBrainNode('ref_' + Date.now(), `REFLECTION:\n${reflection}`, 'reflection');
            }
            
            log('brain', `🤖 THOUGHT: "${thought}"`);
            broadcastBrainNode('th_' + Date.now(), `THOUGHT:\n${thought}`, 'thought');

            if (action) log('main', `⚡ AI decided next action: ${action}`);

            let success = false;
            
            if (action === 'WRITE_SKILL' && skillName && code) {
                log('main', `🛠️ AI is programming a new skill: ${skillName}`);
                broadcastBrainNode('act_' + Date.now(), `CODE:\nWRITE_SKILL ${skillName}`, 'action');
                success = registerDynamicSkill(skillName, code);
                // If compilation succeeds, we consider the action of writing a success
            } else if (action && action !== 'WRITE_SKILL') {
                // 3. Execute the action
                broadcastBrainNode('act_' + Date.now(), `ACTION:\n${action}`, 'action');
                success = await executeAction(bot, action);
            } else if (!action) {
                log('main', 'LLM provided thoughts but no actionable command.');
                continue;
            }

            // 4. Record the result in memory (success or failure)
            let resultMessage = '';
            if (typeof success === 'string') {
                resultMessage = success;
                success = false;
            } else if (success === false) {
                resultMessage = 'Action returned false.';
            }
            
            recordAction(action || 'THINK', thought, success, resultMessage);
            
            if (success) {
                log('main', `✅ Action ${action} completed successfully.`);
                broadcastBrainNode('res_' + Date.now(), `SUCCESS:\n${action}`, 'thought');
            } else {
                log('main', `❌ Action ${action} failed.`);
                broadcastBrainNode('res_' + Date.now(), `FAILED:\n${action}`, 'failure');
            }

            // 5. Short pause between actions to prevent spamming
            await new Promise(resolve => setTimeout(resolve, SLEEP_BETWEEN_ACTIONS_MS));

        } catch (err) {
            error('main', 'Error occurred in the main loop', err.message);
            // Wait a bit longer on error to prevent fast crash loops
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

const start = async () => {
    log('main', 'Initializing Minecraft AI Bot...');
    
    // Load existing memory from disk
    loadMemory();
    loadCompositeSkills();
    loadDynamicSkills();
    loadRecipes();

    // Start web dashboard immediately, even before bot connects
    startDashboard();

    try {
        const bot = await createBot();
        
        // Start the main loop once the bot is fully ready and loaded into the world
        setTimeout(() => {
            mainLoop(bot);
        }, 1000); // Small wait to ensure chunks and physics loads
    } catch (err) {
        error('main', 'Failed to start bot', err.message);
    }
};

// Handle process exits gracefully
process.on('SIGINT', () => {
    log('main', 'Shutting down bot...');
    process.exit();
});

start();
