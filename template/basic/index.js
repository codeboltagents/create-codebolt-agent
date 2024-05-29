import { codebolt } from '@codebolt/codeboltjs';

// Function to execute codebolt connection
async function execute() {

    await codebolt.waitForConnection();
}

// Immediately invoked function expression to execute the code
(async () => {
    await execute();
})();