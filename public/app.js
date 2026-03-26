document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM ---
    const systemStatus = document.getElementById('system-status');
    const statusText = document.getElementById('status-text');
    const pageTitle = document.getElementById('page-title');
    const healthBar = document.getElementById('health-bar');
    const healthVal = document.getElementById('health-val');
    const foodBar = document.getElementById('food-bar');
    const foodVal = document.getElementById('food-val');
    const timeVal = document.getElementById('time-val');
    const coordVal = document.getElementById('coord-val');
    const logsContainer = document.getElementById('logs');
    const minimap = document.getElementById('minimap');
    const ctx = minimap.getContext('2d');
    const overrideInput = document.getElementById('override-input');
    const overrideBtn = document.getElementById('override-btn');
    const importantEventsList = document.getElementById('important-events');

    // LLM status elements
    const llmModelName = document.getElementById('llm-model-name');
    const llmDetail = document.getElementById('llm-detail');
    const llmBadge = document.getElementById('llm-badge');
    const llmDots = document.getElementById('llm-dots');
    const llmCard = document.getElementById('llm-status-card');


    // --- TABS ---
    const tabNames = { overview: 'Overview', brain: 'Brain Map', analytics: 'Analytics', memory: 'Memory' };
    document.querySelectorAll('.nav-links li').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            const tab = item.getAttribute('data-tab');
            document.getElementById('tab-' + tab).classList.add('active');
            pageTitle.innerText = tabNames[tab] || tab;
            if (tab === 'brain') setTimeout(() => cy.fit(undefined, 40), 50);
        });
    });

    // --- CYTOSCAPE.JS ---
    const cy = cytoscape({
        container: document.getElementById('cy'),
        style: [
            { selector: 'node', style: {
                'label': 'data(label)',
                'text-wrap': 'wrap',
                'text-max-width': '180px',
                'font-family': 'Inter',
                'font-size': '12px',
                'font-weight': '500',
                'color': '#FFFFFF',
                'text-valign': 'center',
                'text-halign': 'center',
                'background-color': '#0F1B07',
                'border-width': 2,
                'border-color': '#5C821A',
                'padding': '16px',
                'shape': 'roundrectangle',
                'width': 'label',
                'height': 'label',
                'box-shadow': '0 4px 12px rgba(92,130,26,.2)'
            }},
            { selector: 'node.thought', style: { 'border-color': '#C6D166', 'background-color': '#000000', 'color': '#C6D166' }},
            { selector: 'node.action', style: { 'border-color': '#5C821A', 'background-color': '#C6D166', 'color': '#000000', 'font-weight': '600' }},
            { selector: 'node.failure', style: { 'border-color': '#ff4d4f', 'background-color': '#1a0505', 'color': '#ff4d4f' }},
            { selector: 'node.reflection', style: { 'border-color': '#FFFFFF', 'background-color': '#081003', 'color': '#FFFFFF' }},
            { selector: 'node.user', style: { 'border-color': '#C6D166', 'background-color': '#5C821A', 'color': '#FFFFFF', 'font-weight': 'bold', 'border-style': 'solid' }},
            { selector: 'edge', style: {
                'width': 2,
                'line-color': '#C6D166',
                'target-arrow-color': '#C6D166',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'arrow-scale': 1.2
            }},
            { selector: '.eh-handle', style: {
                'background-color': '#5C821A',
                'width': 12,
                'height': 12,
                'shape': 'ellipse',
                'overlay-opacity': 0,
                'border-width': 2,
                'border-color': '#FFFFFF'
            }},
            { selector: '.eh-source, .eh-target', style: {
                'border-width': 3,
                'border-color': '#5C821A'
            }},
            { selector: '.eh-preview, .eh-ghost-edge', style: { 'line-color': '#5C821A', 'target-arrow-color': '#5C821A', 'line-style': 'dashed' }}
        ],
        layout: { name: 'preset' },
        wheelSensitivity: 0.3
    });

    // Edge handles plugin (draw edges by dragging from node edge)
    if (cy.edgehandles) {
        cy.edgehandles({
            snap: true,
            noEdgeEventsInDraw: true,
            handlePosition: () => 'middle middle'
        });
    }

    // Capture User-drawn edges to tell the LLM
    cy.on('ehcomplete', (event, sourceNode, targetNode, addedEdge) => {
        const srcText = sourceNode.data('label').replace('USER: ', '').trim();
        const trgText = targetNode.data('label').replace('USER: ', '').trim();
        socket.emit('link_thoughts', { sourceLabel: srcText, targetLabel: trgText });
    });

    let lastNodeId = null;
    let nodeCount = 0;
    const MAX_NODES = 40;

    const addBrainNode = (id, label, type, parentId) => {
        // Spawn randomly with some grid alignment
        const x = 150 + (nodeCount % 4) * 220 + (Math.random()*40 - 20);
        const y = 100 + Math.floor(nodeCount / 4) * 160 + (Math.random()*20 - 10);

        cy.add({ data: { id: id, label: label }, position: { x, y }, classes: type });

        // Only auto-link AI actions, NOT user logic boxes (User builds them explicitly)
        if (type !== 'user') {
            if (parentId && cy.getElementById(parentId).length) {
                cy.add({ data: { source: parentId, target: id } });
            } else if (lastNodeId && cy.getElementById(lastNodeId).length) {
                const prevType = cy.getElementById(lastNodeId).classes()[0];
                if (prevType !== 'user') {
                    cy.add({ data: { source: lastNodeId, target: id } });
                }
            }
        }

        lastNodeId = id;
        nodeCount++;

        // Remove oldest if too many AI thoughts
        let aiNodes = cy.nodes().filter(n => !n.hasClass('user'));
        if (aiNodes.length > MAX_NODES) {
            cy.remove(aiNodes[0]);
        }
    };

    // --- CHART.JS ---
    let memoryState = null;

    Chart.defaults.color = '#FFFFFF';
    Chart.defaults.font.family = 'Inter';

    const successChart = new Chart(document.getElementById('successChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Success', 'Failure'], datasets: [{ data: [0, 0], backgroundColor: ['#C6D166', '#ff4d4f'], borderWidth: 0, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    const actionChart = new Chart(document.getElementById('actionChart').getContext('2d'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Uses', data: [], backgroundColor: '#5C821A', borderRadius: 6 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { grid: { color: 'rgba(92,130,26,.2)' } }, x: { grid: { display: false } } },
            plugins: { legend: { display: false } }
        }
    });

    const updateCharts = () => {
        if (!memoryState) return;
        
        importantEventsList.innerHTML = '';
        (memoryState.importantEvents || []).slice().reverse().forEach(ev => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="memory-left">
                    <span class="memory-time">${new Date(ev.time).toLocaleTimeString()}</span>
                    <span class="memory-text">${ev.event}</span>
                </div>
                <button class="memory-del" data-event="${ev.event.replace(/"/g, '&quot;')}">
                    <span class="material-icons-round">delete_outline</span>
                </button>`;
            importantEventsList.appendChild(li);
        });

        document.querySelectorAll('.memory-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-event');
                socket.emit('delete_thought', text);
                btn.closest('li').remove();
            });
        });

        const history = memoryState.previousActions || [];
        let s = 0, f = 0;
        const ac = {};
        history.forEach(a => { if (a.success) s++; else f++; ac[a.action] = (ac[a.action] || 0) + 1; });

        successChart.data.datasets[0].data = [s, f];
        successChart.update();

        const sorted = Object.entries(ac).sort((a, b) => b[1] - a[1]).slice(0, 6);
        actionChart.data.labels = sorted.map(x => x[0].replace('WRITE_SKILL', 'WRITE'));
        actionChart.data.datasets[0].data = sorted.map(x => x[1]);
        actionChart.update();
    };

    // --- SOCKET ---
    let botPos = { x: 0, y: 0, z: 0, yaw: 0 };
    let offlineTimer = null;

    socket.on('memory_update', d => { memoryState = d; updateCharts(); });

    socket.on('llm_status', d => {
        if (!d) return;
        // Model name
        llmModelName.textContent = d.model || '—';
        // Detail text
        llmDetail.textContent = d.detail || '';
        // Badge + card glow
        const s = d.status || 'idle';
        llmBadge.textContent = s;
        llmBadge.className = 'llm-badge llm-badge-' + s;
        llmCard.className = 'card llm-status-card llm-card-' + s;
        // Thinking animation dots
        llmDots.style.display = (s === 'thinking') ? 'flex' : 'none';
    });

    socket.on('bot_position', d => {
        botPos = d;
        systemStatus.classList.add('online');
        statusText.innerText = 'Online';
        clearTimeout(offlineTimer);
        offlineTimer = setTimeout(() => { systemStatus.classList.remove('online'); statusText.innerText = 'Offline'; }, 3000);

        if (d.health !== undefined) {
            healthBar.style.width = `${(d.health / 20) * 100}%`;
            healthVal.innerText = `${Math.round(d.health)}/20`;
            foodBar.style.width = `${(d.food / 20) * 100}%`;
            foodVal.innerText = `${Math.round(d.food)}/20`;
            coordVal.innerText = `${Math.round(d.x)} ${Math.round(d.y)} ${Math.round(d.z)}`;
            timeVal.innerText = (d.time >= 13000 && d.time <= 23000) ? `Night (${d.time})` : `Day (${d.time})`;
        }
    });

    socket.on('log', ld => {
        const div = document.createElement('div');
        const t = new Date(ld.time).toLocaleTimeString();
        let tc = '';
        if (ld.msg.includes('THOUGHT')) tc = 'type-thought';
        if (ld.msg.includes('AI decided') || ld.msg.includes('Action')) tc = 'type-action';
        if (ld.msg.includes('Failed') || ld.msg.includes('ERROR')) tc = 'type-error';
        div.className = `log-entry ${tc}`;
        div.innerHTML = `<span class="log-time">[${t}]</span><span class="log-module">[${ld.module.toUpperCase()}]</span><span class="log-msg">${ld.msg}</span>`;
        logsContainer.appendChild(div);
        if (logsContainer.childNodes.length > 60) logsContainer.removeChild(logsContainer.firstChild);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    });

    socket.on('brain_node', nd => {
        addBrainNode(nd.id, nd.label, nd.type, nd.parentId);
    });

    // Minimap
    const BC = { air: '#000000', stone: '#333333', dirt: '#4A3525', grass_block: '#5C821A', water: '#1A5276', lava: '#ff4d4f', wood: '#6B5441', leaves: '#145A32', sand: '#E4D5B7' };
    socket.on('minimap_data', blocks => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 400, 400);
        const r = 16, cs = 400 / (r * 2 + 1);
        blocks.forEach(b => {
            const cx = (b.x - Math.floor(botPos.x) + r) * cs;
            const cy2 = (b.z - Math.floor(botPos.z) + r) * cs;
            let c = '#000000';
            for (const [k, v] of Object.entries(BC)) { if (b.name.includes(k)) c = v; }
            ctx.fillStyle = c;
            ctx.fillRect(cx, cy2, cs, cs);
            ctx.strokeStyle = 'rgba(92,130,26,.2)';
            ctx.strokeRect(cx, cy2, cs, cs);
        });
        const ctr = r * cs;
        ctx.fillStyle = '#C6D166';
        ctx.beginPath();
        ctx.arc(ctr + cs / 2, ctr + cs / 2, cs * 0.6, 0, Math.PI * 2);
        ctx.fill();
    });

    // Inject
    const doInject = () => {
        const val = overrideInput.value.trim();
        if (!val) return;
        socket.emit('inject_thought', val);
        overrideInput.value = '';
        addBrainNode('USER_' + Date.now(), 'USER: ' + val, 'user', null);
    };
    overrideBtn.addEventListener('click', doInject);
    overrideInput.addEventListener('keydown', e => { if (e.key === 'Enter') doInject(); });
});
