const { expo } = require('./app.json');
module.exports = { ...expo, experiments: { ...expo.experiments, baseUrl: process.env.PAGES_BASE_PATH || '' } };
