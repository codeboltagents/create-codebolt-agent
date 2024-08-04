const codebolt = require('@codebolt/codeboltjs').default;

async function execute() {
    await codebolt.waitForConnection();

}

(async () => { await execute(); })();