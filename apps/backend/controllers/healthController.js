const mongoose = require('mongoose');
const amqp = require('amqplib');

/**
 * GET /api/health
 * Liveness: always 200 with { ok: true }.
 * Readiness: 503 if MongoDB is not connected.
 * RabbitMQ optional check (does not fail readiness if RABBITMQ_URL unset).
 */
const getHealth = async (req, res) => {
    const mongo = mongoose.connection.readyState === 1;

    let rabbitmq = null;
    const url = process.env.RABBITMQ_URL;
    if (url) {
        try {
            const conn = await amqp.connect(url);
            await conn.close();
            rabbitmq = true;
        } catch {
            rabbitmq = false;
        }
    }

    const ready = mongo;
    const body = {
        ok: ready,
        mongo,
        rabbitmq,
        timestamp: new Date().toISOString(),
    };

    return res.status(ready ? 200 : 503).json(body);
};

module.exports = { getHealth };
