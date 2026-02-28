/**
 * PM2 ecosystem config for the local NFC agent.
 *
 * Usage:
 *   npm run build
 *   pm2 start ecosystem.config.js
 *   pm2 save          ← persist across reboots
 *   pm2 startup       ← enable autostart on Windows/Linux/macOS
 */
module.exports = {
  apps: [
    {
      name: 'pawsync-nfc-agent',
      script: './dist/index.js',
      // Load .env from the agent directory
      env_file: './.env',
      // Restart on crash, but back off exponentially
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      exp_backoff_restart_delay: 1000,
      // Log to files next to the agent
      out_file: './logs/agent-out.log',
      error_file: './logs/agent-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Watch is OFF — nfc-pcsc handles its own reconnect
      watch: false,
    },
  ],
};
