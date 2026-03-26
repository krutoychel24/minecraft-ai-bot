import fs from 'fs';
import path from 'path';
import { log } from '../utils/logger.js';

let recipesData = null;

export const loadRecipes = () => {
    try {
        const recipesPath = path.join(process.cwd(), 'public', 'recipes.json');
        if (fs.existsSync(recipesPath)) {
            recipesData = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));
            log('planner', `Indexed ${recipesData.length} recipes from recipes.json`);
        }
    } catch (e) {
        log('planner', `Failed to load recipes.json: ${e.message}`);
    }
};

export const getCraftingKnowledge = (bot) => {
    if (!recipesData) return '';
    
    const invItems = bot.inventory.items();
    if (invItems.length === 0) return 'Your inventory is empty. Gather raw materials first (like Wood).';

    // Use raw Mineflayer IDs directly
    const invNames = invItems.map(i => i.name.toLowerCase());

    const craftableHints = new Set();
    const immediateCrafts = [];

    for (const recipe of recipesData) {
        if (!recipe.give || !recipe.have) continue;
        
        const outputItem = Array.isArray(recipe.give) ? recipe.give[0] : recipe.give;
        
        let requiresItems = [];
        if (Array.isArray(recipe.have)) {
            for (const row of recipe.have) {
                if (Array.isArray(row)) {
                    requiresItems.push(...row.filter(x => x && x !== 'null'));
                } else if (typeof row === 'string') {
                    requiresItems.push(row);
                }
            }
        }
        
        const reqCounts = {};
        for (const req of requiresItems) {
            let key = req.replace(/\s+/g, '_').toLowerCase();
            if (key.endsWith('_wood')) key = key.replace('_wood', '_log');
            if (key.endsWith('_plank')) key = key.replace('_plank', '_planks');
            reqCounts[key] = (reqCounts[key] || 0) + 1;
        }
        
        let outName = outputItem.replace(/\s+/g, '_').toLowerCase();
        if (outName.endsWith('_wood')) outName = outName.replace('_wood', '_log');
        if (outName.endsWith('_plank')) outName = outName.replace('_plank', '_planks');

        const reqCountStrs = Object.entries(reqCounts).map(([k, v]) => `${v}x ${k}`);
        const flatRequires = Object.keys(reqCounts);
        
        // Count how many required ingredients we currently have in full
        let hitCount = 0;
        let totalItemsNeeded = 0;
        let totalItemsHave = 0;

        for (const req of flatRequires) {
            const reqNeeded = reqCounts[req];
            totalItemsNeeded += reqNeeded;
            
            for (const invName of invNames) {
                // Exact match or partial if names differ slightly
                if (req === invName || invName.includes(req) || req.includes(invName)) {
                    hitCount++;
                    break;
                }
            }
        }

        // If we have at least one valid ingredient type, it's a potential craft!
        if (hitCount > 0) {
            const recipeCommand = `CRAFT_${outName.toUpperCase()}`;
            const hint = `- ${outName} (Requires exactly: ${reqCountStrs.join(', ')}). Action: ${recipeCommand}`;
            
            if (hitCount === flatRequires.length) {
                immediateCrafts.push(`!!! YOU MIGHT BE ABLE TO CRAFT: ${outName}. Use ACTION: ${recipeCommand} !!!`);
            } else {
                craftableHints.add(hint);
            }
        }
    }

    let hintsArray = [...craftableHints];
    if (hintsArray.length > 8) {
        // limit to 8 to save context
        hintsArray = hintsArray.slice(0, 8);
    }

    let knowledgeStr = `Based on your public/recipes.json, you have partial materials to craft:\n${hintsArray.join('\n')}`;
    if (immediateCrafts.length > 0) {
        // limit immediate crafts to top 3
        knowledgeStr += `\n\n${immediateCrafts.slice(0, 3).join('\n')}`;
    }

    return knowledgeStr;
};
