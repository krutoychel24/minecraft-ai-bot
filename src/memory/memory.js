// src/memory/memory.js
import { log, error } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const memoryPath = path.join(process.cwd(), 'memory.json');

let memory = {
    previousActions: [],
    failures: [],
    inventory: {},
    importantEvents: [],
    recentDamage: []
};

export const loadMemory = () => {
    try {
        if (fs.existsSync(memoryPath)) {
            const data = fs.readFileSync(memoryPath, 'utf8');
            memory = JSON.parse(data);
            
            // Backfill missing arrays from older saves
            memory.importantEvents = memory.importantEvents || [];
            memory.recentDamage = memory.recentDamage || [];
            memory.previousActions = memory.previousActions || [];
            memory.failures = memory.failures || [];
            memory.inventory = memory.inventory || {};
            
            log('memory', 'Loaded existing memory from disk.');
        } else {
            log('memory', 'No existing memory found, starting fresh.');
            saveMemory();
        }
    } catch (err) {
        error('memory', 'Error loading memory. Starting fresh.', err.message);
    }
    return memory;
};

export const saveMemory = () => {
    try {
        fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2), 'utf8');
    } catch (err) {
        error('memory', 'Failed to save memory', err.message);
    }
};

export const recordAction = (actionName, thought, success, reason = '') => {
    // Keep last 15 actions to avoid prompt overflow but allow enough context
    memory.previousActions.push({ 
        action: actionName, 
        success: success, 
        time: Date.now() 
    });
    
    if (memory.previousActions.length > 15) {
        memory.previousActions.shift(); // Remove the oldest
    }
    
    if (!success) {
        memory.failures.push({ action: actionName, reason: reason, time: Date.now() });
        if (memory.failures.length > 15) {
            memory.failures.shift();
        }
    }
    
    saveMemory();
};

export const updateInventory = (inventoryData) => {
    memory.inventory = inventoryData;
    saveMemory();
};

export const getMemory = () => {
    return memory;
};

export const recordImportantEvent = (eventText) => {
    // Prevent duplicate spam of same event
    const lastEvent = memory.importantEvents[memory.importantEvents.length - 1];
    if (lastEvent && lastEvent.event === eventText) return;

    memory.importantEvents.push({ id: 'ev_' + Date.now(), event: eventText, time: Date.now() });
    log('memory', `Recorded Important Event: ${eventText}`);
    saveMemory();
};

export const removeImportantEventByText = (textSearch) => {
    // If user deletes an override from the dashboard, remove it
    memory.importantEvents = memory.importantEvents.filter(e => !e.event.includes(textSearch));
    saveMemory();
};

export const recordDamage = (amount) => {
    memory.recentDamage.push({ amount, time: Date.now() });
    if (memory.recentDamage.length > 5) {
        memory.recentDamage.shift();
    }
    saveMemory();
};

export const clearRecentDamage = () => {
    if (memory.recentDamage && memory.recentDamage.length > 0) {
        memory.recentDamage = [];
        saveMemory();
    }
};
