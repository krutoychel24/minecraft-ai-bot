import { log } from '../utils/logger.js';
import { getMemory } from '../memory/memory.js';
import { getGoal } from './goals.js';
import { askLLM } from './llm.js';
import { getAvailableActions } from '../skills/skillManager.js';
import { API_DOCS } from './apiDocs.js';
import { getCraftingKnowledge } from './recipeIndexer.js';

export const determineNextAction = async (bot) => {
    log('planner', 'Determining next action based on memory and goals...');
    
    const memory = getMemory();
    const currentGoal = getGoal(memory, bot);
    const availableActions = getAvailableActions();
    
    // Scan surroundings
    const blocks = bot.findBlocks({
        matching: (block) => block && block.name !== 'air' && block.name !== 'cave_air',
        maxDistance: 16,
        count: 50
    });
    // get unique names
    const nearbyNames = [...new Set(blocks.map(pos => bot.blockAt(pos)?.name).filter(Boolean))];
    
    const matchingLogIds = bot.registry.blocksArray
        .filter(b => b.name.endsWith('_log') || b.name.endsWith('_stem') || b.name === 'log' || b.name === 'log2')
        .map(b => b.id);

    let nearestTreeStr = 'No trees visible within 64 blocks.';
    let treeFound = false;
    if (matchingLogIds.length > 0) {
        const treeBlock = bot.findBlock({ matching: matchingLogIds, maxDistance: 64 });
        if (treeBlock) {
            treeFound = true;
            const dist = Math.round(bot.entity.position.distanceTo(treeBlock.position));
            nearestTreeStr = `Nearest tree is ${dist} blocks away at X:${treeBlock.position.x} Y:${treeBlock.position.y} Z:${treeBlock.position.z}`;
        }
    }
    
    log('radar', nearestTreeStr);

    const surroundings = `General blocks (16 radius): ${nearbyNames.length > 0 ? nearbyNames.join(', ') : 'Nothing nearby'}\nTree Radar (64 radius): ${nearestTreeStr}`;

    const lastAction = memory.previousActions[memory.previousActions.length - 1];
    const justFailed = lastAction && !lastAction.success;
    
    const timeOfDay = bot.time.timeOfDay;
    const isNight = timeOfDay >= 13000 && timeOfDay <= 23000;
    const timeStatus = `Time: ${timeOfDay} (${isNight ? 'NIGHT - Monsters might spawn!' : 'DAY'})`;
    const healthStatus = `Health: ${bot.health}/20 | Food: ${bot.food}/20`;

    const recentDamageStrs = memory.recentDamage
        .filter(d => Date.now() - d.time < 60000) // last 60s
        .map(d => `Took ${d.amount} damage!`);
    
    const inventoryArray = Object.entries(memory.inventory || {});
    const inventoryFormat = inventoryArray.length > 0 
        ? inventoryArray.map(([item, count]) => `- ${item}: ${count}`).join('\n')
        : 'Inventory is completely EMPTY. (This is normal when starting)';

    const importantEventsStrs = memory.importantEvents.slice(-10)
        .map(e => `[${new Date(e.time).toISOString()}] ${e.event}`);

    const reflectionPrompt = justFailed ? 
`Your last action (${lastAction.action}) FAILED. 
Read the RULES below to understand WHY it might have failed, and DO NOT repeat the exact same action without changing your state (e.g. use EXPLORE to move first).` : '';

    // Construct the prompt for the LLM
    const prompt = `
You are an autonomous Minecraft agent.
Your core goal is to survive, explore, gather resources, craft, and build.

CRITICAL RULES To Survive and Succeed:
1. BARE HANDS: You DO NOT need tools to punch wood. If your inventory is empty, you can still use 'ACTION: MINE_WOOD'.
2. COMBAT: If you take damage, you MUST use 'ACTION: ATTACK' to fight back, or 'ACTION: FLEE' to run away.
3. EXPLORATION: Only use 'ACTION: EXPLORE' if you are stuck, or if MINE_WOOD just failed because no trees are around.
4. DO NOT HALLUCINATE: Only rely on the exact state shown below.

Minecraft Survival Knowledge (How to play):
- You MUST craft items step by step!
- Step 1: Gather logs (ACTION: MINE_WOOD)
- Step 2: Convert logs to planks (ACTION: CRAFT_OAK_PLANKS or CRAFT_BIRCH_PLANKS depending on log type)
- Step 3: Craft a table from 4 planks (ACTION: CRAFT_CRAFTING_TABLE)
- Step 4: You MUST place the table on the ground (ACTION: PLACE_CRAFTING_TABLE) before you can use it!
- Step 5: Craft sticks from planks (ACTION: CRAFT_STICK)
- Step 6: With a placed table and sticks, use ACTION: CRAFT_WOODEN_PICKAXE

${getCraftingKnowledge(bot)}

Your current objective based on state is: ${currentGoal}

Status:
${timeStatus}
${healthStatus}
${recentDamageStrs.length > 0 ? `WARNING, RECENT DAMAGE: ${recentDamageStrs.join(', ')}` : 'Condition: Safe'}

Here is your exact immediate inventory:
${inventoryFormat}

Here are your surroundings (visible blocks):
${surroundings}

Important Long-Term Events (Milestones):
${importantEventsStrs.join('\n') || 'None yet'}

Here is a record of your recent actions (Notice if you are repeating the same action without progress):
${memory.previousActions.map(a => `[${new Date(a.time).toISOString()}] Action: ${a.action} (Success: ${a.success})`).join('\n') || 'None'}

Here are your recent failures (DO NOT REPEAT FAILED ACTIONS):
${memory.failures.map(f => `[${new Date(f.time).toISOString()}] Action: ${f.action} failed. Reason: ${f.reason}`).join('\n') || 'None'}

${treeFound ? '\n!!! OPPORTUNITY: A TREE IS VISIBLE ON YOUR RADAR! YOU SHOULD USE "ACTION: MINE_WOOD" IMMEDIATELY TO GATHER IT! !!!\n' : ''}

Here are the actions you can currently perform:
${availableActions.join(', ')}

NEW POWER: MAXIMUM CREATIVITY & TRUE SELF-DEVELOPMENT
If you need to perform ANY task that is not in the list of available actions (like crafting a complex item, building a house, digging a hole, exploring a specific structure, or fighting), YOU HAVE THE COMPLETE FREEDOM to write your own JavaScript skill using the Mineflayer API!
Do not be afraid to invent new actions! BE CREATIVE!
Use this command:
ACTION: WRITE_SKILL myNewCreativeSkillName
\`\`\`javascript
// Your async code here (you have access to 'bot', 'goals', 'log', 'error')
// return true on success, false on failure.
\`\`\`

${API_DOCS}

${reflectionPrompt}
${bot.health < 20 && recentDamageStrs.length > 0 ? '\n!!! EMERGENCY !!! YOU ARE CURRENTLY TAKING DAMAGE AND DYING. YOUR ONLY GOAL RIGHT NOW IS TO SURVIVE. YOU MUST RESPOND WITH "ACTION: FLEE" OR "ACTION: ATTACK". DO NOT SAY ANY OTHER ACTION. !!!' : ''}

First, reason about what to do next based on your goal, inventory, surroundings, and past failures.
Then, output the exact action to take.

You MUST respond strictly in this format:
${justFailed ? 'AI REFLECTION: "<why the last action failed>"\n' : ''}AI THOUGHT: "<your reasoning, including what you want to do, why, and potential risks>"
ACTION: <ACTION_NAME> (or WRITE_SKILL <name> followed by code block)
`.trim();

    return await askLLM(prompt);
};
