'use strict';

const debug = require('abacus-debug')('abacus-rabbit-consumer');
const edebug = require('abacus-debug')('e-abacus-rabbit-consumer');

const checkChannel = (channel) => {
  if(!channel)
    throw new Error('Consumer is not connected');
};

class Consumer {

  constructor(connectionManager, queueName, prefetchLimit) {
    this.queueName = queueName;
    this.prefetchLimit = prefetchLimit;
    this.connectionManager = connectionManager;
  }

  async process(messageHandler) {
    const channelFn = (queueName, prefetchLimit) => (channel) => Promise.all([
      channel.assertQueue(queueName, { durable: true }),
      channel.prefetch(prefetchLimit),
      channel.consume(queueName, async(message) => {
        try {
          await messageHandler.handle(message);
          await channel.ack(message);
        } catch (err) {
          edebug('Failed to process message, returning to queue, error %o', err);
          channel.nack(message);
        }
      })
    ]);

    debug('Connecting consumer to queue %s ...', this.queueName);
    this.channel = await this.connectionManager.connect(channelFn(this.queueName, this.prefetchLimit));
    debug('Consumer for queue %s connected', this.queueName);
  };

  async close() {
    checkChannel(this.channel);
    await this.channel.close();
  }
}

module.exports = Consumer;
