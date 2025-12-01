
// queue.js
const { Queue,QueueEvents } = require('bullmq');
const queue = {};
const cancelQueue = {};
const cancelQueueEvents = {};

function orderQueue(pair) {
  // console.log("orderQueue---",pair);
  try{
  if (!queue[pair]) {    
    queue[pair] = new Queue(`pairQueue-${pair}`, { 
      connection: {
        host: '127.0.0.1',
        port: 6379
      }
    });
  };
  return queue[pair];
}catch(error){
  console.log(error,"error in queue")
  return [];
}
};

function orderQueue1(pair) {
  // console.log("orderQueue1---",pair);
  try{
  if (!cancelQueue[pair]) {    
    cancelQueue[pair] = new Queue(`cancelQueue-${pair}`, { 
      connection: {
        host: '127.0.0.1',
        port: 6379
      }
    });
  };
  return cancelQueue[pair];
}catch(error){
  console.log(error,"error in queue")
  return [];
}
};

function getQueueEvents(pair) {
  if (!cancelQueueEvents[pair]) {
    cancelQueueEvents[pair] = new QueueEvents(`cancelQueue-${pair}`, {
      connection: {
        host: '127.0.0.1',
        port: 6379
      }
    });
  }
  return cancelQueueEvents[pair];
}


module.exports = { orderQueue, orderQueue1,getQueueEvents };



