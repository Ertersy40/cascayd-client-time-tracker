const { MAX_GAP, DEFAULT_LAST } = require('./config');

function calculateWindowTime(activity) {
  const windowTimeMap = {};

  for (let i = 0; i < activity.length; i++) {
    const current = activity[i];
    const key = `${current.app}|||${current.title}`; // Use ||| as separator to avoid conflicts

    if (!windowTimeMap[key]) {
      windowTimeMap[key] = {
        app: current.app,
        title: current.title,
        totalSeconds: 0
      };
    }

    if (i < activity.length - 1) {
      const next = activity[i + 1];
      const currentTime = new Date(current.timestamp);
      const nextTime = new Date(next.timestamp);
      const duration = (nextTime - currentTime) / 1000;

      // Only count duration if it's reasonable (less than 10 minutes)
      if (duration > 0 && duration <= MAX_GAP) {
        windowTimeMap[key].totalSeconds += duration;
      } else if (duration > MAX_GAP) {
        // Cap at max gap
        windowTimeMap[key].totalSeconds += MAX_GAP;
      }
    } else {
      // Last entry - use default duration
      windowTimeMap[key].totalSeconds += DEFAULT_LAST;
    }
  }

  // Convert map to sorted array
  const windows = Object.values(windowTimeMap);
  windows.sort((a, b) => b.totalSeconds - a.totalSeconds);

  return windows;
}

module.exports = {
  calculateWindowTime
};
