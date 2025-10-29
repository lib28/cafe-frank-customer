// File: backend/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'cf-backend',
      script: 'server.js',
      cwd: __dirname,
      // Node 20+ can load env from file with --env-file
      node_args: ['--env-file', '.env'],
      watch: false,        // set true for dev if you want auto-restart on code changes
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
