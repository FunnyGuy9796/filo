const express = require("express");
const bodyParser = require('body-parser');
const chalk = require("chalk");
const app = express();

const argon2 = require("argon2");

const firebase = require("firebase/compat/app");
require('firebase/compat/database');

const firebaseConfig = {
    databaseURL: "https://filo-b61fa-default-rtdb.firebaseio.com/",
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const fs = require("./filo_modules/fs");
const network = require("./filo_modules/net");
const memory = require("./filo_modules/mem");

const os = require("os");
const realFs = require("fs");
const fsExtra = require("fs-extra");
const path = require("path");
const configFile= "./config.json";
const servicesFile = "./services.json";

let fsStatus = false;
let memStatus = false;

const data = realFs.readFileSync(configFile, "utf8");
const configData = JSON.parse(data);

const netRequired = configData.network_required;
const servicesPath = configData.services_path;
const appsPath = configData.apps_path;

function waitForCondition(interval = 100) {
    return new Promise((resolve, reject) => {
        const timer = setInterval(() => {
            if (fsStatus && memStatus) {
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

function setUser(username, email, token) {
    const userRef = database.ref(`users/${username}`);

    userRef.set({
        email: email,
        token: token
    }, (error) => {
        if (error) {
            console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + error);
            return false;
        } else {
            console.log(chalk.cyan.bold("[FILO/USER]") + ` -> User account created successfully | {Username: ${username}, Email: ${email}}`);
            return true;
        }
    });
}

async function getUser(email) {
    const userRef = database.ref(`users`);

    try {
        const snapshot = await userRef.once("value");
        let userData = null;

        snapshot.forEach((userSnapshot) => {
            const user = userSnapshot.val();
            if (user.email === email) {
                userData = { username: userSnapshot, ...user };
                return true;
            }
        });

        if (userData) {
            return userData;
        } else {
            console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Could not find the specified account");
            return null;
        }
    } catch(error) {
        console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + error);
        return null;
    }
}

async function stopService(serviceId) {
    const resolvedPath = require.resolve(path.join(servicesPath, serviceId, "main.js"));

    if (require.cache[resolvedPath]) {
        const result = await require(resolvedPath).stop();

        if (result) {
            memory.removeData("services", "id = '" + serviceId + "'");
            delete require.cache[resolvedPath];

            console.log(chalk.cyan.bold("[FILO/SERVICES]") + " -> Stopped system service | Service ID: " + serviceId);
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
            } catch(error) {
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

async function copyDirToVfs(sourceDir, virtualRoot) {

    // Function to recursively copy files and directories
    async function copyRecursive(src, dest) {
        const items = await fsExtra.readdir(src);
        for (const item of items) {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            const stats = await fsExtra.stat(srcPath);

            if (stats.isDirectory()) {
                fs.vol.mkdirSync(destPath);
                await copyRecursive(srcPath, destPath);
            } else if (stats.isFile()) {
                const data = await fsExtra.readFile(srcPath);
                fs.vol.writeFileSync(destPath, data);
            }
        }
    }

    // Start copying from the source directory to the virtual root
    await copyRecursive(sourceDir, virtualRoot);
}

async function genRoutes(res, appId, appIndexFile) {
    console.log(`appId: ${appId}, appIndexFile: ${appIndexFile}`);
    const appPath = path.join("/sys/apps", appId);
    const appFilePath = path.join(appPath, appIndexFile);
    console.log(`appFilePath: ${path.resolve(appFilePath)}`);
    const ext = path.extname(appFilePath);
    const status = fs.checkFile(appFilePath);

    app.engine('ejs', (filePath, options, callback) => {
        console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + ` -> Rendering file at: ${filePath}`);
        
        fs.vol.readFileSync(filePath, 'utf8', (err, data) => {
            if (err) {
                console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Failed to read file for app" + chalk.bold("[" + appId + "]") + `at: ${filePath}`, err);

                return callback(err);
            }
            try {
                console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + ` -> File read successfully: ${filePath}`);

                const rendered = ejs.render(data, options);
                callback(null, rendered);
            } catch (err) {
                console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Failed to render file for app" + chalk.bold("[" + appId + "]") + `at: ${filePath}`, err);

                callback(err);
            }
        });
    });

    app.set("view engine", "ejs");

    if (status) {
        app.set("views", appPath);

        const files = fs.vol.readdirSync(appPath);
        
        files.forEach(file => {
            const filePath = path.join(appPath, file);
            const extname = path.extname(filePath);
            const fileName = path.basename(file, extname);

            if (extname === ".ejs") {
                let routePath = `/${appId}/${fileName}`;
                if (file === appIndexFile) {
                    routePath = `/${appId}`;
                }
                app.get(routePath, (req, res) => {
                    res.render(fileName);
                });
            }
        });

        if (ext === ".ejs") {
            console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Started application | App: " + appId);

            app.use(`/${appId}`, express.static(appPath));

            console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + ` -> Views directory set to: ${app.get("views")}`);

            return res.render(path.basename(appFilePath, ext));
        } else {
            console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Main file for app" + chalk.bold("[" + appId + "]") + " is invalid | Must be .ejs or .pug");
            
            return res.sendFile(path.basename(appFilePath, ext));
        }
    } else {
        console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Main file for app" + chalk.bold("[" + appId + "]") + " could not be found");
            
        return res.status(404).send("app file not found");
    }
}

function startApp(appId, uuid) {
    const absPath = path.join(appsPath, appId);

    if (realFs.existsSync(absPath)) {
        const appConfigFile = path.join(absPath, "appConfig.json");
        const appData = realFs.readFileSync(appConfigFile, "utf8");
        const appConfigData = JSON.parse(appData);

        const appName = appConfigData.name;
        const appIndexFile = appConfigData.index_file;
        const appIconFile = appConfigData.icon_file;

        const vFilePath = "/sys/apps/" + appId;

        const status = fs.checkDir(vFilePath);

        if (!status) {
            fs.fs.mkdirSync(vFilePath);

            (async () => {
                try {
                    await copyDirToVfs(absPath, vFilePath);
                } catch(error) {
                    console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Failed copying directory for app" + chalk.bold("[" + appId + "]") + " to virtual filesystem");
                }
            })();
        }

        const cols = ["id", "name", "index_file", "icon_file"];

        const data = [
            { id: appId + uuid, name: appName, index_file: appIndexFile, icon_file: appIconFile }
        ];

        memory.addData("applications", cols, data);

        return (req, res) => {
            (async () => {
                await genRoutes(res, appId, appIndexFile);
            })();
        };
    } else {
        console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> App with ID " + chalk.bold("[" + appId + "]") + " could not be found");
        
        return res.status(404).send("app file not found");
    }
}

function startAppsProcessor() {
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

        const absPath = path.join("/sys/apps", appId);
        const appConfigFile = path.join(absPath, "appConfig.json");
        let appData;
        try {
            appData = fs.vol.readFileSync(appConfigFile, "utf8");
        } catch (error) {
            console.log(chalk.cyan.bold("[FILO/APPLICATIONS") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> Config file for app" + chalk.bold("[" + appId + "]") + " could not be found");
            return res.status(404).send("App config file not found");
        }

        const appConfigData = JSON.parse(appData);

        const appName = appConfigData.name;
        const appIndexFile = appConfigData.index_file;
        const appIconFile = appConfigData.icon_file;

        app.get("/app-info/" + appId + "/icon", (req, res) => {
            let iconFilePath = path.join(absPath, appIconFile);

            try {
                fs.vol.statSync(iconFilePath);
                const iconFileData = fs.vol.readFileSync(iconFilePath);
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
            appIcon: appIconFile
        }

        res.status(200).json(appInfo);
    });

    console.log(chalk.cyan.bold("[FILO/APPLICATIONS]") + " -> Apps Processor.. [" + chalk.green.bold("OK") + "]");
}

async function boot() {
    try {
        await waitForCondition();

        try {
            console.log(chalk.cyan.bold("[FILO/CONFIG]") + " -> System config.. [" + chalk.green.bold("OK") + "]");

            const PORT = configData.port;

            startServices();
            startAppsProcessor();

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
                argon2.hash(password)
                    .then(hash => {
                        
                    })
                    .catch(error => {
                        console.log(chalk.cyan.bold("[FILO/USER") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("USER NOT HASHED: ") + error);
                        
                        res.redirect("/");
                    });
                */
                
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
        console.log(chalk.cyan.bold("[FILO/MODULES") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + error);

        cleanup();
        process.exit(1);
    }
}

function cleanup() {
    console.log(chalk.cyan.bold("[FILO]") + " -> Cleaning up before shutting down..");

    fs.saveFs((status, message) => {
        console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> Saving filesystem.. " + message);
    });

    memory.db.close();
    console.log(chalk.cyan.bold("[FILO/MODULES]") + " -> Cleaning up memory.. [" + chalk.green.bold("DONE") + ']');
}

process.on('SIGINT', () => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO]") + " -> Terminated by user");

    cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO]") + " -> Terminated by system");

    cleanup();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.log(" ");
    console.log(chalk.cyan.bold("[FILO") + "::" + chalk.red.bold("ERROR") + chalk.cyan.bold("]") + " -> " + chalk.bold("UNCAUGHT EXCEPTION: ") + err);

    cleanup();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
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