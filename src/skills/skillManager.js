// src/skills/skillManager.js
import fs from 'fs';
import path from 'path';
import { log, error } from '../utils/logger.js';
import { mineWood } from '../actions/mineWood.js';
import { explore } from '../actions/explore.js';
import { attack } from '../actions/attack.js';
import { flee } from '../actions/flee.js';
import { craftItem } from '../actions/craft.js';
import { placeCraftingTable } from '../actions/placeCraftingTable.js';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;

const baseSkills = {
    MINE_WOOD: mineWood,
    EXPLORE: explore,
    ATTACK: attack,
    FLEE: flee,
    PLACE_CRAFTING_TABLE: placeCraftingTable
};

const userSkillsPath = path.join(process.cwd(), 'skills.json');
let compositeSkills = {};
const dynamicSkillsPath = path.join(process.cwd(), 'src/skills/dynamic');
let dynamicSkills = {};

export const loadDynamicSkills = () => {
    try {
        if (!fs.existsSync(dynamicSkillsPath)) {
            fs.mkdirSync(dynamicSkillsPath, { recursive: true });
            return;
        }
        const files = fs.readdirSync(dynamicSkillsPath);
        for (const file of files) {
            if (file.endsWith('.js')) {
                const name = file.replace('.js', '');
                const code = fs.readFileSync(path.join(dynamicSkillsPath, file), 'utf8');
                registerDynamicSkill(name, code, false);
            }
        }
        log('skillManager', `Loaded ${Object.keys(dynamicSkills).length} dynamic skills.`);
    } catch (err) {
        error('skillManager', 'Failed to load dynamic skills', err.message);
    }
};

export const registerDynamicSkill = (name, codeString, saveToDisk = true) => {
    try {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fullCode = `
            try {
                ${codeString}
            } catch (e) {
                error('dynamicSkill', 'Error executing ' + '${name}', e.message);
                return false;
            }
        `;
        // Expose bot and helpers to the dynamic code
        const skillFunc = new AsyncFunction('bot', 'goals', 'log', 'error', fullCode);
        dynamicSkills[name] = skillFunc;
        
        if (saveToDisk) {
            if (!fs.existsSync(dynamicSkillsPath)) fs.mkdirSync(dynamicSkillsPath, { recursive: true });
            fs.writeFileSync(path.join(dynamicSkillsPath, `${name}.js`), codeString, 'utf8');
            log('skillManager', `Saved and compiled new dynamic skill: ${name}`);
        }
        return true;
    } catch (err) {
        error('skillManager', `Syntax error compiling dynamic skill ${name}`, err.message);
        return false;
    }
};

export const loadCompositeSkills = () => {
    try {
        if (fs.existsSync(userSkillsPath)) {
            compositeSkills = JSON.parse(fs.readFileSync(userSkillsPath, 'utf8'));
            log('skillManager', `Loaded ${Object.keys(compositeSkills).length} composite skills from disk.`);
        }
    } catch (err) {
        error('skillManager', 'Failed to load composite skills', err.message);
    }
};

export const saveCompositeSkills = () => {
    try {
        fs.writeFileSync(userSkillsPath, JSON.stringify(compositeSkills, null, 2), 'utf8');
    } catch (err) {
        error('skillManager', 'Failed to save composite skills', err.message);
    }
};

export const createCompositeSkill = (name, actionSequence) => {
    compositeSkills[name] = actionSequence;
    saveCompositeSkills();
    log('skillManager', `Created new composite skill: ${name} utilizing [${actionSequence.join(', ')}]`);
};

export const executeAction = async (bot, actionName) => {
    log('skillManager', `Attempting to execute action: ${actionName}`);
    
    if (compositeSkills[actionName]) {
        log('skillManager', `Executing composite skill sequence: ${compositeSkills[actionName].join(' -> ')}`);
        for (const subAction of compositeSkills[actionName]) {
            const success = await executeAction(bot, subAction);
            if (!success) {
                error('skillManager', `Composite skill ${actionName} failed at step ${subAction}`);
                return false;
            }
        }
        log('skillManager', `Composite skill ${actionName} completed successfully.`);
        return true;
    }

    if (dynamicSkills[actionName]) {
        log('skillManager', `Executing AI-generated dynamic skill: ${actionName}`);
        return await dynamicSkills[actionName](bot, goals, log, error);
    }

    if (actionName.startsWith('CRAFT_')) {
        const itemName = actionName.substring(6).toLowerCase();
        return await craftItem(bot, itemName);
    }

    const skill = baseSkills[actionName];
    if (!skill) {
        error('skillManager', `Unknown action: ${actionName}`);
        return false;
    }

    try {
        const result = await skill(bot);
        return result;
    } catch (err) {
        error('skillManager', `Action ${actionName} failed`, err.message);
        return false;
    }
};

export const getAvailableActions = () => {
    return [...Object.keys(baseSkills), ...Object.keys(compositeSkills), ...Object.keys(dynamicSkills), 'CRAFT_<item_name>'];
};
