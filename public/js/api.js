class filo {
    static appId = window.location.pathname.split("/")[2];

    static ui = class {
        static launchApp(idOrArgs = window.location.pathname.split("/")[2], maybeArgs = {}) {
            let id;
            let args;

            if (typeof idOrArgs === "string") {
                id = idOrArgs;
                args = maybeArgs;
            } else {
                id = appId;
                args = idOrArgs;
            }

            const { x = 100, y = 100, width = 600, height = 400, isMax = false } = args;

            if (window.parent && typeof window.parent.createWin === "function") {
                window.parent.createWin(id, window.parent.currWinX, window.parent.currWinY, width, height, isMax);
            } else {
                console.error("launchApp(): Parent function is not available");
            }
        }

        static notify(title, body, actionText, action) {
            if (window.parent && typeof window.parent.showNotify === "function") {
                window.parent.showNotify(title, body, actionText, action);
            } else {
                console.error("notify(): Parent function is not available");
            }
        }

        static tooltip(object, text) {
            let tooltip = null;

            function createTooltip() {
                const objRect = object.getBoundingClientRect();

                tooltip = document.createElement("div");
                tooltip.style.display = "block";
                tooltip.style.position = "absolute";
                tooltip.style.padding = "8px";
                tooltip.style.color = "white";
                tooltip.style.backgroundColor = "#282828";
                tooltip.style.borderRadius = "10px";
                tooltip.style.boxShadow = "0 -6px 8px rgba(0, 0, 0, 0.5), 0 6px 8px rgba(0, 0, 0, 0.5), -6px 0 8px rgba(0, 0, 0, 0.5), 6px 0 8px rgba(0, 0, 0, 0.5)";
                tooltip.style.textAlign = "center";
                tooltip.style.fontSize = "18px";
                tooltip.style.lineHeight = 1;
                tooltip.style.userSelect = "none";
                tooltip.style.transform = "translateX(-50%)";
                tooltip.style.transition = "opacity 0.3s";
                tooltip.style.opacity = 0;
                tooltip.style.zIndex = 1001;
                tooltip.style.left = objRect.left + (objRect.width / 2) + "px";
                tooltip.style.top = objRect.top - 50 + "px";
                tooltip.style.userSelect = "none";
                tooltip.innerText = text;
                document.body.appendChild(tooltip);
                tooltip.offsetHeight;
                tooltip.style.opacity = 1;
            }

            function showTooltip() {
                if (tooltip) return;
                createTooltip();
            }

            function hideTooltip() {
                if (tooltip) {
                    tooltip.style.opacity = 0;
                    document.addEventListener("transitionend", function delTooltip() {
                        document.removeEventListener("transitionend", delTooltip);
                        if (tooltip) {
                            tooltip.remove();
                            tooltip = null;
                        }
                    });
                }
            }

            object.addEventListener("mouseover", showTooltip);

            object.addEventListener("mouseout", function(event) {
                if (!object.contains(event.relatedTarget) && !tooltip.contains(event.relatedTarget)) {
                    hideTooltip();
                }
            });

            document.addEventListener("mouseover", function(event) {
                if (tooltip && !object.contains(event.target) && !tooltip.contains(event.target)) {
                    hideTooltip();
                }
            });
        }

        static showLoadingScreen(object) {
            const loadingScreen = document.createElement("div");
            loadingScreen.style.display = "flex";
            loadingScreen.style.position = "fixed";
            loadingScreen.style.top = 0;
            loadingScreen.style.left = 0;
            loadingScreen.style.width = "100%";
            loadingScreen.style.height = "100%";
            loadingScreen.style.backgroundColor = "#282828";
            loadingScreen.style.zIndex = 1000;
            loadingScreen.style.alignItems = "center";
            loadingScreen.style.justifyContent = "center";

            const loadingStyle = document.createElement("style");
            loadingStyle.innerHTML = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;

            document.head.appendChild(loadingStyle);

            const loadingSpinner = document.createElement("div");
            loadingSpinner.style.display = "block";
            loadingSpinner.style.width = "200px";
            loadingSpinner.style.height = "200px";
            loadingSpinner.style.border = "16px solid #181818";
            loadingSpinner.style.borderRadius = "50%";
            loadingSpinner.style.borderTop = "16px solid #005f9e";
            loadingSpinner.style.webkitAnimation = "spin 2s linear infinite";
            loadingScreen.style.transition = "0.2s";

            loadingScreen.appendChild(loadingSpinner);

            object.appendChild(loadingScreen);

            return { screen: loadingScreen, style: loadingStyle };
        }

        static hideLoadingScreen(loadingScreen, loadingStyle) {
            loadingScreen.style.opacity = 0;

            const handleTransitionEnd = () => {
                loadingScreen.remove();
                loadingStyle.remove();
                loadingScreen.removeEventListener("transitionend", handleTransitionEnd);
            };
    
            loadingScreen.addEventListener("transitionend", handleTransitionEnd);

            setTimeout(() => {
                if (loadingScreen.parentNode) {
                    loadingScreen.remove();
                    loadingStyle.remove();
                }
            }, 200);
        }

        static exit() {
            if (window.parent && typeof window.parent.stopApp === "function") {
                window.parent.stopApp(window.location.pathname.split("/")[2], window.location.pathname.split("/")[3]);
            } else {
                console.error("exit(): Parent function is not available");
            }
        }
    }

    static mem = class {
        static async createNode(name, cols) {
            const response = await fetch("/api/mem/createNode/" + name + "/" + JSON.stringify(cols), {
                method: "POST"
            });
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            return result;
        }

        static async addData(name, cols, data) {
            const response = await fetch("/api/mem/addData/" + name + "/" + JSON.stringify(cols) + "/" + JSON.stringify(data), {
                method: "PUT"
            });
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            return result;
        }

        static async deleteNode(name) {
            const response = await fetch("/api/mem/deleteNode/" + name, {
                method: "DELETE"
            });
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            return result;
        }

        static async removeData(name, condition) {
            const response = await fetch("/api/mem/removeData/" + name + "/" + condition, {
                method: "PUT"
            });
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            return result;
        }

        static async readNode(name) {
            const response = await fetch(`/api/mem/readNode/${name}`);
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            return result;
        }

        static async readData(name, column, value) {
            const response = await fetch(`/api/mem/readData/${name}/${column}/${value}`);
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            return result;
        }
    }

    static fs = class {
        static async mkDir(path) {
            try {
                const response = await fetch("/api/fs/createDir", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ path }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(`${result.message}`);
                }

                return result;
            } catch (error) {
                throw error;
            }
        }

        static async rmDir(path) {
            try {
                const response = await fetch("/api/fs/rmDir", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ path }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(`${result.message}`);
                }

                return result;
            } catch (error) {
                throw error;
            }
        }

        static async createFile(path, content, type) {
            try {
                const response = await fetch("/api/fs/createFile", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ path, content, type }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(`${result.message}`);
                }

                return result;
            } catch (error) {
                throw error;
            }
        }

        static async rmFile(path) {
            try {
                const response = await fetch("/api/fs/rmFile", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ path }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(`${result.message}`);
                }

                return result;
            } catch (error) {
                throw error;
            }
        }

        static async stat(path) {
            try {
                const response = await fetch("/api/fs/stat", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ path }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(`${result.message}`);
                }

                return result;
            } catch (error) {
                throw error;
            }
        }

        static async upload(file) {
            const formData = new FormData();
            formData.append("file", file);

            try {
                const response = await fetch("/api/fs/upload", {
                    method: "POST",
                    body: formData
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(`${result.message}`);
                }

                return result;
            } catch (error) {
                throw error;
            }
        }
    }

    static sys = class {
        static async startService(id) {
            const response = await fetch("/start-service/" + id, {
                method: "POST"
            });
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            return response;
        }

        static async stopService(id) {
            const response = await fetch("/stop-service/" + id, {
                method: "POST"
            });
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`);
            }

            return response;
        }
    }

    static auth = class {
        static async getUser() {
            try {
                const response = await fetch("/api/mem/readNode/user");
                if (!response.ok) {
                    throw new Error(`${response.status} ${response.statusText}`);
                }

                const result = await response.json();

                return { email: result.node[0].email };
            } catch (error) {
                throw error;
            }
        }

        static async isSignedIn() {
            try {
                const response = await fetch("/api/mem/readNode/user");
                if (!response.ok) {
                    throw new Error(`${response.status} ${response.statusText}`);
                }

                const result = await response.json();

                return result.node[0] !== undefined;
            } catch (error) {
                throw error;
            }
        }

        static async signIn() {
            if (window.parent && typeof window.parent.showLogin === "function") {
                window.parent.showLogin();

                return new Promise(async (resolve, reject) => {
                    try {
                        const status = await filo.isSignedIn();

                        if (status) {
                            resolve({ status: true });
                        } else {
                            reject({ status: false });
                        }
                    } catch (error) {
                        reject({ status: false, error: error });
                    }
                });
            } else {
                console.error("showLogin(): Parent function is not available");
            }
        }
    }
}

window.filo = filo;