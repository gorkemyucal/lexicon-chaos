// ═══════════════════════════════════════════════════════════════
//  LEXICON CHAOS — Mobile-Exclusive Game Logic
// ═══════════════════════════════════════════════════════════════

(() => {
    // ── Matter.js aliases ──────────────────────────────────────
    const { Engine, Runner, Bodies, Body, Composite } = Matter;

    // ── DOM refs ───────────────────────────────────────────────
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('scoreDisplay');
    const highScoreEl = document.getElementById('highScoreDisplay');
    const barFill = document.getElementById('wordBarFill');
    const wordBarWrap = document.querySelector('.word-bar-wrap');
    const overlay = document.getElementById('gameOverOverlay');
    const finalScoreEl = document.getElementById('finalScore');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const startOverlay = document.getElementById('startOverlay');
    const startBtn = document.getElementById('startBtn');
    const bgMusic = document.getElementById('bgMusic');
    const musicToggle = document.getElementById('musicToggle');
    const typingHud = document.getElementById('typingHud');
    const typingHudContent = document.getElementById('typingHudContent');
    const mobileInput = document.getElementById('mobileInput');

    // ── Constants ──────────────────────────────────────────────
    const MAX_WORDS = 15;
    const SPAWN_INTERVAL = 2200; // slightly slower for mobile
    const FONT_SIZE = 18;   // minimum readable on mobile

    // 60+ Computer Science / Engineering words (short-to-medium for mobile widths)
    const WORD_POOL = [
        // ── Languages ────────────────────────────
        'python', 'java', 'rust', 'golang', 'swift',
        'kotlin', 'ruby', 'php', 'scala', 'lua',
        'dart', 'sql', 'bash', 'perl', 'css',
        // ── Core CS ──────────────────────────────
        'algorithm', 'binary', 'stack', 'queue', 'array',
        'tree', 'graph', 'heap', 'hash', 'node',
        'loop', 'mutex', 'thread', 'class', 'object',
        'pointer', 'struct', 'enum', 'tuple', 'set',
        // ── Dev Tools ────────────────────────────
        'github', 'docker', 'linux', 'nginx', 'redis',
        'git', 'npm', 'yarn', 'webpack', 'vite',
        'debug', 'deploy', 'build', 'merge', 'push',
        'pull', 'commit', 'branch', 'clone', 'patch',
        // ── Web & Cloud ──────────────────────────
        'api', 'cloud', 'server', 'client', 'proxy',
        'cache', 'route', 'token', 'cors', 'dom',
        'react', 'vue', 'next', 'flask', 'django',
        // ── Infra & Security ─────────────────────
        'kernel', 'shell', 'socket', 'packet', 'port',
        'cipher', 'key', 'ssh', 'ssl', 'dns',
        'load', 'shard', 'log', 'cron', 'pipe',
        // ── Concepts ─────────────────────────────
        'syntax', 'scope', 'async', 'await', 'fetch',
        'render', 'parse', 'compile', 'link', 'buffer',
        'refactor', 'runtime', 'pixel', 'byte', 'bit',
    ];

    // ── State ──────────────────────────────────────────────────
    let engine, runner;
    let walls = [];
    let wordBodies = [];
    let score = 0;
    let highScore = parseInt(localStorage.getItem('lexicon_highscore')) || 0;
    let lockedWord = null;
    let spawnTimer = null;
    let gameRunning = false;
    let particles = [];
    let musicPlaying = false;

    // Detect touch vs desktop
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    // Viewport dimensions (updated on resize / keyboard)
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let keyboardHeight = 0;

    highScoreEl.textContent = `Best: ${highScore}`;
    bgMusic.volume = 0.3;

    // ═════════════════════════════════════════════════════════════
    //  Visual Viewport — handle virtual keyboard resize
    // ═════════════════════════════════════════════════════════════
    function updateViewport() {
        if (window.visualViewport) {
            vw = window.visualViewport.width;
            vh = window.visualViewport.height;
            keyboardHeight = window.innerHeight - vh;
        } else {
            vw = window.innerWidth;
            vh = window.innerHeight;
            keyboardHeight = 0;
        }

        canvas.width = vw;
        canvas.height = vh;

        // Reposition typing HUD above the keyboard
        const hudBottom = keyboardHeight > 50 ? (keyboardHeight + 8) : 20;
        typingHud.style.bottom = hudBottom + 'px';

        // Move density bar above the HUD
        const barBottom = hudBottom + 62;
        wordBarWrap.style.bottom = barBottom + 'px';
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            updateViewport();
            rebuildWalls();
        });
    }
    window.addEventListener('resize', () => {
        updateViewport();
        rebuildWalls();
    });

    updateViewport();

    // ═════════════════════════════════════════════════════════════
    //  Typing HUD
    // ═════════════════════════════════════════════════════════════
    function updateTypingHud() {
        if (!lockedWord) {
            typingHud.classList.remove('active');
            typingHudContent.innerHTML =
                '<span class="typing-hud-idle">AWAITING INPUT<span class="typing-hud-cursor">_</span></span>';
            return;
        }

        typingHud.classList.add('active');
        const typed = lockedWord.word.substring(0, lockedWord.typedCount);
        const remaining = lockedWord.word.substring(lockedWord.typedCount);

        typingHudContent.innerHTML =
            `<span class="typing-hud-typed">${typed}</span>` +
            `<span class="typing-hud-remaining">${remaining}</span>` +
            `<span class="typing-hud-cursor">_</span>`;
    }

    // ═════════════════════════════════════════════════════════════
    //  Screen Shake Effect
    // ═════════════════════════════════════════════════════════════
    function triggerScreenShake() {
        canvas.classList.remove('screen-shake');
        // Force reflow for re-triggering animation
        void canvas.offsetWidth;
        canvas.classList.add('screen-shake');
        // Also trigger haptic feedback if supported
        if (navigator.vibrate) navigator.vibrate(40);
    }

    // ═════════════════════════════════════════════════════════════
    //  Audio
    // ═════════════════════════════════════════════════════════════
    function playMusic() {
        bgMusic.play().then(() => {
            musicPlaying = true;
            musicToggle.textContent = '🔊';
            musicToggle.classList.add('playing');
        }).catch(() => { musicPlaying = false; });
    }

    function pauseMusic() {
        bgMusic.pause();
        musicPlaying = false;
        musicToggle.textContent = '🔇';
        musicToggle.classList.remove('playing');
    }

    musicToggle.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (musicPlaying) { pauseMusic(); } else { playMusic(); }
    });
    musicToggle.addEventListener('click', (e) => {
        e.preventDefault();
        if (musicPlaying) { pauseMusic(); } else { playMusic(); }
    });

    // ═════════════════════════════════════════════════════════════
    //  Engine & Walls
    // ═════════════════════════════════════════════════════════════
    function createEngine() {
        engine = Engine.create();
        engine.world.gravity.y = 0.05; // slight downward drift for vertical feel
        engine.world.gravity.x = 0;
        runner = Runner.create();
    }

    function createWalls() {
        const w = canvas.width;
        const h = canvas.height;
        const t = 40;
        const opts = { isStatic: true, restitution: 1, friction: 0, frictionStatic: 0 };
        walls = [
            Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, opts),
            Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, opts),
            Bodies.rectangle(-t / 2, h / 2, t, h + t * 2, opts),
            Bodies.rectangle(w + t / 2, h / 2, t, h + t * 2, opts),
        ];
        Composite.add(engine.world, walls);
    }

    function rebuildWalls() {
        if (!engine) return;
        for (const w of walls) Composite.remove(engine.world, w);
        createWalls();
    }

    // ═════════════════════════════════════════════════════════════
    //  Word Spawning
    // ═════════════════════════════════════════════════════════════
    function spawnWord() {
        if (!gameRunning) return;
        if (wordBodies.length >= MAX_WORDS) { endGame(); return; }

        const word = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
        const pad = 60;
        const x = pad + Math.random() * (canvas.width - pad * 2);
        const y = pad + Math.random() * (canvas.height * 0.6); // upper 60% of visible area

        const bw = word.length * FONT_SIZE + 20;
        const bh = 36;

        const body = Bodies.rectangle(x, y, bw, bh, {
            restitution: 0.9,
            friction: 0,
            frictionAir: 0.001,
            frictionStatic: 0,
            density: 0.001,
            chamfer: { radius: 5 },
        });

        const speed = 1 + Math.random() * 1.5;
        const angle = Math.random() * Math.PI * 2;
        Body.setVelocity(body, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.03);

        Composite.add(engine.world, body);
        wordBodies.push({ body, word, typedCount: 0 });

        updateBar();
        if (wordBodies.length >= MAX_WORDS) endGame();
    }

    // ═════════════════════════════════════════════════════════════
    //  Word Destruction & Scoring
    // ═════════════════════════════════════════════════════════════
    function destroyWord(entry) {
        const pos = entry.body.position;
        for (let i = 0; i < 16; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 2 + Math.random() * 4;
            particles.push({
                x: pos.x, y: pos.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                life: 1,
                color: Math.random() > 0.5 ? '#00ffc8' : '#ff6ecf',
                size: 2.5 + Math.random() * 3.5,
            });
        }

        Composite.remove(engine.world, entry.body);
        wordBodies = wordBodies.filter(wb => wb !== entry);
        lockedWord = null;

        score += entry.word.length * 10;
        scoreEl.textContent = `Score: ${score}`;
        if (score > highScore) {
            highScore = score;
            highScoreEl.textContent = `Best: ${highScore}`;
            localStorage.setItem('lexicon_highscore', highScore);
        }

        updateBar();
        updateTypingHud();
        triggerScreenShake();
    }

    // ═════════════════════════════════════════════════════════════
    //  Bar
    // ═════════════════════════════════════════════════════════════
    function updateBar() {
        const pct = Math.min(100, (wordBodies.length / MAX_WORDS) * 100);
        barFill.style.width = pct + '%';
    }

    // ═════════════════════════════════════════════════════════════
    //  Input Handling (mobile virtual keyboard)
    // ═════════════════════════════════════════════════════════════
    function focusInput() {
        mobileInput.value = '';
        mobileInput.focus({ preventScroll: true });
    }

    // Use 'input' event — works reliably on mobile virtual keyboards
    mobileInput.addEventListener('input', (e) => {
        if (!gameRunning) return;

        const val = mobileInput.value;
        if (!val) return;

        // Process each character typed
        const chars = val.toLowerCase().split('');
        mobileInput.value = ''; // clear immediately

        for (const ch of chars) {
            if (ch.length !== 1 || !/[a-z]/.test(ch)) continue;
            processChar(ch);
        }
    });

    // Physical keyboard support (desktop & external keyboards)
    document.addEventListener('keydown', (e) => {
        if (!gameRunning) return;
        // Skip if the hidden input already handled this via the 'input' event
        if (isTouchDevice && document.activeElement === mobileInput) return;
        if (e.key.length !== 1) return;
        const ch = e.key.toLowerCase();
        if (!/[a-z]/.test(ch)) return;
        processChar(ch);
    });

    function processChar(ch) {
        if (lockedWord) {
            const nextChar = lockedWord.word[lockedWord.typedCount];
            if (ch === nextChar) {
                lockedWord.typedCount++;
                if (lockedWord.typedCount >= lockedWord.word.length) {
                    destroyWord(lockedWord);
                } else {
                    updateTypingHud();
                }
            } else {
                lockedWord.typedCount = 0;
                lockedWord = null;
                updateTypingHud();
            }
        } else {
            const candidates = wordBodies.filter(wb => wb.word[0] === ch);
            if (candidates.length > 0) {
                candidates.sort((a, b) => a.word.length - b.word.length);
                lockedWord = candidates[0];
                lockedWord.typedCount = 1;
                if (lockedWord.word.length === 1) {
                    destroyWord(lockedWord);
                } else {
                    updateTypingHud();
                }
            }
        }
    }

    // Keep input focused during gameplay (mobile only)
    mobileInput.addEventListener('blur', () => {
        if (isTouchDevice && gameRunning) {
            setTimeout(() => { if (gameRunning) focusInput(); }, 100);
        }
    });

    // ═════════════════════════════════════════════════════════════
    //  Canvas Rendering
    // ═════════════════════════════════════════════════════════════
    function drawGrid() {
        ctx.strokeStyle = 'rgba(255,255,255,.025)';
        ctx.lineWidth = 1;
        const step = 50;
        for (let x = 0; x < canvas.width; x += step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += step) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
    }

    function drawWordBodies() {
        for (const entry of wordBodies) {
            const { body, word, typedCount } = entry;
            const { x, y } = body.position;
            const angle = body.angle;
            const isLocked = entry === lockedWord;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            const bw = word.length * FONT_SIZE + 20;
            const bh = 36;

            if (isLocked) {
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 18;
            }

            ctx.fillStyle = isLocked ? 'rgba(255, 215, 0, .12)' : 'rgba(255,255,255,.06)';
            ctx.strokeStyle = isLocked ? 'rgba(255, 215, 0, .6)' : 'rgba(255,255,255,.15)';
            ctx.lineWidth = 1.5;
            roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 5);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;

            ctx.font = `600 ${FONT_SIZE}px "Orbitron", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (typedCount > 0 && isLocked) {
                const typed = word.substring(0, typedCount);
                const untyped = word.substring(typedCount);
                const fullW = ctx.measureText(word).width;
                const typedW = ctx.measureText(typed).width;
                const startX = -fullW / 2;

                ctx.textAlign = 'left';
                ctx.fillStyle = '#00ff88';
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 10;
                ctx.fillText(typed, startX, 0);
                ctx.shadowBlur = 0;

                ctx.fillStyle = 'rgba(255,255,255,.8)';
                ctx.fillText(untyped, startX + typedW, 0);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,.8)';
                ctx.fillText(word, 0, 0);
            }

            ctx.restore();
        }
    }

    function drawParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.028;
            if (p.life <= 0) { particles.splice(i, 1); continue; }

            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r);
        c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h);
        c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
    }

    // ═════════════════════════════════════════════════════════════
    //  Game Loop
    // ═════════════════════════════════════════════════════════════
    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        drawWordBodies();
        drawParticles();
        requestAnimationFrame(gameLoop);
    }

    // ═════════════════════════════════════════════════════════════
    //  Game Over
    // ═════════════════════════════════════════════════════════════
    function endGame() {
        gameRunning = false;
        clearInterval(spawnTimer);
        Runner.stop(runner);
        mobileInput.blur();

        finalScoreEl.textContent = `Final Score: ${score}`;
        overlay.classList.add('visible');

        lockedWord = null;
        updateTypingHud();
    }

    // ═════════════════════════════════════════════════════════════
    //  Start / Restart
    // ═════════════════════════════════════════════════════════════
    function startGame() {
        if (engine) Composite.clear(engine.world, false);

        wordBodies = [];
        particles = [];
        lockedWord = null;
        score = 0;
        scoreEl.textContent = 'Score: 0';
        overlay.classList.remove('visible');
        updateBar();
        updateTypingHud();

        createEngine();
        updateViewport();
        createWalls();

        Runner.run(runner, engine);
        gameRunning = true;
        spawnTimer = setInterval(spawnWord, SPAWN_INTERVAL);
        spawnWord();

        // Focus hidden input → summon virtual keyboard (mobile only)
        if (isTouchDevice) setTimeout(focusInput, 150);

        if (!musicPlaying) playMusic();
    }

    // ═════════════════════════════════════════════════════════════
    //  Event Listeners
    // ═════════════════════════════════════════════════════════════
    playAgainBtn.addEventListener('touchend', (e) => { e.preventDefault(); startGame(); });
    playAgainBtn.addEventListener('click', (e) => { e.preventDefault(); startGame(); });

    startBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        startOverlay.classList.add('hidden');
        startGame();
    });
    startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        startOverlay.classList.add('hidden');
        startGame();
    });

    // Prevent context menu on long press
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // ═════════════════════════════════════════════════════════════
    //  Boot
    // ═════════════════════════════════════════════════════════════
    gameLoop();
})();
