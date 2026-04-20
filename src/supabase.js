const { createClient } = require('@supabase/supabase-js');
const os = require('os');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
let buffer = [];
let flushInterval = null;

const FLUSH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function getClient() {
  if (!supabase) {
    if (!supabaseUrl || !supabaseKey) {
      console.error('[SUPABASE] Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
      return null;
    }
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[SUPABASE] Client initialized');
  }
  return supabase;
}

const machine = os.hostname();

/**
 * Queue an entry for the next hourly flush.
 */
function syncEntry({ timestamp, app, title, entryType }) {
  buffer.push({
    timestamp,
    app,
    title,
    entry_type: entryType,
    machine,
  });
}

/**
 * Flush all buffered entries to Supabase.
 */
async function flush() {
  if (buffer.length === 0) return;

  const client = getClient();
  if (!client) return;

  const batch = buffer.splice(0);
  console.log(`[SUPABASE] Flushing ${batch.length} entries...`);

  try {
    const { error } = await client.from('activity_logs').insert(batch);
    if (error) {
      console.error('[SUPABASE] Flush failed:', error.message);
      // Put them back so we retry next hour
      buffer.unshift(...batch);
    } else {
      console.log(`[SUPABASE] Flushed ${batch.length} entries`);
    }
  } catch (err) {
    console.error('[SUPABASE] Flush error:', err.message);
    buffer.unshift(...batch);
  }
}

/**
 * Start the hourly flush timer.
 */
function startSync() {
  if (flushInterval) return;
  flushInterval = setInterval(flush, FLUSH_INTERVAL_MS);
  console.log('[SUPABASE] Sync started (flush every 1h)');
}

/**
 * Flush remaining entries and stop the timer. Call on app quit.
 */
async function stopSync() {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  await flush();
}

module.exports = { syncEntry, startSync, stopSync };
