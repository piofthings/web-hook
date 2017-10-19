import * as http from 'http';
import * as https from 'https';
import * as express from "express";
import * as bodyParser from "body-parser";

//var githubhook = require('githubhook');

import { ConfigLoader } from "./server/config/config-loader";
import { GitFetcher } from "./server/services/git-fetcher";
import { GitListener } from "./server/services/git-listener";

export class GithubWebHook {
    private configLoader: ConfigLoader;
    private github: any;
    private app: express.Application = express();

    private hookConfig: HookConfig;
    private client: GitFetcher;

    constructor() {
        this.configLoader = new ConfigLoader();
        this.configLoader.load((config: HookConfig) => {
            this.app.use(bodyParser.json());
            this.app.use(bodyParser.urlencoded({ extended: false }));

            this.hookConfig = config;
            this.client = new GitFetcher(this.hookConfig);

            this.app.post(this.hookConfig.route, new GitListener(config, this.client.handleHookEvent).serverHandler)

            let pkg = require('./package.json');

            let httpServer = http.createServer(this.app);
            httpServer.listen(3005, (): void => {
                console.log(pkg.name, 'listening on port ', httpServer.address().port);
            });
        });
    }
}

var app = new GithubWebHook();
