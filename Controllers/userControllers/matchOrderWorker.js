const { Worker } = require('bullmq');
const { matchOrder } = require("../userControllers/matchEngine/matchOrder");
const { cancelOrderByWorker, cancelOrderByWorker1 } = require("../userControllers/matchEngine/cancelOrderWorker");
const workers = {};
const cancelWorkers = {};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function startWorker(pair, socket) {
    // console.log("startWorker>>>>>>>>>>>>>>>>>>>", pair);

    // Ensure that only one worker exists per pair
    if (workers[pair]) return;

    workers[pair] = new Worker(`pairQueue-${pair}`, async job => {
        // console.log(`[PAIR ${pair}] START JOB: ${job.id}`);
        const { name, data } = job;

        // console.log(name, "socket>>>>>>>>>>>>>>>>>name>>>>>>>>>>>>>>>>>>>>>.data")

        try {
            // console.log("Starting order matching...");
            if (name === 'match-order') {
                await matchOrder(data.order, data.userId, socket);
            } else if (name === 'cancel-order') {
                await cancelOrderByWorker(data.data._id, socket);
            }
            await sleep(100);
        } catch (err) {
            console.error(`[PAIR ${pair}] Job error:`, err);
        }
    }, {
        concurrency: 1,
        connection: {
            host: '127.0.0.1',
            port: 6379
        },
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        }
    });

    // Event listeners for worker status
    workers[pair].on('completed', (job) => {
        console.log(`[PAIR ${pair}] Completed job ${job.id}`);
    });

    workers[pair].on('failed', (job, err) => {
        console.error(`[PAIR ${pair}] Job ${job.id} failed:`, err);
    });

    workers[pair].on('error', (err) => {
        console.error(`[PAIR ${pair}] Worker error:`, err);
    });
}

async function startWorker1(pair) {
    // console.log("startWorker--", pair);
    let response = {};

    if (cancelWorkers[pair]) return;
    // console.log("Working>>>>>>>>>>>>>>>>")

    cancelWorkers[pair] = new Worker(`cancelQueue-${pair}`, async job => {
        const { name, data } = job;

        // console.log(name, ">>>>>>>>>>>>>>>>>name>>>>>>>>>>>>>>>>>>>>>.data")

        try {
            if (name === 'cancel-order') {
                response = await cancelOrderByWorker1(data.data._id);
                return response
            }
            await sleep(100);
        } catch (err) {
            console.error(`[PAIR ${pair}] Job error:`, err);
        }
    }, {
        concurrency: 1,
        connection: {
            host: '127.0.0.1',
            port: 6379
        },
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        }
    });

    cancelWorkers[pair].on('completed', (job) => {
        console.log(`[PAIR ${pair}] Completed job ${job.id}`);
    });

    cancelWorkers[pair].on('failed', (job, err) => {
        console.error(`[PAIR ${pair}] Job ${job.id} failed:`, err);
    });

    cancelWorkers[pair].on('error', (err) => {
        console.error(`[PAIR ${pair}] Worker error:`, err);
    });
}

module.exports = { startWorker, startWorker1 };
