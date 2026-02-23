module.exports = {
  apps: [{
    name: 'distributor-backend',
    script: 'dist/main.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'postgres://izzatillo:a-z123456789@localhost:5432/distributor',
        JWT_SECRET: 'tillo',
        TELEGRAM_BOT_USERNAME: 'teztarqatbot',
        TELEGRAM_BOT_TOKEN: '8216268214:AAGyX8htytz8wyQk3_y7ZgDIBjJlv0nGaXk'
    }
  }]
};