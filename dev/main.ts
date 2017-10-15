

var githubhook = require('githubhook');

import { ConfigLoader } from "./server/config/config-loader";
import { GitFetcher } from "./server/services/git-fetcher";

export class GithubWebHook {
    private configLoader: ConfigLoader;
    private github: any;

    private hookConfig: HookConfig;
    private client: GitFetcher;

    constructor() {
        this.configLoader = new ConfigLoader();
        this.configLoader.load((config: HookConfig) => {
            this.hookConfig = config;
            this.client = new GitFetcher(this.hookConfig);

            console.log("CONFIG:" + JSON.stringify(this.hookConfig, null, 1));
            this.github = githubhook(
                {
                    host: this.hookConfig.host,
                    port: this.hookConfig.port,
                    path: this.hookConfig.route,
                    secret: this.hookConfig.secret
                });
            this.github.on('*', this.client.handleHookEvent);


            // listen to github push
            this.github.listen();
        });
    }
}

var app = new GithubWebHook();
