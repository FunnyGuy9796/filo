const express = require("express");
const ejs = require("ejs");
const bodyParser = require('body-parser');
const chalk = require("chalk");
const app = express();

const mime = require("mime-types");
const argon2 = require("argon2");

const fs = require("./filo_modules/fs");
const network = require("./filo_modules/net");
const memory = require("./filo_modules/mem");

const os = require("os");
const realFs = require("fs");
const path = require("path");
const configFile = "./config.json";
const servicesFile = "./services.json";

let fsStatus = false;
let netStatus = false;
let memStatus = false;

const data = realFs.readFileSync(configFile, "utf8");
const configData = JSON.parse(data);

const servicesPath = configData.services_path;
const appsPath = configData.apps_path;
const netRequired = configData.network_required;

function waitForCondition(interval = 100) {
    return new Promise((resolve, reject) => {
        const timer = setInterval(() => {
            if (fsStatus && netStatus && memStatus) {
                clearInterval(timer);
                resolve();
            }
        }, interval);

        setTimeout(() => {
            clearInterval(timer);
            reject(new Error('Failed to access one or more system modules'));
        }, 1000);
    });
}

async function hashPassword(password) {
    try {
        const hash = await argon2.hash(password);

        return hash;
    } catch(error) {
        console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + err);

        return null;
    }
}

async function verifyPassword(storedHash, password) {
    try {
        const isMatch = await argon2.verify(storedHash, password);

        if (isMatch) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + err);

        return false;
    }
}

async function stopService(serviceId) {
    const resolvedPath = require.resolve(path.join(servicesPath, serviceId, "main.js"));

    if (require.cache[resolvedPath]) {
        try {
            const serviceModule = require(resolvedPath);

            const result = await serviceModule.stop();

            if (result) {
                memory.removeData("services", "id = '" + serviceId + "'");
                delete require.cache[resolvedPath];
    
                console.log(chalk.cyan.bold("[FILO/SERVICES]") + " -> Stopped system service | Service ID: " + serviceId);
            }
        } catch (error) {
            console.log(chalk.cyan.bold("[FILO/SERVICES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + error);
        }
    }
}

async function startService(serviceId) {
    let rows = memory.readNode("services");
    let serviceExists = rows.some(row => row.id === serviceId);

    if (!serviceExists) {
        const absPath = path.join(servicesPath, serviceId, "index.js");

        if (realFs.existsSync(absPath)) {
            const service = require(absPath);
            service.init();

            const cols = ["id"];

            const data = [
                { id: serviceId }
            ];

            memory.addData("services", cols, data);

            console.log(chalk.cyan.bold("[FILO/SERVICES]") + " -> Started system service | Service ID: " + serviceId);
        }
    }
}

async function startServices() {
    try {
        const data = realFs.readFileSync(servicesFile, "utf8");
        const servicesData = JSON.parse(data);

        console.log(chalk.cyan.bold("[FILO/SERVICES]") + " -> Services.. [" + chalk.green.bold("OK") + "]");

        const cols = [
            { name: "id", type: "TEXT", primary: true }
        ];

        memory.createNode("services", cols);

        servicesData.forEach((item) => {
            startService(item.id); 
        });

        app.post("/start-service/:serviceId", async (req, res) => {
            const { serviceId } = req.params;

            try {
                await startService(serviceId);
                res.status(200).send("success");
            } catch (error) {
                console.log(chalk.cyan.bold("[FILO/SERVICES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + error);
                res.status(500).send("failed");
            }
        });
    
        app.post("/stop-service/:serviceId", async (req, res) => {
            const { serviceId } = req.params;

            try {
                await stopService(serviceId);
                res.status(200).send("success");
            } catch(error) {
                console.log(chalk.cyan.bold("[FILO/SERVICES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + error);
                res.status(500).send("failed");
            }
        });
    } catch(err) {
        console.log(chalk.cyan.bold("[FILO/SERVICES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + err);

        cleanup();
        process.exit(1);
    }
}

function genRoutes(res, appId, appIndexFile) {
    const appPath = fs.resolvePath(`/sys/apps/${appId}`);
    const appFilePath = path.join(appPath, appIndexFile);
    const status = realFs.existsSync(appFilePath);

    if (status) {
        app.set("view engine", "ejs");

        const registerRoutes = (dirPath) => {
            const files = realFs.readdirSync(dirPath);

            files.forEach(file => {
                const filePath = path.join(dirPath, file);
                const stat = realFs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    registerRoutes(filePath);
                } else {
                    const extname = path.extname(filePath);
                    const fileName = path.basename(filePath, extname);
                    let routePath = `/${appId}/${path.relative(appPath, filePath).replace(/\\/g, '/')}`;

                    if (extname === ".ejs") {
                        routePath = `/${appId}/${fileName.replace(/\\/g, '/')}`;

                        app.get(routePath, (req, res) => {
                            try {
                                const data = realFs.readFileSync(filePath, "utf8");
                                const rendered = ejs.render(data);

                                res.send(rendered);
                            } catch (error) {
                                console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Error rendering page for app" + chalk.bold("[" + appId + "]") + ":" + error);
                                res.status(500).send("error rendering page");
                            }
                        });
                    }
                }
            });
        };

        registerRoutes(appPath);

        console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Started application | App: " + appId);

        const mainData = realFs.readFileSync(appFilePath, "utf8");

        try {
            const rendered = ejs.render(mainData);
            return res.send(rendered);
        } catch (error) {
            console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Error rendering page for app" + chalk.bold("[" + appId + "]") + ":" + error);
            return res.status(500).send("error rendering page");
        }
    } else {
        console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Main file for app" + chalk.bold("[" + appId + "]") + " could not be found");
        return res.status(404).send("app file not found");
    }
}

async function installApp(appId) {
    const absPath = path.join(appsPath, appId);

    if (realFs.existsSync(absPath)) {
        const installPath = fs.resolvePath(`/sys/apps/${appId}`);
        const appDataPath = fs.resolvePath(`.appData/${appId}`);
        const status = realFs.existsSync(installPath);
        const dataStatus = realFs.existsSync(appDataPath);

        if (!status) {
            realFs.mkdirSync(installPath);

            try {
                fs.copyDir(absPath, installPath);
                
                try {
                    const appData = realFs.readFileSync(path.join(installPath, "appConfig.json"), "utf8");

                    console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Installing " + chalk.bold(appId) + ".. [" + chalk.green.bold("DONE") + "]");
                } catch (error) {
                    console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Config file for app" + chalk.bold("[" + appId + "]") + " could not be found: " + error);
                }
            } catch(error) {
                console.log(chalk.cyan.bold("[FILO/APPLICATION") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Failed installing app" + chalk.bold("[" + appId + "]") + ": " + error);
            }

            if (!dataStatus) {
                realFs.mkdirSync(appDataPath);
            }
        } else {
            console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> app" + chalk.bold("[" + appId + "]") + " already installed");
        }
    } else {
        console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> App" + chalk.bold("[" + appId + "]") + " could not be found");
    }
}

function removeApp(appId) {
    const appPath = fs.resolvePath(`/sys/apps/${appId}`);
    const appDataPath = fs.resolvePath(`.appData/${appId}`);
    
    try {
        const status = realFs.existsSync(appPath);
        const dataStatus = realFs.existsSync(appDataPath);

        if (status) {
            realFs.rmSync(appPath, { recursive: true, force: true });
            console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Removing " + chalk.bold(appId) + ".. [" + chalk.green.bold("DONE") + "]");
        }

        if (dataStatus) {
            realFs.rmSync(appDataPath, { recursive: true, force: true });
            console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Removing data for " + chalk.bold(appId) + ".. [" + chalk.green.bold("DONE") + "]");
        }
    } catch (error) {
        console.log(chalk.cyan.bold("[FILO/APPLICATION") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Failed removing app" + chalk.bold("[" + appId + "]") + ": " + error);
    }
}

function startApp(appId, uuid) {
    const appPath = fs.resolvePath(`/sys/apps/${appId}`);
    const appData = realFs.readFileSync(path.join(appPath, "appConfig.json"), "utf8");
    const appConfigData = JSON.parse(appData);

    const cols = ["id", "name", "index_file", "icon_file"];

    const data = [
        { id: appId + uuid, name: appConfigData.name, index_file: appConfigData.index_file, icon_file: appConfigData.icon_file }
    ];

    memory.addData("applications", cols, data);

    return (req, res) => {
        (async () => {
            await genRoutes(res, appId, appConfigData.index_file);
        })();
    };
}

function startAppsProcessor(callback) {
    const defaultApps = [
        "about",
        "file_explorer",
        "image_viewer"
    ];

    for (let i = 0; i < defaultApps.length; i++) {
        (async () => {
            try {
                await installApp(defaultApps[i]);
            } catch (error) {
                console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Failed installing app" + chalk.bold(`[${defaultApps[i]}]`) + ": " + error);
            }
        })();
    }

    const cols = [
        { name: "id", type: "TEXT", primary: true },
        { name: "name", type: "TEXT" },
        { name: "index_file", type: "TEXT"},
        { name: "icon_file", type: "TEXT" }
    ];

    memory.createNode("applications", cols);

    app.get("/app/:appId/:uuid", (req, res) => {
        const { appId, uuid } = req.params;
        
        startApp(appId, uuid)(req, res);
    });

    app.post("/stop-app/:appId/:uuid", (req, res) => {
        const { appId, uuid } = req.params;

        memory.removeData("applications", "id = '" + appId + uuid + "'");
        console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Stopped application | App ID: " + appId + uuid);

        res.status(200).send("success");
    });

    app.get("/app-info/:appId", (req, res) => {
        const { appId } = req.params;

        const absPath = fs.resolvePath(`/sys/apps/${appId}`);
        const appConfigFile = path.join(absPath, "appConfig.json");
        let appData;
        try {
            appData = realFs.readFileSync(appConfigFile, "utf8");
        } catch (error) {
            console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Config file for app" + chalk.bold("[" + appId + "]") + " could not be found");
            return res.status(404).send("App config file not found");
        }

        const appConfigData = JSON.parse(appData);

        const appName = appConfigData.name;
        const appIndexFile = appConfigData.index_file;
        const appIconFile = appConfigData.icon_file;
        const appMaxOnStart = appConfigData.max_on_start;

        app.get("/app-info/" + appId + "/icon", (req, res) => {
            let iconFilePath = path.join(absPath, appIconFile);

            try {
                realFs.statSync(iconFilePath);
                
                const iconFileData = realFs.readFileSync(iconFilePath);

                res.contentType(path.extname(iconFilePath) || "application/octet-stream");
                res.send(iconFileData);
            } catch(error) {
                console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Icon file for app" + chalk.bold("[" + appId + "]") + " could not be found");
                
                return res.status(404).send("App icon file not found");
            }
        });

        const appInfo = {
            appId: appId,
            appName: appName,
            appFile: appIndexFile,
            appIcon: appIconFile,
            maxOnStart: appMaxOnStart
        }

        res.status(200).json(appInfo);
    });

    console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Apps Processor.. [" + chalk.green.bold("OK") + "]");

    callback();
}

async function boot() {
    try {
        await waitForCondition();

        try {
            console.log(chalk.cyan.bold("[FILO/CONFIG]") + " -> System config.. [" + chalk.green.bold("OK") + "]");

            const PORT = configData.port;

            startAppsProcessor(startServices);

            const columns = [
                { name: "email", type: "TEXT", primary: true },
                { name: "token", type: "TEXT" }
            ];

            memory.createNode("user", columns);

            app.use(express.static(path.join(__dirname, 'public')));
            app.set("view engine", "ejs");

            app.use(express.json());
            app.use(bodyParser.urlencoded({ extended: true }));

            app.get("/", async (req, res) => {
                app.use(express.static(path.join(__dirname, 'public')));
                app.set("views", path.join(__dirname, "views"));

                res.render("desktop");
            });

            app.get("/file/*", (req, res) => {
                const currPath = decodeURIComponent(req.params[0]);
                const filePath = fs.resolvePath(currPath);
        
                try {
                    const stats = realFs.statSync(filePath);

                    if (stats.isDirectory()) {
                        const files = realFs.readdirSync(filePath);

                        const filePairs = files.map(file => {
                            const fullPath = path.join(filePath, file);
                            const stats = realFs.statSync(fullPath);

                            return {
                                name: file,
                                dir: stats.isDirectory()
                            };
                        });
                        
                        res.json({
                            files: filePairs
                        });
                    } else if (stats.isFile()) {
                        const fileData = realFs.readFileSync(filePath);

                        const mimeType = mime.contentType(path.extname(filePath)) || 'application/octet-stream';
                        res.setHeader('Content-Type', mimeType);
                        res.send(fileData);
                    } else {
                        console.log(chalk.cyan.bold("[FILO/MODULES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> File or directory not supported by the filesystem");

                        res.status(400).send("Unsupported file system entry");
                    }
                } catch(error) {
                    console.log(chalk.cyan.bold("[FILO/MODULES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> File or directory not found at the path specified");
        
                    return res.status(404).send("File not found");
                }
            });

            app.use("/api/mem", memory.router);

            app.use("/api/fs", fs.router);

            app.get("/wallpaper", (req, res) => {
                let rows = memory.readNode("wallpaper");
                let wallpaperPath = rows.map(row => row.path);
                wallpaperPath = wallpaperPath.join(", ");

                realFs.access(wallpaperPath, realFs.constants.F_OK, (err) => {
                    if (err) {
                        console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("IMAGE NOT FOUND: ") + err);
                        res.status(404).send("Image not found");
                    } else {
                        res.sendFile(wallpaperPath);
                    }
                });
            });

            app.post("/login", (req, res) => {
                const email = req.body.email;
                const password = req.body.password;
                
                /*
                getUser(email).then((userData) => {
                    if (userData) {
                        (async () => {
                            let auth = await verifyPassword(userData.token, password);

                            if (auth == true) {
                                const cols = ["email", "token"];
                        
                                const data = [
                                    { email: userData.email, token: userData.token},
                                ];

                                memory.addData("user", cols, data);

                                console.log(chalk.cyan.bold("[FILO/USER]") + ` -> User logged in successfully as ` + chalk.bold(userData.email));

                                res.status(201).json({
                                    message: "success"
                                });
                            } else {
                                console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("FAILED TO AUTHENTICATE USER"));
                                res.status(401).json({
                                    message: "failed"
                                });
                            }
                        })();
                    } else {
                        console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("USER NOT FOUND"));
                        res.status(404).json({
                            message: "failed"
                        });
                    }
                });
                */
            });

            app.post("/signup", async (req, res) => {
                const username = req.body.username;
                const email = req.body.email;
                const password = req.body.password;
            
                /*
                try {
                    const hash = await argon2.hash(password);
                    const status = await setUser(username, email, hash);
                    
                    if (status) {
                        const userData = await getUser(email);
                        
                        if (userData) {
                            const cols = ["email", "token"];
                            const data = [{ email: email, token: hash }];
                            
                            memory.addData("user", cols, data);
                            
                            console.log(chalk.cyan.bold("[FILO/USER]") + ` -> User logged in successfully as ` + chalk.bold(email));
                            
                            res.status(201).json({ message: "success" });
                        } else {
                            console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("USER NOT FOUND"));
                            res.status(404).json({ message: "failed" });
                        }
                    } else {
                        console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("UNABLE TO CREATE USER ACCOUNT"));
                        res.redirect("/");
                    }
                } catch (error) {
                    console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("USER NOT HASHED: ") + error);
                    res.redirect("/");
                }
                */
            });
            

            app.listen(PORT, () => {
                const now = new Date();
                const time = now.toLocaleString();
                const timeLen = time.length;
                const space = " ";
                const padding = Math.max((40 - timeLen) / 2, 0);

                console.log(chalk.cyan.bold("[FILO]") + " -> System booted successfully | http://localhost:" + PORT);
                console.log("");
                console.log(chalk.magenta.bold("----------------------------------------"));
                console.log(chalk.magenta.bold("           Welcome to Filo OS           "));
                console.log("");
                console.log(chalk.magenta.bold("              Current Time              "));
                console.log(chalk.magenta.bold(space.repeat(padding) + now.toLocaleString()));
                console.log(chalk.magenta.bold("----------------------------------------"));
                console.log("");
            });
        } catch(err) {
            console.log(chalk.cyan.bold("[FILO/CONFIG") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + err);

            cleanup();
            process.exit(1);
        }
    } catch (error) {
        console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + error);

        cleanup();
        process.exit(1);
    }
}

function cleanup() {
    console.log(chalk.cyan.bold("[FILO]") + " -> Cleaning up before shutting down..");

    const defaultApps = [
        "about",
        "file_explorer"
    ];

    for (const appId of defaultApps) {
        try {
            removeApp(appId);
        } catch (error) {
            console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Failed removing app" + chalk.bold(`[${appId}]`) + ": " + error);
        }
    }

    memory.db.close();
    console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> Cleaning up memory.. [" + chalk.green.bold("DONE") + ']');
}

process.on('SIGINT', async () => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO]") + " -> Terminated by user");

    cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO]") + " -> Terminated by system");

    cleanup();
    process.exit(0);
});

process.on('uncaughtException', async (err) => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("UNCAUGHT EXCEPTION: ") + err);

    cleanup();
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("UNHANDLED REJECTION: ") + "Location: " + promise + " | Reason: " + reason);

    cleanup();
    process.exit(1);
});

console.log(chalk.cyan.bold("[FILO]") + " -> Booting system..");

console.log(chalk.cyan.bold("[FILO]") + " -> Checking system modules..");

fs.checkFs((status, message) => {
    console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> Filesystem.. " + message);

    fsStatus = status;
});

network.checkNet("http://www.example.com", netRequired, (connected, message) => {
    console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> Network.. " + message);

    netStatus = connected;
    if (!connected) {
        console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> " + chalk.red.bold("Network") + " | A network connection is required for certain components of Filo to function");
    }
});

memory.checkMem((status, message) => {
    console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> Memory.. " + message);

    memStatus = status;
});

boot();