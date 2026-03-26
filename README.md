<div align="center">

<img src="https://img.shields.io/badge/Minecraft-62B47A?style=for-the-badge&logo=modrinth&logoColor=white" />
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" />
<img src="https://img.shields.io/badge/Mistral_7B-FF7000?style=for-the-badge&logo=openai&logoColor=white" />
<img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white" />

# 🤖 Minecraft AI Bot

**A fully autonomous Minecraft survival agent powered by a local LLM (Mistral 7B via Ollama).**  
The bot observes its environment, reasons about what to do next, executes actions, remembers past events, and even **writes its own JavaScript skills at runtime** when it needs to do something new.

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **LLM Reasoning** | Uses Mistral 7B locally via Ollama to plan every action |
| 🔄 **Autonomous Loop** | Continuously sense → think → act → remember |
| 📦 **Dynamic Skill Writing** | The AI writes new JavaScript skills on the fly (`WRITE_SKILL`) |
| 🧱 **Composite Skills** | Automatically chains successful action pairs into reusable macros |
| 📜 **Recipe Awareness** | Parses `recipes.json` to guide the LLM towards craftable items |
| 💾 **Persistent Memory** | Long-term memory stored in `memory.json` across sessions |
| 🗺️ **Live Dashboard** | Real-time web UI with minimap, brain graph, analytics & memory editor |
| 🩺 **LLM Status Feed** | Dashboard shows the active model, current status and last decision |
| ⚔️ **Combat & Survival** | Detects damage, chooses ATTACK or FLEE automatically |

---

## 🏗️ Architecture

```
minecraft-ai-bot/
├── src/
│   ├── index.js                  # Entry point – main loop & pattern recognition
│   ├── bot/
│   │   └── bot.js                # Mineflayer connection, health & event handling
│   ├── brain/
│   │   ├── llm.js                # Ollama API calls, status broadcasts, response parsing
│   │   ├── planner.js            # Builds the full context prompt for the LLM
│   │   ├── goals.js              # Dynamic goal evaluation based on inventory state
│   │   ├── recipeIndexer.js      # Parses recipes.json → craftable item hints for LLM
│   │   └── apiDocs.js            # Mineflayer API reference injected into the prompt
│   ├── actions/
│   │   ├── mineWood.js           # Tree detection + pathfinding + mining
│   │   ├── explore.js            # Random exploration within radius
│   │   ├── attack.js             # Nearest hostile mob targeting + combat
│   │   ├── flee.js               # Runs away from danger
│   │   ├── craft.js              # Generic crafting using recipe lookup
│   │   ├── placeCraftingTable.js # Places a crafting table and registers it
│   │   └── build.js              # Stub for future building actions
│   ├── skills/
│   │   ├── skillManager.js       # Registers/executes base, composite & dynamic skills
│   │   └── dynamic/              # Auto-saved JS files written by the AI at runtime
│   ├── memory/
│   │   └── memory.js             # Load/save/query persistent JSON memory
│   ├── server/
│   │   └── dashboard.js          # Express + Socket.IO web dashboard server
│   └── utils/
│       └── logger.js             # Timestamped console + socket log broadcaster
├── public/
│   ├── index.html                # Dashboard UI (tabs: Overview, Brain, Analytics, Memory)
│   ├── app.js                    # Frontend JS – Socket.IO client, minimap, charts
│   ├── style.css                 # Dark green-accent theme
│   └── recipes.json              # Full Minecraft recipe database (~50 KB)
├── package.json
└── .gitignore
```

---

## 🧠 How the AI Thinks

Every loop cycle the bot follows this pipeline:

```
┌────────────────────────────────────────────────────────────┐
│                     SENSE                                  │
│  Inventory · Nearby blocks · Tree radar · Health · Time    │
└───────────────────────────┬────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│                      THINK  (LLM)                          │
│  Goal · Memory · Failures · Recipes → Mistral 7B prompt    │
│  Output: AI THOUGHT + ACTION (or WRITE_SKILL)              │
└───────────────────────────┬────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│                      ACT                                   │
│  Base Skill │ Composite Skill │ Dynamic (AI-written) Skill │
└───────────────────────────┬────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│                    REMEMBER                                │
│  Record action result · Update inventory · Save memory     │
│  Pattern recognition → auto-create composite skills        │
└────────────────────────────────────────────────────────────┘
```

### Dynamic Skill Generation

When the bot encounters a goal that no built-in action can handle, it uses:

```
ACTION: WRITE_SKILL myCustomSkillName
\`\`\`javascript
// async code with access to: bot, goals, log, error
const block = bot.findBlock({ matching: ..., maxDistance: 32 });
await bot.pathfinder.goto(new goals.GoalBlock(...));
return true;
\`\`\`
```

The code is compiled at runtime via `AsyncFunction`, saved to `src/skills/dynamic/`, and immediately available in the next loop cycle.

---

## 🖥️ Dashboard

Open **http://localhost:3000** after starting the bot.

| Tab | What you see |
|---|---|
| **Overview** | LLM status card (model · status · last decision) · Minimap · Live log feed · Neurolink override input |
| **Brain Map** | Real-time Cytoscape.js graph of thought → action → result chains |
| **Analytics** | Success/failure donut chart · Action distribution bar chart |
| **Memory** | All long-term events with delete buttons |

#### LLM Status Card
The banner at the top of Overview shows:
- 🟢 **`IDLE`** — model responded, waiting for next cycle
- 🟡 **`THINKING`** — currently querying Mistral (animated dots + card pulsing glow)
- 🔴 **`ERROR`** — Ollama unreachable or model error

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Ollama](https://ollama.com/) installed and running locally
- A Minecraft Java Edition server (local or remote)

### 1. Install Ollama and pull Mistral

```bash
# Install Ollama from https://ollama.com/
ollama pull mistral
```

### 2. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/minecraft-ai-bot.git
cd minecraft-ai-bot
npm install
```

### 3. Start your Minecraft server

Start any Minecraft Java server on `localhost:25565` (default port).  
The bot connects with username `AIAgent` and auto-detects the server version.

### 4. Run the bot

```bash
npm start
```

Then open **http://localhost:3000** for the live dashboard.

---

## ⚙️ Configuration

All config is in [`src/bot/bot.js`](src/bot/bot.js) and [`src/brain/llm.js`](src/brain/llm.js):

| Setting | File | Default | Description |
|---|---|---|---|
| `host` | `bot.js` | `localhost` | Minecraft server host |
| `port` | `bot.js` | `25565` | Minecraft server port |
| `username` | `bot.js` | `AIAgent` | Bot's in-game name |
| `MODEL` | `llm.js` | `mistral` | Ollama model to use |
| `temperature` | `llm.js` | `0.3` | Lower = more focused reasoning |
| `SLEEP_BETWEEN_ACTIONS_MS` | `index.js` | `2000` | Pause between action cycles |

---

## 🧩 Skill System

### Base Skills (always available)

| Action | Description |
|---|---|
| `MINE_WOOD` | Find nearest tree and mine logs |
| `EXPLORE` | Move to a random nearby position |
| `ATTACK` | Target and attack nearest hostile mob |
| `FLEE` | Run away from danger |
| `CRAFT_<item>` | Craft any item by name using recipe lookup |
| `PLACE_CRAFTING_TABLE` | Place a crafting table from inventory |

### Composite Skills (auto-generated)

When the bot repeats a successful action pair 2 times in a row (e.g., `MINE_WOOD → CRAFT_OAK_PLANKS`), it automatically chains them into a new reusable skill stored in `skills.json`.

### Dynamic Skills (AI-written)

The LLM can write arbitrary Mineflayer JavaScript code for any task. Skills are saved in `src/skills/dynamic/` and hot-loaded on the next restart.

---

## 📊 Prompt Engineering

The LLM receives a rich context every cycle:

```
- Current goal (derived from inventory state)
- Time of day & health/food status
- Recent damage warnings
- Full inventory
- Nearby blocks (16-block radius)
- Tree radar (64-block radius)
- Last 15 actions + failures
- Top 10 long-term memory events
- Craftable recipe hints (from recipes.json)
- Full list of available actions
- Mineflayer API reference docs
- Response format instructions
```

---

## 🛠️ Tech Stack

| Library | Version | Role |
|---|---|---|
| [mineflayer](https://github.com/PrismarineJS/mineflayer) | 4.20 | Minecraft bot framework |
| [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) | 2.4 | A\* pathfinding |
| [mineflayer-collectblock](https://github.com/PrismarineJS/mineflayer-collectblock) | 1.4 | Block collection helper |
| [Ollama](https://ollama.com/) | latest | Local LLM inference |
| [Mistral 7B](https://mistral.ai/) | latest | Language model |
| [axios](https://axios-http.com/) | 1.6 | HTTP client for Ollama API |
| [express](https://expressjs.com/) | 5.2 | Dashboard HTTP server |
| [socket.io](https://socket.io/) | 4.8 | Real-time dashboard updates |
| [Chart.js](https://www.chartjs.org/) | latest | Analytics charts |
| [Cytoscape.js](https://cytoscape.org/) | 3.28 | Brain graph visualization |

---

## 📄 License

MIT — feel free to use, modify, and distribute.
