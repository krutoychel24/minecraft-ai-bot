// src/utils/logger.js

let broadcastFn = null;

export const setDashboardBroadcast = (fn) => {
    broadcastFn = fn;
};

export const log = (module, message) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] [${module.toUpperCase()}] ${message}`);
    if (broadcastFn) broadcastFn(module, message);
};

export const error = (module, message, err) => {
    const time = new Date().toLocaleTimeString();
    console.error(`[${time}] [${module.toUpperCase()}] ERROR: ${message}`, err || '');
    if (broadcastFn) broadcastFn(module, `ERROR: ${message} ${err || ''}`);
};
