import * as fs from 'fs';
import * as https from 'https';

var githubhook = require('githubhook');
var octonode = require('octonode');

import { ConfigLoader } from "./server/config/config-loader";

export class GithubWebHook {
    private configLoader: ConfigLoader;
    private github: any;

    private client: any;
    private repo: any;
    private hookConfig: HookConfig;

    constructor() {
        this.configLoader = new ConfigLoader();
        this.configLoader.load((config: HookConfig) => {
            this.hookConfig = config;
            console.log("CONFIG:" + JSON.stringify(this.hookConfig, null, 1));
            this.github = githubhook(
                {
                    host: this.hookConfig.host,
                    port: this.hookConfig.port,
                    path: this.hookConfig.route,
                    secret: this.hookConfig.secret
                });
            this.github.on('*', (event: any, repo: any, ref: any, data: any) => {
                try {
                    console.log(JSON.stringify(event, null, 2));
                    console.log(JSON.stringify(repo, null, 2));
                    console.log(JSON.stringify(data.repository, null, 2));

                    var fullNameRepository = data.repository.full_name;

                    for (let i = 0; i < this.hookConfig.repositories.length; i++) {
                        let repoConfig = this.hookConfig.repositories[i];
                        if(repoConfig.eventName == event){
                            this.fetchFromGitHub(this.hookConfig.accessToken, data.repository.full_name, repoConfig.branch, repoConfig.fetchPath, (buffer: any) => {
                                console.log("Action complete for Event:" + event);
                            });
                        }
                    }

                }
                catch (ex) {
                    console.log("ERROR:" + ex.message);
                }
            });

            // listen to github push
            this.github.listen();
        });
    }

    private fetchFromGitHub = (gitHubAccessToken: any,
        repoFullName: string,
        branchName: string,
        filePath: string,
        callback: any) => {

        this.client = octonode.client(gitHubAccessToken);
        if (this.client != null) {
            this.repo = this.client.repo(repoFullName);
            console.log("Trying to get: " + repoFullName + "@filePath: " + filePath);
            try {
                this.getFolder(filePath, () => {

                });
            }
            catch (err) {
                console.log(err.message);
            }
        }
    }

    private getFolder = (filePath: string, callback: any) => {
        this.repo.contents(filePath, "", (err: any, result: Array<any>) => {
            if (err) {
                console.log("ERROR:" + err.message);

                callback(null);
            }
            else {
                try {
                    console.log("Result Length:" + result.length);
                    for (let i = 0; i < result.length; i++) {
                        let file = result[i];
                        if (file.type == "file") {
                            this.saveFile(file);
                        }
                        else {
                            if (file.type == "dir") {
                                this.ensureExists(this.hookConfig.repositories[0].basePath + filePath + "/" + file.name, 511, () => {
                                    this.getFolder(filePath + "/" + file.name, callback);
                                });
                            }
                        }
                    }
                    callback(null);
                }
                catch (err) {
                    console.log(err.message);

                }
            }
        });
    }

    private saveFile = (file: any) => {
        console.log("File:" + file.name);
        let request = https.get(file.download_url, (response: any) => {
            try {
                let newFile = fs.createWriteStream(this.hookConfig.repositories[0].basePath + file.path);
                response.pipe(newFile);
            }
            catch (err) {
                console.log("SaveFile Error: " + err.message);
            }
        });
    }

    private ensureExists = (path: string, mask: number, cb: any) => {
        if (typeof mask == 'function') { // allow the `mask` parameter to be optional
            cb = mask;
            mask = 511;
        }
        fs.mkdir(path, mask, (err: any) => {
            if (err) {
                if (err.code == 'EEXIST') cb(null); // ignore the error if the folder already exists
                else cb(err); // something else went wrong
            } else cb(null); // successfully created folder
        });
    }
}

var app = new GithubWebHook();
