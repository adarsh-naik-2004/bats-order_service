import { config } from 'dotenv'
config()

export const Config = {
    server: {
        port: process.env.PORT,
        host: process.env.HOST,
    },

    database: {
        url: process.env.DB_URL,
    },

    auth: {
        jwksUri: process.env.JWKS_URI,
    },

    kafka: {
        broker: process.env.KAFKA_BROKER ? [process.env.KAFKA_BROKER] : [''],
        sasl: {
            username: process.env.KAFKA_USERNAME,
            password: process.env.KAFKA_PASSWORD,
        },
    },

    frontend: {
        clientUI: process.env.CLIENT_UI,
        adminUI: process.env.ADMIN_UI,
    },

    env: {
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        secretKey: process.env.RAZORPAY_SECRET_KEY,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET, 
    }
}
