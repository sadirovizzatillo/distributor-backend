module.exports = {
  apps: [{
    name: 'distributor-backend',
    script: 'dist/main.js',
    instances: 'max',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};