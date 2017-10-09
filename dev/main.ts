var githubhook = require('githubhook');
var octonode = require('octonode');
var https = require('https');
var fs = require('fs');

export class GithubWebHook {
    // configure listener for github changes
    github = githubhook(
        {

            host: "localhost",
            port: 3005,
            path: "/piofthings",
            secret: ""
        });

    gitHubAccessToken = "";
    private client: any;
    private repo: any;
    private basePath: string = "../temp/";

    constructor() {
        this.github.on('*', (event: any, repo: any, ref: any, data: any) => {
            try {
                console.log(JSON.stringify(repo, null, 2));
                console.log(JSON.stringify(data.repository, null, 2));

                var fullNameRepository = data.repository.full_name;
                var removedFilesArray = data["head_commit"]["removed"];
                var addedFilesArray = data["head_commit"]["added"];
                var modifiedFilesArray = data["head_commit"]["modified"];
                this.fetchFileFromGitHub(this.gitHubAccessToken, data.repository.full_name, "master", "", (buffer: any) => {

                });
            }
            catch (ex) {
                console.log("ERROR:" + ex.message);
            }
        });

        // listen to github push
        this.github.listen();

    }
    // listen to push on github on branch master
    private fetchFileFromGitHub = (gitHubAccessToken: any,
        repoFullName: string,
        branchName: string,
        filePath: string,
        callback: any) => {

        this.client = octonode.client(gitHubAccessToken);
        if (this.client != null) {
            this.repo = this.client.repo(repoFullName);
            console.log("Tring to get: " + repoFullName + "@filePath: " + filePath);
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
                            console.log("File type:" + file.type);
                            console.log("File name:" + file.name);
                            console.log("File sha:" + file.sha);
                            if (file.type == "dir") {
                                this.ensureExists(this.basePath + filePath + "/" + file.name, 511, () => {
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
                let newFile = fs.createWriteStream(this.basePath + file.path);
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
