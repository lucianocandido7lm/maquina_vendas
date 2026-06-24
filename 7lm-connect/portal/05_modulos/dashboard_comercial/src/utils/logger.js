const GLOBAL_LOG_KEY = '__APP_DIAGNOSTICS__';

const getLogBuffer = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!window[GLOBAL_LOG_KEY]) {
    window[GLOBAL_LOG_KEY] = [];
  }
  return window[GLOBAL_LOG_KEY];
};

const pushEntry = (entry) => {
  const buffer = getLogBuffer();
  if (!buffer) return;
  buffer.push(entry);
  if (buffer.length > 250) {
    buffer.shift();
  }
};

const format = (level, scope, message, payload) => ({
  timestamp: new Date().toISOString(),
  level,
  scope,
  message,
  payload,
});

const emit = (method, scope, message, payload) => {
  const entry = format(method, scope, message, payload);
  pushEntry(entry);
  const consoleMethod = console[method] ?? console.log;
  if (payload !== undefined) {
    consoleMethod(`[${scope}] ${message}`, payload);
  } else {
    consoleMethod(`[${scope}] ${message}`);
  }
};

export const logger = {
  info(scope, message, payload) {
    emit('info', scope, message, payload);
  },
  warn(scope, message, payload) {
    emit('warn', scope, message, payload);
  },
  error(scope, message, payload) {
    emit('error', scope, message, payload);
  },
  trace(scope, message, payload) {
    emit('debug', scope, message, payload);
  },
  recordException(scope, error, context) {
    const payload = {
      message: error?.message ?? 'Unknown error',
      stack: error?.stack,
      ...context,
    };
    emit('error', scope, 'Exception recorded', payload);
  },
};

export const getDiagnostics = () => (typeof window !== 'undefined' ? window[GLOBAL_LOG_KEY] ?? [] : []);
