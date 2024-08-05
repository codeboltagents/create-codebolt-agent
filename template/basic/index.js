const codebolt = require('@codebolt/codeboltjs').default;

codebolt.chat.onActionMessage().on("userMessage", async (req, response) => {

    await codebolt.waitForConnection();
 
})


