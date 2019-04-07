const schedule = require('node-schedule');
const db = require('../lib/mongodb');
const redis = require('../lib/redis');
const moment = require('moment');

// 每天0点执行
schedule.scheduleJob('1 0 0 * * *', async function() {
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
  console.log('statistics date', yesterday)
  // 渠道活跃用户数统计
  const channelArray = await db.collection('channel').find().toArray();
  for (const channel of channelArray) {
    const totalActive = parseInt(await redis.scard(`channelActiveDeviceIdSet#${channel.channelName}#${yesterday}`));
    if (totalActive > 0) {
      await db.collection('channelStat').insertOne({ 
        channelName: channel.channelName,
        totalActive, 
        statDate: yesterday,
        createAt: new Date(), 
        updateAt: new Date()
      });
    }
  }

  // 订单统计
  const orderArray = await db.collection('order').find().toArray();
  for (const order of orderArray) {
    const hasData = parseInt((await redis.get(`hasDataTimes#${order.orderId}#${yesterday}`)) || 0);
    const show = parseInt((await redis.get(`showTimes#${order.orderId}#${yesterday}`)) || 0);
    const showUser = parseInt((await redis.scard(`showADdeviceIdSet#${order.orderId}#${yesterday}`)) || 0);
    const close = parseInt((await redis.get(`closeTimes#${order.orderId}#${yesterday}`)) || 0);
    const click = parseInt((await redis.get(`clickTimes#${order.orderId}#${yesterday}`)) || 0);

    await db.collection('orderStat').insertOne({ 
      orderId: order.orderId,
      appName: order.appName,
      appType: order.appType,
      adType: order.adType,
      hasData,
      show,
      showUser,
      close,
      click,
      clickRate: show !== 0 ? (click / show).toFixed(2) : 0,
      statDate: yesterday,
      createAt: new Date(), 
      updateAt: new Date()
    });
  }
  // 自动下线
  await db.collection('order').updateOne({ endDate: { $lte: new Date()}}, { $set: { online: 0 } });

});