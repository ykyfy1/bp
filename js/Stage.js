/*
Copyright © 2022 NianBroken. All rights reserved.
Github：https://github.com/NianBroken/Firework_Simulator
Gitee：https://gitee.com/nianbroken/Firework_Simulator
本项目采用 Apache-2.0 许可证
简而言之，你可以自由使用、修改和分享本项目的代码，但前提是在其衍生作品中必须保留原始许可证和版权信息，并且必须以相同的许可证发布所有修改过的代码。
*/

const Ticker = (function TickerFactory(window) {
    "use strict";

    const Ticker = {};

    // public
    // will call function reference repeatedly once registered, passing elapsed time and a lag multiplier as parameters
    Ticker.addListener = function addListener(callback) {
        if (typeof callback !== "function")
            throw "Ticker.addListener() requires a function reference passed for a callback.";

        listeners.push(callback);

        // start frame-loop lazily
        if (!started) {
            started = true;
            queueFrame();
        }
    };

    // private
    let started = false;
    let lastTimestamp = 0;
    let listeners = [];

    // queue up a new frame (calls frameHandler)
    function queueFrame() {
        if (window.requestAnimationFrame) {
            requestAnimationFrame(frameHandler);
        } else {
            webkitRequestAnimationFrame(frameHandler);
        }
    }

    // 优化 frameHandler 方法
    function frameHandler(timestamp) {
        let frameTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        // 确保时间不为负数
        frameTime = Math.max(0, frameTime);

        // 限制最小帧率为 15fps (~68ms)
        frameTime = Math.min(frameTime, 68);

        // 触发自定义监听器
        listeners.forEach((listener) => listener.call(window, frameTime, frameTime / 16.6667));

        // 始终排队下一个帧
        queueFrame();
    }

    return Ticker;
})(window);

const Stage = (function StageFactory(window, document, Ticker) {
    "use strict";

    // Track touch times to prevent redundant mouse events.
    let lastTouchTimestamp = 0;

    // Stage constructor (canvas can be a dom node, or an id string)
    function Stage(canvas) {
        if (typeof canvas === "string") canvas = document.getElementById(canvas);

        // canvas and associated context references
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        // Prevent gestures on stages (scrolling, zooming, etc)
        this.canvas.style.touchAction = "none";

        // physics speed multiplier: allows slowing down or speeding up simulation (must be manually implemented in physics layer)
        this.speed = 1;

        // devicePixelRatio alias (should only be used for rendering, physics shouldn't care)
        // avoids rendering unnecessary pixels that browser might handle natively via CanvasRenderingContext2D.backingStorePixelRatio
        // This project is copyrighted by NianBroken!
        this.dpr = Stage.disableHighDPI ? 1 : (window.devicePixelRatio || 1) / (this.ctx.backingStorePixelRatio || 1);

        // canvas size in DIPs and natural pixels
        this.width = canvas.width;
        this.height = canvas.height;
        this.naturalWidth = this.width * this.dpr;
        this.naturalHeight = this.height * this.dpr;

        // size canvas to match natural size
        if (this.width !== this.naturalWidth) {
            this.canvas.width = this.naturalWidth;
            this.canvas.height = this.naturalHeight;
            this.canvas.style.width = this.width + "px";
            this.canvas.style.height = this.height + "px";
        }

        Stage.stages.push(this);

        // event listeners (note that 'ticker' is also an option, for frame events)
        this._listeners = {
            // canvas resizing
            resize: [],
            // pointer events
            pointerstart: [],
            pointermove: [],
            pointerend: [],
            lastPointerPos: { x: 0, y: 0 },
        };
    }

    // track all Stage instances
    Stage.stages = [];

    // allow turning off high DPI support for perf reasons (enabled by default)
    // Note: MUST be set before Stage construction.
    // Each stage tracks its own DPI (initialized at construction time), so you can effectively allow some Stages to render high-res graphics but not others.
    // This project is copyrighted by NianBroken!
    Stage.disableHighDPI = false;

    // events
    Stage.prototype.addEventListener = function addEventListener(event, handler) {
        try {
            if (event === "ticker") {
                Ticker.addListener(handler);
            } else {
                this._listeners[event].push(handler);
            }
        } catch (e) {
            throw "Invalid Event";
        }
    };

    Stage.prototype.dispatchEvent = function dispatchEvent(event, val) {
        const listeners = this._listeners[event];
        if (listeners) {
            listeners.forEach((listener) => listener.call(this, val));
        } else {
            throw "Invalid Event";
        }
    };

    // resize canvas
    Stage.prototype.resize = function resize(w, h) {
        this.width = w;
        this.height = h;
        this.naturalWidth = w * this.dpr;
        this.naturalHeight = h * this.dpr;
        this.canvas.width = this.naturalWidth;
        this.canvas.height = this.naturalHeight;
        this.canvas.style.width = w + "px";
        this.canvas.style.height = h + "px";

        this.dispatchEvent("resize");
    };

    // 优化 windowToCanvas 方法
    Stage.windowToCanvas = function windowToCanvas(canvas, x, y) {
        const bbox = canvas.getBoundingClientRect();
        const scaleX = canvas.width / bbox.width;
        const scaleY = canvas.height / bbox.height;
        return {
            x: (x - bbox.left) * scaleX,
            y: (y - bbox.top) * scaleY,
        };
    };

    // handle interaction
    Stage.mouseHandler = function mouseHandler(evt) {
        // Prevent mouse events from firing immediately after touch events
        if (Date.now() - lastTouchTimestamp < 500) {
            return;
        }

        let type = "start";
        if (evt.type === "mousemove") {
            type = "move";
        } else if (evt.type === "mouseup") {
            type = "end";
        }

        Stage.stages.forEach((stage) => {
            const pos = Stage.windowToCanvas(stage.canvas, evt.clientX, evt.clientY);
            stage.pointerEvent(type, pos.x / stage.dpr, pos.y / stage.dpr);
        });
    };
    Stage.touchHandler = function touchHandler(evt) {
        lastTouchTimestamp = Date.now();

        // Set generic event type
        let type = "start";
        if (evt.type === "touchmove") {
            type = "move";
        } else if (evt.type === "touchend") {
            type = "end";
        }

        // Dispatch "pointer events" for all changed touches across all stages.
        Stage.stages.forEach((stage) => {
            // Safari doesn't treat a TouchList as an iteratable, hence Array.from()
            for (let touch of Array.from(evt.changedTouches)) {
                let pos;
                if (type !== "end") {
                    pos = Stage.windowToCanvas(stage.canvas, touch.clientX, touch.clientY);
                    stage._listeners.lastPointerPos = pos;
                    // before touchstart event, fire a move event to better emulate cursor events
                    // This project is copyrighted by NianBroken!
                    if (type === "start") stage.pointerEvent("move", pos.x / stage.dpr, pos.y / stage.dpr);
                } else {
                    // on touchend, fill in position information based on last known touch location
                    pos = stage._listeners.lastPointerPos;
                }
                stage.pointerEvent(type, pos.x / stage.dpr, pos.y / stage.dpr);
            }
        });
    };

    // 优化 pointerEvent 方法
    Stage.prototype.pointerEvent = function pointerEvent(type, x, y) {
        const evt = {
            type: type,
            x: x,
            y: y,
            onCanvas: x >= 0 && x <= this.width && y >= 0 && y <= this.height,
        };

        this.dispatchEvent("pointer" + type, evt);
    };

    document.addEventListener("mousedown", Stage.mouseHandler);
    document.addEventListener("mousemove", Stage.mouseHandler);
    document.addEventListener("mouseup", Stage.mouseHandler);
    document.addEventListener("touchstart", Stage.touchHandler);
    document.addEventListener("touchmove", Stage.touchHandler);
    document.addEventListener("touchend", Stage.touchHandler);

    return Stage;
})(window, document, Ticker);
