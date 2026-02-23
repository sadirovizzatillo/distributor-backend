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
        PORT: 3000,
        DATABASE_URL: 'postgres://izzatillo:12345@localhost:5432/izzatillo',
        JWT_SECRET: 'tillo',
        TELEGRAM_BOT_USERNAME: 'teztarqatbot',
        TELEGRAM_BOT_TOKEN: '8216268214:AAGyX8htytz8wyQk3_y7ZgDIBjJlv0nGaXk'
    }
  }]
};