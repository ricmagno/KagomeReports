
import 'dotenv/config';
import { githubReleaseService } from '../src/services/githubReleaseService';
import { updateChecker } from '../src/services/updateChecker';

async function main() {
    console.log('--- Debugging GitHub Release Service ---');
    console.log('GITHUB_OWNER:', process.env.GITHUB_OWNER || '(default)');
    console.log('GITHUB_REPO:', process.env.GITHUB_REPO || '(default)');
    console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? '***' : '(none)');

    try {
        console.log('\nFetching latest release...');
        const release = await githubReleaseService.fetchLatestRelease();
        console.log('Latest Release:', JSON.stringify(release, null, 2));
    } catch (error) {
        console.error('Error fetching latest release:', error);
    }

    try {
        console.log('\nChecking for updates (via UpdateChecker)...');
        const updateStatus = await updateChecker.checkForUpdates();
        console.log('Update Status:', JSON.stringify(updateStatus, null, 2));
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}

main().catch(console.error);
