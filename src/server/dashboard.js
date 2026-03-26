// src/server/dashboard.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { log, setDashboardBroadcast } from '../utils/logger.js';
import { getMemory, recordImportantEvent, removeImportantEventByText } from '../memory/memory.js';
import { getBot } from '../bot/bot.js';
import { Vec3 } from 'vec3';
import { setLLMStatusBroadcast, MODEL } from '../brain/llm.js';

let io = null;

export const startDashboard = () => {
    const app = express();
    const server = http.createServer(app);
    io = new Server(server);

    setDashboardBroadcast((module, msg) => {
        if (io) io.emit('log', { module, msg, time: Date.now() });
    });

    // Wire up LLM status broadcast so the frontend knows what the model is doing
    setLLMStatusBroadcast((statusObj) => {
        if (io) io.emit('llm_status', statusObj);
    });


    const publicPath = path.join(process.cwd(), 'public');
    app.use(express.static(publicPath));

    let blocksCache = [];

    io.on('connection', (socket) => {
        log('dashboard', 'New client connected to dashboard');
        
        // Send initial state
        socket.emit('memory_update', getMemory());
        // Send current model info immediately on connect
        socket.emit('llm_status', { model: MODEL, status: 'idle', detail: 'Connected', time: Date.now() });
        try {
            const bot = getBot();
            if (bot && bot.entity) socket.emit('bot_position', bot.entity.position);
        } catch(e) {} // Ignore if bot not ready
        
        // Listen for user commands
        socket.on('inject_thought', (thought) => {
            log('dashboard', `Dashboard User injected thought: ${thought}`);
            recordImportantEvent(`USER OVERRIDE: ${thought}`);
            if (io) io.emit('memory_update', getMemory()); // force update
        });

        socket.on('delete_thought', (thoughtText) => {
            log('dashboard', `User manually deleted thought node containing: ${thoughtText}`);
            removeImportantEventByText(thoughtText);
            if (io) io.emit('memory_update', getMemory()); // force update
        });

        socket.on('link_thoughts', (data) => {
            const { sourceLabel, targetLabel } = data;
            const logEntry = `USER LOGIC RULE: If "${sourceLabel}" then "${targetLabel}"`;
            log('dashboard', `User created logical link: ${logEntry}`);
            recordImportantEvent(logEntry);
            if (io) io.emit('memory_update', getMemory());
        });

        socket.on('disconnect', () => {
            log('dashboard', 'Client disconnected');
        });
    });

    server.listen(3000, () => {
        log('dashboard', '🔥 Web Dashboard running on http://localhost:3000');
    });

    // Loop to continuously send bot position and minimap data
    setInterval(() => {
        let bot;
        try {
            bot = getBot();
        } catch(e) { return; }

        if (!bot || !bot.entity) return;
        
        io.emit('bot_position', {
            x: bot.entity.position.x,
            y: bot.entity.position.y,
            z: bot.entity.position.z,
            yaw: bot.entity.yaw,
            health: bot.health,
            food: bot.food,
            time: bot.time.timeOfDay
        });

        // Scan nearby blocks for minimap
        const p = bot.entity.position;
        const radius = 16;
        const newBlocks = [];
        
        for (let x = -radius; x <= radius; x++) {
            for (let z = -radius; z <= radius; z++) {
                // Find highest block
                const rx = Math.floor(p.x + x);
                const rz = Math.floor(p.z + z);
                // Simple heuristic: just check around current Y
                let y = Math.floor(p.y) + 5;
                let b = null;
                while (y > Math.floor(p.y) - 10) {
                    b = bot.blockAt(new Vec3(rx, y, rz));
                    if (b && b.name !== 'air' && b.name !== 'cave_air') {
                        break;
                    }
                    y--;
                }
                if (b && b.name !== 'air') {
                    newBlocks.push({ x: rx, z: rz, y: y, name: b.name });
                }
            }
        }
        io.emit('minimap_data', newBlocks);

    }, 1000);
};

export const broadcastLog = (module, msg) => {
    if (io) {
        io.emit('log', { module, msg, time: Date.now() });
    }
};

export const broadcastBrainNode = (id, label, type, parentId = null) => {
    if (io) {
        io.emit('brain_node', { id, label, type, parentId });
    }
};

export const updateDashboardMemory = () => {
    if (io) {
        io.emit('memory_update', getMemory());
    }
};
