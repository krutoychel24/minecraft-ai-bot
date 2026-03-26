// src/brain/llm.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { log, error } from '../utils/logger.js';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
export const MODEL = 'mistral'; // Mistral 7B - much smarter than qwen2:1.5b

// Function to broadcast LLM status - set externally by dashboard
let _broadcastStatus = null;
export const setLLMStatusBroadcast = (fn) => { _broadcastStatus = fn; };
const emitStatus = (status, detail = '') => {
    if (_broadcastStatus) _broadcastStatus({ model: MODEL, status, detail, time: Date.now() });
};

export const askLLM = async (prompt) => {
    try {
        emitStatus('thinking', 'Building context prompt...');
        log('llm', `Sending prompt to Ollama (model: ${MODEL})...`);

        emitStatus('thinking', `Waiting for ${MODEL} response...`);
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.3, // Lower = more focused, less hallucination
                top_p: 0.9,
                num_predict: 2048,
            }
        });

        const text = response.data.response.trim();
        
        const debugText = `\n\n[${new Date().toISOString()}]\n--- PROMPT ---\n${prompt}\n\n--- RESPONSE ---\n${text}\n------------------------\n`;
        fs.appendFileSync(path.join(process.cwd(), 'llm_debug.log'), debugText, 'utf8');
        log('llm', `Raw response from Ollama received and saved to llm_debug.log`);
        
        const parsed = parseAction(text);
        emitStatus('idle', parsed?.action ? `Decided: ${parsed.action}` : 'Response parsed, no clear action found');
        return parsed;
    } catch (err) {
        error('llm', 'Failed to communicate with Ollama', err.message);
        emitStatus('error', err.message);
        return null;
    }
};

const parseAction = (text) => {
    // We expect "AI THOUGHT: <text>" and "ACTION: <NAME>"
    // Now we also expect "AI REFLECTION: <reflection>" if it failed previously.
    const thoughtMatch = text.match(/AI THOUGHT:\s*"?(.*?)"?(?:\n|$)/is);
    const reflectionMatch = text.match(/AI REFLECTION:\s*"?(.*?)"?(?:\n|$)/is);
    
    // Check for WRITE_SKILL
    const writeSkillMatch = text.match(/ACTION:\s*WRITE_SKILL\s+([A-Za-z0-9_]+)/i);
    let code = null;
    let action = null;
    let skillName = null;

    if (writeSkillMatch) {
        action = 'WRITE_SKILL';
        skillName = writeSkillMatch[1];
        // Parse the code block enclosed in ```javascript or ```
        const codeBlockMatch = text.match(/```(?:javascript|js)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch) {
            code = codeBlockMatch[1];
        } else {
            // fallback: grab everything after the action line
            const afterAction = text.split(/ACTION:\s*WRITE_SKILL.*\n/i)[1];
            if (afterAction) code = afterAction.trim();
        }
    } else {
        let actionMatch = text.match(/ACTION:\s*([A-Z0-9_]+)/);
        if (!actionMatch) actionMatch = text.match(/(?:ACTION|Action|action).*?([A-Z0-9_]+)/);
        action = actionMatch && actionMatch[1] ? actionMatch[1].toUpperCase() : null;
    }
    
    const thought = thoughtMatch ? thoughtMatch[1].trim() : 'No thought provided. Defaulting to action only.';
    const reflection = reflectionMatch ? reflectionMatch[1].trim() : null;
    
    if (!action) {
        log('llm', `Could not parse ACTION strictly from response.`);
    }
    
    return { reflection, thought, action, skillName, code };
};
