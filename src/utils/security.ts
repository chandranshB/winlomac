/**
 * Anti-cheat and security utilities
 * Protects game constants and detects client-side tampering
 */

// Obfuscated constant storage
const PROTECTED_CONSTANTS = Object.freeze({
  _ms: 90,      // MAX_SPEED
  _ac: 35,      // ACCELERATION
  _br: 140,     // BRAKING
  _gr: 0.95,    // GRIP
  _ts: 3.0,     // TURN_SPEED
  _gs: [15, 30, 45, 60, 75, 90], // GEAR_SPEEDS
  _ir: 1000,    // IDLE_RPM
  _rr: 8000,    // REDLINE_RPM
  _nb: 1.05,    // NITRO_BOOST (5% acceleration boost - extremely minimal)
  _ns: 2,       // NITRO_SPEED_BONUS (2 m/s extra top speed - barely noticeable)
  _nd: 40,      // NITRO_DRAIN_RATE (per second - drains in 2.5 seconds)
  _nr: 3,       // NITRO_RECHARGE_RATE (per second - recharges in 33 seconds!)
});

// Integrity check hash
const integrityHash = generateHash();

function generateHash(): string {
  const values = Object.values(PROTECTED_CONSTANTS).join('|');
  let hash = 0;
  for (let i = 0; i < values.length; i++) {
    const char = values.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Validate integrity
function validateIntegrity(): boolean {
  const currentHash = generateHash();
  if (currentHash !== integrityHash) {
    console.error('[Security] Integrity check failed - tampering detected');
    return false;
  }
  return true;
}

// Secure getter with validation
export function getGameConstants() {
  if (!validateIntegrity()) {
    // Return safe defaults if tampering detected
    return {
      MAX_SPEED: 50,
      ACCELERATION: 15,
      BRAKING: 100,
      GRIP: 0.8,
      BASE_TURN_SPEED: 2.0,
      GEAR_SPEEDS: [10, 20, 30, 40, 50, 60],
      IDLE_RPM: 1000,
      REDLINE_RPM: 7000,
      NITRO_BOOST: 1.1,
      NITRO_SPEED_BONUS: 3,
      NITRO_DRAIN_RATE: 40,
      NITRO_RECHARGE_RATE: 5,
    };
  }

  return {
    MAX_SPEED: PROTECTED_CONSTANTS._ms,
    ACCELERATION: PROTECTED_CONSTANTS._ac,
    BRAKING: PROTECTED_CONSTANTS._br,
    GRIP: PROTECTED_CONSTANTS._gr,
    BASE_TURN_SPEED: PROTECTED_CONSTANTS._ts,
    GEAR_SPEEDS: [...PROTECTED_CONSTANTS._gs],
    IDLE_RPM: PROTECTED_CONSTANTS._ir,
    REDLINE_RPM: PROTECTED_CONSTANTS._rr,
    NITRO_BOOST: PROTECTED_CONSTANTS._nb,
    NITRO_SPEED_BONUS: PROTECTED_CONSTANTS._ns,
    NITRO_DRAIN_RATE: PROTECTED_CONSTANTS._nd,
    NITRO_RECHARGE_RATE: PROTECTED_CONSTANTS._nr,
  };
}

// Periodic integrity checks
let checkInterval: number | null = null;

export function startSecurityMonitoring() {
  if (checkInterval) return;
  
  // Check every 5 seconds
  checkInterval = window.setInterval(() => {
    if (!validateIntegrity()) {
      console.warn('[Security] Tampering detected - resetting to safe values');
      // Could also disconnect player or flag account
    }
  }, 5000);
}

export function stopSecurityMonitoring() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// Prevent console manipulation
export function protectConsole() {
  if (import.meta.env.PROD) {
    // Disable console in production
    const noop = () => {};
    window.console.log = noop;
    window.console.warn = noop;
    window.console.error = noop;
    window.console.debug = noop;
    window.console.info = noop;
  }
}

// Detect DevTools
let devToolsOpen = false;

export function detectDevTools() {
  const threshold = 160;
  
  const check = () => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      if (!devToolsOpen) {
        devToolsOpen = true;
        console.warn('[Security] Developer tools detected');
        // Could implement additional security measures here
      }
    } else {
      devToolsOpen = false;
    }
  };

  setInterval(check, 1000);
}

// Prevent common exploits
export function preventExploits() {
  // Prevent right-click in production
  if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Prevent common keyboard shortcuts
  if (import.meta.env.PROD) {
    document.addEventListener('keydown', (e) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        return false;
      }
    });
  }
}

// Initialize all security measures
export function initializeSecurity() {
  protectConsole();
  detectDevTools();
  preventExploits();
  startSecurityMonitoring();
  
  console.log('[Security] Anti-cheat system initialized');
}
