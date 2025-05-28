// Optimized game state and logic
const game = {
  letters: [],
  currentWord: [],
  foundWords: new Set(),
  score: 0,
  possibleWords: [],
  debugMode: false,
  wordList: [],
  isDailyChallenge: false,
  gameFinished: false,
  currentLevel: 10, // Initialize to lowest level

  // Seeded random number generator
  seededRandom: function (seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  },

  getDailySeed: function () {
    const now = new Date();
    return (
      now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
    );
  },

  init: async function () {
    this.wordList = await this.loadWordList();

    // Check URL parameters - make daily mode the default
    const urlParams = new URLSearchParams(window.location.search);
    this.isDailyChallenge = urlParams.get("free") !== "true";

    this.generateLetters();
    this.setupEventListeners();
    this.updateScore();
    this.updateModeDisplay();
    confetti.init();
  },

  loadWordList: async function () {
    try {
      const response = await fetch("enable.txt");
      if (!response.ok) throw new Error("Word list load failed");
      const text = await response.text();
      return text.split(/\r?\n/);
    } catch (err) {
      console.error("INVALID WORD LIST", err);
    }
  },

  generateLetters: function () {
    const vowels = "AEIOU".split("");
    const consonants = "BCDFGHJKLMNPQRSTVWXYZ".split("");

    let randomFunc;
    if (this.isDailyChallenge) {
      const seed = this.getDailySeed();
      let seedCounter = seed;
      randomFunc = () => this.seededRandom(seedCounter++);
    } else {
      randomFunc = Math.random;
    }

    // Get center vowel
    const centerIndex = Math.floor(randomFunc() * vowels.length);
    const centerVowel = vowels.splice(centerIndex, 1)[0];

    // Get additional vowel and consonants using Fisher-Yates shuffle
    const shuffle = (array) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(randomFunc() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    const additionalVowels = shuffle(vowels).slice(0, 1);
    const selectedConsonants = shuffle(consonants).slice(0, 5);

    // Shuffle all letters except center
    this.letters = [centerVowel];
    const otherLetters = shuffle([...additionalVowels, ...selectedConsonants]);
    this.letters = [centerVowel, ...otherLetters];

    this.updateLetterDisplays();
    this.calculatePossibleWords();
  },

  updateModeDisplay: function () {
    const modeEl = document.getElementById("game-mode");
    const newGameBtn = document.getElementById("new-game");
    if (this.isDailyChallenge) {
      const today = new Date().toLocaleDateString();
      modeEl.textContent = `Daily Challenge`;
      newGameBtn.textContent = "Free Play";
    } else {
      modeEl.textContent = "Free Play";
      newGameBtn.textContent = "New Game";
    }
  },

  toggleGameMode: function () {
    const newUrl = new URL(window.location.href);
    this.isDailyChallenge = !this.isDailyChallenge;
    if (!this.isDailyChallenge) {
      newUrl.searchParams.set("free", "true");
    } else {
      newUrl.searchParams.delete("free");
    }
    this.updateModeDisplay();
    window.location.href = newUrl.toString();
  },

  getRandomLetters: function (pool, count) {
    return Array(count)
      .fill()
      .map(() => pool[Math.floor(Math.random() * pool.length)]);
  },

  updateLetterDisplays: function () {
    document.getElementById("center-square").textContent = this.letters[0];
    document.querySelectorAll(".square:not(.center)").forEach((square, i) => {
      square.textContent = this.letters[i + 1];
    });
  },

  calculatePossibleWords: function () {
    const letters = this.letters.map((l) => l.toLowerCase());
    const center = letters[0];

    // Instead of tracking frequency, just check if letter is available
    const availableLetters = new Set(letters);

    this.possibleWords = this.wordList
      .filter((word) => {
        // Must contain center letter and be at least 4 letters long
        if (!word.includes(center) || word.length < 4) return false;

        // Check if each letter in the word is available in our hexagon
        // Letters can be reused multiple times
        return [...word].every((letter) => availableLetters.has(letter));
      })
      .sort((a, b) => b.length - a.length);

    if (this.debugMode) {
      console.log("Available letters:", letters);
      console.log("First 10 possible words:", this.possibleWords.slice(0, 10));
    }
  },

  showMessage: function (message, isError = false) {
    const messageEl = document.getElementById("message");
    messageEl.textContent = message;
    messageEl.classList.add("show");
    if (isError) {
      messageEl.classList.add("error");
    }

    // Remove the message after 2 seconds
    setTimeout(() => {
      messageEl.classList.remove("show");
      messageEl.classList.remove("error");
    }, 2000);
  },

  submitWord: function () {
    if (this.gameFinished) {
      this.showMessage("Game is finished!");
      return;
    }

    const word = this.currentWord.join("").toLowerCase();

    if (word.length < 4) {
      this.showMessage("Word must be at least 4 letters");
      return;
    }
    if (!word.includes(this.letters[0].toLowerCase())) {
      this.showMessage("Must use center letter");
      return;
    }
    if (!this.possibleWords.includes(word)) {
      this.showMessage("Word not in dictionary");
      return;
    }
    if (this.foundWords.has(word)) {
      this.showMessage("Word already found");
      return;
    }

    this.foundWords.add(word);
    this.score += word.length;
    this.clearWord();
    this.updateScore();
    this.updateFoundWords();
  },

  updateFoundWords: function () {
    const foundWordsList = document.getElementById("found-words-list");
    const latestWord = Array.from(this.foundWords).pop(); // Get the latest word

    // Sort all words including the latest
    const sortedWords = Array.from(this.foundWords).sort(
      (a, b) => b.length - a.length || a.localeCompare(b)
    );

    // Clear existing content
    foundWordsList.innerHTML = "";

    // Add all words, but animate only the latest one
    sortedWords.forEach((word) => {
      const span = document.createElement("span");
      span.className =
        "found-word" + (word === latestWord ? " animate-pop" : "");
      span.innerHTML = `${word}<sup>${word.length}</sup>`;
      foundWordsList.appendChild(span);
    });
  },

  newGame: function () {
    if (this.isDailyChallenge) {
      // In daily challenge mode, switch to free play
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("free", "true");
      window.location.href = newUrl.toString();
      return;
    }

    // Normal new game behavior for free play mode
    this.foundWords.clear();
    this.score = 0;
    this.gameFinished = false;
    this.generateLetters();
    this.clearWord();
    this.updateScore();
    this.updateFoundWords();

    // Reset game complete UI
    document.getElementById("game-complete").style.display = "none";
    document.getElementById("game-complete-overlay").style.display = "none";
    document.getElementById("submit").disabled = false;
  },

  updateScore: function () {
    const maxScore = this.possibleWords.reduce(
      (sum, word) => sum + word.length,
      0
    );

    // Only update max score for the game complete screen
    document.getElementById("max-score").textContent = maxScore;

    const thresholds = [
      Math.floor(maxScore * 0.9),
      Math.floor(maxScore * 0.8),
      Math.floor(maxScore * 0.7),
      Math.floor(maxScore * 0.6),
      Math.floor(maxScore * 0.5),
      Math.floor(maxScore * 0.4),
      Math.floor(maxScore * 0.3),
      Math.floor(maxScore * 0.2),
      Math.floor(maxScore * 0.1),
      0,
    ];

    // Update score thresholds in the ladder
    thresholds.forEach((threshold, index) => {
      document.getElementById(`points-${index + 1}`).textContent = threshold;
    });

    // Determine current level and progress
    let newLevel = 10;
    let progress = 0;

    for (let i = 0; i < thresholds.length; i++) {
      if (this.score >= thresholds[i]) {
        newLevel = i + 1;

        // Calculate progress to next level
        if (i > 0) {
          const nextThreshold = thresholds[i - 1];
          const currentThreshold = thresholds[i];
          progress =
            (this.score - currentThreshold) /
            (nextThreshold - currentThreshold);
        } else {
          progress = 1; // At max level
        }
        break;
      }
    }

    // Check if we've reached a new level
    if (newLevel < this.currentLevel) {
      confetti.start();
      this.currentLevel = newLevel;

      // Scale animation for level achievement
      const levelStep = document.querySelector(
        `.level-step[data-level="${newLevel}"]`
      );
      if (levelStep) {
        levelStep.style.transform = "scale(1.1)";
        setTimeout(() => {
          levelStep.style.transform = "";
        }, 300);
      }
    }

    // Update all level displays and progress
    document.querySelectorAll(".level-step").forEach((step) => {
      const stepLevel = parseInt(step.dataset.level);
      const isActive = stepLevel >= newLevel;
      step.classList.toggle("active", isActive);

      // Get the line element
      const line = step.querySelector(".level-line");
      if (!line) return;

      if (stepLevel === newLevel) {
        // Update progress bar width and dot position for current level
        const progressPercent = Math.min(Math.max(progress * 100, 0), 100);
        line.style.setProperty("--progress", `${progressPercent}%`);

        // Set dot position
        const dot = line.querySelector("::after");
        if (dot) {
          dot.style.left = `${progressPercent}%`;
        }
      } else if (isActive) {
        // Completed levels should show full progress
        line.style.setProperty("--progress", "100%");
      } else {
        // Inactive levels should show no progress
        line.style.setProperty("--progress", "0%");
      }
    });
  },

  clearWord: function () {
    this.currentWord = [];
    document.getElementById("current-word").textContent = "";
  },

  shuffleLetters: function () {
    const centerLetter = this.letters[0];
    let otherLetters = this.letters.slice(1);

    // Ensure no letter remains in its current position
    do {
      otherLetters = otherLetters.sort(() => Math.random() - 0.5);
    } while (
      otherLetters.some((letter, index) => letter === this.letters[index + 1])
    );

    this.letters = [centerLetter, ...otherLetters];
    this.updateLetterDisplays();
  },

  toggleDebug: function () {
    this.debugMode = !this.debugMode;
    const panel = document.getElementById("debug-panel");
    const overlay = document.getElementById("debug-overlay");

    if (this.debugMode) {
      panel.style.display = "block";
      overlay.style.display = "block";
      this.updateDebugPanel();
    } else {
      panel.style.display = "none";
      overlay.style.display = "none";
    }
  },

  updateDebugPanel: function () {
    const panel = document.getElementById("debug-panel");
    const wordsByLength = {};
    this.possibleWords.forEach((word) => {
      const len = word.length;
      if (!wordsByLength[len]) wordsByLength[len] = [];
      wordsByLength[len].push(word);
    });

    const totalPoints = this.possibleWords.reduce(
      (sum, word) => sum + word.length,
      0
    );

    const html = `
      <h3>Game Statistics</h3>
      <p>Available Letters: ${this.letters.join(", ")}</p>
      <p>Total Possible Words: ${this.possibleWords.length}</p>
      <p>Total Possible Points: ${totalPoints}</p>
      ${Object.entries(wordsByLength)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(
          ([length, words]) => `
          <div class="word-group">
            <h4>${length} Letters (${words.length} words)</h4>
            <div class="word-list">
              ${words.sort().join(", ")}
            </div>
          </div>
        `
        )
        .join("")}
    `;

    panel.innerHTML = html;
  },

  finishGame: function () {
    const gameCompleteEl = document.getElementById("game-complete");
    const gameCompleteOverlay = document.getElementById(
      "game-complete-overlay"
    );

    // If already displayed, hide it and return
    if (gameCompleteEl.style.display === "block") {
      gameCompleteEl.style.display = "none";
      gameCompleteOverlay.style.display = "none";
      return;
    }

    if (!this.gameFinished) {
      this.gameFinished = true;
      document.getElementById("submit").disabled = true;
    }

    // Update final score
    document.getElementById("final-score").textContent = this.score;

    // Get missing words
    const missingWords = this.possibleWords.filter(
      (word) => !this.foundWords.has(word)
    );

    // Show the game complete screen
    gameCompleteEl.style.display = "block";
    gameCompleteOverlay.style.display = "block";

    // Show progress bar
    document.getElementById("final-progress").style.width = `${
      (this.score /
        this.possibleWords.reduce((sum, word) => sum + word.length, 0)) *
      100
    }%`;

    // Show missing words
    document.getElementById("missing-words-list").innerHTML = missingWords
      .sort((a, b) => b.length - a.length || a.localeCompare(b))
      .map(
        (word) =>
          `<span class="found-word">${word}<sup>${word.length}</sup></span>`
      )
      .join("");
  },

  setupEventListeners: function () {
    // Square clicks
    document.querySelectorAll(".square").forEach((square) => {
      square.addEventListener("click", () => {
        const letter = square.textContent;
        this.currentWord.push(letter);
        document.getElementById("current-word").textContent =
          this.currentWord.join("");
      });
    });

    // Button clicks
    document
      .getElementById("submit")
      .addEventListener("click", () => this.submitWord());
    document
      .getElementById("clear")
      .addEventListener("click", () => this.clearWord());
    document
      .getElementById("new-game")
      .addEventListener("click", () => this.newGame());
    document
      .getElementById("shuffle")
      .addEventListener("click", () => this.shuffleLetters());
    document
      .getElementById("toggle-mode")
      .addEventListener("click", () => this.toggleGameMode());
    document
      .getElementById("finish")
      .addEventListener("click", () => this.finishGame());

    document
      .getElementById("debug-overlay")
      .addEventListener("click", () => this.toggleDebug());

    document
      .getElementById("game-complete-overlay")
      .addEventListener("click", () => {
        if (this.gameFinished) {
          document.getElementById("game-complete").style.display = "none";
          document.getElementById("game-complete-overlay").style.display =
            "none";
        }
      });

    // Make game complete screen click-through if not finished
    document.getElementById("game-complete").addEventListener("click", (e) => {
      if (!this.gameFinished) {
        e.stopPropagation();
      }
    });

    // Keyboard input
    document.addEventListener("keydown", (e) => {
      if (this.gameFinished) return;

      if (e.key === "F9") {
        this.toggleDebug();
      }

      const key = e.key.toUpperCase();
      if (key === "ENTER") {
        e.preventDefault(); // Prevent default button click
        this.submitWord();
      } else if (key === "BACKSPACE" || key === "DELETE") {
        this.currentWord.pop();
        document.getElementById("current-word").textContent =
          this.currentWord.join("");
      } else if (this.letters.includes(key)) {
        this.currentWord.push(key);
        document.getElementById("current-word").textContent =
          this.currentWord.join("");
      }
    });
  },
};

const confetti = {
  maxParticles: 200, // Increased from 150
  particles: [],
  colors: [
    "#FF0000", // Red
    "#00FF00", // Green
    "#0000FF", // Blue
    "#FFFF00", // Yellow
    "#FF00FF", // Magenta
    "#00FFFF", // Cyan
    "#FFD700", // Gold
    "#FF69B4", // Hot Pink
    "#7FFF00", // Chartreuse
    "#FF4500", // Orange Red
  ],

  init: function () {
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "fixed";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "1000";
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  },

  resizeCanvas: function () {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  createParticle: function () {
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * -100, // Varied starting heights
      size: Math.random() * 8 + 4, // Bigger size range
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      speed: Math.random() * 5 + 2, // Increased speed range
      angle: Math.random() * Math.PI * 2,
      rotation: Math.random() * 0.2 - 0.1,
      opacity: 1,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    };
  },

  animate: function () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      particle.y += particle.speed;
      particle.x += Math.sin(particle.angle) * 2;
      particle.angle += particle.rotation;
      particle.rotation += particle.rotationSpeed;
      particle.opacity -= 0.004; // Slower fade

      this.ctx.save();
      this.ctx.translate(particle.x, particle.y);
      this.ctx.rotate(particle.angle);
      this.ctx.globalAlpha = particle.opacity;
      this.ctx.fillStyle = particle.color;
      this.ctx.fillRect(
        -particle.size / 2,
        -particle.size / 2,
        particle.size,
        particle.size
      );
      this.ctx.restore();

      if (particle.opacity <= 0 || particle.y > this.canvas.height) {
        this.particles.splice(i, 1);
      }
    }

    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.animate());
    } else {
      this.canvas.style.display = "none";
    }
  },

  start: function () {
    this.canvas.style.display = "block";
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.createParticle());
    }
    this.animate();
  },
};

// Initialize game
document.addEventListener("DOMContentLoaded", () => game.init());
