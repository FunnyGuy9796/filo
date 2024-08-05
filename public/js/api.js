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
    }

    static mem = class {
        static async createNode(name, cols) {
            const response = await fetch("/api/mem/createNode/" + name + "/" + JSON.stringify(cols), {
                method: "POST"
            });

            const result = await response.json();

            console.log("mem.createNode(): ", result);
            return result;
        }

        static async addData(name, cols, data) {
            const response = await fetch("/api/mem/addData/" + name + "/" + JSON.stringify(cols) + "/" + JSON.stringify(data), {
                method: "PUT"
            });

            const result = await response.json();

            console.log("mem.addData(): ", result);
            return result;
        }

        static async deleteNode(name) {
            const response = await fetch("/api/mem/deleteNode/" + name, {
                method: "DELETE"
            });

            const result = await response.json();

            console.log("mem.deleteNode(): ", result);
            return result;
        }

        static async removeData(name, condition) {
            const response = await fetch("/api/mem/removeData/" + name + "/" + condition, {
                method: "PUT"
            });

            const result = await response.json();

            console.log("mem.removeData(): ", result);
            return result;
        }

        static async readNode(name) {
            const response = await fetch("/api/mem/readNode/" + name);
            const result = await response.json();

            console.log("mem.readNode(): ", result);
            return result;
        }

        static async readData(name, condition) {
            const response = await fetch("/api/mem/readData/" + name + "/" + condition);
            const result = await response.json();

            console.log("mem.readData(): ", result);
            return result;
        }
    }

    static sys = class {
        static async startService(id) {
            const response = await fetch("/start-service/" + id, {
                method: "POST"
            });

            console.log("sys.startService(): ", response);
            return response;
        }

        static async stopService(id) {
            const response = await fetch("/stop-service/" + id, {
                method: "POST"
            });

            console.log("sys.stopService(): ", response);
            return response;
        }
    }

    static exit() {
        console.log("exit() called from app ", window.location.pathname.split("/")[2] + window.location.pathname.split("/")[3]);
        window.parent.stopApp(window.location.pathname.split("/")[2], window.location.pathname.split("/")[3]);
    }
}

window.filo = filo;