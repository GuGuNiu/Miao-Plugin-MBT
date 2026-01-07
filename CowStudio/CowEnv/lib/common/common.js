export default {
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  makeForwardMsg: async (msg) => msg,
};
